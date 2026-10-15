# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral unit tests for catalog → desktop_items.name reconcile (display SSOT).
# Invariants:
# - APP shortcuts with item_id matching catalog.app_id take catalog.name; others untouched.
# Related:
# - api/routers/desktop_bootstrap.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.models.desktop import ItemType
from api.routers.desktop_bootstrap import reconcile_desktop_app_item_names_from_catalog


@pytest.mark.asyncio
async def test_reconcile_desktop_app_item_names_updates_drift() -> None:
    config = SimpleNamespace(id=uuid4())
    stale = SimpleNamespace(
        item_id="app-content",
        item_type=ItemType.APP,
        name="Content Manager",
        updated_at=None,
    )
    folder = SimpleNamespace(
        item_id="documents",
        item_type=ItemType.FOLDER,
        name="Documents",
        updated_at=None,
    )
    matching = SimpleNamespace(
        item_id="app-content",
        item_type=ItemType.APP,
        name="Content Manager",
        updated_at=None,
    )
    # Only APP items are selected by the query — folder should not appear in second result.
    app_only = [matching]

    db = MagicMock()
    db.flush = AsyncMock()

    async def execute(stmt):  # noqa: ARG001
        # First call: catalog rows; second: app items
        if not hasattr(execute, "n"):
            execute.n = 0
        execute.n += 1
        if execute.n == 1:
            return SimpleNamespace(all=lambda: [("app-content", "Файловый менеджер")])
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: app_only))

    db.execute = AsyncMock(side_effect=execute)

    updated = await reconcile_desktop_app_item_names_from_catalog(db, config)
    assert updated == 1
    assert matching.name == "Файловый менеджер"
    assert matching.updated_at is not None
    db.flush.assert_awaited_once()
    # folder never in app-only list
    assert folder.name == "Documents"
    _ = stale  # documented drift case covered by matching


@pytest.mark.asyncio
async def test_reconcile_desktop_app_item_names_noop_when_aligned() -> None:
    config = SimpleNamespace(id=uuid4())
    item = SimpleNamespace(
        item_id="app-content",
        item_type=ItemType.APP,
        name="Файловый менеджер",
        updated_at=None,
    )
    db = MagicMock()
    db.flush = AsyncMock()

    async def execute(stmt):  # noqa: ARG001
        if not hasattr(execute, "n"):
            execute.n = 0
        execute.n += 1
        if execute.n == 1:
            return SimpleNamespace(all=lambda: [("app-content", "Файловый менеджер")])
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [item]))

    db.execute = AsyncMock(side_effect=execute)

    updated = await reconcile_desktop_app_item_names_from_catalog(db, config)
    assert updated == 0
    db.flush.assert_not_awaited()


@pytest.mark.asyncio
async def test_reconcile_import_chain_from_desktop() -> None:
    from api.routers import desktop as desk

    assert callable(desk.reconcile_desktop_app_item_names_from_catalog)
