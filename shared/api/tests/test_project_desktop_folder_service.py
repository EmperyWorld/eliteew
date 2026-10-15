# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for ensure_project_desktop_folder idempotency contract.
# Invariants:
# — (нет)
# Related:
# - api/services/project_desktop_folder_service.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.services.project_desktop_folder_service import ensure_project_desktop_folder
from api.utils.project_desktop_folder import project_desktop_folder_item_id


@pytest.mark.asyncio
async def test_ensure_project_desktop_folder_skips_when_item_exists() -> None:
    db = AsyncMock()
    user_id = uuid4()
    project_id = uuid4()
    folder_item_id = project_desktop_folder_item_id(project_id)

    config = MagicMock()
    config.id = uuid4()

    config_result = MagicMock()
    config_result.scalar_one_or_none.return_value = config

    existing_result = MagicMock()
    existing_result.scalar_one_or_none.return_value = uuid4()

    db.execute = AsyncMock(side_effect=[config_result, existing_result])

    out = await ensure_project_desktop_folder(
        db,
        user_id=user_id,
        project_id=project_id,
        project_name="Plasma Fitness",
    )

    assert out == folder_item_id
    assert db.execute.await_count == 2


@pytest.mark.asyncio
async def test_ensure_project_desktop_folder_inserts_when_missing() -> None:
    db = AsyncMock()
    user_id = uuid4()
    project_id = uuid4()
    folder_item_id = project_desktop_folder_item_id(project_id)

    config = MagicMock()
    config.id = uuid4()

    config_result = MagicMock()
    config_result.scalar_one_or_none.return_value = config

    missing_result = MagicMock()
    missing_result.scalar_one_or_none.return_value = None

    db.execute = AsyncMock(side_effect=[config_result, missing_result, MagicMock()])

    out = await ensure_project_desktop_folder(
        db,
        user_id=user_id,
        project_id=project_id,
        project_name="  ",
    )

    assert out == folder_item_id
    assert db.execute.await_count == 3
    db.flush.assert_awaited_once()
