#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.
# Purpose:
# ComfyUI catalog workflow listing, capabilities, and execution history reads.
# Invariants:
# - Child module of WorkflowService decomposition; must not import workflow_service.
# Related:
# - api/services/ugs/workflow_service.py
# ---

import logging
from typing import Any

from sqlalchemy import text  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class WorkflowCatalogReadMixin:
    """Mixin for WorkflowService."""

    async def _list_catalog_workflows(self) -> list[dict[str, Any]]:
        query = text("""
            SELECT
                cw.id,
                cw.slug,
                cw.name,
                cw.category,
                cw.description,
                cw.json_body,
                cw.estimated_time,
                cw.version,
                cw.created_at,
                cw.updated_at,
                COALESCE(stats.execution_count, 0) AS execution_count,
                stats.last_executed_at,
                stats.success_rate
            FROM comfyui_workflows cw
            LEFT JOIN (
                SELECT
                    regexp_replace(
                        COALESCE(
                        gr.input_data ->> 'workflow_template',
                        gr.input_data ->> 'workflow_key'
                        ),
                        '\\.json$',
                        ''
                    ) AS workflow_slug,
                    COUNT(*) AS execution_count,
                    MAX(COALESCE(gr.started_at, gr.created_at)) AS last_executed_at,
                    CASE
                        WHEN COUNT(*) FILTER (WHERE gr.status IN ('completed', 'failed')) = 0 THEN NULL
                        ELSE (
                            COUNT(*) FILTER (WHERE gr.status = 'completed')::float /
                            NULLIF(COUNT(*) FILTER (WHERE gr.status IN ('completed', 'failed')), 0)::float
                        )
                    END AS success_rate
                FROM generation_requests gr
                JOIN generation_types gt ON gt.id = gr.type_id
                WHERE gt.provider = 'comfyui'
                  AND gr.deleted_at IS NULL
                  AND COALESCE(
                        gr.input_data ->> 'workflow_template',
                        gr.input_data ->> 'workflow_key'
                  ) IS NOT NULL
                GROUP BY 1
            ) stats ON stats.workflow_slug = cw.slug
            WHERE cw.is_active = TRUE
            ORDER BY cw.updated_at DESC, cw.name ASC
        """)

        result = await self.db.execute(query)
        workflows: list[dict[str, Any]] = []
        for row in result:
            workflow_json = row[5] if isinstance(row[5], dict) else {}
            capabilities = self._get_catalog_capabilities(
                workflow_slug=row[1],
                category=row[3],
                workflow_json=workflow_json,
            )
            workflows.append(
                {
                    "id": f"comfyui:{row[1]}",
                    "workflow_name": row[2],
                    "description": row[4],
                    "created_by": None,
                    "is_public": True,
                    "execution_count": int(row[10] or 0),
                    "last_executed_at": row[11].isoformat() if row[11] else None,
                    "average_execution_time": None,
                    "created_at": row[8].isoformat() if row[8] else None,
                    "updated_at": row[9].isoformat() if row[9] else None,
                    "creator_username": None,
                    "node_count": len(workflow_json),
                    "connection_count": self._count_comfyui_connections(workflow_json),
                    "workflow_source": "comfyui_catalog",
                    "workflow_slug": row[1],
                    "category": row[3],
                    "estimated_time": row[6],
                    "version": row[7],
                    "success_rate": float(row[12]) if row[12] is not None else None,
                    "supports_execute": capabilities["supports_execute"],
                    "supports_builder": False,
                    "supports_duplicate": False,
                    "supports_delete": False,
                    "supports_export": False,
                    "supports_history": True,
                    "execution_mode": capabilities["execution_mode"],
                    "execution_hint": capabilities["execution_hint"],
                    "quick_execute_type_key": capabilities["quick_execute_type_key"],
                    "source_label": "DB-first шаблон",
                }
            )
        return workflows

    def _normalize_catalog_workflow_slug(self, workflow_slug: str | None) -> str | None:
        if workflow_slug is None:
            return None
        normalized = workflow_slug.strip()
        if not normalized:
            return None
        if normalized.endswith(".json"):
            normalized = normalized[:-5]
        return normalized or None

    def _humanize_runtime_error(self, error_message: str | None) -> str | None:
        if error_message is None:
            return None
        normalized = error_message.strip()
        if not normalized:
            return None

        lower_value = normalized.lower()
        if "cannot connect to host" in lower_value:
            return f"Нет соединения с ComfyUI runtime. Техническая причина: {normalized}"
        if "timeout" in lower_value:
            return f"ComfyUI runtime не ответил вовремя. Техническая причина: {normalized}"
        return normalized

    def _parse_catalog_workflow_id(self, workflow_id: str) -> str | None:
        if not workflow_id.startswith("comfyui:"):
            return None
        return self._normalize_catalog_workflow_slug(workflow_id.split(":", 1)[1])

    def _extract_catalog_class_types(self, workflow_json: dict[str, Any]) -> set[str]:
        class_types: set[str] = set()
        if not isinstance(workflow_json, dict):
            return class_types
        for node in workflow_json.values():
            if not isinstance(node, dict):
                continue
            class_type = node.get("class_type")
            if isinstance(class_type, str) and class_type.strip():
                class_types.add(class_type.strip())
        return class_types

    def _get_catalog_capabilities(
        self,
        *,
        workflow_slug: str,
        category: str | None,
        workflow_json: dict[str, Any],
    ) -> dict[str, Any]:
        class_types = self._extract_catalog_class_types(workflow_json)
        normalized_category = (category or "").strip().lower()
        requires_image_input = "LoadImage" in class_types
        requires_audio_input = "LoadAudio" in class_types
        outputs_video = "SaveVideo" in class_types
        outputs_audio = any(
            class_type in {"SaveAudioMP3", "VAEDecodeAudio", "DiffRhythmRun"} for class_type in class_types
        )
        has_clip_prompt = "CLIPTextEncode" in class_types
        has_latent_image = any("LatentImage" in class_type for class_type in class_types)

        quick_execute_type_key: str | None = None
        execution_mode = "unsupported"
        execution_hint = "Этот workflow пока требует отдельной специализированной формы запуска."

        if (
            normalized_category == "image"
            and has_clip_prompt
            and has_latent_image
            and not requires_image_input
            and not outputs_video
            and not outputs_audio
        ):
            quick_execute_type_key = "image_generation_comfyui"
            execution_mode = "quick_prompt"
            execution_hint = (
                "Доступен быстрый запуск: укажите prompt, и UGS создаст generation request через DB-first runtime."
            )
        elif requires_image_input and outputs_video:
            execution_mode = "requires_image_input"
            execution_hint = "Для запуска нужен исходный кадр/изображение. Быстрый запуск из вкладки пока недоступен."
        elif requires_image_input:
            execution_mode = "requires_image_input"
            execution_hint = (
                "Для запуска нужно входное изображение. Быстрый запуск из списка workflow "
                "для такого шаблона пока недоступен."
            )
        elif requires_audio_input:
            execution_mode = "requires_audio_input"
            execution_hint = "Для запуска нужен входной аудиофайл или дополнительные audio-параметры."
        elif outputs_audio or normalized_category == "audio":
            execution_mode = "requires_specialized_form"
            execution_hint = (
                "Аудио workflow требует отдельной формы параметров. История запусков "
                "показывается, но быстрый старт из карточки пока отключен."
            )
        elif outputs_video or normalized_category == "video":
            execution_mode = "requires_specialized_form"
            execution_hint = "Видео workflow требует отдельной формы параметров и исходных данных."

        return {
            "supports_execute": quick_execute_type_key is not None,
            "quick_execute_type_key": quick_execute_type_key,
            "execution_mode": execution_mode,
            "execution_hint": execution_hint,
            "normalized_slug": self._normalize_catalog_workflow_slug(workflow_slug),
        }

    async def _get_catalog_workflow(self, workflow_slug: str) -> dict[str, Any] | None:
        normalized_slug = self._normalize_catalog_workflow_slug(workflow_slug)
        if normalized_slug is None:
            return None

        query = text("""
            SELECT
                slug,
                name,
                category,
                description,
                json_body,
                estimated_time,
                version,
                created_at,
                updated_at
            FROM comfyui_workflows
            WHERE is_active = TRUE
              AND slug = :slug
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT 1
        """)
        result = await self.db.execute(query, {"slug": normalized_slug})
        row = result.fetchone()
        if row is None:
            return None

        workflow_json = row[4] if isinstance(row[4], dict) else {}
        capabilities = self._get_catalog_capabilities(
            workflow_slug=row[0],
            category=row[2],
            workflow_json=workflow_json,
        )
        return {
            "slug": row[0],
            "workflow_name": row[1],
            "category": row[2],
            "description": row[3],
            "workflow_json": workflow_json,
            "estimated_time": row[5],
            "version": row[6],
            "created_at": row[7].isoformat() if row[7] else None,
            "updated_at": row[8].isoformat() if row[8] else None,
            **capabilities,
        }

    def _count_comfyui_connections(self, workflow_json: dict[str, Any]) -> int:
        if not isinstance(workflow_json, dict):
            return 0

        connection_count = 0
        for node in workflow_json.values():
            if not isinstance(node, dict):
                continue
            inputs = node.get("inputs")
            if not isinstance(inputs, dict):
                continue
            for input_value in inputs.values():
                if isinstance(input_value, list) and len(input_value) >= 2 and input_value[0] is not None:
                    connection_count += 1
        return connection_count

    async def list_workflow_executions(
        self,
        workflow_id: str,
        user_id: str,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> dict[str, Any]:
        catalog_slug = self._parse_catalog_workflow_id(workflow_id)
        if catalog_slug is not None:
            return await self._list_catalog_workflow_executions(
                workflow_slug=catalog_slug,
                limit=limit,
                offset=offset,
            )

        workflow = await self.get_workflow(workflow_id, user_id)
        if not workflow:
            msg = "Воркфлоу не найден или недоступен."
            raise ValueError(msg)

        query = text("""
            SELECT
                we.id,
                we.workflow_id,
                we.execution_name,
                we.status,
                we.started_at,
                we.completed_at,
                we.total_duration_ms,
                we.success_count,
                we.error_count,
                we.skipped_count,
                we.credits_used,
                we.trigger_type,
                we.error_message,
                we.output_data,
                we.execution_metadata,
                we.created_at,
                we.updated_at
            FROM workflow_executions we
            WHERE we.workflow_id = :workflow_id
            ORDER BY COALESCE(we.started_at, we.created_at) DESC, we.created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await self.db.execute(
            query,
            {
                "workflow_id": workflow_id,
                "limit": min(limit, 100),
                "offset": max(offset, 0),
            },
        )
        executions = [
            {
                "id": str(row[0]),
                "execution_id": str(row[0]),
                "workflow_id": str(row[1]),
                "execution_name": row[2],
                "status": row[3],
                "started_at": row[4].isoformat() if row[4] else None,
                "completed_at": row[5].isoformat() if row[5] else None,
                "total_duration_ms": row[6],
                "success_count": row[7],
                "error_count": row[8],
                "skipped_count": row[9],
                "credits_used": float(row[10]) if row[10] is not None else None,
                "trigger_type": row[11],
                "error_message": row[12],
                "output_data": row[13] if isinstance(row[13], dict) else None,
                "execution_metadata": row[14] if isinstance(row[14], dict) else None,
                "created_at": row[15].isoformat() if row[15] else None,
                "updated_at": row[16].isoformat() if row[16] else None,
            }
            for row in result
        ]
        count_result = await self.db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM workflow_executions
                WHERE workflow_id = :workflow_id
                """
            ),
            {"workflow_id": workflow_id},
        )
        total = int(count_result.scalar() or 0)
        return {"executions": executions, "total": total}

    async def _list_catalog_workflow_executions(
        self,
        *,
        workflow_slug: str,
        limit: int,
        offset: int,
    ) -> dict[str, Any]:
        catalog_workflow = await self._get_catalog_workflow(workflow_slug)
        if catalog_workflow is None:
            msg = "Воркфлоу не найден."
            raise ValueError(msg)

        normalized_slug = self._normalize_catalog_workflow_slug(workflow_slug)
        if normalized_slug is None:
            return {"executions": [], "total": 0}

        query = text("""
            SELECT
                gr.id,
                COALESCE(
                    gr.input_data ->> 'workflow_execution_name',
                    gr.request_metadata ->> 'workflow_execution_name',
                    NULLIF(gr.input_data ->> 'prompt', '')
                ) AS execution_name,
                gr.status,
                gr.started_at,
                gr.completed_at,
                CASE
                    WHEN gr.started_at IS NOT NULL AND gr.completed_at IS NOT NULL
                    THEN CAST(EXTRACT(EPOCH FROM (gr.completed_at - gr.started_at)) * 1000 AS BIGINT)
                    ELSE NULL
                END AS total_duration_ms,
                CASE WHEN gr.status = 'completed' THEN 1 ELSE 0 END AS success_count,
                CASE WHEN gr.status = 'failed' THEN 1 ELSE 0 END AS error_count,
                gr.credits_used,
                COALESCE(
                    gr.request_metadata ->> 'trigger_type',
                    gr.input_data ->> 'workflow_trigger_type',
                    'manual'
                ) AS trigger_type,
                gr.error_message,
                gr.created_at,
                gr.updated_at
            FROM generation_requests gr
            JOIN generation_types gt ON gt.id = gr.type_id
            WHERE gt.provider = 'comfyui'
              AND gr.deleted_at IS NULL
              AND regexp_replace(
                    COALESCE(
                        gr.input_data ->> 'workflow_template',
                        gr.input_data ->> 'workflow_key'
                    ),
                    '\\.json$',
                    ''
                  ) = :workflow_slug
            ORDER BY COALESCE(gr.started_at, gr.created_at) DESC, gr.created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await self.db.execute(
            query,
            {
                "workflow_slug": normalized_slug,
                "limit": min(limit, 100),
                "offset": max(offset, 0),
            },
        )

        executions: list[dict[str, Any]] = []
        for row in result:
            status = row[2]
            normalized_status = "running" if status == "processing" else status
            execution_name = row[1]
            if not execution_name:
                execution_name = catalog_workflow["workflow_name"]
            if isinstance(execution_name, str) and len(execution_name) > 120:
                execution_name = f"{execution_name[:117]}..."

            executions.append(
                {
                    "id": str(row[0]),
                    "execution_id": str(row[0]),
                    "workflow_id": f"comfyui:{normalized_slug}",
                    "execution_name": execution_name,
                    "status": normalized_status,
                    "started_at": row[3].isoformat() if row[3] else None,
                    "completed_at": row[4].isoformat() if row[4] else None,
                    "total_duration_ms": row[5],
                    "success_count": row[6],
                    "error_count": row[7],
                    "skipped_count": 0,
                    "credits_used": float(row[8]) if row[8] is not None else None,
                    "trigger_type": row[9],
                    "error_message": row[10],
                    "created_at": row[11].isoformat() if row[11] else None,
                    "updated_at": row[12].isoformat() if row[12] else None,
                }
            )
        count_result = await self.db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM generation_requests gr
                JOIN generation_types gt ON gt.id = gr.type_id
                WHERE gt.provider = 'comfyui'
                  AND gr.deleted_at IS NULL
                  AND regexp_replace(
                        COALESCE(
                            gr.input_data ->> 'workflow_template',
                            gr.input_data ->> 'workflow_key'
                        ),
                        '\\.json$',
                        ''
                      ) = :workflow_slug
                """
            ),
            {"workflow_slug": normalized_slug},
        )
        total = int(count_result.scalar() or 0)
        return {"executions": executions, "total": total}

    async def get_workflow_execution(
        self,
        workflow_id: str,
        execution_id: str,
        user_id: str,
    ) -> dict[str, Any] | None:
        workflow = await self.get_workflow(workflow_id, user_id)
        if not workflow:
            msg = "Воркфлоу не найден или недоступен."
            raise ValueError(msg)

        result = await self.db.execute(
            text(
                """
                SELECT
                    we.id,
                    we.workflow_id,
                    we.execution_name,
                    we.status,
                    we.started_at,
                    we.completed_at,
                    we.total_duration_ms,
                    we.success_count,
                    we.error_count,
                    we.skipped_count,
                    we.credits_used,
                    we.trigger_type,
                    we.error_message,
                    we.output_data,
                    we.execution_metadata,
                    we.created_at,
                    we.updated_at
                FROM workflow_executions we
                WHERE we.workflow_id = :workflow_id
                  AND we.id = :execution_id
                LIMIT 1
                """
            ),
            {"workflow_id": workflow_id, "execution_id": execution_id},
        )
        row = result.fetchone()
        if not row:
            return None

        return {
            "id": str(row[0]),
            "execution_id": str(row[0]),
            "workflow_id": str(row[1]),
            "execution_name": row[2],
            "status": row[3],
            "started_at": row[4].isoformat() if row[4] else None,
            "completed_at": row[5].isoformat() if row[5] else None,
            "total_duration_ms": row[6],
            "success_count": row[7],
            "error_count": row[8],
            "skipped_count": row[9],
            "credits_used": float(row[10]) if row[10] is not None else None,
            "trigger_type": row[11],
            "error_message": row[12],
            "output_data": row[13] if isinstance(row[13], dict) else None,
            "execution_metadata": row[14] if isinstance(row[14], dict) else None,
            "created_at": row[15].isoformat() if row[15] else None,
            "updated_at": row[16].isoformat() if row[16] else None,
        }
