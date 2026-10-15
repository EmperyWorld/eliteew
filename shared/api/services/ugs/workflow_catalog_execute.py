#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.
# Purpose:
# Quick execute path for DB-first ComfyUI catalog workflows via UGS.
# Invariants:
# - Child module of WorkflowService decomposition; must not import workflow_service.
# Related:
# - api/services/ugs/workflow_service.py
# ---

import logging
from typing import Any

logger = logging.getLogger(__name__)


class WorkflowCatalogExecuteMixin:
    """Mixin for WorkflowService."""

    async def _execute_catalog_workflow(
        self,
        *,
        workflow_slug: str,
        user_id: str,
        execution_name: str | None,
        input_data: dict[str, Any] | None,
        trigger_type: str,
        ugs_service: Any | None,
    ) -> dict[str, Any]:
        catalog_workflow = await self._get_catalog_workflow(workflow_slug)
        if catalog_workflow is None:
            msg = "Воркфлоу не найден."
            raise ValueError(msg)

        quick_execute_type_key = catalog_workflow.get("quick_execute_type_key")
        if quick_execute_type_key is None:
            msg = str(
                catalog_workflow.get("execution_hint") or "Этот workflow не поддерживает быстрый запуск из списка."
            )
            raise ValueError(msg)

        if ugs_service is None:
            msg = "Сервис UGS недоступен для запуска воркфлоу."
            raise RuntimeError(msg)

        if quick_execute_type_key == "image_generation_comfyui":
            provider_manager = getattr(ugs_service, "provider_manager", None)
            if provider_manager is not None:
                provider_status = await provider_manager.check_provider_status("comfyui")
                if not provider_status.get("available", False):
                    provider_error = self._humanize_runtime_error(provider_status.get("error"))
                    error_suffix = f": {provider_error}" if provider_error else ""
                    msg = (
                        "ComfyUI runtime сейчас недоступен. "
                        "Быстрый запуск DB-first workflow временно отключён"
                        f"{error_suffix}"
                    )
                    raise ValueError(msg)

        payload = dict(input_data or {})
        prompt = payload.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            msg = "Для быстрого запуска workflow укажите текстовый prompt."
            raise ValueError(msg)

        normalized_slug = self._normalize_catalog_workflow_slug(workflow_slug)
        if normalized_slug is None:
            msg = "Воркфлоу не найден."
            raise ValueError(msg)

        payload["workflow_template"] = normalized_slug
        payload["workflow_execution_name"] = execution_name or f"{catalog_workflow['workflow_name']} - быстрый запуск"
        payload["workflow_trigger_type"] = trigger_type

        result = await ugs_service.generate(
            user_id=user_id,
            type_key=str(quick_execute_type_key),
            input_data=payload,
        )
        request_id = result.get("request_id")
        request_id_str = str(request_id) if request_id is not None else None

        return {
            "execution_id": request_id_str,
            "request_id": request_id_str,
            "status": result.get("status", "queued"),
            "message": result.get("message", "Workflow execution started successfully"),
        }
