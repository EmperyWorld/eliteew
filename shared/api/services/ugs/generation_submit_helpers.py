# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Coherent helpers for UGS GenerationSubmitMixin: idempotency lookup/reuse, cache short-circuit,
# queue publish vs inline fallback, terminal error finalization, and blocking wait polling.
# Invariants:
# - IDEMPOTENT_REUSABLE_STATUSES and music type_key cache skip match generation_submit generate() path.
# - Mixin method names on GenerationSubmitMixin stay as thin wrappers for stream/tests/callers.
# Related:
# - api/services/ugs/generation_submit.py
# - api/services/ugs/generation_lifecycle.py
# - api/services/ugs/generation_stream_entry.py
# ---

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any
from uuid import UUID

from api.models.database_models import GenerationRequest, GenerationType
from api.services.queue_features import (
    QUEUE_FLAG_UGS,
    QUEUE_STATUS_PENDING,
    QUEUE_STATUS_QUEUED,
    is_queue_enabled,
)
from api.services.rabbitmq_service import get_rabbitmq_service
from api.services.ugs import generation_flow as ugs_generation_flow
from api.services.ugs.generation_lifecycle import (
    EXECUTION_BACKEND_DIRECT,
    EXECUTION_BACKEND_QUEUE_WORKER,
    EXECUTION_CONTRACT_VERSION,
)

logger = logging.getLogger(__name__)


def ugs_type_key_should_skip_result_cache(type_key: str) -> bool:
    """
    Генератор песен (и смежные UGS-типы): кэш по hash(input_data) недопустим —
    повтор с теми же lyrics/tags должен снова вызывать провайдера, иначе «ещё раз»
    без смены полей отдаёт тот же файл и создаёт ощущение «ничего не сгенерилось».
    """
    return (type_key or "").strip().lower().startswith("music_generator_")


def coerce_uuid(value: str | UUID | None) -> UUID | None:
    if value is None:
        return None
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (TypeError, ValueError):  # fmt: skip
        return None


def generate_user_scoped_cache_key(type_key: str, input_data: dict[str, Any], *, user_id: str | None = None) -> str:
    """Generate user-scoped cache key; delegates content fingerprinting to generation_flow."""
    content_key = ugs_generation_flow.generate_cache_key(type_key, input_data)
    if user_id:
        return f"user:{user_id}:{content_key}"
    return content_key


