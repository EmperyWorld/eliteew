# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat turn helpers: tool/web/temporal heuristics, model resolve, speaker context, memory write.
# Invariants:
# - Stream Wave A: short prep session then LLM/SSE without request-scoped ORM; writes via isolated sessions.
# - `chat.updated_at` is refreshed with `utc_now_naive()` on successful turn mutations.
# - Project vault usage always passes access checks before retrieval.
# Related:
# - api/routers/desktop_ai_chat.py
# - api/services/desktop_chat/db_session.py
# - api/services/desktop_chat_ensemble/stream_turn.py
# ---
# pyright: reportUnusedFunction=false
"""Turn helpers shared by service_stream / service_tool_loop / service_rag / facade."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.unified_config import unified_settings
from api.models.database_models import User
from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiChatConfig, DesktopAiChatMessage
from api.routers.marketing_cabinet.common import assert_project_marketing_lead, get_accessible_project
from api.services.desktop_chat.collaboration_authors import (
    dialog_line_role_for_user,
    disambiguate_display_names,
    resolve_author_display_name,
    speaker_role_label,
)
from api.services.desktop_chat.collaboration_members import count_accepted_members
from api.services.desktop_chat.llm.runtime import desktop_stream_chat_completion
from api.services.desktop_chat.tools import fetch_url as desktop_fetch_url_tool
from api.services.desktop_chat.tools import image_ugs as desktop_image_ugs_tool
from api.services.desktop_chat.tools import web_search_tool as desktop_web_search_tool
from api.services.desktop_chat.tools import web_stub as desktop_web_stub_tool
from api.utils.llm_wall_clock_context import wall_clock_snapshot

logger = logging.getLogger(__name__)

# Shared by service_{stream,tool_loop,rag,persist} and facade re-exports; keep names stable.
__all__ = [
    "MAX_HISTORY_MESSAGES",
    "_append_image_markdown_from_tool_trace",
    "_assistant_claims_no_web_data",
    "_chat_hero_id",
    "_desktop_chat_chunk_cap",
    "_desktop_image_tool_result_looks_failed",
    "_desktop_rag_rerank_on",
    "_desktop_recent_dialog_lines",
    "_desktop_rerank_max_docs",
    "_desktop_rerank_timeout_sec",
    "_emit_rag_empty_metrics",
    "_history_tail_for_router",
    "_llama_tool_calls_payload_from_normalized",
    "_maybe_temporal_short_circuit_reply",
    "_post_router_tool_followup_nudge",
    "_rag_chunk_quality",
    "_router_executed_tool_name",
    "_router_executed_tool_preview",
    "_stream_desktop_chat_llm_tokens",
    "_web_search_tool_result_has_hits",
    "_yield_token_chunks",
    "fetch_config_defaults",
    "load_speaker_context",
    "record_desktop_chat_turn_memory",
    "resolve_desktop_chat_model",
    "try_recover_tool_calls_from_assistant_text",
    "verify_project_for_chat",
]

MAX_HISTORY_MESSAGES = 40

_TOOLS_RECOVERABLE_FROM_TEXT = frozenset(
    {
        desktop_image_ugs_tool.TOOL_NAME,
        desktop_fetch_url_tool.TOOL_NAME,
        desktop_web_stub_tool.TOOL_NAME,
    }
)


def _desktop_image_tool_result_looks_failed(msg: str) -> bool:
    s = (msg or "").strip().lower()
    if not s:
        return True
    if s.startswith("ошибка"):
        return True
    if "не завершена" in s[:200] or "превышено время" in s[:160]:
        return True
    return "отключён" in s[:120] or "отключен" in s[:120]


# Сообщение только в памяти tool-loop (в БД не сохраняется): ломает типичный «safety»-отказ после успешной UGS.
_IMAGE_FOLLOWUP_NUDGE_USER = (
    "[Служебная инструкция приложения EliteEW] Выше уже есть результат инструмента "
    "desktop_generate_image (сообщения role=tool): изображение создано на сервере и отображается в этом чате (превью/вложение).\n"
    "Ответь пользователю по-русски кратко (2–5 предложений): подтверди, что картинка готова и видна в интерфейсе, "
    "опиши сцену по запросу пользователя.\n"
    "Категорически нельзя писать, что ты «не можешь показать» или «не можешь сгенерировать» изображение, "
    "и нельзя советовать нанять иллюстратора или дизайнера — генерация уже выполнена продуктом."
)

_WEB_SEARCH_FOLLOWUP_NUDGE_USER = (
    "[Служебная инструкция приложения EliteEW] Веб-поиск desktop_web_search уже выполнен сервером. "
    "Факты и URL — в сообщениях role=tool и/или в блоке «Срез из веб-поиска» в запросе пользователя.\n"
    "Ответь пользователю по-русски на его вопрос, опираясь на эти результаты: перечисли ключевые новости или факты, "
    "укажи источники (URL из среза), отметь, если данных за запрошенную дату мало.\n"
    "Категорически нельзя писать, что у тебя «нет доступа к новостям», «не можешь просканировать СМИ», "
    "что «нет role=tool» или просить пользователя прислать ссылки — веб-поиск уже выполнен сервером."
)


_WEB_SEARCH_NO_HITS_FOLLOWUP_NUDGE_USER = (
    "[Служебная инструкция приложения EliteEW] В этом ходе desktop_web_search уже выполнялся сервером, "
    "но релевантные результаты не получены (или они недостаточны для точного ответа).\n"
    "Ответь пользователю честно: веб-поиск не дал проверяемых фактов по запросу. "
    "Предложи уточнить формулировку/источник/дату. "
    "Категорически нельзя выдумывать новости, температуры, цифры, события и ссылки."
)


_WEB_SEARCH_REPAIR_NUDGE_USER = (
    "[Служебная инструкция приложения EliteEW] В этом ходе desktop_web_search уже вернул результаты (факты/URL). "
    "Сформируй ответ только по доступным результатам: кратко перечисли проверяемые факты, укажи источники (URL) и явно "
    "обозначь ограничения.\n"
    "Категорически нельзя писать, что данных «нет» или что поиск «не выполнялся», если в этом ходе уже есть результаты web_search."
)


def _web_search_tool_result_has_hits(output: str) -> bool:
    lowered = (output or "").strip().casefold()
    if not lowered:
        return False
    no_hit_markers = (
        "веб-поиск отключён",
        "веб-поиск отключен",
        "не настроен на сервере",
        "ничего не найдено",
        "укажите непустой поисковый запрос",
        "не удалось сформировать поисковый запрос",
        "лимит веб-поиска",
    )
    return not any(marker in lowered for marker in no_hit_markers)


def _assistant_claims_no_web_data(text: str) -> bool:
    lowered = (text or "").strip().casefold()
    if not lowered:
        return True
    no_data_markers = (
        "не могу дать",
        "не могу ответить",
        "не могу предоставить",
        "нет свежего среза",
        "нет прямой информации",
        "данных нет",
        "не нашел",
        "не нашёл",
        "поиск не дал",
        "не попали в текущую выборку",
        "не выполнялся",
    )
    return any(marker in lowered for marker in no_data_markers)


_DATE_TIME_DIRECT_RE = re.compile(
    r"(какая\s+дата\s+сегодня|какой\s+сегодня\s+(?:день|месяц|год)|сколько\s+сейчас\s+времени|который\s+час)",
    re.IGNORECASE,
)


def _history_contains_recent_date_answer(history: list[DesktopAiChatMessage], year: int) -> bool:
    for msg in reversed(history[-4:]):
        if msg.role != "assistant":
            continue
        body = (msg.content or "").casefold()
        if str(year) in body and any(token in body for token in ("дата", "сегодня", "год", "время")):
            return True
    return False


def _maybe_temporal_short_circuit_reply(
    *,
    user_text: str,
    history: list[DesktopAiChatMessage],
) -> str | None:
    raw = (user_text or "").strip()
    if not raw:
        return None
    lowered = raw.casefold()
    snap = wall_clock_snapshot()
    base = (
        f"По серверу EliteEW сейчас {snap.weekday_ru}, {snap.date_long_ru}, {snap.time_ru} "
        f"({snap.tz_label}, {snap.tz_name})."
    )
    if _DATE_TIME_DIRECT_RE.search(raw):
        return base
    if (
        "ты уверена" in lowered or "ты уверен" in lowered or lowered in {"точно?", "точно"}
    ) and _history_contains_recent_date_answer(
        history,
        snap.year,
    ):
        return (
            f"{base} Если нужно считать от другой даты, задай её явно (например, 2024-07-01), "
            "и я буду вести расчёты относительно неё в этом диалоге."
        )
    if re.search(r"\bсейчас\s+20\d{2}\b", lowered):
        return (
            f"{base} Понял, что ты указываешь другой год. Для планирования могу работать от твоей референсной даты — "
            "просто задай её явно."
        )
    if "если бы" in lowered and len(re.findall(r"\b20\d{2}\b", lowered)) >= 1:
        return (
            f"{base} В гипотетических сценариях я работаю от явно заданной пользователем даты; "
            "без явной даты использую серверную метку времени."
        )
    return None


def _router_executed_tool_name(router_trace: list[dict[str, Any]]) -> str:
    for row in reversed(router_trace):
        name = row.get("name")
        if isinstance(name, str) and name.strip():
            return name.strip()
    return ""


def _router_executed_tool_preview(router_trace: list[dict[str, Any]]) -> str:
    for row in reversed(router_trace):
        name = row.get("name")
        if not (isinstance(name, str) and name.strip()):
            continue
        preview = row.get("preview")
        if isinstance(preview, str):
            return preview
        break
    return ""


def _post_router_tool_followup_nudge(*, tool_name: str, tool_preview: str = "") -> str:
    if tool_name == desktop_web_search_tool.TOOL_NAME:
        if not _web_search_tool_result_has_hits(tool_preview):
            return _WEB_SEARCH_NO_HITS_FOLLOWUP_NUDGE_USER
        return _WEB_SEARCH_FOLLOWUP_NUDGE_USER
    if tool_name == desktop_image_ugs_tool.TOOL_NAME:
        return _IMAGE_FOLLOWUP_NUDGE_USER
    return (
        "[Служебная инструкция приложения EliteEW] Выше уже есть результат инструмента "
        f"{tool_name} (role=tool). Ответь пользователю по-русски, опираясь на этот результат; "
        "не утверждай, что действие недоступно — оно уже выполнено сервером."
    )


def try_recover_tool_calls_from_assistant_text(text: str) -> list[dict[str, Any]]:
    """
    Некоторые модели кладут ``{"name": "...", "parameters": {...}}`` в content вместо tool_calls.
    Достаём один вызов из markdown ```json``` или из одиночного объекта в конце ответа.
    """
    if not text or not any(t in text for t in _TOOLS_RECOVERABLE_FROM_TEXT):
        return []

    blobs: list[str] = []
    for m in re.finditer(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE):
        cand = m.group(1).strip()
        if cand.startswith("{") or cand.startswith("["):
            blobs.append(cand)
    s = text.strip()
    if s.startswith("{") and s not in blobs:
        blobs.append(s)
    # хвост после двойного перевода строки иногда целиком JSON
    tail = s.rsplit("\n\n", 1)[-1].strip()
    if tail.startswith("{") and tail not in blobs:
        blobs.append(tail)

    for blob in blobs:
        try:
            obj: Any = json.loads(blob)
        except json.JSONDecodeError:
            continue
        if isinstance(obj, list) and obj and isinstance(obj[0], dict):
            obj = obj[0]
        if not isinstance(obj, dict):
            continue
        name = obj.get("name")
        if not isinstance(name, str) or not name.strip():
            fn = obj.get("function")
            if isinstance(fn, dict) and isinstance(fn.get("name"), str):
                name = fn["name"]
        name = str(name or "").strip()
        if name not in _TOOLS_RECOVERABLE_FROM_TEXT:
            continue
        params = obj.get("parameters") or obj.get("arguments") or {}
        if isinstance(params, str) and params.strip():
            try:
                params = json.loads(params)
            except json.JSONDecodeError:
                params = {}
        if not isinstance(params, dict):
            params = {}
        return [{"name": name, "arguments": params}]
    return []


_CONTENT_ID_IN_TOOL_PREVIEW = re.compile(
    r"(?:content_id|unified_content_id)\s*[:=]\s*"
    r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
    re.IGNORECASE,
)


def _content_ids_from_image_tool_trace(trace: list[dict[str, Any]]) -> list[str]:
    """Достаёт UUID из трассы (поле content_id или текст desktop_generate_image)."""
    ordered: list[str] = []
    seen: set[str] = set()
    for item in trace:
        for t in item.get("tools") or []:
            if t.get("name") != desktop_image_ugs_tool.TOOL_NAME or not t.get("ok"):
                continue
            cid_raw = t.get("content_id")
            if isinstance(cid_raw, str) and len(cid_raw.strip()) >= 32:
                cid = cid_raw.strip().lower()
                if cid not in seen:
                    seen.add(cid)
                    ordered.append(cid)
            prev = str(t.get("preview") or "")
            for m in _CONTENT_ID_IN_TOOL_PREVIEW.finditer(prev):
                cid = m.group(1).lower()
                if cid not in seen:
                    seen.add(cid)
                    ordered.append(cid)
    return ordered


def _append_image_markdown_from_tool_trace(text: str, trace: list[dict[str, Any]]) -> str:
    """
    В ленте чата превью картинки даёт markdown с same-origin URL (см. DesktopAiChatMarkdown).
    Иначе пользователь не видит файл, хотя UGS завершился и вложение могло появиться в БД.
    """
    ids = _content_ids_from_image_tool_trace(trace)
    if not ids:
        return text
    body = (text or "").rstrip()
    missing = [cid for cid in ids if f"/api/v1/content/{cid}/download" not in body]
    if not missing:
        return text if text is not None else ""
    lines = [f"![Сгенерированное изображение](/api/v1/content/{cid}/download)" for cid in missing]
    return body + "\n\n" + "\n".join(lines)


def _llama_tool_calls_payload_from_normalized(calls: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Формат ``tool_calls`` для повторной отправки в Llama ``/api/chat``: у каждого вызова
    ``type: function``, ``function.arguments`` — **объект** (не JSON-строка). Иначе Llama 400:
    ``Value looks like object, but can't find closing '}' symbol``.
    """
    out: list[dict[str, Any]] = []
    for i, c in enumerate(calls):
        name = str(c.get("name") or "")
        args = c.get("arguments") if isinstance(c.get("arguments"), dict) else {}
        out.append(
            {
                "type": "function",
                "function": {
                    "index": i,
                    "name": name,
                    "arguments": args,
                },
            }
        )
    return out


