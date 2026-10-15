# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Provider call and successful direct UGS generation path, including atomic billing before completed.
# Invariants:
# - Empty provider payloads fail closed via direct_generation_payload guards.
# - status=completed and credit deduct share one DB transaction (deduct_credits_without_commit).
# Related:
# - api/services/ugs/direct_generation_execution.py
# - api/services/ugs/direct_generation_errors.py
# - api/services/ugs/direct_generation_finalize.py
# - api/services/ugs/direct_generation_payload.py
# ---
"""UGS direct generation — provider execute path."""

from __future__ import annotations

import contextlib
import logging
import time
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from api.models.database_models import GenerationRequest, GenerationType
from api.services.music_generator_xl_base_pipeline import (
    persist_xl_base_observability_on_generation_request,
)
from api.services.queue_features import QUEUE_STATUS_PROCESSING
from api.services.ugs.direct_generation_errors import (
    EXECUTION_BACKEND_DIRECT,
    finalize_billing_failed_request,
)
from api.services.ugs.direct_generation_finalize import finalize_successful_direct_generation
from api.services.ugs.direct_generation_payload import provider_result_has_payload
from api.services.ugs.provider_manager_service_v2 import ProviderError
from api.services.ugs.queue_worker_resilience import (
    get_ugs_worker_lease_touch_interval_seconds,
    touch_ugs_worker_lease,
)

logger = logging.getLogger(__name__)


