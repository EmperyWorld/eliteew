# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin read/update lifecycle for social_user_reports (Social Hub moderation queue).
# Invariants:
# - Status transitions: open → in_review → resolved|dismissed; reopen only dismissed → open.
# - Payloads are summary-only (no private friendship notes or message bodies).
# Related:
# - api/routers/friends_admin_reports.py
# - documentation/product/SOCIAL-HUB.md
# ---

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found,import-untyped]

logger = logging.getLogger(__name__)

VALID_REPORT_STATUSES = frozenset({"open", "in_review", "resolved", "dismissed"})

_ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "open": frozenset({"in_review", "resolved", "dismissed"}),
    "in_review": frozenset({"resolved", "dismissed", "open"}),
    "resolved": frozenset({"in_review"}),
    "dismissed": frozenset({"open", "in_review"}),
}


def _parse_uuid(value: str) -> UUID | None:
    try:
        return UUID(str(value).strip())
    except ValueError, TypeError:
        return None


def _serialize_dt(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _display_name(username: str | None, full_name: str | None) -> str:
    name = (full_name or "").strip()
    if name:
        return name
    return (username or "").strip() or "—"


def serialize_report_row(row: asyncpg.Record | dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "reporter_user_id": str(row["reporter_user_id"]),
        "reported_user_id": str(row["reported_user_id"]),
        "reason": row["reason"],
        "details": row.get("details"),
        "status": row["status"],
        "created_at": _serialize_dt(row.get("created_at")),
        "reviewed_at": _serialize_dt(row.get("reviewed_at")),
        "reviewer_user_id": str(row["reviewer_user_id"]) if row.get("reviewer_user_id") else None,
        "reporter_username": row.get("reporter_username"),
        "reporter_display_name": _display_name(
            row.get("reporter_username"),
            row.get("reporter_full_name"),
        ),
        "reported_username": row.get("reported_username"),
        "reported_display_name": _display_name(
            row.get("reported_username"),
            row.get("reported_full_name"),
        ),
        "reviewer_username": row.get("reviewer_username"),
    }


class FriendsReportsAdminOps:
    """Owner of admin list/get/patch for social_user_reports."""

    def __init__(self, db_pool: asyncpg.Pool) -> None:
        self.db_pool = db_pool

    async def list_reports(
        self,
        *,
        status_filter: str | None = None,
        q: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict[str, Any]:
        if status_filter is not None and status_filter not in VALID_REPORT_STATUSES:
            raise ValueError("Некорректный статус жалобы")

        bounded_limit = max(1, min(int(limit), 200))
        bounded_offset = max(0, int(offset))
        q_norm = (q or "").strip() or None

        where_parts: list[str] = []
        params: list[object] = []
        idx = 1

        if status_filter:
            where_parts.append(f"r.status = ${idx}")
            params.append(status_filter)
            idx += 1
        if q_norm:
            where_parts.append(
                f"""(
                    r.reason ILIKE ${idx}
                    OR COALESCE(r.details, '') ILIKE ${idx}
                    OR CAST(r.id AS text) ILIKE ${idx}
                    OR COALESCE(reporter.username, '') ILIKE ${idx}
                    OR COALESCE(reported.username, '') ILIKE ${idx}
                )"""
            )
            params.append(f"%{q_norm}%")
            idx += 1

        where_sql = " AND ".join(where_parts) if where_parts else "TRUE"
        order_sql = "ORDER BY r.created_at ASC" if status_filter == "open" else "ORDER BY r.created_at DESC"

        count_sql = f"""
            SELECT COUNT(*)::int AS c
            FROM social_user_reports r
            LEFT JOIN users reporter ON reporter.id = r.reporter_user_id
            LEFT JOIN users reported ON reported.id = r.reported_user_id
            WHERE {where_sql}
        """
        list_sql = f"""
            SELECT
                r.id,
                r.reporter_user_id,
                r.reported_user_id,
                r.reason,
                r.details,
                r.status,
                r.created_at,
                r.reviewed_at,
                r.reviewer_user_id,
                reporter.username AS reporter_username,
                reporter.full_name AS reporter_full_name,
                reported.username AS reported_username,
                reported.full_name AS reported_full_name,
                reviewer.username AS reviewer_username
            FROM social_user_reports r
            LEFT JOIN users reporter ON reporter.id = r.reporter_user_id
            LEFT JOIN users reported ON reported.id = r.reported_user_id
            LEFT JOIN users reviewer ON reviewer.id = r.reviewer_user_id
            WHERE {where_sql}
            {order_sql}
            LIMIT ${idx} OFFSET ${idx + 1}
        """
        list_params = [*params, bounded_limit, bounded_offset]

        async with self.db_pool.acquire() as conn:
            total = int(await conn.fetchval(count_sql, *params) or 0)
            rows = await conn.fetch(list_sql, *list_params)

        return {
            "items": [serialize_report_row(row) for row in rows],
            "total": total,
        }

    async def get_report(self, report_id: str) -> dict[str, Any]:
        rid = _parse_uuid(report_id)
        if rid is None:
            raise ValueError("Некорректный идентификатор жалобы")

        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT
                    r.id,
                    r.reporter_user_id,
                    r.reported_user_id,
                    r.reason,
                    r.details,
                    r.status,
                    r.created_at,
                    r.reviewed_at,
                    r.reviewer_user_id,
                    reporter.username AS reporter_username,
                    reporter.full_name AS reporter_full_name,
                    reported.username AS reported_username,
                    reported.full_name AS reported_full_name,
                    reviewer.username AS reviewer_username
                FROM social_user_reports r
                LEFT JOIN users reporter ON reporter.id = r.reporter_user_id
                LEFT JOIN users reported ON reported.id = r.reported_user_id
                LEFT JOIN users reviewer ON reviewer.id = r.reviewer_user_id
                WHERE r.id = $1
                """,
                rid,
            )
        if row is None:
            raise LookupError("Жалоба не найдена")
        return serialize_report_row(row)

    async def patch_report(
        self,
        report_id: str,
        *,
        status: str,
        reviewer_user_id: str,
    ) -> dict[str, Any]:
        if status not in VALID_REPORT_STATUSES:
            raise ValueError("Некорректный статус жалобы")
        rid = _parse_uuid(report_id)
        reviewer = _parse_uuid(reviewer_user_id)
        if rid is None:
            raise ValueError("Некорректный идентификатор жалобы")
        if reviewer is None:
            raise ValueError("Некорректный идентификатор ревьюера")

        async with self.db_pool.acquire() as conn, conn.transaction():
            current = await conn.fetchrow(
                """
                SELECT id, status
                FROM social_user_reports
                WHERE id = $1
                FOR UPDATE
                """,
                rid,
            )
            if current is None:
                raise LookupError("Жалоба не найдена")

            current_status = str(current["status"])
            if status != current_status:
                allowed = _ALLOWED_TRANSITIONS.get(current_status, frozenset())
                if status not in allowed:
                    raise ValueError(f"Переход статуса {current_status} → {status} не разрешён")

            leaving_open = current_status == "open" and status != "open"
            set_reviewer = leaving_open or status in {"in_review", "resolved", "dismissed"}

            if set_reviewer:
                await conn.execute(
                    """
                    UPDATE social_user_reports
                    SET status = $2,
                        reviewed_at = COALESCE(reviewed_at, NOW()),
                        reviewer_user_id = COALESCE(reviewer_user_id, $3)
                    WHERE id = $1
                    """,
                    rid,
                    status,
                    reviewer,
                )
            else:
                await conn.execute(
                    """
                    UPDATE social_user_reports
                    SET status = $2
                    WHERE id = $1
                    """,
                    rid,
                    status,
                )

            row = await conn.fetchrow(
                """
                SELECT
                    r.id,
                    r.reporter_user_id,
                    r.reported_user_id,
                    r.reason,
                    r.details,
                    r.status,
                    r.created_at,
                    r.reviewed_at,
                    r.reviewer_user_id,
                    reporter.username AS reporter_username,
                    reporter.full_name AS reporter_full_name,
                    reported.username AS reported_username,
                    reported.full_name AS reported_full_name,
                    reviewer.username AS reviewer_username
                FROM social_user_reports r
                LEFT JOIN users reporter ON reporter.id = r.reporter_user_id
                LEFT JOIN users reported ON reported.id = r.reported_user_id
                LEFT JOIN users reviewer ON reviewer.id = r.reviewer_user_id
                WHERE r.id = $1
                """,
                rid,
            )

        logger.info(
            "[STEP] social_hub_report_status report_id=%s from=%s to=%s reviewer=%s",
            report_id,
            current_status,
            status,
            reviewer_user_id,
        )
        assert row is not None
        return serialize_report_row(row)
