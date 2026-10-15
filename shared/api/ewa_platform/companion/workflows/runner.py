# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Back-compat facade for chat workflow runner (prefer ``workflows.chat.runner``).
# Related:
# - api/ewa_platform/companion/workflows/chat/runner.py
# ---

from __future__ import annotations

from typing import TYPE_CHECKING

from api.ewa_platform.companion.workflows.chat import runner as _chat_runner

if TYPE_CHECKING:
    from api.ewa_platform.companion.workflows.chat.runner import (
        extract_final_prose_from_llm_reasoning,
        normalize_reflect_week_memory_section,
        sanitize_workflow_visible_reply,
        try_workflow_orchestration_reply,
    )

__all__: tuple[str, ...] = (
    "extract_final_prose_from_llm_reasoning",
    "normalize_reflect_week_memory_section",
    "sanitize_workflow_visible_reply",
    "try_workflow_orchestration_reply",
)


def __getattr__(name: str) -> object:
    return getattr(_chat_runner, name)
