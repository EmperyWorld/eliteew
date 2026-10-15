# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Named prompt templates for companion server workflows (not user-visible verbatim dumps).
# Related:
# - api/ewa_platform/companion/workflows/registry.py
# ---

from __future__ import annotations

REFLECT_WEEK_TEMPLATE = (
    "Legacy reference — runtime uses system+user messages in ``workflows/runner._llm_reflect_week_reply``.\n"
    "Task: weekly reflection in the user's language; memory facts live in system only."
)

PLAN_MONTH_TEMPLATE = (
    "Пользователь просит план на месяц. Ответь кратким markdown-списком целей и шагов (до 7 пунктов).\n{user_line}"
)

TEMPLATES: dict[str, str] = {
    "reflect_week": REFLECT_WEEK_TEMPLATE,
    "plan_month": PLAN_MONTH_TEMPLATE,
}

__all__ = ("TEMPLATES", "PLAN_MONTH_TEMPLATE", "REFLECT_WEEK_TEMPLATE")
