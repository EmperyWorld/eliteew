# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract test: orchestration branch order in ``routing_policy`` matches ``task_orchestrator`` documentation.
# Invariants:
# - No HTTP; pure constants.
# Related:
# - api/ewa_platform/companion/orchestration/routing_policy.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.routing_policy import (
    ORCHESTRATION_PIPELINE_ORDER,
    PRE_TOOL_BRANCHES,
    OrchestrationBranch,
    companion_early_tool_branch_policy_order,
)


def test_orchestration_pipeline_plan_v1_before_server_first() -> None:
    order = ORCHESTRATION_PIPELINE_ORDER
    assert order.index(OrchestrationBranch.PLAN_V1) < order.index(OrchestrationBranch.CATALOG_DISCUSS)
    assert order.index(OrchestrationBranch.CATALOG_DISCUSS) < order.index(OrchestrationBranch.SERVER_FIRST_V2)


def test_orchestration_pipeline_order_server_first_before_planner() -> None:
    idx_sf = ORCHESTRATION_PIPELINE_ORDER.index(OrchestrationBranch.SERVER_FIRST_V2)
    idx_ip = ORCHESTRATION_PIPELINE_ORDER.index(OrchestrationBranch.INTENT_PLANNER_DISPATCH)
    idx_mem = ORCHESTRATION_PIPELINE_ORDER.index(OrchestrationBranch.MEMORY_QUESTION)
    assert idx_sf < idx_ip < idx_mem


def test_orchestration_pipeline_doc_create_before_file_ops() -> None:
    idx_create = ORCHESTRATION_PIPELINE_ORDER.index(OrchestrationBranch.DOC_CREATE)
    idx_ins = ORCHESTRATION_PIPELINE_ORDER.index(OrchestrationBranch.DOC_INSERT)
    assert idx_create < idx_ins


def test_orchestration_pipeline_plan_task_complete_after_plan_v1() -> None:
    order = ORCHESTRATION_PIPELINE_ORDER
    assert order.index(OrchestrationBranch.PLAN_V1) < order.index(OrchestrationBranch.PLAN_TASK_COMPLETE_V1)
    assert order.index(OrchestrationBranch.PLAN_TASK_COMPLETE_V1) < order.index(OrchestrationBranch.CALENDAR_V1)
    assert order.index(OrchestrationBranch.CALENDAR_V1) < order.index(OrchestrationBranch.CATALOG_DISCUSS)
    assert order.index(OrchestrationBranch.PLAN_TASK_COMPLETE_V1) < order.index(OrchestrationBranch.SERVER_FIRST_V2)


def test_orchestration_branch_enum_includes_pre_tool_and_workflow() -> None:
    assert OrchestrationBranch.RESUME_PENDING_TASK.value == "resume_pending_task"
    assert OrchestrationBranch.RESUME_COMPLETED_MUSIC_GENERATION.value == "resume_completed_music_generation"
    assert OrchestrationBranch.RESUME_COMPLETED_PRESENTATION.value == "resume_completed_presentation"
    assert OrchestrationBranch.WORKFLOW_REFLECT_WEEK.value == "workflow_reflect_week"
    assert OrchestrationBranch.PLAN_V1_UNAVAILABLE.value == "plan_v1_unavailable"


def test_pre_tool_branches_tuple_is_canonical() -> None:
    assert PRE_TOOL_BRANCHES[0] == OrchestrationBranch.RESUME_PENDING_TASK
    assert PRE_TOOL_BRANCHES[1] == OrchestrationBranch.AGENTIC_SESSION
    assert PRE_TOOL_BRANCHES[2] == OrchestrationBranch.RESUME_COMPLETED_MUSIC_GENERATION
    assert PRE_TOOL_BRANCHES[3] == OrchestrationBranch.RESUME_COMPLETED_PRESENTATION
    assert OrchestrationBranch.ACTION_WORKFLOW in PRE_TOOL_BRANCHES
    assert PRE_TOOL_BRANCHES.index(OrchestrationBranch.ACTION_WORKFLOW) < PRE_TOOL_BRANCHES.index(
        OrchestrationBranch.WORKFLOW,
    )
    assert OrchestrationBranch.WORKFLOW in PRE_TOOL_BRANCHES
    assert OrchestrationBranch.PLAN_V1 not in PRE_TOOL_BRANCHES


