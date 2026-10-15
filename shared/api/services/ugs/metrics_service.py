#!/usr/bin/env python3
"""
UGS Metrics Service - Performance & Analytics
Updated: 2025-10-22 (Phase 1)
Status: PRODUCTION-READY (was BLOCKED)
"""

from typing import Any
from uuid import UUID

import structlog  # type: ignore[import-not-found]
from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

logger = structlog.get_logger(__name__)


class UGSMetricsService:
    """Service for collecting and analyzing UGS performance metrics"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def record_generation_start(
        self, request_id: UUID, type_key: str, user_id: UUID, input_size_bytes: int | None = None
    ) -> UUID:
        """
        Record the start of a generation request
        Uses database function for consistency
        """
        try:
            query = text("""
                SELECT record_generation_start(
                    :request_id,
                    :type_key,
                    :user_id,
                    :input_size_bytes
                )
            """)

            result = await self.db.execute(
                query,
                {
                    "request_id": request_id,
                    "type_key": type_key,
                    "user_id": user_id,
                    "input_size_bytes": input_size_bytes,
                },
            )

            metric_id = result.scalar_one()

            logger.info(
                "generation_start_recorded",
                metric_id=str(metric_id),
                request_id=str(request_id),
                type_key=type_key,
            )

            return UUID(str(metric_id)) if metric_id is not None else UUID("00000000-0000-0000-0000-000000000000")

        except Exception as e:
            logger.exception("failed_to_record_generation_start", error=str(e), request_id=str(request_id))
            # Re-raise - this is critical data
            raise

    async def record_generation_complete(
        self,
        request_id: str | UUID,
        *,
        success: bool,
        duration_ms: int,
        provider_name: str | None = None,
        credits_used: float | None = None,
        output_size_bytes: int | None = None,
        error_message: str | None = None,
        error_type: str | None = None,
    ) -> str | UUID:
        """
        Record generation completion (success or failure)
        """
        try:
            query = text("""
                SELECT record_generation_complete(
                    :request_id,
                    :success,
                    :duration_ms,
                    :provider_name,
                    :credits_used,
                    :output_size_bytes,
                    :error_message,
                    :error_type
                )
            """)

            result = await self.db.execute(
                query,
                {
                    "request_id": request_id,
                    "success": success,
                    "duration_ms": duration_ms,
                    "provider_name": provider_name,
                    "credits_used": credits_used,
                    "output_size_bytes": output_size_bytes,
                    "error_message": error_message,
                    "error_type": error_type,
                },
            )

            metric_id = result.scalar_one()

            logger.info(
                "generation_complete_recorded",
                metric_id=str(metric_id),
                request_id=str(request_id),
                success=success,
                duration_ms=duration_ms,
            )

            metric_id_value: str | UUID = (
                str(metric_id) if metric_id is not None else UUID("00000000-0000-0000-0000-000000000000")
            )
            return metric_id_value
        except Exception as e:
            logger.exception("failed_to_record_generation_complete", error=str(e), request_id=str(request_id))
            raise

    async def get_performance_metrics(
        self, hours: int = 24, type_key: str | None = None, user_id: UUID | None = None
    ) -> dict[str, Any]:
        """
        Get aggregated performance metrics

        Returns:
            {
                "total_generations": int,
                "successful": int,
                "failed": int,
                "cancelled": int,
                "success_rate": float,
                "avg_duration_ms": float,
                "median_duration_ms": float,
                "p95_duration_ms": float,
                "by_hour": [...],
                "by_type": [...],
                "by_provider": [...]
            }
        """
        try:
            # Build query with optional filters
            filters = ["timestamp >= NOW() - :hours * INTERVAL '1 hour'"]
            params: dict[str, Any] = {"hours": hours}

            if type_key:
                filters.append("type_key = :type_key")
                params["type_key"] = type_key

            if user_id:
                filters.append("user_id = :user_id")
                params["user_id"] = user_id

            where_clause = " AND ".join(filters)

            # Overall metrics
            # Note: where_clause is built from validated inputs, params are passed separately
            query = text(f"""
                SELECT
                    COUNT(*) FILTER (WHERE event_type = 'start') AS total_generations,
                    COUNT(*) FILTER (WHERE event_type = 'success') AS successful,
                    COUNT(*) FILTER (WHERE event_type = 'failure') AS failed,
                    COUNT(*) FILTER (WHERE event_type = 'cancel') AS cancelled,
                    ROUND(
                        (100.0 * COUNT(*) FILTER (WHERE event_type = 'success') /
                        NULLIF(COUNT(*) FILTER (WHERE event_type IN ('success', 'failure')), 0))::numeric,
                        2
                    ) AS success_rate,
                    ROUND((AVG(duration_ms) FILTER (WHERE event_type = 'success'))::numeric, 2) AS avg_duration_ms,
                    ROUND(
                        (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)
                        FILTER (WHERE event_type = 'success'))::numeric,
                        2
                    ) AS median_duration_ms,
                    ROUND(
                        (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)
                        FILTER (WHERE event_type = 'success'))::numeric,
                        2
                    ) AS p95_duration_ms
                FROM ugs_metrics
                WHERE {where_clause}
            """)  # noqa: S608

            result = await self.db.execute(query, params)
            overall = result.mappings().one()

            # Hourly breakdown
            # Note: where_clause is built from validated inputs, params are passed separately
            query_hourly = text(f"""
                SELECT
                    date_trunc('hour', timestamp) AS hour,
                    COUNT(*) FILTER (WHERE event_type = 'success') AS successful,
                    COUNT(*) FILTER (WHERE event_type = 'failure') AS failed,
                    ROUND((AVG(duration_ms) FILTER (WHERE event_type = 'success'))::numeric, 2) AS avg_duration_ms
                FROM ugs_metrics
                WHERE {where_clause}
                GROUP BY date_trunc('hour', timestamp)
                ORDER BY hour DESC
            """)  # noqa: S608

            result_hourly = await self.db.execute(query_hourly, params)
            by_hour = [dict(row._mapping) for row in result_hourly]  # noqa: SLF001

            # By type breakdown
            # Note: where_clause is built from validated inputs, params are passed separately
            query_by_type = text(f"""
                SELECT
                    type_key,
                    COUNT(*) FILTER (WHERE event_type = 'success') AS successful,
                    COUNT(*) FILTER (WHERE event_type = 'failure') AS failed,
                    ROUND((AVG(duration_ms) FILTER (WHERE event_type = 'success'))::numeric, 2) AS avg_duration_ms
                FROM ugs_metrics
                WHERE {where_clause}
                GROUP BY type_key
                ORDER BY successful DESC
            """)  # noqa: S608

            result_by_type = await self.db.execute(query_by_type, params)
            by_type = [dict(row._mapping) for row in result_by_type]  # noqa: SLF001

            # By provider breakdown
            # Note: where_clause is built from validated inputs, params are passed separately
            query_by_provider = text(f"""
                SELECT
                    provider_name,
                    COUNT(*) FILTER (WHERE event_type = 'success') AS successful,
                    COUNT(*) FILTER (WHERE event_type = 'failure') AS failed,
                    ROUND((AVG(duration_ms) FILTER (WHERE event_type = 'success'))::numeric, 2) AS avg_duration_ms
                FROM ugs_metrics
                WHERE {where_clause} AND provider_name IS NOT NULL
                GROUP BY provider_name
                ORDER BY successful DESC
            """)  # noqa: S608

            result_by_provider = await self.db.execute(query_by_provider, params)
            by_provider = [dict(row._mapping) for row in result_by_provider]  # noqa: SLF001

            return {
                "total_generations": overall["total_generations"] or 0,
                "successful": overall["successful"] or 0,
                "failed": overall["failed"] or 0,
                "cancelled": overall["cancelled"] or 0,
                "success_rate": float(overall["success_rate"] or 0.0),
                "avg_duration_ms": float(overall["avg_duration_ms"] or 0.0),
                "median_duration_ms": float(overall["median_duration_ms"] or 0.0),
                "p95_duration_ms": float(overall["p95_duration_ms"] or 0.0),
                "by_hour": by_hour,
                "by_type": by_type,
                "by_provider": by_provider,
            }

        except Exception as e:
            logger.exception("failed_to_get_performance_metrics", error=str(e), hours=hours)
            # Return empty structure instead of crashing
            return {
                "total_generations": 0,
                "successful": 0,
                "failed": 0,
                "cancelled": 0,
                "success_rate": 0.0,
                "avg_duration_ms": 0.0,
                "median_duration_ms": 0.0,
                "p95_duration_ms": 0.0,
                "by_hour": [],
                "by_type": [],
                "by_provider": [],
            }

    async def get_error_analysis(self, hours: int = 24, limit: int = 10000) -> dict[str, Any]:
        """
        Analyze recent errors for patterns
        """
        try:
            # Error type distribution
            query_distribution = text("""
                SELECT
                    error_type,
                    COUNT(*) AS count,
                    ARRAY_AGG(DISTINCT type_key) AS affected_types
                FROM ugs_metrics
                WHERE event_type = 'failure'
                AND timestamp >= NOW() - :hours * INTERVAL '1 hour'
                AND error_type IS NOT NULL
                GROUP BY error_type
                ORDER BY count DESC
            """)

            result_dist = await self.db.execute(query_distribution, {"hours": hours})
            error_distribution = [dict(row._mapping) for row in result_dist]  # noqa: SLF001

            # Recent errors
            query_recent = text("""
                SELECT
                    timestamp,
                    type_key,
                    error_type,
                    error_message,
                    duration_ms,
                    request_id
                FROM ugs_metrics
                WHERE event_type = 'failure'
                AND timestamp >= NOW() - :hours * INTERVAL '1 hour'
                ORDER BY timestamp DESC
                LIMIT :limit
            """)

            result_recent = await self.db.execute(query_recent, {"hours": hours, "limit": limit})
            recent_errors = [dict(row._mapping) for row in result_recent]  # noqa: SLF001

            return {
                "error_distribution": error_distribution,
                "recent_errors": recent_errors,
                "total_errors": sum(item["count"] for item in error_distribution),
            }

        except Exception as e:
            logger.exception("failed_to_get_error_analysis", error=str(e))
            return {"error_distribution": [], "recent_errors": [], "total_errors": 0}

    async def get_system_health(self) -> dict[str, Any]:
        """
        Get system health indicators
        """
        try:
            # Recent metrics (last hour)
            query = text("""
                WITH recent_metrics AS (
                    SELECT
                        COUNT(*) FILTER (WHERE event_type = 'failure') AS failures,
                        COUNT(*) FILTER (WHERE event_type = 'success') AS successes,
                        AVG(duration_ms) FILTER (WHERE event_type = 'success') AS avg_duration
                    FROM ugs_metrics
                    WHERE timestamp >= NOW() - INTERVAL '1 hour'
                )
                SELECT
                    COALESCE(failures, 0) AS failures,
                    COALESCE(successes, 0) AS successes,
                    COALESCE(avg_duration, 0) AS avg_duration
                FROM recent_metrics
            """)

            result = await self.db.execute(query)
            health_row = result.mappings().one()

            failures = health_row["failures"]
            successes = health_row["successes"]
            avg_duration = float(health_row["avg_duration"] or 0.0)

            total_events = successes + failures
            healthy_threshold = 0.05
            degraded_threshold = 0.20
            if total_events == 0:
                health_status = "unknown"
            else:
                failure_rate = failures / total_events
                if (failures == 0 and successes > 0) or failure_rate < healthy_threshold:
                    health_status = "healthy"
                elif failure_rate < degraded_threshold:
                    health_status = "degraded"
                else:
                    health_status = "unhealthy"

            # Queue backlog grouped by status
            queue_query = text("""
                SELECT
                    status,
                    COUNT(*) AS count
                FROM generation_queue
                GROUP BY status
            """)
            queue_result = await self.db.execute(queue_query)
            queue_counts: dict[str, int] = {}
            for row in queue_result:
                status_val = str(row[0]) if len(row) > 0 else "unknown"
                count_val = int(row[1]) if len(row) > 1 else 0
                queue_counts[status_val] = count_val

            pending_backlog = queue_counts.get("pending", 0)
            processing_backlog = queue_counts.get("processing", 0)

            return {
                "status": health_status,
                "recent_failures": failures,
                "recent_successes": successes,
                "avg_response_time_ms": avg_duration,
                "queue_backlog": {
                    "pending": pending_backlog,
                    "processing": processing_backlog,
                    "total": pending_backlog + processing_backlog,
                },
            }

        except Exception as e:
            logger.exception("failed_to_get_system_health", error=str(e))
            return {
                "status": "unknown",
                "recent_failures": 0,
                "recent_successes": 0,
                "avg_response_time_ms": 0.0,
                "queue_backlog": 0,
            }
