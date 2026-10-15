# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Router + store contract locks for EBrowser policy validation and default.
# Related:
# - api/routers/ebrowser.py
# - api/services/ebrowser/nav_policy.py
# - api/services/ebrowser/policy_store.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest

from api.services.ebrowser.nav_policy import validate_policy_for_save
from api.services.ebrowser.policy_store import (
    EBrowserPolicyValidationError,
    get_effective_policy,
)


def test_upsert_validation_error_codes() -> None:
    assert validate_policy_for_save("open", ["x.com"], []) == "open_mode_lists_forbidden"
    err = EBrowserPolicyValidationError("open_mode_lists_forbidden")
    assert err.code == "open_mode_lists_forbidden"


def test_ebrowser_router_paths_documented() -> None:
    from api.routers import ebrowser as mod

    paths = {getattr(r, "path", "") for r in mod.router.routes}
    assert "/ebrowser/policy" in paths
    assert any("admin/users" in p and "policy" in p for p in paths)


@pytest.mark.asyncio
async def test_get_effective_policy_missing_row_is_deny_all() -> None:
    db = MagicMock()
    db.get = AsyncMock(return_value=None)
    user_id = UUID("00000000-0000-4000-8000-0000000000aa")
    payload = await get_effective_policy(db, user_id)
    assert payload["is_default"] is True
    assert payload["mode"] == "allowlist"
    assert payload["allow"] == []
    assert payload["deny"] == []
    assert payload["user_id"] == str(user_id)
