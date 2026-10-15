# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# EWA companion **XL Base (v2_base) autonomous** music generation — user asks companion to write lyrics/tags
# from dialog mood, persona, and memory; full wizard pipeline via Music Generator HTTP + separate UGS type_key.
# Invariants:
# - Triggers are disjoint from XL Turbo ``music_generation`` (regex pre-gate before turbo handler).
# - Final audio uses ``ugs_workflow=v2_base``, ``billing_mode=companion_xl_base``, ``ksampler_use_comfy_template``.
# - Declarative workflow child runs inherit ``workflow_parent_*`` via ``merge_workflow_parent_plan``.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - documentation/product/MUSIC-GENERATOR-XL-BASE-24H-PIPELINE-PLAN.md
# ---
"""Companion XL Base autonomous music generation tool."""

from __future__ import annotations

import asyncio
import logging
import re
from collections.abc import Mapping
from typing import Any, Final

from api.ewa_platform.companion.memory.chat_condense import companion_condensed_block_from_profile
from api.ewa_platform.companion.orchestration.tools.handlers_common import (
    _looks_like_non_executing_question,
)
from api.ewa_platform.companion.orchestration.tools.handlers_media import (
    _companion_backend_music_generation_enabled,
    _companion_parse_bpm_duration,
    _companion_resolve_music_generation_inputs,
    _companion_voice_diversity,
    _music_generation_api_base_url,
    _music_generation_autoplay_requested,
    _normalize_main_vocal,
    _run_background_music_generation_job,
    _user_line_is_music_feedback_or_praise,
)
from api.ewa_platform.companion.orchestration.tools.registry_helpers import (
    _tool_router_bypass_line_match,
)
from api.ewa_platform.companion.orchestration.tools.registry_types import (
    ToolContext,
    ToolResult,
    ToolStatus,
)
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.routers.music_generator_constants import MAX_EWA_COMPANION_CONTEXT_CHARS, MAX_WIZARD_THEME_CHARS

logger = logging.getLogger(__name__)

MUSIC_XL_BASE_INTENT_KIND: Final[str] = "music_generation_xl_base_background"
MUSIC_XL_BASE_STEP_KIND: Final[str] = "music_generation_pipeline_xl_base"
INTERACTIVE_XL_BASE_START_MARKER: Final[str] = "#ewa_xl_base_interactive_start"

_INTERACTIVE_XL_BASE_LABELS: Final[dict[str, str]] = {
    "тема": "theme",
    "theme": "theme",
    "стиль": "style",
    "style": "style",
    "genre": "style",
    "вокал": "vocal",
    "vocal": "vocal",
    "voice": "vocal",
    "язык": "language",
    "language": "language",
}

