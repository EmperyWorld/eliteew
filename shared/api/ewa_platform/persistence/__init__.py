# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Persistence ports (Protocols) for runs, outbox, append-only logs, plus in-memory orchestration.
# Invariants:
# - No SQL in this module; implementations live under persistence_pg/ later.
# Related:
# - api/ewa_platform/testing/in_memory.py
# - api/ewa_platform/persistence/in_memory_orchestration.py
# - api/ewa_platform/persistence/orchestration_ports.py
# - api/ewa_platform/persistence_pg/__init__.py
# ---
from __future__ import annotations

from api.ewa_platform.persistence.in_memory_orchestration import InMemoryOrchestrationStores
from api.ewa_platform.persistence.orchestration_ports import OrchestrationEventLog, OrchestrationSessionRepository
from api.ewa_platform.persistence.ports import EventLog, Outbox, RunRepository

__all__ = [
    "EventLog",
    "InMemoryOrchestrationStores",
    "OrchestrationEventLog",
    "OrchestrationSessionRepository",
    "Outbox",
    "RunRepository",
]
