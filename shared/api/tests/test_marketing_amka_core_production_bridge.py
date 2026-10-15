# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for marketing AMKA production bridge: persisted master_plan mapping in the driver
# and JSON serialization for the core-alignment API payload.
# Invariants:
# - Tests avoid real asyncpg / AmkaService; they lock driver mapping and serializer shape only.
# Related:
# - shared/api/services/amka_core/marketing_driver.py
# - shared/api/services/amka_core/marketing_core_bridge.py
# - shared/api/services/marketing_cabinet/amka_service.py
# ---
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routers.marketing_cabinet.amka import router as amka_router
from api.routers.marketing_cabinet.common import get_marketing_db_pool, get_marketing_user_id
from api.services.amka_core.contracts import (
    AmkaCoreRunStatus,
    AmkaCoreStage,
    AmkaPlanTask,
    AmkaPolicyDecision,
    AmkaPulseArtifact,
    AmkaRunResult,
    AmkaSnapshot,
    AmkaSubjectRef,
    AmkaTraceEvent,
)
from api.services.amka_core.marketing_core_bridge import serialize_marketing_amka_core_alignment
from api.services.amka_core.marketing_driver import MarketingCabinetAmkaDriver
from api.services.marketing_cabinet.amka_service import AmkaService


@pytest.mark.unit
def test_serialize_marketing_amka_core_alignment_shape() -> None:
    run_id = uuid4()
    user_id = uuid4()
    subject = MarketingCabinetAmkaDriver.subject_for_run(run_id=run_id, user_id=user_id, project_id=None)
    result = AmkaRunResult(
        status=AmkaCoreRunStatus.AWAITING_APPROVAL,
        subject=subject,
        snapshot=AmkaSnapshot(subject=subject),
        tasks=(AmkaPlanTask(task_key="a", title="Alpha"),),
        policy=AmkaPolicyDecision(allowed=False, mode="semi_auto", reason="gate"),
        pulse=AmkaPulseArtifact(summary="pulse", preserved=("db",)),
        traces=(AmkaTraceEvent(stage=AmkaCoreStage.PLAN, event="plan.ready", message="ok"),),
    )
    out = serialize_marketing_amka_core_alignment(result)
    assert out["status"] == "awaiting_approval"
    assert out["task_count"] == 1
    assert out["pulse"]["summary"] == "pulse"
    assert out["policy"]["mode"] == "semi_auto"
    assert out["projection"]["status"] == "awaiting_approval"
    assert out["task_preview"][0]["task_key"] == "a"
    assert out["traces"][0]["event"] == "plan.ready"
    assert out["traces"][0]["stage"] == "plan"


@pytest.mark.unit
def test_marketing_driver_plan_maps_persisted_master_plan() -> None:
    async def _run() -> None:
        driver = object.__new__(MarketingCabinetAmkaDriver)
        user_id = uuid4()
        run_id = uuid4()
        subject = AmkaSubjectRef(
            driver_key="marketing_cabinet",
            domain_profile="marketing",
            subject_id=str(run_id),
            metadata={"user_id": str(user_id), "use_persisted_master_plan": "true"},
        )
        raw = {
            "run": {
                "master_plan": [
                    {
                        "plan_task_uid": "t1",
                        "title": "Task one",
                        "operations": [],
                        "section_key": "analysis",
                    },
                ],
            },
            "run_mode": "semi_auto",
        }
        snap = AmkaSnapshot(subject=subject, metadata={"raw_snapshot": raw, "run_mode": "semi_auto"})
        tasks = await MarketingCabinetAmkaDriver.plan(driver, subject, snap)
        assert len(tasks) == 1
        assert tasks[0].task_key == "t1"
        assert tasks[0].title == "Task one"

    asyncio.run(_run())


@pytest.mark.integration
def test_core_alignment_router_validates_payload() -> None:
    user_id = uuid4()
    app = FastAPI()
    app.include_router(amka_router, prefix="/api/v1/marketing-cabinet")

    fake_pool = MagicMock()

    async def override_pool() -> MagicMock:
        return fake_pool

    async def override_user() -> UUID:
        return user_id

    app.dependency_overrides[get_marketing_db_pool] = override_pool
    app.dependency_overrides[get_marketing_user_id] = override_user

    sample = {
        "status": "awaiting_approval",
        "pulse": {"summary": "s"},
        "policy": {"allowed": False},
        "projection": {"status": "awaiting_approval"},
        "observations": {},
        "task_preview": [],
        "task_count": 0,
    }
    run_row = {
        "project_id": str(uuid4()),
        "updated_at": "2026-01-01T00:00:00+00:00",
        "status": "planning",
    }
    with (
        patch.object(AmkaService, "_get_run_checked", new=AsyncMock(return_value=run_row)),
        patch(
            "api.routers.marketing_cabinet.amka.build_marketing_amka_core_alignment",
            new=AsyncMock(return_value=sample),
        ),
    ):
        client = TestClient(app)
        run_id = uuid4()
        r = client.get(f"/api/v1/marketing-cabinet/amka/runs/{run_id}/core-alignment")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "awaiting_approval"
    assert r.headers.get("etag")
    assert r.headers.get("cache-control", "").startswith("private")


