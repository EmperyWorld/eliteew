# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Provides the standalone AMKA run engine over the driver contract.
# It is the first executable slice of AMKA that does not depend on the marketing cabinet.
# Optional `run_once_and_persist` writes neutral projections through `AmkaRunStore` adapters.
# Invariants:
# - The engine never reads or writes domain storage directly; all side effects go through `AmkaDriver`.
# - A no-op plan is a successful, explainable outcome, not an error.
# - Persistence is explicit: only `AmkaRunStore` implementations receive core results.
# Related:
# - shared/api/services/amka_core/contracts.py
# - shared/api/services/amka_core/mock_driver.py
# - shared/api/services/amka_core/run_store.py
# ---
from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from api.services.amka_core.contracts import (
    AmkaCoreRunStatus,
    AmkaCoreStage,
    AmkaDriver,
    AmkaPlanTask,
    AmkaPolicyDecision,
    AmkaPulseArtifact,
    AmkaRunResult,
    AmkaSubjectRef,
    AmkaTraceEvent,
)
from api.services.amka_core.run_store import AmkaRunStore, AmkaStoredRun


class AmkaCoreEngine:
    """Small orchestration kernel shared by concrete AMKA domain drivers."""

    def __init__(self, driver: AmkaDriver) -> None:
        self._driver = driver

    async def run_once(self, subject: AmkaSubjectRef, *, execute: bool = False) -> AmkaRunResult:
        traces: list[AmkaTraceEvent] = [
            AmkaTraceEvent(
                stage=AmkaCoreStage.SNAPSHOT,
                event="run.started",
                payload={
                    "driver_key": self._driver.driver_key,
                    "domain_profile": self._driver.domain_profile,
                    "subject_id": subject.subject_id,
                },
            )
        ]
        snapshot = await self._driver.read(subject)
        traces.append(
            AmkaTraceEvent(
                stage=AmkaCoreStage.SNAPSHOT,
                event="snapshot.ready",
                payload={"health_keys": sorted(str(k) for k in snapshot.health)},
            )
        )

        tasks = tuple(await self._driver.plan(subject, snapshot))
        traces.append(
            AmkaTraceEvent(
                stage=AmkaCoreStage.PLAN,
                event="plan.ready",
                payload={"task_count": len(tasks)},
            )
        )

        policy = await self._driver.policy(subject, snapshot, tasks)
        traces.append(
            AmkaTraceEvent(
                stage=AmkaCoreStage.APPROVAL,
                event="policy.decided",
                payload={
                    "allowed": policy.allowed,
                    "mode": policy.mode,
                    "denied_operation_keys": list(policy.denied_operation_keys),
                },
            )
        )

        status = self._status_before_execute(tasks=tasks, policy=policy, execute=execute)
        observations = {}
        if status == AmkaCoreRunStatus.RUNNING:
            observations = await self._execute_tasks(subject=subject, tasks=tasks, policy=policy, traces=traces)
            status = AmkaCoreRunStatus.COMPLETED

        if not observations:
            observations = dict(await self._driver.observe(subject))

        pulse = await self._driver.pulse(subject, snapshot, tasks, traces)
        traces.append(self._pulse_trace(pulse))

        return AmkaRunResult(
            status=status,
            subject=subject,
            snapshot=snapshot,
            tasks=tasks,
            policy=policy,
            traces=tuple(traces),
            pulse=pulse,
            observations=observations,
        )

    async def run_once_and_persist(
        self,
        subject: AmkaSubjectRef,
        *,
        run_id: str,
        store: AmkaRunStore,
        execute: bool = False,
        metadata: Mapping[str, Any] | None = None,
    ) -> tuple[AmkaRunResult, AmkaStoredRun]:
        """Execute `run_once`, then save the neutral projection through `store`."""

        result = await self.run_once(subject, execute=execute)
        stored = await store.save_result(run_id, result, metadata=metadata)
        return result, stored

    @staticmethod
    def _status_before_execute(
        *,
        tasks: Sequence[AmkaPlanTask],
        policy: AmkaPolicyDecision,
        execute: bool,
    ) -> AmkaCoreRunStatus:
        if not tasks:
            return AmkaCoreRunStatus.COMPLETED
        if not policy.allowed or not execute:
            return AmkaCoreRunStatus.AWAITING_APPROVAL
        return AmkaCoreRunStatus.RUNNING

    async def _execute_tasks(
        self,
        *,
        subject: AmkaSubjectRef,
        tasks: Sequence[AmkaPlanTask],
        policy: AmkaPolicyDecision,
        traces: list[AmkaTraceEvent],
    ) -> dict[str, Any]:
        task_results: list[object] = []
        for task in tasks:
            traces.append(
                AmkaTraceEvent(
                    stage=AmkaCoreStage.EXECUTE,
                    event="task.started",
                    payload={"task_key": task.task_key, "risk": task.risk.value},
                )
            )
            task_results.append(dict(await self._driver.act(subject, task, policy)))
            traces.append(
                AmkaTraceEvent(
                    stage=AmkaCoreStage.EXECUTE,
                    event="task.completed",
                    payload={"task_key": task.task_key},
                )
            )
        return dict(await self._driver.observe(subject)) | {"task_results": task_results}

    @staticmethod
    def _pulse_trace(pulse: AmkaPulseArtifact) -> AmkaTraceEvent:
        return AmkaTraceEvent(
            stage=AmkaCoreStage.FINAL,
            event="pulse.ready",
            message=pulse.summary,
            payload={
                "changed_count": len(pulse.changed),
                "doubts_count": len(pulse.doubts),
                "recommends_no_change": pulse.recommends_no_change,
            },
        )
