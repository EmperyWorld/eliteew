# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Apply Think plan/replan mutations to the task tree and session FSM (K4 extract from loop).
# Invariants:
# - Empty plan while planning|replanning|executing bumps the replanning circuit (death-spiral class).
# - Scheduler ON after plan_ready / plan_patch_applied → scheduler_handoff (no inline Act).
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K4
# ---

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable, Mapping
from typing import Any

import asyncpg

from api.ewa_platform.agentic.config import agentic_max_tree_nodes, agentic_step_scheduler_enabled
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.fsm_port import think_to_transition_event
from api.ewa_platform.agentic.kernel.plan_tool_args_prepare import prepare_plan_node_tool_args
from api.ewa_platform.agentic.kernel.think_schema import AgenticPlanNode, AgenticThinkOutput
from api.ewa_platform.agentic.kernel.tool_args_enrich import goal_text_from_session
from api.ewa_platform.agentic.kernel.types import LoopTickResult, TransitionResult
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

logger = logging.getLogger(__name__)

FsmPortApplyFn = Callable[..., Awaitable[TransitionResult]]
RecordReplanningGuardFn = Callable[..., Awaitable[LoopTickResult | None]]
ThinkActionToDecisionFn = Callable[[str], str]


def plan_node_field(raw: Any, key: str, default: Any = None) -> Any:
    if isinstance(raw, Mapping):
        return raw.get(key, default)
    if isinstance(raw, AgenticPlanNode):
        return getattr(raw, key, default)
    return getattr(raw, key, default)


async def apply_plan_nodes(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    nodes: list[Any],
    user_line: str,
    session: Mapping[str, Any] | None = None,
) -> None:
    count = await agentic_pg.agentic_task_tree_count(pool, session_id=session_id)
    file_create_indices = [
        i
        for i, raw in enumerate(nodes)
        if str(plan_node_field(raw, "tool_name") or "").strip() == "file_create"
        or (
            not str(plan_node_field(raw, "tool_name") or "").strip()
            and str(plan_node_field(raw, "node_kind") or "") == "file_create"
        )
    ]
    multi_doc_mission = len(file_create_indices) >= 2
    for idx, raw in enumerate(nodes):
        if count >= agentic_max_tree_nodes():
            break
        title = str(plan_node_field(raw, "title") or f"Step {count + 1}")
        node_kind = str(plan_node_field(raw, "node_kind") or "subtask")
        instruction = str(plan_node_field(raw, "instruction") or "")[:8000]
        tool_name = plan_node_field(raw, "tool_name")
        tool_str = str(tool_name or "").strip() or None
        if not tool_str and node_kind == "expert_chat":
            tool_str = "call_expert_chat"
        elif not tool_str and node_kind == "block_append":
            tool_str = "doc_append_block"
        raw_args = dict(plan_node_field(raw, "tool_args") or {})
        insert_status = "pending"
        metadata: dict[str, Any] | None = None
        if tool_str:
            mission_folder_role = None
            if tool_str == "file_create" and multi_doc_mission and idx in file_create_indices:
                # Same folder_name + create_folder for every sibling: folder resolve is
                # idempotent by label/task_key; avoids reuse-before-create races.
                mission_folder_role = "create"
            raw_args = prepare_plan_node_tool_args(
                tool_str,
                raw_args,
                user_line=user_line,
                instruction=instruction,
                title=title,
                session=session,
                mission_folder_role=mission_folder_role,
            )
        else:
            insert_status = "completed"
            metadata = {"auto_skipped": True, "reason": "plan_node_without_tool"}
        await agentic_pg.agentic_task_tree_insert(
            pool,
            session_id=session_id,
            node_kind=node_kind[:32],
            title=title,
            instruction=instruction,
            tool_name=tool_str,
            tool_args_json=raw_args,
            materialized_path=f"/{count + idx + 1}/",
            sort_order=count + idx,
            status=insert_status,
            metadata_json=metadata,
        )
        count += 1


