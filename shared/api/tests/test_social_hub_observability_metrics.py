# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock Social Hub Prometheus counter names and observe_* helpers.
# Invariants:
# - observe helpers must not raise; metric names stay registered on monitoring_registry.
# Related:
# - api/monitoring/metrics.py
# ---

from __future__ import annotations

from pathlib import Path

from api.monitoring import metrics

API_ROOT = Path(__file__).resolve().parents[1]


def test_social_hub_metric_names_registered() -> None:
    source = (API_ROOT / "monitoring" / "metrics.py").read_text(encoding="utf-8")
    for name in (
        "social_hub_friend_requests_total",
        "social_hub_reports_total",
        "social_hub_blocks_total",
        "observe_social_hub_friend_request",
        "observe_social_hub_report",
        "observe_social_hub_block",
    ):
        assert name in source


def test_observe_social_hub_helpers_increment() -> None:
    before_req = metrics.social_hub_friend_requests_total.labels(outcome="sent")._value.get()
    metrics.observe_social_hub_friend_request(outcome="sent")
    assert metrics.social_hub_friend_requests_total.labels(outcome="sent")._value.get() == before_req + 1

    before_rep = metrics.social_hub_reports_total.labels(outcome="created")._value.get()
    metrics.observe_social_hub_report(outcome="created")
    assert metrics.social_hub_reports_total.labels(outcome="created")._value.get() == before_rep + 1

    before_blk = metrics.social_hub_blocks_total.labels(outcome="set")._value.get()
    metrics.observe_social_hub_block(outcome="set")
    assert metrics.social_hub_blocks_total.labels(outcome="set")._value.get() == before_blk + 1
