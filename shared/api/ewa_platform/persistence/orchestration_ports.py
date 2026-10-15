# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Persistence ports for desktop orchestration sessions (no SQL in this module).
# Invariants:
# - Methods are async; callers run inside asyncio event loop from gateways/workers.
# Related:
# - api/ewa_platform/persistence_pg/repositories_stub.py
# - api/ewa_platform/persistence/in_memory_orchestration.py
# - api/ewa_platform/core/orchestration_context.py
# ---
"""Async protocols for orchestration session rows and append-only events (implementations in memory + asyncpg)."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class OrchestrationSessionRepository(Protocol):
    """Load/save orchestration session rows keyed by ``session_id``."""

    async def get(self, session_id: str) -> Mapping[str, Any] | None: ...

    async def save(self, session_id: str, state: Mapping[str, Any]) -> None: ...


@runtime_checkable
class OrchestrationEventLog(Protocol):
    """Append-only log of orchestration steps for replay and SSE clients."""

    async def append(self, session_id: str, event: Mapping[str, Any]) -> None: ...

    async def list_for_session(
        self,
        session_id: str,
        *,
        after_seq: int | None = None,
    ) -> Sequence[Mapping[str, Any]]: ...
