# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract-style tests for `UgsAdminAmkaDriver` without Marketing Cabinet tables or marketing DB fixtures.
# Invariants:
# - Uses a stub routing service implementing `get_model_routes()` only.
# Related:
# - shared/api/services/amka_core/ugs_admin_amka_driver.py
# - documentation/product/amka-seed-album/RFC-001-amka-driver-contract.md
# ---
from __future__ import annotations

import asyncio

import pytest

from api.schemas.ugs_admin import UgsAdminV2ModelRoutes
from api.services.amka_core import AmkaCoreEngine, AmkaCoreRunStatus, AmkaSubjectRef
from api.services.amka_core.ugs_admin_amka_driver import UgsAdminAmkaDriver
from api.services.amka_core.ugs_amka_bridge import ugs_amka_subject


class _StubUGSModelRoutingService:
    def __init__(self, routes: UgsAdminV2ModelRoutes) -> None:
        self._routes = routes

    async def get_model_routes(self) -> UgsAdminV2ModelRoutes:
        return self._routes


@pytest.mark.unit
def test_ugs_admin_driver_core_run_no_tasks_when_global_default_set() -> None:
    async def _run() -> None:
        routes = UgsAdminV2ModelRoutes(global_default_model="openai/gpt-4o-mini")
        driver = UgsAdminAmkaDriver(_StubUGSModelRoutingService(routes))
        subject = ugs_amka_subject()
        result = await AmkaCoreEngine(driver).run_once(subject, execute=False)
        assert result.status == AmkaCoreRunStatus.COMPLETED
        assert result.tasks == ()
        assert result.snapshot is not None
        assert result.snapshot.health["has_global_default_model"] is True
        assert result.pulse is not None

    asyncio.run(_run())


@pytest.mark.unit
def test_ugs_admin_driver_plans_task_when_global_default_missing() -> None:
    async def _run() -> None:
        routes = UgsAdminV2ModelRoutes(global_default_model=None)
        driver = UgsAdminAmkaDriver(_StubUGSModelRoutingService(routes))
        subject = ugs_amka_subject()
        result = await AmkaCoreEngine(driver).run_once(subject, execute=False)
        assert result.status == AmkaCoreRunStatus.AWAITING_APPROVAL
        assert len(result.tasks) == 1
        assert result.tasks[0].task_key == "ugs-routing-global-default"

    asyncio.run(_run())


@pytest.mark.unit
def test_ugs_admin_driver_act_is_read_only() -> None:
    async def _run() -> None:
        from api.services.amka_core.contracts import AmkaPlanTask, AmkaPolicyDecision

        routes = UgsAdminV2ModelRoutes()
        driver = UgsAdminAmkaDriver(_StubUGSModelRoutingService(routes))
        subject = AmkaSubjectRef(
            driver_key=UgsAdminAmkaDriver.driver_key,
            domain_profile=UgsAdminAmkaDriver.domain_profile,
            subject_id="global",
            display_name="x",
        )
        task = AmkaPlanTask(task_key="t", title="t")
        decision = AmkaPolicyDecision(allowed=True, mode="auto", reason="test")
        out = await driver.act(subject, task, decision)
        assert out.get("executed") is False

    asyncio.run(_run())
