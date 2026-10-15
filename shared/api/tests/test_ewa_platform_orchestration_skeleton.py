# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Smoke tests for desktop orchestration (policy, fake driver, event log, session snapshot on ``sessions`` port).
# Invariants:
# - No Docker; no imports from api.services.amka_core.
# Related:
# - api/ewa_platform/core/orchestrator.py
# - api/ewa_platform/testing/orchestration_builders.py
# ---
from __future__ import annotations

import asyncio
import json

from api.ewa_platform.contracts.desktop_intent import FocusWindowIntent
from api.ewa_platform.contracts.desktop_observation import ActiveAppChanged, DesktopObservationKind
from api.ewa_platform.contracts.policy_context import PolicyContext
from api.ewa_platform.core.orchestration_context import OrchestrationContext
from api.ewa_platform.core.orchestrator import run_orchestration_turn
from api.ewa_platform.io.desktop_payload import desktop_intent_to_wire, desktop_observation_to_wire
from api.ewa_platform.persistence.in_memory_orchestration import InMemoryOrchestrationStores
from api.ewa_platform.testing.fake_desktop_driver import FakeDesktopDriver
from api.ewa_platform.testing.fake_domain_drivers import FakeUgsControlDriver
from api.ewa_platform.testing.fake_llm_client import FakeLlmClient
from api.ewa_platform.testing.fake_policy_engine import FakePolicyEngine
from api.ewa_platform.testing.orchestration_builders import build_test_orchestration_context


def test_orchestration_optional_domain_hints_event() -> None:
    async def body() -> None:
        stores = InMemoryOrchestrationStores()
        ctx = OrchestrationContext(
            sessions=stores,
            events=stores,
            desktop=FakeDesktopDriver(),
            policy=FakePolicyEngine(allow=True),
            llm=FakeLlmClient(),
            ugs=FakeUgsControlDriver(hint={"profile": "ugs-test"}),
        )
        pctx = PolicyContext(principal_id="test-user", role_names=frozenset({"user"}))
        await run_orchestration_turn(
            ctx,
            session_id="s-ugs",
            observation={
                "observation_kind": DesktopObservationKind.ACTIVE_APP_CHANGED.value,
                "app_component": "App",
                "window_id": "w1",
            },
            policy_context=pctx,
        )
        kinds = [e.get("kind") for e in stores.events["s-ugs"]]
        assert kinds[:2] == ["observation", "domain_hints"]
        assert kinds[2] == "intent_result"

    asyncio.run(body())


def test_orchestration_llm_overrides_heuristic_when_valid_json() -> None:
    async def body() -> None:
        payload = {"intent": {"intent_kind": "focus_window", "window_id": "w-from-llm"}}
        stores = InMemoryOrchestrationStores()
        ctx = OrchestrationContext(
            sessions=stores,
            events=stores,
            desktop=FakeDesktopDriver(),
            policy=FakePolicyEngine(allow=True),
            llm=FakeLlmClient(response=json.dumps(payload)),
        )
        pctx = PolicyContext(principal_id="test-user", role_names=frozenset({"user"}))
        await run_orchestration_turn(
            ctx,
            session_id="s-llm",
            observation={
                "observation_kind": DesktopObservationKind.ACTIVE_APP_CHANGED.value,
                "app_component": "App",
                "window_id": "w-heuristic",
            },
            policy_context=pctx,
        )
        last = stores.events["s-llm"][-1]
        assert last["kind"] == "intent_result"
        assert last["intent"]["window_id"] == "w-from-llm"

    asyncio.run(body())


def test_desktop_payload_round_trip_intent() -> None:
    wire = desktop_intent_to_wire(FocusWindowIntent(window_id="w-9"))
    assert wire["intent_kind"] == "focus_window"
    assert wire["window_id"] == "w-9"


def test_desktop_payload_round_trip_observation() -> None:
    wire = desktop_observation_to_wire(ActiveAppChanged(app_component="A", window_id="w1"))
    assert wire["observation_kind"] == "active_app_changed"


def test_orchestration_active_app_triggers_focus_intent() -> None:
    async def body() -> None:
        ctx, pctx, stores = build_test_orchestration_context(policy_allows_all=True)
        await run_orchestration_turn(
            ctx,
            session_id="s1",
            observation={
                "observation_kind": DesktopObservationKind.ACTIVE_APP_CHANGED.value,
                "app_component": "App",
                "window_id": "w1",
            },
            policy_context=pctx,
        )
        events = stores.events["s1"]
        assert len(events) == 2
        assert events[0]["kind"] == "observation"
        assert events[1]["kind"] == "intent_result"
        assert events[1]["intent"]["intent_kind"] == "focus_window"
        sess_row = await stores.get("s1")
        assert sess_row is not None
        sess = dict(sess_row)
        assert sess["turns"] == 1
        assert sess["last_branch"] == "intent_executed"
        assert sess["last_intent_kind"] == "focus_window"
        assert sess["last_observation_kind"] == DesktopObservationKind.ACTIVE_APP_CHANGED.value

    asyncio.run(body())


def test_orchestration_policy_denied() -> None:
    async def body() -> None:
        ctx, pctx, stores = build_test_orchestration_context(policy_allows_all=False)
        await run_orchestration_turn(
            ctx,
            session_id="s1",
            observation={
                "observation_kind": DesktopObservationKind.ACTIVE_APP_CHANGED.value,
                "app_component": "App",
                "window_id": "w1",
            },
            policy_context=pctx,
        )
        events = stores.events["s1"]
        assert len(events) == 2
        assert events[1]["kind"] == "policy_denied"
        sess_row = await stores.get("s1")
        assert sess_row is not None
        sess = dict(sess_row)
        assert sess["last_branch"] == "policy_denied"
        assert sess["turns"] == 1

    asyncio.run(body())


def test_orchestration_user_cancelled_no_intent() -> None:
    async def body() -> None:
        ctx, pctx, stores = build_test_orchestration_context(policy_allows_all=True)
        await run_orchestration_turn(
            ctx,
            session_id="s1",
            observation={"observation_kind": DesktopObservationKind.USER_CANCELLED.value, "reason": "nope"},
            policy_context=pctx,
        )
        assert len(stores.events["s1"]) == 1
        sess_row = await stores.get("s1")
        assert sess_row is not None
        sess = dict(sess_row)
        assert sess["last_branch"] == "no_intent"
        assert sess["turns"] == 1

    asyncio.run(body())
