# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **File study → compose** turns: user asks to find/read/analyze a document and get **song lyrics in chat**
# (not an immediate ``music_generation_xl_base`` / Turbo job). Loads catalogue body into memory and defers to main LLM.
# Invariants:
# - Suppresses audio music side effects for the same turn; lyrics belong in the visible reply.
# - EwaFile scope only (existing catalog_discuss / file-focus read paths).
# Related:
# - api/ewa_platform/companion/orchestration/turn_context_guards.py
# - documentation/product/ewa/EWA-COMPANION-MULTI-TASK-ORCHESTRATION.md
# ---

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from typing import Any, Final

from api.ewa_platform.companion.orchestration.execution_ledger import (
    attach_reports_to_response,
    record_branch_probe,
)

logger = logging.getLogger(__name__)

_FILE_STUDY_RE: Final = re.compile(
    r"(?ix)(?:"
    r"найди|найти|прочитай|перескаж|изучи|обсуди|проанализир|анализир|\bанализ\b|"
    r"сделай\s+вывод|разбер|ознакомь|discuss|read\s+(?:the\s+)?(?:file|document)|"
    r"analyze|analyse|summar|find\s+(?:the\s+)?(?:file|document)|locate"
    r")",
)

_NAMED_FILE_EXT_RE: Final = re.compile(r"(?ix)\.(?:md|txt|html|pdf|docx?)\b")

_LYRICS_COMPOSE_IN_CHAT_RE: Final = re.compile(
    r"(?ix)(?:"
    r"(?:напиш\w*|написать)\s+(?:сам\w*\s+)?(?:текст|слова)\s*(?:песн\w*)?"
    r"|(?:текст|слова)\s+песн\w*"
    r"|сочини\s+(?:текст|слова|песн\w*)"
    r"|write\s+(?:the\s+)?(?:lyrics|song\s+text)"
    r")",
)

_EXPLICIT_AUDIO_GENERATION_RE: Final = re.compile(
    r"(?ix)(?:"
    r"сгенерир\w+|запиш(?:и|ь)\s+(?:мне\s+)?(?:песн|трек|музык)|"
    r"сделай\s+(?:мне\s+)?(?:песн|трек|музык)(?!\s+текст)|"
    r"generate\s+(?:the\s+)?(?:song|track|music|audio)|"
    r"запусти\s+генерац"
    r")",
)

_FOLLOWUP_MUSIC_TAIL_RE: Final = re.compile(
    r"(?is)^(.+?)\s*(?:,\s*)?"
    r"(?:и\s+потом|а\s+потом|потом|затем|дальше|after\s+that|and\s+then|then|и)\s+"
    r"("
    r"(?:сгенерир\w+|запиш(?:и|ь|ать)\s+(?:мне\s+)?(?:песн\w*|тр[еэ]к\w*|музык\w*)|"
    r"запусти\s+генерац\w+|generate|compose|make|create|write).+"
    r")$",
)

_FOLLOWUP_XL_BASE_CUE_RE: Final = re.compile(
    r"(?ix)(?:"
    r"\bсам[аоы]?\w*\b"
    r"|по\s+(?:сво(?:ем|ё)му\s+)?(?:настроен\w+|ощущен\w+|вкусу)"
    r"|lyrics\s+(?:yourself|on\s+your\s+own)"
    r"|from\s+your\s+mood"
    r")",
)

_FILE_REF_RE: Final = re.compile(
    r"(?ix)\b(?:документ\w*|файл\w*|document|file)\b",
)


def _split_followup_music_clause(user_line: str) -> tuple[str, str] | None:
    """Split ``study_clause`` and deferred ``music_clause`` for mixed turns."""

    s = str(user_line or "").strip()
    if not s or not _EXPLICIT_AUDIO_GENERATION_RE.search(s):
        return None
    m = _FOLLOWUP_MUSIC_TAIL_RE.match(s)
    if m is None:
        return None
    study, music = (m.group(1) or "").strip(), (m.group(2) or "").strip()
    if len(study) < 4 or len(music) < 4:
        return None
    return study, music


def _music_tool_for_clause(music_clause: str) -> str:
    """Pick music tool for deferred TurnPlan step."""

    if _FOLLOWUP_XL_BASE_CUE_RE.search(music_clause):
        return "music_generation_xl_base"
    return "music_generation"


