# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Reserved Celery/RQ task names for orchestration and desktop outbox (no broker wiring);
# ``TypedDict`` shapes document expected JSON payloads for workers.
# Invariants:
# - Stable string values once operators configure workers; includes companion evolution Celery identifier.
# - Names are reserved under ``ewa.platform.*``; no broker registration happens in this module.
# Related:
# - api/ewa_platform/workers/tasks.py
# - api/ewa_platform/workers/evolution_tick_task.py (Celery task ``COMPANION_EVOLUTION_TICK``)
# ---
"""Orchestration-related worker task identifiers and typed payload shapes (documentation)."""

from __future__ import annotations

from enum import StrEnum
from typing import Any, TypedDict


class EwaOrchestrationTaskSpec(StrEnum):
    """Namespaced task keys for orchestration loop / outbox."""

    ORCHESTRATION_TICK = "ewa.platform.orchestration_tick"
    OUTBOX_DESKTOP_FLUSH = "ewa.platform.outbox_desktop_flush"
    COMPANION_EVOLUTION_TICK = "ewa.platform.companion_evolution_tick"
    COMPANION_RUN_TASK = "ewa.platform.companion_run_task"
    AGENTIC_LOOP_TICK = "ewa.platform.agentic_loop_tick"
    AGENTIC_STEP_TASK = "ewa.platform.agentic_step_task"


class OrchestrationTickTaskPayload(TypedDict, total=False):
    """Expected JSON keys for ``ORCHESTRATION_TICK`` tasks (documentation-only)."""

    session_id: str
    correlation_id: str
    stage_hint: str


class OutboxDesktopFlushTaskPayload(TypedDict, total=False):
    """Expected JSON keys for ``OUTBOX_DESKTOP_FLUSH`` tasks (documentation-only)."""

    batch_size: int
    session_id: str


class CompanionEvolutionTickTaskPayload(TypedDict, total=False):
    """Expected JSON keys for ``COMPANION_EVOLUTION_TICK`` (worker: ``api.ewa_platform.workers.evolution_tick_task``)."""

    principal_id: str
    tick_reason: str
    learned_preferences_delta: dict[str, Any]
    max_principals_per_tick: int
    idempotency_key: str


class CompanionRunTaskPayload(TypedDict, total=False):
    """Expected JSON keys for ``COMPANION_RUN_TASK`` (worker: ``companion_task_runner``)."""

    run_id: str
    step_index: int
    job_payload: dict[str, Any]


class AgenticLoopTickPayload(TypedDict, total=False):
    """Expected JSON keys for ``AGENTIC_LOOP_TICK`` (worker: ``agentic_task_runner``)."""

    session_id: str
    job_payload: dict[str, Any]


class AgenticStepTaskPayload(TypedDict, total=False):
    """Expected JSON keys for ``AGENTIC_STEP_TASK`` (worker: ``agentic_step_runner``)."""

    session_id: str
    job_payload: dict[str, Any]


def planned_orchestration_task_names() -> frozenset[str]:
    return frozenset(m.value for m in EwaOrchestrationTaskSpec)


# Backward-compatible symbol for old imports; values are EWA names.
AmkaOrchestrationTaskSpec = EwaOrchestrationTaskSpec
