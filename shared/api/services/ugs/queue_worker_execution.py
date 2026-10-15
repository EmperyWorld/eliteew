# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# RabbitMQ worker entry path for UGS: Redis lease, lifecycle metadata, delegate to direct provider execution.
# Invariants:
# - Terminal requests (completed/failed/cancelled) return without re-running the provider.
# - Duplicate delivery when lease is held returns skipped payload (no provider call).
# - Worker request context is set for nested generate() auto skip_queue guard.
# Related:
# - api/services/ugs/unified_generation_service.py (delegates process_queued_request)
# - api/services/ugs/queue_worker_resilience.py
# - api/services/ugs/ugs_execution_context.py
# ---
"""UGS queue worker: process_queued_request implementation."""

from __future__ import annotations

from typing import Any

from api.services.queue_features import QUEUE_STATUS_PROCESSING, utcnow_naive
from api.services.ugs.queue_worker_resilience import (
    acquire_ugs_worker_lease,
    release_ugs_worker_lease,
)
from api.services.ugs.ugs_execution_context import (
    enter_ugs_worker_request_context,
    exit_ugs_worker_request_context,
)

# Mirror UnifiedGenerationService (avoid import cycle at module load).
_EXECUTION_BACKEND_QUEUE_WORKER = "queue_worker_direct_provider"


async def run_process_queued_request(service: Any, request_id: str) -> dict[str, Any]:
    """
    Worker entrypoint for queued UGS tasks (called from ``UnifiedGenerationService``).
    """
    request = await service._get_request_with_type(request_id)
    if not request.generation_type:
        msg = f"Для запроса {request_id} не найден тип генерации."
        raise ValueError(msg)

    normalized_status = service._normalize_status(str(request.status) if request.status is not None else None)
    if normalized_status in ("completed", "failed", "cancelled"):
        return {"request_id": request_id, "status": normalized_status}

    acquired, lease_token = await acquire_ugs_worker_lease(request_id, db=service.db)
    if not acquired:
        service._log_lifecycle(
            "worker_lease_skipped",
            request=request,
            user_id=str(request.user_id),
            type_key=str(request.generation_type.type_key) if request.generation_type.type_key is not None else None,
            status=str(request.status) if request.status is not None else None,
            stage="duplicate_delivery",
            backend=_EXECUTION_BACKEND_QUEUE_WORKER,
            detail="worker_lease_held",
        )
        return {
            "request_id": request_id,
            "status": "skipped",
            "reason": "worker_lease_held",
            "message": "Another worker holds the execution lease; duplicate delivery ignored.",
        }

    worker_ctx_token = enter_ugs_worker_request_context(request_id)
    try:
        generation_type = request.generation_type
        est_completion = service._build_estimated_completion(request, service._serialize_request_metadata(request))
        service._update_request_lifecycle(
            request,
            stage="worker_processing",
            queue_status=QUEUE_STATUS_PROCESSING,
            execution_mode="queue",
            execution_backend=_EXECUTION_BACKEND_QUEUE_WORKER,
            progress=15.0,
            progress_message="Запрос принят worker-процессом.",
            provider_name=str(generation_type.provider) if generation_type.provider is not None else None,
            estimated_completion=est_completion.isoformat() if est_completion else None,
            extra_metadata={"worker_started_at": utcnow_naive().isoformat()},
        )
        await service.db.commit()
        service._log_lifecycle(
            "worker_processing",
            request=request,
            user_id=str(request.user_id),
            type_key=str(generation_type.type_key) if generation_type.type_key is not None else None,
            status="processing",
            stage="worker_processing",
            backend=_EXECUTION_BACKEND_QUEUE_WORKER,
            provider_name=str(generation_type.provider) if generation_type.provider is not None else None,
        )

        return await service._process_direct_generation(
            request,
            generation_type,
            str(request.user_id),
            worker_lease_token=lease_token,
        )
    finally:
        exit_ugs_worker_request_context(worker_ctx_token)
        await release_ugs_worker_lease(request_id, lease_token, db=service.db)
