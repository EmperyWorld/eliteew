# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for UGS `UGS_STALE_*` env: DB stale horizons and Celery reaper beat interval.
# Invariants:
# - Defaults match historical constants: 30m / 6h / 12h.
# Related:
# - api/services/ugs/ugs_stale_horizons.py
# - documentation/platform/docker-re_doc/UGS-QUEUE-OPERATOR-ENV.md
# ---
"""Tests for UGS_STALE_* stale horizon environment variables."""

from __future__ import annotations

from datetime import timedelta

import pytest

from api.services.ugs.ugs_stale_horizons import (
    stale_pending_in_queue_after,
    stale_pending_orphan_after,
    stale_processing_after,
    ugs_stale_reaper_interval_minutes,
)


def test_stale_threshold_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("UGS_STALE_PENDING_ORPHAN_MINUTES", raising=False)
    monkeypatch.delenv("UGS_STALE_PENDING_IN_QUEUE_HOURS", raising=False)
    monkeypatch.delenv("UGS_STALE_PROCESSING_HOURS", raising=False)

    assert stale_pending_orphan_after() == timedelta(minutes=30)
    assert stale_pending_in_queue_after() == timedelta(hours=6)
    assert stale_processing_after() == timedelta(hours=12)


def test_stale_threshold_clamps(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("UGS_STALE_PENDING_ORPHAN_MINUTES", "0")
    monkeypatch.setenv("UGS_STALE_PENDING_IN_QUEUE_HOURS", "9000")
    monkeypatch.setenv("UGS_STALE_PROCESSING_HOURS", "-5")

    assert stale_pending_orphan_after() == timedelta(minutes=1)
    assert stale_pending_in_queue_after() == timedelta(hours=720)
    assert stale_processing_after() == timedelta(hours=1)


def test_stale_threshold_custom(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("UGS_STALE_PENDING_ORPHAN_MINUTES", "45")
    monkeypatch.setenv("UGS_STALE_PENDING_IN_QUEUE_HOURS", "8")
    monkeypatch.setenv("UGS_STALE_PROCESSING_HOURS", "24")

    assert stale_pending_orphan_after() == timedelta(minutes=45)
    assert stale_pending_in_queue_after() == timedelta(hours=8)
    assert stale_processing_after() == timedelta(hours=24)


def test_stale_reaper_interval_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("UGS_STALE_REAPER_INTERVAL_MINUTES", raising=False)
    assert ugs_stale_reaper_interval_minutes() == 15


def test_stale_reaper_interval_clamp(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("UGS_STALE_REAPER_INTERVAL_MINUTES", "0")
    assert ugs_stale_reaper_interval_minutes() == 1
    monkeypatch.setenv("UGS_STALE_REAPER_INTERVAL_MINUTES", "9999")
    assert ugs_stale_reaper_interval_minutes() == 1440


def test_processing_stale_where_sql_uses_additive_cutoff() -> None:
    """Regression: ``<= :now - interval`` raised ``timestamptz <= interval`` under asyncpg."""
    from datetime import datetime

    from sqlalchemy import text

    from api.services.ugs.ugs_stale_horizons import (
        PROCESSING_STALE_WHERE_SQL,
        processing_stale_interval_params,
    )

    assert ":now -" not in PROCESSING_STALE_WHERE_SQL
    assert ") + (" in PROCESSING_STALE_WHERE_SQL
    assert "<= CAST(:now AS timestamptz)" in PROCESSING_STALE_WHERE_SQL

    stmt = text(
        f"""
        SELECT COUNT(*)::int
        FROM generation_requests gr
        JOIN generation_types gt ON gt.id = gr.type_id
        WHERE {PROCESSING_STALE_WHERE_SQL}
        """
    )
    compiled = str(
        stmt.compile(
            dialect=__import__("sqlalchemy.dialects.postgresql", fromlist=["asyncpg"]).asyncpg.dialect(),
            compile_kwargs={"literal_binds": False},
        )
    )
    assert "timestamptz" in compiled
    assert " <= " in compiled
    assert " + " in compiled

    params = {
        "now": datetime(2026, 5, 27, 0, 25, 29),
        **processing_stale_interval_params(),
    }
    assert params["default_interval"] == timedelta(hours=12)


def test_stale_processing_category_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.ugs.ugs_stale_horizons import (
        processing_stale_interval_params,
        stale_processing_estimated_multiplier,
        stale_processing_hours_image,
        stale_processing_hours_music,
    )

    monkeypatch.delenv("UGS_STALE_PROCESSING_HOURS_MUSIC", raising=False)
    monkeypatch.delenv("UGS_STALE_PROCESSING_HOURS_IMAGE", raising=False)
    monkeypatch.delenv("UGS_STALE_PROCESSING_ESTIMATED_MULTIPLIER", raising=False)

    assert stale_processing_hours_music() == timedelta(hours=24)
    assert stale_processing_hours_image() == timedelta(hours=18)
    assert stale_processing_estimated_multiplier() == 3.0
    params = processing_stale_interval_params()
    assert params["music_interval"] == timedelta(hours=24)
    assert params["estimated_multiplier"] == 3.0
