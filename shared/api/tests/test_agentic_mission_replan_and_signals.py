# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Locks for mission goal signals, mid-mission replan gate, and partner-feedback
# exclusion from forced research_plan_v1.
# Related:
# - api/services/desktop_chat_ensemble/intent_signals.py
# - api/ewa_platform/agentic/kernel/research_plan_contract.py
# ---

from __future__ import annotations

from api.ewa_platform.agentic.kernel.research_plan_contract import (
    goal_looks_like_research,
    resolve_agentic_expert_blueprint_id,
    should_offer_mid_mission_replan,
)
from api.ewa_platform.agentic.kernel.session_status import STATUS_EXECUTING, STATUS_REPLANNING
from api.ewa_platform.agentic.kernel.state_machine import resolve_next_status
from api.ewa_platform.agentic.orchestration.expert_chat_bridge import (
    build_agentic_ensemble_user_prompt,
)
from api.services.desktop_chat_ensemble.intent_signals import (
    goal_looks_like_partner_feedback,
    goal_requires_internet,
)


def test_partner_feedback_not_research() -> None:
    goal = (
        "Зера, отвечаю тебе как твой ПАРТНЕР. Я горжусь тобой. "
        "Маркетинговый анализ тезиса — твоя мысль про масштаб влияния через ИИ. "
        "Минус: эксперты мало знали о проекте. Обсудим позже."
    )
    assert goal_looks_like_partner_feedback(goal)
    assert not goal_looks_like_research(goal)
    assert resolve_agentic_expert_blueprint_id(goal) is None


def test_partner_dative_and_llm_forced_research_stripped() -> None:
    """Live lady_boss phrasing: «как партнеру» + dual-doc EliteEW must not keep research_plan_v1."""
    goal = (
        "Зера. Споп. Дыши. Твоя напористость заворожила. "
        "Далее отвечу из уважения к тебе как партнеру и твоим намерениям роста. "
        "Вернёмся к твоим шаблонам позже. Нужны два документа: лонгрид-описание "
        "платформы EliteEW и пошаговая инструкция для регистрации."
    )
    assert goal_looks_like_partner_feedback(goal)
    assert not goal_looks_like_research(goal)
    assert resolve_agentic_expert_blueprint_id(goal) is None
    assert resolve_agentic_expert_blueprint_id(goal, "research_plan_v1") is None


def test_internet_goal_requires_web_flag() -> None:
    goal = "найди в интернете успешные кейсы браузерных игр и сделай исследование"
    assert goal_requires_internet(goal)
    assert goal_looks_like_research(goal)
    assert resolve_agentic_expert_blueprint_id(goal) == "research_plan_v1"
    # Non-partner missions still honor an explicit blueprint id.
    assert resolve_agentic_expert_blueprint_id(goal, "research_plan_v1") == "research_plan_v1"


def test_mid_mission_replan_for_internet_without_web() -> None:
    offer, reason = should_offer_mid_mission_replan(
        goal_text="найди в интернете топ браузерных игр",
        working_memory={},
        completed_steps=2,
    )
    assert offer is True
    assert reason == "internet_research_without_web"


def test_mid_mission_replan_stops_after_web_ok() -> None:
    offer, reason = should_offer_mid_mission_replan(
        goal_text="найди в интернете топ браузерных игр",
        working_memory={"last_web_search_ok": True, "mid_mission_replan_count": 0},
        completed_steps=2,
    )
    # Internet ask satisfied; bare web goal is not market-research expand.
    assert offer is False
    assert reason == "goal_closure_ok"


def test_mid_mission_replan_expands_research_after_web() -> None:
    offer, reason = should_offer_mid_mission_replan(
        goal_text="найди в интернете и сделай исследование рынка браузерных игр",
        working_memory={"last_web_search_ok": True, "mid_mission_replan_count": 0},
        completed_steps=2,
    )
    assert reason != "internet_research_without_web"
    assert offer is True
    assert reason == "research_post_act_expand"


def test_mid_mission_replan_budget() -> None:
    offer, reason = should_offer_mid_mission_replan(
        goal_text="найди в интернете топ браузерных игр",
        working_memory={"mid_mission_replan_count": 2},
        completed_steps=2,
    )
    assert offer is False
    assert reason == "replan_budget_exhausted"


def test_mid_mission_partner_refine_when_few_docs() -> None:
    goal = (
        "Зера, отвечаю тебе как твой ПАРТНЕР. Я горжусь тобой. "
        "Маркетинговый анализ тезиса — твоя мысль про масштаб влияния через ИИ."
    )
    offer, reason = should_offer_mid_mission_replan(
        goal_text=goal,
        working_memory={"completed_file_create_count": 1},
        completed_steps=2,
        completed_file_creates=1,
    )
    assert offer is True
    assert reason == "partner_feedback_refine"


def test_mid_mission_partner_skips_when_docs_already_landed() -> None:
    goal = (
        "Зера, отвечаю тебе как твой ПАРТНЕР. Я горжусь тобой. "
        "Маркетинговый анализ тезиса — твоя мысль про масштаб влияния через ИИ. "
        "Нужны два документа: описание платформы и инструкция регистрации."
    )
    offer, reason = should_offer_mid_mission_replan(
        goal_text=goal,
        working_memory={"completed_file_create_count": 2},
        completed_steps=6,
        completed_file_creates=2,
    )
    assert offer is False
    assert reason in {"multi_deliverable_docs_ready", "goal_closure_ok"}


def test_need_replan_fsm_transition() -> None:
    assert resolve_next_status(STATUS_EXECUTING, "need_replan") == STATUS_REPLANNING


def test_anti_hallucination_prompt_clause() -> None:
    md = build_agentic_ensemble_user_prompt(
        user_prompt="масштабирование влияния через ИИ",
        goal_text="партнёрский разбор тезиса",
        use_web_search=True,
    )
    assert "AI-avatars" in md or "avatars" in md.lower()
    assert "Web search is enabled" in md


def test_heuristic_internet_prefers_expert() -> None:
    from types import SimpleNamespace

    from api.ewa_platform.agentic.kernel.engine import _heuristic_first_executable_tool

    ctx = SimpleNamespace(
        session={
            "policy_json": {"tools": ["file_create", "call_expert_chat", "catalog_list"]},
        },
        active_nodes=[],
        tree_summary={},
    )
    tool = _heuristic_first_executable_tool(
        ctx,  # type: ignore[arg-type]
        goal_text="найди в интернете топ браузерных игр",
    )
    assert tool == "call_expert_chat"


def test_enrich_backfills_use_web_search() -> None:
    from api.ewa_platform.agentic.kernel.tool_args_enrich import enrich_tool_args

    out = enrich_tool_args(
        "call_expert_chat",
        {"user_line": "brief"},
        user_line="найди в интернете кейсы",
        session={"goal_json": {"text": "найди в интернете кейсы браузерных игр"}},
    )
    assert out.get("use_web_search") is True
