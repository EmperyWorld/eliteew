# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Single source of truth for **order of branches** in companion task orchestration (classic vs server-first merge).
# ``task_orchestrator.maybe_handle_companion_task_orchestration`` delegates phase execution here; durable runs
# and step ordering remain in ``task_orchestrator`` + ``jobs/executor``.
# Invariants:
# - Pre-tool / defer-memory / early / late probe order defined once (``PRE_TOOL_PHASE_ORDER``, etc.).
# - ``task_orchestrator`` supplies callables only — no duplicate inline branch loops.
# Related:
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - documentation/product/ewa/EWA-COMPANION-ORCHESTRATION-HARDENING-PLAN.md
# ---
"""Ordered pipeline for companion task orchestration (server-first bias)."""

from __future__ import annotations

import inspect
import logging
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Final

logger = logging.getLogger(__name__)


class OrchestrationBranch(StrEnum):
    """Named stages of ``maybe_handle_companion_task_orchestration`` (happy path order)."""

    RESUME_PENDING_TASK = "resume_pending_task"
    AGENTIC_SESSION = "agentic_session"
    RESUME_COMPLETED_MUSIC_GENERATION = "resume_completed_music_generation"
    RESUME_COMPLETED_PRESENTATION = "resume_completed_presentation"
    OUTPUT_SURFACE = "output_surface"
    CHECK_TASK_STATUS = "check_task_status"
    ACTIVE_OPERATIONS_STATUS = "active_operations_status"
    WORKFLOW = "workflow"
    WORKFLOW_REFLECT_WEEK = "workflow_reflect_week"
    ACTION_WORKFLOW = "action_workflow"
    PLAN_V1 = "plan_v1"
    PLAN_TASK_COMPLETE_V1 = "plan_task_complete_v1"
    PLAN_V1_UNAVAILABLE = "plan_v1_unavailable"
    CALENDAR_V1 = "calendar_v1"
    CATALOG_DISCUSS = "catalog_discuss"
    SOCIAL_POST_COMPOSE = "social_post_compose"
    CATALOG_LIST = "catalog_list"
    COMPOUND_FILE_CHAIN = "compound_file_chain"
    FILE_STUDY_COMPOSE = "file_study_compose"
    TURN_PLAN_RESUME = "turn_plan_resume"
    TURN_PLAN_CANCEL = "turn_plan_cancel"
    FILE_FOCUS_CHAT = "file_focus_chat"
    SERVER_FIRST_V2 = "server_first_v2"
    THEME_SET = "theme_set"
    MUSIC_XL_BASE_INTERACTIVE = "music_xl_base_interactive"
    MUSIC_GENERATION_XL_BASE = "music_generation_xl_base"
    MUSIC_GENERATION = "music_generation"
    IMAGE_GENERATION = "image_generation"
    PRESENTATION_GENERATION = "presentation_generation"
    MUSIC_STUDIO_OPEN = "music_studio_open"
    FILE_OPEN = "file_open"
    APP_OPEN = "app_open"
    INTENT_PLANNER_DISPATCH = "intent_planner_dispatch"
    TOOL_ROUTER_DISPATCH = "tool_router_dispatch"
    MEMORY_QUESTION = "memory_question"
    DOC_CREATE = "doc_create"
    DOC_EDIT_REQUIRES_OPEN_EDITOR = "doc_edit_requires_open_editor"
    FILE_RENAME = "file_rename"
    FILE_DELETE = "file_delete"
    DOC_INSERT = "doc_insert"


# Pre-tool branches (always before tool_ctx / registry loop).
PRE_TOOL_BRANCHES: tuple[OrchestrationBranch, ...] = (
    OrchestrationBranch.RESUME_PENDING_TASK,
    OrchestrationBranch.AGENTIC_SESSION,
    OrchestrationBranch.RESUME_COMPLETED_MUSIC_GENERATION,
    OrchestrationBranch.RESUME_COMPLETED_PRESENTATION,
    OrchestrationBranch.OUTPUT_SURFACE,
    OrchestrationBranch.CHECK_TASK_STATUS,
    OrchestrationBranch.ACTIVE_OPERATIONS_STATUS,
    OrchestrationBranch.TURN_PLAN_RESUME,
    OrchestrationBranch.ACTION_WORKFLOW,
    OrchestrationBranch.WORKFLOW,
    OrchestrationBranch.WORKFLOW_REFLECT_WEEK,
)

# Defer-memory stage is executed by a dedicated runner; the canonical pipeline order keeps these branches explicitly
# near catalog/server-first branches below (see ``ORCHESTRATION_PIPELINE_ORDER``).
DEFER_MEMORY_BRANCHES: tuple[OrchestrationBranch, ...] = ()

