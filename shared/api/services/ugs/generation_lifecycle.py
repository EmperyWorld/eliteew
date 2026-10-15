# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# UGS generation request lifecycle metadata: status payloads, progress normalization, heartbeat updates, structured logging.
# Invariants:
# - EXECUTION_CONTRACT_VERSION must stay aligned with queue/direct execution modules.
# - merge_metadata updates must preserve existing request_metadata keys unless explicitly overwritten.
# Related:
# - api/services/ugs/unified_generation_service.py
# - api/services/ugs/direct_generation_execution.py
# - api/services/ugs/queue_worker_execution.py
# ---

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from api.models.database_models import GenerationRequest
from api.services.queue_features import derive_public_job_status, merge_metadata, utcnow_naive

logger = logging.getLogger(__name__)

EXECUTION_CONTRACT_VERSION = "ugs_runtime_v2"
EXECUTION_BACKEND_DIRECT = "direct_provider"
EXECUTION_BACKEND_QUEUE_WORKER = "queue_worker_direct_provider"
IDEMPOTENT_REUSABLE_STATUSES = {"queued", "processing", "retrying", "completed"}


def normalize_generation_status(state: str | None) -> str | None:
    """Convert Airflow/legacy statuses to internal UGS statuses."""
    if not state:
        return None
    s = state.lower()
    if s in ("success", "succeeded", "done", "finished"):
        return "completed"
    if s in ("running", "processing"):
        return "processing"
    if s in ("queued",):
        return "queued"
    if s in ("pending", "created", "scheduled"):
        return "pending"
    if s in ("failed", "error"):
        return "failed"
    if s in ("cancelled", "canceled", "aborted"):
        return "cancelled"
    return s


