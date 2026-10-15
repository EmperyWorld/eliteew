#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Parse `UGS_STALE_*` environment variables: DB stale horizons (timedelta), per-category processing
# overrides, estimated_time multiplier, Celery beat interval, and list-endpoint throttle.
# Invariants:
# - Defaults stay 30 minutes / 6 hours / 12 hours for DB horizons; reaper beat default 15 minutes;
#   invalid env falls back to defaults; values are clamped (see UGS-QUEUE-OPERATOR-ENV.md).
# Related:
# - api/services/ugs/queue_manager_service.py
# - api/tasks/ugs_stale_request_reaper.py
# - api/tasks/celery_app.py (beat schedule reads `ugs_stale_reaper_interval_minutes`)
# ---
"""UGS stale horizon env → timedelta helpers."""

from __future__ import annotations

import os
from datetime import timedelta


def _clamp_int(value: int, lo: int, hi: int) -> int:
    return max(lo, min(value, hi))


def stale_pending_orphan_after() -> timedelta:
    """How long `pending` without a live generation_queue row may linger before stale cleanup."""
    raw = (os.environ.get("UGS_STALE_PENDING_ORPHAN_MINUTES") or "30").strip()
    try:
        minutes = int(raw)
    except ValueError:
        minutes = 30
    minutes = _clamp_int(minutes, 1, 10_080)  # 1 minute .. 7 days
    return timedelta(minutes=minutes)


def stale_pending_in_queue_after() -> timedelta:
    """How long `pending` may stay in the queue table before stale cleanup."""
    raw = (os.environ.get("UGS_STALE_PENDING_IN_QUEUE_HOURS") or "6").strip()
    try:
        hours = int(raw)
    except ValueError:
        hours = 6
    hours = _clamp_int(hours, 1, 720)  # 1 hour .. 30 days
    return timedelta(hours=hours)


def stale_processing_after() -> timedelta:
    """How long `processing` may run before stale cleanup."""
    raw = (os.environ.get("UGS_STALE_PROCESSING_HOURS") or "12").strip()
    try:
        hours = int(raw)
    except ValueError:
        hours = 12
    hours = _clamp_int(hours, 1, 720)  # 1 hour .. 30 days
    return timedelta(hours=hours)


def ugs_list_stale_cleanup_interval_seconds() -> int:
    """
    Minimum seconds between ``cleanup_stale_request_states`` runs triggered by GET /tasks listings.

    Celery reaper still runs on its own schedule; this only throttles hot polling paths.
    """
    raw = (os.environ.get("UGS_LIST_STALE_CLEANUP_INTERVAL_SEC") or "60").strip()
    try:
        seconds = int(raw)
    except ValueError:
        seconds = 60
    return _clamp_int(seconds, 0, 3600)


def ugs_stale_reaper_interval_minutes() -> int:
    """
    Celery beat interval for ``run_ugs_stale_request_cleanup_task`` (QueueManagerService cleanup).

    Separate from DB cutoff horizons: this is how often the reaper *runs*, not how old a row must be.
    """
    raw = (os.environ.get("UGS_STALE_REAPER_INTERVAL_MINUTES") or "15").strip()
    try:
        minutes = int(raw)
    except ValueError:
        minutes = 15
    return _clamp_int(minutes, 1, 1440)  # 1 minute .. 24 hours


def stale_processing_hours_music() -> timedelta:
    """Category override for long music / Comfy jobs before stale processing cleanup."""
    raw = (os.environ.get("UGS_STALE_PROCESSING_HOURS_MUSIC") or "24").strip()
    try:
        hours = int(raw)
    except ValueError:
        hours = 24
    hours = _clamp_int(hours, 1, 720)
    return timedelta(hours=hours)


def stale_processing_hours_image() -> timedelta:
    """Category override for image generation before stale processing cleanup."""
    raw = (os.environ.get("UGS_STALE_PROCESSING_HOURS_IMAGE") or "18").strip()
    try:
        hours = int(raw)
    except ValueError:
        hours = 18
    hours = _clamp_int(hours, 1, 720)
    return timedelta(hours=hours)


def stale_processing_estimated_multiplier() -> float:
    """
    Multiply ``generation_types.estimated_time`` (seconds) for per-type processing stale horizon.

    Effective horizon is ``GREATEST(default, category override, estimated_time * multiplier)``.
    """
    raw = (os.environ.get("UGS_STALE_PROCESSING_ESTIMATED_MULTIPLIER") or "3").strip()
    try:
        value = float(raw)
    except ValueError:
        value = 3.0
    return max(1.0, min(value, 10.0))


def processing_stale_interval_params(*, now_iso: str | None = None) -> dict[str, object]:
    """Bind parameters for per-type processing stale SQL (``timedelta`` for asyncpg interval)."""
    del now_iso  # reserved for callers that log cutoff previews
    return {
        "default_interval": stale_processing_after(),
        "music_interval": stale_processing_hours_music(),
        "image_interval": stale_processing_hours_image(),
        "estimated_multiplier": stale_processing_estimated_multiplier(),
    }


# SQL fragment: requires alias ``gr`` on generation_requests and join to ``generation_types gt``.
# Use ``started + horizon <= :now`` (not ``started <= :now - horizon``): asyncpg/SQLAlchemy text()
# binds can leave ``timestamptz <= interval`` on the RHS when subtracting from ``:now``.
PROCESSING_STALE_WHERE_SQL = """
    gr.status = 'processing'
    AND gr.deleted_at IS NULL
    AND COALESCE(
        gr.started_at,
        NULLIF(gr.request_metadata->>'worker_started_at', '')::timestamptz,
        gr.created_at
    ) + (
        GREATEST(
            :default_interval,
            CASE
                WHEN lower(coalesce(gt.category, '')) = 'music'
                  OR coalesce(gt.type_key, '') LIKE 'music_generator_%'
                THEN :music_interval
                WHEN lower(coalesce(gt.category, '')) = 'image'
                THEN :image_interval
                ELSE CAST('0 seconds' AS interval)
            END,
            CASE
                WHEN gt.estimated_time IS NOT NULL AND gt.estimated_time > 0
                THEN make_interval(secs => (gt.estimated_time::double precision * :estimated_multiplier))
                ELSE CAST('0 seconds' AS interval)
            END
        )
    ) <= CAST(:now AS timestamptz)
"""
