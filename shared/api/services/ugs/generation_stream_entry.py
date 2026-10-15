# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# UGS SSE/stream entry: non-blocking start_generation_for_stream, detached direct execution, SSE event bridge.
# Invariants:
# - Detached direct path uses an isolated DB session; failures finalize via detached_generation_failure.
# - stream_generation_events delegates polling to stream_generation_runtime.iter_stream_generation_events.
# Related:
# - api/services/ugs/unified_generation_service.py
# - api/services/ugs/stream_generation_runtime.py
# - api/services/ugs/detached_generation_failure.py
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin attrs (db, sibling helpers) are provided by UnifiedGenerationService composition.

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import timedelta
from functools import partial
from typing import Any
from uuid import UUID

from api.models.database_models import GenerationRequest
from api.services.queue_features import (
    QUEUE_FLAG_UGS,
    QUEUE_STATUS_PENDING,
    QUEUE_STATUS_QUEUED,
    is_queue_enabled,
    utcnow_naive,
)
from api.services.rabbitmq_service import get_rabbitmq_service
from api.services.ugs.generation_lifecycle import (
    EXECUTION_BACKEND_DIRECT,
    EXECUTION_BACKEND_QUEUE_WORKER,
    EXECUTION_CONTRACT_VERSION,
    IDEMPOTENT_REUSABLE_STATUSES,
)
from api.services.ugs.generation_submit import ugs_type_key_should_skip_result_cache
from api.services.ugs.provider_manager_service_v2 import ProviderError
from api.services.ugs.stream_generation_runtime import iter_stream_generation_events

logger = logging.getLogger(__name__)


