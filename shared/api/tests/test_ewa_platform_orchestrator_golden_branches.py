# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Golden orchestration scenarios for ``last_branch`` outcomes (``no_intent``, ``policy_denied``, ``intent_executed``),
# optional ``domain_hints`` when documents/content ports are wired, and ``companion_wire`` forwarded to LLM variables.
# Invariants:
# - In-memory stores only; no Docker or ``amka_core``.
# Related:
# - api/ewa_platform/core/orchestrator.py
# - api/ewa_platform/docs/INTENT-CATALOG.md
# - api/ewa_platform/docs/OBSERVATION-CATALOG.md
# ---
from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.contracts.desktop_observation import DesktopObservationKind
from api.ewa_platform.contracts.orchestration import OrchestrationSessionBranch
from api.ewa_platform.contracts.policy_context import PolicyContext
from api.ewa_platform.core.orchestration_context import OrchestrationContext
from api.ewa_platform.core.orchestrator import run_orchestration_turn
from api.ewa_platform.persistence.in_memory_orchestration import InMemoryOrchestrationStores
from api.ewa_platform.policy.engine import BasicDesktopPolicyEngine
from api.ewa_platform.testing.fake_desktop_driver import FakeDesktopDriver
from api.ewa_platform.testing.fake_domain_drivers import FakeContentManagerDriver, FakeDocumentsWorkspaceDriver
from api.ewa_platform.testing.fake_llm_client import FakeLlmClient


def test_golden_no_intent_user_cancelled_and_empty_llm() -> None:
    async def body() -> None:
        stores = InMemoryOrchestrationStores()
        ctx = OrchestrationContext(
            sessions=stores,
            events=stores,
            desktop=FakeDesktopDriver(),
            policy=BasicDesktopPolicyEngine(allowed_app_components=frozenset({"App"})),
            llm=FakeLlmClient("{}"),
        )
        pctx = PolicyContext(principal_id="u1", role_names=frozenset({"user"}))
        await run_orchestration_turn(
            ctx,
            session_id="s-no",
            observation={"observation_kind": DesktopObservationKind.USER_CANCELLED.value, "reason": "stop"},
            policy_context=pctx,
        )
        snap = await stores.get("s-no")
        assert snap is not None
        assert snap["last_branch"] == OrchestrationSessionBranch.NO_INTENT.value
        assert len(stores.events["s-no"]) == 1

    asyncio.run(body())


def test_golden_policy_denied_open_app_not_allowlisted() -> None:
    async def body() -> None:
        stores = InMemoryOrchestrationStores()
        llm_out = '{"intent": {"intent_kind": "open_app", "app_component": "RiskyApp", "payload": {}}}'
        ctx = OrchestrationContext(
            sessions=stores,
            events=stores,
            desktop=FakeDesktopDriver(),
            policy=BasicDesktopPolicyEngine(allowed_app_components=frozenset()),
            llm=FakeLlmClient(llm_out),
        )
        pctx = PolicyContext(principal_id="u1", role_names=frozenset({"user"}))
        await run_orchestration_turn(
            ctx,
            session_id="s-deny",
            observation={
                "observation_kind": DesktopObservationKind.WINDOW_LIST_SNAPSHOT.value,
                "windows": [],
            },
            policy_context=pctx,
        )
        snap = await stores.get("s-deny")
        assert snap is not None
        assert snap["last_branch"] == OrchestrationSessionBranch.POLICY_DENIED.value
        kinds = [e.get("kind") for e in stores.events["s-deny"]]
        assert kinds == ["observation", "policy_denied"]

    asyncio.run(body())


def test_golden_malformed_llm_falls_back_to_heuristic_intent() -> None:
    async def body() -> None:
        stores = InMemoryOrchestrationStores()
        ctx = OrchestrationContext(
            sessions=stores,
            events=stores,
            desktop=FakeDesktopDriver(),
            policy=BasicDesktopPolicyEngine(allowed_app_components=frozenset()),
            llm=FakeLlmClient("not-json"),
        )
        pctx = PolicyContext(principal_id="u1", role_names=frozenset({"user"}))
        await run_orchestration_turn(
            ctx,
            session_id="s-fallback",
            observation={
                "observation_kind": DesktopObservationKind.ACTIVE_APP_CHANGED.value,
                "app_component": "App",
                "window_id": "w-active",
            },
            policy_context=pctx,
        )
        snap = await stores.get("s-fallback")
        assert snap is not None
        assert snap["last_branch"] == OrchestrationSessionBranch.INTENT_EXECUTED.value
        assert snap["last_intent_kind"] == "focus_window"
        assert stores.events["s-fallback"][-1]["intent"] == {
            "intent_kind": "focus_window",
            "window_id": "w-active",
        }

    asyncio.run(body())