_MUSIC_XL_BASE_AUTONOMOUS_USER_LINE_RE: Final[re.Pattern[str]] = re.compile(
    r"(?ix)(?:"
    r"напиш(?:и|ь)\s+сам[аоы]?\s+(?:текст|слова|песн\w*|тр[еэ]к\w*)"
    r"|напиш(?:и|ь)\s+(?:текст|слова)\s+(?:песн\w*|тр[еэ]к\w*)\s+сам[аоы]?"
    r"|сочин(?:и|ь)\s+сам[аоы]?\s+(?:текст|песн\w*|тр[еэ]к\w*)"
    r"|(?:сдела(?:й|ть)|созда(?:й|ть)|сгенерир\w+|запиш(?:и|ь))\s+(?:мне\s+)?(?:песн\w*|тр[еэ]к\w*)\s+"
    r"(?:сам[аоы]?|сама|сам|по\s+(?:сво(?:ем|ё)му\s+)?(?:настроен\w+|ощущен\w+|вкусу))"
    r"|по\s+(?:сво(?:ем|ё)му\s+)?(?:настроен\w+|ощущен\w+|настрою)\s+(?:песн\w*|тр[еэ]к\w*|музык\w*)"
    r"|(?:как\s+)?(?:ты|вы)\s+(?:чувствуешь|ощущаешь)\s*"
    r"(?:\s*(?:\—|-|:))?\s*(?:песн\w*|тр[еэ]к\w*|музык\w*)?"
    r"|(?:как\s+)?(?:ты|вы)\s+думаешь\s+(?:о|об|про)\s+(?:песн\w*|тр[еэ]к\w*|музык\w*|song|track|music)\b"
    r"|от\s+себя\s+(?:песн\w*|тр[еэ]к\w*|музык\w*)"
    r"|сам[аоы]?\s+придумай\s+(?:текст|песн\w*|тр[еэ]к\w*)"
    r"|(?:на\s+)?(?:сво(?:ё|е)м\s+)?(?:настроен\w+|ощущен\w+)\s+(?:песн\w*|тр[еэ]к\w*)"
    r"|write\s+(?:the\s+)?lyrics\s+(?:yourself|on\s+your\s+own)"
    r"|compose\s+(?:a\s+)?(?:song|track)\s+(?:yourself|from\s+your\s+mood|in\s+your\s+mood|how\s+you\s+feel)"
    r"|make\s+(?:a\s+)?(?:song|track)\s+(?:yourself|from\s+your\s+mood|how\s+you\s+feel)"
    r"|(?:a\s+)?(?:song|track)\s+by\s+your\s+(?:mood|feeling)"
    r")",
)

_MUSIC_XL_BASE_INTERACTIVE_LAUNCH_RE: Final[re.Pattern[str]] = re.compile(
    r"(?ix)(?:"
    r"интерактивн\w*.{0,60}(?:песн\w*|тр[еэ]к\w*|xl\s*base|икс\s*эль\s*бейс)"
    r"|(?:мастер|визард|wizard).{0,60}(?:песн\w*|тр[еэ]к\w*|xl\s*base)"
    r"|(?:запусти|запуск|начни|открой|собер[ие]м).{0,60}(?:xl\s*base|икс\s*эль\s*бейс).{0,40}(?:интерактив|мастер|wizard|пошаг)"
    r"|interactive.{0,40}(?:xl\s*base|song|music)"
    r"|(?:open|start).{0,40}(?:xl\s*base).{0,40}(?:wizard|interactive)"
    r")"
)

_MUSIC_XL_BASE_TRIGGER_STRIP_RE: Final[re.Pattern[str]] = re.compile(
    r"(?ix)(?:"
    r"напиш(?:и|ь)\s+сам[аоы]?\s+(?:текст|слова|песн\w*|тр[еэ]к\w*)"
    r"|напиш(?:и|ь)\s+(?:текст|слова)\s+(?:песн\w*|тр[еэ]к\w*)\s+сам[аоы]?"
    r"|по\s+(?:сво(?:ем|ё)му\s+)?(?:настроен\w+|ощущен\w+|настрою)\s*"
    r"|от\s+себя\s*"
    r"|сам[аоы]?\s+придумай\s*"
    r"|write\s+(?:the\s+)?lyrics\s+(?:yourself|on\s+your\s+own)\s*"
    r")",
)

_XL_BASE_THEME_FROM_LINE_RE: Final[re.Pattern[str]] = re.compile(r"(?is)\bна\s+тему\s*:?\s*(?P<theme>.+)$")
_XL_BASE_STYLE_FROM_LINE_RE: Final[re.Pattern[str]] = re.compile(
    r"(?is)\b(?:в\s+стиле|стиль)\s*:?\s*(?P<style>[^,.;\n]+)"
)
_XL_BASE_VOCAL_FROM_LINE_RE: Final[re.Pattern[str]] = re.compile(
    r"(?is)(?:(?P<before>мужск\w+|женск\w+|дуэт|male|female|duet)\s+вокал|вокал\s*:?\s*(?P<after>мужск\w+|женск\w+|дуэт|male|female|duet))"
)
_XL_BASE_FAST_TEMPO_RE: Final[re.Pattern[str]] = re.compile(
    r"(?is)\b(?:сам(?:ый|ая|ое)\s+быстр\w+|очень\s+быстр\w+|fastest|very\s+fast)\b"
)


