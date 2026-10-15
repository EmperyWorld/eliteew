# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Persist DAG v2 runtime state inside ``ewa_companion_task_runs.plan_payload`` for Celery workers.
# Invariants:
# - State slice lives under ``plan_payload["dag_state"]`` with ``dag_engine: "v2"``.
# - ``registry_snapshot``, ``node_outcomes``, and ``pending_node_ids`` round-trip losslessly.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_node_executor.py
# - api/ewa_platform/companion/workflows/dag/dag_workflow_starter.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.graph import build_workflow_graph, topological_sort_node_ids
from api.ewa_platform.companion.workflows.dag.runner import NodeRunOutcome
from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry
from api.ewa_platform.companion.workflows.dag.validation import validate_dag_definition_for_execution
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2

DAG_ENGINE_V2 = "v2"
DAG_STATE_KEY = "dag_state"
PLAN_KIND_V2 = "action_workflow_v2"
DAG_NODE_STEP_KIND = "dag_node"


@dataclass
class DagPersistedState:
    """Serializable DAG runtime slice stored in ``plan_payload``."""

    ordered_node_ids: list[str] = field(default_factory=list)
    pending_node_ids: list[str] = field(default_factory=list)
    completed_node_ids: list[str] = field(default_factory=list)
    skipped_node_ids: list[str] = field(default_factory=list)
    current_node_id: str | None = None
    registry_snapshot: dict[str, dict[str, Any]] = field(default_factory=dict)
    node_outcomes: dict[str, NodeRunOutcome] = field(default_factory=dict)
    failed_node_id: str | None = None
    error: str | None = None
    user_line: str = ""
    content_catalog_user_id: str = ""


def is_dag_v2_plan(plan_payload: Mapping[str, Any] | None) -> bool:
    plan = dict(plan_payload or {})
    if str(plan.get("dag_engine") or "").strip() == DAG_ENGINE_V2:
        return True
    if str(plan.get("kind") or "").strip() == PLAN_KIND_V2:
        return True
    dag_state = plan.get(DAG_STATE_KEY)
    return isinstance(dag_state, Mapping) and str(dag_state.get("dag_engine") or "") == DAG_ENGINE_V2


def definition_from_plan(plan_payload: Mapping[str, Any] | None) -> CompanionWorkflowDefinitionV2 | None:
    plan = dict(plan_payload or {})
    raw = plan.get("definition_json")
    if not isinstance(raw, Mapping):
        return None
    try:
        return CompanionWorkflowDefinitionV2.model_validate(raw)
    except Exception:  # noqa: BLE001 — invalid persisted definition is handled by callers
        return None


def _serialize_node_outcome(outcome: NodeRunOutcome) -> dict[str, Any]:
    return {
        "status": outcome.status,
        "attempts": int(outcome.attempts),
        "error": outcome.error,
        "used_fallback": bool(outcome.used_fallback),
        "skipped_due_to_error": bool(outcome.skipped_due_to_error),
        "skipped_due_to_branch": bool(outcome.skipped_due_to_branch),
    }


def _deserialize_node_outcome(raw: Mapping[str, Any]) -> NodeRunOutcome:
    return NodeRunOutcome(
        status=str(raw.get("status") or "failed"),
        attempts=int(raw.get("attempts") or 0),
        error=str(raw.get("error") or "") or None,
        used_fallback=bool(raw.get("used_fallback")),
        skipped_due_to_error=bool(raw.get("skipped_due_to_error")),
        skipped_due_to_branch=bool(raw.get("skipped_due_to_branch")),
    )


def dag_state_to_mapping(state: DagPersistedState) -> dict[str, Any]:
    return {
        "dag_engine": DAG_ENGINE_V2,
        "ordered_node_ids": list(state.ordered_node_ids),
        "pending_node_ids": list(state.pending_node_ids),
        "completed_node_ids": list(state.completed_node_ids),
        "skipped_node_ids": list(state.skipped_node_ids),
        "current_node_id": state.current_node_id,
        "registry_snapshot": {node_id: dict(outputs) for node_id, outputs in state.registry_snapshot.items()},
        "node_outcomes": {
            node_id: _serialize_node_outcome(outcome) for node_id, outcome in state.node_outcomes.items()
        },
        "failed_node_id": state.failed_node_id,
        "error": state.error,
        "user_line": state.user_line,
        "content_catalog_user_id": state.content_catalog_user_id,
    }


