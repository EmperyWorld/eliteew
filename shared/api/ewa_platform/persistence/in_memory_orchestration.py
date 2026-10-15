# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# In-process implementation of ``OrchestrationSessionRepository`` and ``OrchestrationEventLog``.
# Invariants:
# - Same-process only; ``seq`` on append defaults to bucket length when absent.
# Related:
# - api/ewa_platform/persistence/orchestration_ports.py
# - api/ewa_platform/testing/orchestration_builders.py
# ---
"""In-memory orchestration persistence (tests and local composition roots)."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any


class InMemoryOrchestrationStores:
    """Minimal ``OrchestrationSessionRepository`` + ``OrchestrationEventLog``."""

    def __init__(self) -> None:
        self.sessions: dict[str, dict[str, Any]] = {}
        self.events: dict[str, list[dict[str, Any]]] = {}

    async def get(self, session_id: str) -> Mapping[str, Any] | None:
        return self.sessions.get(session_id)

    async def save(self, session_id: str, state: Mapping[str, Any]) -> None:
        self.sessions[session_id] = dict(state)

    async def append(self, session_id: str, event: Mapping[str, Any]) -> None:
        bucket = self.events.setdefault(session_id, [])
        row = dict(event)
        row.setdefault("seq", len(bucket))
        bucket.append(row)

    async def list_for_session(
        self,
        session_id: str,
        *,
        after_seq: int | None = None,
    ) -> Sequence[Mapping[str, Any]]:
        items = list(self.events.get(session_id, ()))
        if after_seq is None:
            return items
        return [e for e in items if int(e.get("seq", -1)) > after_seq]