def user_line_requests_music_xl_base_autonomous(
    user_line: str,
    profile: Mapping[str, Any] | None = None,
) -> bool:
    """True when user wants companion-driven XL Base song (lyrics/tags from mood/dialog)."""

    from api.ewa_platform.companion.orchestration.file_study_compose import (
        user_line_is_file_study_compose_turn,
    )
    from api.ewa_platform.companion.orchestration.turn_context_guards import user_line_is_file_focus_chat

    s = str(user_line or "").strip()
    if not s:
        return False
    if user_line_is_file_focus_chat(s, profile):
        return False
    if user_line_is_file_study_compose_turn(s, profile):
        return False
    if _user_line_is_music_feedback_or_praise(s):
        return False
    return bool(
        _MUSIC_XL_BASE_AUTONOMOUS_USER_LINE_RE.search(s)
        or user_line_is_interactive_xl_base_launch(s)
        or INTERACTIVE_XL_BASE_START_MARKER in s
    )


def user_line_requests_music_xl_base_interactive(user_line: str) -> bool:
    """True when user wants the companion XL Base step-by-step launch surface."""

    s = str(user_line or "").strip()
    if not s or INTERACTIVE_XL_BASE_START_MARKER in s:
        return False
    return bool(_MUSIC_XL_BASE_INTERACTIVE_LAUNCH_RE.search(s))


def user_line_is_interactive_xl_base_launch(user_line: str) -> bool:
    """True for the final structured command emitted by the frontend wizard."""

    s = str(user_line or "")
    return INTERACTIVE_XL_BASE_START_MARKER in s


def _normalize_xl_base_language(raw: str) -> str:
    value = (raw or "").strip().lower()
    if value in {"ru", "russian", "русский", "рус"}:
        return "ru"
    if value in {"en", "english", "английский", "англ"}:
        return "en"
    if value in {"es", "spanish", "испанский"}:
        return "es"
    if value in {"de", "german", "немецкий"}:
        return "de"
    if value in {"fr", "french", "французский"}:
        return "fr"
    return value[:16] if value else ""


def _normalize_xl_base_style(raw: str) -> str:
    value = (raw or "").strip().lower()
    aliases = {
        "поп": "pop",
        "попса": "pop",
        "рок": "rock",
        "рэп": "rap",
        "хип-хоп": "hip-hop",
        "хип хоп": "hip-hop",
        "электро": "electronic",
        "электроника": "electronic",
        "танцевальная": "dance",
        "денс": "dance",
        "лирическая": "ballad",
        "баллада": "ballad",
    }
    return aliases.get(value, value[:48] if value else "")


def _infer_xl_base_slots_from_user_line(user_line: str) -> dict[str, Any]:
    """Extract safe deterministic slots when Tool Router is unavailable."""

    text = str(user_line or "").strip()
    out: dict[str, Any] = {}

    theme_match = _XL_BASE_THEME_FROM_LINE_RE.search(text)
    if theme_match:
        theme = re.sub(r"\s+", " ", str(theme_match.group("theme") or "")).strip(" .")
        if theme:
            out["theme"] = theme[:MAX_WIZARD_THEME_CHARS]

    style_match = _XL_BASE_STYLE_FROM_LINE_RE.search(text)
    if style_match:
        style_raw = re.split(
            r"(?is)\b(?:мужск\w+|женск\w+|дуэт|male|female|duet)\s+вокал\b",
            str(style_match.group("style") or ""),
            maxsplit=1,
        )[0]
        style = _normalize_xl_base_style(style_raw)
        if style:
            out["style"] = style

    vocal_match = _XL_BASE_VOCAL_FROM_LINE_RE.search(text)
    if vocal_match:
        vocal_raw = str(vocal_match.group("before") or vocal_match.group("after") or "")
        vocal_raw_lower = vocal_raw.lower()
        if vocal_raw_lower.startswith("муж"):
            vocal_raw = "male"
        elif vocal_raw_lower.startswith("жен"):
            vocal_raw = "female"
        elif vocal_raw_lower.startswith("дуэт"):
            vocal_raw = "duet"
        vocal = _normalize_main_vocal(vocal_raw)
        if vocal:
            out["vocal"] = vocal

    if _XL_BASE_FAST_TEMPO_RE.search(text):
        out["bpm"] = 220

    return out


