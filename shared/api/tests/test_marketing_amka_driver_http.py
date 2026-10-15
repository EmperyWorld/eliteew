# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Ensures HTTP delegation helpers unwrap `MarketingCabinetAmkaDriver.act()` results correctly.
# Invariants:
# - Does not open a database; patches `act` on the driver class.
# Related:
# - shared/api/services/amka_core/marketing_driver_http.py
# ---
from __future__ import annotations

import asyncio
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest

from api.services.amka_core.marketing_driver import MarketingCabinetAmkaDriver
from api.services.amka_core.marketing_driver_http import marketing_amka_driver_act_for_http


@pytest.mark.unit
def test_marketing_amka_driver_act_for_http_unwraps_service_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    expected = {"ok": True, "run": {"id": str(uuid4())}}

    async def _fake_act(self, subject, task, decision):  # noqa: ANN001
        assert subject.metadata.get("amka_core_act_operation") == "approve"
        assert "user_id" in subject.metadata
        return {"executed": True, "amka_service_result": expected}

    monkeypatch.setattr(MarketingCabinetAmkaDriver, "act", _fake_act)

    async def _run() -> None:
        pool = MagicMock()
        out = await marketing_amka_driver_act_for_http(
            pool,
            run_id=UUID("00000000-0000-4000-8000-000000000001"),
            user_id=UUID("00000000-0000-4000-8000-000000000002"),
            operation="approve",
            skip_section_keys=["value"],
        )
        assert out == expected

    asyncio.run(_run())


@pytest.mark.unit
def test_marketing_amka_driver_act_for_http_passes_cancel_operation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    expected = {"ok": True, "run": {"status": "cancelled"}}

    async def _fake_act(self, subject, task, decision):  # noqa: ANN001
        assert subject.metadata.get("amka_core_act_operation") == "cancel"
        return {"executed": True, "amka_service_result": expected}

    monkeypatch.setattr(MarketingCabinetAmkaDriver, "act", _fake_act)

    async def _run() -> None:
        out = await marketing_amka_driver_act_for_http(
            MagicMock(),
            run_id=UUID("00000000-0000-4000-8000-000000000001"),
            user_id=UUID("00000000-0000-4000-8000-000000000002"),
            operation="cancel",
        )
        assert out == expected

    asyncio.run(_run())
