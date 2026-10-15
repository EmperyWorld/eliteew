# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Failure handlers and billing-failed finalize for UGS direct provider execution.
# Invariants:
# - UgsBillingFailedError means request row is already persisted as failed; do not remutate lifecycle.
# Related:
# - api/services/ugs/direct_generation_execution.py
# - api/services/ugs/direct_generation_execute.py
# ---
"""UGS direct generation — error finalize helpers."""

from __future__ import annotations

import contextlib
import logging
from datetime import UTC, datetime
from typing import Any

from api.models.database_models import GenerationRequest, GenerationType
from api.schemas.notifications import (
    NotificationCreate,
    NotificationPriority,
    NotificationType,
)
from api.services.ugs.provider_manager_service_v2 import ProviderError

logger = logging.getLogger(__name__)

EXECUTION_BACKEND_DIRECT = "direct_provider"


class UgsBillingFailedError(Exception):
    """Credits could not be deducted; generation row is already persisted as failed."""


async def _commit_failed_request_db(service: Any, request: GenerationRequest) -> None:
    """Commit failed request state with connection-error rollback handling."""
    try:
        await service.db.commit()
    except Exception as commit_error:
        error_str = str(commit_error).lower()
        if "connection is closed" in error_str or "connection closed" in error_str:
            logger.exception(
                "Database connection closed during commit for failed request %s, attempting rollback",
                request.id,
            )
            with contextlib.suppress(Exception):
                await service.db.rollback()
            raise
        if "pendingrollbackerror" in error_str or "pending rollback" in error_str:
            logger.exception(
                "PendingRollbackError during commit for failed request %s, attempting rollback",
                request.id,
            )
            with contextlib.suppress(Exception):
                await service.db.rollback()
            raise
        raise


async def finalize_billing_failed_request(
    service: Any,
    request: GenerationRequest,
    *,
    user_id: str,
    type_key_value: str,
    start_time: datetime,
    cost_credits: int,
    billing_msg: str,
    provider_name: Any,
    resolved_provider_name: str,
    provider_attempts: int,
    metadata_source: dict[str, Any],
) -> None:
    """Persist failed/billing_failed row and raise UgsBillingFailedError."""
    failed_at = datetime.now(UTC).replace(tzinfo=None)
    request.status = "failed"  # type: ignore[assignment]
    request.error_message = billing_msg  # type: ignore[assignment]
    request.completed_at = failed_at  # type: ignore[assignment]
    request.updated_at = failed_at  # type: ignore[assignment]
    request.credits_used = None  # type: ignore[assignment]
    request.output_data = {  # type: ignore[assignment]
        "result": None,
        "has_full_data": False,
        "provider": provider_name,
        "metadata": {
            **(metadata_source if isinstance(metadata_source, dict) else {}),
            "billing_failed": True,
        },
    }
    service._update_request_lifecycle(
        request,
        stage="failed",
        queue_status="failed",
        execution_backend=service._serialize_request_metadata(request).get("execution_backend")
        or EXECUTION_BACKEND_DIRECT,
        progress=100.0,
        progress_message="Списание кредитов не удалось.",
        provider_name=resolved_provider_name,
        provider_attempt=provider_attempts,
        retry_count=int(request.retry_count or 0),
        error_type="billing_failed",
        estimated_completion=failed_at.isoformat(),
        extra_metadata={"processing_completed_at": failed_at.isoformat()},
    )
    logger.warning(
        "[STEP] ugs_billing_failed request_id=%s user_id=%s cost=%s",
        request.id,
        user_id,
        cost_credits,
    )
    try:
        await service.db.commit()
    except Exception:
        with contextlib.suppress(Exception):
            await service.db.rollback()
        raise
    with contextlib.suppress(Exception):
        await service.queue_manager.update_queue_status(str(request.id), "failed")
    with contextlib.suppress(Exception):
        await service.metrics_service.record_generation_complete(
            str(request.id),
            success=False,
            duration_ms=int((failed_at - start_time).total_seconds() * 1000),
            provider_name=resolved_provider_name,
            credits_used=None,
            output_size_bytes=None,
            error_message=billing_msg,
            error_type="billing_failed",
        )
    service._log_lifecycle(
        "failed",
        request=request,
        user_id=user_id,
        type_key=type_key_value,
        status="failed",
        stage="failed",
        backend=str(service._serialize_request_metadata(request).get("execution_backend") or ""),
        provider_name=resolved_provider_name,
        detail="billing_failed",
    )
    raise UgsBillingFailedError(billing_msg)


