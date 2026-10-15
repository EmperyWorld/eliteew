# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Nightly (UTC-day) rollup** MVP for companion HCM Wave 1: aggregate yesterday's ``ewa_companion_episodes``
# bodies per principal and persist a compact **operational recap** inside ``learned_preferences`` —
# ``companion_daily_rollup_v1`` — for morning UX hints (**not** marketing «consciousness» copy).
# Invariants:
# - Idempotent-ish per UTC calendar day (`last_day_iso`); overwriting the same blob is harmless.
# - Skips principals with no episodic rows in the window.
# Related:
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# - api/ewa_platform/workers/daily_rollup_task.py
# - documentation/product/ewa/EWA-COMPANION-HCM-MEMORY.md
# ---
"""Companion episodic rollup written into learned_preferences."""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from datetime import UTC, date, datetime, timedelta
from typing import Any

import asyncpg

from api.ewa_platform.companion.context.noise import collapse_idle_observation_tokens
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)

_ROLLUP_NS = "companion_daily_rollup_v1"


def _day_window_utc(day: date) -> tuple[datetime, datetime]:
    """Inclusive start, exclusive next-day start."""

    start = datetime(day.year, day.month, day.day, tzinfo=UTC)
    return start, start + timedelta(days=1)


def _squash_snippet(parts: list[str], limit: int = 480) -> str:
    merged = " · ".join(p.strip() for p in parts if p and p.strip())
    merged = re.sub(r"\s+", " ", merged).strip()
    if len(merged) <= limit:
        return merged
    return merged[: limit - 1].rstrip() + "…"


async def companion_daily_rollup_for_prior_utc_day(
    pool: asyncpg.Pool,
    *,
    target_day: date | None = None,
) -> dict[str, Any]:
    """Aggregate **target_day** (default: yesterday UTC) episodes per principal; merge rollup blob."""

    now = datetime.now(UTC).date()
    day = target_day if target_day is not None else now - timedelta(days=1)
    start, end = _day_window_utc(day)
    iso_day = day.isoformat()

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT principal_id,
                   COUNT(*)::int AS episode_count,
                   ARRAY_AGG(sub.body ORDER BY sub.created_at DESC) AS bodies
            FROM (
                SELECT principal_id, body, created_at
                FROM ewa_companion_episodes
                WHERE created_at >= $1
                  AND created_at < $2
                  AND body IS NOT NULL
                  AND LENGTH(TRIM(body)) > 0
            ) sub
            GROUP BY principal_id
            """,
            start,
            end,
        )

    patched = 0
    skipped = 0

    for row in rows:
        pid = str(row["principal_id"] or "").strip()
        if not pid:
            skipped += 1
            continue
        prof = await companion_pg.companion_profile_fetch(pool, principal_id=pid)
        if prof is None:
            skipped += 1
            continue

        cnt = int(row["episode_count"] or 0)
        bodies_raw = row["bodies"]
        bodies: list[str] = []
        if isinstance(bodies_raw, list):
            for b in bodies_raw[:24]:
                s = collapse_idle_observation_tokens(str(b or "").strip())
                if s:
                    bodies.append(s[:220])

        snippet = _squash_snippet(bodies)
        rollup_obj: Mapping[str, Any] = {
            "last_day_iso": iso_day,
            "episode_count": cnt,
            "snippet": snippet,
            "generated_at_iso": datetime.now(UTC).isoformat(timespec="seconds"),
            "timezone_note": "UTC day boundary — operator dashboards should label explicitly.",
        }

        lp_patch = {_ROLLUP_NS: rollup_obj}
        out = await companion_pg.companion_profile_patch(
            pool,
            principal_id=pid,
            learned_preferences=lp_patch,
            audit_action="companion_daily_rollup",
            audit_detail_override={
                "rollup_day": iso_day,
                "episode_count": cnt,
            },
        )
        if out is not None:
            patched += 1
            logger.info(
                "[STEP] companion_daily_rollup_applied principal=%s day=%s episodes=%s",
                pid[:12],
                iso_day,
                cnt,
            )
        else:
            skipped += 1

    logger.info("[STEP] companion_daily_rollup_done day=%s groups=%s patched=%s", iso_day, len(rows), patched)
    return {
        "day_iso": iso_day,
        "groups": len(rows),
        "profiles_patched": patched,
        "skipped": skipped,
    }


__all__ = ["companion_daily_rollup_for_prior_utc_day"]
