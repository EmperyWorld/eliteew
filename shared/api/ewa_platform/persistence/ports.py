# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Generic async persistence ports (runs/outbox/adapters) orthogonal to Postgres orchestration stores.
# Invariants:
# - Callers pass JSON-compatible mappings; schemas for rows evolve outside this file.
# Related:
# - api/ewa_platform/testing/in_memory.py
# - api/ewa_platform/persistence/orchestration_ports.py
# ---
from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class RunRepository(Protocol):
    """CRUD-lite storage for run snapshots and metadata."""

    async def get_run(self, run_id: str) -> Mapping[str, Any] | None: ...

    async def upsert_run(self, run_id: str, state: Mapping[str, Any]) -> None: ...


@runtime_checkable
class Outbox(Protocol):
    """At-least-once delivery queue for downstream side effects."""

    async def enqueue(self, run_id: str, payload: Mapping[str, Any]) -> None: ...


@runtime_checkable
class EventLog(Protocol):
    """Append-only event stream for correlation with EwaEventV1."""

    async def append(self, run_id: str, event: Mapping[str, Any]) -> None: ...

    async def list_events(
        self,
        run_id: str,
        *,
        after_seq: int | None = None,
    ) -> Sequence[Mapping[str, Any]]: ...
