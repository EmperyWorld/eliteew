# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Load/save Postgres defaults for stack0 release maintenance and render user-facing copy.
# Invariants:
# - Missing table/row → hardcoded 10m notice / 2m downtime seed (never crash deploy).
# - Templates use {notice_minutes} {downtime_minutes} {starts_at_local} {ends_at_local}.
# Related:
# - api/schemas/maintenance.py
# - api/services/maintenance_service.py
# - documentation/platform/USER-SAFE-RESTARTS-AND-MAINTENANCE.md
# ---
"""Postgres-backed deploy maintenance defaults."""

from __future__ import annotations

import logging
import math
import os
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from api.core.database_manager import DatabaseConnectionError, get_database_manager
from api.schemas.maintenance import (
    MaintenanceDeployDefaults,
    MaintenanceDeployDefaultsUpdate,
)

logger = logging.getLogger(__name__)

_FALLBACK = MaintenanceDeployDefaults()


def operator_tz() -> ZoneInfo:
    raw = (os.environ.get("ELITEEW_OPERATOR_TZ") or os.environ.get("TZ") or "Asia/Vladivostok").strip()
    try:
        return ZoneInfo(raw)
    except Exception:
        return ZoneInfo("Asia/Vladivostok")


def format_local_clock(instant: datetime, *, tz: ZoneInfo | None = None) -> str:
    zone = tz or operator_tz()
    local = instant if instant.tzinfo else instant.replace(tzinfo=UTC)
    return local.astimezone(zone).strftime("%H:%M")


def render_deploy_copy(
    defaults: MaintenanceDeployDefaults,
    *,
    starts_at: datetime,
    ends_at: datetime,
) -> tuple[str, str]:
    """Render message + user_impact from templates."""
    notice_minutes = max(0, int(math.ceil(defaults.notice_before_seconds / 60)))
    downtime_minutes = max(1, int(math.ceil(defaults.expected_downtime_seconds / 60)))
    mapping = {
        "notice_minutes": str(notice_minutes),
        "downtime_minutes": str(downtime_minutes),
        "starts_at_local": format_local_clock(starts_at),
        "ends_at_local": format_local_clock(ends_at),
    }
    message = defaults.message_template
    impact = defaults.user_impact_template
    for key, value in mapping.items():
        message = message.replace("{" + key + "}", value)
        impact = impact.replace("{" + key + "}", value)
    return message[:600], impact[:600]


def compute_window_schedule(
    defaults: MaintenanceDeployDefaults,
    *,
    now: datetime | None = None,
) -> tuple[datetime, datetime]:
    """starts_at = now+notice; ends_at = starts_at+downtime."""
    base = now or datetime.now(UTC)
    if base.tzinfo is None:
        base = base.replace(tzinfo=UTC)
    starts = base + timedelta(seconds=defaults.notice_before_seconds)
    ends = starts + timedelta(seconds=defaults.expected_downtime_seconds)
    return starts, ends


async def load_deploy_defaults() -> MaintenanceDeployDefaults:
    """Read singleton row; fall back to in-code defaults if DB unavailable."""
    try:
        manager = await get_database_manager()
        pool = await manager.get_asyncpg_pool()
        row = await pool.fetchrow(
            """
            SELECT notice_before_seconds, expected_downtime_seconds, title,
                   message_template, user_impact_template, updated_at, updated_by
            FROM system_maintenance_deploy_defaults
            WHERE id = 1
            """
        )
    except (DatabaseConnectionError, OSError, RuntimeError, TypeError, ValueError) as exc:
        logger.warning("maintenance_deploy_defaults_load_failed error=%s", exc)
        return _FALLBACK
    if row is None:
        return _FALLBACK
    try:
        return MaintenanceDeployDefaults(
            notice_before_seconds=int(row["notice_before_seconds"]),
            expected_downtime_seconds=int(row["expected_downtime_seconds"]),
            title=str(row["title"] or _FALLBACK.title),
            message_template=str(row["message_template"] or _FALLBACK.message_template),
            user_impact_template=str(row["user_impact_template"] or _FALLBACK.user_impact_template),
            updated_at=row["updated_at"],
            updated_by=row["updated_by"],
        )
    except Exception as exc:
        logger.warning("maintenance_deploy_defaults_invalid error=%s", exc)
        return _FALLBACK


async def save_deploy_defaults(
    body: MaintenanceDeployDefaultsUpdate,
    *,
    updated_by: str | None = None,
) -> MaintenanceDeployDefaults:
    """Upsert singleton defaults (id=1)."""
    current = await load_deploy_defaults()
    merged = MaintenanceDeployDefaults(
        notice_before_seconds=(
            body.notice_before_seconds if body.notice_before_seconds is not None else current.notice_before_seconds
        ),
        expected_downtime_seconds=(
            body.expected_downtime_seconds
            if body.expected_downtime_seconds is not None
            else current.expected_downtime_seconds
        ),
        title=body.title if body.title is not None else current.title,
        message_template=(body.message_template if body.message_template is not None else current.message_template),
        user_impact_template=(
            body.user_impact_template if body.user_impact_template is not None else current.user_impact_template
        ),
    )
    manager = await get_database_manager()
    pool = await manager.get_asyncpg_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO system_maintenance_deploy_defaults (
          id, notice_before_seconds, expected_downtime_seconds, title,
          message_template, user_impact_template, updated_at, updated_by
        ) VALUES (
          1, $1, $2, $3, $4, $5, now(), $6
        )
        ON CONFLICT (id) DO UPDATE SET
          notice_before_seconds = EXCLUDED.notice_before_seconds,
          expected_downtime_seconds = EXCLUDED.expected_downtime_seconds,
          title = EXCLUDED.title,
          message_template = EXCLUDED.message_template,
          user_impact_template = EXCLUDED.user_impact_template,
          updated_at = now(),
          updated_by = EXCLUDED.updated_by
        RETURNING notice_before_seconds, expected_downtime_seconds, title,
                  message_template, user_impact_template, updated_at, updated_by
        """,
        merged.notice_before_seconds,
        merged.expected_downtime_seconds,
        merged.title,
        merged.message_template,
        merged.user_impact_template,
        (updated_by or "").strip() or None,
    )
    assert row is not None
    return MaintenanceDeployDefaults(
        notice_before_seconds=int(row["notice_before_seconds"]),
        expected_downtime_seconds=int(row["expected_downtime_seconds"]),
        title=str(row["title"]),
        message_template=str(row["message_template"]),
        user_impact_template=str(row["user_impact_template"]),
        updated_at=row["updated_at"],
        updated_by=row["updated_by"],
    )


def defaults_preview_payload(defaults: MaintenanceDeployDefaults) -> dict[str, Any]:
    """Admin preview of rendered copy for 'now'."""
    starts, ends = compute_window_schedule(defaults)
    message, impact = render_deploy_copy(defaults, starts_at=starts, ends_at=ends)
    return {
        "defaults": defaults.model_dump(mode="json"),
        "preview": {
            "starts_at": starts.isoformat().replace("+00:00", "Z"),
            "expected_ends_at": ends.isoformat().replace("+00:00", "Z"),
            "starts_at_local": format_local_clock(starts),
            "ends_at_local": format_local_clock(ends),
            "title": defaults.title,
            "message": message,
            "user_impact": impact,
        },
    }
