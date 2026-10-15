# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Holds references to ports (persistence, desktop shell, optional domain drivers, policy, LLM) for one orchestration step.
# Invariants:
# - This module only declares types; it must not open connections or schedule asyncio tasks.
# Related:
# - api/ewa_platform/core/orchestrator.py
# - api/ewa_platform/persistence/orchestration_ports.py
# ---
"""Injectable port bundle wiring one desktop orchestration ``run_orchestration_turn`` (sessions/events/desktop/policy/LLM + optional hints)."""

from __future__ import annotations

from dataclasses import dataclass

from api.ewa_platform.drivers.content_manager import ContentManagerDriver
from api.ewa_platform.drivers.desktop_shell import DesktopShellDriver
from api.ewa_platform.drivers.documents_workspace import DocumentsWorkspaceDriver
from api.ewa_platform.drivers.ugs_control import UgsControlDriver
from api.ewa_platform.llm.client import LlmClient
from api.ewa_platform.persistence.orchestration_ports import OrchestrationEventLog, OrchestrationSessionRepository
from api.ewa_platform.policy.engine import PolicyEngine


@dataclass(slots=True)
class OrchestrationContext:
    """Composition root fills these ports; uses concrete repos + adapters from ``services/ewa_desktop/runtime``."""

    sessions: OrchestrationSessionRepository
    events: OrchestrationEventLog
    desktop: DesktopShellDriver
    policy: PolicyEngine
    llm: LlmClient
    ugs: UgsControlDriver | None = None
    documents: DocumentsWorkspaceDriver | None = None
    content: ContentManagerDriver | None = None
