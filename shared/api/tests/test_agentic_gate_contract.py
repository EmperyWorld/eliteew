# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for agentic HITL gate validation — revision contract after gate_required bump.
# ---

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from api.ewa_platform.agentic.gate_contract import validate_gate_response


def test_gate_response_ok_when_session_revision_advanced_after_gate_open() -> None:
    """gate_required stores pre-bump revision; session row is already +1 — must accept HITL."""

    session = {
        "session_revision": 6,
        "gate_json": {
            "expect_session_revision": 5,
            "gate_id": "gate-1",
            "kind": "freeform",
            "prompt": "Уточните задачу",
            "expires_at": (datetime.now(tz=UTC) + timedelta(hours=1)).isoformat(),
        },
    }
    ok, reason = validate_gate_response(session, expect_session_revision=None)
    assert ok is True
    assert reason is None


def test_gate_response_rejects_stale_client_session_revision() -> None:
    session = {
        "session_revision": 6,
        "gate_json": {
            "expect_session_revision": 5,
            "prompt": "test",
            "expires_at": (datetime.now(tz=UTC) + timedelta(hours=1)).isoformat(),
        },
    }
    ok, reason = validate_gate_response(session, expect_session_revision=5)
    assert ok is False
    assert reason == "revision_conflict"


def test_gate_response_accepts_matching_client_session_revision() -> None:
    session = {
        "session_revision": 6,
        "gate_json": {
            "expect_session_revision": 5,
            "prompt": "test",
            "expires_at": (datetime.now(tz=UTC) + timedelta(hours=1)).isoformat(),
        },
    }
    ok, reason = validate_gate_response(session, expect_session_revision=6)
    assert ok is True
    assert reason is None


def test_gate_response_rejects_expired_gate() -> None:
    session = {
        "session_revision": 2,
        "gate_json": {
            "expect_session_revision": 1,
            "prompt": "test",
            "expires_at": (datetime.now(tz=UTC) - timedelta(minutes=1)).isoformat(),
        },
    }
    ok, reason = validate_gate_response(session, expect_session_revision=None)
    assert ok is False
    assert reason == "gate_expired"


def test_gate_response_accepts_bound_node_awaiting_human() -> None:
    session = {
        "session_revision": 4,
        "gate_json": {
            "expect_session_revision": 3,
            "prompt": "confirm",
            "bound_node_id": "node-1",
            "expires_at": (datetime.now(tz=UTC) + timedelta(hours=1)).isoformat(),
        },
    }

    ok, reason = validate_gate_response(
        session,
        expect_session_revision=None,
        active_nodes=[{"id": "node-1", "status": "awaiting_human"}],
    )

    assert ok is True
    assert reason is None


def test_gate_response_rejects_bound_node_failed() -> None:
    session = {
        "session_revision": 4,
        "gate_json": {
            "expect_session_revision": 3,
            "prompt": "confirm",
            "bound_node_id": "node-1",
            "expires_at": (datetime.now(tz=UTC) + timedelta(hours=1)).isoformat(),
        },
    }

    ok, reason = validate_gate_response(
        session,
        expect_session_revision=None,
        active_nodes=[{"id": "node-1", "status": "failed"}],
    )

    assert ok is False
    assert reason == "bound_node_terminal"
