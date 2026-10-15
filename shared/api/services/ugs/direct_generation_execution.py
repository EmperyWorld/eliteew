# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Facade for UGS direct provider execution — stable imports and run_direct_generation orchestration.
# Invariants:
# - UgsBillingFailedError pass-through before ValueError remutation in run_direct_generation.
# - Empty provider payloads and atomic billing enforced in sibling execute/payload modules.
# Related:
# - api/services/ugs/direct_generation_execute.py
# - api/services/ugs/direct_generation_errors.py
# - api/services/ugs/direct_generation_finalize.py
# - api/services/ugs/direct_generation_payload.py
# - documentation/product/UGS-FLOW-AND-CONFIG.md
# ---
"""UGS direct generation execution facade."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from api.models.database_models import GenerationRequest, GenerationType
from api.services.notification_service import get_notification_service
from api.services.queue_features import QUEUE_STATUS_PROCESSING, utcnow_naive
from api.services.ugs.direct_generation_errors import (
    EXECUTION_BACKEND_DIRECT,
    UgsBillingFailedError,
    handle_direct_generation_cancelled,
    handle_direct_generation_provider_error,
    handle_direct_generation_unexpected_error,
    handle_direct_generation_validation_error,
)
from api.services.ugs.direct_generation_execute import execute_direct_provider_generation
from api.services.ugs.direct_generation_payload import (
    provider_result_has_payload,
)
from api.services.ugs.provider_manager_service_v2 import ProviderError

logger = logging.getLogger(__name__)

# Re-exports for patch points / stable imports (finalize + tests patch this module).
_provider_result_has_payload = provider_result_has_payload

__all__ = [
    "UgsBillingFailedError",
    "execute_direct_provider_generation",
    "get_notification_service",
    "provider_result_has_payload",
    "run_direct_generation",
    "_provider_result_has_payload",
]


async def run_direct_generation(
    service: Any,
    request: GenerationRequest,
    generation_type: GenerationType,
    user_id: str,
    cache_key: str | None = None,
    fallback_error: Exception | None = None,
    *,
    worker_lease_token: str | None = None,
) -> dict[str, Any]:
    """Execute generation directly through provider manager (without Airflow)."""
    if fallback_error:
        logger.warning(
            "Falling back to direct provider execution for request %s: %s",
            request.id,
            fallback_error,
        )

    await service.provider_manager.initialize()
    request.status = "processing"  # type: ignore[assignment]
    request.started_at = datetime.now(UTC).replace(tzinfo=None)  # type: ignore[assignment]
    estimated_completion = (
        request.started_at + timedelta(seconds=int(generation_type.estimated_time or 0))
        if request.started_at is not None
        else None
    )
    service._update_request_lifecycle(
        request,
        stage="processing",
        queue_status=QUEUE_STATUS_PROCESSING,
        execution_mode=service._serialize_request_metadata(request).get("execution_mode") or "direct_execution",
        execution_backend=service._serialize_request_metadata(request).get("execution_backend")
        or EXECUTION_BACKEND_DIRECT,
        progress=20.0,
        progress_message="Провайдер инициализирован, начинаем выполнение.",
        provider_name=str(generation_type.provider) if generation_type.provider is not None else None,
        provider_attempt=1,
        retry_count=int(request.retry_count or 0),
        estimated_completion=service._to_iso(estimated_completion),
        extra_metadata={"processing_started_at": utcnow_naive().isoformat()},
    )
    await service.db.commit()
    service._log_lifecycle(
        "processing_started",
        request=request,
        user_id=user_id,
        type_key=str(generation_type.type_key) if generation_type.type_key is not None else None,
        status="processing",
        stage="processing",
        backend=str(service._serialize_request_metadata(request).get("execution_backend") or ""),
        provider_name=str(generation_type.provider) if generation_type.provider is not None else None,
    )

    start_time = datetime.now(UTC).replace(tzinfo=None)
    type_key_value = str(generation_type.type_key) if getattr(generation_type, "type_key", None) is not None else ""

    try:
        return await execute_direct_provider_generation(
            service,
            request,
            generation_type,
            user_id,
            cache_key,
            start_time=start_time,
            worker_lease_token=worker_lease_token,
        )
    except UgsBillingFailedError as error:
        raise ValueError(str(error)) from error
    except asyncio.CancelledError:
        await handle_direct_generation_cancelled(
            service,
            request,
            generation_type,
            user_id,
            start_time=start_time,
        )
        raise
    except ProviderError as error:
        await handle_direct_generation_provider_error(
            service,
            request,
            generation_type,
            user_id,
            error,
            start_time=start_time,
        )
        raise ValueError(str(error)) from error
    except (ValueError, TypeError) as error:
        await handle_direct_generation_validation_error(
            service,
            request,
            generation_type,
            user_id,
            error,
            start_time=start_time,
        )
        raise
    except Exception as error:
        await handle_direct_generation_unexpected_error(
            service,
            request,
            generation_type,
            user_id,
            error,
            start_time=start_time,
            type_key_value=type_key_value,
        )
        raise
