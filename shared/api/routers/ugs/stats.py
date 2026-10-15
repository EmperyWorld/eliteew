# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   UGS statistics and analytics summaries for authenticated users.
# Invariants:
#   - Analytics failures surface as 503 with an operator-facing Russian detail string.
#   - Hot `/stats` polling uses throttled stale cleanup, not full reconciliation on every request.
# Related:
#   - api/services/ugs/unified_generation_service.py
# ---
"""UGS stats and analytics routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.ugs.deps import get_ugs_service, logger
from api.schemas.ugs import UGSAnalyticsSummaryResponse, UGSStatsResponse
from api.services.ugs.unified_generation_service import UnifiedGenerationService


def register_stats_routes(router: APIRouter) -> None:

    @router.get(
        "/stats",
        response_model=UGSStatsResponse,
        summary="Get UGS Statistics",
        description="Get comprehensive UGS usage statistics",
    )
    async def get_ugs_stats(
        user: User = Depends(require_oauth2_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> UGSStatsResponse | dict[str, Any]:
        """
        🔥 GET UGS STATISTICS 🔥

        Get comprehensive statistics about UGS usage and performance.
        """
        try:
            from sqlalchemy import func, select, text  # noqa: PLC0415

            from api.models.database_models import GenerationRequest  # noqa: PLC0415
            from api.services.ugs.queue_manager_service import QueueManagerService  # noqa: PLC0415

            user_id = str(user.id)
            queue_stats_service = QueueManagerService(db)
            await queue_stats_service.maybe_cleanup_stale_request_states()

            # Get basic stats
            total_query = select(func.count(GenerationRequest.id)).where(
                GenerationRequest.user_id == user_id,
                GenerationRequest.deleted_at.is_(None),
            )
            total_result = await db.execute(total_query)
            total_generations = total_result.scalar() or 0

            # Active tasks (pending + processing)
            active_query = select(func.count(GenerationRequest.id)).where(
                GenerationRequest.user_id == user_id,
                GenerationRequest.status.in_(["pending", "processing"]),
                GenerationRequest.deleted_at.is_(None),
            )
            active_result = await db.execute(active_query)
            active_tasks = active_result.scalar() or 0

            # Completed today - use naive datetime for TIMESTAMP WITHOUT TIME ZONE
            today = func.date(func.now())
            completed_query = select(func.count(GenerationRequest.id)).where(
                GenerationRequest.user_id == user_id,
                GenerationRequest.status == "completed",
                GenerationRequest.deleted_at.is_(None),
                func.date(GenerationRequest.updated_at) == today,
            )
            completed_result = await db.execute(completed_query)
            today_completed = completed_result.scalar() or 0

            # Failed today
            failed_query = select(func.count(GenerationRequest.id)).where(
                GenerationRequest.user_id == user_id,
                GenerationRequest.status == "failed",
                GenerationRequest.deleted_at.is_(None),
                func.date(GenerationRequest.updated_at) == today,
            )
            failed_result = await db.execute(failed_query)
            today_failed = failed_result.scalar() or 0

            # Calculate from recent successful requests
            stats_query = text("""
                SELECT
                    AVG(duration_ms) / 1000.0 AS avg_response_time_sec
                FROM ugs_metrics
                WHERE event_type = 'success'
                AND timestamp >= NOW() - INTERVAL '1 hour'
            """)

            stats_result = await db.execute(stats_query)
            stats_row = stats_result.mappings().first()

            avg_response_time = 0.0
            queue_size = await queue_stats_service.count_waiting_requests()
            if stats_row:
                avg_response_time = float(stats_row["avg_response_time_sec"] or 0.0)
        except (OSError, RuntimeError) as e:
            logger.exception("Failed to get UGS stats")
            raise HTTPException(status_code=500, detail="Failed to retrieve statistics") from e
        else:
            return {
                "total_generations": total_generations,
                "active_tasks": active_tasks,
                "completed_today": today_completed,
                "failed_today": today_failed,
                "avg_response_time": avg_response_time,
                "queue_size": queue_size,
            }

    @router.get(
        "/analytics",
        response_model=UGSAnalyticsSummaryResponse,
        summary="Get UGS Analytics Summary",
        description="Single payload for UGS Analytics page: totals, success rate, by_type breakdown, recent errors (last 24h, up to 50 errors). Requires auth.",
    )
    async def get_ugs_analytics(
        user: User = Depends(require_oauth2_user),  # noqa: B008
        ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
    ) -> UGSAnalyticsSummaryResponse | dict[str, Any]:
        """
        Get combined analytics for the UGS Analytics frontend page.
        Returns user-scoped totals, success rate, by_type breakdown, and recent errors.
        """
        try:
            return await ugs_service.get_analytics_summary(
                str(user.id),
                hours=24,
                recent_errors_limit=50,
            )
        except (OSError, RuntimeError) as e:
            logger.exception("Analytics summary retrieval failed")
            raise HTTPException(status_code=503, detail="Сервис аналитики UGS временно недоступен.") from e