def parse_interactive_xl_base_slots(user_line: str) -> dict[str, str]:
    """Extract final wizard slots from a structured companion-generated launch prompt."""

    text = str(user_line or "")
    if INTERACTIVE_XL_BASE_START_MARKER not in text:
        return {}
    out: dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip().strip("-•")
        if ":" not in line:
            continue
        key_raw, value_raw = line.split(":", 1)
        key = _INTERACTIVE_XL_BASE_LABELS.get(key_raw.strip().lower())
        value = value_raw.strip()
        if not key or not value:
            continue
        if key == "style":
            value = _normalize_xl_base_style(value)
        elif key == "vocal":
            value = _normalize_main_vocal(value)
        elif key == "language":
            value = _normalize_xl_base_language(value)
        out[key] = value
    return {k: v for k, v in out.items() if v}


def build_xl_base_companion_creative_context(
    user_line: str,
    args: Mapping[str, Any],
    ctx: ToolContext,
    *,
    ru: bool,
) -> tuple[str, str]:
    """Build (short theme, extended ewa_companion_context) for Music Generator wizard HTTP."""

    parts: list[str] = []
    for key in (
        "creative_brief",
        "understood_summary_ru",
        "understood_summary_en",
        "mood",
        "dialog_context",
        "conversation_context",
    ):
        raw = str(args.get(key) or "").strip()
        if raw:
            parts.append(raw)

    profile = ctx.profile if isinstance(getattr(ctx, "profile", None), Mapping) else None
    if profile:
        persona_id = str(profile.get("seed_persona_id") or "parent").strip()
        if persona_id:
            parts.append(f"Persona Ассистента: {persona_id}." if ru else f"Assistant persona: {persona_id}.")
        condensed = companion_condensed_block_from_profile(profile).strip()
        if condensed:
            parts.append(condensed[:800])

    topic = _MUSIC_XL_BASE_TRIGGER_STRIP_RE.sub("", str(user_line or "")).strip()
    topic = re.sub(r"\s+", " ", topic)
    if topic:
        parts.append(topic)

    directive = (
        "EWA Assistant XL Base: сама собери тему, образ и настроение песни из нашего диалога, "
        "характера Ассистента и запроса пользователя; затем полный текст и tags для ACE Step XL Base."
        if ru
        else "EWA Assistant XL Base: derive the song theme, imagery, and mood from our chat, "
        "Assistant persona, and the user request; then full lyrics and tags for ACE Step XL Base."
    )
    extended = f"{directive}\n\n" + "\n\n".join(p for p in parts if p)
    extended = extended.strip()[:MAX_EWA_COMPANION_CONTEXT_CHARS]

    theme_explicit = str(args.get("theme") or "").strip()
    short_theme = (theme_explicit or topic or ("настроение диалога" if ru else "dialog mood"))[:MAX_WIZARD_THEME_CHARS]
    return short_theme, extended


def _resolve_xl_base_style_vocal(
    args: Mapping[str, Any],
    *,
    style_key: str,
    vocal_eff: str,
) -> tuple[str, str]:
    style = str(args.get("style") or args.get("genre") or style_key or "pop").strip().lower() or "pop"
    vocal = _normalize_main_vocal(str(args.get("vocal") or vocal_eff or "female"))
    return style, vocal


