#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# UGS bridge helpers for legacy workflow generation nodes (lazy UnifiedGenerationService).
# Invariants:
# - Child module of WorkflowService decomposition; must not import workflow_service.
# Related:
# - api/services/ugs/workflow_service.py
# ---

import asyncio
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class WorkflowUgsBridgeMixin:
    """Mixin for WorkflowService."""

    async def _wait_for_generation_result(
        self,
        *,
        ugs_service: Any,
        request_id: str,
    ) -> dict[str, Any]:
        for _ in range(180):
            status_payload = await ugs_service.get_status(request_id)
            normalized_status = str(status_payload.get("status") or "").lower()
            if normalized_status == "completed":
                result_payload = await ugs_service.get_result(request_id)
                return {
                    "request_id": request_id,
                    "status": "completed",
                    "result": result_payload.get("result"),
                    "result_preview": result_payload.get("result_preview"),
                    "metadata": result_payload.get("metadata") or {},
                }
            if normalized_status in {"failed", "cancelled"}:
                error_message = status_payload.get("error") or "UGS вернул ошибку выполнения."
                raise RuntimeError(str(error_message))
            await asyncio.sleep(2)
        msg = f"Таймаут ожидания результата UGS request {request_id}."
        raise TimeoutError(msg)

    async def _execute_legacy_generation_node(
        self,
        *,
        ugs_service: Any,
        user_id: str,
        runtime_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        generation_response = await ugs_service.generate(
            user_id=user_id,
            type_key=runtime_type,
            input_data=payload,
        )
        request_id = generation_response.get("request_id")
        if generation_response.get("status") == "completed":
            return {
                "request_id": str(request_id) if request_id is not None else None,
                "status": "completed",
                "result": generation_response.get("result"),
                "result_preview": generation_response.get("result_preview"),
                "metadata": generation_response.get("metadata") or {},
            }
        if request_id is None:
            msg = f"UGS не вернул request_id для runtime типа '{runtime_type}'. Невозможно дождаться результата узла."
            raise RuntimeError(msg)
        return await self._wait_for_generation_result(
            ugs_service=ugs_service,
            request_id=str(request_id),
        )

    async def _create_detached_ugs_service(self, db: AsyncSession) -> Any:
        from api.services.ugs.unified_generation_service import UnifiedGenerationService  # noqa: PLC0415

        content_service = None
        try:
            from api.routers.unified_content import get_content_service  # noqa: PLC0415

            content_service = await get_content_service()
        except (ImportError, AttributeError, RuntimeError) as error:
            logger.warning(
                "Legacy workflow runtime: unified content service unavailable: %s",
                error,
            )
            content_service = None

        return UnifiedGenerationService(db, content_service=content_service)