async def handle_direct_generation_cancelled(
    service: Any,
    request: GenerationRequest,
    generation_type: GenerationType,
    user_id: str,
    *,
    start_time: datetime,
) -> None:
    """Finalize request as cancelled after asyncio.CancelledError."""
    completed_at = datetime.now(UTC).replace(tzinfo=None)
    request.status = "cancelled"  # type: ignore[assignment]
    request.error_message = "Generation cancelled by caller."  # type: ignore[assignment]
    request.completed_at = completed_at  # type: ignore[assignment]
    request.updated_at = completed_at  # type: ignore[assignment]
    service._update_request_lifecycle(
        request,
        stage="cancelled",
        queue_status="cancelled",
        execution_backend=service._serialize_request_metadata(request).get("execution_backend")
        or EXECUTION_BACKEND_DIRECT,
        progress=100.0,
        progress_message="Запрос отменён до завершения.",
        provider_name=str(generation_type.provider) if generation_type.provider is not None else None,
        retry_count=int(request.retry_count or 0),
        error_type="cancelled",
        estimated_completion=completed_at.isoformat(),
        extra_metadata={"processing_completed_at": completed_at.isoformat()},
    )
    with contextlib.suppress(Exception):
        await service.db.commit()
    with contextlib.suppress(Exception):
        await service.queue_manager.update_queue_status(str(request.id), "cancelled")
    with contextlib.suppress(Exception):
        provider_name_str = str(generation_type.provider) if generation_type.provider is not None else None
        await service.metrics_service.record_generation_complete(
            str(request.id),
            success=False,
            duration_ms=int((completed_at - start_time).total_seconds() * 1000),
            provider_name=provider_name_str,
            credits_used=None,
            output_size_bytes=None,
            error_message="Generation cancelled by caller.",
            error_type="cancelled",
        )
    service._log_lifecycle(
        "cancelled",
        request=request,
        user_id=user_id,
        type_key=str(generation_type.type_key) if generation_type.type_key is not None else None,
        status="cancelled",
        stage="cancelled",
        backend=str(service._serialize_request_metadata(request).get("execution_backend") or ""),
        provider_name=str(generation_type.provider) if generation_type.provider is not None else None,
        detail="asyncio_cancelled",
    )


async def handle_direct_generation_provider_error(
    service: Any,
    request: GenerationRequest,
    generation_type: GenerationType,
    user_id: str,
    error: ProviderError,
    *,
    start_time: datetime,
) -> None:
    """Finalize request as failed after ProviderError."""
    completed_at = datetime.now(UTC).replace(tzinfo=None)
    request.status = "failed"  # type: ignore[assignment]
    request.error_message = str(error)  # type: ignore[assignment]
    request.completed_at = completed_at  # type: ignore[assignment]
    request.updated_at = completed_at  # type: ignore[assignment]
    service._update_request_lifecycle(
        request,
        stage="failed",
        queue_status="failed",
        execution_backend=service._serialize_request_metadata(request).get("execution_backend")
        or EXECUTION_BACKEND_DIRECT,
        progress=100.0,
        progress_message="Ошибка AI-провайдера.",
        provider_name=str(generation_type.provider) if generation_type.provider is not None else None,
        retry_count=int(request.retry_count or 0),
        error_type="provider_error",
        estimated_completion=completed_at.isoformat(),
        extra_metadata={"processing_completed_at": completed_at.isoformat()},
    )
    await _commit_failed_request_db(service, request)

    duration_ms = int((completed_at - start_time).total_seconds() * 1000)
    await service.queue_manager.update_queue_status(str(request.id), "failed")

    try:
        provider_name_str = str(generation_type.provider) if generation_type.provider is not None else None
        await service.metrics_service.record_generation_complete(
            str(request.id),
            success=False,
            duration_ms=duration_ms,
            provider_name=provider_name_str,
            credits_used=None,
            output_size_bytes=None,
            error_message=str(error),
            error_type="provider_error",
        )
    except Exception as metrics_error:
        logger.warning("Failed to record metrics for failed request %s: %s", request.id, metrics_error)

    service._log_lifecycle(
        "failed",
        request=request,
        user_id=user_id,
        type_key=str(generation_type.type_key) if generation_type.type_key is not None else None,
        status="failed",
        stage="failed",
        backend=str(service._serialize_request_metadata(request).get("execution_backend") or ""),
        provider_name=str(generation_type.provider) if generation_type.provider is not None else None,
        detail=str(error),
    )


