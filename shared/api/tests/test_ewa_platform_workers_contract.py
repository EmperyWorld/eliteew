# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for reserved EWA worker/outbox task identifiers before broker wiring exists.
# Invariants:
# - No Celery/RQ app import or broker connection; values are pure strings.
# - Task names stay under ``ewa.platform.*``.
# Related:
# - api/ewa_platform/workers/tasks.py
# - api/ewa_platform/workers/orchestration_tasks.py
# ---
from __future__ import annotations

from api.ewa_platform.workers import (
    EwaOrchestrationTaskSpec,
    EwaWorkerTaskSpec,
    planned_orchestration_task_names,
    planned_worker_task_names,
)


def test_reserved_worker_task_names_are_ewa_namespaced() -> None:
    names = planned_worker_task_names() | planned_orchestration_task_names()
    assert names
    assert all(name.startswith("ewa.platform.") for name in names)
    assert "ewa.platform.outbox_flush" in names
    assert "ewa.platform.outbox_desktop_flush" in names


def test_task_spec_values_match_planned_sets() -> None:
    assert EwaWorkerTaskSpec.PROCESS_RUN.value in planned_worker_task_names()
    assert EwaOrchestrationTaskSpec.ORCHESTRATION_TICK.value in planned_orchestration_task_names()
    assert EwaOrchestrationTaskSpec.COMPANION_EVOLUTION_TICK.value in planned_orchestration_task_names()
