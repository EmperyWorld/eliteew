# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Validate ``data_transformer`` node config at DAG save time.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_data_transform.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.workflows.dag.dag_data_transform import TRANSFORM_OPS
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2


def validate_data_transformer_nodes(definition: CompanionWorkflowDefinitionV2) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    for node in definition.nodes:
        if str(node.type) != "data_transformer":
            continue
        node_id = str(node.id)
        op = str(node.config.transform_op or "").strip().lower()
        if not op:
            errors.append(f"node {node_id} (data_transformer): transform_op is required")
            continue
        if op not in TRANSFORM_OPS:
            errors.append(f"node {node_id} (data_transformer): unsupported transform_op {op!r}")
    return errors, warnings


__all__ = ("validate_data_transformer_nodes",)
