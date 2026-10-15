#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.
# Purpose:
# Workflow CRUD and persistence of nodes/connections for legacy builder workflows.
# Invariants:
# - Child module of WorkflowService decomposition; must not import workflow_service.
# Related:
# - api/services/ugs/workflow_service.py
# ---

import logging
from typing import Any

from sqlalchemy import bindparam, text  # type: ignore[import-not-found]
from sqlalchemy.dialects.postgresql import JSONB  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class WorkflowCrudMixin:
    """Mixin for WorkflowService."""

    async def create_workflow(
        self,
        user_id: str,
        workflow_name: str,
        workflow_data: dict[str, Any],
        description: str = "",
        project_id: str | None = None,
        company_id: str | None = None,
        template_id: str | None = None,
        *,  # All subsequent arguments are keyword-only
        is_public: bool = False,
    ) -> dict[str, Any]:
        """
        Create new workflow

        Args:
            user_id: Creator user ID
            workflow_name: Workflow name
            workflow_data: Workflow data (React Flow format)
            description: Description
            project_id: Project ID
            company_id: Company ID
            template_id: Template ID (if created from template)
            is_public: Whether workflow is public

        Returns:
            dict[str, Any] with created workflow information
        """
        # Validate workflow data
        if not self._validate_workflow_data(workflow_data):
            msg = "Некорректная структура воркфлоу."
            raise ValueError(msg)

        # Insert workflow
        query = text("""
            INSERT INTO workflows (
                workflow_name, description, created_by, project_id, company_id,
                template_id, is_public, workflow_data
            ) VALUES (:name, :desc, :user_id, :project_id, :company_id,
                     :template_id, :is_public, :workflow_data)
            RETURNING id, created_at
        """).bindparams(bindparam("workflow_data", type_=JSONB))

        result = await self.db.execute(
            query,
            {
                "name": workflow_name,
                "desc": description,
                "user_id": user_id,
                "project_id": project_id,
                "company_id": company_id,
                "template_id": template_id,
                "is_public": is_public,
                "workflow_data": workflow_data,
            },
        )

        row = result.fetchone()
        if not row:
            msg = "Не удалось создать воркфлоу."
            raise RuntimeError(msg)

        workflow_id = str(row[0])
        created_at = row[1]

        # Create workflow nodes and connections
        await self._save_workflow_nodes(workflow_id, workflow_data)
        await self._save_workflow_connections(workflow_id, workflow_data)

        logger.info("Created workflow %s by user %s", workflow_id, user_id)

        return {
            "workflow_id": workflow_id,
            "workflow_name": workflow_name,
            "created_at": created_at.isoformat(),
            "node_count": len(workflow_data.get("nodes", [])),
            "connection_count": len(workflow_data.get("edges", [])),
        }

    async def get_workflow(self, workflow_id: str, user_id: str) -> dict[str, Any] | None:
        """
        Get workflow by ID

        Args:
            workflow_id: Workflow ID
            user_id: User ID (for access check)

        Returns:
            dict[str, Any] with workflow data or None
        """
        query = text("""
            SELECT
                w.id, w.workflow_name, w.description, w.created_by,
                w.project_id, w.company_id, w.template_id, w.is_public,
                w.workflow_data, w.execution_count, w.last_executed_at,
                w.average_execution_time, w.created_at, w.updated_at,
                u.username as creator_username,
                t.template_name, t.display_name as template_display_name
            FROM workflows w
            LEFT JOIN users u ON w.created_by = u.id
            LEFT JOIN workflow_templates t ON w.template_id = t.id
            WHERE w.id = :workflow_id AND (w.created_by = :user_id OR w.is_public = TRUE)
        """)

        result = await self.db.execute(query, {"workflow_id": workflow_id, "user_id": user_id})
        row = result.fetchone()

        if not row:
            return None

        return {
            "id": str(row[0]),
            "workflow_name": row[1],
            "description": row[2],
            "created_by": str(row[3]),
            "project_id": str(row[4]) if row[4] else None,
            "company_id": str(row[5]) if row[5] else None,
            "template_id": str(row[6]) if row[6] else None,
            "is_public": row[7],
            "workflow_data": row[8],
            "execution_count": row[9],
            "last_executed_at": row[10].isoformat() if row[10] else None,
            "average_execution_time": float(row[11]) if row[11] else None,
            "created_at": row[12].isoformat(),
            "updated_at": row[13].isoformat(),
            "creator_username": row[14],
            "template_name": row[15],
            "template_display_name": row[16],
        }

    async def update_workflow(self, workflow_id: str, user_id: str, updates: dict[str, Any]) -> bool:
        """
        Обновить рабочий процесс

        Args:
            workflow_id: ID рабочего процесса
            user_id: ID пользователя (для проверки доступа)
            updates: Поля для обновления

        Returns:
            bool: True если успешно обновлено
        """
        # Check ownership
        query = text("SELECT created_by FROM workflows WHERE id = :workflow_id")
        result = await self.db.execute(query, {"workflow_id": workflow_id})
        row = result.fetchone()

        if not row or str(row[0]) != user_id:
            msg = "Воркфлоу не найден или недоступен."
            raise ValueError(msg)

        # Build update query
        update_fields = []
        params = {"workflow_id": workflow_id, "user_id": user_id}

        allowed_fields = [
            "workflow_name",
            "description",
            "is_public",
            "max_execution_time",
            "auto_execute",
            "webhook_url",
            "tags",
        ]

        for field in allowed_fields:
            if field in updates:
                update_fields.append(f"{field} = :{field}")
                params[field] = updates[field]

        if not update_fields:
            return True  # Nothing to update

        # Handle workflow_data separately (requires node/connection updates)
        if "workflow_data" in updates:
            workflow_data = updates["workflow_data"]
            if not self._validate_workflow_data(workflow_data):
                msg = "Некорректная структура воркфлоу."
                raise ValueError(msg)

            update_fields.append("workflow_data = :workflow_data")
            params["workflow_data"] = workflow_data

        update_fields.append("updated_at = NOW()")

        # Note: update_fields is built from validated inputs, params are passed separately
        query = text(f"""
            UPDATE workflows
            SET {", ".join(update_fields)}
            WHERE id = :workflow_id AND created_by = :user_id
        """)  # noqa: S608

        if "workflow_data" in params:
            query = query.bindparams(bindparam("workflow_data", type_=JSONB))

        result = await self.db.execute(query, params)
        success = (getattr(result, "rowcount", None) or 0) > 0

        if success and "workflow_data" in updates:
            await self._save_workflow_nodes(workflow_id, updates["workflow_data"])
            await self._save_workflow_connections(workflow_id, updates["workflow_data"])

        if success:
            logger.info("Updated workflow %s by user %s", workflow_id, user_id)

        return success

    async def delete_workflow(self, workflow_id: str, user_id: str) -> bool:
        """
        Удалить рабочий процесс

        Args:
            workflow_id: ID рабочего процесса
            user_id: ID пользователя (для проверки доступа)

        Returns:
            bool: True если успешно удалено
        """
        query = text("DELETE FROM workflows WHERE id = :workflow_id AND created_by = :user_id")
        result = await self.db.execute(query, {"workflow_id": workflow_id, "user_id": user_id})
        success = (getattr(result, "rowcount", None) or 0) > 0

        if success:
            logger.info("Deleted workflow %s by user %s", workflow_id, user_id)

        return success

    async def list_workflows(
        self,
        user_id: str,
        project_id: str | None = None,
        company_id: str | None = None,
        *,  # All subsequent arguments are keyword-only
        include_public: bool = True,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """
        Get list of workflows

        Args:
            user_id: User ID
            project_id: Project filter
            company_id: Company filter
            include_public: Include public workflows
            limit: Maximum number
            offset: Offset

        Returns:
            List of workflow summaries
        """
        legacy_workflows = await self._list_legacy_workflows(
            user_id=user_id,
            project_id=project_id,
            company_id=company_id,
            include_public=include_public,
        )
        catalog_workflows = await self._list_catalog_workflows() if include_public else []

        merged = [*legacy_workflows, *catalog_workflows]
        merged.sort(
            key=lambda item: item.get("updated_at") or item.get("created_at") or "",
            reverse=True,
        )
        start = max(offset, 0)
        end = start + max(limit, 0)
        return merged[start:end]

    async def _list_legacy_workflows(
        self,
        *,
        user_id: str,
        project_id: str | None,
        company_id: str | None,
        include_public: bool,
    ) -> list[dict[str, Any]]:
        conditions = []
        params: dict[str, Any] = {"user_id": user_id}

        if include_public:
            conditions.append("(w.created_by = :user_id OR w.is_public = TRUE)")
        else:
            conditions.append("w.created_by = :user_id")

        if project_id:
            conditions.append("w.project_id = :project_id")
            params["project_id"] = project_id

        if company_id:
            conditions.append("w.company_id = :company_id")
            params["company_id"] = company_id

        where_clause = " AND ".join(conditions)
        query = text(f"""
            SELECT
                w.id, w.workflow_name, w.description, w.created_by,
                w.is_public, w.execution_count, w.last_executed_at,
                w.average_execution_time, w.created_at, w.updated_at,
                u.username as creator_username,
                COUNT(DISTINCT wn.id) as node_count,
                COUNT(DISTINCT wc.id) as connection_count
            FROM workflows w
            LEFT JOIN users u ON w.created_by = u.id
            LEFT JOIN workflow_nodes wn ON w.id = wn.workflow_id
            LEFT JOIN workflow_connections wc ON w.id = wc.workflow_id
            WHERE {where_clause}
            GROUP BY w.id, w.workflow_name, w.description, w.created_by,
                     w.is_public, w.execution_count, w.last_executed_at,
                     w.average_execution_time, w.created_at, w.updated_at, u.username
            ORDER BY w.updated_at DESC
        """)  # noqa: S608

        result = await self.db.execute(query, params)
        return [
            {
                "id": str(row[0]),
                "workflow_name": row[1],
                "description": row[2],
                "created_by": str(row[3]),
                "is_public": row[4],
                "execution_count": row[5],
                "last_executed_at": row[6].isoformat() if row[6] else None,
                "average_execution_time": float(row[7]) if row[7] else None,
                "created_at": row[8].isoformat(),
                "updated_at": row[9].isoformat() if row[9] else None,
                "creator_username": row[10],
                "node_count": row[11],
                "connection_count": row[12],
                "workflow_source": "legacy",
                "workflow_slug": None,
                "category": None,
                "estimated_time": None,
                "supports_execute": True,
                "supports_builder": True,
                "supports_duplicate": True,
                "supports_delete": True,
                "supports_export": True,
                "supports_history": True,
                "source_label": "Пользовательский workflow",
            }
            for row in result
        ]

    async def duplicate_workflow(
        self, workflow_id: str, user_id: str, new_name: str, description: str | None = None
    ) -> str | None:
        """
        Дублировать рабочий процесс

        Args:
            workflow_id: ID оригинального рабочего процесса
            user_id: ID пользователя
            new_name: Новое название
            description: Новое описание

        Returns:
            ID нового рабочего процесса или None
        """
        # Get original workflow
        original = await self.get_workflow(workflow_id, user_id)
        if not original:
            return None

        # Create duplicate
        result = await self.create_workflow(
            user_id=user_id,
            workflow_name=new_name,
            workflow_data=original["workflow_data"],
            description=description or f"Copy of {original['workflow_name']}",
            project_id=original.get("project_id"),
            company_id=original.get("company_id"),
            is_public=False,
        )

        new_workflow_id: Any = result.get("workflow_id") if isinstance(result, dict) else None
        return str(new_workflow_id) if new_workflow_id is not None else None

    async def _save_workflow_nodes(self, workflow_id: str, workflow_data: dict[str, Any]) -> None:
        """Save workflow nodes to database"""
        # Delete existing nodes
        delete_query = text("DELETE FROM workflow_nodes WHERE workflow_id = :workflow_id")
        await self.db.execute(delete_query, {"workflow_id": workflow_id})

        # Insert new nodes
        for node in workflow_data.get("nodes", []):
            node_data = node.get("data", {})
            if not isinstance(node_data, dict):
                node_data = {}

            normalized_node_data = dict(node_data)
            if isinstance(normalized_node_data.get("icon"), dict):
                normalized_node_data.pop("icon", None)

            generation_type = node_data.get("generation_type") or node_data.get("generationType")
            provider_name = node_data.get("provider_name") or node_data.get("provider")

            insert_query = text("""
                INSERT INTO workflow_nodes (
                    workflow_id, node_id, node_type, generation_type, provider_name,
                    position_x, position_y, width, height, node_data,
                    timeout_seconds, retry_count, continue_on_error
                ) VALUES (:workflow_id, :node_id, :node_type, :generation_type, :provider_name,
                         :position_x, :position_y, :width, :height, :node_data,
                         :timeout_seconds, :retry_count, :continue_on_error)
            """).bindparams(bindparam("node_data", type_=JSONB))
            await self.db.execute(
                insert_query,
                {
                    "workflow_id": workflow_id,
                    "node_id": node["id"],
                    "node_type": node.get("type", "default"),
                    "generation_type": generation_type,
                    "provider_name": provider_name,
                    "position_x": node.get("position", {}).get("x"),
                    "position_y": node.get("position", {}).get("y"),
                    "width": node.get("width"),
                    "height": node.get("height"),
                    "node_data": normalized_node_data,
                    "timeout_seconds": node_data.get("timeout_seconds", node_data.get("timeout", 300)),
                    "retry_count": node_data.get("retry_count", 0),
                    "continue_on_error": node_data.get("continue_on_error", False),
                },
            )

    async def _save_workflow_connections(self, workflow_id: str, workflow_data: dict[str, Any]) -> None:
        """Save workflow connections to database"""
        # Delete existing connections
        delete_query = text("DELETE FROM workflow_connections WHERE workflow_id = :workflow_id")
        await self.db.execute(delete_query, {"workflow_id": workflow_id})

        # Insert new connections
        for edge in workflow_data.get("edges", []):
            insert_query = text("""
                INSERT INTO workflow_connections (
                    workflow_id, source_node_id, source_handle, target_node_id,
                    target_handle, connection_type, parameter_mappings
                ) VALUES (:workflow_id, :source_node_id, :source_handle, :target_node_id,
                         :target_handle, :connection_type, :parameter_mappings)
            """).bindparams(bindparam("parameter_mappings", type_=JSONB))
            await self.db.execute(
                insert_query,
                {
                    "workflow_id": workflow_id,
                    "source_node_id": edge["source"],
                    "source_handle": edge.get("sourceHandle"),
                    "target_node_id": edge["target"],
                    "target_handle": edge.get("targetHandle"),
                    "connection_type": edge.get("data", {}).get("connection_type", "data"),
                    "parameter_mappings": (
                        edge.get("data", {}).get("parameter_mappings") or edge.get("data", {}).get("mapping") or {}
                    ),
                },
            )
