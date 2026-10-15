# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Record and aggregate web search events for admin stats and health signals.
# Invariants:
# - Never persist plaintext search queries (fingerprint only).
# Related:
# - api/models/web_search_event.py
# - api/services/search_service.py
# ---

from __future__ import annotations

import hashlib
import logging
import os
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.web_search_event import WEB_SEARCH_EVENT_STATUSES, WebSearchEvent

logger = logging.getLogger(__name__)

WebSearchEventStatus = Literal["ok", "empty", "error", "blocked", "quota_denied"]
SearchStatsPeriod = Literal["24h", "7d"]

_RETENTION_DAYS = max(1, int(os.getenv("WEB_SEARCH_EVENTS_RETENTION_DAYS", "90") or "90"))


def web_search_query_fingerprint(query: str) -> str:
    normalized = (query or "").strip().lower()
    if not normalized:
        return ""
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:32]


async def record_web_search_event(
    db: AsyncSession | None,
    *,
    surface: str | None,
    status: WebSearchEventStatus,
    latency_ms: int,
    hit_count: int = 0,
    error_code: str | None = None,
    cache_hit: bool = False,
    actor_user_id: UUID | str | None = None,
    query: str | None = None,
) -> None:
    if db is None:
        return
    if status not in WEB_SEARCH_EVENT_STATUSES:
        status = "error"
    actor_uuid: UUID | None = None
    if actor_user_id is not None:
        actor_uuid = actor_user_id if isinstance(actor_user_id, UUID) else UUID(str(actor_user_id))
    fp = web_search_query_fingerprint(query or "") or None
    row = WebSearchEvent(
        surface=(surface or "global").strip().lower() or "global",
        status=status,
        provider="yandex",
        latency_ms=max(0, int(latency_ms)),
        hit_count=max(0, int(hit_count)),
        error_code=(error_code or "").strip()[:64] or None,
        cache_hit=bool(cache_hit),
        actor_user_id=actor_uuid,
        query_fingerprint=fp,
    )
    try:
        db.add(row)
        await db.commit()
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        logger.warning("[STEP] search.event_record_failed status=%s err=%s", status, exc)


def _period_start(period: SearchStatsPeriod) -> datetime:
    now = datetime.now(UTC)
    if period == "7d":
        return now - timedelta(days=7)
    return now - timedelta(hours=24)


async def get_web_search_stats(
    db: AsyncSession,
    *,
    period: SearchStatsPeriod = "24h",
) -> dict[str, Any]:
    since = _period_start(period)

    total = int(
        (await db.scalar(select(func.count()).select_from(WebSearchEvent).where(WebSearchEvent.created_at >= since)))
        or 0
    )

    async def _count_status(st: str) -> int:
        stmt = (
            select(func.count())
            .select_from(WebSearchEvent)
            .where(
                WebSearchEvent.created_at >= since,
                WebSearchEvent.status == st,
            )
        )
        return int((await db.scalar(stmt)) or 0)

    ok_count = await _count_status("ok")
    empty_count = await _count_status("empty")
    error_count = await _count_status("error")
    blocked_count = await _count_status("blocked")
    quota_denied = await _count_status("quota_denied")

    latency_stmt = select(WebSearchEvent.latency_ms).where(
        WebSearchEvent.created_at >= since,
        WebSearchEvent.status.in_(("ok", "empty")),
    )
    latencies = [int(x) for x in (await db.scalars(latency_stmt)).all() if x is not None]
    latencies.sort()
    p50 = latencies[len(latencies) // 2] if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0

    cache_hits = int(
        (
            await db.scalar(
                select(func.count())
                .select_from(WebSearchEvent)
                .where(
                    WebSearchEvent.created_at >= since,
                    WebSearchEvent.cache_hit.is_(True),
                )
            )
        )
        or 0
    )

    by_surface: list[dict[str, Any]] = []
    surface_stmt = (
        select(WebSearchEvent.surface, func.count())
        .where(WebSearchEvent.created_at >= since)
        .group_by(WebSearchEvent.surface)
        .order_by(WebSearchEvent.surface)
    )
    for surface, count in (await db.execute(surface_stmt)).all():
        by_surface.append({"surface": str(surface), "total": int(count)})

    denom = total if total > 0 else 1
    return {
        "period": period,
        "since": since.isoformat(),
        "total": total,
        "ok": ok_count,
        "empty": empty_count,
        "error": error_count,
        "blocked": blocked_count,
        "quota_denied": quota_denied,
        "empty_rate": round(empty_count / denom, 4),
        "error_rate": round(error_count / denom, 4),
        "cache_hits": cache_hits,
        "cache_hit_rate": round(cache_hits / denom, 4) if total else 0.0,
        "latency_ms_p50": p50,
        "latency_ms_p95": p95,
        "by_surface": by_surface,
    }


async def get_web_search_health(db: AsyncSession) -> dict[str, Any]:
    last_ok_stmt = (
        select(WebSearchEvent.created_at)
        .where(WebSearchEvent.status == "ok")
        .order_by(WebSearchEvent.created_at.desc())
        .limit(1)
    )
    last_ok_at = await db.scalar(last_ok_stmt)

    recent_errors_stmt = (
        select(func.count())
        .select_from(WebSearchEvent)
        .where(
            WebSearchEvent.created_at >= datetime.now(UTC) - timedelta(hours=1),
            WebSearchEvent.status == "error",
        )
    )
    errors_1h = int((await db.scalar(recent_errors_stmt)) or 0)

    streak = 0
    recent = (
        await db.scalars(select(WebSearchEvent.status).order_by(WebSearchEvent.created_at.desc()).limit(20))
    ).all()
    for st in recent:
        if st == "error":
            streak += 1
        else:
            break

    probe_recommended = streak >= 3 or errors_1h >= 5 or last_ok_at is None

    return {
        "last_success_at": last_ok_at.isoformat() if last_ok_at else None,
        "error_streak": streak,
        "errors_last_hour": errors_1h,
        "probe_recommended": probe_recommended,
    }


async def cleanup_web_search_events(db: AsyncSession) -> int:
    cutoff = datetime.now(UTC) - timedelta(days=_RETENTION_DAYS)
    result = await db.execute(delete(WebSearchEvent).where(WebSearchEvent.created_at < cutoff))
    await db.commit()
    deleted = int(getattr(result, "rowcount", 0) or 0)
    if deleted:
        logger.info("[STEP] search.events_cleanup deleted=%s retention_days=%s", deleted, _RETENTION_DAYS)
    return deleted