async def execute_direct_provider_generation(
    service: Any,
    request: GenerationRequest,
    generation_type: GenerationType,
    user_id: str,
    cache_key: str | None,
    *,
    start_time: datetime,
    worker_lease_token: str | None,
) -> dict[str, Any]:
    """Run provider call and finalize a successful direct UGS generation."""
    provider_name_raw = getattr(generation_type, "provider", None)
    if provider_name_raw is not None:
        provider_name_str_value = str(provider_name_raw)
        provider_name = provider_name_str_value if provider_name_str_value != "" else None
    else:
        provider_name = None
    if provider_name is None:
        msg = "У типа генерации не настроен провайдер."
        raise ValueError(msg)

    try:
        type_key_attr = generation_type.type_key
        type_key_value = str(type_key_attr) if type_key_attr is not None else ""
    except (AttributeError, TypeError):  # fmt: skip
        type_key_value = ""
    if type_key_value == "audio_transcription_faster_whisper":
        input_data_value = request.input_data if request.input_data is not None else None
        input_keys = list(input_data_value.keys()) if isinstance(input_data_value, dict) else "None"
        logger.debug(
            "UGS Direct Generation: type=%s, input_data keys=%s",
            generation_type.type_key,
            input_keys,
        )
        if isinstance(input_data_value, dict):
            for key in input_data_value:
                value = input_data_value[key]
                if isinstance(value, str):
                    preview = value[:100] if len(value) > 100 else value
                    logger.debug(
                        "  %s: str (length=%d, preview=%s...)",
                        key,
                        len(value),
                        preview,
                    )
                else:
                    logger.debug("  %s: %s", key, type(value).__name__)

    provider_name_str = str(provider_name) if provider_name is not None else ""
    type_key_str = str(generation_type.type_key) if generation_type.type_key is not None else ""
    generation_category = (
        str(generation_type.category).strip() if getattr(generation_type, "category", None) is not None else None
    )
    generation_category = generation_category or None
    input_data_value = request.input_data if request.input_data is not None else {}
    if isinstance(input_data_value, dict):
        input_data_dict: dict[str, Any] = {
            (k.decode("utf-8") if isinstance(k, bytes) else str(k)): (v.decode("utf-8") if isinstance(v, bytes) else v)
            for k, v in input_data_value.items()
        }
    else:
        input_data_dict = {}
    input_data_dict = dict(input_data_dict)
    input_data_dict["ugs_type_key"] = type_key_str
    if type_key_str == "imc_cabinet_filler":
        input_data_dict["imc_cabinet_filler"] = True
        input_data_dict["imc_vector_only"] = True
    elif type_key_str.startswith("imc_rag_"):
        input_data_dict["imc_vector_only"] = True
    if not str(input_data_dict.get("imc_type_key") or "").strip():
        input_data_dict["imc_type_key"] = type_key_str
    service._update_request_lifecycle(
        request,
        stage="provider_execute",
        queue_status=QUEUE_STATUS_PROCESSING,
        execution_backend=service._serialize_request_metadata(request).get("execution_backend")
        or EXECUTION_BACKEND_DIRECT,
        progress=35.0,
        progress_message="Выполняется вызов AI-провайдера.",
        provider_name=provider_name_str,
        provider_attempt=1,
        retry_count=int(request.retry_count or 0),
    )
    await service.db.commit()
    service._log_lifecycle(
        "provider_execute",
        request=request,
        user_id=user_id,
        type_key=type_key_str,
        status="processing",
        stage="provider_execute",
        backend=str(service._serialize_request_metadata(request).get("execution_backend") or ""),
        provider_name=provider_name_str,
    )

    lease_touch_interval = float(get_ugs_worker_lease_touch_interval_seconds())
    next_lease_touch_at = time.monotonic()

    async def _emit_provider_execute_progress(pct: float, msg: str) -> None:
        nonlocal next_lease_touch_at
        if worker_lease_token:
            try:
                now_m = time.monotonic()
                if now_m >= next_lease_touch_at:
                    next_lease_touch_at = now_m + lease_touch_interval
                    await touch_ugs_worker_lease(str(request.id), worker_lease_token)
            except Exception as touch_err:
                logger.debug(
                    "UGS worker lease touch skipped request_id=%s: %s",
                    request.id,
                    touch_err,
                )
        try:
            service._update_request_lifecycle(
                request,
                stage="provider_execute",
                queue_status=QUEUE_STATUS_PROCESSING,
                execution_backend=service._serialize_request_metadata(request).get("execution_backend")
                or EXECUTION_BACKEND_DIRECT,
                progress=float(pct),
                progress_message=str(msg),
                provider_name=provider_name_str,
                provider_attempt=1,
                retry_count=int(request.retry_count or 0),
            )
            await service.db.commit()
        except Exception as progress_err:
            logger.warning(
                "UGS provider_execute progress update failed request_id=%s: %s",
                request.id,
                progress_err,
            )

    service.provider_manager.set_execute_progress_callback(_emit_provider_execute_progress)
    try:
        raw_result = await service.provider_manager.execute_generation(
            provider_name_str,
            type_key_str,
            input_data_dict,
            generation_category=generation_category,
            user_id=user_id,
            project_id=str(request.project_id) if request.project_id is not None else None,
            company_id=str(request.company_id) if request.company_id is not None else None,
        )
    finally:
        service.provider_manager.set_execute_progress_callback(None)

    normalized_result = (
        raw_result.get("result") if isinstance(raw_result, dict) and "result" in raw_result else raw_result
    )
    if isinstance(normalized_result, dict):
        images = normalized_result.get("images")
        if isinstance(images, list) and images:
            first_image = images[0]
            if isinstance(first_image, dict):
                image_data_value = first_image.get("data")
                if image_data_value:
                    normalized_result.setdefault("image_data", image_data_value)
                image_filename = first_image.get("filename")
                if image_filename:
                    normalized_result.setdefault("image_filename", image_filename)

    if not provider_result_has_payload(normalized_result):
        msg = "AI-провайдер вернул пустой результат."
        raise ProviderError(msg)

    sanitized_result = service._sanitize_generation_result(normalized_result)
    response_result: Any = normalized_result
    try:
        provider_name_str = str(provider_name) if provider_name is not None else None
        enriched = await service._enrich_result_with_assets(sanitized_result, provider=provider_name_str)
        if enriched is not None:
            response_result = enriched
    except Exception as enrich_error:
        logger.warning(
            "Failed to enrich assets for request %s via provider %s: %s",
            request.id,
            provider_name,
            enrich_error,
        )

    try:
        response_result = await service._persist_result_images_to_shared_storage(response_result, user_id, request.id)
    except Exception as persist_error:
        logger.warning(
            "Failed to persist images to shared storage for request %s: %s",
            request.id,
            persist_error,
        )

    metadata_source: dict[str, Any] = {}
    if isinstance(raw_result, dict):
        metadata_source = raw_result.get("metadata", {}) or metadata_source
        xl_base_payload = raw_result.get("xl_base")
        if isinstance(xl_base_payload, dict) and xl_base_payload:
            metadata_source = {**metadata_source, **xl_base_payload}
            merged_input = persist_xl_base_observability_on_generation_request(
                input_data_dict,
                xl_base_payload,
            )
            if merged_input != input_data_dict:
                request.input_data = merged_input  # type: ignore[assignment]
                input_data_dict.update(xl_base_payload)
    if not metadata_source and isinstance(normalized_result, dict):
        metadata_source = normalized_result.get("metadata", {}) or {}
    provider_resolution = metadata_source.get("provider_resolution", {}) if isinstance(metadata_source, dict) else {}
    resolved_provider_name = (
        str(provider_resolution.get("resolved_provider"))
        if isinstance(provider_resolution, dict) and provider_resolution.get("resolved_provider") is not None
        else provider_name_str
    )
    provider_attempts = (
        int(provider_resolution.get("attempt_count"))
        if isinstance(provider_resolution, dict) and provider_resolution.get("attempt_count") is not None
        else 1
    )

    cost_credits = 0
    try:
        cost_credits_attr = getattr(generation_type, "cost_credits", None)
        if cost_credits_attr is not None:
            cost_credits = max(0, int(float(str(cost_credits_attr))))
    except (TypeError, ValueError) as credit_error:
        logger.warning("Failed to parse cost_credits for request %s: %s", request.id, credit_error)
        cost_credits = 0

    if cost_credits > 0:
        billed = await service.billing_service.deduct_credits_without_commit(user_id, cost_credits)
        if not billed:
            billing_msg = "Недостаточно кредитов для списания после генерации."
            await finalize_billing_failed_request(
                service,
                request,
                user_id=user_id,
                type_key_value=type_key_value,
                start_time=start_time,
                cost_credits=cost_credits,
                billing_msg=billing_msg,
                provider_name=provider_name,
                resolved_provider_name=resolved_provider_name,
                provider_attempts=provider_attempts,
                metadata_source=metadata_source if isinstance(metadata_source, dict) else {},
            )

    completed_at = datetime.now(UTC).replace(tzinfo=None)
    request.status = "completed"  # type: ignore[assignment]
    request.completed_at = completed_at  # type: ignore[assignment]
    request.updated_at = completed_at  # type: ignore[assignment]
    request.credits_used = Decimal(cost_credits)  # type: ignore[assignment]
    service._update_request_lifecycle(
        request,
        stage="completed",
        queue_status="completed",
        execution_backend=service._serialize_request_metadata(request).get("execution_backend")
        or EXECUTION_BACKEND_DIRECT,
        progress=100.0,
        progress_message="Генерация успешно завершена.",
        provider_name=resolved_provider_name,
        provider_attempt=provider_attempts,
        retry_count=int(request.retry_count or 0),
        estimated_completion=completed_at.isoformat(),
        extra_metadata={"processing_completed_at": completed_at.isoformat()},
    )
    request.output_data = {  # type: ignore[assignment]
        "result": service._sanitize_generation_result(response_result),
        "has_full_data": True,
        "provider": provider_name,
        "metadata": metadata_source,
    }

    try:
        await service.db.commit()
    except Exception as commit_error:
        error_str = str(commit_error).lower()
        error_type = type(commit_error).__name__

        if (
            "connection is closed" in error_str
            or "connection closed" in error_str
            or "pendingrollbackerror" in error_str
            or "pending rollback" in error_str
            or error_type == "PendingRollbackError"
            or "interfaceerror" in error_str
        ):
            logger.exception(
                "Database error during commit for request %s: %s - %s",
                request.id,
                error_type,
                error_str,
            )
            try:
                await service.db.rollback()
                logger.info("Rollback successful for request %s", request.id)
            except Exception as rollback_error:
                logger.warning(
                    "Rollback failed for request %s: %s",
                    request.id,
                    rollback_error,
                )
            raise
        logger.exception(
            "Unexpected error during commit for request %s: %s - %s",
            request.id,
            error_type,
            error_str,
        )
        with contextlib.suppress(Exception):
            await service.db.rollback()
        raise

    return await finalize_successful_direct_generation(
        service,
        request,
        generation_type,
        user_id=user_id,
        cache_key=cache_key,
        type_key_value=type_key_value,
        provider_name=provider_name,
        resolved_provider_name=resolved_provider_name,
        sanitized_result=sanitized_result,
        response_result=response_result,
        start_time=start_time,
        completed_at=completed_at,
    )