def user_line_is_file_study_compose_turn(
    user_line: str,
    profile: Mapping[str, Any] | None,
) -> bool:
    """True when user wants document analysis and **lyrics text in chat**, not an immediate audio pipeline."""

    from api.ewa_platform.companion.sidecar.file_focus import file_focus_stack_from_profile

    s = str(user_line or "").strip()
    if len(s) < 8:
        return False
    followup = _split_followup_music_clause(s)
    study_line = followup[0] if followup is not None else s
    if _EXPLICIT_AUDIO_GENERATION_RE.search(s) and followup is None:
        return False
    if not _LYRICS_COMPOSE_IN_CHAT_RE.search(study_line):
        return False

    has_study = bool(_FILE_STUDY_RE.search(study_line))
    has_focus = bool(file_focus_stack_from_profile(profile))
    has_file_ref = bool(_NAMED_FILE_EXT_RE.search(study_line)) or has_focus or bool(_FILE_REF_RE.search(study_line))
    if has_study and has_file_ref:
        return True
    return bool(has_focus and (has_study or re.search(r"(?ix)вывод|conclusion|мнени|анализ", study_line)))


def _compose_directive_block(*, ru: bool) -> str:
    if ru:
        return (
            "**CRITICAL (file study → compose):** пользователь просит **проанализировать документ**, "
            "сформулировать **выводы** и **написать текст песни в этом ответе чата**. "
            "Не запускай генерацию аудио/музыки и не обещай фоновую операцию — только анализ и готовый текст песни."
        )
    return (
        "**CRITICAL (file study → compose):** the user wants **document analysis**, **conclusions**, "
        "and **song lyrics written in this chat reply**. Do not start audio/music generation or promise "
        "a background job — deliver analysis and full lyrics text only."
    )