def load_dag_state(plan_payload: Mapping[str, Any] | None) -> DagPersistedState | None:
    plan = dict(plan_payload or {})
    raw = plan.get(DAG_STATE_KEY)
    if not isinstance(raw, Mapping):
        return None

    registry_raw = raw.get("registry_snapshot")
    registry: dict[str, dict[str, Any]] = {}
    if isinstance(registry_raw, Mapping):
        for node_id, outputs in registry_raw.items():
            if isinstance(outputs, Mapping):
                registry[str(node_id)] = dict(outputs)

    outcomes_raw = raw.get("node_outcomes")
    outcomes: dict[str, NodeRunOutcome] = {}
    if isinstance(outcomes_raw, Mapping):
        for node_id, item in outcomes_raw.items():
            if isinstance(item, Mapping):
                outcomes[str(node_id)] = _deserialize_node_outcome(item)

    return DagPersistedState(
        ordered_node_ids=[str(x) for x in list(raw.get("ordered_node_ids") or [])],
        pending_node_ids=[str(x) for x in list(raw.get("pending_node_ids") or [])],
        completed_node_ids=[str(x) for x in list(raw.get("completed_node_ids") or [])],
        skipped_node_ids=[str(x) for x in list(raw.get("skipped_node_ids") or [])],
        current_node_id=str(raw.get("current_node_id") or "").strip() or None,
        registry_snapshot=registry,
        node_outcomes=outcomes,
        failed_node_id=str(raw.get("failed_node_id") or "").strip() or None,
        error=str(raw.get("error") or "").strip() or None,
        user_line=str(raw.get("user_line") or ""),
        content_catalog_user_id=str(raw.get("content_catalog_user_id") or ""),
    )


def merge_dag_state_into_plan(
    plan_payload: Mapping[str, Any] | None,
    state: DagPersistedState,
) -> dict[str, Any]:
    plan = dict(plan_payload or {})
    plan["dag_engine"] = DAG_ENGINE_V2
    plan.setdefault("kind", PLAN_KIND_V2)
    plan[DAG_STATE_KEY] = dag_state_to_mapping(state)
    return plan


def registry_from_dag_state(state: DagPersistedState, *, principal_id: str) -> WorkflowStateRegistry:
    registry = WorkflowStateRegistry(
        user_line=state.user_line,
        principal_id=principal_id,
    )
    for node_id, outputs in state.registry_snapshot.items():
        registry.register(node_id, outputs)
    return registry


def build_initial_dag_state(
    definition: CompanionWorkflowDefinitionV2,
    *,
    user_line: str,
    content_catalog_user_id: str,
    validation_ctx: WorkflowValidationContext,
) -> tuple[DagPersistedState | None, list[str]]:
    """Validate definition and produce the initial persisted DAG slice."""

    validation = validate_dag_definition_for_execution(definition, validation_ctx)
    if not validation.ok:
        return None, list(validation.errors)

    graph = build_workflow_graph(definition)
    ordered = topological_sort_node_ids(graph)
    first = ordered[0] if ordered else None
    return (
        DagPersistedState(
            ordered_node_ids=ordered,
            pending_node_ids=list(ordered),
            completed_node_ids=[],
            skipped_node_ids=[],
            current_node_id=first,
            registry_snapshot={},
            node_outcomes={},
            user_line=user_line,
            content_catalog_user_id=content_catalog_user_id,
        ),
        [],
    )


def next_pending_node_id(state: DagPersistedState) -> str | None:
    pending = set(state.pending_node_ids)
    skipped = set(state.skipped_node_ids)
    for node_id in state.ordered_node_ids:
        if node_id in pending and node_id not in skipped:
            return node_id
    return None


def step_index_for_node_id(steps: list[Mapping[str, Any]], node_id: str) -> int | None:
    target = str(node_id or "").strip()
    if not target:
        return None
    for step in steps:
        inp = step.get("input_payload")
        payload = dict(inp) if isinstance(inp, Mapping) else {}
        if str(payload.get("node_id") or "").strip() == target:
            return int(step.get("step_index") or 0) or None
    return None


__all__ = (
    "DAG_ENGINE_V2",
    "DAG_NODE_STEP_KIND",
    "DAG_STATE_KEY",
    "DagPersistedState",
    "PLAN_KIND_V2",
    "build_initial_dag_state",
    "dag_state_to_mapping",
    "definition_from_plan",
    "is_dag_v2_plan",
    "load_dag_state",
    "merge_dag_state_into_plan",
    "next_pending_node_id",
    "registry_from_dag_state",
    "step_index_for_node_id",
)
