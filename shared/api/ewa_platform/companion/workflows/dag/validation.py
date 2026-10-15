# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pre-execution validation for DAG workflows: quota, graph, placeholders, type safety.
# Invariants:
# - Validation order: quota → graph → placeholders → type safety.
# - ``plain_text`` is documented alias for ``text`` in error messages.
# Related:
# - api/ewa_platform/gateways/routers/companion_user_workflows.py (validate-v2)
# ---

from __future__ import annotations

from collections.abc import Iterator
from uuid import UUID

from pydantic import ValidationError

from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.dag_branch_validation import validate_branching_nodes
from api.ewa_platform.companion.workflows.dag.dag_expression_node_validation import validate_expression_nodes
from api.ewa_platform.companion.workflows.dag.dag_loop_validation import validate_for_each_nodes
from api.ewa_platform.companion.workflows.dag.dag_outbound_policy import validate_outbound_confirm_gates
from api.ewa_platform.companion.workflows.dag.dag_transform_validation import validate_data_transformer_nodes
from api.ewa_platform.companion.workflows.dag.errors import CycleDetectedError, TypeMismatchError
from api.ewa_platform.companion.workflows.dag.graph import build_workflow_graph, topological_sort_node_ids
from api.ewa_platform.companion.workflows.dag.input_specs import expected_input_type
from api.ewa_platform.companion.workflows.dag.limits import max_nodes_for_context, validate_node_quota
from api.ewa_platform.companion.workflows.dag.type_compatibility import format_type_label, types_compatible
from api.ewa_platform.companion.workflows.dag.variable_resolver import collect_placeholders
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowValidateV2Response,
)


def _upstream_node_ids(definition: CompanionWorkflowDefinitionV2, node_id: UUID) -> set[str]:
    target = str(node_id)
    upstream: set[str] = set()
    for edge in definition.edges:
        if str(edge.target_node_id) == target:
            upstream.add(str(edge.source_node_id))
    return upstream


def _iter_template_bindings(
    *,
    node: CompanionWorkflowNodeV2,
    node_id: str,
    definition: CompanionWorkflowDefinitionV2,
) -> Iterator[tuple[str, str, str]]:
    for key, value in node.inputs.items():
        for placeholder in sorted(collect_placeholders(value)):
            yield f"nodes.{node_id}.inputs.{key}", key, placeholder
    for edge in definition.edges:
        if str(edge.target_node_id) != node_id:
            continue
        for key, value in edge.mapping_rules.items():
            for placeholder in sorted(collect_placeholders(value)):
                yield (
                    f"edges.{edge.source_node_id}->{node_id}.mapping_rules.{key}",
                    key,
                    placeholder,
                )


def _validate_placeholders(definition: CompanionWorkflowDefinitionV2) -> list[str]:
    errors: list[str] = []
    node_ids = {str(node.id) for node in definition.nodes}
    ordered = topological_sort_node_ids(build_workflow_graph(definition))
    seen: set[str] = set()

    for node_id in ordered:
        node = next(item for item in definition.nodes if str(item.id) == node_id)
        allowed_nodes = seen | _upstream_node_ids(definition, node.id)

        for path, _input_key, placeholder in _iter_template_bindings(
            node=node,
            node_id=node_id,
            definition=definition,
        ):
            parts = [part for part in placeholder.split(".") if part]
            if not parts:
                errors.append(f"{path}: empty placeholder")
                continue
            if parts[0] == "turn":
                if parts[1:] not in (["user_line"], ["principal_id"]):
                    errors.append(f"{path}: unsupported turn placeholder {{{{{placeholder}}}}}")
                continue
            if parts[0] == "loop":
                if parts[1:] not in (["item"], ["index"], ["total"], ["id"]):
                    errors.append(f"{path}: unsupported loop placeholder {{{{{placeholder}}}}}")
                continue
            head = parts[0]
            if head not in node_ids:
                errors.append(f"{path}: unknown node in placeholder {{{{{placeholder}}}}}")
                continue
            if head not in allowed_nodes:
                errors.append(
                    f"{path}: placeholder {{{{{placeholder}}}}} references node that is not upstream of {node_id}"
                )
        seen.add(node_id)
    return errors


