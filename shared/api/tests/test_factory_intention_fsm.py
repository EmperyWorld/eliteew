# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for Wave F5 factory Intention FSM + service pause/resume.
# Invariants:
# - Autonomous OFF skips implement stage (plan→verify→done).
# Related:
# - api.ewa_platform.factory
# ---

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from api.ewa_platform.factory.atoms import MemoryFactoryAtomStore
from api.ewa_platform.factory.config import factory_autonomous_enabled
from api.ewa_platform.factory.models import FactoryStage, FactoryStatus
from api.ewa_platform.factory.service import (
    FactoryIntentionService,
    reset_factory_service_for_tests,
)
from api.ewa_platform.factory.state_machine import (
    FactoryTransitionError,
    apply_pause,
    apply_resume,
    next_stage_after_tick,
)
from api.ewa_platform.factory.store import MemoryIntentionStore
from api.routers import desktop_admin_factory as factory_router


def test_fsm_skips_implement_when_not_autonomous() -> None:
    stage, status, reason = next_stage_after_tick(
        stage=FactoryStage.PLAN,
        autonomous=False,
        verify_passed=True,
        fix_loops=0,
        max_fix_loops=3,
    )
    assert stage == FactoryStage.VERIFY
    assert status == FactoryStatus.RUNNING
    assert reason is None


def test_fsm_enters_implement_when_autonomous() -> None:
    stage, status, _ = next_stage_after_tick(
        stage=FactoryStage.PLAN,
        autonomous=True,
        verify_passed=True,
        fix_loops=0,
        max_fix_loops=3,
    )
    assert stage == FactoryStage.IMPLEMENT
    assert status == FactoryStatus.RUNNING


def test_pause_resume_roundtrip() -> None:
    assert apply_pause(FactoryStatus.RUNNING) == FactoryStatus.PAUSED
    assert apply_resume(FactoryStatus.PAUSED) == FactoryStatus.RUNNING
    with pytest.raises(FactoryTransitionError):
        apply_resume(FactoryStatus.RUNNING)


def test_service_enqueue_plan_verify_done(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_AUTONOMOUS", "0")
    svc = FactoryIntentionService(
        store=MemoryIntentionStore(),
        atom_store=MemoryFactoryAtomStore(),
    )
    item = svc.enqueue(title="t", pack_stems=["notifications"], run_ticks=3)
    assert item["status"] == "completed"
    assert item["stage"] == "done"
    assert item["verify_status"] == "PASSED"
    assert "implement" not in str(item.get("checkpoint", {}).get("last_tick_stage", ""))
    assert "context_pack" in (item.get("checkpoint") or {})


def test_service_pause_blocks_tick(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_AUTONOMOUS", "0")
    svc = FactoryIntentionService(
        store=MemoryIntentionStore(),
        atom_store=MemoryFactoryAtomStore(),
    )
    item = svc.enqueue(title="t", run_ticks=0)
    paused = svc.pause(item["id"], reason="operator_pause")
    assert paused["status"] == "paused"
    with pytest.raises(FactoryTransitionError):
        svc.tick(item["id"])
    resumed = svc.resume(item["id"])
    assert resumed["status"] == "running"
    ticked = svc.tick(item["id"])
    assert ticked["stage"] == "plan"


@pytest.mark.asyncio
async def test_factory_list_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_ENABLED", "1")
    reset_factory_service_for_tests(
        store=MemoryIntentionStore(),
        atom_store=MemoryFactoryAtomStore(),
    )
    out = await factory_router.list_intentions(_admin=SimpleNamespace(id=uuid4()))
    assert out["count"] == 0
    assert out["items"] == []


@pytest.mark.asyncio
async def test_factory_disabled_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_ENABLED", "0")
    with pytest.raises(HTTPException) as exc:
        await factory_router.factory_status(_admin=SimpleNamespace(id=uuid4()))
    assert exc.value.status_code == 503


def test_autonomous_default_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ELITEEW_FACTORY_AUTONOMOUS", raising=False)
    # May still read unified_config default False
    assert factory_autonomous_enabled() is False
