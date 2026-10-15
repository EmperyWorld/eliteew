# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract-style tests for `UgsAdminGenerationInventoryAmkaDriver` without live DB or Admin v2 I/O.
# Invariants:
# - Patches `build_snapshot` at `api.services.ugs.admin_v2_service`.
# Related:
# - shared/api/services/amka_core/ugs_generation_inventory_amka_driver.py
# - documentation/product/amka-seed-album/RFC-001-amka-driver-contract.md
# ---
from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.schemas.ugs_admin import (
    AdminGenerationTypeResponse,
    GenerationProviderResponse,
    UgsAdminV2SnapshotResponse,
    UgsAdminV2ValidationIssue,
    UGSSettingListResponse,
)
from api.services.amka_core import AmkaCoreEngine, AmkaCoreRunStatus
from api.services.amka_core.contracts import AmkaPlanTask, AmkaPolicyDecision
from api.services.amka_core.ugs_amka_bridge import ugs_generation_inventory_amka_subject
from api.services.amka_core.ugs_generation_inventory_amka_driver import UgsAdminGenerationInventoryAmkaDriver


def _snapshot(
    *,
    providers: list[GenerationProviderResponse],
    types: list[AdminGenerationTypeResponse],
    issues: list[UgsAdminV2ValidationIssue],
) -> UgsAdminV2SnapshotResponse:
    return UgsAdminV2SnapshotResponse(
        providers=providers,
        types=types,
        workflows=[],
        settings=UGSSettingListResponse(items=[], total=0),
        issues=issues,
        generated_at=datetime.now(UTC),
    )


def _provider(name: str = "p1") -> GenerationProviderResponse:
    return GenerationProviderResponse(
        id=uuid4(),
        provider_name=name,
        provider_type="openai_compatible",
    )


def _type_row(key: str = "t1", provider: str = "p1") -> AdminGenerationTypeResponse:
    return AdminGenerationTypeResponse(
        id=uuid4(),
        type_key=key,
        category="image",
        display_name=key,
        provider=provider,
    )


@pytest.mark.unit
def test_generation_inventory_driver_completed_when_clean() -> None:
    async def _run() -> None:
        snap = _snapshot(
            providers=[_provider()],
            types=[_type_row()],
            issues=[],
        )
        db = MagicMock(spec=AsyncSession)
        driver = UgsAdminGenerationInventoryAmkaDriver(db)
        subject = ugs_generation_inventory_amka_subject()
        with patch("api.services.ugs.admin_v2_service.build_snapshot", new_callable=AsyncMock, return_value=snap):
            result = await AmkaCoreEngine(driver).run_once(subject, execute=False)

        assert result.status == AmkaCoreRunStatus.COMPLETED
        assert result.tasks == ()
        assert result.snapshot is not None
        assert result.snapshot.health["validation_error_count"] == 0
        assert result.pulse is not None

    asyncio.run(_run())


@pytest.mark.unit
def test_generation_inventory_driver_plans_on_validation_errors() -> None:
    async def _run() -> None:
        snap = _snapshot(
            providers=[_provider()],
            types=[_type_row()],
            issues=[
                UgsAdminV2ValidationIssue(
                    severity="error",
                    entity_type="provider",
                    entity_id="p1",
                    message="broken",
                ),
            ],
        )
        db = MagicMock(spec=AsyncSession)
        driver = UgsAdminGenerationInventoryAmkaDriver(db)
        subject = ugs_generation_inventory_amka_subject()
        with patch("api.services.ugs.admin_v2_service.build_snapshot", new_callable=AsyncMock, return_value=snap):
            result = await AmkaCoreEngine(driver).run_once(subject, execute=False)

        assert result.status == AmkaCoreRunStatus.AWAITING_APPROVAL
        assert len(result.tasks) == 1
        assert result.tasks[0].task_key == "ugs-inventory-validation-errors"

    asyncio.run(_run())


@pytest.mark.unit
def test_generation_inventory_driver_missing_providers_plan() -> None:
    async def _run() -> None:
        snap = _snapshot(providers=[], types=[_type_row()], issues=[])
        db = MagicMock(spec=AsyncSession)
        driver = UgsAdminGenerationInventoryAmkaDriver(db)
        subject = ugs_generation_inventory_amka_subject()
        with patch("api.services.ugs.admin_v2_service.build_snapshot", new_callable=AsyncMock, return_value=snap):
            result = await AmkaCoreEngine(driver).run_once(subject, execute=False)

        assert result.status == AmkaCoreRunStatus.AWAITING_APPROVAL
        assert result.tasks[0].task_key == "ugs-inventory-missing-providers"

    asyncio.run(_run())


@pytest.mark.unit
def test_generation_inventory_driver_warnings_when_providers_exist() -> None:
    async def _run() -> None:
        snap = _snapshot(
            providers=[_provider()],
            types=[_type_row()],
            issues=[
                UgsAdminV2ValidationIssue(
                    severity="warning",
                    entity_type="type",
                    entity_id="t1",
                    message="check routing",
                ),
            ],
        )
        db = MagicMock(spec=AsyncSession)
        driver = UgsAdminGenerationInventoryAmkaDriver(db)
        subject = ugs_generation_inventory_amka_subject()
        with patch("api.services.ugs.admin_v2_service.build_snapshot", new_callable=AsyncMock, return_value=snap):
            result = await AmkaCoreEngine(driver).run_once(subject, execute=False)

        assert result.tasks[0].task_key == "ugs-inventory-validation-warnings"

    asyncio.run(_run())


@pytest.mark.unit
def test_generation_inventory_driver_act_is_read_only() -> None:
    async def _run() -> None:
        db = MagicMock(spec=AsyncSession)
        driver = UgsAdminGenerationInventoryAmkaDriver(db)
        subject = ugs_generation_inventory_amka_subject()
        task = AmkaPlanTask(task_key="t", title="t")
        decision = AmkaPolicyDecision(allowed=True, mode="auto", reason="test")
        out = await driver.act(subject, task, decision)
        assert out.get("executed") is False

    asyncio.run(_run())
