# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Test helpers: in-memory persistence fakes, orchestration fakes, domain driver fakes, and envelope builders.
# Invariants:
# - Fakes are not thread-safe; suitable for unit tests only.
# Related:
# - api/ewa_platform/persistence/ports.py
# - api/ewa_platform/testing/fake_domain_drivers.py
# - api/ewa_platform/testing/orchestration_builders.py
# ---
from __future__ import annotations

from api.ewa_platform.persistence.in_memory_orchestration import InMemoryOrchestrationStores
from api.ewa_platform.testing.fake_desktop_driver import FakeDesktopDriver
from api.ewa_platform.testing.fake_domain_drivers import (
    FakeContentManagerDriver,
    FakeDocumentsWorkspaceDriver,
    FakeUgsControlDriver,
)
from api.ewa_platform.testing.fake_llm_client import FakeLlmClient
from api.ewa_platform.testing.fake_policy_engine import FakePolicyEngine
from api.ewa_platform.testing.in_memory import InMemoryAmkaStores
from api.ewa_platform.testing.orchestration_builders import (
    build_stub_orchestration_request,
    build_test_orchestration_context,
)

__all__ = [
    "FakeContentManagerDriver",
    "FakeDesktopDriver",
    "FakeDocumentsWorkspaceDriver",
    "FakeLlmClient",
    "FakeUgsControlDriver",
    "FakePolicyEngine",
    "InMemoryAmkaStores",
    "InMemoryOrchestrationStores",
    "build_stub_orchestration_request",
    "build_test_orchestration_context",
]
