#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.
# Purpose:
# Workflow graph structure validation for legacy builder compile checks.
# Invariants:
# - Child module of WorkflowService decomposition; must not import workflow_service.
# Related:
# - api/services/ugs/workflow_service.py
# ---

from typing import Any

from api.services.ugs.workflow_builder_catalog_data import (
    LEGACY_EXECUTABLE_NODE_TYPES,
    LEGACY_GENERATION_TYPE_MAP,
)


class WorkflowGraphValidationMixin:
    """Mixin for WorkflowService."""

    def validate_workflow_graph(self, workflow_data: dict[str, Any]) -> dict[str, Any]:
        issues: list[dict[str, Any]] = []

        def add_issue(
            severity: str,
            code: str,
            message: str,
            *,
            node_id: str | None = None,
            edge_id: str | None = None,
        ) -> None:
            issues.append(
                {
                    "severity": severity,
                    "code": code,
                    "message": message,
                    "node_id": node_id,
                    "edge_id": edge_id,
                }
            )

        if not self._validate_workflow_data(workflow_data):
            add_issue(
                "error",
                "invalid_structure",
                "Структура workflow некорректна: ожидаются массивы nodes и edges.",
            )
            return {
                "ok": False,
                "issues": issues,
                "summary": {"error": 1, "warning": 0, "info": 0},
                "supported_generation_types": sorted(LEGACY_GENERATION_TYPE_MAP.keys()),
            }

        nodes = workflow_data.get("nodes", [])
        edges = workflow_data.get("edges", [])
        nodes_by_id: dict[str, dict[str, Any]] = {}
        adjacency: dict[str, list[str]] = {}
        indegree: dict[str, int] = {}

        for node in nodes:
            node_id = str(node.get("id") or "").strip()
            node_type = str(node.get("type") or "").strip()
            if not node_id:
                add_issue("error", "missing_node_id", "Найден узел без id.")
                continue
            nodes_by_id[node_id] = node
            adjacency[node_id] = []
            indegree.setdefault(node_id, 0)
            if node_type not in LEGACY_EXECUTABLE_NODE_TYPES:
                add_issue(
                    "error",
                    "unsupported_node_type",
                    f"Тип узла '{node_type or 'unknown'}' пока не поддерживается legacy builder runtime.",
                    node_id=node_id,
                )
            if node_type == "generation":
                legacy_type = self._extract_node_generation_type(node)
                if not legacy_type:
                    add_issue(
                        "error",
                        "missing_generation_type",
                        "У generation-узла не указан generationType.",
                        node_id=node_id,
                    )
                elif legacy_type not in LEGACY_GENERATION_TYPE_MAP:
                    add_issue(
                        "error",
                        "unsupported_generation_type",
                        f"Generation type '{legacy_type}' пока не сопоставлен с runtime type_key.",
                        node_id=node_id,
                    )

        output_node_ids = {
            str(node.get("id") or "").strip()
            for node in nodes
            if isinstance(node, dict) and str(node.get("type") or "").strip() == "output"
        }
        if not output_node_ids:
            add_issue(
                "warning",
                "missing_output_nodes",
                "Во workflow нет output-узлов. Итоговый результат будет трудно интерпретировать.",
            )

        for edge in edges:
            edge_id = str(edge.get("id") or "").strip() or None
            source_id = str(edge.get("source") or "").strip()
            target_id = str(edge.get("target") or "").strip()
            if source_id not in nodes_by_id or target_id not in nodes_by_id:
                add_issue(
                    "error",
                    "dangling_edge",
                    "Связь ссылается на отсутствующий source или target узел.",
                    edge_id=edge_id,
                )
                continue
            adjacency[source_id].append(target_id)
            indegree[target_id] = indegree.get(target_id, 0) + 1
            edge_data = edge.get("data")
            if isinstance(edge_data, dict):
                mappings = edge_data.get("parameter_mappings") or edge_data.get("mapping")
                if mappings is not None and not isinstance(mappings, dict):
                    add_issue(
                        "warning",
                        "invalid_parameter_mapping",
                        "Параметрическая маппинг-конфигурация должна быть объектом.",
                        edge_id=edge_id,
                    )

        generation_node_ids = {
            node_id for node_id, node in nodes_by_id.items() if str(node.get("type") or "").strip() == "generation"
        }
        if not generation_node_ids:
            add_issue(
                "error",
                "missing_generation_nodes",
                "Во workflow нет generation-узлов для запуска.",
            )

        roots = [node_id for node_id, degree in indegree.items() if degree == 0]
        reachable: set[str] = set()
        queue = list(roots)
        while queue:
            current = queue.pop(0)
            if current in reachable:
                continue
            reachable.add(current)
            queue.extend(adjacency.get(current, []))

        unreachable_nodes = sorted(set(nodes_by_id) - reachable)
        for node_id in unreachable_nodes:
            add_issue(
                "warning",
                "unreachable_node",
                "Узел недостижим из корневых точек графа.",
                node_id=node_id,
            )

        try:
            self._build_legacy_execution_plan(workflow_data)
        except ValueError as error:
            add_issue("error", "compile_failed", str(error))

        summary = {
            "error": sum(1 for issue in issues if issue["severity"] == "error"),
            "warning": sum(1 for issue in issues if issue["severity"] == "warning"),
            "info": sum(1 for issue in issues if issue["severity"] == "info"),
        }
        return {
            "ok": summary["error"] == 0,
            "issues": issues,
            "summary": summary,
            "supported_generation_types": sorted(LEGACY_GENERATION_TYPE_MAP.keys()),
        }

    def _validate_workflow_data(self, workflow_data: dict[str, Any]) -> bool:
        """
        Validate workflow data structure

        Args:
            workflow_data: Workflow data to validate

        Returns:
            bool: True if valid
        """
        if not isinstance(workflow_data, dict):
            return False

        # Check required fields
        if "nodes" not in workflow_data or "edges" not in workflow_data:
            return False

        if not isinstance(workflow_data["nodes"], list):
            return False

        if not isinstance(workflow_data["edges"], list):
            return False

        # Validate nodes have required fields
        for node in workflow_data["nodes"]:
            if not isinstance(node, dict):
                return False
            if "id" not in node or "type" not in node:
                return False

        # Validate edges have required fields
        for edge in workflow_data["edges"]:
            if not isinstance(edge, dict):
                return False
            if "source" not in edge or "target" not in edge:
                return False

        return True
