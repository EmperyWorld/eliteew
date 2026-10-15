# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for deploy maintenance defaults schedule + template rendering.
# Invariants:
# - ends_at = starts_at + downtime (not now + downtime alone).
# Related:
# - api/services/maintenance_deploy_defaults.py
# ---

from __future__ import annotations

from datetime import UTC, datetime

from api.schemas.maintenance import MaintenanceDeployDefaults
from api.services.maintenance_deploy_defaults import (
    compute_window_schedule,
    render_deploy_copy,
)


def test_compute_window_schedule_ends_after_notice_plus_downtime() -> None:
    defaults = MaintenanceDeployDefaults(
        notice_before_seconds=600,
        expected_downtime_seconds=120,
    )
    now = datetime(2026, 8, 8, 12, 0, 0, tzinfo=UTC)
    starts, ends = compute_window_schedule(defaults, now=now)
    assert starts == datetime(2026, 8, 8, 12, 10, 0, tzinfo=UTC)
    assert ends == datetime(2026, 8, 8, 12, 12, 0, tzinfo=UTC)


def test_render_deploy_copy_substitutes_placeholders(monkeypatch) -> None:
    monkeypatch.setenv("ELITEEW_OPERATOR_TZ", "Asia/Vladivostok")
    defaults = MaintenanceDeployDefaults(
        notice_before_seconds=600,
        expected_downtime_seconds=120,
        message_template=(
            "Через {notice_minutes} мин, с {starts_at_local} до {ends_at_local} (~{downtime_minutes} мин)."
        ),
        user_impact_template="Пауза {starts_at_local}-{ends_at_local}.",
    )
    # 03:00 UTC → 13:00 Asia/Vladivostok (+10); starts +10m → 13:10
    now = datetime(2026, 8, 8, 3, 0, 0, tzinfo=UTC)
    starts, ends = compute_window_schedule(defaults, now=now)
    message, impact = render_deploy_copy(defaults, starts_at=starts, ends_at=ends)
    assert "Через 10 мин" in message
    assert "~2 мин" in message
    assert "13:10" in message
    assert "13:12" in message
    assert "13:10" in impact
    assert "13:12" in impact
