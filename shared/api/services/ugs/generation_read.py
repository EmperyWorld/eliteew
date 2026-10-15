# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# UGS generation read path: load requests with type, owner checks, status and result retrieval with asset enrichment.
# Invariants:
# - user_id on HTTP reads enforces owner scope; internal callers may omit user_id.
# - Incomplete generations return status payload without raising.
# Related:
# - api/services/ugs/unified_generation_service.py
# - api/services/ugs/generation_lifecycle.py
# - api/services/ugs/result_handling.py
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin attrs (db, sibling helpers) are provided by UnifiedGenerationService composition.

from __future__ import annotations

import asyncio
import logging
from typing import Any
from uuid import UUID

from api.models.database_models import GenerationRequest

logger = logging.getLogger(__name__)


class GenerationReadMixin:
    """Status and result reads for UGS generation requests."""

    async def _get_request_with_type(self, request_id: str) -> GenerationRequest:
        """Load GenerationRequest with generation_type. Raises ValueError if not found or invalid id."""
        from sqlalchemy import select  # type: ignore[import-not-found]
        from sqlalchemy.orm import selectinload  # type: ignore[import-not-found]

        try:
            request_uuid = UUID(request_id) if isinstance(request_id, str) else request_id
        except (ValueError, TypeError):  # fmt: skip
            msg = f"Некорректный формат request_id: {request_id}"
            raise ValueError(msg) from None

        stmt = (
            select(GenerationRequest)
            .execution_options(populate_existing=True)
            .options(selectinload(GenerationRequest.generation_type))
            .where(GenerationRequest.id == request_uuid)
        )
        result = await self.db.execute(stmt)
        request = result.scalar_one_or_none()
        if not request:
            msg = f"Запрос {request_id} не найден."
            raise ValueError(msg)
        return request

    @staticmethod
    def _assert_request_owner(request: GenerationRequest, user_id: str | None) -> None:
        """Raise when an authenticated read tries to access another user's generation."""
        if user_id is not None and str(request.user_id) != str(user_id):
            msg = "Нельзя просматривать этот запрос."
            raise PermissionError(msg) from None

    async def get_status(self, request_id: str, *, user_id: str | None = None) -> dict[str, Any]:
        """Get generation status."""
        request = await self._get_request_with_type(request_id)
        self._assert_request_owner(request, user_id)
        return self._status_payload_from_request(request)

    async def get_result(self, request_id: str, *, user_id: str | None = None) -> dict[str, Any]:
        """Get generation result."""
        request = await self._get_request_with_type(request_id)
        self._assert_request_owner(request, user_id)

        if not request.generation_type:
            logger.error(
                "Generation type not found for request %s (type_id=%s)",
                request_id,
                getattr(request, "type_id", None),
            )
            msg = f"Для запроса {request_id} не найден тип генерации."
            raise ValueError(msg)

        generation_type = request.generation_type
        provider = generation_type.provider

        status_str = str(request.status) if request.status is not None else None
        if self._normalize_status(status_str) != "completed":
            status_payload = self._status_payload_from_request(request)
            return {
                "request_id": request_id,
                "status": status_payload.get("status") or request.status,
                "error": request.error_message,
                "message": "Генерация ещё не завершена.",
                "metadata": status_payload.get("metadata") or {},
            }
        stored_result = None
        result_metadata: dict[str, Any] = {}
        output_data_value = request.output_data if request.output_data is not None else None
        if isinstance(output_data_value, dict):
            stored_result = output_data_value.get("result")
            result_metadata = output_data_value.get("metadata") or {}

        enriched_result = stored_result
        if stored_result is not None:
            has_storage_ref = False
            if isinstance(stored_result, dict):
                images = stored_result.get("images", [])
                if isinstance(images, list):
                    for img in images:
                        if isinstance(img, dict) and img.get("storage_reference"):
                            has_storage_ref = True
                            break

            if has_storage_ref or provider == "comfyui":
                try:
                    await self.provider_manager.initialize()
                    async with asyncio.timeout(90.0):
                        enriched_candidate = await self._enrich_result_with_assets(stored_result, provider)
                    if enriched_candidate is not None:
                        enriched_result = enriched_candidate
                        if isinstance(enriched_result, dict):
                            images = enriched_result.get("images", [])
                            if isinstance(images, list) and images:
                                first_img = images[0]
                                if isinstance(first_img, dict):
                                    has_payload = bool(
                                        first_img.get("data")
                                        or first_img.get("image_data")
                                        or first_img.get("data_uri")
                                        or first_img.get("content_id")
                                        or first_img.get("storage_reference")
                                    )
                                    if not has_payload:
                                        logger.warning(
                                            "Enrichment completed but no image data found for request %s",
                                            request_id,
                                        )
                except TimeoutError:
                    logger.warning(
                        "Asset enrichment timed out for request %s (provider=%s); using sanitized result",
                        request_id,
                        provider,
                    )
                except Exception as enrich_error:
                    logger.warning(
                        "Failed to enrich result assets for request %s (provider=%s): %s",
                        request_id,
                        provider,
                        enrich_error,
                        exc_info=True,
                    )
            else:
                logger.debug(
                    "No storage_reference found for request %s (provider=%s); skipping enrichment",
                    request_id,
                    provider,
                )

            if isinstance(enriched_result, dict):
                images = enriched_result.get("images")
                if isinstance(images, list) and images:
                    for img in images:
                        if isinstance(img, dict):
                            data_value = img.get("data") or img.get("image_data") or img.get("data_uri")
                            if data_value and not data_value.endswith("...TRUNCATED..."):
                                img.pop("data_preview", None)
                                img.pop("data_truncated", None)
                                logger.debug(
                                    "Cleaned truncated data from image: filename=%s, data_length=%d",
                                    img.get("filename"),
                                    len(data_value) if data_value else 0,
                                )

                    first_image = images[0]
                    if isinstance(first_image, dict):
                        data_value = (
                            first_image.get("data") or first_image.get("image_data") or first_image.get("data_uri")
                        )
                        if data_value and not data_value.endswith("...TRUNCATED..."):
                            enriched_result["image_data"] = data_value
                            enriched_result["data"] = data_value
                            enriched_result.pop("data_preview", None)
                            logger.debug(
                                "Set top-level image_data from first image: length=%d",
                                len(data_value),
                            )

        lifecycle_metadata = self._status_payload_from_request(request)
        combined_metadata = dict(result_metadata)
        combined_metadata.setdefault("lifecycle", lifecycle_metadata.get("metadata") or {})
        combined_metadata.setdefault("execution_backend", lifecycle_metadata.get("execution_backend"))
        combined_metadata.setdefault("provider_name", lifecycle_metadata.get("provider_name"))
        combined_metadata.setdefault("idempotency_key", lifecycle_metadata.get("idempotency_key"))
        return {
            "request_id": request_id,
            "status": lifecycle_metadata.get("status") or request.status,
            "result": enriched_result,
            "result_preview": stored_result,
            "metadata": combined_metadata,
            "started_at": request.started_at.isoformat() if request.started_at is not None else None,
            "completed_at": request.completed_at.isoformat() if request.completed_at is not None else None,
        }
