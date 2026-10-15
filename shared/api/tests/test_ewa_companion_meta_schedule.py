# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for companion meta evolution scheduling and beat sweep fan-out.
# Invariants:
# - No live Celery/Postgres — mocks only.
# Related:
# - api/ewa_platform/companion/plans/meta_schedule.py
# ---
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.companion.plans import meta_schedule as ms


@pytest.mark.unit
def test_build_meta_idempotency_keys_stable() -> None:
    k1 = ms.build_meta_plan_idempotency_key(principal_id="p1", plan_id="plan-a")
    k2 = ms.build_meta_plan_idempotency_key(principal_id="p1", plan_id="plan-a")
    assert k1 == k2
    assert k1.startswith("meta:plan:v1:")
    sk = ms.build_meta_scheduled_idempotency_key(
        principal_id="p1",
        plan_id="plan-a",
        hour_bucket_utc="2026051912",
    )
    assert "2026051912" in sk


@pytest.mark.unit
def test_schedule_meta_from_plan_respects_flags(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ms, "companion_plan_enabled", lambda: False)
    assert ms.schedule_companion_meta_from_plan(principal_id="p", plan_id="x") is False


@pytest.mark.unit
def test_schedule_meta_from_plan_calls_celery(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ms, "companion_plan_enabled", lambda: True)
    monkeypatch.setattr(ms, "companion_meta_evolution_enabled", lambda: True)
    called: list[dict] = []

    def _capture(**kwargs: object) -> bool:
        called.append(dict(kwargs))
        return True

    monkeypatch.setattr(ms, "schedule_companion_evolution_tick", _capture)
    assert ms.schedule_companion_meta_from_plan(principal_id="user-1", plan_id="plan-9") is True
    assert called[0]["tick_reason"] == "companion_meta_from_plan"


@pytest.mark.unit
def test_sweep_enqueues_per_active_plan(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ms, "companion_meta_evolution_enabled", lambda: True)
    monkeypatch.setattr(ms, "companion_meta_evolution_beat_enabled", lambda: True)
    monkeypatch.setattr(
        ms.plans_pg,
        "plan_list_active_principal_plan_ids",
        AsyncMock(
            return_value=[
                {"principal_id": "a", "plan_id": "p1"},
                {"principal_id": "b", "plan_id": "p2"},
            ]
        ),
    )
    enqueued: list[str] = []

    def _sched(**kwargs: object) -> bool:
        enqueued.append(str(kwargs.get("principal_id")))
        return True

    monkeypatch.setattr(ms, "schedule_companion_meta_scheduled_for_principal", _sched)
    out = asyncio.run(ms.companion_meta_evolution_sweep_execute(object()))
    assert out["enqueued"] == 2
    assert enqueued == ["a", "b"]
