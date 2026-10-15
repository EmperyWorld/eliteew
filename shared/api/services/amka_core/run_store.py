# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Defines the AMKA core run-store boundary and a tiny in-memory reference implementation.
# It prepares neutral persistence without moving existing Marketing Cabinet tables yet.
# Invariants:
# - Store contracts stay domain-neutral and accept AMKA core results/projections only.
# - The in-memory store is for tests/reference drivers; production adapters own durable storage.
# Related:
# - shared/api/services/amka_core/contracts.py
# - shared/api/services/amka_core/projection.py
# ---
from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

from api.services.amka_core.contracts import (
    AmkaCoreRunStatus,
    AmkaRunResult,
    AmkaSubjectRef,
)
from api.services.amka_core.projection import build_amka_core_run_projection


@dataclass(frozen=True, slots=True)
class AmkaStoredRun:
    """Neutral stored representation of one AMKA core result."""

    run_id: str
    subject: AmkaSubjectRef
    status: AmkaCoreRunStatus
    projection: Mapping[str, Any]
    metadata: Mapping[str, Any] = field(default_factory=dict)


@runtime_checkable
class AmkaRunStore(Protocol):
    """Persistence boundary for future neutral AMKA run storage."""

    async def save_result(
        self,
        run_id: str,
        result: AmkaRunResult,
        *,
        metadata: Mapping[str, Any] | None = None,
    ) -> AmkaStoredRun:
        """Persist or upsert a completed core run result."""

        ...

    async def get_run(self, run_id: str) -> AmkaStoredRun | None:
        """Return one stored run by id."""

        ...

    async def list_runs_for_subject(self, subject: AmkaSubjectRef) -> Sequence[AmkaStoredRun]:
        """Return stored runs for one domain-owned subject."""

        ...


class InMemoryAmkaRunStore:
    """Reference `AmkaRunStore` for contract tests and future driver examples."""

    def __init__(self) -> None:
        self._runs: dict[str, AmkaStoredRun] = {}

    async def save_result(
        self,
        run_id: str,
        result: AmkaRunResult,
        *,
        metadata: Mapping[str, Any] | None = None,
    ) -> AmkaStoredRun:
        stored = AmkaStoredRun(
            run_id=run_id,
            subject=result.subject,
            status=result.status,
            projection=build_amka_core_run_projection(result),
            metadata=dict(metadata or {}),
        )
        self._runs[run_id] = stored
        return stored

    async def get_run(self, run_id: str) -> AmkaStoredRun | None:
        return self._runs.get(run_id)

    async def list_runs_for_subject(self, subject: AmkaSubjectRef) -> tuple[AmkaStoredRun, ...]:
        return tuple(
            run
            for run in self._runs.values()
            if run.subject.driver_key == subject.driver_key
            and run.subject.domain_profile == subject.domain_profile
            and run.subject.subject_id == subject.subject_id
        )
