"""Time series: marketing tasks completed per UTC day."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]


async def fetch_tasks_completed_daily_series(
    conn: asyncpg.Connection,
    project_id: UUID,
    window_days: int,
) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        WITH bounds AS (
            SELECT
                ((now() AT TIME ZONE 'UTC')::date - (($2::int) - 1)) AS start_day,
                (now() AT TIME ZONE 'UTC')::date AS end_day
        ),
        days AS (
            SELECT generate_series(bounds.start_day, bounds.end_day, interval '1 day')::date AS day
            FROM bounds
        ),
        agg AS (
            SELECT
                (updated_at AT TIME ZONE 'UTC')::date AS day,
                COUNT(*)::bigint AS cnt
            FROM marketing_tasks
            WHERE project_id = $1::uuid
              AND deleted_at IS NULL
              AND status = 'completed'
              AND (updated_at AT TIME ZONE 'UTC')::date >= (SELECT start_day FROM bounds)
              AND (updated_at AT TIME ZONE 'UTC')::date <= (SELECT end_day FROM bounds)
            GROUP BY 1
        )
        SELECT d.day::text AS dt, COALESCE(agg.cnt, 0)::float AS value
        FROM days d
        LEFT JOIN agg ON agg.day = d.day
        ORDER BY d.day
        """,
        project_id,
        window_days,
    )
    return [{"date": str(row["dt"]), "value": float(row["value"])} for row in rows]
