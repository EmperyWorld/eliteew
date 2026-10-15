# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests following ``docs/FILL-ORDER.md`` (contracts wire guards, policy, io, gateway, llm tools).
# Invariants:
# - No Docker; no ``api.services.amka_core``.
# Related:
# - api/ewa_platform/docs/FILL-ORDER.md
# ---
from __future__ import annotations

import pytest

from api.ewa_platform.contracts.desktop_intent import DesktopIntentKind, desktop_intent_wire_wellformed
from api.ewa_platform.contracts.desktop_observation import (
    DesktopObservationKind,
    desktop_observation_wire_wellformed,
)
from api.ewa_platform.contracts.orchestration import OrchestrationSessionBranch, OrchestrationSessionSnapshotKey
from api.ewa_platform.contracts.policy_context import PolicyContext
from api.ewa_platform.gateways.desktop_http import ewa_desktop_orchestration_signal_request
from api.ewa_platform.io.desktop_payload import (
    ensure_desktop_intent_wire_or_raise,
    ensure_desktop_observation_wire_or_raise,
)
from api.ewa_platform.llm.tools_schema import planned_tool_schemas
from api.ewa_platform.policy.engine import BasicDesktopPolicyEngine


def test_desktop_intent_wire_wellformed_accepts_focus() -> None:
    assert desktop_intent_wire_wellformed({"intent_kind": DesktopIntentKind.FOCUS_WINDOW.value, "window_id": "w1"})


def test_desktop_intent_wire_wellformed_rejects_empty_window() -> None:
    assert not desktop_intent_wire_wellformed(
        {"intent_kind": DesktopIntentKind.FOCUS_WINDOW.value, "window_id": "  "},
    )


def test_desktop_observation_wire_wellformed_active_app() -> None:
    assert desktop_observation_wire_wellformed(
        {
            "observation_kind": DesktopObservationKind.ACTIVE_APP_CHANGED.value,
            "app_component": "App",
            "window_id": "w1",
        },
    )


def test_ensure_desktop_observation_wire_or_raise_invalid() -> None:
    with pytest.raises(ValueError, match="not well-formed"):
        ensure_desktop_observation_wire_or_raise(
            {"observation_kind": DesktopObservationKind.ACTIVE_APP_CHANGED.value, "app_component": "A"},
        )


def test_ensure_desktop_intent_wire_or_raise_round_trip() -> None:
    wire = ensure_desktop_intent_wire_or_raise(
        {"intent_kind": DesktopIntentKind.PATCH_SHELL_STATE.value, "patch": {"recent_app_ids": []}},
    )
    assert wire["intent_kind"] == "patch_shell_state"


def test_basic_desktop_policy_engine() -> None:
    eng = BasicDesktopPolicyEngine(allowed_app_components=frozenset({"app-a"}))
    ctx = PolicyContext(principal_id="u")
    assert eng.evaluate(ctx, {"intent_kind": "focus_window", "window_id": "w1"})
    assert eng.evaluate(ctx, {"intent_kind": "open_app", "app_component": "app-a", "payload": {}})
    assert not eng.evaluate(ctx, {"intent_kind": "open_app", "app_component": "other", "payload": {}})
    assert not eng.evaluate(
        ctx,
        {"intent_kind": "navigate_deep_link", "deep_link_token": "hub", "payload": {}},
    )
    ctx_priv = PolicyContext(principal_id="u", role_names=frozenset({"orchestration_deep_link"}))
    assert eng.evaluate(
        ctx_priv,
        {"intent_kind": "navigate_deep_link", "deep_link_token": "hub", "payload": {}},
    )


def test_ewa_desktop_orchestration_signal_request_shape() -> None:
    req = ewa_desktop_orchestration_signal_request(
        correlation_id="c1",
        session_id="s1",
        observation={
            "observation_kind": DesktopObservationKind.USER_CANCELLED.value,
            "reason": "stop",
        },
    )
    assert req.correlation_id == "c1"
    assert req.payload["kind"] == "ewa_desktop_orchestration_v1"
    assert req.payload["session_id"] == "s1"
    assert req.payload["observation"]["observation_kind"] == DesktopObservationKind.USER_CANCELLED.value


def test_planned_tool_schemas_non_empty() -> None:
    schemas = planned_tool_schemas()
    assert len(schemas) >= 1
    assert schemas[0]["function"]["name"] == "propose_desktop_intent"


def test_orchestration_session_contract_enums_match_strings() -> None:
    assert OrchestrationSessionSnapshotKey.TURNS == "turns"
    assert OrchestrationSessionBranch.INTENT_EXECUTED == "intent_executed"
