# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Release Gate 0 death-spiral pack — circuit breaker, evaluate_replanning, reset-on-success,
# plus thin act_binding / act_only re-exports for the gate -k filter.
# Invariants:
# - Tests marked death_spiral; Reasoning_Loop_Detected is the HITL terminate reason.
# - Does not delete legacy Act (K3 = Phase C Cause); locks current fail-closed behavior.
# Related:
# - documentation/product/ewa/EWA-DEATH-SPIRAL-REGRESSION-GATE.md
# - api/ewa_platform/agentic/kernel/circuit_breaker.py
# - tests/test_agentic_replanning_circuit_breaker.py
# - tests/test_agentic_act_binding_policy.py
# ---

from __future__ import annotations

from typing import Any

import pytest

from api.ewa_platform.agentic.kernel.act_binding_policy import loop_act_binding_verdict
from api.ewa_platform.agentic.kernel.circuit_breaker import (
    REASONING_LOOP_DETECTED,
    evaluate_replanning_step,
    reset_circuit_on_success,
)
from api.ewa_platform.agentic.kernel.types import AgenticContext
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

# Reuse mock pool/conn patterns from the dedicated circuit-breaker suite.
from tests.test_agentic_replanning_circuit_breaker import (  # noqa: E402
    _CircuitConn,
    _CircuitPool,
)

pytestmark = pytest.mark.death_spiral


def _ctx(**overrides: Any) -> AgenticContext:
    base: dict[str, Any] = {
        "session": {"id": "sess-ds-1", "status": "executing", "policy_json": {}},
        "active_nodes": [],
        "tree_summary": {"completed": 0},
        "checkpoints": [],
        "inbound_messages": [],
        "llm_messages": [],
        "scheduled_node": None,
    }
    base.update(overrides)
    return AgenticContext(**base)


@pytest.mark.asyncio
async def test_death_spiral_circuit_opens_awaiting_human_reasoning_loop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Circuit → awaiting_human + Reasoning_Loop_Detected (Gate A class A)."""

    monkeypatch.setenv("EWA_AGENTIC_MAX_REPLANNING_ATTEMPTS", "3")
    monkeypatch.setattr(agentic_pg, "agentic_max_replanning_attempts", lambda: 3)

    conn = _CircuitConn(status="replanning", wm={"replanning_count": 3})
    pool = _CircuitPool(conn)
    _cp, session = await agentic_pg.agentic_record_replanning_atomic(
        pool,  # type: ignore[arg-type]
        session_id="sess-cb-1",
        principal_id="p-1",
        expect_revision=4,
        reason="tool_act_error:death_spiral_gate",
    )
    assert session is not None
    assert session["status"] == "awaiting_human"
    assert conn.working_memory.get("terminate_reason") == REASONING_LOOP_DETECTED
    assert REASONING_LOOP_DETECTED == "Reasoning_Loop_Detected"
    assert conn.gate_json.get("kind") == "circuit_break"


def test_death_spiral_evaluate_replanning_under_cap() -> None:
    status, patch, reason = evaluate_replanning_step({"replanning_count": 2}, max_replanning=5)
    assert status == "replanning"
    assert patch["replanning_count"] == 3
    assert reason is None


def test_death_spiral_evaluate_replanning_over_cap_reasoning_loop() -> None:
    status, patch, reason = evaluate_replanning_step({"replanning_count": 5}, max_replanning=5)
    assert status == "awaiting_human"
    assert patch["replanning_count"] == 6
    assert reason == REASONING_LOOP_DETECTED
    assert patch.get("terminate_reason") == "Reasoning_Loop_Detected"


def test_death_spiral_reset_circuit_on_success() -> None:
    wm = {
        "replanning_count": 7,
        "think_parse_fail_count": 2,
        "terminate_reason": REASONING_LOOP_DETECTED,
    }
    reset = reset_circuit_on_success(wm)
    assert reset["replanning_count"] == 0
    assert reset["think_parse_fail_count"] == 0
    assert "terminate_reason" not in reset
    assert agentic_pg.working_memory_after_successful_act(wm)["replanning_count"] == 0


def test_act_binding_companion_hitl_requires_tree_node() -> None:
    """Thin act_binding re-export for gate -k filter."""

    allowed, reason = loop_act_binding_verdict(
        act_node_id=None,
        tool_name="file_save_text",
        ctx=_ctx(),
    )
    assert allowed is False
    assert reason == "companion_hitl_requires_tree_node"


def test_act_only_bind_required_tools_forbid_orphan_act() -> None:
    """act_only keyword lock — bind-required tools cannot Act without a node."""

    allowed, reason = loop_act_binding_verdict(
        act_node_id=None,
        tool_name="file_create",
        ctx=_ctx(),
    )
    assert allowed is False
    assert reason == "companion_hitl_requires_tree_node"
