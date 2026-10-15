# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Auth locks for service-token mutation gate (KBSEW_SERVICE_CAN_MUTATE).
# Related:
# - api/core/auth.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from api.core import auth as auth_mod
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_service_mutate_denied_when_flag_off(monkeypatch: pytest.MonkeyPatch) -> None:
    class S:
        kbsew_internal_service_token = "tok"
        kbsew_service_can_mutate = False

    monkeypatch.setattr(auth_mod, "get_settings", lambda: S())
    monkeypatch.setattr(auth_mod, "require_admin_user", AsyncMock(side_effect=HTTPException(status_code=401, detail="Missing bearer token")))
    with pytest.raises(HTTPException) as ei:
        await auth_mod.require_admin_or_service_mutate(credentials=None, service_token="tok")
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_service_mutate_ok_when_flag_on(monkeypatch: pytest.MonkeyPatch) -> None:
    class S:
        kbsew_internal_service_token = "tok"
        kbsew_service_can_mutate = True

    monkeypatch.setattr(auth_mod, "get_settings", lambda: S())
    user = await auth_mod.require_admin_or_service_mutate(credentials=None, service_token="tok")
    assert user.role == auth_mod.ROLE_SERVICE
    assert user.sub == "internal-service"
