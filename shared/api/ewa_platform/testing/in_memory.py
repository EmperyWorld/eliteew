# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Provides a lightweight in-memory RunRepository, Outbox, and EventLog for unit tests.
# Invariants:
# - Event ordering follows append order; seq is not auto-assigned (store raw mappings).
# Related:
# - api/ewa_platform/persistence/ports.py
# ---
from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any


class InMemoryAmkaStores:
    """Holds dict-backed stores implementing persistence port method shapes."""

    def __init__(self) -> None:
        self.runs: MutableMapping[str, dict[str, Any]] = {}
        self.outbox: list[tuple[str, dict[str, Any]]] = []
        self.events: MutableMapping[str, list[dict[str, Any]]] = {}

    async def get_run(self, run_id: str) -> Mapping[str, Any] | None:
        return self.runs.get(run_id)

    async def upsert_run(self, run_id: str, state: Mapping[str, Any]) -> None:
        self.runs[run_id] = dict(state)

    async def enqueue(self, run_id: str, payload: Mapping[str, Any]) -> None:
        self.outbox.append((run_id, dict(payload)))

    async def append(self, run_id: str, event: Mapping[str, Any]) -> None:
        bucket = self.events.setdefault(run_id, [])
        bucket.append(dict(event))

    async def list_events(
        self,
        run_id: str,
        *,
        after_seq: int | None = None,
    ) -> Sequence[Mapping[str, Any]]:
        items = list(self.events.get(run_id, ()))
        if after_seq is None:
            return items
        return [e for e in items if int(e.get("seq", -1)) > after_seq]