async def process_plan_action(
    pool: asyncpg.Pool,
    *,
    think_out: AgenticThinkOutput,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    iterations: int,
    fsm_port_apply: FsmPortApplyFn,
    record_replanning_guard: RecordReplanningGuardFn,
    think_action_to_decision_type: ThinkActionToDecisionFn,
) -> LoopTickResult | None:
    """Handle Think action=plan|replan. Returns None to continue the inner loop."""

    action = think_out.action
    plan_nodes = think_out.plan_nodes
    if plan_nodes:
        await apply_plan_nodes(
            pool,
            session_id=session_id,
            nodes=plan_nodes,
            user_line=goal_text_from_session(session),
            session=session,
        )
    patch = think_out.plan_summary_patch
    cur_status = str(session.get("status") or "")
    if cur_status == fsm.STATUS_PLANNING:
        if not plan_nodes:
            logger.info("[STEP] agentic_empty_plan session_id=%s status=planning", session_id)
            await agentic_pg.agentic_checkpoint_append(
                pool,
                session_id=session_id,
                kind="error",
                payload_json={"summary": "empty_plan_emitted", "event": "empty_plan"},
            )
            tick = await record_replanning_guard(
                pool,
                session=session,
                session_id=session_id,
                principal_id=principal_id,
                reason="empty_plan_emitted",
                iterations=iterations,
            )
            if tick is not None:
                return tick
            return None
        plan_event = (
            think_to_transition_event(
                current_status=cur_status,
                decision_type=think_action_to_decision_type(action),
                loop_action=action,
                has_plan_nodes=True,
            )
            or "plan_ready"
        )
        tr = await fsm_port_apply(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            expected_revision=int(session["session_revision"]),
            correlation_id=f"think-plan-{session_id}-{int(session['session_revision'])}",
            event=plan_event,
            plan_summary=patch,
        )
        if not tr.ok or tr.session is None:
            return LoopTickResult(
                ok=False,
                reason=tr.reason or "plan_ready_failed",
                iterations_ran=iterations,
            )
        if agentic_step_scheduler_enabled():
            return LoopTickResult(
                ok=True,
                session=tr.session,
                continue_loop=True,
                reason="scheduler_handoff",
                iterations_ran=iterations,
            )
    elif cur_status == fsm.STATUS_REPLANNING:
        if not plan_nodes:
            logger.info("[STEP] agentic_empty_plan session_id=%s status=replanning", session_id)
            await agentic_pg.agentic_checkpoint_append(
                pool,
                session_id=session_id,
                kind="error",
                payload_json={"summary": "empty_plan_patch", "event": "empty_plan"},
            )
            tick = await record_replanning_guard(
                pool,
                session=session,
                session_id=session_id,
                principal_id=principal_id,
                reason="empty_plan_patch",
                iterations=iterations,
            )
            if tick is not None:
                return tick
            return None
        plan_event = (
            think_to_transition_event(
                current_status=cur_status,
                decision_type=think_action_to_decision_type(action),
                loop_action=action,
                has_plan_nodes=True,
            )
            or "plan_patch_applied"
        )
        tr = await fsm_port_apply(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            expected_revision=int(session["session_revision"]),
            correlation_id=f"think-replan-{session_id}-{int(session['session_revision'])}",
            event=plan_event,
            plan_summary=patch,
        )
        if not tr.ok or tr.session is None:
            return LoopTickResult(
                ok=False,
                reason=tr.reason or "plan_patch_failed",
                iterations_ran=iterations,
            )
        if agentic_step_scheduler_enabled():
            return LoopTickResult(
                ok=True,
                session=tr.session,
                continue_loop=True,
                reason="scheduler_handoff",
                iterations_ran=iterations,
            )
    elif cur_status == fsm.STATUS_EXECUTING and not plan_nodes:
        logger.info("[STEP] agentic_empty_plan session_id=%s status=executing", session_id)
        await agentic_pg.agentic_checkpoint_append(
            pool,
            session_id=session_id,
            kind="error",
            payload_json={"summary": "empty_plan_while_executing", "event": "empty_plan"},
        )
        tick = await record_replanning_guard(
            pool,
            session=session,
            session_id=session_id,
            principal_id=principal_id,
            reason="empty_plan_while_executing",
            iterations=iterations,
        )
        if tick is not None:
            return tick
        return None
    elif patch:
        updated = await agentic_pg.agentic_session_update(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            plan_summary=patch,
            expect_revision=int(session["session_revision"]),
        )
        if updated is None:
            return LoopTickResult(ok=False, reason="revision_conflict", iterations_ran=iterations)
    return None
