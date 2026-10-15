# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Gate G6 locks: agentic orphan/mirror/nonretryable Prometheus contracts.
# Invariants:
# - Helpers never raise; orphan gauge drives ops_alarm_state sustain window.
# Related:
# - api/monitoring/metrics.py
# - documentation/product/ewa/EWA-FORENSIC-AUDIT-RECOVERY-PLAN-2026-07-09.md (Gate G6)
# ---

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

from api.monitoring import metrics

API_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(autouse=True)
def reset_agentic_alarm() -> Iterator[None]:
    metrics._alarm_breach_since.pop("agentic_orphan_sessions", None)
    metrics.set_ops_alarm_state(alarm="agentic_orphan_sessions", active=False)
    metrics.ewa_agentic_orphan_sessions.set(0.0)
    yield
    metrics._alarm_breach_since.pop("agentic_orphan_sessions", None)
    metrics.set_ops_alarm_state(alarm="agentic_orphan_sessions", active=False)
    metrics.ewa_agentic_orphan_sessions.set(0.0)


def test_metrics_registry_contains_agentic_g6_contracts() -> None:
    source = (API_ROOT / "monitoring/metrics.py").read_text(encoding="utf-8")
    assert "ewa_agentic_orphan_sessions" in source
    assert "ewa_agentic_mirror_sync_fail_total" in source
    assert "ewa_agentic_celery_nonretryable_total" in source
    assert "set_ewa_agentic_orphan_sessions" in source
    assert "observe_ewa_agentic_mirror_sync_fail" in source
    assert "observe_ewa_agentic_celery_nonretryable" in source


def test_set_ewa_agentic_orphan_sessions_updates_gauge() -> None:
    metrics.set_ewa_agentic_orphan_sessions(count=3)
    assert metrics.ewa_agentic_orphan_sessions._value.get() == 3.0


def test_observe_mirror_and_nonretryable_increment() -> None:
    before_mirror = metrics.ewa_agentic_mirror_sync_fail_total._value.get()
    metrics.observe_ewa_agentic_mirror_sync_fail()
    assert metrics.ewa_agentic_mirror_sync_fail_total._value.get() == before_mirror + 1.0

    before_nr = metrics.ewa_agentic_celery_nonretryable_total.labels(error_class="IntegrityError")._value.get()
    metrics.observe_ewa_agentic_celery_nonretryable(error_class="IntegrityError")
    assert (
        metrics.ewa_agentic_celery_nonretryable_total.labels(error_class="IntegrityError")._value.get()
        == before_nr + 1.0
    )


def test_reliability_and_executor_emit_g6_metrics() -> None:
    reliability = (API_ROOT / "ewa_platform/agentic/jobs/reliability.py").read_text(encoding="utf-8")
    executor = (API_ROOT / "ewa_platform/agentic/jobs/executor.py").read_text(encoding="utf-8")
    assert "observe_ewa_agentic_mirror_sync_fail" in reliability
    assert "observe_ewa_agentic_celery_nonretryable" in reliability
    assert "set_ewa_agentic_orphan_sessions" in executor
    assert "observe_ewa_agentic_orphan_sweep" in executor
