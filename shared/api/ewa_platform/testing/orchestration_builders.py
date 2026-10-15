# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Test builders for ``OrchestrationContext`` and stub ``EwaRequestV1`` values.
# Invariants:
# - Same-process only; session/event storage is ``InMemoryOrchestrationStores`` from persistence.
# Related:
# - api/ewa_platform/io/envelope.py
# - api/ewa_platform/persistence/in_memory_orchestration.py
# - api/ewa_platform/core/orchestrator.py
# ---
"""Test builders and in-memory orchestration persistence."""

from __future__ import annotations

from api.ewa_platform.contracts.policy_context import PolicyContext
from api.ewa_platform.core.orchestration_context import OrchestrationContext
from api.ewa_platform.io.envelope import EWA_IO_API_VERSION, EwaRequestMessageType, EwaRequestV1
from api.ewa_platform.persistence.in_memory_orchestration import InMemoryOrchestrationStores
from api.ewa_platform.testing.fake_desktop_driver import FakeDesktopDriver
from api.ewa_platform.testing.fake_llm_client import FakeLlmClient
from api.ewa_platform.testing.fake_policy_engine import FakePolicyEngine


def build_test_orchestration_context(
    *,
    policy_allows_all: bool = True,
) -> tuple[OrchestrationContext, PolicyContext, InMemoryOrchestrationStores]:
    """Build in-memory stores + fakes for orchestrator unit tests."""

    stores = InMemoryOrchestrationStores()
    ctx = OrchestrationContext(
        sessions=stores,
        events=stores,
        desktop=FakeDesktopDriver(),
        policy=FakePolicyEngine(allow=policy_allows_all),
        llm=FakeLlmClient(),
    )
    policy_ctx = PolicyContext(principal_id="test-user", role_names=frozenset({"user"}))
    return ctx, policy_ctx, stores


def build_stub_orchestration_request(*, correlation_id: str = "c-test") -> EwaRequestV1:
    """Return a minimal envelope for desktop orchestration HTTP tests."""

    return EwaRequestV1(
        api_version=EWA_IO_API_VERSION,
        message_type=EwaRequestMessageType.SIGNAL,
        correlation_id=correlation_id,
        auth_context_ref=None,
        payload={"kind": "orchestration_stub", "session_id": "s-test"},
    )
