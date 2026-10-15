# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for shared admin RBAC dependency helpers.
# Invariants:
# - Generic admin guard allows `admin` and `emperyworld_admin`.
# - Strict guard allows only `emperyworld_admin`.
# Related:
# - api/routers/admin_auth.py
# ---

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from api.routers.admin_auth import require_admin_user, require_emperyworld_admin


@pytest.mark.asyncio
async def test_require_admin_user_allows_admin_and_emperyworld_admin() -> None:
    admin = SimpleNamespace(role="admin")
    ew_admin = SimpleNamespace(role="emperyworld_admin")
    assert await require_admin_user(admin) is admin
    assert await require_admin_user(ew_admin) is ew_admin


@pytest.mark.asyncio
async def test_require_admin_user_rejects_non_admin() -> None:
    with pytest.raises(HTTPException) as exc:
        await require_admin_user(SimpleNamespace(role="member"))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_emperyworld_admin_rejects_plain_admin() -> None:
    with pytest.raises(HTTPException) as exc:
        await require_emperyworld_admin(SimpleNamespace(role="admin"))
    assert exc.value.status_code == 403