def _validate_type_safety(definition: CompanionWorkflowDefinitionV2) -> list[str]:
    errors: list[str] = []
    nodes_by_id = {str(node.id): node for node in definition.nodes}
    ordered = topological_sort_node_ids(build_workflow_graph(definition))

    for node_id in ordered:
        node = nodes_by_id[node_id]
        for path, input_key, placeholder in _iter_template_bindings(
            node=node,
            node_id=node_id,
            definition=definition,
        ):
            parts = [part for part in placeholder.split(".") if part]
            if not parts or parts[0] == "turn" or parts[0] == "loop":
                continue
            source_id = parts[0]
            source_field = parts[1] if len(parts) > 1 else "value"
            source_node = nodes_by_id.get(source_id)
            if source_node is None:
                continue
            if source_field not in source_node.outputs:
                errors.append(
                    f"{path}: upstream node {source_id} has no declared output {source_field!r} "
                    f"(placeholder {{{{{placeholder}}}}})"
                )
                continue
            expected = expected_input_type(node, input_key)
            if expected is None:
                continue
            source_type = source_node.outputs[source_field].type
            if not types_compatible(source_type, expected):
                exc = TypeMismatchError(
                    source_node_id=source_id,
                    source_field=source_field,
                    source_type=format_type_label(source_type),
                    target_node_id=node_id,
                    target_input_key=input_key,
                    expected_type=format_type_label(expected),
                    path=path,
                )
                errors.append(str(exc))
    return errors


def validate_dag_definition_for_execution(
    definition: CompanionWorkflowDefinitionV2,
    ctx: WorkflowValidationContext | None = None,
) -> CompanionWorkflowValidateV2Response:
    validation_ctx = ctx or WorkflowValidationContext()
    max_allowed = max_nodes_for_context(validation_ctx)
    errors: list[str] = list(validate_node_quota(definition, validation_ctx))
    warnings: list[str] = []
    ordered: list[str] = []
    entrypoints: list[str] = []

    if not errors:
        try:
            graph = build_workflow_graph(definition)
            ordered = topological_sort_node_ids(graph)
            entrypoints = list(graph.entrypoint_node_ids())
        except CycleDetectedError as exc:
            errors.append(str(exc))
        except ValidationError as exc:
            errors.extend(str(item.get("msg", item)) for item in exc.errors())

    if not errors and ordered:
        errors.extend(_validate_placeholders(definition))
    if not errors and ordered:
        errors.extend(_validate_type_safety(definition))
    if not errors and ordered:
        errors.extend(validate_outbound_confirm_gates(definition))
    if not errors and ordered:
        branch_errors, branch_warnings = validate_branching_nodes(definition)
        errors.extend(branch_errors)
        warnings.extend(branch_warnings)
    if not errors and ordered:
        loop_errors, loop_warnings = validate_for_each_nodes(definition)
        errors.extend(loop_errors)
        warnings.extend(loop_warnings)
    if not errors and ordered:
        transform_errors, transform_warnings = validate_data_transformer_nodes(definition)
        errors.extend(transform_errors)
        warnings.extend(transform_warnings)
    if not errors and ordered:
        expression_errors, expression_warnings = validate_expression_nodes(definition)
        errors.extend(expression_errors)
        warnings.extend(expression_warnings)

    return CompanionWorkflowValidateV2Response(
        ok=not errors,
        workflow_id=definition.workflow_id,
        version=definition.version,
        node_count=len(definition.nodes),
        edge_count=len(definition.edges),
        max_nodes_allowed=max_allowed,
        ordered_node_ids=ordered,
        entrypoint_node_ids=entrypoints,
        errors=errors,
        warnings=warnings,
    )


def validate_dag_definition_raw(
    raw: dict[str, object],
    ctx: WorkflowValidationContext | None = None,
) -> CompanionWorkflowValidateV2Response:
    validation_ctx = ctx or WorkflowValidationContext()
    max_allowed = max_nodes_for_context(validation_ctx)
    try:
        definition = CompanionWorkflowDefinitionV2.model_validate(raw)
    except ValidationError as exc:
        messages = [f"{'.'.join(str(part) for part in err.get('loc', ()))}: {err.get('msg')}" for err in exc.errors()]
        workflow_id = str(raw.get("workflow_id") or "")
        version = int(raw.get("version") or 0)
        return CompanionWorkflowValidateV2Response(
            ok=False,
            workflow_id=workflow_id,
            version=version,
            node_count=len(raw.get("nodes") or []) if isinstance(raw.get("nodes"), list) else 0,
            edge_count=len(raw.get("edges") or []) if isinstance(raw.get("edges"), list) else 0,
            max_nodes_allowed=max_allowed,
            errors=messages,
        )
    return validate_dag_definition_for_execution(definition, validation_ctx)


__all__ = (
    "validate_dag_definition_for_execution",
    "validate_dag_definition_raw",
)
