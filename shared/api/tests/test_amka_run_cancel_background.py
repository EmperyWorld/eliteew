# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for `cancel_run` cancelling plan/execute tasks and pending `amka-auto-chain:*` tasks.
# Invariants:
# - No database; uses in-process `AMKA_BACKGROUND_TASKS` registry.
# Related:
# - shared/api/services/marketing_cabinet/amka_run_lifecycle.py
# - shared/api/services/marketing_cabinet/amka_background_tasks.py
# ---
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.services.marketing_cabinet import amka_background_tasks as amka_bg
from api.services.marketing_cabinet.amka_background_task_keys import (
    amka_auto_chain_task_key,
    amka_exec_task_key,
    amka_plan_task_key,
)
from api.services.marketing_cabinet.amka_run_lifecycle import cancel_run


class _FakeTask:
    def __init__(self, key: str) -> None:
        self.key = key
        self._done = False

    def done(self) -> bool:
        return self._done

    def cancel(self) -> None:
        self._done = True


@pytest.mark.unit
def test_cancel_run_cancels_plan_exec_and_auto_chain_tasks() -> None:
    run_id = uuid4()
    uid = uuid4()

    amka_bg.AMKA_BACKGROUND_TASKS.clear()
    try:

        async def _run() -> None:
            plan_k = amka_plan_task_key(run_id)
            exec_k = amka_exec_task_key(run_id)
            chain_k = amka_auto_chain_task_key(run_id=run_id, unique_suffix="sfx")

            plan_t = _FakeTask(plan_k)
            exec_t = _FakeTask(exec_k)
            chain_t = _FakeTask(chain_k)

            amka_bg.AMKA_BACKGROUND_TASKS[plan_k] = plan_t  # type: ignore[assignment]
            amka_bg.AMKA_BACKGROUND_TASKS[exec_k] = exec_t  # type: ignore[assignment]
            amka_bg.AMKA_BACKGROUND_TASKS[chain_k] = chain_t  # type: ignore[assignment]

            svc = MagicMock()
            svc._get_run_checked = AsyncMock(
                return_value={"id": run_id, "project_id": str(uuid4()), "status": "running"}
            )
            svc._update_run = AsyncMock(
                return_value={
                    "id": run_id,
                    "status": "cancelled",
                }
            )

            out = await cancel_run(svc, run_id=run_id, user_id=uid)
            assert out["ok"] is True
            assert plan_t._done and exec_t._done and chain_t._done

        asyncio.run(_run())
    finally:
        amka_bg.AMKA_BACKGROUND_TASKS.clear()
