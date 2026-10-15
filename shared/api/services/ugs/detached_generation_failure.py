# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Best-effort finalization of generation_requests when detached SSE/background UGS execution crashes.
# Invariants:
# - Never raises into caller; terminal rows (completed/failed/cancelled) are left unchanged.
# - Queue status and metrics updates are best-effort after Postgres commit.
# Related:
# - api/services/ugs/unified_generation_service.py (_run_detached_direct_generation)
# ---
"""Finalize generation_requests after detached UGS execution failure."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)

_ERROR_TYPE = "detached_execution_crash"


async def finalize_detached_generation_failure(
    request_id: str,
    *,
    error_message: str,
    error_type: str = _ERROR_TYPE,
) -> None:
    """
    Mark a non-terminal generation_requests row as failed after detached task crash.

    Opens an isolated DB session so callers can invoke from a broken or closed session.
    """
    try:
        request_uuid = UUID(str(request_id).strip())
    except ValueError:
        logger.warning("finalize_detached_generation_failure: invalid request_id=%s", request_id)
        return

    trimmed_error = (error_message or "Detached UGS execution failed").strip()
    if len(trimmed_error) > 4096:
        trimmed_error = trimmed_error[:4096]

    try:
        from api.core.database_manager import get_database_manager
        from api.models.database_models import GenerationRequest
        from api.services.ugs.metrics_service import UGSMetricsService
        from api.services.ugs.queue_manager_service import QueueManagerService

        manager = await get_database_manager()
        async with manager.get_postgres_session() as db:
            stmt = select(GenerationRequest).where(GenerationRequest.id == request_uuid)
            result = await db.execute(stmt)
            request = result.scalar_one_or_none()
            if request is None:
                logger.warning(
                    "finalize_detached_generation_failure: row missing request_id=%s",
                    request_id,
                )
                return

            normalized = (str(request.status) if request.status is not None else "").lower().strip()
            if normalized in {"completed", "failed", "cancelled"}:
                return

            now = datetime.now(UTC).replace(tzinfo=None)
            request.status = "failed"  # type: ignore[assignment]
            request.error_message = trimmed_error  # type: ignore[assignment]
            request.completed_at = now  # type: ignore[assignment]
            request.updated_at = now  # type: ignore[assignment]

            prev_meta: dict[str, Any] = (
                dict(request.request_metadata) if isinstance(request.request_metadata, dict) else {}
            )
            request.request_metadata = {  # type: ignore[assignment]
                **prev_meta,
                "error_type": error_type,
                "stage": "failed",
                "progress": 100.0,
                "progress_message": "Фоновое выполнение завершилось с ошибкой.",
                "detached_failure_at": now.isoformat(),
            }

            await db.commit()

            try:
                queue_manager = QueueManagerService(db)
                await queue_manager.update_queue_status(str(request_uuid), "failed")
            except Exception as queue_err:
                logger.warning(
                    "finalize_detached_generation_failure: queue update failed request_id=%s: %s",
                    request_id,
                    queue_err,
                )

            try:
                metrics = UGSMetricsService(db)
                await metrics.record_generation_complete(
                    str(request_uuid),
                    success=False,
                    duration_ms=0,
                    error_message=trimmed_error,
                    error_type=error_type,
                )
            except Exception as metrics_err:
                logger.debug(
                    "finalize_detached_generation_failure: metrics skip request_id=%s: %s",
                    request_id,
                    metrics_err,
                )

        logger.info(
            "finalize_detached_generation_failure: marked failed request_id=%s error_type=%s",
            request_id,
            error_type,
        )
    except Exception:
        logger.exception(
            "finalize_detached_generation_failure: Postgres update failed request_id=%s",
            request_id,
        )
