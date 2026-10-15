# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Product assistant (Справочник): FAQ, chat, settings, preview, reply finalize helpers.
# Invariants:
# - Desktop deep-link allowlist from EliteEW/shared/assistant_desktop_link_components.json.
# Related:
# - api/routers/product_desktop.py (parent router include)
# - api/routers/product_desktop_assistant_kb.py
# - documentation/product/PRODUCT-ASSISTANT-HANDBOOK.md
# ---
"""Assistant routes and prompt/finalize helpers for product desktop API."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import httpx  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.http_clients import get_httpx_client
from api.core.oauth2_auth import require_oauth2_user
from api.core.unified_config import unified_settings
from api.gaf_chat.system_gaf_instruction import (
    ALLOWED_DESKTOP_APP_COMPONENTS,
    ASSISTANT_SHELL_LINK_COMPONENTS,
)
from api.routers.desktop import get_desktop_user_id
from api.routers.desktop_admin import require_admin_user
from api.services.product_assistant_llm_contract import (
    ASSISTANT_JSON_SYSTEM_SUFFIX,
    ASSISTANT_REPLY_JSON_SCHEMA,
    iter_assistant_reply_sse_chunks,
    parse_assistant_reply_markdown,
)
from api.services.product_assistant_prompt_helpers import (
    ASSISTANT_CHAT_HISTORY_MAX_TURNS,
    ASSISTANT_DEGENERATE_FALLBACK,
    ASSISTANT_LLAMA_NUM_PREDICT,
    build_assistant_rag_query,
    build_faq_context_block,
    collect_rag_source_labels,
    format_assistant_chat_history_block,
    guard_assistant_reply_quality,
    maybe_append_rag_sources_footer,
    sanitize_assistant_model_reply,
)
from api.services.product_assistant_rag_service import (
    format_rag_context_for_prompt,
    rag_chunk_source_labels,
    search_product_assistant_kb_hybrid,
)
from api.services.rate_limiter import RateLimiter, get_product_assistant_chat_rate_limiter
from api.utils.llama_keep_alive import llama_keep_alive_from_settings
from api.utils.llm_openai_compat_http import httpx_compat_generate_json

logger = logging.getLogger(__name__)

_ASSISTANT_FAQ_CONTEXT_MAX_CHARS = 12_000
_ASSISTANT_PREVIEW_PROMPT_MAX_CHARS = 8_000

assistant_router = APIRouter(tags=["product-desktop"])


class AssistantFaqEntryOut(BaseModel):
    id: UUID
    question: str
    answer: str
    sort_order: int


class AssistantFaqCreateBody(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    answer: str = Field(..., min_length=1, max_length=20000)
    sort_order: int = 0


class AssistantFaqUpdateBody(BaseModel):
    question: str | None = Field(None, min_length=1, max_length=2000)
    answer: str | None = Field(None, min_length=1, max_length=20000)
    sort_order: int | None = None


class AssistantChatMessageOut(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime


class AssistantChatBody(BaseModel):
    message: str = Field(..., min_length=1, max_length=32000)


class AssistantSettingsOut(BaseModel):
    llama_model: str | None
    extra_system_prompt: str | None
    rag_top_k: int
    rag_enabled: bool


class AssistantSettingsPatchBody(BaseModel):
    llama_model: str | None = None
    extra_system_prompt: str | None = None
    rag_top_k: int | None = Field(None, ge=1, le=32)
    rag_enabled: bool | None = None


class AssistantPreviewBody(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    include_my_history: bool = False


class AssistantPreviewOut(BaseModel):
    model: str
    rag_enabled: bool
    rag_source_labels: list[str]
    faq_chars: int
    rag_chars: int
    history_chars: int
    prompt_chars: int
    prompt_preview: str
    prompt_full: str


def _default_assistant_model_str() -> str:
    return (
        os.environ.get("ASSISTANT_LLAMA_MODEL", "").strip()
        or getattr(unified_settings, "llama_primary_model", None)
        or getattr(unified_settings, "default_ai_model", None)
        or "llama3.2"
    )


async def _get_assistant_settings(db: AsyncSession) -> dict[str, Any]:
    """Load row id=1; on missing table return env-backed defaults."""
    defaults: dict[str, Any] = {
        "llama_model": None,
        "extra_system_prompt": None,
        "rag_top_k": 8,
        "rag_enabled": True,
    }
    try:
        r = await db.execute(
            text(
                """
                SELECT llama_model, extra_system_prompt, rag_top_k, rag_enabled
                FROM assistant_settings WHERE id = 1
                """
            )
        )
        row = r.mappings().first()
        if not row:
            return defaults
        return {
            "llama_model": row["llama_model"],
            "extra_system_prompt": row["extra_system_prompt"],
            "rag_top_k": int(row["rag_top_k"] or 8),
            "rag_enabled": bool(row["rag_enabled"]),
        }
    except Exception:
        logger.warning("assistant_settings: table missing or unreadable, using defaults")
        return defaults


async def _fetch_faq_context_block(
    db: AsyncSession,
    *,
    user_text: str,
    history_rows: list[dict[str, str]],
) -> str:
    faq_r = await db.execute(
        text(
            """
            SELECT question, answer FROM assistant_faq_entries
            ORDER BY sort_order ASC, created_at ASC
            LIMIT 200
            """
        )
    )
    entries = [dict(r) for r in faq_r.mappings().all()]
    query = build_assistant_rag_query(user_text, history_rows)
    return build_faq_context_block(entries, query, max_chars=_ASSISTANT_FAQ_CONTEXT_MAX_CHARS)


def _enforce_assistant_chat_rate_limit(user_id: UUID, rate_limiter: RateLimiter) -> None:
    if not unified_settings.rate_limit_enabled:
        return
    allowed, retry_after = rate_limiter.check_rate_limit(str(user_id))
    if not allowed:
        ra = int(retry_after) if retry_after is not None else 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много запросов к справочнику. Подождите и попробуйте снова.",
            headers={"Retry-After": str(max(1, ra))},
        )


async def _fetch_assistant_chat_history_rows(db: AsyncSession, user_id: UUID) -> list[dict[str, str]]:
    """Последние сообщения пользователя до текущего turn (вызывать до INSERT user message)."""
    try:
        result = await db.execute(
            text(
                """
                SELECT role, content
                FROM assistant_chat_messages
                WHERE user_id = :uid
                ORDER BY created_at DESC
                LIMIT :lim
                """
            ),
            {
                "uid": str(user_id),
                "lim": ASSISTANT_CHAT_HISTORY_MAX_TURNS * 2,
            },
        )
        rows = [dict(r) for r in result.mappings().all()]
        rows.reverse()
        return rows
    except Exception:
        logger.warning("assistant_chat_history: fetch failed user_id=%s", user_id)
        return []


async def _compose_assistant_prompt(
    db: AsyncSession,
    user_text: str,
    *,
    user_id: UUID | None = None,
) -> tuple[str, str, str, list[str | None], dict[str, int]]:
    settings = await _get_assistant_settings(db)
    model = (settings.get("llama_model") or "").strip() or _default_assistant_model_str()
    history_rows: list[dict[str, str]] = []
    if user_id is not None:
        history_rows = await _fetch_assistant_chat_history_rows(db, user_id)
    history_block = format_assistant_chat_history_block(history_rows)
    faq_block = await _fetch_faq_context_block(db, user_text=user_text, history_rows=history_rows)
    rag_block = ""
    rag_source_labels: list[str | None] = []
    if settings.get("rag_enabled"):
        top_k = int(settings.get("rag_top_k") or 8)
        rag_query = build_assistant_rag_query(user_text, history_rows)
        chunks = await search_product_assistant_kb_hybrid(db, query=rag_query, limit=top_k)
        rag_source_labels = rag_chunk_source_labels(chunks)
        rag_block = format_rag_context_for_prompt(chunks)
    extra = (settings.get("extra_system_prompt") or "").strip()
    _desktop_components_csv = ", ".join(sorted(ALLOWED_DESKTOP_APP_COMPONENTS))
    _assistant_md_open_path = "/__eliteew-desktop-open-app__/"
    system_bits = (
        "Ты — помощник только по продукту EliteEW (веб- и десктоп-приложение: рабочий стол, "
        "приложения, настройки, справочник, сценарии использования).\n"
        "Отвечай по-русски, кратко, без лишней воды.\n\n"
        "Используй только блоки «FAQ», «RAG» и «Предыдущие сообщения» ниже и то, что явно следует из них. "
        "Не выдумывай функции, разделы и кнопки, которых нет в этих материалах.\n"
        "Если пользователь уточняет («а как туда зайти», «это не помогло», «где кнопка») — опирайся на "
        "предыдущий обмен в чате и не теряй нить темы.\n"
        "Ответ — одно сообщение помощника на последний вопрос пользователя. "
        "Не пиши префиксы «Пользователь:» или «Помощник:», не имитируй следующий ход диалога "
        "и не повторяй один и тот же ответ несколько раз подряд.\n"
        "Если используешь фрагменты RAG — в конце ответа одной строкой укажи, из каких материалов "
        "(по заголовкам в квадратных скобках) ты взял ключевые факты.\n\n"
        "Ссылки на приложения рабочего стола (Markdown), предпочтительно в виде "
        f"[подпись для пользователя]({_assistant_md_open_path}ИмяКомпонента), где ИмяКомпонента — ровно одно из "
        f"перечисленных имён (без кавычек, без пробелов внутри имени): {_desktop_components_csv}. "
        "Допустим также устаревший вариант eliteew-desktop:///ИмяКомпонента.\n"
        "Меню «Пуск» и панель настроек рабочего стола (не отдельные приложения): "
        f"[подпись]({_assistant_md_open_path}EliteEwShellStartMenu), "
        f"[подпись]({_assistant_md_open_path}EliteEwShellSettings) или с вкладкой "
        f"{_assistant_md_open_path}EliteEwShellSettings/icons (второй сегмент: personalize, icons, chrome, shell, performance).\n"
        "Если пользователь спрашивает, как открыть, запустить или найти конкретное приложение на рабочем столе "
        "(в т.ч. «как открыть плеер», «где музыкальный плеер», «как зайти в чат») — в ответе обязательно "
        "вставь хотя бы одну такую ссылку с подходящей подписью (например «Открыть музыкальный плеер») "
        "в первом или втором абзаце; дополнительно можно кратко описать шаги через иконку на столе. "
        "Не отвечай только общими шагами без ссылки, если подходящее ИмяКомпонента есть в списке выше.\n"
        "Подсказки по смыслу (не исчерпывающий список): музыкальный плеер / плеер → MusicPlayer; "
        "студия песен / генератор музыки → MusicForgeApp; "
        "магазин приложений → AppStore; GAF-чат / чат с ассистентом на столе → GAFChatApp; "
        "видеозвонки → VideoCallApp (или GAF Chat → «Начать видеозвонок»); "
        "чат с ИИ (отдельное окно) → DesktopAiChatApp; контент / менеджер контента → ContentManagerPro; "
        "уведомления → NotificationsApp; буфер обмена → ClipboardManager; зал маркетинга → MarketingCabinet; "
        "студия сайтов → UserSiteStudio; презентации → Presentations или PresentationsArchive; "
        "обращения / пожелания / баг-репорт → FeedbackHubApp; UGS Studio → UGS; UGS Хаб → UGSHubApp; "
        "редактор документов v2 → DocEditorV2.\n"
        "Не используй другие имена компонентов. Ссылки на открытие приложения из списка допустимы при вопросах "
        "про запуск приложения, даже если в блоках FAQ/RAG нет готовой строки с такой ссылкой.\n\n"
        "Если вопрос не про EliteEW (погода, рестораны, города, общие факты, политика, "
        "другие программы и сайты, домашние советы и т.п.) — не отвечай по сути: "
        "извинись и прямо скажи, что ты знаешь только о приложении EliteEW и не можешь помочь с этой темой "
        "(2–4 предложения, без общих знаний по запросу).\n"
        "Если вопрос про EliteEW, но ответа нет в FAQ/RAG и ты не уверен — не придумывай: "
        "извинись и предложи пользователю открыть на рабочем столе приложение «Обращения» "
        "и оформить там запрос (пожелание или сообщение об ошибке), чтобы команда смогла ответить.\n"
    )
    if extra:
        system_bits += "\nДополнительные инструкции администратора:\n" + extra + "\n"
    system_bits += ASSISTANT_JSON_SYSTEM_SUFFIX
    user_blocks: list[str] = []
    if history_block:
        user_blocks.append("Предыдущие сообщения в этом чате:\n" + history_block)
    if faq_block:
        user_blocks.append("Частые вопросы (FAQ):\n" + faq_block)
    if rag_block:
        user_blocks.append("Фрагменты из загруженных документов (RAG):\n" + rag_block)
    user_prompt = "\n\n".join(user_blocks) + f"\n\nВопрос пользователя:\n{user_text}"
    meta = {
        "faq_chars": len(faq_block),
        "rag_chars": len(rag_block),
        "history_chars": len(history_block),
    }
    return model, system_bits, user_prompt, rag_source_labels, meta


def _assistant_settings_out(data: dict[str, Any]) -> AssistantSettingsOut:
    return AssistantSettingsOut(
        llama_model=data.get("llama_model"),
        extra_system_prompt=data.get("extra_system_prompt"),
        rag_top_k=int(data.get("rag_top_k") or 8),
        rag_enabled=bool(data.get("rag_enabled", True)),
    )


async def _persist_assistant_settings_patch(
    db: AsyncSession,
    patch_fields: dict[str, Any],
) -> dict[str, Any]:
    if not patch_fields:
        return await _get_assistant_settings(db)
    try:
        existing = await db.execute(text("SELECT id FROM assistant_settings WHERE id = 1"))
        if existing.first():
            sets = ", ".join(f"{k} = :{k}" for k in patch_fields)
            await db.execute(
                text(f"UPDATE assistant_settings SET {sets}, updated_at = NOW() WHERE id = 1"),
                patch_fields,
            )
        else:
            merged = {
                "llama_model": patch_fields.get("llama_model"),
                "extra_system_prompt": patch_fields.get("extra_system_prompt"),
                "rag_top_k": int(patch_fields.get("rag_top_k", 8)),
                "rag_enabled": bool(patch_fields.get("rag_enabled", True)),
            }
            await db.execute(
                text(
                    """
                    INSERT INTO assistant_settings (
                        id, llama_model, extra_system_prompt, rag_top_k, rag_enabled
                    )
                    VALUES (1, :llama_model, :extra_system_prompt, :rag_top_k, :rag_enabled)
                    """
                ),
                merged,
            )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.exception("assistant_settings patch failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Assistant settings storage unavailable",
        ) from exc
    return await _get_assistant_settings(db)


def _finalize_assistant_reply(
    user_message: str,
    assistant_reply: str,
    rag_source_labels: list[str | None],
) -> str:
    """Post-process: sanitize model markup, quality guard, deep link inject, footer источников KB."""
    reply = sanitize_assistant_model_reply(assistant_reply)
    reply = guard_assistant_reply_quality(reply, user_message=user_message)
    reply = _maybe_inject_desktop_app_markdown_link(user_message, reply)
    reply = _maybe_inject_feedback_hub_link(user_message, reply)
    return maybe_append_rag_sources_footer(reply, rag_source_labels)


# (keyword tuples, app component, button label) — более специфичные фразы выше.
_DESKTOP_LINK_INJECT_RULES: tuple[tuple[tuple[str, ...], str, str], ...] = (
    (
        ("меню пуск", "меню «пуск»", "кнопк пуск", "открыть пуск", "где пуск"),
        "EliteEwShellStartMenu",
        "Открыть меню «Пуск»",
    ),
    (
        (
            "настройки рабочего стола",
            "настройки стола",
            "параметры рабочего стола",
            "персонализац",
            "иконки и сетк",
            "окна и панель",
            "как открыть настройки",
            "где настройки",
        ),
        "EliteEwShellSettings",
        "Открыть настройки рабочего стола",
    ),
    (("музыкальн", "music player", "музыкальный плеер"), "MusicPlayer", "Открыть музыкальный плеер"),
    (("магазин приложений", "витрин приложений"), "AppStore", "Открыть магазин приложений"),
    (("магазин", "app store"), "AppStore", "Открыть магазин приложений"),
    (("gaf chat", "гаф-чат", "gaf чат", "гаф чат", "мессенджер"), "GAFChatApp", "Открыть мессенджер"),
    (
        ("позвон", "видеозвон", "созвон", "начать звонок", "как позвонить", "video call"),
        "VideoCallApp",
        "Открыть видеозвонки",
    ),
    (("ugs хаб", "ugs hub", "ugsхаб"), "UGSHubApp", "Открыть UGS Хаб"),
    (("ugs studio", "студия ugs", "унифицирован", "генерац"), "UGS", "Открыть UGS Studio"),
    (
        (
            "content manager",
            "file manager",
            "контент-менеджер",
            "менеджер контента",
            "контент менеджер",
            "файловый менеджер",
        ),
        "ContentManagerPro",
        "Открыть файловый менеджер",
    ),
    (("desktop ai", "чат с ии", "чат ии", "эксперты"), "DesktopAiChatApp", "Открыть «Эксперты»"),
    (("уведомлен", "колокольчик"), "NotificationsApp", "Открыть центр уведомлений"),
    (("буфер обмена", "clipboard"), "ClipboardManager", "Открыть буфер обмена"),
    (("маркетингов", "marketing cabinet", "зал маркетинга"), "MarketingCabinet", "Открыть зал маркетинга"),
    (("студия сайтов", "user site"), "UserSiteStudio", "Открыть студию сайтов"),
    (("архив презентац",), "PresentationsArchive", "Открыть архив презентаций"),
    (("презентац", "ewrp"), "EWRP", "Открыть EWRP"),
    (("ugs", "studio gu", "студио гу"), "StudioGU", "Открыть Studio GU"),
    (("comfy", "комфи"), "ComfyUI", "Открыть ComfyUI"),
    (("image studio",), "ImageStudio", "Открыть Image Studio"),
    (("video studio",), "VideoStudio", "Открыть Video Studio"),
    (("social hub", "socialhub"), "SocialHubApp", "Открыть Social hub"),
    (("doc editor v2", "редактор v2", "новый редактор"), "DocEditorV2", "Открыть редактор документов v2"),
    (("doc editor", "редактор док"), "DocEditor", "Открыть редактор документов"),
    (
        ("обращен", "feedback", "пожелан", "сообщить об ошибк", "баг-репорт"),
        "FeedbackHubApp",
        "Открыть «Обращения»",
    ),
    (
        ("music generator", "генератор музыки", "сделать песню", "сделать песн", "написать песню", "студия песен"),
        "MusicForgeApp",
        "Открыть студию песен",
    ),
    (("presentations",), "Presentations", "Открыть презентации"),
)


def _user_message_suggests_music_player(user_lower: str) -> bool:
    """Music player intent: require music context, not bare «плеер» (e.g. видеоплеер)."""
    u = user_lower.strip()
    if not u:
        return False
    if any(k in u for k in ("музыкальн", "music player", "музыкальный плеер")):
        return True
    return ("музык" in u or "music" in u) and ("плеер" in u or "player" in u)


def _user_message_suggests_unhelpful_followup(user_lower: str) -> bool:
    """User says the prior answer did not help or no answer was found."""
    u = user_lower.strip()
    if not u:
        return False
    phrases = (
        "не помогло",
        "не помог",
        "не нашёл",
        "не нашел",
        "не нашла",
        "не найден",
        "нет ответа",
        "no answer",
        "didn't help",
        "did not help",
        "not helpful",
        "still don't know",
        "всё равно не",
        "все равно не",
    )
    return any(p in u for p in phrases)


def _assistant_reply_suggests_feedback_hub_without_link(reply: str, *, open_path: str) -> bool:
    """Reply steers to «Обращения» but omits FeedbackHubApp deep link."""
    if _assistant_reply_has_component_link(reply, "FeedbackHubApp", open_path=open_path):
        return False
    r = reply.lower()
    hints = (
        "обращен",
        "feedback hub",
        "пожелан",
        "сообщить об ошибк",
        "баг-репорт",
        "оформить запрос",
        "оформите запрос",
    )
    return any(h in r for h in hints)


def _user_message_suggests_open_app_navigation(user_lower: str) -> bool:
    """Грубая эвристика: пользователь спрашивает, как открыть/найти приложение на столе."""
    u = user_lower.strip()
    if not u:
        return False
    phrases = (
        "как открыть",
        "где открыть",
        "как запустить",
        "где найти",
        "как найти",
        "как зайти",
        "как попасть",
        "где плеер",
        "где магазин",
        "где чат",
        "открыть плеер",
        "открыть магазин",
        "открыть чат",
        "как открыть приложение",
        "где приложение",
        "где настройки",
        "открыть пуск",
        "открыть настройки",
        "how to open",
        "where to find",
        "open music",
        "open player",
    )
    if any(p in u for p in phrases):
        return True
    # короткий запрос про плеер — только вместе с намерением «где/как/открыть» или вопросом
    if len(u) <= 72 and ("плеер" in u or "музык" in u):
        return any(
            x in u
            for x in (
                "как",
                "где",
                "открыть",
                "запустить",
                "найти",
                "?",
            )
        )
    return False


def _assistant_reply_has_component_link(reply: str, component: str, *, open_path: str) -> bool:
    """True when reply already contains a deep link for this desktop/shell component."""
    needle = f"{open_path}{component}"
    if needle in reply:
        return True
    return f"eliteew-desktop:{component}".lower() in reply.lower()


def _maybe_inject_desktop_app_markdown_link(user_message: str, assistant_reply: str) -> str:
    """
    Если модель забыла markdown-ссылку на приложение, но вопрос явно про открытие приложения —
    дописываем кнопку в конец (как в рассылке GAF). Пропускаем только если ссылка на тот же
    component уже есть (другие deep link в ответе не блокируют inject).
    """
    _path = "/__eliteew-desktop-open-app__/"
    r = (assistant_reply or "").strip()
    if not r:
        return assistant_reply
    u = (user_message or "").lower()
    if not _user_message_suggests_open_app_navigation(u):
        return assistant_reply
    for keywords, component, label in _DESKTOP_LINK_INJECT_RULES:
        if component not in ALLOWED_DESKTOP_APP_COMPONENTS and component not in ASSISTANT_SHELL_LINK_COMPONENTS:
            continue
        if component == "MusicPlayer":
            if not _user_message_suggests_music_player(u):
                continue
        elif not any(k in u for k in keywords):
            continue
        if _assistant_reply_has_component_link(r, component, open_path=_path):
            continue
        return f"{r}\n\n[{label}]({_path}{component})"
    return assistant_reply


def _maybe_inject_feedback_hub_link(user_message: str, assistant_reply: str) -> str:
    """
    When user says the answer did not help and the model suggests «Обращения» without a link —
    append FeedbackHubApp button (narrow follow-up heuristic).
    """
    _path = "/__eliteew-desktop-open-app__/"
    r = (assistant_reply or "").strip()
    if not r:
        return assistant_reply
    u = (user_message or "").lower()
    if not _user_message_suggests_unhelpful_followup(u):
        return assistant_reply
    if not _assistant_reply_suggests_feedback_hub_without_link(r, open_path=_path):
        return assistant_reply
    label = "Открыть «Обращения»"
    return f"{r}\n\n[{label}]({_path}FeedbackHubApp)"


async def _llama_generate_assistant_reply(
    model: str,
    *,
    system: str,
    prompt: str,
    user_message: str = "",
) -> str:
    """Schema-constrained JSON via llama.cpp (``format`` / ``response_format``)."""
    base = unified_settings.llama_url.rstrip("/")
    try:
        client = get_httpx_client()
        data = await httpx_compat_generate_json(
            client,
            base,
            model=model,
            prompt=prompt,
            system=system,
            options={"temperature": 0.4, "num_predict": ASSISTANT_LLAMA_NUM_PREDICT},
            json_schema=ASSISTANT_REPLY_JSON_SCHEMA,
            keep_alive=llama_keep_alive_from_settings(),
            timeout=httpx.Timeout(120.0, connect=10.0),
        )
        raw = (data.get("response") or "").strip()
        reply, parsed_json = parse_assistant_reply_markdown(raw, user_message=user_message)
        if not parsed_json:
            logger.warning(
                "[STEP] assistant_llm_json_fallback model=%s raw_chars=%s",
                model,
                len(raw),
            )
        return reply or ASSISTANT_DEGENERATE_FALLBACK
    except Exception as e:
        logger.warning("assistant llama generate failed: %s", e)
        return "Сервис генерации временно недоступен. Попробуйте позже или откройте раздел «Частые вопросы»."


# --- Feedback ---


@assistant_router.get("/assistant/faq", response_model=list[AssistantFaqEntryOut])
async def list_assistant_faq_public(
    db: AsyncSession = Depends(get_postgres_session),
    _user: AuthUser = Depends(require_oauth2_user),
) -> list[AssistantFaqEntryOut]:
    result = await db.execute(
        text(
            """
            SELECT id, question, answer, sort_order
            FROM assistant_faq_entries
            ORDER BY sort_order ASC, created_at ASC
            LIMIT 500
            """
        )
    )
    return [AssistantFaqEntryOut.model_validate(dict(r)) for r in result.mappings().all()]


@assistant_router.get("/assistant/messages", response_model=list[AssistantChatMessageOut])
async def list_assistant_messages(
    limit: int = Query(80, ge=1, le=200),
    db: AsyncSession = Depends(get_postgres_session),
    user_id: UUID = Depends(get_desktop_user_id),
) -> list[AssistantChatMessageOut]:
    result = await db.execute(
        text(
            """
            SELECT id, role, content, created_at
            FROM assistant_chat_messages
            WHERE user_id = :uid
            ORDER BY created_at DESC
            LIMIT :lim
            """
        ),
        {"uid": str(user_id), "lim": limit},
    )
    rows = list(result.mappings().all())
    rows.reverse()
    return [AssistantChatMessageOut.model_validate(dict(r)) for r in rows]


@assistant_router.delete("/assistant/messages", status_code=status.HTTP_204_NO_CONTENT)
async def clear_assistant_messages(
    db: AsyncSession = Depends(get_postgres_session),
    user_id: UUID = Depends(get_desktop_user_id),
) -> None:
    await db.execute(
        text(
            """
            DELETE FROM assistant_chat_messages
            WHERE user_id = :uid
            """
        ),
        {"uid": str(user_id)},
    )
    await db.commit()


@assistant_router.post("/assistant/chat", response_model=AssistantChatMessageOut)
async def assistant_chat(
    body: AssistantChatBody,
    db: AsyncSession = Depends(get_postgres_session),
    user_id: UUID = Depends(get_desktop_user_id),
    rate_limiter: RateLimiter = Depends(get_product_assistant_chat_rate_limiter),
) -> AssistantChatMessageOut:
    _enforce_assistant_chat_rate_limit(user_id, rate_limiter)
    model, system, user_prompt, rag_sources, _meta = await _compose_assistant_prompt(db, body.message, user_id=user_id)

    await db.execute(
        text(
            """
            INSERT INTO assistant_chat_messages (user_id, role, content)
            VALUES (:uid, 'user', :content)
            """
        ),
        {"uid": str(user_id), "content": body.message},
    )
    await db.commit()

    reply = await _llama_generate_assistant_reply(
        model,
        system=system,
        prompt=user_prompt,
        user_message=body.message,
    )
    reply = _finalize_assistant_reply(body.message, reply, rag_sources)

    r2 = await db.execute(
        text(
            """
            INSERT INTO assistant_chat_messages (user_id, role, content)
            VALUES (:uid, 'assistant', :content)
            RETURNING id, role, content, created_at
            """
        ),
        {"uid": str(user_id), "content": reply},
    )
    await db.commit()
    row = r2.mappings().one()
    return AssistantChatMessageOut.model_validate(dict(row))


@assistant_router.post("/assistant/chat/stream")
async def assistant_chat_stream(
    body: AssistantChatBody,
    request: Request,
    db: AsyncSession = Depends(get_postgres_session),
    user_id: UUID = Depends(get_desktop_user_id),
    rate_limiter: RateLimiter = Depends(get_product_assistant_chat_rate_limiter),
) -> StreamingResponse:
    """SSE: token chunks + final persisted assistant message. Keep-alive every ~2s (POST-API)."""
    _enforce_assistant_chat_rate_limit(user_id, rate_limiter)
    model, system, user_prompt, rag_sources, _meta = await _compose_assistant_prompt(db, body.message, user_id=user_id)

    await db.execute(
        text(
            """
            INSERT INTO assistant_chat_messages (user_id, role, content)
            VALUES (:uid, 'user', :content)
            """
        ),
        {"uid": str(user_id), "content": body.message},
    )
    await db.commit()

    async def event_gen() -> AsyncIterator[str]:
        queue: asyncio.Queue[tuple[str, Any]] = asyncio.Queue()
        reply_markdown = ""
        stream_failed = False
        rag_labels = collect_rag_source_labels(rag_sources)
        if rag_labels:
            yield f"data: {json.dumps({'type': 'meta', 'rag_source_labels': rag_labels}, ensure_ascii=False)}\n\n"

        async def pump() -> None:
            nonlocal reply_markdown
            try:
                draft = await _llama_generate_assistant_reply(
                    model,
                    system=system,
                    prompt=user_prompt,
                    user_message=body.message,
                )
                reply_markdown = _finalize_assistant_reply(body.message, draft, rag_sources)
                for chunk in iter_assistant_reply_sse_chunks(reply_markdown):
                    await queue.put(("token", chunk))
            except Exception as e:
                logger.warning("assistant stream pump: %s", e)
                await queue.put(("err", str(e)))
            finally:
                await queue.put(("end", None))

        task = asyncio.create_task(pump())
        try:
            while True:
                if await request.is_disconnected():
                    logger.info("assistant stream: client disconnected user_id=%s", user_id)
                    stream_failed = True
                    break
                try:
                    kind, val = await asyncio.wait_for(queue.get(), timeout=2.0)
                except TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                if kind == "token":
                    yield f"data: {json.dumps({'type': 'token', 'text': val}, ensure_ascii=False)}\n\n"
                elif kind == "err":
                    stream_failed = True
                    yield f"data: {json.dumps({'type': 'error', 'message': val}, ensure_ascii=False)}\n\n"
                    break
                elif kind == "end":
                    break
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        if stream_failed:
            return
        if await request.is_disconnected():
            logger.info("assistant stream: skip persist after disconnect user_id=%s", user_id)
            return
        full_text = (reply_markdown or "").strip() or ASSISTANT_DEGENERATE_FALLBACK
        try:
            r2 = await db.execute(
                text(
                    """
                    INSERT INTO assistant_chat_messages (user_id, role, content)
                    VALUES (:uid, 'assistant', :content)
                    RETURNING id, role, content, created_at
                    """
                ),
                {"uid": str(user_id), "content": full_text},
            )
            await db.commit()
            row = r2.mappings().one()
            msg = AssistantChatMessageOut.model_validate(dict(row))
            done_payload = {"type": "done", "message": msg.model_dump(mode="json")}
            yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.exception("assistant stream persist failed: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'message': 'persist_failed'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@assistant_router.get("/admin/assistant/settings", response_model=AssistantSettingsOut)
async def admin_get_assistant_settings(
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantSettingsOut:
    data = await _get_assistant_settings(db)
    return _assistant_settings_out(data)


@assistant_router.patch("/admin/assistant/settings", response_model=AssistantSettingsOut)
async def admin_patch_assistant_settings(
    body: AssistantSettingsPatchBody,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantSettingsOut:
    patch_fields = body.model_dump(exclude_unset=True)
    data = await _persist_assistant_settings_patch(db, patch_fields)
    return _assistant_settings_out(data)


@assistant_router.post("/admin/assistant/preview", response_model=AssistantPreviewOut)
async def admin_preview_assistant_prompt(
    body: AssistantPreviewBody,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> AssistantPreviewOut:
    """Собрать промпт справочника без вызова LLM (FAQ/RAG/бюджеты для оператора)."""
    user_id: UUID | None = None
    if body.include_my_history:
        user_id = await get_desktop_user_id(admin, db)
    model, system_bits, user_prompt, rag_source_labels, meta = await _compose_assistant_prompt(
        db,
        body.message.strip(),
        user_id=user_id,
    )
    prompt_full = f"{system_bits}\n\n{user_prompt}"
    prompt_chars = len(prompt_full)
    preview_len = min(prompt_chars, _ASSISTANT_PREVIEW_PROMPT_MAX_CHARS)
    settings = await _get_assistant_settings(db)
    clean_labels = [label for label in rag_source_labels if label]
    return AssistantPreviewOut(
        model=model,
        rag_enabled=bool(settings.get("rag_enabled")),
        rag_source_labels=clean_labels,
        faq_chars=int(meta.get("faq_chars") or 0),
        rag_chars=int(meta.get("rag_chars") or 0),
        history_chars=int(meta.get("history_chars") or 0),
        prompt_chars=prompt_chars,
        prompt_preview=prompt_full[:preview_len],
        prompt_full=prompt_full,
    )


@assistant_router.get("/admin/assistant/faq", response_model=list[AssistantFaqEntryOut])
async def admin_list_faq(
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> list[AssistantFaqEntryOut]:
    result = await db.execute(
        text(
            """
            SELECT id, question, answer, sort_order
            FROM assistant_faq_entries
            ORDER BY sort_order ASC, created_at ASC
            """
        )
    )
    return [AssistantFaqEntryOut.model_validate(dict(r)) for r in result.mappings().all()]


@assistant_router.post("/admin/assistant/faq", response_model=AssistantFaqEntryOut)
async def admin_create_faq(
    body: AssistantFaqCreateBody,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantFaqEntryOut:
    result = await db.execute(
        text(
            """
            INSERT INTO assistant_faq_entries (question, answer, sort_order)
            VALUES (:q, :a, :so)
            RETURNING id, question, answer, sort_order
            """
        ),
        {"q": body.question, "a": body.answer, "so": body.sort_order},
    )
    await db.commit()
    row = result.mappings().one()
    return AssistantFaqEntryOut.model_validate(dict(row))


@assistant_router.patch("/admin/assistant/faq/{faq_id}", response_model=AssistantFaqEntryOut)
async def admin_update_faq(
    faq_id: UUID,
    body: AssistantFaqUpdateBody,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantFaqEntryOut:
    fields: dict[str, Any] = {}
    if body.question is not None:
        fields["question"] = body.question
    if body.answer is not None:
        fields["answer"] = body.answer
    if body.sort_order is not None:
        fields["sort_order"] = body.sort_order
    if not fields:
        r0 = await db.execute(
            text("SELECT id, question, answer, sort_order FROM assistant_faq_entries WHERE id = :id"),
            {"id": str(faq_id)},
        )
        row0 = r0.mappings().first()
        if not row0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="FAQ not found")
        return AssistantFaqEntryOut.model_validate(dict(row0))

    sets = ", ".join(f"{k} = :{k}" for k in fields)
    params = {**fields, "id": str(faq_id), "updated_at": datetime.now(UTC)}
    await db.execute(
        text(f"UPDATE assistant_faq_entries SET {sets}, updated_at = :updated_at WHERE id = :id"),
        params,
    )
    await db.commit()
    r = await db.execute(
        text("SELECT id, question, answer, sort_order FROM assistant_faq_entries WHERE id = :id"),
        {"id": str(faq_id)},
    )
    row = r.mappings().first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="FAQ not found")
    return AssistantFaqEntryOut.model_validate(dict(row))


@assistant_router.delete("/admin/assistant/faq/{faq_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_faq(
    faq_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> None:
    await db.execute(text("DELETE FROM assistant_faq_entries WHERE id = :id"), {"id": str(faq_id)})
    await db.commit()
