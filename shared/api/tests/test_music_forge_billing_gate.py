# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Layer C billing/quota gate without noop monkeypatch of the gate itself.
# Invariants:
# - Missing generation type → 503; BillingService ValueError → 402; budget exceed → 429.
# - Admin role bypasses budget only.
# Related:
# - api/services/music_forge/billing_gate.py
# ---
"""MusicForge BillingGate contract tests (Phase 2)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from api.services.music_forge.billing_gate import MusicForgeBillingGate
from api.services.music_forge.config.types import MusicForgeConfigBundle


class _Repo:
    def __init__(self, day: int = 0, month: int = 0) -> None:
        self._day = day
        self._month = month

    async def _count_completed_runs_for_user(self, *, user_id: str, window_hours: int) -> int:
        return self._day if window_hours <= 24 else self._month


@pytest.mark.asyncio
async def test_preflight_402_on_billing_value_error(monkeypatch: pytest.MonkeyPatch) -> None:
    gate = MusicForgeBillingGate(AsyncMock(), repo=_Repo())  # type: ignore[arg-type]

    async def _get_by_key(self: object, key: str) -> SimpleNamespace:
        return SimpleNamespace(cost_credits=10.0, type_key=key)

    monkeypatch.setattr(
        "api.services.ugs.generation_type_service.GenerationTypeService.get_by_key",
        _get_by_key,
    )

    async def _check_limits(self: object, *_a: object, **_k: object) -> None:
        raise ValueError("insufficient credits")

    monkeypatch.setattr(
        "api.services.ugs.billing_service.BillingService.check_limits",
        _check_limits,
    )
    with pytest.raises(HTTPException) as exc:
        await gate.preflight_credits(user_id="u1", audio_type_key="music_generator_forge_audio")
    assert exc.value.status_code == 402


@pytest.mark.asyncio
async def test_budget_429_for_member(monkeypatch: pytest.MonkeyPatch) -> None:
    gate = MusicForgeBillingGate(AsyncMock(), repo=_Repo(day=5))  # type: ignore[arg-type]
    bundle = MusicForgeConfigBundle(
        lanes={"sft": {"is_default": True}},
        styles={"pop": {}},
        prompts={"blueprint": {}, "lyrics": {}, "style": {}},
        product={"max_completed_runs_per_day": 3, "max_completed_runs_per_month": None},
        version="t",
    )
    monkeypatch.setattr(
        "api.services.music_forge.billing_gate.MusicForgeConfigGateway.get_active",
        AsyncMock(return_value=bundle),
    )
    with pytest.raises(HTTPException) as exc:
        await gate.enforce_run_budget(user_id="u1", user_role="emperyworld_member")
    assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_budget_admin_bypass(monkeypatch: pytest.MonkeyPatch) -> None:
    gate = MusicForgeBillingGate(AsyncMock(), repo=_Repo(day=99))  # type: ignore[arg-type]
    bundle = MusicForgeConfigBundle(
        lanes={"sft": {"is_default": True}},
        styles={"pop": {}},
        prompts={"blueprint": {}, "lyrics": {}, "style": {}},
        product={"max_completed_runs_per_day": 1, "max_completed_runs_per_month": None},
        version="t",
    )
    monkeypatch.setattr(
        "api.services.music_forge.billing_gate.MusicForgeConfigGateway.get_active",
        AsyncMock(return_value=bundle),
    )
    await gate.enforce_run_budget(user_id="u1", user_role="admin")
