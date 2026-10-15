# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Provides a second, non-marketing AMKA driver for read-only audits of arbitrary subjects.
# It validates that AMKA core can run outside Marketing Cabinet without write-capable operations.
# Invariants:
# - The driver never mutates state; `act` records read-only review results only.
# - Every proposed task is `READ_ONLY`, so execution is safe and reversible by construction.
# Related:
# - shared/api/services/amka_core/contracts.py
# - documentation/product/amka-seed-album/RFC-001-amka-driver-contract.md
# ---
from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from typing import Any

from api.services.amka_core.contracts import (
    AmkaPlanTask,
    AmkaPolicyDecision,
    AmkaPulseArtifact,
    AmkaRiskLevel,
    AmkaSnapshot,
    AmkaSubjectRef,
    AmkaTraceEvent,
)


class StaticReadOnlyAmkaDriver:
    """Second reference driver: a tiny read-only audit profile for non-marketing subjects."""

    driver_key = "static_read_only"
    domain_profile = "read_only_audit"

    def __init__(
        self,
        *,
        context_text: str,
        findings: Iterable[str] | None = None,
        health: Mapping[str, Any] | None = None,
    ) -> None:
        self._context_text = context_text
        self._findings = tuple(str(item).strip() for item in findings or () if str(item).strip())
        self._health = dict(health or {"status": "read_only", "score": 100})
        self.reviewed_task_keys: list[str] = []

    async def read(self, subject: AmkaSubjectRef) -> AmkaSnapshot:
        return AmkaSnapshot(
            subject=subject,
            health=self._health,
            context_text=self._context_text,
            entities={"findings": list(self._findings)},
            metadata={"driver_key": self.driver_key, "read_only": True},
        )

    async def plan(self, subject: AmkaSubjectRef, snapshot: AmkaSnapshot) -> Sequence[AmkaPlanTask]:
        return tuple(
            AmkaPlanTask(
                task_key=f"review-{index}",
                title=f"Review finding {index}",
                summary=finding,
                risk=AmkaRiskLevel.READ_ONLY,
                operations=(),
                metadata={"finding": finding},
            )
            for index, finding in enumerate(self._findings, start=1)
        )

    async def policy(
        self,
        subject: AmkaSubjectRef,
        snapshot: AmkaSnapshot,
        tasks: Sequence[AmkaPlanTask],
    ) -> AmkaPolicyDecision:
        return AmkaPolicyDecision(
            allowed=True,
            mode="auto",
            reason="Read-only audit tasks are safe to execute automatically.",
        )

    async def act(
        self,
        subject: AmkaSubjectRef,
        task: AmkaPlanTask,
        decision: AmkaPolicyDecision,
    ) -> Mapping[str, Any]:
        self.reviewed_task_keys.append(task.task_key)
        return {
            "task_key": task.task_key,
            "reviewed": True,
            "risk": task.risk.value,
        }

    async def observe(self, subject: AmkaSubjectRef) -> Mapping[str, Any]:
        return {
            "driver_key": self.driver_key,
            "reviewed_task_keys": list(self.reviewed_task_keys),
            "read_only": True,
        }

    async def pulse(
        self,
        subject: AmkaSubjectRef,
        snapshot: AmkaSnapshot,
        tasks: Sequence[AmkaPlanTask],
        traces: Sequence[AmkaTraceEvent],
    ) -> AmkaPulseArtifact:
        if not tasks:
            return AmkaPulseArtifact(
                summary="AMKA read the subject and found no review findings.",
                preserved=("Subject stayed unchanged.",),
                agreements=("Read-only driver never mutates domain state.",),
                no_change_reason="No findings were provided.",
                next_safe_step="Add findings or a richer driver when real action is needed.",
            )
        return AmkaPulseArtifact(
            summary=f"AMKA reviewed {len(tasks)} read-only finding(s).",
            changed=tuple(self.reviewed_task_keys),
            preserved=("Subject stayed unchanged.",),
            agreements=("Read-only driver never mutates domain state.",),
            doubts=(),
            next_safe_step="Promote recurring findings into a real domain driver before adding write actions.",
        )