async def maybe_handle_file_study_compose_turn(
    pool: Any,
    *,
    tool_ctx: Any,
    user_line: str,
) -> dict[str, Any] | None:
    """Load file body when needed and defer to main LLM for analysis + in-chat lyrics."""

    profile = tool_ctx.profile if isinstance(getattr(tool_ctx, "profile", None), Mapping) else None
    if not user_line_is_file_study_compose_turn(user_line, profile):
        return None

    followup = _split_followup_music_clause(user_line)
    study_line = followup[0] if followup is not None else str(user_line or "")
    followup_music_line = followup[1] if followup is not None else ""

    uid = str(getattr(tool_ctx, "content_catalog_user_id", None) or "").strip()
    if not uid:
        return None

    from api.ewa_platform.companion.orchestration.tool_registry import (
        _resolve_main_pool,
        resolve_catalog_discuss_memory_inject,
    )
    from api.ewa_platform.companion.orchestration.turn_plan_v1 import (
        TurnPlanStep,
        companion_turn_plan_enqueue,
    )
    from api.ewa_platform.companion.storage.catalog_file_discuss import (
        augment_memory_section_with_file_focus_discuss,
        catalog_file_discuss_env_enabled,
        user_intent_catalog_file_discuss,
        user_intent_catalog_file_discuss_deictic,
    )

    if not catalog_file_discuss_env_enabled():
        return None

    ctx = tool_ctx
    main_pool = await _resolve_main_pool(ctx)
    memory_parts: list[str] = []
    discuss_result: tuple[str, str, str] | None = None

    named = user_intent_catalog_file_discuss(study_line)
    deictic = user_intent_catalog_file_discuss_deictic(study_line, profile)
    try:
        if named or deictic:
            discuss_result = await resolve_catalog_discuss_memory_inject(ctx, user_line=study_line)
        else:
            from api.ewa_platform.companion.sidecar.file_focus import file_focus_stack_from_profile

            if file_focus_stack_from_profile(profile):
                discuss_result = await augment_memory_section_with_file_focus_discuss(
                    main_pool,
                    principal_id=ctx.principal_id,
                    user_line=study_line,
                    content_catalog_user_id=uid,
                    profile=profile,
                )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] companion_file_study_compose_read_failed principal=%s err=%s",
            getattr(ctx, "principal_id", ""),
            exc,
        )

    if discuss_result is not None:
        block, uc_str, file_label = discuss_result
        if block.strip():
            memory_parts.append(block.strip())
            companion_pool = ctx.companion_pool
            if companion_pool is not None and uc_str:
                try:
                    from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

                    await companion_pg.companion_record_file_focus(
                        companion_pool,
                        principal_id=ctx.principal_id,
                        unified_content_id=uc_str,
                        name=file_label,
                        source="file_study_compose",
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "[STEP] companion_file_study_compose_focus_failed principal=%s err=%s",
                        ctx.principal_id,
                        exc,
                    )

    queued_followup_music = False
    followup_queue_failure = ""
    followup_music_tool = _music_tool_for_clause(followup_music_line) if followup_music_line else ""
    if followup_music_line:
        companion_pool = ctx.companion_pool
        if companion_pool is None:
            followup_queue_failure = "companion_pool_missing"
        else:
            enqueued = await companion_turn_plan_enqueue(
                companion_pool,
                principal_id=ctx.principal_id,
                steps=[
                    TurnPlanStep(
                        tool=followup_music_tool,
                        args={
                            "user_line": followup_music_line,
                            "_tool_router_bypass_line_match": True,
                        },
                    ),
                ],
                source="file_study_compose_followup_music",
            )
            queued_followup_music = bool(enqueued)
            if not queued_followup_music:
                followup_queue_failure = "turn_plan_enqueue_failed"
    turn_plan_hint = ""
    if queued_followup_music:
        logger.info(
            "[STEP] companion_file_study_compose_followup_enqueued principal=%s tool=%s",
            ctx.principal_id,
            followup_music_tool,
        )
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        followup_hint = (
            "После ответа коротко предложи следующий шаг: когда будешь готов — нажми «Запустить» над полем ввода "
            "или напиши пару слов в чате."
            if ru
            else "After the analysis, suggest the next step: when ready, tap Start above the input or say a few words in chat."
        )
        turn_plan_hint = (
            "Когда будешь готов — нажми «Запустить» или напиши «запускай»."
            if ru
            else "When you're ready, tap Start or say 'go on'."
        )
        memory_parts.append(followup_hint)
    elif followup_music_line:
        logger.warning(
            "[STEP] companion_file_study_compose_followup_not_queued principal=%s reason=%s",
            ctx.principal_id,
            followup_queue_failure or "unknown",
        )
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        followup_hint = (
            "В ответе явно укажи: запись песни ещё не началась. "
            "После анализа предложи нажать «Запустить» или написать в чате."
            if ru
            else "State clearly in the reply: song recording has not started yet. "
            "After the analysis, suggest tapping Start or writing in chat."
        )
        turn_plan_hint = (
            "Запись песни пока не началась — не удалось поставить следующий шаг. "
            "После анализа нажми «Запустить» или попроси начать запись в чате."
            if ru
            else "Song recording has not started — the next step could not be queued. "
            "After the analysis, tap Start or ask to begin recording in chat."
        )
        memory_parts.append(followup_hint)

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    memory_parts.append(_compose_directive_block(ru=ru))
    memory_append = "\n\n".join(memory_parts).strip()

    logger.info(
        "[STEP] companion_orchestration_decision branch=file_study_compose status=defer_llm memory_chars=%s loaded=%s",
        len(memory_append),
        discuss_result is not None,
    )
    out = {
        "continue_main_llm": True,
        "memory_section_append": memory_append,
        "orchestration_branch": "file_study_compose",
        "reply": "",
        "actions": [],
        "task_run": None,
    }
    if turn_plan_hint:
        out["turn_plan_hint"] = turn_plan_hint
    if queued_followup_music and followup_music_tool:
        out["turn_plan_next_tool"] = followup_music_tool
        out["turn_plan_source"] = "file_study_compose_followup_music"
    elif followup_music_line:
        out["turn_plan_source"] = "file_study_compose_followup_music_not_queued"
        report = record_branch_probe(
            "file_study_compose",
            "not_started",
            reason_code="followup_music_not_queued",
            reason_message_ru=turn_plan_hint or "Запись песни пока не началась.",
            reason_message_en=turn_plan_hint or "Song recording has not started yet.",
            resume_conditions=[
                "Нажми «Запустить» или попроси начать запись в чате."
                if any("\u0400" <= ch <= "\u04ff" for ch in user_line)
                else "Tap Start or ask to begin recording in chat.",
            ],
            refs={"queue_failure": followup_queue_failure or "unknown"},
        )
        if report is not None:
            attach_reports_to_response(out, [report], orchestrated=out)
    return out


__all__ = (
    "maybe_handle_file_study_compose_turn",
    "user_line_is_file_study_compose_turn",
)
