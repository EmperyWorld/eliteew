# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Validate decision/switch boolean expressions at DAG save time.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_expression_validation.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.workflows.dag.dag_expression_validation import validate_boolean_expression_syntax
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2


def validate_expression_nodes(definition: CompanionWorkflowDefinitionV2) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    for node in definition.nodes:
        node_id = str(node.id)
        node_type = str(node.type)
        if node_type == "decision":
            expression = str(node.config.condition_expression or "").strip()
            if expression:
                for message in validate_boolean_expression_syntax(expression):
                    errors.append(f"node {node_id} (decision): {message}")
            continue
        if node_type != "switch":
            continue
        for case in node.config.switch_cases or []:
            expression = str(case.expression or "").strip()
            if not expression:
                continue
            branch = str(case.branch or "case")
            for message in validate_boolean_expression_syntax(expression):
                errors.append(f"node {node_id} (switch case {branch!r}): {message}")
    return errors, warnings


__all__ = ("validate_expression_nodes",)