def _chat_hero_id(chat: DesktopAiChat) -> str | None:
    settings = chat.settings if isinstance(chat.settings, dict) else {}
    raw = settings.get("desktop_hero_id")
    return raw.strip() if isinstance(raw, str) and raw.strip() else None


def _history_tail_for_router(history: list[DesktopAiChatMessage]) -> str:
    return "\n".join(_desktop_recent_dialog_lines(history, limit=8))


async def _yield_token_chunks(
    text: str,
    *,
    full_text: list[str],
    last_beat_ref: list[float],
    n_chunks_ref: list[int],
    step_divisor: int = 48,
) -> AsyncGenerator[str]:
    step = max(12, min(80, len(text) // step_divisor + 1)) if text else 1
    for i in range(0, len(text), step):
        piece = text[i : i + step]
        full_text.append(piece)
        n_chunks_ref[0] += 1
        yield f"data: {json.dumps({'event': 'token', 'delta': piece}, ensure_ascii=False)}\n\n"
        now = asyncio.get_event_loop().time()
        if n_chunks_ref[0] % 15 == 0 and now - last_beat_ref[0] > 1.5:
            yield ": keep-alive\n\n"
            last_beat_ref[0] = now


async def _stream_desktop_chat_llm_tokens(
    llama_messages: list[dict[str, Any]],
    *,
    model: str,
    defaults: dict[str, Any],
    full_text: list[str],
    last_beat_ref: list[float],
    n_chunks_ref: list[int],
) -> AsyncGenerator[str]:
    async for piece in desktop_stream_chat_completion(
        messages=llama_messages,
        model=model,
        defaults=defaults,
    ):
        if not piece:
            continue
        full_text.append(piece)
        n_chunks_ref[0] += 1
        yield f"data: {json.dumps({'event': 'token', 'delta': piece}, ensure_ascii=False)}\n\n"
        now = asyncio.get_event_loop().time()
        if n_chunks_ref[0] % 20 == 0 and now - last_beat_ref[0] > 1.8:
            yield ": keep-alive\n\n"
            last_beat_ref[0] = now


def resolve_desktop_chat_model(chat: DesktopAiChat, defaults: dict[str, Any]) -> str:
    """
    Модель для Llama: поле чата или desktop_ai_chat_config.defaults.default_llama_model;
    иначе тот же каскад, что у ИМК RAG-исследований: ``unified_settings.bi_ai_model``
    (LLAMA_MODEL_BI → LLAMA_MODEL_MARKETING → LLAMA_MODEL в .env.stack0.backend).
    """
    raw = chat.llama_model or defaults.get("default_llama_model")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return unified_settings.bi_ai_model


async def fetch_config_defaults(db: AsyncSession) -> dict[str, Any]:
    row = await db.get(DesktopAiChatConfig, 1)
    if row is None or row.defaults is None:
        return {}
    return dict(row.defaults)


async def verify_project_for_chat(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID | None,
    user_id: UUID,
    use_project_rag: bool,
) -> None:
    if project_id is None:
        return
    await get_accessible_project(db_pool, project_id, user_id)
    if use_project_rag:
        await assert_project_marketing_lead(db_pool, project_id, user_id)


def _desktop_rag_rerank_on(defaults: dict[str, Any]) -> bool:
    base = (getattr(unified_settings, "rag_rerank_base_url", None) or "").strip()
    if not base:
        return False
    if "rag_rerank_enabled" in defaults:
        return bool(defaults.get("rag_rerank_enabled"))
    return True


def _desktop_rerank_timeout_sec(defaults: dict[str, Any]) -> float:
    raw = defaults.get("rag_rerank_timeout_ms")
    try:
        ms = int(raw) if raw is not None else 45_000
    except (TypeError, ValueError):  # fmt: skip
        ms = 45_000
    return max(5.0, min(120.0, ms / 1000.0))


def _desktop_rerank_max_docs(defaults: dict[str, Any]) -> int:
    raw = defaults.get("rag_rerank_max_docs")
    try:
        n = int(raw) if raw is not None else 40
    except (TypeError, ValueError):  # fmt: skip
        n = 40
    return max(8, min(64, n))


def _desktop_chat_chunk_cap(defaults: dict[str, Any]) -> int:
    from api.services.desktop_chat.rag_limits import DEFAULT_RAG_CHAT_MAX_CHUNKS

    raw = defaults.get("rag_chat_max_chunks")
    try:
        n = int(raw) if raw is not None else DEFAULT_RAG_CHAT_MAX_CHUNKS
    except (TypeError, ValueError):  # fmt: skip
        n = DEFAULT_RAG_CHAT_MAX_CHUNKS
    return max(1, min(32, n))


def _rag_chunk_quality(chunks: list[Any]) -> dict[str, Any]:
    scores: list[float] = []
    unique_content_ids: set[str] = set()
    for ch in chunks:
        cid = getattr(ch, "content_id", None)
        if isinstance(cid, str) and cid.strip():
            unique_content_ids.add(cid.strip())
        raw_score = getattr(ch, "score", None)
        if isinstance(raw_score, (int, float)):
            scores.append(float(raw_score))
    out: dict[str, Any] = {
        "chunks": len(chunks),
        "scored": len(scores),
        "unique_content_ids": len(unique_content_ids),
    }
    if scores:
        out["score_min"] = round(min(scores), 4)
        out["score_max"] = round(max(scores), 4)
        out["score_avg"] = round(sum(scores) / len(scores), 4)
    return out


def _desktop_recent_dialog_lines(
    history: list[DesktopAiChatMessage],
    *,
    limit: int = 6,
    is_shared: bool = False,
    owner_id: UUID | None = None,
    speaker_labels: dict[UUID, str] | None = None,
) -> list[str]:
    out: list[str] = []
    labels = speaker_labels or {}
    for msg in history[-limit:]:
        if msg.role not in {"user", "assistant"}:
            continue
        content = (msg.content or "").strip()
        if not content:
            continue
        if msg.role == "user":
            aid = msg.author_user_id or owner_id
            label = labels.get(aid) if aid else None
            role = dialog_line_role_for_user(is_shared=is_shared, speaker_label=label)
        else:
            role = "Ассистент"
        out.append(f"{role}: {content}")
    return out


async def load_speaker_context(
    db: AsyncSession,
    *,
    chat: DesktopAiChat,
    history: list[DesktopAiChatMessage],
    actor_user_id: UUID,
) -> dict[str, Any]:
    """Build shared-chat speaker labels for LLM history / current turn."""
    accepted = await count_accepted_members(db, chat.id)
    is_shared = accepted > 0
    owner_id = chat.user_id
    need_ids: set[UUID] = {owner_id, actor_user_id}
    for msg in history:
        if msg.role == "user":
            if msg.author_user_id:
                need_ids.add(msg.author_user_id)
            else:
                need_ids.add(owner_id)
    users_r = await db.execute(select(User).where(User.id.in_(list(need_ids))))
    users = {u.id: u for u in users_r.scalars().all()}
    raw_names: dict[UUID, str] = {}
    usernames: dict[UUID, str] = {}
    for uid in need_ids:
        u = users.get(uid)
        raw_names[uid] = resolve_author_display_name(
            full_name=getattr(u, "full_name", None) if u else None,
            username=getattr(u, "username", None) if u else None,
            user_id=uid,
        )
        usernames[uid] = str(getattr(u, "username", "") or "")
    display = disambiguate_display_names(raw_names, usernames=usernames)
    labels = {uid: speaker_role_label(is_owner=(uid == owner_id), display_name=name) for uid, name in display.items()}
    return {
        "is_shared": is_shared,
        "owner_id": owner_id,
        "labels": labels,
        "actor_label": labels.get(actor_user_id),
        "actor_display_name": display.get(actor_user_id),
        "actor_is_owner": actor_user_id == owner_id,
    }


_DESKTOP_CHAT_MEMORY_PROFILE = "desktop_ai_chat"


def _emit_rag_empty_metrics(summary: dict[str, Any], *, profile: str) -> None:
    from api.monitoring.metrics import observe_desktop_ai_chat_rag_empty

    if not int(summary.get("chat_memory_hits") or 0):
        observe_desktop_ai_chat_rag_empty(layer="memory", profile=profile)
    if not int(summary.get("chat_rag_chunks") or 0):
        observe_desktop_ai_chat_rag_empty(layer="chat_rag", profile=profile)
    if summary.get("project_vault_requested") and not int(summary.get("project_vault_chunks") or 0):
        observe_desktop_ai_chat_rag_empty(layer="vault", profile=profile)


async def record_desktop_chat_turn_memory(
    *,
    chat_id: UUID,
    user_text: str,
    assistant_text: str,
    assistant_message_id: UUID | None = None,
) -> None:
    """Best-effort episodic memory for desktop chat (chat_history collection)."""
    from api.services.chat_memory_service import upsert_memory
    from api.services.desktop_chat_ensemble.speaker_output import scrub_ensemble_channel_leak

    ut = (user_text or "").strip()
    at = scrub_ensemble_channel_leak(assistant_text or "")
    if not ut or not at:
        return
    await upsert_memory(
        ut,
        session_id=str(chat_id),
        assistant_text=at,
        chat_profile=_DESKTOP_CHAT_MEMORY_PROFILE,
        source_message_id=str(assistant_message_id) if assistant_message_id else None,
        idempotency_key=str(assistant_message_id) if assistant_message_id else None,
    )
