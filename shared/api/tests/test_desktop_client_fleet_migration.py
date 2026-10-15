# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure helpers + source locks for Wave 9 fleet migration service.
# Related:
# - api/services/desktop_client/fleet_migration_service.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from api.services.desktop_client.fleet_migration_service import (
    DEFAULT_DEADLINE_DAYS,
    deadline_at,
)


def test_deadline_at_default_days() -> None:
    now = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
    got = deadline_at(now=now)
    assert (got - now).days == DEFAULT_DEADLINE_DAYS


def test_deadline_at_custom_days() -> None:
    now = datetime(2026, 8, 12, tzinfo=UTC)
    assert deadline_at(days=7, now=now).day == 19


def test_fleet_service_exposes_complete_after_activation() -> None:
    src = Path("services/desktop_client/fleet_migration_service.py").read_text(encoding="utf-8")
    assert "async def complete_migration_after_activation" in src
    assert "revoke_peer" in src
    assert "async def summarize" in src


def test_activation_router_wires_fleet_migration() -> None:
    src = Path("routers/desktop_client/activation.py").read_text(encoding="utf-8")
    assert "FleetMigrationService" in src
    assert "complete_migration_after_activation" in src