ORCHESTRATION_PIPELINE_ORDER: tuple[OrchestrationBranch, ...] = (
    *PRE_TOOL_BRANCHES,
    OrchestrationBranch.PLAN_V1,
    OrchestrationBranch.PLAN_TASK_COMPLETE_V1,
    OrchestrationBranch.CALENDAR_V1,
    OrchestrationBranch.CATALOG_DISCUSS,
    OrchestrationBranch.SOCIAL_POST_COMPOSE,
    OrchestrationBranch.CATALOG_LIST,
    OrchestrationBranch.COMPOUND_FILE_CHAIN,
    OrchestrationBranch.FILE_STUDY_COMPOSE,
    OrchestrationBranch.FILE_FOCUS_CHAT,
    OrchestrationBranch.SERVER_FIRST_V2,
    OrchestrationBranch.THEME_SET,
    OrchestrationBranch.MUSIC_XL_BASE_INTERACTIVE,
    OrchestrationBranch.MUSIC_GENERATION_XL_BASE,
    OrchestrationBranch.MUSIC_GENERATION,
    OrchestrationBranch.IMAGE_GENERATION,
    OrchestrationBranch.PRESENTATION_GENERATION,
    OrchestrationBranch.MUSIC_STUDIO_OPEN,
    OrchestrationBranch.FILE_OPEN,
    OrchestrationBranch.APP_OPEN,
    OrchestrationBranch.TOOL_ROUTER_DISPATCH,
    OrchestrationBranch.INTENT_PLANNER_DISPATCH,
    OrchestrationBranch.MEMORY_QUESTION,
    OrchestrationBranch.DOC_CREATE,
    OrchestrationBranch.FILE_RENAME,
    OrchestrationBranch.FILE_DELETE,
    OrchestrationBranch.DOC_INSERT,
    OrchestrationBranch.DOC_EDIT_REQUIRES_OPEN_EDITOR,
)

_RUNTIME_BRANCH_ALIASES: Final[dict[str, str]] = {
    "file_rewrite": OrchestrationBranch.SERVER_FIRST_V2.value,
    "file_create": OrchestrationBranch.DOC_CREATE.value,
}

EARLY_TOOL_BRANCH_ORDER: Final[tuple[str, ...]] = (
    OrchestrationBranch.CHECK_TASK_STATUS.value,
    OrchestrationBranch.PLAN_V1.value,
    OrchestrationBranch.PLAN_TASK_COMPLETE_V1.value,
    OrchestrationBranch.CALENDAR_V1.value,
    OrchestrationBranch.CATALOG_DISCUSS.value,
    OrchestrationBranch.SOCIAL_POST_COMPOSE.value,
    OrchestrationBranch.CATALOG_LIST.value,
    "file_rewrite",
    OrchestrationBranch.THEME_SET.value,
    OrchestrationBranch.MUSIC_XL_BASE_INTERACTIVE.value,
    OrchestrationBranch.MUSIC_GENERATION_XL_BASE.value,
    OrchestrationBranch.MUSIC_GENERATION.value,
    OrchestrationBranch.IMAGE_GENERATION.value,
    OrchestrationBranch.PRESENTATION_GENERATION.value,
    OrchestrationBranch.MUSIC_STUDIO_OPEN.value,
    OrchestrationBranch.FILE_OPEN.value,
    OrchestrationBranch.APP_OPEN.value,
)

LATE_TOOL_BRANCH_ORDER: Final[tuple[str, ...]] = (
    "file_create",
    OrchestrationBranch.FILE_RENAME.value,
    OrchestrationBranch.FILE_DELETE.value,
    OrchestrationBranch.DOC_INSERT.value,
)


PhaseResult = dict[str, Any] | None
PhaseHandler = Callable[[], PhaseResult | Awaitable[PhaseResult]]


@dataclass(frozen=True, slots=True)
class PreToolPhaseHandlers:
    """Coroutine hooks for the pre-tool segment (order = ``PRE_TOOL_BRANCHES``)."""

    resume_pending_task: PhaseHandler
    agentic_session: PhaseHandler
    resume_completed_music_generation: PhaseHandler
    resume_completed_presentation: PhaseHandler
    output_surface: PhaseHandler
    check_task_status: PhaseHandler
    active_operations_status: PhaseHandler
    turn_plan_resume: PhaseHandler
    action_workflow: PhaseHandler
    workflow: PhaseHandler
    workflow_reflect_week: PhaseHandler


@dataclass(frozen=True, slots=True)
class DeferMemoryPhaseHandlers:
    compound_file_chain: PhaseHandler
    file_study_compose: PhaseHandler
    file_focus_chat: PhaseHandler


