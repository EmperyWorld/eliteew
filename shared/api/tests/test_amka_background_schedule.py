# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for marketing AMKA background scheduling via `MarketingCabinetAmkaDriver` (wave 19 parity).
# Invariants:
# - No database; patches `_spawn_background` or driver methods.
# Related:
# - shared/api/services/amka_core/marketing_driver.py
# - shared/api/services/marketing_cabinet/amka_driver_background_schedule.py
# - documentation/product/amka-seed-album/AMKA-BACKGROUND-TASK-KEYS.md
# ---
from __future__ import annotations

import asyncio
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest

from api.services.amka_core.marketing_driver import MarketingCabinetAmkaDriver
from api.services.marketing_cabinet.amka_background_task_keys import (
    amka_auto_chain_task_key,
    amka_exec_task_key,
    amka_plan_task_key,
)
from api.services.marketing_cabinet.amka_driver_background_schedule import (
    schedule_marketing_amka_auto_chain_background,
)


@pytest.mark.unit
def test_amka_background_task_key_helpers() -> None:
    rid = uuid4()
    s = str(rid)
    assert amka_plan_task_key(rid) == f"amka-plan:{s}"
    assert amka_exec_task_key(rid) == f"amka-exec:{s}"
    assert amka_auto_chain_task_key(run_id=rid, unique_suffix="abc") == f"amka-auto-chain:{s}:abc"


@pytest.mark.unit
def test_marketing_driver_schedule_auto_chain_uses_spawn_with_prefix(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    def _fake_spawn(key: str, coro: object) -> None:  # noqa: ANN401
        captured["key"] = key
        captured["coro"] = coro

    monkeypatch.setattr(
        "api.services.marketing_cabinet.amka_background_tasks._spawn_background",
        _fake_spawn,
    )

    calls: list[tuple[UUID, UUID]] = []

    async def _noop(*, prev_run_id: UUID, user_id: UUID) -> None:
        calls.append((prev_run_id, user_id))

    svc = MagicMock()
    svc._maybe_start_next_auto_amka_cycle = _noop
    monkeypatch.setattr(
        "api.services.amka_core.marketing_driver.AmkaService",
        lambda _pool: svc,
    )

    pool = MagicMock()
    drv = MarketingCabinetAmkaDriver(pool)
    prev = UUID("00000000-0000-4000-8000-000000000099")
    uid = UUID("00000000-0000-4000-8000-000000000088")
    drv.schedule_background_auto_chain(prev_run_id=prev, user_id=uid)

    key = str(captured["key"])
    assert key.startswith(f"amka-auto-chain:{prev}:")
    asyncio.run(captured["coro"])  # type: ignore[arg-type]
    assert calls == [(prev, uid)]


@pytest.mark.unit
def test_schedule_marketing_amka_auto_chain_delegates_to_driver(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[UUID, UUID]] = []

    def _fake(self, *, prev_run_id: UUID, user_id: UUID) -> None:  # noqa: ANN001
        calls.append((prev_run_id, user_id))

    monkeypatch.setattr(MarketingCabinetAmkaDriver, "schedule_background_auto_chain", _fake)

    pool = MagicMock()
    prev = UUID("00000000-0000-4000-8000-000000000077")
    uid = UUID("00000000-0000-4000-8000-000000000066")
    schedule_marketing_amka_auto_chain_background(pool, prev_run_id=prev, user_id=uid)
    assert calls == [(prev, uid)]
