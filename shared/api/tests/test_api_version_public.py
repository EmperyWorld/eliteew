#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit contract for public ``/api/version`` disclosure (no env/clock).
# Invariants:
# - No network; patches get_server_app_build_id only.
# Related:
# - api/routers/version.py
# ---
"""Public /api/version payload shape tests."""

from __future__ import annotations

from unittest.mock import patch

import pytest


@pytest.mark.asyncio
async def test_get_version_omits_environment_and_build_time() -> None:
    from api.routers.version import get_version

    with patch(
        "api.services.client_build_service.get_server_app_build_id",
        return_value="test-build-id",
    ):
        body = await get_version()
    assert set(body.keys()) == {"version", "buildHash", "appBuildId"}
    assert body["appBuildId"] == "test-build-id"
    assert "environment" not in body
    assert "buildTime" not in body
