# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# UGS generation submit path: thin GenerationSubmitMixin over generation_submit_helpers
# (idempotency, cache short-circuit, queue publish, blocking wait).
# Invariants:
# - IDEMPOTENT_REUSABLE_STATUSES governs when an existing request_id is returned instead of a new row.
# - Music generator type keys skip result cache so repeated identical input still hits the provider.
# - Public import path remains `from api.services.ugs.generation_submit import GenerationSubmitMixin`.
# Related:
# - api/services/ugs/generation_submit_helpers.py
# - api/services/ugs/unified_generation_service.py
# - api/services/ugs/generation_lifecycle.py
# - api/services/ugs/direct_generation_execution.py
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin attrs (db, sibling helpers) are provided by UnifiedGenerationService composition.

from __future__ import annotations

import asyncio
import inspect
import logging
from datetime import timedelta
from typing import Any
from uuid import UUID

from api.models.database_models import GenerationRequest, GenerationType
from api.services.queue_features import QUEUE_STATUS_QUEUED, utcnow_naive
from api.services.ugs.generation_lifecycle import (
    EXECUTION_BACKEND_DIRECT,
    EXECUTION_BACKEND_QUEUE_WORKER,
    IDEMPOTENT_REUSABLE_STATUSES,
)
from api.services.ugs.generation_submit_helpers import (
    build_cache_hit_response,
    build_reused_generation_response,
    coerce_uuid,
    finalize_request_as_cancelled,
    finalize_request_as_failed,
    find_latest_idempotent_request,
    generate_user_scoped_cache_key,
    poll_wait_for_generation_result,
    resolve_queue_enabled,
    resolve_type_metadata,
    resolve_use_cache,
    try_publish_queued_generation,
    ugs_type_key_should_skip_result_cache,
)
from api.services.ugs.provider_manager_service_v2 import ProviderError

logger = logging.getLogger(__name__)

# Re-export for stream entry and other callers of the historical import path.
__all__ = ["GenerationSubmitMixin", "ugs_type_key_should_skip_result_cache"]


