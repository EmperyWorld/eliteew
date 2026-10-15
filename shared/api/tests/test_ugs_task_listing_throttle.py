# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for UGS stale-cleanup throttle env and hot-route usage.
# Related:
# - api/routers/ugs/stats.py
# - api/services/ugs/ugs_stale_horizons.py
# - api/services/ugs/queue_manager_service.py (maybe_cleanup_stale_request_states)
# ---
from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from api.services.ugs.ugs_stale_horizons import ugs_list_stale_cleanup_interval_seconds

API_ROOT = Path(__file__).resolve().parents[1]


def test_ugs_list_stale_cleanup_interval_default() -> None:
    with patch.dict("os.environ", {}, clear=False):
        assert ugs_list_stale_cleanup_interval_seconds() == 60


def test_ugs_list_stale_cleanup_interval_from_env() -> None:
    with patch.dict("os.environ", {"UGS_LIST_STALE_CLEANUP_INTERVAL_SEC": "120"}):
        assert ugs_list_stale_cleanup_interval_seconds() == 120


def test_ugs_list_stale_cleanup_interval_zero_disables_throttle() -> None:
    with patch.dict("os.environ", {"UGS_LIST_STALE_CLEANUP_INTERVAL_SEC": "0"}):
        assert ugs_list_stale_cleanup_interval_seconds() == 0


def test_ugs_stats_route_uses_throttled_stale_cleanup() -> None:
    source = (API_ROOT / "routers/ugs/stats.py").read_text(encoding="utf-8")
    assert "await queue_stats_service.maybe_cleanup_stale_request_states()" in source
    assert "await queue_stats_service.cleanup_stale_request_states()" not in source
