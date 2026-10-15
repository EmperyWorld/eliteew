# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Kernel-owned inline Act pipeline (bind → policy → HITL → dispatch → checkpoint → FSM).
# Used by the loop when EWA_AGENTIC_STEP_SCHEDULER_ENABLED is off; scheduler-owned Act
# lives in jobs/step_executor (calls in, not the reverse).
# Invariants:
# - Does not import jobs/ (avoid circular imports).
# - Scheduler-on path must not call this module for Think action=act (loop handoff only).
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K3
# ---

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable, Mapping
from datetime import UTC, datetime
from typing import Any

import asyncpg

from api.ewa_platform.agentic.adapters.task_run_events import publish_agentic_session_lifecycle_sync
from api.ewa_platform.agentic.adapters.tool_context import build_agentic_tool_context
from api.ewa_platform.agentic.auto_accept_hitl import ARGS_FLAG, resolve_auto_accept_hitl
from api.ewa_platform.agentic.config import agentic_condense_every_n
from api.ewa_platform.agentic.context.condense_orchestrator import maybe_run_condense
from api.ewa_platform.agentic.context.memory_tiers import (
    push_act_summary,
    sync_active_instruction_from_nodes,
)
from api.ewa_platform.agentic.driver.ewa_agentic_driver import EwaAgenticDriver
from api.ewa_platform.agentic.driver.tick_integration import (
    act_error_is_version_conflict,
    observe_after_act,
    policy_gate_before_act,
)
from api.ewa_platform.agentic.gate_contract import build_gate_json
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.act_binding_policy import loop_act_binding_verdict
from api.ewa_platform.agentic.kernel.circuit_breaker import (
    REASONING_LOOP_DETECTED,
    working_memory_from_session,
)
from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput
from api.ewa_platform.agentic.kernel.tool_args_enrich import goal_text_from_session
from api.ewa_platform.agentic.kernel.tool_args_validate import validate_tool_args_for_registry
from api.ewa_platform.agentic.kernel.tree_scheduler import mark_node_running, resolve_act_binding
from api.ewa_platform.agentic.kernel.types import (
    AgenticContext,
    AgenticLoopError,
    LoopTickResult,
)
from api.ewa_platform.agentic.tools.bridge import agentic_dispatch_tool
from api.ewa_platform.agentic.tools.profiles import require_hitl_for_tool
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

logger = logging.getLogger(__name__)

RecordReplanningGuardFn = Callable[..., Awaitable[LoopTickResult | None]]
FsmPortApplyFn = Callable[..., Awaitable[Any]]
ThinkActionToDecisionFn = Callable[[str], str]


async def scheduler_handoff_for_act(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    iterations: int,
    action: str,
    fsm_port_apply: FsmPortApplyFn,
    think_action_to_decision_type: ThinkActionToDecisionFn,
    think_to_transition_event: Callable[..., str | None],
) -> LoopTickResult:
    """K3: Think action=act with scheduler ON — no inline tool dispatch."""

    from api.ewa_platform.agentic.adapters.task_run_events import publish_agentic_session_lifecycle_sync

    status = str(session.get("status") or "")
    session_out = dict(session)
    if status != fsm.STATUS_EXECUTING:
        act_event = (
            think_to_transition_event(
                current_status=status,
                decision_type=think_action_to_decision_type(action),
                loop_action=action,
            )
            or "act_authorized"
        )
        if status == fsm.STATUS_PLANNING:
            act_event = "plan_ready"
        elif status == fsm.STATUS_REPLANNING:
            act_event = "plan_patch_applied"
        tr = await fsm_port_apply(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            expected_revision=int(session["session_revision"]),
            correlation_id=f"think-act-handoff-{session_id}-{int(session['session_revision'])}",
            event=act_event,
            plan_summary=str(session.get("plan_summary") or "").strip() or None,
        )
        if not tr.ok or tr.session is None:
            logger.info(
                "[STEP] agentic_act_scheduler_handoff_no_transition session_id=%s status=%s event=%s reason=%s",
                session_id,
                status,
                act_event,
                tr.reason,
            )
            return LoopTickResult(
                ok=True,
                session=session_out,
                continue_loop=True,
                reason="scheduler_handoff",
                iterations_ran=iterations,
            )
        session_out = tr.session
        publish_agentic_session_lifecycle_sync(session_out)
    logger.info(
        "[STEP] agentic_act_scheduler_handoff session_id=%s status=%s",
        session_id,
        str(session_out.get("status") or ""),
    )
    return LoopTickResult(
        ok=True,
        session=session_out,
        continue_loop=True,
        reason="scheduler_handoff",
        iterations_ran=iterations,
    )


