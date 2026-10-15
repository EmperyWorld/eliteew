# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Documents future Celery/RQ task names for EWA without importing broker clients;
# re-exports orchestration task payload ``TypedDict`` shapes (``CompanionEvolutionTickTaskPayload``, etc.).
# Invariants:
# - No task registration against the production Celery app occurs from this package.
# Related:
# - api/ewa_platform/core/__init__.py
# ---
from __future__ import annotations

from api.ewa_platform.workers.orchestration_tasks import (
    AmkaOrchestrationTaskSpec,
    CompanionEvolutionTickTaskPayload,
    EwaOrchestrationTaskSpec,
    OrchestrationTickTaskPayload,
    OutboxDesktopFlushTaskPayload,
    planned_orchestration_task_names,
)
from api.ewa_platform.workers.tasks import AmkaWorkerTaskSpec, EwaWorkerTaskSpec, planned_worker_task_names

__all__ = [
    "AmkaOrchestrationTaskSpec",
    "AmkaWorkerTaskSpec",
    "CompanionEvolutionTickTaskPayload",
    "EwaOrchestrationTaskSpec",
    "EwaWorkerTaskSpec",
    "OrchestrationTickTaskPayload",
    "OutboxDesktopFlushTaskPayload",
    "planned_orchestration_task_names",
    "planned_worker_task_names",
]
