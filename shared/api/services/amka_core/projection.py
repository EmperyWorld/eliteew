# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Builds a portable projection from an in-memory AMKA core run result.
# The projection mirrors the persisted marketing projection shape without depending on marketing tables.
# Invariants:
# - Projection is derived data only; it must not call drivers, stores, or external services.
# - Trace stages are serialized with stable AMKA core enum values for UI/export consumers.
# Related:
# - shared/api/services/amka_core/contracts.py
# - shared/api/services/amka_core/trace_serialization.py
# - shared/api/services/marketing_cabinet/amka_standalone_projection.py
# ---
from __future__ import annotations

from collections import Counter
from typing import Any

from api.services.amka_core.contracts import (
    AmkaCoreRunStatus,
    AmkaCoreStage,
    AmkaRunResult,
)
from api.services.amka_core.trace_serialization import (
    serialize_amka_trace_events as _serialize_amka_trace_events,
)


def _stage_value(stage: AmkaCoreStage | str) -> str:
    return stage.value if isinstance(stage, AmkaCoreStage) else str(stage)


def _current_stage_for_result(result: AmkaRunResult) -> str:
    if result.status == AmkaCoreRunStatus.AWAITING_APPROVAL:
        return AmkaCoreStage.APPROVAL.value
    if result.traces:
        return _stage_value(result.traces[-1].stage)
    if result.snapshot is not None:
        return AmkaCoreStage.SNAPSHOT.value
    return AmkaCoreStage.PLAN.value


def _task_status_counts(result: AmkaRunResult) -> dict[str, int]:
    if not result.tasks:
        return {"none": 1}
    if result.status == AmkaCoreRunStatus.AWAITING_APPROVAL:
        return {"awaiting_approval": len(result.tasks)}
    if result.status == AmkaCoreRunStatus.COMPLETED:
        return {"completed": len(result.tasks)}
    return {result.status.value: len(result.tasks)}


def build_amka_core_run_projection(result: AmkaRunResult) -> dict[str, Any]:
    """Return a standalone AMKA projection for a core engine result."""

    stage_counts = Counter(_stage_value(trace.stage) for trace in result.traces)
    step_status_counts = _task_status_counts(result)
    trace_events = _serialize_amka_trace_events(result.traces)

    return {
        "driver_key": result.subject.driver_key,
        "domain_profile": result.subject.domain_profile,
        "subject": {
            "subject_id": result.subject.subject_id,
            "display_name": result.subject.display_name,
            "metadata": dict(result.subject.metadata),
        },
        "status": result.status.value,
        "current_stage": _current_stage_for_result(result),
        "stage_counts": dict(stage_counts),
        "step_status_counts": step_status_counts,
        "task_status_counts": step_status_counts,
        "trace_events": trace_events,
        "contract": {
            "read": result.snapshot is not None,
            "plan": True,
            "act": "task_results" in result.observations,
            "observe": bool(result.observations),
            "policy": result.policy is not None,
            "pulse": result.pulse is not None,
        },
        "policy": {
            "allowed": result.policy.allowed if result.policy else None,
            "mode": result.policy.mode if result.policy else None,
            "denied_operation_keys": list(result.policy.denied_operation_keys) if result.policy else [],
        },
    }
