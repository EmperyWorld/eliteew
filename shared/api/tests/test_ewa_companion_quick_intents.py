# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for companion quick-intent registry and i18n sync with frontend builtins.
# Invariants:
# - Frontend built-in quick presets and backend canonical registry must expose the same keys.
# - Legacy quick-intent phrases remain matchable but are not frontend built-ins.
# Related:
# - api/ewa_platform/companion/ux/quick_intents.py
# - web/frontend/src/features/ewa/ewaCompanionQuickPresetsUi.ts
# ---

from __future__ import annotations

import json
from pathlib import Path

import pytest

from api.ewa_platform.companion.plans.intent import user_line_requests_plan
from api.ewa_platform.companion.ux.quick_intents import (
    LEGACY_QUICK_INTENT_REGISTRY,
    QUICK_INTENT_REGISTRY,
    QuickIntentId,
    match_quick_intent,
    quick_intent_frontend_keys,
)

_ELITEEW_ROOT = Path(__file__).resolve().parents[2]
_RU_MARKETING_JSON = _ELITEEW_ROOT / "web/frontend/src/i18n/locales/ru/marketing.json"


def test_quick_intent_registry_covers_all_frontend_builtin_keys() -> None:
    data = json.loads(_RU_MARKETING_JSON.read_text(encoding="utf-8"))
    defaults = data["ewaCompanion"]["quickPresetDefaults"]
    assert quick_intent_frontend_keys() == frozenset(defaults.keys())


@pytest.mark.parametrize(
    ("frontend_key", "prompt_ru"),
    [(spec.frontend_key, spec.prompt_ru) for spec in QUICK_INTENT_REGISTRY],
)
def test_quick_intent_prompts_match_ru_i18n(frontend_key: str, prompt_ru: str) -> None:
    data = json.loads(_RU_MARKETING_JSON.read_text(encoding="utf-8"))
    i18n_prompt = data["ewaCompanion"]["quickPresetDefaults"][frontend_key]["prompt"]
    assert prompt_ru == i18n_prompt


def test_match_quick_intent_exact_reflect_week() -> None:
    matched = match_quick_intent("Подведи итоги недели")
    assert matched is not None
    assert matched.intent_id == QuickIntentId.REFLECT_WEEK
    assert matched.route_hint == "workflow_reflect_week"


def test_match_quick_intent_current_frontend_document_list() -> None:
    line = "Покажи список моих документов из каталога прямо в EWA и предложи, какой открыть первым."
    matched = match_quick_intent(line)
    assert matched is not None
    assert matched.intent_id == QuickIntentId.DOCUMENT_LIST
    assert matched.route_hint == "catalog_list"


def test_match_quick_intent_music_generate() -> None:
    line = "Сгенерируй песню в фоне (XL Turbo): подбери тему и стиль по нашему разговору и запусти без открытия студии."
    matched = match_quick_intent(line)
    assert matched is not None
    assert matched.intent_id == QuickIntentId.MUSIC_GENERATE
    assert matched.route_hint == "music_generation"


def test_match_quick_intent_music_autonomous_with_suffix() -> None:
    line = (
        "Запусти автономную генерацию песни: выбери жанр и настроение по нашей беседе "
        "и начни без лишних уточнений. Поп-рок"
    )
    matched = match_quick_intent(line)
    assert matched is not None
    assert matched.intent_id == QuickIntentId.MUSIC_AUTONOMOUS
    assert matched.route_hint == "music_generation_xl_base"


def test_match_quick_intent_operations_cancel() -> None:
    line = "Отмени текущую фоновую операцию и покажи обновлённый статус."
    matched = match_quick_intent(line)
    assert matched is not None
    assert matched.intent_id == QuickIntentId.OPERATIONS_CANCEL
    assert matched.route_hint == "operation_cancel"


def test_match_quick_intent_break_into_steps_triggers_plan_gate() -> None:
    line = "Разбей мою текущую задачу на шаги — 3–5 конкретных пунктов с приоритетом."
    matched = match_quick_intent(line)
    assert matched is not None
    assert matched.intent_id == QuickIntentId.BREAK_INTO_STEPS
    assert user_line_requests_plan(line)


def test_reflect_week_quick_intent_route_hint() -> None:
    spec = next(s for s in LEGACY_QUICK_INTENT_REGISTRY if s.intent_id == QuickIntentId.REFLECT_WEEK)
    assert spec.route_hint == "workflow_reflect_week"


def test_unrelated_line_does_not_match_quick_intent() -> None:
    assert match_quick_intent("просто поболтаем о погоде") is None
