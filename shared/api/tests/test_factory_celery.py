# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Locks for factory Celery enqueue (queue ewa_factory) — Wave F5 follow-up.
# Invariants:
# - Async off → enqueue returns None; async on → apply_async with queue ewa_factory.
# Related:
# - api.ewa_platform.factory.jobs.enqueue
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from api.ewa_platform.factory.jobs import enqueue as enqueue_mod
from api.ewa_platform.factory.service import reset_factory_service_for_tests
from api.ewa_platform.factory.store import MemoryIntentionStore
from api.ewa_platform.workers import factory_task_runner as runner
from api.routers import desktop_admin_factory as factory_router


def test_enqueue_skipped_when_async_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_FACTORY_ASYNC_JOBS", "0")
    assert enqueue_mod.enqueue_factory_tick(intention_id="abc") is None


def test_enqueue_calls_apply_async(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_FACTORY_ASYNC_JOBS", "1")
    fake_task = MagicMock()
    fake_task.apply_async.return_value = SimpleNamespace(id="celery-tid-1")
    monkeypatch.setattr(runner, "factory_intention_tick_task", fake_task, raising=False)
    # enqueue imports task lazily from factory_task_runner
    monkeypatch.setattr(
        "api.ewa_platform.workers.factory_task_runner.factory_intention_tick_task",
        fake_task,
    )
    tid = enqueue_mod.enqueue_factory_tick(intention_id="abc", remaining_ticks=3)
    assert tid == "celery-tid-1"
    fake_task.apply_async.assert_called_once()
    kwargs = fake_task.apply_async.call_args.kwargs
    assert kwargs["queue"] == "ewa_factory"
    assert kwargs["kwargs"]["remaining_ticks"] == 3


def test_worker_tick_chains_remaining(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_FACTORY_ASYNC_JOBS", "1")
    monkeypatch.setenv("ELITEEW_FACTORY_AUTONOMOUS", "0")
    reset_factory_service_for_tests(MemoryIntentionStore())
    from api.ewa_platform.factory.service import get_factory_service

    item = get_factory_service().enqueue(title="chain", run_ticks=0)
    chained: list[int] = []

    def _fake_enqueue(**kwargs):  # noqa: ANN003
        chained.append(int(kwargs.get("remaining_ticks") or 0))
        return "next-tid"

    monkeypatch.setattr(runner, "enqueue_factory_tick", _fake_enqueue)
    out = runner.factory_intention_tick_task.run(
        intention_id=item["id"],
        verify_passed=True,
        remaining_ticks=2,
    )
    assert out["ok"] is True
    assert out["item"]["stage"] == "plan"
    assert chained == [1]


@pytest.mark.asyncio
async def test_admin_enqueue_async_schedules(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_FACTORY_ASYNC_JOBS", "1")
    reset_factory_service_for_tests(MemoryIntentionStore())
    monkeypatch.setattr(
        factory_router,
        "enqueue_factory_tick",
        lambda **kwargs: "tid-admin",
    )
    out = await factory_router.enqueue_intention(
        body=factory_router.FactoryEnqueueBody(title="async", run_ticks=3),
        admin=SimpleNamespace(id=uuid4(), email="a@b.c"),
    )
    assert out["async_jobs"] is True
    assert out["celery_task_id"] == "tid-admin"
    assert out["item"]["stage"] == "queued"


@pytest.mark.asyncio
async def test_admin_status_reports_queue(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_FACTORY_ASYNC_JOBS", "0")
    out = await factory_router.factory_status(_admin=SimpleNamespace(id=uuid4()))
    assert out["celery_queue"] == "ewa_factory"
    assert out["async_jobs"] is False
