# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# UGS coordinator facade: composes domain mixins, re-exports stable imports, thin delegation to execution modules.
# Invariants:
# - UnifiedGenerationService and IDEMPOTENT_REUSABLE_STATUSES remain import-stable from this module.
# - Direct/queue execution and result sanitization stay delegated (not duplicated here).
# Related:
# - api/services/ugs/generation_lifecycle.py
# - api/services/ugs/generation_submit.py
# - api/services/ugs/generation_read.py
# - api/services/ugs/generation_cancel.py
# - api/services/ugs/generation_stream_entry.py
# - api/services/ugs/generation_types_facade.py
# - api/services/ugs/direct_generation_execution.py
# - api/services/ugs/queue_worker_execution.py
# - api/services/ugs/result_handling.py
# - documentation/product/UGS-FLOW-AND-CONFIG.md
# ---
# pyright: reportUnusedFunction=false, reportUnusedImport=false, reportUnusedVariable=false

"""Unified Generation Service runtime coordinator."""

from __future__ import annotations

import contextlib
import json
import logging
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.models.database_models import GenerationRequest, GenerationType
from api.services.ugs import result_handling as ugs_result_handling
from api.services.ugs.billing_service import BillingService
from api.services.ugs.cache_service import CacheService
from api.services.ugs.direct_generation_execution import run_direct_generation
from api.services.ugs.generation_cancel import GenerationCancelMixin
from api.services.ugs.generation_lifecycle import (
    EXECUTION_BACKEND_DIRECT,
    EXECUTION_BACKEND_QUEUE_WORKER,
    EXECUTION_CONTRACT_VERSION,
    IDEMPOTENT_REUSABLE_STATUSES,
    GenerationLifecycleMixin,
)
from api.services.ugs.generation_read import GenerationReadMixin
from api.services.ugs.generation_stream_entry import GenerationStreamEntryMixin
from api.services.ugs.generation_submit import GenerationSubmitMixin
from api.services.ugs.generation_type_service import GenerationTypeService
from api.services.ugs.generation_types_facade import GenerationTypesFacadeMixin
from api.services.ugs.metrics_service import UGSMetricsService
from api.services.ugs.provider_manager_service_v2 import ProviderManagerServiceV2
from api.services.ugs.queue_manager_service import QueueManagerService
from api.services.ugs.queue_worker_execution import run_process_queued_request

logger = logging.getLogger(__name__)

SANITIZED_STRING_LIMIT = ugs_result_handling.SANITIZED_STRING_LIMIT

__all__ = [
    "EXECUTION_BACKEND_DIRECT",
    "EXECUTION_BACKEND_QUEUE_WORKER",
    "EXECUTION_CONTRACT_VERSION",
    "IDEMPOTENT_REUSABLE_STATUSES",
    "SANITIZED_STRING_LIMIT",
    "UnifiedGenerationService",
]


class UnifiedGenerationService(
    GenerationLifecycleMixin,
    GenerationSubmitMixin,
    GenerationReadMixin,
    GenerationCancelMixin,
    GenerationStreamEntryMixin,
    GenerationTypesFacadeMixin,
):
    """
    🔥 MAIN UGS COORDINATOR 🔥
    Единая точка входа для всех генераций в системе EliteEW
    """

    def __init__(self, db: AsyncSession, content_service: Any | None = None):
        self.db = db
        self.type_service = GenerationTypeService(db)
        self.queue_manager = QueueManagerService(db)
        self.provider_manager = ProviderManagerServiceV2(db, content_service=content_service)
        self.cache_service = CacheService(db)
        self.billing_service = BillingService(db)
        self.metrics_service = UGSMetricsService(db)
        self._content_service = content_service

    async def __aenter__(self) -> UnifiedGenerationService:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: Any,
    ) -> None:
        await self.close()

    async def close(self) -> None:
        """Release provider resources owned by this service instance."""
        with contextlib.suppress(RuntimeError, ValueError, TypeError):
            await self.provider_manager.close()

    async def process_queued_request(self, request_id: str) -> dict[str, Any]:
        """Worker entrypoint for queued UGS tasks."""
        return await run_process_queued_request(self, request_id)

    async def _process_direct_generation(
        self,
        request: GenerationRequest,
        generation_type: GenerationType,
        user_id: str,
        cache_key: str | None = None,
        fallback_error: Exception | None = None,
        *,
        worker_lease_token: str | None = None,
    ) -> dict[str, Any]:
        """Execute generation directly through provider manager (without Airflow)."""
        return await run_direct_generation(
            self,
            request,
            generation_type,
            user_id,
            cache_key=cache_key,
            fallback_error=fallback_error,
            worker_lease_token=worker_lease_token,
        )

    def _estimate_output_size(self, result: Any) -> int | None:
        """Estimate result size in bytes from JSON representation."""
        try:
            encoded = json.dumps(result).encode("utf-8")
            return len(encoded)
        except Exception as exc:
            logger.debug("[STEP] ugs_output_size_estimate_skip err=%s", exc)
            return None

    async def _persist_result_images_to_shared_storage(self, result: Any, user_id: str, request_id: UUID) -> Any:
        """Save image outputs to unified content; delegates to result_handling."""
        return await ugs_result_handling.persist_result_images_to_shared_storage(
            self._content_service, user_id, request_id, result
        )

    def _sanitize_generation_result(self, result: Any) -> Any:
        """Clean generation result from heavy binary data before saving."""
        return ugs_result_handling.sanitize_generation_result(
            result,
            max_keep_b64_bytes=ugs_result_handling.MAX_KEEP_IMAGE_B64_BYTES,
            string_limit=int(unified_settings.ugs_sanitize_string_max_chars),
        )

    def _sanitize_image_entry(self, entry: Any) -> Any:
        """Sanitize single image entry (keep small base64, refs for unified)."""
        return ugs_result_handling.sanitize_image_entry(
            entry, max_keep_b64_bytes=ugs_result_handling.MAX_KEEP_IMAGE_B64_BYTES
        )

    def _truncate_large_string(self, value: str, limit: int = SANITIZED_STRING_LIMIT) -> str:
        """Truncate string for DB/preview; delegates to result_handling."""
        return ugs_result_handling.truncate_large_string(value, limit=limit)

    async def _enrich_result_with_assets(self, result: Any, provider: str | None) -> Any:
        """Enrich result with image data from provider (e.g. ComfyUI fetch)."""
        return await ugs_result_handling.enrich_result_with_assets(self.provider_manager, result, provider)
