# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for companion instruction guard rails (memory/plan meta vs music).
# Related:
# - api/ewa_platform/companion/orchestration/instruction_guards.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.instruction_guards import (
    user_line_is_memory_or_plan_meta_instruction,
)


def test_memory_instruction_detected() -> None:
    line = "ЗАПОМНИ* Внеси изменения. Текущие задачи не надо повторять,  **Статус прогресс.** Как поняла?"
    assert user_line_is_memory_or_plan_meta_instruction(line)


def test_music_line_not_meta_instruction() -> None:
    assert not user_line_is_memory_or_plan_meta_instruction("сгенерируй песню про лето")
