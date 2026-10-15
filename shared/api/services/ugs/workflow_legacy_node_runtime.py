#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.
# Purpose:
# Legacy workflow node evaluation, transforms, and generation payload builders.
# Invariants:
# - Child module of WorkflowService decomposition; must not import workflow_service.
# Related:
# - api/services/ugs/workflow_service.py
# ---

import json
from typing import Any

from api.services.ugs.workflow_builder_catalog_data import (
    LEGACY_CONDITION_OPERATORS,
    LEGACY_EXECUTABLE_NODE_TYPES,
    LEGACY_GENERATION_TYPE_MAP,
    LEGACY_TRANSFORM_TYPES,
)
from api.services.ugs.workflow_legacy_utility_nodes import WorkflowLegacyUtilityNodesMixin


class WorkflowLegacyNodeRuntimeMixin(WorkflowLegacyUtilityNodesMixin):
    """Mixin for WorkflowService — plan/condition/transform/generation payloads."""

    def _extract_node_generation_type(self, node: dict[str, Any]) -> str | None:
        node_data = node.get("data")
        if not isinstance(node_data, dict):
            return None
        raw_type = node_data.get("generationType") or node_data.get("generation_type")
        if not isinstance(raw_type, str):
            return None
        normalized = raw_type.strip()
        return normalized or None

    def _map_legacy_generation_type(self, generation_type: str | None) -> str | None:
        if generation_type is None:
            return None
        return LEGACY_GENERATION_TYPE_MAP.get(generation_type.strip())

    def _build_legacy_execution_plan(self, workflow_data: dict[str, Any]) -> dict[str, Any]:
        if not self._validate_workflow_data(workflow_data):
            msg = "Некорректная структура воркфлоу."
            raise ValueError(msg)

        nodes = workflow_data.get("nodes", [])
        edges = workflow_data.get("edges", [])
        nodes_by_id: dict[str, dict[str, Any]] = {}
        generation_nodes: dict[str, dict[str, Any]] = {}
        ordered_node_ids: list[str] = []
        adjacency: dict[str, list[str]] = {}
        indegree: dict[str, int] = {}

        for node in nodes:
            if not isinstance(node, dict):
                continue
            node_id = str(node.get("id") or "").strip()
            node_type = str(node.get("type") or "").strip()
            if not node_id:
                continue
            if node_type not in LEGACY_EXECUTABLE_NODE_TYPES:
                msg = (
                    "Legacy Workflow Builder пока поддерживает только input/output/"
                    "generation/condition/transform/section/constant/merge/delay/"
                    "split/pick/wrap/json_encode/json_decode/text_case/text_join узлы. "
                    f"Найден неподдерживаемый тип: {node_type or 'unknown'}."
                )
                raise ValueError(msg)
            nodes_by_id[node_id] = node
            adjacency[node_id] = []
            indegree[node_id] = 0
            ordered_node_ids.append(node_id)

            if node_type != "generation":
                continue

            legacy_type = self._extract_node_generation_type(node)
            runtime_type = self._map_legacy_generation_type(legacy_type)
            if runtime_type is None:
                msg = f"Для legacy Workflow Builder пока не настроен runtime для узла '{legacy_type or node_id}'."
                raise ValueError(msg)

            generation_nodes[node_id] = {
                "node": node,
                "legacy_type": legacy_type,
                "runtime_type": runtime_type,
            }

        if not generation_nodes:
            msg = "Во workflow нет generation-узлов для запуска."
            raise ValueError(msg)

        for edge in edges:
            if not isinstance(edge, dict):
                continue
            source_id = str(edge.get("source") or "").strip()
            target_id = str(edge.get("target") or "").strip()
            if source_id in nodes_by_id and target_id in nodes_by_id:
                adjacency[source_id].append(target_id)
                indegree[target_id] += 1

        queue = [node_id for node_id in ordered_node_ids if indegree[node_id] == 0]
        ordered_nodes: list[str] = []
        while queue:
            current = queue.pop(0)
            ordered_nodes.append(current)
            for target_id in adjacency[current]:
                indegree[target_id] -= 1
                if indegree[target_id] == 0:
                    queue.append(target_id)

        if len(ordered_nodes) != len(nodes_by_id):
            msg = "Legacy Workflow Builder не может запустить граф с циклом или неоднозначными зависимостями."
            raise ValueError(msg)

        return {
            "nodes_by_id": nodes_by_id,
            "edges": edges,
            "generation_nodes": generation_nodes,
            "ordered_node_ids": ordered_nodes,
        }

    def _build_default_legacy_prompt(self, runtime_type: str) -> str:
        if runtime_type == "image_generation_comfyui":
            return "Futuristic city skyline at sunset in neon colors"
        if runtime_type == "audio_generation_tts":
            return "Добро пожаловать в UGS Workflow Builder. Это тестовый запуск синтеза речи."
        return "Сделай краткий полезный ответ на русском языке для тестового запуска workflow."

    def _extract_incoming_edges(self, *, node_id: str, edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [edge for edge in edges if isinstance(edge, dict) and str(edge.get("target") or "").strip() == node_id]

    def _first_upstream_payload(
        self,
        *,
        node_id: str,
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> Any:
        for edge in self._extract_incoming_edges(node_id=node_id, edges=edges):
            ctx = self._resolve_source_context_for_edge(edge=edge, nodes_by_id=nodes_by_id, node_outputs=node_outputs)
            if ctx is None:
                continue
            return ctx.get("__result__", ctx) if isinstance(ctx, dict) else ctx
        return None

    def _extract_outgoing_edges(self, *, node_id: str, edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [edge for edge in edges if isinstance(edge, dict) and str(edge.get("source") or "").strip() == node_id]

    def _coerce_condition_compare_value(self, raw_value: Any) -> Any:
        if not isinstance(raw_value, str):
            return raw_value
        normalized = raw_value.strip()
        if normalized == "":
            return ""
        lowered = normalized.lower()
        if lowered == "true":
            return True
        if lowered == "false":
            return False
        if lowered == "null":
            return None
        try:
            if "." in normalized:
                return float(normalized)
            return int(normalized)
        except ValueError:
            return normalized

    def _flatten_messages_to_prompt(self, messages: Any) -> str | None:
        if not isinstance(messages, list):
            return None
        parts: list[str] = []
        for item in messages:
            if isinstance(item, dict):
                role = str(item.get("role") or "user").strip()
                content = item.get("content")
                if isinstance(content, str) and content.strip():
                    parts.append(f"{role}: {content.strip()}")
        joined = "\n".join(parts).strip()
        return joined or None

    def _extract_text_result(self, value: Any) -> str | None:
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        if not isinstance(value, dict):
            return None

        for key in (
            "content",
            "text",
            "response",
            "message",
            "output",
            "analysis",
            "summary",
            "transcription",
            "caption",
            "answer",
        ):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()

        nested_result = value.get("result")
        if nested_result is not None and nested_result is not value:
            nested_text = self._extract_text_result(nested_result)
            if nested_text:
                return nested_text

        choices = value.get("choices")
        if isinstance(choices, list):
            for choice in choices:
                if isinstance(choice, dict):
                    nested_text = self._extract_text_result(
                        choice.get("message", {}).get("content")
                        if isinstance(choice.get("message"), dict)
                        else choice.get("text")
                    )
                    if nested_text:
                        return nested_text
        return None

    def _extract_value_from_context(self, context: Any, key: str | None) -> Any:
        if context is None:
            return None
        if key is None or key in {"", "input"}:
            return context
        if key in {"value", "output"} and not isinstance(context, dict):
            return context
        if isinstance(context, dict):
            if key in context:
                return context[key]
            if "__result__" in context:
                nested = self._extract_value_from_context(context["__result__"], key)
                if nested is not None:
                    return nested
            if key in {"text", "response", "analysis", "summary", "transcription"}:
                return self._extract_text_result(context)
            if key in {"images", "image"}:
                return (
                    context.get("images")
                    or context.get("image")
                    or context.get("image_data")
                    or context.get("image_url")
                    or context.get("content_id")
                )
            if key == "audio":
                return (
                    context.get("audio")
                    or context.get("audio_url")
                    or context.get("audio_data")
                    or context.get("content_id")
                )
            if key == "value":
                return context.get("value") or context.get("output") or context.get("__result__")
        return None

    def _build_generation_output_bindings(self, node: dict[str, Any], raw_result: Any) -> dict[str, Any]:
        node_data = node.get("data")
        outputs = node_data.get("outputs") if isinstance(node_data, dict) else []
        bindings: dict[str, Any] = {"__result__": raw_result}
        if isinstance(outputs, list):
            for output_key in outputs:
                if not isinstance(output_key, str):
                    continue
                extracted = self._extract_value_from_context(raw_result, output_key)
                if extracted is None and output_key in {"text", "response", "analysis", "summary"}:
                    extracted = self._extract_text_result(raw_result)
                if extracted is not None:
                    bindings[output_key] = extracted
        text_value = self._extract_text_result(raw_result)
        if text_value and "text" not in bindings:
            bindings["text"] = text_value
        return bindings

    def _resolve_source_context_for_edge(
        self,
        *,
        edge: dict[str, Any],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> Any:
        source_id = str(edge.get("source") or "").strip()
        source_node = nodes_by_id.get(source_id)
        if not isinstance(source_node, dict):
            return None
        source_node_type = str(source_node.get("type") or "").strip()
        source_context = node_outputs.get(source_id)
        if source_context is None:
            return None

        if source_node_type == "condition":
            active_branch = None
            if isinstance(source_context, dict):
                active_branch = source_context.get("__active_branch__")
            source_handle = str(edge.get("sourceHandle") or "true").strip() or "true"
            if active_branch != source_handle:
                return None
        return source_context

    def _should_execute_generation_node(
        self,
        *,
        node_id: str,
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> bool:
        incoming_edges = self._extract_incoming_edges(node_id=node_id, edges=edges)
        condition_edges = [
            edge
            for edge in incoming_edges
            if isinstance(nodes_by_id.get(str(edge.get("source") or "").strip()), dict)
            and str(nodes_by_id.get(str(edge.get("source") or "").strip(), {}).get("type") or "").strip() == "condition"
        ]
        if not condition_edges:
            return True
        return any(
            self._resolve_source_context_for_edge(edge=edge, nodes_by_id=nodes_by_id, node_outputs=node_outputs)
            is not None
            for edge in condition_edges
        )

    def _build_input_node_output(
        self,
        *,
        node: dict[str, Any],
        execution_input_data: dict[str, Any],
    ) -> dict[str, Any]:
        node_data = node.get("data")
        config = node_data.get("config") if isinstance(node_data, dict) else {}
        if not isinstance(config, dict):
            config = {}
        key = str(config.get("key") or node.get("id") or "input").strip()
        default_value = config.get("defaultValue")
        value = execution_input_data.get(key, default_value)
        if value is None and key in execution_input_data:
            value = execution_input_data[key]
        if config.get("required") and (value is None or (isinstance(value, str) and not value.strip())):
            node_label = node_data.get("label") if isinstance(node_data, dict) else None
            msg = f"Для input-узла '{node_label or key}' требуется значение."
            raise ValueError(msg)
        return {
            "__result__": value,
            "value": value,
            "output": value,
            key: value,
            "key": key,
            "input_type": config.get("inputType") or "text",
        }

    def _evaluate_condition_node(
        self,
        *,
        node: dict[str, Any],
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> dict[str, Any]:
        node_id = str(node.get("id") or "").strip()
        node_data = node.get("data")
        config = node_data.get("config") if isinstance(node_data, dict) else {}
        if not isinstance(config, dict):
            config = {}
        incoming_edges = self._extract_incoming_edges(node_id=node_id, edges=edges)
        incoming_context = None
        for edge in incoming_edges:
            incoming_context = self._resolve_source_context_for_edge(
                edge=edge, nodes_by_id=nodes_by_id, node_outputs=node_outputs
            )
            if incoming_context is not None:
                break

        source_key = (
            config.get("sourceKey")
            or config.get("source_key")
            or config.get("inputKey")
            or config.get("input_key")
            or "value"
        )
        left_value = self._extract_value_from_context(
            incoming_context,
            str(source_key) if source_key is not None else None,
        )
        operator = str(config.get("operator") or "not_empty").strip() or "not_empty"
        if operator not in LEGACY_CONDITION_OPERATORS:
            operator = "not_empty"
        right_value = self._coerce_condition_compare_value(config.get("compareValue") or config.get("compare_value"))

        if operator == "exists":
            passed = left_value is not None
        elif operator == "not_exists":
            passed = left_value is None
        elif operator == "equals":
            passed = left_value == right_value
        elif operator == "not_equals":
            passed = left_value != right_value
        elif operator == "contains":
            passed = isinstance(left_value, str) and right_value is not None and str(right_value) in left_value
        elif operator == "greater_than":
            try:
                passed = float(left_value) > float(right_value)
            except (TypeError, ValueError):  # fmt: skip
                passed = False
        elif operator == "less_than":
            try:
                passed = float(left_value) < float(right_value)
            except (TypeError, ValueError):  # fmt: skip
                passed = False
        elif operator == "empty":
            passed = left_value in (None, "", [], {})
        else:
            passed = left_value not in (None, "", [], {})

        active_branch = "true" if passed else "false"
        return {
            "__result__": incoming_context,
            "__active_branch__": active_branch,
            "true": incoming_context if passed else None,
            "false": incoming_context if not passed else None,
            "value": left_value,
            "passed": passed,
            "operator": operator,
        }

    def _apply_transform_node(
        self,
        *,
        node: dict[str, Any],
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> dict[str, Any]:
        node_id = str(node.get("id") or "").strip()
        node_data = node.get("data")
        config = node_data.get("config") if isinstance(node_data, dict) else {}
        if not isinstance(config, dict):
            config = {}
        incoming_edges = self._extract_incoming_edges(node_id=node_id, edges=edges)
        incoming_contexts: list[Any] = []
        for edge in incoming_edges:
            context = self._resolve_source_context_for_edge(
                edge=edge, nodes_by_id=nodes_by_id, node_outputs=node_outputs
            )
            if context is not None:
                incoming_contexts.append(context)
        primary_context = incoming_contexts[0] if incoming_contexts else None

        transform_type = str(config.get("transformType") or "passthrough").strip()
        if transform_type not in LEGACY_TRANSFORM_TYPES:
            transform_type = "passthrough"
        output_key = str(config.get("outputKey") or "output").strip() or "output"
        source_key = str(config.get("sourceKey") or "value").strip() or "value"

        if transform_type == "extract_key":
            transformed = self._extract_value_from_context(primary_context, source_key)
        elif transform_type == "to_text":
            extracted = self._extract_value_from_context(primary_context, source_key)
            if extracted is None:
                transformed = self._extract_text_result(primary_context)
            elif isinstance(extracted, str):
                transformed = extracted
            else:
                transformed = str(extracted)
        elif transform_type == "template":
            template = str(config.get("template") or "").strip()
            transformed = template
            if template:
                if isinstance(primary_context, dict):
                    for key, value in primary_context.items():
                        if isinstance(key, str):
                            transformed = transformed.replace(f"{{{{{key}}}}}", str(value))
                if "{{value}}" in transformed:
                    transformed = transformed.replace(
                        "{{value}}",
                        str(self._extract_value_from_context(primary_context, source_key) or ""),
                    )
        elif transform_type == "json_stringify":
            base = self._extract_value_from_context(primary_context, source_key)
            if base is None:
                transformed = "null"
            elif bool(config.get("pretty") or config.get("prettyPrint")):
                indent = int(config.get("indent") or 2)
                transformed = json.dumps(base, ensure_ascii=False, indent=indent, default=str)
            else:
                transformed = json.dumps(base, ensure_ascii=False, separators=(",", ":"), default=str)
        elif transform_type == "json_parse":
            raw = self._extract_value_from_context(primary_context, source_key)
            if isinstance(raw, (dict, list)):
                transformed = raw
            else:
                stripped = str(raw).strip() if raw is not None else ""
                transformed = json.loads(stripped) if stripped else {}
        elif transform_type == "trim":
            raw = self._extract_value_from_context(primary_context, source_key)
            transformed = "" if raw is None else str(raw).strip()
        elif transform_type == "upper":
            raw = self._extract_value_from_context(primary_context, source_key)
            transformed = "" if raw is None else str(raw).upper()
        elif transform_type == "lower":
            raw = self._extract_value_from_context(primary_context, source_key)
            transformed = "" if raw is None else str(raw).lower()
        else:
            transformed = self._extract_value_from_context(primary_context, source_key)
            if transformed is None:
                transformed = primary_context

        return {
            "__result__": transformed,
            "output": transformed,
            "value": transformed,
            output_key: transformed,
        }
