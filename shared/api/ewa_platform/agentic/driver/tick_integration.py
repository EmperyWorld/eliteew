# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Driver READ/OBSERVE hooks for agentic loop ticks (AMKA-style lifecycle).
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.agentic.driver.ewa_agentic_driver import EwaAgenticDriver
from api.ewa_platform.agentic.driver.protocol import AgenticDriverSnapshot, AgenticPolicyDecisionKind
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.state_machine import (
    AgenticLifecyclePhase,
    expert_consultation_gate_json,
    lifecycle_phase_from_session,
)
from api.ewa_platform.agentic.kernel.types import AgenticContext
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

logger = logging.getLogger(__name__)


async def persist_driver_read_snapshot(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    ctx: AgenticContext | None,
    principal_id: str,
) -> tuple[AgenticDriverSnapshot, dict[str, Any]]:
    driver = EwaAgenticDriver(pool)
    snapshot = await driver.read(session=session, ctx=ctx)
    phase = lifecycle_phase_from_session(session)
    wm_raw = session.get("working_memory_json")
    wm = dict(wm_raw) if isinstance(wm_raw, Mapping) else {}
    wm.update(snapshot.to_working_memory_patch())
    wm["lifecycle_phase"] = phase.value
    if snapshot.unified_content_id and snapshot.content_version is not None:
        wm["unified_content_version"] = snapshot.content_version
    updated = await agentic_pg.agentic_session_update(
        pool,
        session_id=str(session.get("id") or ""),
        principal_id=principal_id,
        working_memory_json=wm,
        expect_revision=int(session.get("session_revision") or 0),
    )
    session_out = updated or dict(session)
    logger.info(
        "[STEP] agentic_lifecycle_read session_id=%s phase=%s blocks=%s content_version=%s",
        snapshot.session_id,
        phase.value,
        len(snapshot.content_blocks),
        snapshot.content_version,
    )
    return snapshot, session_out


async def policy_gate_before_act(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    snapshot: AgenticDriverSnapshot,
    session_id: str,
    principal_id: str,
    tool_name: str,
    tool_args: Mapping[str, Any],
    act_node_id: str | None,
    iterations: int,
) -> tuple[bool, dict[str, Any] | None]:
    """Return (allowed, session_override). session_override set when tick must stop."""
    from api.ewa_platform.agentic.adapters.task_run_events import publish_agentic_session_lifecycle_sync
    from api.ewa_platform.agentic.kernel.types import LoopTickResult

    driver = EwaAgenticDriver(pool)
    decision = await driver.policy(
        session=session,
        snapshot=snapshot,
        tool_name=tool_name,
        tool_args=tool_args,
    )
    if decision.allowed:
        return True, None
    if decision.kind == AgenticPolicyDecisionKind.REQUIRE_HITL:
        return True, None
    if decision.kind == AgenticPolicyDecisionKind.DENY:
        rev = int(session["session_revision"])
        gate_payload = expert_consultation_gate_json(
            session_revision=rev,
            prompt=f"Действие «{tool_name}» запрещено политикой: {decision.reason}",
        )
        tr = await fsm.apply_session_transition(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            event="expert_consultation_required",
            expect_revision=rev,
            gate_json=gate_payload,
        )
        session_out = tr.session or dict(session)
        publish_agentic_session_lifecycle_sync(session_out)
        _ = LoopTickResult
        _ = act_node_id
        _ = iterations
        return False, session_out
    return False, None


async def observe_after_act(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    ctx: AgenticContext | None,
    principal_id: str,
    act_tool: str | None,
    act_summary: str,
) -> dict[str, Any]:
    driver = EwaAgenticDriver(pool)
    snapshot = await driver.observe(
        session=session,
        ctx=ctx,
        act_tool=act_tool,
        act_summary=act_summary,
    )
    wm_raw = session.get("working_memory_json")
    wm = dict(wm_raw) if isinstance(wm_raw, Mapping) else {}
    wm.update(snapshot.to_working_memory_patch())
    if act_tool == "call_expert_chat":
        wm["awaiting_expert_consultation"] = False
    wm["lifecycle_phase"] = AgenticLifecyclePhase.EXECUTING.value
    if snapshot.content_version is not None:
        wm["unified_content_version"] = snapshot.content_version
    updated = await agentic_pg.agentic_session_update(
        pool,
        session_id=str(session.get("id") or ""),
        principal_id=principal_id,
        working_memory_json=wm,
        expect_revision=int(session.get("session_revision") or 0),
    )
    return updated or dict(session)


def act_error_is_version_conflict(act: Any) -> bool:
    raw = getattr(act, "raw", None)
    if not isinstance(raw, Mapping):
        return False
    data = raw.get("data")
    if isinstance(data, Mapping) and data.get("error_code") == "version_conflict":
        return True
    summary = str(getattr(act, "summary", "") or "")
    return "version conflict" in summary.lower() or "version changed" in summary.lower()