@pytest.mark.integration
def test_core_alignment_router_304_skips_payload_build() -> None:
    user_id = uuid4()
    app = FastAPI()
    app.include_router(amka_router, prefix="/api/v1/marketing-cabinet")

    fake_pool = MagicMock()

    async def override_pool() -> MagicMock:
        return fake_pool

    async def override_user() -> UUID:
        return user_id

    app.dependency_overrides[get_marketing_db_pool] = override_pool
    app.dependency_overrides[get_marketing_user_id] = override_user

    run_row = {
        "project_id": str(uuid4()),
        "updated_at": "2026-02-01T12:00:00+00:00",
        "status": "completed",
    }
    build_mock = AsyncMock(
        return_value={
            "status": "completed",
            "pulse": {},
            "policy": {},
            "projection": {"status": "completed", "driver_key": "marketing_cabinet", "domain_profile": "marketing"},
            "observations": {},
            "task_preview": [],
            "task_count": 0,
        }
    )
    with (
        patch.object(AmkaService, "_get_run_checked", new=AsyncMock(return_value=run_row)),
        patch(
            "api.routers.marketing_cabinet.amka.build_marketing_amka_core_alignment",
            new=build_mock,
        ),
    ):
        client = TestClient(app)
        run_id = uuid4()
        r1 = client.get(f"/api/v1/marketing-cabinet/amka/runs/{run_id}/core-alignment")
        etag = r1.headers["etag"]
        r2 = client.get(
            f"/api/v1/marketing-cabinet/amka/runs/{run_id}/core-alignment",
            headers={"If-None-Match": etag},
        )

    assert r1.status_code == 200
    assert r2.status_code == 304
    assert build_mock.await_count == 1


@pytest.mark.unit
def test_marketing_driver_act_respects_policy_denied() -> None:
    async def _run() -> None:
        driver = object.__new__(MarketingCabinetAmkaDriver)
        driver._service = MagicMock()
        uid, rid = uuid4(), uuid4()
        subject = AmkaSubjectRef(
            driver_key="marketing_cabinet",
            domain_profile="marketing",
            subject_id=str(rid),
            metadata={"user_id": str(uid), "amka_core_act_operation": "approve"},
        )
        task = AmkaPlanTask(task_key="t1", title="T")
        decision = AmkaPolicyDecision(allowed=False, mode="semi_auto", reason="x")
        out = await MarketingCabinetAmkaDriver.act(driver, subject, task, decision)
        assert out["executed"] is False
        assert out["reason"] == "policy_not_allowed"
        driver._service.approve_run.assert_not_called()

    asyncio.run(_run())


@pytest.mark.unit
def test_marketing_driver_act_opt_in_calls_approve() -> None:
    async def _run() -> None:
        driver = object.__new__(MarketingCabinetAmkaDriver)
        driver._service = MagicMock()
        driver._service.approve_run = AsyncMock(return_value={"run": {"id": "a"}})
        uid, rid = uuid4(), uuid4()
        subject = AmkaSubjectRef(
            driver_key="marketing_cabinet",
            domain_profile="marketing",
            subject_id=str(rid),
            metadata={
                "user_id": str(uid),
                "amka_core_act_operation": "approve",
                "amka_core_act_skip_section_keys": "overview, tasks",
            },
        )
        task = AmkaPlanTask(task_key="t1", title="T")
        decision = AmkaPolicyDecision(allowed=True, mode="auto")
        out = await MarketingCabinetAmkaDriver.act(driver, subject, task, decision)
        assert out["executed"] is True
        assert out["amka_core_act_operation"] == "approve"
        driver._service.approve_run.assert_awaited_once_with(
            run_id=rid,
            user_id=uid,
            skip_section_keys=["overview", "tasks"],
            skip_operation_keys=None,
            skip_step_ids=None,
        )

    asyncio.run(_run())
