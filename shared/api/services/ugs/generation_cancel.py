# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# UGS generation cancellation: owner-scoped cancel, queue removal, billing refund, companion reconcile hook.
# Invariants:
# - Terminal statuses (completed/failed/cancelled) are idempotent no-ops with an informational message.
# - Refund only when credits_used > 0 (deduct happens atomically with completed; in-flight cancel is unpaid).
# Related:
# - api/services/ugs/unified_generation_service.py
# - api/services/ugs/generation_lifecycle.py
# - api/services/ugs/billing_service.py
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin attrs (db, sibling helpers) are provided by UnifiedGenerationService composition.

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from api.models.database_models import GenerationRequest
from api.services.queue_features import utcnow_naive

logger = logging.getLogger(__name__)


class GenerationCancelMixin:
    """Cancel in-flight UGS generation requests."""

    async def cancel_generation(self, request_id: str, *, user_id: str | None = None) -> dict[str, Any]:
        """Cancel generation. If user_id is provided, only the owner can cancel."""
        from sqlalchemy import select  # type: ignore[import-not-found]
        from sqlalchemy.orm import selectinload  # type: ignore[import-not-found]

        try:
            request_uuid = UUID(request_id) if isinstance(request_id, str) else request_id
        except (ValueError, TypeError):  # fmt: skip
            msg = f"Некорректный формат request_id: {request_id}"
            raise ValueError(msg) from None

        stmt = (
            select(GenerationRequest)
            .options(selectinload(GenerationRequest.generation_type))
            .where(GenerationRequest.id == request_uuid)
        )
        result = await self.db.execute(stmt)
        request = result.scalar_one_or_none()
        if not request:
            msg = f"Запрос {request_id} не найден."
            raise ValueError(msg) from None

        if user_id is not None and str(request.user_id) != str(user_id):
            msg = "Нельзя отменить этот запрос."
            raise PermissionError(msg) from None

        status_str = str(request.status) if request.status is not None else None
        normalized_status = self._normalize_status(status_str)
        if normalized_status in ["completed", "failed", "cancelled"]:
            return {"message": "Генерация уже завершена."}

        request.status = "cancelled"  # type: ignore[assignment]
        request.completed_at = datetime.now(UTC).replace(tzinfo=None)  # type: ignore[assignment]
        self._update_request_lifecycle(
            request,
            stage="cancelled",
            queue_status="cancelled",
            execution_backend=self._serialize_request_metadata(request).get("execution_backend"),
            progress=100.0,
            progress_message="Запрос отменён пользователем.",
            error_type="cancelled_by_user",
            extra_metadata={"processing_completed_at": utcnow_naive().isoformat()},
        )
        await self.db.commit()
        await self.queue_manager.remove_from_queue(str(request.id))
        self._log_lifecycle(
            "cancelled",
            request=request,
            user_id=str(request.user_id),
            type_key=str(request.generation_type.type_key) if request.generation_type else None,
            status="cancelled",
            stage="cancelled",
            backend=str(self._serialize_request_metadata(request).get("execution_backend") or ""),
        )

        user_id_str = str(request.user_id) if request.user_id is not None else ""
        billed_amount = 0
        try:
            credits_used_raw = getattr(request, "credits_used", None)
            if credits_used_raw is not None:
                billed_amount = max(0, int(float(str(credits_used_raw))))
        except TypeError, ValueError:
            billed_amount = 0
        if billed_amount > 0 and request.generation_type is not None:
            await self.billing_service.refund_credits(
                user_id_str,
                request.generation_type,
                credit_amount=billed_amount,
            )
        else:
            logger.debug(
                "[STEP] ugs_cancel_refund_skip request_id=%s credits_used=%s",
                request.id,
                billed_amount,
            )

        try:
            import os

            dsn = os.getenv("EWA_DATABASE_URL", "").strip()
            if dsn:
                from api.ewa_platform.bootstrap.data_plane import init_ewa_data_plane
                from api.ewa_platform.companion.jobs.music_run_reconcile import (
                    reconcile_companion_run_after_ugs_request,
                )
                from api.ewa_platform.persistence_pg.orchestration_asyncpg import open_ewa_orchestration_pool

                ewa_pool = await open_ewa_orchestration_pool(dsn, min_size=1, max_size=2)
                try:
                    await init_ewa_data_plane(ewa_pool)
                    await reconcile_companion_run_after_ugs_request(
                        ewa_pool,
                        self.db,
                        ugs_request_id=str(request.id),
                        ugs_status="cancelled",
                    )
                finally:
                    await ewa_pool.close()
        except Exception:
            logger.warning(
                "companion music reconcile after UGS cancel failed request_id=%s",
                request.id,
                exc_info=True,
            )

        return {"message": "Генерация успешно отменена."}