class GenerationLifecycleMixin:
    """Lifecycle metadata helpers shared across UGS coordinator paths."""

    def _to_iso(self, value: Any) -> str | None:
        return value.isoformat() if value is not None else None

    def _parse_metadata_datetime(self, value: Any) -> Any:
        from datetime import datetime

        if not isinstance(value, str) or not value:
            return None
        normalized = value.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
        return parsed.replace(tzinfo=None) if parsed.tzinfo is not None else parsed

    def _normalize_progress(self, value: Any) -> float | None:
        if value is None:
            return None
        try:
            numeric = float(value)
        except (TypeError, ValueError):  # fmt: skip
            return None
        return max(0.0, min(100.0, numeric))

    def _serialize_request_metadata(self, request: GenerationRequest) -> dict[str, Any]:
        metadata = request.request_metadata if request.request_metadata is not None else {}
        return dict(metadata) if isinstance(metadata, dict) else {}

    def _build_estimated_completion(self, request: GenerationRequest, metadata: dict[str, Any]) -> Any:
        explicit = self._parse_metadata_datetime(metadata.get("estimated_completion"))
        if explicit is not None:
            return explicit
        req_any: Any = request
        generation_type = getattr(req_any, "generation_type", None)
        estimated_time = getattr(generation_type, "estimated_time", None)
        if estimated_time in (None, ""):
            return None
        base_time = (
            req_any.started_at
            or self._parse_metadata_datetime(metadata.get("worker_started_at"))
            or self._parse_metadata_datetime(metadata.get("processing_started_at"))
            or self._parse_metadata_datetime(metadata.get("queued_at"))
            or req_any.created_at
        )
        if base_time is None:
            return None
        try:
            return base_time + timedelta(seconds=int(estimated_time))
        except (TypeError, ValueError):  # fmt: skip
            return None

    def _status_payload_from_request(self, request: GenerationRequest) -> dict[str, Any]:
        metadata = self._serialize_request_metadata(request)
        public_status = derive_public_job_status(request.status, metadata)
        queued_at = self._parse_metadata_datetime(metadata.get("queued_at"))
        heartbeat_at = self._parse_metadata_datetime(metadata.get("last_heartbeat_at"))
        estimated_completion = self._build_estimated_completion(request, metadata)
        retry_count = metadata.get("retry_count", request.retry_count)
        provider_attempt = metadata.get("provider_attempt")

        payload: dict[str, Any] = {
            "request_id": str(request.id),
            "status": public_status,
            "progress": self._normalize_progress(metadata.get("progress")),
            "stage": metadata.get("stage"),
            "progress_message": metadata.get("progress_message"),
            "estimated_completion": self._to_iso(estimated_completion),
            "started_at": self._to_iso(request.started_at),
            "completed_at": self._to_iso(request.completed_at),
            "queued_at": self._to_iso(queued_at),
            "last_heartbeat_at": self._to_iso(heartbeat_at),
            "queue_status": metadata.get("queue_status"),
            "execution_backend": metadata.get("execution_backend"),
            "provider_name": metadata.get("provider_name"),
            "provider_attempt": int(provider_attempt) if provider_attempt is not None else None,
            "retry_count": int(retry_count) if retry_count is not None else None,
            "idempotency_key": metadata.get("idempotency_key"),
            "metadata": metadata,
        }

        output_data_value = request.output_data if request.output_data is not None else None
        if isinstance(output_data_value, dict) and "result" in output_data_value:
            payload["result"] = output_data_value.get("result")

        error_message_value = request.error_message if request.error_message is not None else None
        if error_message_value is not None:
            payload["error"] = error_message_value

        error_type = metadata.get("error_type")
        if error_type:
            payload["error_type"] = str(error_type)
        elif request.generation_type is None:
            payload["error_type"] = "generation_type_not_found"

        return payload

    def _update_request_lifecycle(
        self,
        request: GenerationRequest,
        *,
        stage: str | None = None,
        queue_status: str | None = None,
        execution_mode: str | None = None,
        execution_backend: str | None = None,
        progress: float | None = None,
        progress_message: str | None = None,
        provider_name: str | None = None,
        provider_attempt: int | None = None,
        retry_count: int | None = None,
        error_type: str | None = None,
        idempotency_key: str | None = None,
        estimated_completion: str | None = None,
        extra_metadata: dict[str, Any] | None = None,
        heartbeat: bool = True,
    ) -> dict[str, Any]:
        updates: dict[str, Any] = {
            "execution_contract_version": EXECUTION_CONTRACT_VERSION,
            "stage": stage,
            "queue_status": queue_status,
            "execution_mode": execution_mode,
            "execution_backend": execution_backend,
            "progress": progress,
            "progress_message": progress_message,
            "provider_name": provider_name,
            "provider_attempt": provider_attempt,
            "retry_count": retry_count,
            "error_type": error_type,
            "idempotency_key": idempotency_key,
            "estimated_completion": estimated_completion,
        }
        if heartbeat:
            updates["last_heartbeat_at"] = utcnow_naive().isoformat()
        if extra_metadata:
            updates.update(extra_metadata)
        request.request_metadata = merge_metadata(request.request_metadata, **updates)  # type: ignore[assignment]
        return self._serialize_request_metadata(request)

    def _log_lifecycle(
        self,
        event: str,
        *,
        request: GenerationRequest | None = None,
        user_id: str | None = None,
        type_key: str | None = None,
        status: str | None = None,
        stage: str | None = None,
        backend: str | None = None,
        provider_name: str | None = None,
        detail: str | None = None,
    ) -> None:
        request_id = str(request.id) if request is not None and getattr(request, "id", None) else None
        logger.info(
            "UGS lifecycle event=%s request_id=%s user_id=%s type_key=%s status=%s stage=%s backend=%s provider=%s detail=%s",
            event,
            request_id,
            user_id,
            type_key,
            status,
            stage,
            backend,
            provider_name,
            detail,
        )

    def _normalize_status(self, state: str | None) -> str | None:
        return normalize_generation_status(state)