def test_orchestration_pipeline_phase_d_branches_sit_before_intent_planner() -> None:
    """Phase D contract: music backend (optional), music studio UI, file_open, and app_open short-circuit before the LLM planner.

    Order must be: server-first rewrite → theme set → music_generation → music studio open → file_open → generic app open → intent planner.
    """

    order = ORCHESTRATION_PIPELINE_ORDER
    assert order.index(OrchestrationBranch.SERVER_FIRST_V2) < order.index(OrchestrationBranch.THEME_SET)
    assert order.index(OrchestrationBranch.THEME_SET) < order.index(OrchestrationBranch.MUSIC_XL_BASE_INTERACTIVE)
    assert order.index(OrchestrationBranch.MUSIC_XL_BASE_INTERACTIVE) < order.index(
        OrchestrationBranch.MUSIC_GENERATION_XL_BASE
    )
    assert order.index(OrchestrationBranch.MUSIC_GENERATION_XL_BASE) < order.index(OrchestrationBranch.MUSIC_GENERATION)
    assert order.index(OrchestrationBranch.MUSIC_GENERATION) < order.index(OrchestrationBranch.IMAGE_GENERATION)
    assert order.index(OrchestrationBranch.IMAGE_GENERATION) < order.index(OrchestrationBranch.MUSIC_STUDIO_OPEN)
    assert order.index(OrchestrationBranch.MUSIC_STUDIO_OPEN) < order.index(OrchestrationBranch.FILE_OPEN)
    assert order.index(OrchestrationBranch.FILE_OPEN) < order.index(OrchestrationBranch.APP_OPEN)
    assert order.index(OrchestrationBranch.APP_OPEN) < order.index(OrchestrationBranch.INTENT_PLANNER_DISPATCH)


def test_orchestration_pipeline_catalog_list_after_discuss() -> None:
    order = ORCHESTRATION_PIPELINE_ORDER
    assert order.index(OrchestrationBranch.CATALOG_DISCUSS) < order.index(OrchestrationBranch.CATALOG_LIST)
    assert order.index(OrchestrationBranch.CATALOG_LIST) < order.index(OrchestrationBranch.COMPOUND_FILE_CHAIN)
    assert order.index(OrchestrationBranch.COMPOUND_FILE_CHAIN) < order.index(OrchestrationBranch.FILE_STUDY_COMPOSE)
    assert order.index(OrchestrationBranch.FILE_STUDY_COMPOSE) < order.index(OrchestrationBranch.FILE_FOCUS_CHAT)
    assert order.index(OrchestrationBranch.FILE_FOCUS_CHAT) < order.index(OrchestrationBranch.SERVER_FIRST_V2)


def test_pre_tool_branches_includes_turn_plan_resume() -> None:
    assert OrchestrationBranch.TURN_PLAN_RESUME in PRE_TOOL_BRANCHES
    idx_resume = PRE_TOOL_BRANCHES.index(OrchestrationBranch.TURN_PLAN_RESUME)
    idx_action = PRE_TOOL_BRANCHES.index(OrchestrationBranch.ACTION_WORKFLOW)
    assert idx_resume < idx_action


def _policy_early_tool_segment() -> tuple[str, ...]:
    """Policy slice from ``plan_v1`` through ``app_open``, excluding pre-early compound/file-study branches."""

    skip = {
        OrchestrationBranch.COMPOUND_FILE_CHAIN,
        OrchestrationBranch.FILE_STUDY_COMPOSE,
        OrchestrationBranch.FILE_FOCUS_CHAT,
    }
    segment: list[str] = []
    capture = False
    for branch in ORCHESTRATION_PIPELINE_ORDER:
        if branch == OrchestrationBranch.PLAN_V1:
            capture = True
        if not capture:
            continue
        if branch in skip:
            continue
        segment.append(branch.value)
        if branch == OrchestrationBranch.APP_OPEN:
            break
    return tuple(segment)


def test_runtime_early_tool_branch_order_matches_orchestration_pipeline_order() -> None:
    runtime = companion_early_tool_branch_policy_order()
    policy = _policy_early_tool_segment()
    assert runtime == policy