def test_golden_domain_hints_documents_and_content_ports() -> None:
    async def body() -> None:
        stores = InMemoryOrchestrationStores()
        ctx = OrchestrationContext(
            sessions=stores,
            events=stores,
            desktop=FakeDesktopDriver(),
            policy=BasicDesktopPolicyEngine(allowed_app_components=frozenset()),
            llm=FakeLlmClient("{}"),
            documents=FakeDocumentsWorkspaceDriver(documents=[{"doc_id": "d1"}]),
            content=FakeContentManagerDriver(roots=["root-a"]),
        )
        pctx = PolicyContext(principal_id="u1", role_names=frozenset({"user"}))
        await run_orchestration_turn(
            ctx,
            session_id="s-hint",
            observation={
                "observation_kind": DesktopObservationKind.WINDOW_LIST_SNAPSHOT.value,
                "windows": [],
            },
            policy_context=pctx,
        )
        kinds = [e.get("kind") for e in stores.events["s-hint"]]
        assert kinds[0] == "observation"
        assert kinds[1] == "domain_hints"
        dh = stores.events["s-hint"][1]
        hints = dh.get("hints")
        assert isinstance(hints, dict)
        assert "documents" in hints and "content" in hints
        assert hints["documents"].get("open_document_count") == 1
        assert hints["documents"].get("source") == "fake_in_memory"
        assert hints["content"].get("roots") == ["root-a"]
        assert hints["content"].get("source") == "fake_in_memory"

    asyncio.run(body())


class _BrokenDocumentsDriver:
    """Documents port that raises so the orchestrator best-effort path is exercised."""

    async def describe_open_documents_hint(self) -> Mapping[str, Any]:
        raise RuntimeError("shell-state unavailable")


def test_golden_domain_hint_exception_does_not_abort_turn() -> None:
    async def body() -> None:
        stores = InMemoryOrchestrationStores()
        ctx = OrchestrationContext(
            sessions=stores,
            events=stores,
            desktop=FakeDesktopDriver(),
            policy=BasicDesktopPolicyEngine(allowed_app_components=frozenset()),
            llm=FakeLlmClient("{}"),
            documents=_BrokenDocumentsDriver(),  # type: ignore[arg-type]
        )
        pctx = PolicyContext(principal_id="u1", role_names=frozenset({"user"}))
        await run_orchestration_turn(
            ctx,
            session_id="s-hint-error",
            observation={
                "observation_kind": DesktopObservationKind.WINDOW_LIST_SNAPSHOT.value,
                "windows": [],
            },
            policy_context=pctx,
        )
        snap = await stores.get("s-hint-error")
        assert snap is not None
        assert snap["last_branch"] == OrchestrationSessionBranch.NO_INTENT.value
        hints = stores.events["s-hint-error"][1].get("hints")
        assert isinstance(hints, dict)
        assert hints["documents"]["source"] == "domain_hint_exception"
        assert hints["documents"]["error"] == "RuntimeError"

    asyncio.run(body())


class _VarsCaptureLlm:
    """Records last ``complete`` variables for contract checks."""

    def __init__(self, response: str = "{}") -> None:
        self._response = response
        self.last: dict[str, Any] | None = None

    async def complete(self, prompt: str, *, variables: Mapping[str, Any] | None = None) -> str:
        self.last = dict(variables or {})
        return self._response


def test_golden_companion_wire_reaches_llm_variables() -> None:
    async def body() -> None:
        stores = InMemoryOrchestrationStores()
        llm = _VarsCaptureLlm()
        ctx = OrchestrationContext(
            sessions=stores,
            events=stores,
            desktop=FakeDesktopDriver(),
            policy=BasicDesktopPolicyEngine(allowed_app_components=frozenset()),
            llm=llm,
        )
        pctx = PolicyContext(principal_id="u1", role_names=frozenset({"user"}))
        wire = {"companion_profile_json": '{"seed_persona_id":"parent"}'}
        await run_orchestration_turn(
            ctx,
            session_id="s-cw",
            observation={
                "observation_kind": DesktopObservationKind.WINDOW_LIST_SNAPSHOT.value,
                "windows": [],
            },
            policy_context=pctx,
            companion_wire=wire,
        )
        assert llm.last is not None
        cw = llm.last.get("companion_wire")
        assert isinstance(cw, dict)
        assert cw.get("companion_profile_json") == wire["companion_profile_json"]

    asyncio.run(body())
