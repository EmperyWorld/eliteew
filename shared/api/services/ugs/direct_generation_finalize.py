# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Post-success side effects for UGS direct provider execution (metrics, notify, cache, lifecycle log).
# Invariants:
# - Caller must have committed completed row before invoking finalize helpers.
# Related:
# - api/services/ugs/direct_generation_execute.py
# - api/services/ugs/direct_generation_execution.py
# ---
"""UGS direct generation — post-success finalize."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from api.models.database_models import GenerationRequest, GenerationType
from api.schemas.notifications import (
    NotificationCreate,
    NotificationPriority,
    NotificationType,
)

logger = logging.getLogger(__name__)


async def finalize_successful_direct_generation(
    service: Any,
    request: GenerationRequest,
    generation_type: GenerationType,
    *,
    user_id: str,
    cache_key: str | None,
    type_key_value: str,
    provider_name: Any,
    resolved_provider_name: str,
    sanitized_result: Any,
    response_result: Any,
    start_time: datetime,
    completed_at: datetime,
) -> dict[str, Any]:
    """Record metrics, notifications, cache, and return the API response payload."""
    await service.queue_manager.update_queue_status(str(request.id), "completed")

    duration_ms = int((completed_at - start_time).total_seconds() * 1000)
    output_size = service._estimate_output_size(sanitized_result)

    provider_name_str = str(provider_name) if provider_name is not None else None
    try:
        cost_credits_raw = getattr(generation_type, "cost_credits", None)
        cost_credits_float = float(str(cost_credits_raw)) if cost_credits_raw is not None else None
    except (AttributeError, TypeError, ValueError):  # fmt: skip
        cost_credits_float = None
    await service.metrics_service.record_generation_complete(
        str(request.id),
        success=True,
        duration_ms=duration_ms,
        provider_name=provider_name_str,
        credits_used=cost_credits_float,
        output_size_bytes=output_size,
        error_message=None,
        error_type=None,
    )

    suppress_notification = False
    input_data_dict = request.input_data if isinstance(request.input_data, dict) else {}
    if isinstance(input_data_dict, dict):
        suppress_notification = bool(input_data_dict.get("suppress_notification"))
    type_key_str = str(generation_type.type_key) if generation_type.type_key is not None else ""
    if not suppress_notification and not str(type_key_value).startswith("music_generator_generate"):
        try:
            from api.services.ugs import direct_generation_execution as facade

            notification_service = facade.get_notification_service()
            title = f"UGS: {getattr(generation_type, 'display_name', None) or type_key_str}"
            message = "Генерация завершена"
            await notification_service.send_to_user(
                user_id,
                NotificationCreate(
                    type=NotificationType.SUCCESS,
                    title=title,
                    message=message,
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
                "NotificationService: failed to send UGS completion notification for request %s and user %s",
                request.id,
                user_id,
                exc_info=True,
            )

    if cache_key:
        try:
            await service.cache_service.set(cache_key, sanitized_result, ttl=3600)
        except Exception as cache_error:
            logger.warning("Failed to cache result for request %s: %s", request.id, cache_error)

    service._log_lifecycle(
        "completed",
        request=request,
        user_id=user_id,
        type_key=type_key_value,
        status="completed",
        stage="completed",
        backend=str(service._serialize_request_metadata(request).get("execution_backend") or ""),
        provider_name=resolved_provider_name,
    )

    return {
        "request_id": str(request.id),
        "status": "completed",
        "estimated_time": generation_type.estimated_time,
        "message": "Генерация успешно завершена.",
        "result": response_result,
        "result_preview": sanitized_result,
        "cached": False,
        "execution_backend": service._serialize_request_metadata(request).get("execution_backend"),
        "stage": "completed",
        "progress_message": "Генерация успешно завершена.",
        "idempotency_key": service._serialize_request_metadata(request).get("idempotency_key"),
        "reused": False,
        "metadata": service._serialize_request_metadata(request),
    }
