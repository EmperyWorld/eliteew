# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Server-first **companion plans** domain (goals/tasks, intent detection, optional LLM structuring).
# Related:
# - documentation/product/ewa/EWA-COMPANION-SERVER-PLANS-ADR.md
# ---

from api.ewa_platform.companion.plans.config import (
    companion_meta_evolution_enabled,
    companion_plan_enabled,
    companion_plan_llm_enabled,
)
from api.ewa_platform.companion.plans.intent import user_line_requests_plan

__all__ = (
    "companion_meta_evolution_enabled",
    "companion_plan_enabled",
    "companion_plan_llm_enabled",
    "user_line_requests_plan",
)


def __getattr__(name: str) -> object:
    if name == "build_plan_from_user_line":
        from api.ewa_platform.companion.plans.service import build_plan_from_user_line

        return build_plan_from_user_line
    raise AttributeError(name)