async def handle_direct_generation_validation_error(
    service: Any,
    request: GenerationRequest,
    generation_type: GenerationType,
    user_id: str,
    error: ValueError | TypeError,
    *,
    start_time: datetime,
) -> None:
    """Finalize request as failed after ValueError or TypeError."""
    completed_at = datetime.now(UTC).replace(tzinfo=None)
    request.status = "failed"  # type: ignore[assignment]
    request.error_message = str(error)  # type: ignore[assignment]
    request.completed_at = completed_at  # type: ignore[assignment]
    request.updated_at = completed_at  # type: ignore[assignment]
    service._update_request_lifecycle(
        request,
        stage="failed",
        queue_status="failed",
        execution_backend=service._serialize_request_metadata(request).get("execution_backend")
        or EXECUTION_BACKEND_DIRECT,
        progress=100.0,
        progress_message="Ошибка валидации запроса.",
        provider_name=str(generation_type.provider) if generation_type.provider is not None else None,
        retry_count=int(request.retry_count or 0),
        error_type="validation_error",
        estimated_completion=completed_at.isoformat(),
        extra_metadata={"processing_completed_at": completed_at.isoformat()},
    )
    await _commit_failed_request_db(service, request)

    duration_ms = int((completed_at - start_time).total_seconds() * 1000)
    await service.queue_manager.update_queue_status(str(request.id), "failed")

    try:
        provider_name_str = str(generation_type.provider) if generation_type.provider is not None else None
        await service.metrics_service.record_generation_complete(
            str(request.id),
            success=False,
            duration_ms=duration_ms,
            provider_name=provider_name_str,
            credits_used=None,
            output_size_bytes=None,
            error_message=str(error),
            error_type="validation_error",
        )
    except Exception as metrics_error:
        logger.warning("Failed to record metrics for failed request %s: %s", request.id, metrics_error)

    service._log_lifecycle(
        "failed",
        request=request,
        user_id=user_id,
        type_key=str(generation_type.type_key) if generation_type.type_key is not None else None,
        status="failed",
        stage="failed",
        backend=str(service._serialize_request_metadata(request).get("execution_backend") or ""),
        provider_name=str(generation_type.provider) if generation_type.provider is not None else None,
        detail=str(error),
    )


async def handle_direct_generation_unexpected_error(
    service: Any,
    request: GenerationRequest,
    generation_type: GenerationType,
    user_id: str,
    error: Exception,
    *,
    start_time: datetime,
    type_key_value: str,
) -> None:
    """Finalize request as failed after an unexpected error."""
    completed_at = datetime.now(UTC).replace(tzinfo=None)
    request.status = "failed"  # type: ignore[assignment]
    request.error_message = str(error)  # type: ignore[assignment]
    request.completed_at = completed_at  # type: ignore[assignment]
    request.updated_at = completed_at  # type: ignore[assignment]
    service._update_request_lifecycle(
        request,
        stage="failed",
        queue_status="failed",
        execution_backend=service._serialize_request_metadata(request).get("execution_backend")
        or EXECUTION_BACKEND_DIRECT,
        progress=100.0,
        progress_message="Непредвиденная ошибка выполнения.",
        provider_name=str(generation_type.provider) if generation_type.provider is not None else None,
        retry_count=int(request.retry_count or 0),
        error_type="unexpected_error",
        estimated_completion=completed_at.isoformat(),
        extra_metadata={"processing_completed_at": completed_at.isoformat()},
    )
    await _commit_failed_request_db(service, request)

    duration_ms = int((completed_at - start_time).total_seconds() * 1000)
    await service.queue_manager.update_queue_status(str(request.id), "failed")

    provider_name_str = str(generation_type.provider) if generation_type.provider is not None else None
    try:
        await service.metrics_service.record_generation_complete(
            str(request.id),
            success=False,
            duration_ms=duration_ms,
            provider_name=provider_name_str,
            credits_used=None,
            output_size_bytes=None,
            error_message=str(error),
            error_type="unexpected_error",
        )
    except Exception as metrics_error:
        logger.warning("Failed to record metrics for failed request %s: %s", request.id, metrics_error)

    try:
        from api.services.ugs import direct_generation_execution as facade

        notification_service = facade.get_notification_service()
        title = f"UGS: Ошибка генерации ({type_key_value})"
        await notification_service.send_to_user(
            user_id,
            NotificationCreate(
                type=NotificationType.ERROR,
                title=title,
                message=str(error),
                priority=NotificationPriority.HIGH,
                persistent=True,
                source="ugs",
                metadata={
                    "request_id": str(request.id),
                    "type_key": type_key_value,
                    "provider": provider_name_str,
                    "open_app": {
                        "appComponent": "MusicGenerator"
                        if str(type_key_value).startswith("music_generator")
                        else "UGSHubApp"
                    },
                },
            ),
        )
    except Exception:
        logger.debug(
            "NotificationService: failed to send UGS error notification for request %s and user %s",
            getattr(request, "id", None),
            user_id,
            exc_info=True,
        )

    service._log_lifecycle(
        "failed",
        request=request,
        user_id=user_id,
        type_key=str(generation_type.type_key) if generation_type.type_key is not None else None,
        status="failed",
        stage="failed",
        backend=str(service._serialize_request_metadata(request).get("execution_backend") or ""),
        provider_name=str(generation_type.provider) if generation_type.provider is not None else None,
        detail=str(error),
    )
    logger.exception(
        "Unexpected error in direct generation for request %s",
        request.id,
    )
