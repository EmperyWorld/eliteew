# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Build companion_meta_v1 delta from active plan bundle.
# Related:
# - api/ewa_platform/companion/plans/meta_tick.py
# ---

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.companion.plans.meta_tick import build_companion_meta_delta


@pytest.mark.unit
def test_build_meta_delta_from_active_plan(monkeypatch: pytest.MonkeyPatch) -> None:
    bundle = {
        "plan": {"id": "plan-abc", "title": "T"},
        "tasks": [
            {"title": "A", "status": "pending"},
            {"title": "B", "status": "completed"},
        ],
    }
    monkeypatch.setattr(
        "api.ewa_platform.companion.plans.meta_tick.plans_pg.plan_get_active",
        AsyncMock(return_value=bundle),
    )
    out = asyncio.run(build_companion_meta_delta(object(), principal_id="p1"))
    assert out is not None
    meta = out["companion_meta_v1"]
    assert meta["last_plan_id"] == "plan-abc"
    assert meta["goals_digest"] == ["A"]