def _checkpoint_id(row: dict[str, Any] | None) -> str | None:
    if row is None:
        return None
    raw_id = row.get("id")
    return str(raw_id) if raw_id is not None else None


def tree_is_empty(ctx: AgenticContext | None) -> bool:
    if ctx is None:
        return True
    return sum(int(v) for v in ctx.tree_summary.values()) == 0


async def execute_inline_act(
    pool: asyncpg.Pool,
    *,
    think_out: AgenticThinkOutput,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    tool_ctx: ToolContext | None,
    iterations: int,
    ctx: AgenticContext | None,
    active_nodes: list[Mapping[str, Any]] | None,
    record_replanning_guard: RecordReplanningGuardFn,
) -> LoopTickResult | None:
    """Run the full Think→Act side-effect path (scheduler-off / legacy tick).

    Returns ``None`` to continue the inner loop after a successful act.
    """

    status = str(session.get("status") or "")
    goal_line = goal_text_from_session(session)
    tctx = tool_ctx or await build_agentic_tool_context(
        pool,
        session=session,
        principal_id=principal_id,
    )
    scheduled = ctx.scheduled_node if ctx is not None else None
    act_node_id, tool_name, args = resolve_act_binding(
        think_out.act_node_id,
        think_out.act_tool_name,
        dict(think_out.act_tool_args or {}),
        scheduled,
    )
    if not tool_name:
        raise AgenticLoopError("act_tool_name_missing")

    allowed, bind_reason = loop_act_binding_verdict(
        act_node_id=act_node_id,
        tool_name=tool_name,
        ctx=ctx,
        think_act_node_id=think_out.act_node_id,
        tool_args=dict(think_out.act_tool_args or {}),
    )
    if not allowed:
        logger.info(
            "[STEP] agentic_act_binding_reject session_id=%s tool=%s reason=%s node_id=%s",
            session_id,
            tool_name,
            bind_reason,
            act_node_id or "",
        )
        await agentic_pg.agentic_checkpoint_append(
            pool,
            session_id=session_id,
            kind="error",
            node_id=act_node_id,
            payload_json={
                "summary": bind_reason,
                "event": "act_binding_rejected",
                "tool": tool_name,
                "node_id": act_node_id,
            },
        )
        tick = await record_replanning_guard(
            pool,
            session=session,
            session_id=session_id,
            principal_id=principal_id,
            reason=bind_reason,
            iterations=iterations,
        )
        if tick is not None:
            return tick
        return None

    if status == fsm.STATUS_REPLANNING and tree_is_empty(ctx):
        logger.info(
            "[STEP] agentic_act_without_plan_tree session_id=%s tool=%s",
            session_id,
            tool_name,
        )
        await agentic_pg.agentic_checkpoint_append(
            pool,
            session_id=session_id,
            kind="error",
            payload_json={
                "summary": "act_without_plan_tree",
                "event": "act_without_plan_tree",
                "tool": tool_name,
            },
        )
        tick = await record_replanning_guard(
            pool,
            session=session,
            session_id=session_id,
            principal_id=principal_id,
            reason="act_without_plan_tree",
            iterations=iterations,
        )
        if tick is not None:
            return tick
        return None

    policy_raw = session.get("policy_json")
    policy = policy_raw if isinstance(policy_raw, Mapping) else {}
    driver = EwaAgenticDriver(pool)
    driver_snapshot = await driver.read(session=session, ctx=ctx)
    policy_allowed, session_override = await policy_gate_before_act(
        pool,
        session=session,
        snapshot=driver_snapshot,
        session_id=session_id,
        principal_id=principal_id,
        tool_name=tool_name,
        tool_args=args,
        act_node_id=act_node_id,
        iterations=iterations,
    )
    if session_override is not None:
        return LoopTickResult(
            ok=True,
            session=session_override,
            continue_loop=False,
            iterations_ran=iterations,
        )
    if not policy_allowed:
        return LoopTickResult(ok=False, reason="policy_denied", iterations_ran=iterations)
    if require_hitl_for_tool(policy, tool_name):
        rev = int(session["session_revision"])
        gate_payload = build_gate_json(
            kind="confirm",
            prompt=f"Подтвердите выполнение инструмента «{tool_name}».",
            session_revision=rev,
            bound_node_id=act_node_id,
            ttl_hours=48.0,
        )
        tr = await fsm.apply_session_transition(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            event="gate_required",
            expect_revision=rev,
            gate_json=gate_payload,
        )
        session_out = tr.session or dict(session)
        publish_agentic_session_lifecycle_sync(session_out)
        return LoopTickResult(ok=True, session=session_out, continue_loop=False, iterations_ran=iterations)

    if act_node_id:
        await mark_node_running(pool, session_id=session_id, node_id=act_node_id)

    node_instruction = str(scheduled.get("instruction") or "") if scheduled else None
    try:
        args = validate_tool_args_for_registry(
            tool_name,
            args,
            user_line=goal_line,
            node_instruction=node_instruction,
            session=session,
        )
    except ValueError as exc:
        _, session_after = await agentic_pg.agentic_record_replanning_atomic(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            expect_revision=int(session["session_revision"]),
            reason=f"tool_args_invalid:{exc}",
        )
        if session_after is None:
            return LoopTickResult(ok=False, reason="revision_conflict", iterations_ran=iterations)
        if str(session_after.get("status")) == fsm.STATUS_AWAITING_HUMAN:
            return LoopTickResult(
                ok=True,
                session=session_after,
                continue_loop=False,
                reason=REASONING_LOOP_DETECTED,
                iterations_ran=iterations,
            )
        return None

    args["_agentic_session_id"] = session_id
    if await resolve_auto_accept_hitl(
        pool,
        principal_id=principal_id,
        policy_json=session.get("policy_json") if isinstance(session.get("policy_json"), Mapping) else None,
        profile=(tctx.profile if tctx is not None and isinstance(getattr(tctx, "profile", None), Mapping) else None),
    ):
        args[ARGS_FLAG] = True
    act_started = datetime.now(tz=UTC)
    act = await agentic_dispatch_tool(tool_name, args, tctx, session=session)
    duration_ms = int((datetime.now(tz=UTC) - act_started).total_seconds() * 1000)
    from api.ewa_platform.agentic.tools.bridge import extract_created_content_from_act_raw

    created_id, created_name = extract_created_content_from_act_raw(act.raw if isinstance(act.raw, Mapping) else None)
    from api.ewa_platform.agentic.kernel.visible_text import (
        laconic_agentic_act_summary,
        sanitize_agentic_visible_text,
    )

    act_summary = laconic_agentic_act_summary(str(act.summary or ""))
    act_payload: dict[str, Any] = {
        "summary": act_summary,
        "status": act.status,
        "tool": tool_name,
        "node_id": act_node_id,
        "duration_ms": duration_ms,
    }
    if created_id:
        act_payload["unified_content_id"] = created_id
        act_payload["created_unified_content_id"] = created_id
        if created_name:
            act_payload["document_name"] = created_name
    checkpoint_row = await agentic_pg.agentic_checkpoint_append(
        pool,
        session_id=session_id,
        kind="act",
        node_id=act_node_id,
        payload_json=act_payload,
    )
    ref = _checkpoint_id(checkpoint_row)
    checkpoint_seq = int(checkpoint_row["seq"]) if checkpoint_row and checkpoint_row.get("seq") is not None else None
    if act.status == "needs_confirm":
        if not act_node_id:
            logger.error(
                "[STEP] agentic_hitl_unbound_gate session_id=%s tool=%s",
                session_id,
                tool_name,
            )
            await agentic_pg.agentic_checkpoint_append(
                pool,
                session_id=session_id,
                kind="error",
                payload_json={
                    "summary": "companion_hitl_requires_tree_node",
                    "event": "hitl_unbound_gate",
                    "tool": tool_name,
                },
            )
            tick = await record_replanning_guard(
                pool,
                session=session,
                session_id=session_id,
                principal_id=principal_id,
                reason="companion_hitl_requires_tree_node",
                iterations=iterations,
            )
            if tick is not None:
                return tick
            return None
        rev = int(session["session_revision"])
        from api.ewa_platform.agentic.auto_accept_hitl import try_auto_finalize_needs_confirm
        from api.ewa_platform.agentic.hitl_companion_finalize import companion_pending_task_run_id_from_act_raw

        gate_payload = build_gate_json(
            kind="confirm",
            prompt=act_summary,
            session_revision=rev,
            bound_node_id=act_node_id,
            bound_checkpoint_seq=checkpoint_seq,
            companion_pending_task_run_id=companion_pending_task_run_id_from_act_raw(act.raw),
            pending_tool=tool_name,
            ttl_hours=48.0,
        )
        auto_out = await try_auto_finalize_needs_confirm(
            pool,
            session=session,
            principal_id=principal_id,
            gate_payload=gate_payload,
            act_node_id=act_node_id,
        )
        if auto_out is not None:
            policy_patch = auto_out.get("policy_json")
            if isinstance(policy_patch, dict):
                patched = await agentic_pg.agentic_session_update(
                    pool,
                    session_id=session_id,
                    principal_id=principal_id,
                    policy_json=policy_patch,
                    expect_revision=rev,
                )
                if patched is not None:
                    session = patched
            from api.ewa_platform.agentic.kernel.types import AgenticActResult

            act = AgenticActResult(
                status="ok",
                summary=act_summary[:4000],
                full_ref=act.full_ref,
                tool_name=act.tool_name or tool_name,
                raw=dict(act.raw or {}),
            )
        else:
            if act_node_id:
                await agentic_pg.agentic_task_tree_update(
                    pool,
                    node_id=act_node_id,
                    session_id=session_id,
                    status=fsm.STATUS_AWAITING_HUMAN,
                    result_ref=ref,
                    result_summary=act_summary[:4000],
                    gate_json=gate_payload,
                )
            tr = await fsm.apply_session_transition(
                pool,
                session_id=session_id,
                principal_id=principal_id,
                event="gate_required",
                expect_revision=rev,
                gate_json=gate_payload,
            )
            session_out = tr.session or dict(session)
            publish_agentic_session_lifecycle_sync(session_out)
            return LoopTickResult(ok=True, session=session_out, continue_loop=False, iterations_ran=iterations)
    if act.status == "continue":
        raw_act = act.raw if isinstance(act.raw, Mapping) else {}
        data_raw = raw_act.get("data")
        data_map: Mapping[str, Any] = data_raw if isinstance(data_raw, Mapping) else {}
        draft = data_map.get("doc_create_draft_v1")
        wm = working_memory_from_session(session)
        if isinstance(draft, Mapping):
            wm["doc_create_draft_v1"] = dict(draft)
        refreshed_wm = await agentic_pg.agentic_session_update(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            working_memory_json=wm,
            expect_revision=None,
        )
        if refreshed_wm is not None:
            session = refreshed_wm
        if act_node_id:
            await agentic_pg.agentic_task_tree_schedule_continue(
                pool,
                node_id=act_node_id,
                session_id=session_id,
                reason="compose_continue",
                retry_delay_sec=2,
            )
        logger.info(
            "[STEP] agentic_loop_compose_continue session_id=%s node_id=%s tool=%s",
            session_id,
            act_node_id or "",
            tool_name,
        )
        return LoopTickResult(
            ok=True,
            session=session,
            continue_loop=True,
            reason="compose_continue",
            iterations_ran=iterations,
        )
    if act_node_id:
        node_status = "awaiting_child" if act.status == "accepted" else "completed" if act.status == "ok" else "failed"
        meta = None
        if act.status == "accepted":
            from api.ewa_platform.agentic.jobs.child_reconcile import (
                child_run_id_from_act_raw,
                metadata_with_child_run_bind,
            )

            tree_nodes = await agentic_pg.agentic_task_tree_list(pool, session_id=session_id, statuses=None)
            bound_node = next(
                (n for n in tree_nodes if str(n.get("id") or "") == act_node_id),
                {"id": act_node_id, "metadata_json": {}},
            )
            meta = metadata_with_child_run_bind(
                bound_node,
                child_run_id=child_run_id_from_act_raw(act.raw),
                tool_name=tool_name,
            )
        await agentic_pg.agentic_task_tree_update(
            pool,
            node_id=act_node_id,
            session_id=session_id,
            status=node_status,
            result_ref=ref,
            result_summary=act_summary[:4000],
            metadata_json=meta,
            mark_completed=act.status == "ok",
        )
    if act.status == "accepted":
        return LoopTickResult(
            ok=True,
            session=session,
            continue_loop=False,
            reason="awaiting_child",
            iterations_ran=iterations,
        )
    if act.status in {"error", "unhandled", "denied"}:
        if act_error_is_version_conflict(act):
            logger.info(
                "[STEP] agentic_version_conflict_replan session_id=%s tool=%s",
                session_id,
                tool_name,
            )
            _, session_after = await agentic_pg.agentic_record_replanning_atomic(
                pool,
                session_id=session_id,
                principal_id=principal_id,
                expect_revision=int(session["session_revision"]),
                reason="content_version_conflict",
            )
            if session_after is None:
                return LoopTickResult(ok=False, reason="revision_conflict", iterations_ran=iterations)
            return LoopTickResult(
                ok=True,
                session=session_after,
                continue_loop=True,
                reason="content_version_conflict",
                iterations_ran=iterations,
            )
        _, session_after = await agentic_pg.agentic_record_replanning_atomic(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            expect_revision=int(session["session_revision"]),
            reason=f"tool_act_error:{act_summary[:200]}",
        )
        if session_after is None:
            return LoopTickResult(ok=False, reason="revision_conflict", iterations_ran=iterations)
        if str(session_after.get("status")) == fsm.STATUS_AWAITING_HUMAN:
            return LoopTickResult(
                ok=True,
                session=session_after,
                continue_loop=False,
                reason=REASONING_LOOP_DETECTED,
                iterations_ran=iterations,
            )
        return None

    if act.status == "ok" and created_id:
        from api.ewa_platform.agentic.policy_content_bind import policy_json_with_created_content

        policy_bound = policy_json_with_created_content(
            session.get("policy_json") if isinstance(session.get("policy_json"), Mapping) else None,
            created_content_id=created_id,
        )
        patched_policy = await agentic_pg.agentic_session_update(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            policy_json=policy_bound,
            expect_revision=int(session["session_revision"]),
        )
        if patched_policy is not None:
            session = patched_policy
            logger.info(
                "[STEP] agentic_policy_content_bound session_id=%s unified_content_id=%s",
                session_id,
                created_id[:48],
            )

    session = await observe_after_act(
        pool,
        session=session,
        ctx=ctx,
        principal_id=principal_id,
        act_tool=tool_name,
        act_summary=act_summary,
    )

    wm = working_memory_from_session(session)
    wm = agentic_pg.working_memory_after_successful_act(wm)
    wm = push_act_summary(
        wm,
        tool_name=tool_name,
        status=act.status,
        summary=act_summary,
        node_id=act_node_id,
    )
    if tool_name == "call_expert_chat" and act.status == "ok":
        raw_act = act.raw if isinstance(act.raw, Mapping) else {}
        expert_data_raw = raw_act.get("data")
        expert_data: Mapping[str, Any] = expert_data_raw if isinstance(expert_data_raw, Mapping) else {}
        blob = sanitize_agentic_visible_text(
            str(expert_data.get("output_text") or "").strip()
            or act_summary
            or str(expert_data.get("output_preview") or "").strip()
        )
        if blob:
            wm["last_expert_research_text"] = blob[:24_000]
            wm["awaiting_expert_consultation"] = False
    if tool_name == "catalog_list" and act.status == "ok":
        raw_act = act.raw if isinstance(act.raw, Mapping) else {}
        catalog_data_raw = raw_act.get("data")
        catalog_data: Mapping[str, Any] = catalog_data_raw if isinstance(catalog_data_raw, Mapping) else {}
        hits_raw = catalog_data.get("catalog_hits")
        if isinstance(hits_raw, list) and hits_raw:
            compact: list[dict[str, str]] = []
            for item in hits_raw[:10]:
                if not isinstance(item, Mapping):
                    continue
                uid = str(item.get("unified_content_id") or item.get("id") or "").strip()
                if not uid:
                    continue
                compact.append(
                    {
                        "unified_content_id": uid,
                        "name": str(item.get("name") or "").strip()[:200],
                    }
                )
            if compact:
                wm["last_catalog_hits"] = compact
    if active_nodes:
        wm = sync_active_instruction_from_nodes(wm, active_nodes)

    tr = await fsm.apply_session_transition(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        event="step_ok_more",
        expect_revision=int(session["session_revision"]),
        extra_fields={
            "iteration_count": int(session.get("iteration_count") or 0) + 1,
            "working_memory_json": wm,
        },
    )
    session_out = tr.session or dict(session)
    ic = int(session_out.get("iteration_count") or 0)
    if ic > 0 and ic % agentic_condense_every_n() == 0:
        session_out = await maybe_run_condense(
            pool,
            session=session_out,
            session_id=session_id,
            principal_id=principal_id,
            trigger="iteration",
        )
    return None