class GenerationSubmitMixin:
    """Main generate() entry and idempotency helpers."""

    def _coerce_uuid(self, value: str | UUID | None) -> UUID | None:
        return coerce_uuid(value)

    async def _find_latest_idempotent_request(
        self,
        *,
        user_id: str,
        generation_type: GenerationType,
        idempotency_key: str,
    ) -> GenerationRequest | None:
        return await find_latest_idempotent_request(
            self.db,
            user_id=user_id,
            generation_type=generation_type,
            idempotency_key=idempotency_key,
        )

    async def _build_reused_generation_response(
        self, request: GenerationRequest, generation_type: GenerationType
    ) -> dict[str, Any]:
        return await build_reused_generation_response(self, request, generation_type)

    def _generate_cache_key(self, type_key: str, input_data: dict[str, Any], *, user_id: str | None = None) -> str:
        return generate_user_scoped_cache_key(type_key, input_data, user_id=user_id)

    async def generate(
        self,
        user_id: str,
        type_key: str,
        input_data: dict[str, Any],
        project_id: str | None = None,
        company_id: str | None = None,
        priority: int = 5,
        idempotency_key: str | None = None,
        *,
        skip_queue: bool = False,
    ) -> dict[str, Any]:
        """
        🔥 MAIN GENERATION ENTRY POINT 🔥
        Запуск генерации любого типа контента
        """
        request: GenerationRequest | None = None
        try:
            generation_type_or_awaitable = self.type_service.get_by_key(type_key)
            generation_type = (
                await generation_type_or_awaitable
                if inspect.isawaitable(generation_type_or_awaitable)
                else generation_type_or_awaitable
            )
            if not generation_type:
                msg = (
                    f"Тип генерации '{type_key}' не найден. "
                    "Создайте его или включите в UGS Admin, чтобы runtime использовал запись из БД."
                )
                raise ValueError(msg)
            is_active_attr = generation_type.is_active
            is_active_value = bool(is_active_attr) if is_active_attr is not None else False
            if not is_active_value:  # type: ignore[truthy-bool]
                msg = f"Тип генерации '{type_key}' не найден или выключен."
                raise ValueError(msg)

            existing_idempotent_request: GenerationRequest | None = None
            retry_count = 0
            if idempotency_key:
                existing_idempotent_request = await self._find_latest_idempotent_request(
                    user_id=user_id,
                    generation_type=generation_type,
                    idempotency_key=idempotency_key,
                )
                if existing_idempotent_request is not None:
                    existing_status = str(
                        self._status_payload_from_request(existing_idempotent_request).get("status") or "pending"
                    )
                    if existing_status in IDEMPOTENT_REUSABLE_STATUSES:
                        self._log_lifecycle(
                            "idempotency_reused",
                            request=existing_idempotent_request,
                            user_id=user_id,
                            type_key=type_key,
                            status=existing_status,
                            stage=str(
                                self._status_payload_from_request(existing_idempotent_request).get("stage") or ""
                            ),
                            backend=str(
                                self._status_payload_from_request(existing_idempotent_request).get("execution_backend")
                                or ""
                            ),
                            detail="generate",
                        )
                        return await self._build_reused_generation_response(
                            existing_idempotent_request, generation_type
                        )
                    retry_count = int(existing_idempotent_request.retry_count or 0) + 1

            await self.billing_service.check_limits(user_id, generation_type)

            type_metadata = resolve_type_metadata(generation_type)
            use_cache = resolve_use_cache(generation_type, type_key, type_metadata)

            cache_key = None
            if use_cache:
                cache_key = self._generate_cache_key(type_key, input_data, user_id=user_id)
                cached_result = await self.cache_service.get(cache_key, update_access_stats=False)
                if cached_result:
                    await self.provider_manager.initialize()
                    enriched_cached_result = await self._enrich_result_with_assets(
                        cached_result,
                        str(generation_type.provider) if generation_type.provider is not None else None,
                    )
                    sanitized_preview = self._sanitize_generation_result(enriched_cached_result)
                    return build_cache_hit_response(
                        generation_type=generation_type,
                        enriched_cached_result=enriched_cached_result,
                        sanitized_preview=sanitized_preview,
                        idempotency_key=idempotency_key,
                        type_key=type_key,
                    )

            queue_enabled, skip_queue = resolve_queue_enabled(
                type_metadata=type_metadata, skip_queue=skip_queue, type_key=type_key
            )
            initial_backend = EXECUTION_BACKEND_QUEUE_WORKER if queue_enabled else EXECUTION_BACKEND_DIRECT
            estimated_completion = (
                utcnow_naive() + timedelta(seconds=int(generation_type.estimated_time or 0))
            ).isoformat()
            request = GenerationRequest(
                user_id=user_id,
                project_id=project_id,
                company_id=company_id,
                type_id=generation_type.id,
                status="pending",
                priority=priority,
                retry_count=retry_count,
                input_data=input_data,
                request_metadata={},
            )
            self._update_request_lifecycle(
                request,
                stage="queued",
                queue_status=QUEUE_STATUS_QUEUED,
                execution_mode="queue_candidate" if queue_enabled else "direct_inline",
                execution_backend=initial_backend,
                progress=0.0,
                progress_message="Запрос принят и ожидает выполнения.",
                retry_count=retry_count,
                idempotency_key=idempotency_key,
                estimated_completion=estimated_completion,
                extra_metadata={
                    "queued_at": utcnow_naive().isoformat(),
                    "type_key": type_key,
                    "request_origin": "generate",
                    "retry_parent_request_id": str(existing_idempotent_request.id)
                    if existing_idempotent_request is not None
                    else None,
                },
            )
            self.db.add(request)
            await self.db.commit()
            await self.db.refresh(request)
            self._log_lifecycle(
                "request_created",
                request=request,
                user_id=user_id,
                type_key=type_key,
                status="pending",
                stage="queued",
                backend=initial_backend,
            )

            request_id_value = request.id if isinstance(request.id, UUID) else UUID(str(request.id))
            user_id_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
            await self.metrics_service.record_generation_start(request_id_value, type_key, user_id_uuid)

            if queue_enabled:
                queued_response = await try_publish_queued_generation(
                    self,
                    request=request,
                    generation_type=generation_type,
                    user_id=user_id,
                    type_key=type_key,
                    project_id=project_id,
                    company_id=company_id,
                    priority=priority,
                    retry_count=retry_count,
                    idempotency_key=idempotency_key,
                    estimated_completion=estimated_completion,
                )
                if queued_response is not None:
                    return queued_response

            return await self._process_direct_generation(
                request, generation_type, user_id, cache_key if use_cache else None
            )

        except asyncio.CancelledError:
            cancel_msg = "Generation cancelled by caller."
            logger.warning(
                "UGS generation cancelled for user %s, type %s",
                user_id,
                type_key,
            )
            await finalize_request_as_cancelled(self, request, cancel_msg=cancel_msg)
            raise
        except ProviderError as provider_error:
            error_msg = str(provider_error)
            error_str = error_msg.lower()
            any(
                keyword in error_str
                for keyword in [
                    "cudnn",
                    "libcudnn",
                    "cudnncreatetensordescriptor",
                    "invalid handle",
                    "cannot load symbol",
                    "unable to load",
                ]
            )

            from api.services.ugs.provider_manager_service_v2 import (
                AllProvidersFailedError,
                ProviderNotFoundError,
            )

            if isinstance(provider_error, (ProviderNotFoundError, AllProvidersFailedError)):
                logger.warning(
                    "UGS generation failed for user %s, type %s: %s",
                    user_id,
                    type_key,
                    error_msg,
                )
            else:
                logger.exception(
                    "UGS generation failed for user %s, type %s: %s",
                    user_id,
                    type_key,
                    error_msg,
                )

            await finalize_request_as_failed(self, request, error_msg=error_msg)
            raise ValueError(error_msg) from provider_error
        except Exception as e:
            error_msg = str(e)
            logger.exception(
                "UGS generation failed for user %s, type %s: %s",
                user_id,
                type_key,
                error_msg,
            )
            await finalize_request_as_failed(self, request, error_msg=error_msg)
            raise

    async def generate_and_wait(
        self,
        user_id: str,
        type_key: str,
        input_data: dict[str, Any],
        project_id: str | None = None,
        company_id: str | None = None,
        priority: int = 5,
        idempotency_key: str | None = None,
        *,
        timeout_seconds: float = 120.0,
        poll_interval: float = 1.0,
        on_status: Any | None = None,
    ) -> dict[str, Any]:
        """Start a generation and wait for the final completed payload."""
        generation = await self.generate(
            user_id=user_id,
            type_key=type_key,
            input_data=input_data,
            project_id=project_id,
            company_id=company_id,
            priority=priority,
            idempotency_key=idempotency_key,
        )

        normalized_status = self._normalize_status(generation.get("status"))
        if normalized_status == "completed":
            return generation

        request_id = generation.get("request_id")
        if not request_id:
            msg = f"Генерация для типа '{type_key}' не вернула request_id."
            raise RuntimeError(msg)

        return await self.wait_for_generation_result(
            str(request_id),
            timeout_seconds=timeout_seconds,
            poll_interval=poll_interval,
            on_status=on_status,
        )

    async def wait_for_generation_result(
        self,
        request_id: str,
        *,
        timeout_seconds: float = 120.0,
        poll_interval: float = 1.0,
        on_status: Any | None = None,
    ) -> dict[str, Any]:
        """Poll generation status until completion and return the final result."""
        return await poll_wait_for_generation_result(
            self,
            request_id,
            timeout_seconds=timeout_seconds,
            poll_interval=poll_interval,
            on_status=on_status,
        )