async def run_pre_tool_phase(handlers: PreToolPhaseHandlers) -> tuple[PhaseResult, str | None]:
    """Execute pre-tool hooks in canonical order; return first non-None response."""

    ordered: tuple[tuple[OrchestrationBranch, PhaseHandler], ...] = (
        (OrchestrationBranch.RESUME_PENDING_TASK, handlers.resume_pending_task),
        (OrchestrationBranch.AGENTIC_SESSION, handlers.agentic_session),
        (OrchestrationBranch.RESUME_COMPLETED_MUSIC_GENERATION, handlers.resume_completed_music_generation),
        (OrchestrationBranch.RESUME_COMPLETED_PRESENTATION, handlers.resume_completed_presentation),
        (OrchestrationBranch.OUTPUT_SURFACE, handlers.output_surface),
        (OrchestrationBranch.CHECK_TASK_STATUS, handlers.check_task_status),
        (OrchestrationBranch.ACTIVE_OPERATIONS_STATUS, handlers.active_operations_status),
        (OrchestrationBranch.TURN_PLAN_RESUME, handlers.turn_plan_resume),
        (OrchestrationBranch.ACTION_WORKFLOW, handlers.action_workflow),
        (OrchestrationBranch.WORKFLOW, handlers.workflow),
        (OrchestrationBranch.WORKFLOW_REFLECT_WEEK, handlers.workflow_reflect_week),
    )
    for branch, handler in ordered:
        maybe_out = handler()
        out = await maybe_out if inspect.isawaitable(maybe_out) else maybe_out
        if out is not None:
            return out, branch.value
    return None, None


async def run_defer_memory_phase(handlers: DeferMemoryPhaseHandlers) -> tuple[PhaseResult, str | None]:
    """Compound / file-study / file-focus branches before early tool probes."""

    ordered: tuple[tuple[OrchestrationBranch, PhaseHandler], ...] = (
        (OrchestrationBranch.COMPOUND_FILE_CHAIN, handlers.compound_file_chain),
        (OrchestrationBranch.FILE_STUDY_COMPOSE, handlers.file_study_compose),
        (OrchestrationBranch.FILE_FOCUS_CHAT, handlers.file_focus_chat),
    )
    for branch, handler in ordered:
        out = await handler()
        if out is not None:
            return out, branch.value
    return None, None


async def run_early_tool_branch_loop(
    *,
    user_line: str,
    profile: Mapping[str, Any] | None,
    principal_id: str,
    may_probe: Callable[..., bool],
    run_tool_branch: Callable[[str], Awaitable[PhaseResult]],
) -> tuple[PhaseResult, str | None]:
    """Gated early registry probes (``EARLY_TOOL_BRANCH_ORDER``)."""

    early_skipped: list[str] = []
    for branch_name in EARLY_TOOL_BRANCH_ORDER:
        try:
            should_probe = may_probe(branch_name, user_line, profile, principal_id=principal_id)
        except TypeError:
            # Backward-compatible adapter for legacy call sites/tests that still pass a positional 4th argument.
            should_probe = may_probe(branch_name, user_line, profile, principal_id)
        if not should_probe:
            early_skipped.append(branch_name)
            continue
        short_circuit_response = await run_tool_branch(branch_name)
        if short_circuit_response is not None:
            branch = str(short_circuit_response.get("orchestration_branch") or branch_name).strip() or branch_name
            return short_circuit_response, branch
    if early_skipped:
        logger.info(
            "[STEP] companion_orchestration_probes_skipped phase=early count=%d branches=%s",
            len(early_skipped),
            ",".join(early_skipped[:8]) + ("…" if len(early_skipped) > 8 else ""),
        )
    return None, None


async def run_late_tool_branch_loop(
    *,
    user_line: str,
    may_match_late: Callable[[str], bool],
    run_tool_branch: Callable[[str], Awaitable[PhaseResult]],
) -> tuple[PhaseResult, str | None]:
    """Late file-op probes when ``may_match_late`` is true."""

    if not may_match_late(user_line):
        logger.info(
            "[STEP] companion_orchestration_probes_skipped phase=late_file_ops branches=%s",
            ",".join(LATE_TOOL_BRANCH_ORDER),
        )
        return None, None

    for branch_name in LATE_TOOL_BRANCH_ORDER:
        short_circuit_response = await run_tool_branch(branch_name)
        if short_circuit_response is not None:
            branch = str(short_circuit_response.get("orchestration_branch") or branch_name).strip() or branch_name
            return short_circuit_response, branch
    return None, None


def companion_early_tool_branch_policy_order() -> tuple[str, ...]:
    """Return early tool probe names aligned with ``ORCHESTRATION_PIPELINE_ORDER``."""

    return tuple(
        _RUNTIME_BRANCH_ALIASES.get(name, name)
        for name in EARLY_TOOL_BRANCH_ORDER
        if name != OrchestrationBranch.CHECK_TASK_STATUS.value
    )


def orchestration_pipeline_order() -> tuple[OrchestrationBranch, ...]:
    """Return the canonical branch order."""

    return ORCHESTRATION_PIPELINE_ORDER


__all__ = (
    "DEFER_MEMORY_BRANCHES",
    "DeferMemoryPhaseHandlers",
    "EARLY_TOOL_BRANCH_ORDER",
    "LATE_TOOL_BRANCH_ORDER",
    "ORCHESTRATION_PIPELINE_ORDER",
    "PRE_TOOL_BRANCHES",
    "OrchestrationBranch",
    "PreToolPhaseHandlers",
    "companion_early_tool_branch_policy_order",
    "orchestration_pipeline_order",
    "run_defer_memory_phase",
    "run_early_tool_branch_loop",
    "run_late_tool_branch_loop",
    "run_pre_tool_phase",
)
