# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Supplies a reference AMKA driver for contract tests and future driver authors.
# It proves the core lifecycle can run without marketing tables, RAG, IMC, or UGS.
# Invariants:
# - The mock driver has deterministic in-memory state and no external side effects.
# - Destructive tasks are blocked by policy unless the caller explicitly configures otherwise.
# Related:
# - shared/api/services/amka_core/contracts.py
# - shared/api/tests/test_amka_core.py
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


class ReferenceMockAmkaDriver:
    """Deterministic driver used as the empty reference implementation from the RFC."""

    driver_key = "reference_mock"
    domain_profile = "mock"

    def __init__(
        self,
        *,
        planned_tasks: Iterable[AmkaPlanTask] | None = None,
        health: Mapping[str, Any] | None = None,
        context_text: str = "Mock AMKA context.",
        allow_destructive: bool = False,
    ) -> None:
        self._planned_tasks = tuple(planned_tasks or ())
        self._health = dict(health or {"score": 100, "status": "stable"})
        self._context_text = context_text
        self._allow_destructive = allow_destructive
        self.executed_task_keys: list[str] = []

    async def read(self, subject: AmkaSubjectRef) -> AmkaSnapshot:
        return AmkaSnapshot(
            subject=subject,
            health=self._health,
            context_text=self._context_text,
            entities={"mock_items": [{"id": "mock-1", "title": "Reference item"}]},
            metadata={"driver_key": self.driver_key},
        )

    async def plan(self, subject: AmkaSubjectRef, snapshot: AmkaSnapshot) -> Sequence[AmkaPlanTask]:
        return self._planned_tasks

    async def policy(
        self,
        subject: AmkaSubjectRef,
        snapshot: AmkaSnapshot,
        tasks: Sequence[AmkaPlanTask],
    ) -> AmkaPolicyDecision:
        denied = [
            op.operation_key
            for task in tasks
            for op in task.operations
            if op.risk == AmkaRiskLevel.DESTRUCTIVE and not self._allow_destructive
        ]
        if denied:
            return AmkaPolicyDecision(
                allowed=False,
                mode="semi_auto",
                reason="Destructive operations require an explicit operator gate.",
                denied_operation_keys=tuple(denied),
            )
        return AmkaPolicyDecision(allowed=True, mode="auto", reason="Reference mock policy allows the plan.")

    async def act(
        self,
        subject: AmkaSubjectRef,
        task: AmkaPlanTask,
        decision: AmkaPolicyDecision,
    ) -> Mapping[str, Any]:
        self.executed_task_keys.append(task.task_key)
        return {
            "task_key": task.task_key,
            "operation_count": len(task.operations),
            "decision_mode": decision.mode,
        }

    async def observe(self, subject: AmkaSubjectRef) -> Mapping[str, Any]:
        return {
            "driver_key": self.driver_key,
            "executed_task_keys": list(self.executed_task_keys),
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
                summary="AMKA checked the subject and chose not to change it.",
                preserved=("Current state remains stable.",),
                doubts=(),
                agreements=("No action is also a valid outcome.",),
                no_change_reason="No tasks were proposed by the driver.",
                next_safe_step="Keep observing until a real gap appears.",
            )
        return AmkaPulseArtifact(
            summary=f"AMKA prepared {len(tasks)} mock task(s).",
            changed=tuple(self.executed_task_keys),
            preserved=("Driver contract stayed deterministic.",),
            doubts=(),
            agreements=("Operator gates remain explicit for destructive work.",),
        )
