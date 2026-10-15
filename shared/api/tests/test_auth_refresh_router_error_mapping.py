#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Verifies legacy /api/auth/refresh router preserves HTTPException and maps unexpected failures to 503.
# Invariants:
# - Tests call router function directly without network.
# Related:
# - api.routers.auth_refresh.auth_refresh; api.core.auth_errors
# ---
"""Tests for auth_refresh router error mapping."""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException, status

from api.core.auth_errors import AUTH_ACTION_REFRESH, AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE
from api.routers.auth_refresh import RefreshRequest, auth_refresh


async def _auth_refresh_unexpected_error_maps_to_503() -> None:
    class _FailingProvider:
        async def refresh_token(self, _refresh_token: str):  # type: ignore[no-untyped-def]
            raise RuntimeError("keycloak unavailable")

    with pytest.raises(HTTPException) as ei:
        await auth_refresh(RefreshRequest(refresh_token="rt"), _FailingProvider())

    assert ei.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert isinstance(ei.value.detail, dict)
    assert ei.value.detail["reason"] == AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE
    assert ei.value.detail["action"] == AUTH_ACTION_REFRESH


def test_auth_refresh_unexpected_error_maps_to_503() -> None:
    asyncio.run(_auth_refresh_unexpected_error_maps_to_503())
