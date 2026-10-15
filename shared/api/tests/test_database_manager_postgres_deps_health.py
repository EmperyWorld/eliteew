#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: /api/health must not report healthy when PostgreSQL asyncio deps are missing.
# Invariants:
# - No mocks; toggles module flag POSTGRES_AVAILABLE around a bare DatabaseManager.
# Related:
# - api/core/database_manager.py (get_health_summary)
# - api/monitoring/api_health_public.py (ok := status == healthy)
# ---
"""Health honesty when greenlet / SQLAlchemy asyncio imports fail at process start."""

from __future__ import annotations

import api.core.database_manager as dm


def test_get_health_summary_unhealthy_when_postgres_deps_missing() -> None:
    previous = dm.POSTGRES_AVAILABLE
    try:
        dm.POSTGRES_AVAILABLE = False
        manager = dm.DatabaseManager.__new__(dm.DatabaseManager)
        manager.health_status = {}
        manager.connection_stats = {}
        summary = manager.get_health_summary()
    finally:
        dm.POSTGRES_AVAILABLE = previous

    assert summary["overall_status"] == "unhealthy"
    pg = summary["databases"]["postgresql"]
    assert pg["status"] == "down"
    assert "greenlet" in str(pg.get("error") or "").lower() or "asyncio" in str(pg.get("error") or "").lower()