class GenerationStreamEntryMixin:
    """SSE-oriented generation start and event streaming."""

    async def start_generation_for_stream(
        self,
        user_id: str,
        type_key: str,
        input_data: dict[str, Any],
        project_id: str | None = None,
        company_id: str | None = None,
        priority: int = 5,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """
        Start generation and return request_id immediately (no blocking).
        For direct/ComfyUI path runs _process_direct_generation in background task.
        Used by SSE stream endpoint: caller polls get_status until completed/failed.
        """
        request: GenerationRequest | None = None
        try:
            generation_type = await self.type_service.get_by_key(type_key)
            if not generation_type:
                msg = f"Тип генерации '{type_key}' не найден."
                raise ValueError(msg)
            is_active_attr = generation_type.is_active
            if not bool(is_active_attr if is_active_attr is not None else False):
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
                            detail="stream",
                        )
                        return await self._build_reused_generation_response(
                            existing_idempotent_request, generation_type
                        )
                    retry_count = int(existing_idempotent_request.retry_count or 0) + 1
            await self.billing_service.check_limits(user_id, generation_type)
            type_metadata_raw = getattr(generation_type, "type_metadata", None) or getattr(
                generation_type, "metadata", None
            )
            type_metadata = (
                type_metadata_raw
                if isinstance(type_metadata_raw, dict)
                else (getattr(type_metadata_raw, "__dict__", None) or {})
            )
            if isinstance(type_metadata, dict) and "enable_cache" in type_metadata:
                use_cache = bool(type_metadata.get("enable_cache", True))
            else:
                category_value = generation_type.category if generation_type.category is not None else None
                use_cache = not (category_value is not None and str(category_value).lower() == "image")
            if ugs_type_key_should_skip_result_cache(type_key):
                use_cache = False
            if not isinstance(type_metadata, dict):
                type_metadata = {}
            cache_key = None
            if use_cache:
                cache_key = self._generate_cache_key(type_key, input_data, user_id=user_id)
                cached_result = await self.cache_service.get(cache_key, update_access_stats=False)
                if cached_result:
                    await self.provider_manager.initialize()
                    enriched = await self._enrich_result_with_assets(
                        cached_result,
                        str(generation_type.provider) if generation_type.provider is not None else None,
                    )
                    sanitized = self._sanitize_generation_result(enriched)
                    return {
                        "request_id": str(uuid.uuid4()),
                        "status": "completed",
                        "cached": True,
                        "result": enriched,
                        "result_preview": sanitized,
                        "estimated_time": generation_type.estimated_time,
                        "execution_backend": EXECUTION_BACKEND_DIRECT,
                        "stage": "completed",
                        "progress_message": "Результат возвращён из кеша.",
                        "idempotency_key": idempotency_key,
                        "reused": False,
                        "metadata": {
                            "execution_contract_version": EXECUTION_CONTRACT_VERSION,
                            "execution_backend": EXECUTION_BACKEND_DIRECT,
                            "stage": "completed",
                            "progress": 100.0,
                            "progress_message": "Результат возвращён из кеша.",
                            "idempotency_key": idempotency_key,
                            "cache_hit": True,
                            "type_key": type_key,
                        },
                    }
            queue_enabled = is_queue_enabled(QUEUE_FLAG_UGS, default=True)
            if isinstance(type_metadata, dict) and type_metadata.get("skip_queue") is True:
                queue_enabled = False
            from api.services.ugs.ugs_execution_context import (  # noqa: PLC0415
                get_active_ugs_worker_request_id,
            )

            parent_worker_request_id = get_active_ugs_worker_request_id()
            if parent_worker_request_id:
                logger.warning(
                    "UGS nested stream generate inside queue worker parent_request_id=%s type_key=%s; forcing direct path",
                    parent_worker_request_id,
                    type_key,
                )
                queue_enabled = False
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
                execution_mode="queue_candidate" if queue_enabled else "direct_detached",
                execution_backend=initial_backend,
                progress=0.0,
                progress_message="Запрос принят и ожидает выполнения.",
                retry_count=retry_count,
                idempotency_key=idempotency_key,
                estimated_completion=estimated_completion,
                extra_metadata={
                    "queued_at": utcnow_naive().isoformat(),
                    "type_key": type_key,
                    "request_origin": "stream",
                    "retry_parent_request_id": str(existing_idempotent_request.id)
                    if existing_idempotent_request is not None
                    else None,
                },
            )
            self.db.add(request)
            await self.db.commit()
            await self.db.refresh(request)
            request_id_value = request.id if isinstance(request.id, UUID) else UUID(str(request.id))
            user_id_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
            await self.metrics_service.record_generation_start(request_id_value, type_key, user_id_uuid)
            if queue_enabled:
                await self.queue_manager.add_to_queue(str(request.id), priority)
                published = await get_rabbitmq_service().publish_ai_generation(
                    request_id=str(request.id),
                    type_key=type_key,
                    payload={
                        "task_type": "ugs_generation",
                        "user_id": user_id,
                        "project_id": project_id,
                        "company_id": company_id,
                        "priority": priority,
                    },
                )
                if published:
                    metadata = self._update_request_lifecycle(
                        request,
                        stage="queued",
                        queue_status=QUEUE_STATUS_QUEUED,
                        execution_mode="queue",
                        execution_backend=EXECUTION_BACKEND_QUEUE_WORKER,
                        progress=5.0,
                        progress_message="Запрос поставлен в очередь на выполнение.",
                        retry_count=retry_count,
                        idempotency_key=idempotency_key,
                        estimated_completion=estimated_completion,
                        extra_metadata={"queue_transport": "rabbitmq"},
                    )
                    await self.db.commit()
                    return {
                        "request_id": str(request.id),
                        "status": QUEUE_STATUS_QUEUED,
                        "estimated_time": generation_type.estimated_time,
                        "execution_backend": EXECUTION_BACKEND_QUEUE_WORKER,
                        "stage": "queued",
                        "progress_message": "Запрос поставлен в очередь на выполнение.",
                        "idempotency_key": idempotency_key,
                        "reused": False,
                        "metadata": metadata,
                    }
                await self.queue_manager.remove_from_queue(str(request.id))
                self._update_request_lifecycle(
                    request,
                    stage="inline_fallback",
                    queue_status=QUEUE_STATUS_PENDING,
                    execution_mode="inline_fallback",
                    execution_backend=EXECUTION_BACKEND_DIRECT,
                    progress=10.0,
                    progress_message="Публикация в очередь не удалась, выполняем запрос напрямую.",
                    retry_count=retry_count,
                    idempotency_key=idempotency_key,
                    estimated_completion=estimated_completion,
                    extra_metadata={"queue_publish_failed": True},
                )
                await self.db.commit()
            asyncio.create_task(
                self._run_detached_direct_generation(
                    request_id=str(request.id),
                    cache_key=cache_key if use_cache else None,
                )
            )
            return {
                "request_id": str(request.id),
                "status": "processing",
                "estimated_time": generation_type.estimated_time,
                "execution_backend": EXECUTION_BACKEND_DIRECT,
                "stage": "detached_processing",
                "progress_message": "Запрос передан в фоновое выполнение.",
                "idempotency_key": idempotency_key,
                "reused": False,
                "metadata": self._serialize_request_metadata(request),
            }
        except (ValueError, ProviderError):  # fmt: skip
            raise
        except Exception as e:
            logger.exception("start_generation_for_stream failed: %s", e)
            raise

    async def _run_detached_direct_generation(
        self,
        *,
        request_id: str,
        cache_key: str | None = None,
        fallback_error_message: str | None = None,
    ) -> None:
        """Run direct generation in an isolated DB session for SSE/background paths."""
        try:
            from api.core.database_manager import get_database_manager  # noqa: PLC0415

            content_service = None
            try:
                from api.routers.unified_content import get_content_service  # noqa: PLC0415

                content_service = await get_content_service()
            except (ImportError, AttributeError, RuntimeError):  # fmt: skip
                content_service = None

            manager = await get_database_manager()
            async with manager.get_postgres_session() as detached_db:
                from api.services.ugs.unified_generation_service import (  # noqa: PLC0415
                    UnifiedGenerationService,
                )

                detached_service = UnifiedGenerationService(detached_db, content_service=content_service)
                try:
                    request = await detached_service._get_request_with_type(request_id)
                    if not request.generation_type:
                        msg = f"Для запроса {request_id} не найден тип генерации."
                        raise ValueError(msg)

                    fallback_error = RuntimeError(fallback_error_message) if fallback_error_message else None
                    await detached_service._process_direct_generation(
                        request,
                        request.generation_type,
                        str(request.user_id),
                        cache_key=cache_key,
                        fallback_error=fallback_error,
                    )
                finally:
                    await detached_service.close()
        except Exception as exc:
            logger.exception(
                "Detached direct generation failed for request %s",
                request_id,
            )
            from api.services.ugs.detached_generation_failure import (  # noqa: PLC0415
                finalize_detached_generation_failure,
            )

            await finalize_detached_generation_failure(
                request_id,
                error_message=str(exc),
            )

    async def stream_generation_events(
        self,
        request_id: str,
        user_id: str,
        *,
        poll_interval: float = 3.0,
        keep_alive_interval: float = 8.0,
    ):
        """
        Async generator yielding SSE event dicts: progress, keep_alive, result, error.
        Does not close until result or error is sent.
        """
        scoped_get_status = partial(self.get_status, user_id=user_id)
        scoped_get_result = partial(self.get_result, user_id=user_id)
        async for event in iter_stream_generation_events(
            request_id=request_id,
            get_status=scoped_get_status,
            get_result=scoped_get_result,
            poll_interval=poll_interval,
            keep_alive_interval=keep_alive_interval,
        ):
            yield event
