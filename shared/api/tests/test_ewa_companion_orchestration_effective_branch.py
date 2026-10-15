# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for ``orchestration_branch`` metadata: episodic extra, visible reply guards, planner skip on plan-regex.
# Invariants:
# - No live HTTP/Postgres; pure unit helpers and mocked orchestration paths.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-ORCHESTRATION-HARDENING-PLAN.md
# ---

from __future__ import annotations

import asyncio
import sys
import types
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

sys.modules.setdefault("asyncpg", types.ModuleType("asyncpg"))

from api.ewa_platform.companion.context.noise import apply_companion_visible_reply_guards
from api.ewa_platform.companion.contracts import CompanionIntentPlanV1
from api.ewa_platform.companion.orchestration.response import tag_orchestration_branch
from api.ewa_platform.companion.turn import chat_turn


def test_tag_orchestration_branch_sets_field() -> None:
    out = tag_orchestration_branch({"reply": "ok", "actions": []}, "plan_v1")
    assert out["orchestration_branch"] == "plan_v1"
    assert out["reply"] == "ok"


def test_episodic_extra_plan_v1_omits_false_doc_create_hint() -> None:
    plan = CompanionIntentPlanV1.model_validate(
        {
            "intent": "doc_create",
            "confidence": 0.9,
            "understood_summary_ru": "создать документ",
        }
    )
    extra = chat_turn._episodic_extra_from_orchestration(
        orchestration_branch="plan_v1",
        intent_plan=plan,
    )
    assert extra is not None
    assert extra.get("orchestration_branch") == "plan_v1"
    assert "intent_hint" not in extra


def test_episodic_extra_intent_planner_dispatch_keeps_hint() -> None:
    plan = CompanionIntentPlanV1.model_validate(
        {
            "intent": "doc_create",
            "confidence": 0.9,
            "understood_summary_ru": "новый файл",
        }
    )
    extra = chat_turn._episodic_extra_from_orchestration(
        orchestration_branch="intent_planner_dispatch",
        intent_plan=plan,
    )
    assert extra is not None
    assert extra.get("orchestration_branch") == "intent_planner_dispatch"
    assert extra.get("intent_hint") == "doc_create"


def test_visible_reply_guards_skip_action_nudge_on_plan_v1() -> None:
    plan = CompanionIntentPlanV1.model_validate(
        {"intent": "doc_create", "confidence": 0.95, "understood_summary_ru": "x"}
    )
    guarded = apply_companion_visible_reply_guards(
        "",
        user_line="Составь план на 2 недели",
        intent_plan=plan,
        actions=None,
        effective_branch="plan_v1",
    )
    assert guarded == ""


def test_visible_reply_guards_strip_false_started_claim_for_deferred_music() -> None:
    raw = "Я выполнила анализ и уже запустила генерацию песни.\nГенерация в процессе — скоро будет готово."
    guarded = apply_companion_visible_reply_guards(
        raw,
        user_line="проанализируй документ и потом сгенерируй песню",
        intent_plan=None,
        actions=[],
        effective_branch="file_study_compose",
        deferred_music_generation=True,
    )
    assert "уже запустила" not in guarded.lower()
    assert "генерация в процессе" not in guarded.lower()
    assert "ещё не запущена" in guarded.lower()


def test_visible_reply_guards_strip_false_started_claim_when_music_not_queued() -> None:
    raw = "Готово: анализ и текст песни написаны. Генерацию я уже запустила.\nМузыка в процессе."
    guarded = apply_companion_visible_reply_guards(
        raw,
        user_line="проанализируй документ и напиши текст песни",
        intent_plan=None,
        actions=[],
        effective_branch="file_study_compose",
        deferred_music_generation=False,
    )
    lowered = guarded.lower()
    assert "уже запустила" not in lowered
    assert "музыка в процессе" not in lowered
    assert "ещё не запущена" in lowered
    assert "отдельная команда" in lowered


@pytest.mark.unit
def test_fetch_intent_plan_skipped_on_plan_regex() -> None:
    async def _run() -> Any:
        with patch(
            "api.ewa_platform.companion.turn.phases.turn_bootstrap.run_companion_intent_planner",
            new_callable=AsyncMock,
        ) as mock_planner:
            out = await chat_turn._fetch_companion_intent_plan(
                "Составь план на две недели по продукту",
                None,
            )
            mock_planner.assert_not_called()
            return out

    assert asyncio.run(_run()) is None


@pytest.mark.unit
def test_planner_system_prompt_discourages_doc_create_for_roadmap() -> None:
    from api.ewa_platform.companion.sidecar.intent_planner import _planner_system_prompt

    prompt = _planner_system_prompt(russian_user=True)
    assert "chat_only" in prompt
    assert "roadmap" in prompt.lower() or "план" in prompt.lower()
    assert "doc_create" in prompt
