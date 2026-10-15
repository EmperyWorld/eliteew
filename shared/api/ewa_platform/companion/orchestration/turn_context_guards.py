# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Turn-level context guards — suppress side-effect tools (music, image, app open) when the user continues a
# **file-focus** dialogue (opinion / analysis about «его/it») instead of requesting a new executable action.
# Invariants:
# - Pure heuristics for gating; optional memory refresh by ``unified_content_id`` uses catalog read path.
# - Does not block explicit file ops (open/rename/delete/create) detected elsewhere in orchestrator.
# Related:
# - api/ewa_platform/companion/sidecar/file_focus.py
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - documentation/product/ewa/EWA-COMPANION-MULTI-TASK-ORCHESTRATION.md
# ---

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from typing import Any, Final

from api.ewa_platform.companion.sidecar.file_focus import file_focus_stack_from_profile

logger = logging.getLogger(__name__)

_FILE_FOCUS_OPINION_RE: Final = re.compile(
    r"(?ix)(?:"
    r"что\s+(?:ты\s+)?(?:думаешь|сказал[а]?|считаешь)\s+(?:о|об|про)\s+"
    r"(?:н[её]м|н[её]|этом|это[мут]|файл\w*|документ\w*)"
    r"|(?:как\s+тебе|тво[ёe]\s+мнени\w+|что\s+скажешь|прокомментир\w+|оцени\w+)\s+"
    r"(?:о|об|про|this|it|the\s+file|the\s+document|файл|документ)"
    r"|what\s+do\s+you\s+think\s+(?:about\s+)?(?:it|this|the\s+file|the\s+document)"
    r"|your\s+(?:opinion|thoughts)\s+(?:on|about)\s+(?:it|this|the\s+file)"
    r"|how\s+do\s+you\s+(?:like|feel\s+about)\s+(?:it|this|the\s+file)"
    r")",
)

_DEICTIC_ABOUT_RE: Final = re.compile(
    r"(?ix)(?:"
    r"\b(?:о|об|про)\s+(?:н[её]м|н[её]|этом|это[мут]|файл\w*|документ\w*)\b"
    r"|\b(?:about|on)\s+(?:it|this|the\s+file|the\s+document)\b"
    r")",
)

_OPINION_VERB_RE: Final = re.compile(
    r"(?ix)(?:"
    r"думаешь|сказал[а]?|считаешь|мнени\w+|прокомментир\w+|оцени\w+|разбер\w+|анализир\w+|"
    r"think|opinion|comment|review|analyze|analyse"
    r")",
)

_EXECUTABLE_FILE_OP_RE: Final = re.compile(
    r"(?ix)(?:"
    r"открой|open|удали|delete|переимен|rename|созда(?:й|ть)|create|вставь|insert|"
    r"перепиш|rewrite|полностью\s+перепиш|сгенерир\w+|generate\s+(?:a\s+)?song|"
    r"список\s+файл|show\s+(?:me\s+)?(?:the\s+)?files|list\s+(?:my\s+)?files"
    r")",
)


def user_line_is_file_focus_chat(
    user_line: str,
    profile: Mapping[str, Any] | None,
) -> bool:
    """True when user asks for opinion/analysis about the active file-focus target (not a new side effect)."""

    s = str(user_line or "").strip()
    if len(s) < 4:
        return False
    stack = file_focus_stack_from_profile(profile)
    if not stack:
        return False
    if _EXECUTABLE_FILE_OP_RE.search(s):
        return False
    if _FILE_FOCUS_OPINION_RE.search(s):
        return True
    return bool(_DEICTIC_ABOUT_RE.search(s) and _OPINION_VERB_RE.search(s))


def side_effect_tools_suppressed_for_turn(
    user_line: str,
    profile: Mapping[str, Any] | None,
) -> bool:
    """Return True when music/image/app side effects must not run on this turn."""

    from api.ewa_platform.companion.orchestration.file_study_compose import (
        user_line_is_file_study_compose_turn,
    )

    return user_line_is_file_focus_chat(user_line, profile) or user_line_is_file_study_compose_turn(
        user_line,
        profile,
    )


async def maybe_orchestrate_file_focus_chat_turn(
    pool: Any,
    *,
    tool_ctx: Any,
    user_line: str,
) -> dict[str, Any] | None:
    """Defer to main LLM for file-focus opinion turns; optionally refresh catalogue body in memory."""

    profile = tool_ctx.profile if isinstance(getattr(tool_ctx, "profile", None), Mapping) else None
    if not user_line_is_file_focus_chat(user_line, profile):
        return None

    memory_append = ""
    uid = str(getattr(tool_ctx, "content_catalog_user_id", None) or "").strip()
    stack = file_focus_stack_from_profile(profile)
    if pool is not None and uid and stack:
        name, uc_str = stack[-1]
        if uc_str:
            try:
                from api.ewa_platform.companion.storage.catalog_file_discuss import (
                    build_catalog_memory_block_for_unified_content,
                )

                block = await build_catalog_memory_block_for_unified_content(
                    pool,
                    principal_id=str(getattr(tool_ctx, "principal_id", "") or ""),
                    content_catalog_user_id=uid,
                    unified_content_id=uc_str,
                    file_label=name,
                    user_line=user_line,
                )
                if block:
                    memory_append = block
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "[STEP] companion_file_focus_chat_memory_refresh_failed principal=%s err=%s",
                    getattr(tool_ctx, "principal_id", ""),
                    exc,
                )

    logger.info(
        "[STEP] companion_orchestration_decision branch=file_focus_chat status=defer_llm memory_chars=%s",
        len(memory_append),
    )
    return {
        "continue_main_llm": True,
        "memory_section_append": memory_append,
        "orchestration_branch": "file_focus_chat",
        "reply": "",
        "actions": [],
        "task_run": None,
    }


__all__ = (
    "maybe_orchestrate_file_focus_chat_turn",
    "side_effect_tools_suppressed_for_turn",
    "user_line_is_file_focus_chat",
)
