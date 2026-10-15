# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Convert linear v1 workflow steps into a v2 DAG definition for migration tooling.
# Invariants:
# - Preserves step order via sequential edges; ``args_template`` maps to node ``inputs``.
# Related:
# - api/ewa_platform/schemas/pydantic/companion_workflow.py
# ---

from __future__ import annotations

import uuid
from uuid import UUID

from api.ewa_platform.schemas.pydantic.companion_workflow import (
    CompanionWorkflowDefinitionV1,
    CompanionWorkflowStepV1,
)
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowEdgeV2,
    CompanionWorkflowNodeConfigV2,
    CompanionWorkflowNodeTypeV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowOutputSpecV2,
)


def _step_node_id(workflow_id: str, step_key: str) -> UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"{workflow_id}:{step_key}")


def _map_step_type(step: CompanionWorkflowStepV1) -> CompanionWorkflowNodeTypeV2:
    tool = str(step.tool_name or "").strip()
    if "image" in tool:
        return "image_gen"
    if step.kind == "confirm_gate":
        return "logic_filter"
    return "api_call"


def _node_config_for_step(
    step: CompanionWorkflowStepV1,
    node_type: CompanionWorkflowNodeTypeV2,
) -> CompanionWorkflowNodeConfigV2:
    tool_name = str(step.tool_name or "").strip() or None
    if node_type == "api_call" and tool_name:
        return CompanionWorkflowNodeConfigV2(tool_name=tool_name)
    return CompanionWorkflowNodeConfigV2()


def linear_steps_to_dag_v2(definition: CompanionWorkflowDefinitionV1) -> CompanionWorkflowDefinitionV2:
    nodes: list[CompanionWorkflowNodeV2] = []
    edges: list[CompanionWorkflowEdgeV2] = []
    node_ids: list[UUID] = []

    for step in definition.steps:
        node_id = _step_node_id(definition.workflow_id, step.step_key)
        node_ids.append(node_id)
        node_type = _map_step_type(step)
        nodes.append(
            CompanionWorkflowNodeV2(
                id=node_id,
                type=node_type,
                mode="stateful",
                config=_node_config_for_step(step, node_type),
                inputs=dict(step.args_template or {}),
                outputs={"reply": CompanionWorkflowOutputSpecV2(type="text")},
                title_ru=step.title_ru,
                title_en=step.title_en,
            )
        )

    for index in range(len(node_ids) - 1):
        edges.append(
            CompanionWorkflowEdgeV2(
                source_node_id=node_ids[index],
                target_node_id=node_ids[index + 1],
            )
        )

    return CompanionWorkflowDefinitionV2(
        schema_version=2,
        workflow_id=definition.workflow_id,
        version=definition.version,
        title_ru=definition.title_ru,
        title_en=definition.title_en,
        description_ru=definition.description_ru,
        description_en=definition.description_en,
        enabled=definition.enabled,
        triggers=list(definition.triggers),
        nodes=nodes,
        edges=edges,
        execution_mode=definition.execution_mode,
        env_gate=definition.env_gate,
        tags=list(definition.tags),
    )


__all__ = ("linear_steps_to_dag_v2",)