async def handle_music_generation_xl_base(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Queue XL Base autonomous music pipeline (companion-authored lyrics/tags path)."""

    if not _companion_backend_music_generation_enabled():
        return None

    user_line = str(args.get("user_line") or ctx.user_line or "")
    parsed_interactive_slots = parse_interactive_xl_base_slots(user_line)
    inferred_line_slots = _infer_xl_base_slots_from_user_line(user_line)
    args_eff: Mapping[str, Any] = {**inferred_line_slots, **parsed_interactive_slots, **dict(args)}
    if not user_line.strip():
        return None
    if _user_line_is_music_feedback_or_praise(user_line):
        logger.info(
            "[STEP] companion_music_xl_base_skip reason=music_feedback_or_praise line_chars=%d",
            len(user_line),
        )
        return None
    if _looks_like_non_executing_question(user_line) and not _tool_router_bypass_line_match(args):
        return None
    if not user_line_requests_music_xl_base_autonomous(user_line, ctx.profile) and not _tool_router_bypass_line_match(
        args
    ):
        logger.info(
            "[STEP] companion_music_xl_base_skip reason=line_no_match line_chars=%d",
            len(user_line),
        )
        return None

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    language_e = str(args_eff.get("language") or ("ru" if ru else "en")).strip() or ("ru" if ru else "en")
    token = (ctx.bearer_token or "").strip()
    if not token or ctx.auth_user is None:
        logger.info("[STEP] companion_tool_music_xl_base_unavailable reason=missing_auth_context")
        return ToolResult(
            tool="music_generation_xl_base",
            status="unavailable",
            reply=(
                "Запущу XL Base, как только подгрузится сессия — попроси ещё раз через пару секунд."
                if ru
                else "I'll start XL Base generation once the session is loaded — please ask again in a moment."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    pool = ctx.companion_pool
    theme_short, ewa_context_xl = build_xl_base_companion_creative_context(user_line, args_eff, ctx, ru=ru)
    (
        _resolved_theme,
        style_key,
        vocal_eff,
        luna_mode,
        voice_diversity,
        deictic_music_context,
    ) = await _companion_resolve_music_generation_inputs(
        pool=pool,
        principal_id=ctx.principal_id,
        user_line=user_line,
        args=args_eff,
        intent_kind=MUSIC_XL_BASE_INTENT_KIND,
        profile=ctx.profile if isinstance(ctx.profile, Mapping) else None,
    )
    style_key, vocal_eff = _resolve_xl_base_style_vocal(
        args_eff,
        style_key=style_key,
        vocal_eff=vocal_eff,
    )
    theme = str(args_eff.get("theme") or _resolved_theme or theme_short).strip() or theme_short
    theme = theme[:MAX_WIZARD_THEME_CHARS]
    if deictic_music_context.strip():
        merged = deictic_music_context.strip()
        if "xl base" not in merged.lower():
            merged = f"{ewa_context_xl}\n\n{merged}".strip()
        ewa_context = merged[:MAX_EWA_COMPANION_CONTEXT_CHARS]
    else:
        ewa_context = ewa_context_xl

    bpm_override, duration_override = _companion_parse_bpm_duration(args_eff)
    lyrics_arg = str(args_eff.get("lyrics") or "").strip()
    voice_diversity = voice_diversity or _companion_voice_diversity(args_eff)
    name_arg = str(args_eff.get("name") or "").strip()
    explicit_tags = str(args_eff.get("tags") or "").strip()
    skip_lyrics_validation = bool(args_eff.get("skip_lyrics_validation"))

    from api.ewa_platform.companion.jobs.config import companion_async_music_enabled

    use_celery_music = companion_async_music_enabled()
    base = _music_generation_api_base_url(for_remote_worker=use_celery_music).rstrip("/")
    http_headers = {"Authorization": f"Bearer {token}"}
    autoplay = _music_generation_autoplay_requested(user_line, args_eff)

    if pool is None:
        logger.warning("[STEP] companion_music_xl_base_skip reason=no_companion_pool")
        return ToolResult(
            tool="music_generation_xl_base",
            status="error",
            reply=(
                "Не смогла сохранить фоновую XL Base операцию — попробуй ещё раз."
                if ru
                else "I could not save the XL Base background operation — please try again."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    if use_celery_music:
        from api.ewa_platform.companion.jobs.run_capacity import (
            companion_music_capacity_exceeded,
            music_busy_reply,
        )

        if await companion_music_capacity_exceeded(pool, principal_id=ctx.principal_id):
            return ToolResult(
                tool="music_generation_xl_base",
                status="unavailable",
                reply=music_busy_reply(ru=ru),
                actions=[],
                data={},
                task_run=None,
            )

    plan: dict[str, Any] = {
        "kind": MUSIC_XL_BASE_INTENT_KIND,
        "style": style_key,
        "vocal": vocal_eff,
        "language": language_e,
        "theme_preview": theme[:MAX_WIZARD_THEME_CHARS],
        "lyrics_preview": lyrics_arg[:500],
        "voice_diversity": voice_diversity,
        "luna_mode": luna_mode or "",
        "autoplay_requested": bool(autoplay),
        "ugs_workflow": "v2_base",
        "pipeline": "xl_base_companion_autonomous",
        "interactive_wizard": bool(parsed_interactive_slots),
    }
    from api.ewa_platform.companion.workflows.user.workflow_parent_link import merge_workflow_parent_plan

    merge_workflow_parent_plan(plan, args)
    from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run

    run_row = await companion_pg.companion_task_run_create(
        pool,
        principal_id=ctx.principal_id,
        intent_kind=MUSIC_XL_BASE_INTENT_KIND,
        user_message=user_line,
        plan_payload=plan,
        confirmation_state={},
        status="running",
        execution_mode="async" if use_celery_music else "sync",
    )
    step_row = await companion_pg.companion_task_step_create(
        pool,
        run_id=str(run_row["id"]),
        step_index=1,
        step_kind=MUSIC_XL_BASE_STEP_KIND,
        title="Run XL Base companion music pipeline in background",
        input_payload={
            "style": style_key,
            "style_key": style_key,
            "theme": theme,
            "theme_preview": theme[:MAX_WIZARD_THEME_CHARS],
            "vocal": vocal_eff,
            "vocal_eff": vocal_eff,
            "language": language_e,
            "language_e": language_e,
            "lyrics_supplied": bool(lyrics_arg),
            "lyrics_arg": lyrics_arg,
            "voice_diversity": voice_diversity,
            "luna_mode": luna_mode,
            "bpm_override": bpm_override,
            "duration_seconds_override": duration_override,
            "duration_override": duration_override,
            "name_arg": name_arg,
            "explicit_tags": explicit_tags,
            "skip_lyrics_validation": skip_lyrics_validation,
            "autoplay_requested": bool(autoplay),
            "ugs_workflow": "v2_base",
            "ugs_wf": "v2_base",
            "billing_mode": "companion_xl_base",
            "ksampler_use_comfy_template": True,
            "ewa_companion_context": ewa_context,
            "base_url": base,
        },
        status="running",
    )

    job_payload: dict[str, Any] = {
        "step_id": str(step_row["id"]),
        "principal_id": ctx.principal_id,
        "catalog_user_id": (ctx.content_catalog_user_id or ctx.principal_id or "").strip(),
        "base_url": base,
        "headers": dict(http_headers),
        "style_key": style_key,
        "vocal_eff": vocal_eff,
        "language_e": language_e,
        "ugs_wf": "v2_base",
        "theme": theme,
        "lyrics_arg": lyrics_arg,
        "voice_diversity": voice_diversity,
        "luna_mode": luna_mode,
        "bpm_override": bpm_override,
        "duration_override": duration_override,
        "name_arg": name_arg,
        "explicit_tags": explicit_tags,
        "skip_lyrics_validation": skip_lyrics_validation,
        "autoplay_requested": autoplay,
        "billing_mode": "companion_xl_base",
        "ksampler_use_comfy_template": True,
        "ewa_companion_context": ewa_context,
    }

    terminal_status: ToolStatus = "ok"
    if use_celery_music:
        celery_id = enqueue_companion_run(
            run_id=str(run_row["id"]),
            step_index=1,
            job_payload=job_payload,
        )
        if celery_id is None:
            logger.warning("[STEP] companion_music_xl_base_celery_enqueue_failed run_id=%s", run_row.get("id"))
            await companion_pg.companion_task_step_update(
                pool,
                step_id=str(step_row["id"]),
                status="failed",
                error_payload={"message": "music_generation_enqueue_failed", "stage": "enqueue"},
            )
            await companion_pg.companion_task_run_update(
                pool,
                run_id=str(run_row["id"]),
                principal_id=ctx.principal_id,
                status="failed",
                error_payload={"message": "music_generation_enqueue_failed", "stage": "enqueue"},
            )
            return ToolResult(
                tool="music_generation_xl_base",
                status="error",
                reply=(
                    "Не смогла поставить XL Base в очередь — попробуй ещё раз."
                    if ru
                    else "I could not queue XL Base generation — please try again."
                ),
                actions=[],
                data={},
                task_run=run_row,
            )
        terminal_status = "accepted"
        logger.info(
            "[STEP] companion_tool_music_xl_base_enqueued_celery run_id=%s celery_task_id=%s",
            str(run_row.get("id") or ""),
            celery_id,
        )
    else:
        bg_task = asyncio.create_task(
            _run_background_music_generation_job(
                companion_pool=pool,
                principal_id=ctx.principal_id,
                run_id=str(run_row["id"]),
                step_id=str(step_row["id"]),
                base_url=base,
                headers=dict(http_headers),
                style_key=style_key,
                vocal_eff=vocal_eff,
                language_e=language_e,
                ugs_wf="v2_base",
                theme=theme,
                lyrics_arg=lyrics_arg,
                voice_diversity=voice_diversity,
                luna_mode=luna_mode,
                bpm_override=bpm_override,
                duration_override=duration_override,
                name_arg=name_arg,
                explicit_tags=explicit_tags,
                skip_lyrics_validation=skip_lyrics_validation,
                autoplay_requested=autoplay,
                billing_mode="companion_xl_base",
                ksampler_use_comfy_template=True,
                ewa_companion_context=ewa_context,
            )
        )
        from api.ewa_platform.companion.orchestration.tools.handlers_media import _remember_background_music_task

        _remember_background_music_task(bg_task)
        logger.info(
            "[STEP] companion_tool_music_xl_base_started_background run_id=%s",
            str(run_row.get("id") or ""),
        )

    reply = (
        "Запускаю XL Base: сама напишу текст и tags по нашему разговору и настроению — это займёт несколько минут."
        if ru
        else "Starting XL Base: I'll write lyrics and tags from our chat and mood — this takes a few minutes."
    )
    if autoplay:
        reply += (
            " Когда трек будет готов — включу без лишних вопросов."
            if ru
            else " I'll start playback when the track is ready."
        )

    return ToolResult(
        tool="music_generation_xl_base",
        status=terminal_status,
        reply=reply,
        actions=[],
        data={
            "run_id": str(run_row.get("id") or ""),
            "ugs_workflow": "v2_base",
            "execution_mode": "async" if use_celery_music else "sync",
        },
        task_run=run_row,
    )


__all__ = (
    "INTERACTIVE_XL_BASE_START_MARKER",
    "MUSIC_XL_BASE_INTENT_KIND",
    "MUSIC_XL_BASE_STEP_KIND",
    "build_xl_base_companion_creative_context",
    "handle_music_generation_xl_base",
    "parse_interactive_xl_base_slots",
    "user_line_requests_music_xl_base_autonomous",
    "user_line_requests_music_xl_base_interactive",
)