async def find_latest_idempotent_request(
    db: Any,
    *,
    user_id: str,
    generation_type: GenerationType,
    idempotency_key: str,
) -> GenerationRequest | None:
    from sqlalchemy import select  # type: ignore[import-not-found]
    from sqlalchemy.orm import selectinload  # type: ignore[import-not-found]

    user_uuid = coerce_uuid(user_id)
    if user_uuid is None:
        return None
    stmt = (
        select(GenerationRequest)
        .options(selectinload(GenerationRequest.generation_type))
        .where(
            GenerationRequest.user_id == user_uuid,
            GenerationRequest.type_id == generation_type.id,
            GenerationRequest.deleted_at.is_(None),
            GenerationRequest.request_metadata.op("->>")("idempotency_key") == idempotency_key,
        )
        .order_by(GenerationRequest.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def build_reused_generation_response(
    service: Any, request: GenerationRequest, generation_type: GenerationType
) -> dict[str, Any]:
    status_payload = service._status_payload_from_request(request)
    public_status = str(status_payload.get("status") or "pending")
    response: dict[str, Any] = {
        "request_id": str(request.id),
        "status": public_status,
        "estimated_time": generation_type.estimated_time,
        "message": "Возвращён существующий запрос по idempotency_key.",
        "cached": False,
        "execution_backend": status_payload.get("execution_backend"),
        "stage": status_payload.get("stage"),
        "progress_message": status_payload.get("progress_message"),
        "idempotency_key": status_payload.get("idempotency_key"),
        "reused": True,
        "metadata": status_payload.get("metadata"),
    }
    if public_status == "completed":
        result_payload = await service.get_result(str(request.id))
        response["result"] = result_payload.get("result")
        response["result_preview"] = result_payload.get("result_preview")
        response["message"] = "Результат уже был готов и возвращён повторно."
    elif public_status in {"queued", "processing", "retrying"}:
        response["message"] = "Запрос уже выполняется, возвращён текущий request_id."
    return response


def resolve_type_metadata(generation_type: GenerationType) -> dict[str, Any]:
    type_metadata_raw = getattr(generation_type, "type_metadata", None) or getattr(generation_type, "metadata", None)
    if isinstance(type_metadata_raw, dict):
        return type_metadata_raw
    if hasattr(type_metadata_raw, "__dict__"):
        return type_metadata_raw.__dict__ if type_metadata_raw else {}  # type: ignore[truthy-bool]
    return {}


def resolve_use_cache(generation_type: GenerationType, type_key: str, type_metadata: dict[str, Any]) -> bool:
    if isinstance(type_metadata, dict) and "enable_cache" in type_metadata:  # type: ignore[operator]
        use_cache = type_metadata.get("enable_cache", True)
    else:
        category_value = generation_type.category if generation_type.category is not None else None
        use_cache = not (category_value is not None and str(category_value).lower() == "image")
    if ugs_type_key_should_skip_result_cache(type_key):
        return False
    return bool(use_cache)


def build_cache_hit_response(
    *,
    generation_type: GenerationType,
    enriched_cached_result: Any,
    sanitized_preview: Any,
    idempotency_key: str | None,
    type_key: str,
) -> dict[str, Any]:
    return {
        "request_id": str(uuid.uuid4()),
        "status": "completed",
        "estimated_time": generation_type.estimated_time,
        "cached": True,
        "result": enriched_cached_result,
        "result_preview": sanitized_preview,
        "message": "Результат получен из кеша.",
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


def resolve_queue_enabled(*, type_metadata: dict[str, Any], skip_queue: bool, type_key: str) -> tuple[bool, bool]:
    """
    Returns (queue_enabled, skip_queue) after type_metadata / nested-worker / flag resolution.
    Nested queue-worker generate forces skip_queue=True (same as former inline generate()).
    """
    queue_enabled = is_queue_enabled(QUEUE_FLAG_UGS, default=True)
    if isinstance(type_metadata, dict) and type_metadata.get("skip_queue") is True:
        queue_enabled = False
    if skip_queue:
        queue_enabled = False
    else:
        from api.services.ugs.ugs_execution_context import (  # noqa: PLC0415
            get_active_ugs_worker_request_id,
        )

        parent_worker_request_id = get_active_ugs_worker_request_id()
        if parent_worker_request_id:
            logger.warning(
                "UGS nested generate inside queue worker parent_request_id=%s type_key=%s; forcing skip_queue",
                parent_worker_request_id,
                type_key,
            )
            queue_enabled = False
            skip_queue = True
    return queue_enabled, skip_queue


async def try_publish_queued_generation(
    service: Any,
    *,
    request: GenerationRequest,
    generation_type: GenerationType,
    user_id: str,
    type_key: str,
    project_id: str | None,
    company_id: str | None,
    priority: int,
    retry_count: int,
    idempotency_key: str | None,
    estimated_completion: str,
) -> dict[str, Any] | None:
    """
    Enqueue + RabbitMQ publish. On success return public queued response.
    On publish failure: remove from queue, mark inline_fallback, commit, return None.
    """
    await service.queue_manager.add_to_queue(str(request.id), priority)
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
        metadata = service._update_request_lifecycle(
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
        await service.db.commit()
        service._log_lifecycle(
            "queued",
            request=request,
            user_id=user_id,
            type_key=type_key,
            status=QUEUE_STATUS_QUEUED,
            stage="queued",
            backend=EXECUTION_BACKEND_QUEUE_WORKER,
        )
        return {
            "request_id": str(request.id),
            "status": QUEUE_STATUS_QUEUED,
            "estimated_time": generation_type.estimated_time,
            "message": "Генерация поставлена в очередь.",
            "execution_backend": EXECUTION_BACKEND_QUEUE_WORKER,
            "stage": "queued",
            "progress_message": "Запрос поставлен в очередь на выполнение.",
            "idempotency_key": idempotency_key,
            "reused": False,
            "metadata": metadata,
        }

    await service.queue_manager.remove_from_queue(str(request.id))
    service._update_request_lifecycle(
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
    await service.db.commit()
    service._log_lifecycle(
        "queue_publish_failed",
        request=request,
        user_id=user_id,
        type_key=type_key,
        status="pending",
        stage="inline_fallback",
        backend=EXECUTION_BACKEND_DIRECT,
    )
    return None


async def finalize_request_as_cancelled(service: Any, request: GenerationRequest | None, *, cancel_msg: str) -> None:
    try:
        if request is not None:
            request_id_value = request.id if hasattr(request, "id") and request.id is not None else None
            request_status_value = str(request.status) if request.status is not None else None
            if (
                request_id_value is not None
                and request_status_value
                and request_status_value not in ("failed", "completed", "cancelled")
            ):
                request.status = "cancelled"  # type: ignore[assignment]
                request.error_message = cancel_msg  # type: ignore[assignment]
                await service.db.commit()
                await service.metrics_service.record_generation_complete(
                    str(request_id_value),
                    success=False,
                    duration_ms=0,
                    error_message=cancel_msg,
                    error_type="cancelled",
                )
    except Exception as metrics_error:
        logger.warning("Failed to record cancellation metrics: %s", metrics_error)


async def finalize_request_as_failed(service: Any, request: GenerationRequest | None, *, error_msg: str) -> None:
    try:
        if request is not None:
            request_id_value = request.id if hasattr(request, "id") and request.id is not None else None
            request_status_value = str(request.status) if request.status is not None else None
            if (
                request_id_value is not None
                and request_status_value
                and request_status_value not in ("failed", "completed", "cancelled")
            ):
                request.status = "failed"  # type: ignore[assignment]
                request.error_message = error_msg[:4096] if len(error_msg) > 4096 else error_msg  # type: ignore[assignment]
                await service.db.commit()
                await service.metrics_service.record_generation_complete(
                    str(request_id_value),
                    success=False,
                    duration_ms=0,
                    error_message=error_msg,
                )
    except Exception as metrics_error:
        logger.warning("Failed to record error metrics: %s", metrics_error)


async def poll_wait_for_generation_result(
    service: Any,
    request_id: str,
    *,
    timeout_seconds: float = 120.0,
    poll_interval: float = 1.0,
    on_status: Any | None = None,
) -> dict[str, Any]:
    """Poll generation status until completion and return the final result."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout_seconds

    while True:
        status_payload = await service.get_status(request_id)
        if on_status is not None:
            try:
                maybe = on_status(status_payload)
                if asyncio.iscoroutine(maybe):
                    await maybe
            except Exception as cb_err:
                logger.warning(
                    "wait_for_generation_result on_status failed request_id=%s: %s",
                    request_id,
                    cb_err,
                )
        normalized_status = service._normalize_status(status_payload.get("status"))

        if normalized_status == "completed":
            return await service.get_result(request_id)

        if normalized_status in ("failed", "cancelled"):
            error_message = (
                status_payload.get("error")
                or status_payload.get("error_message")
                or status_payload.get("message")
                or normalized_status
            )
            raise RuntimeError(f"Generation {request_id} {normalized_status}: {error_message}")

        if loop.time() >= deadline:
            raise TimeoutError(f"Timed out waiting for generation {request_id}")

        await asyncio.sleep(poll_interval)
