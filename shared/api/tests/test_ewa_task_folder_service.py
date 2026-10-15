# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for ensure_ewa_task_folder nesting under EwaFile.
# Related:
# - api/services/ewa_task_folder_service.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from api.services.ewa_task_folder_service import ensure_ewa_task_folder
from api.utils.ewa_task_folder import ewa_task_folder_item_id


@pytest.mark.asyncio
async def test_ensure_ewa_task_folder_skips_when_item_exists() -> None:
    db = AsyncMock()
    user_id = uuid4()
    task_key = str(uuid4())
    folder_item_id = ewa_task_folder_item_id(task_key)

    config = MagicMock()
    config.id = uuid4()

    config_result = MagicMock()
    config_result.scalar_one_or_none.return_value = config

    parent_result = MagicMock()
    parent_row = MagicMock()
    parent_row.id = uuid4()
    parent_result.scalar_one_or_none.return_value = parent_row

    existing_result = MagicMock()
    existing_result.scalar_one_or_none.return_value = uuid4()

    db.execute = AsyncMock(side_effect=[config_result, parent_result, existing_result])

    with patch(
        "api.services.ewa_task_folder_service.ensure_system_folders",
        new=AsyncMock(),
    ):
        out = await ensure_ewa_task_folder(
            db,
            user_id=user_id,
            task_key=task_key,
            folder_label="My task",
        )

    assert out == folder_item_id
    assert db.execute.await_count == 3


@pytest.mark.asyncio
async def test_ensure_ewa_task_folder_inserts_when_missing() -> None:
    db = AsyncMock()
    user_id = uuid4()
    task_key = "sess-abc"
    folder_item_id = ewa_task_folder_item_id(task_key)

    config = MagicMock()
    config.id = uuid4()

    config_result = MagicMock()
    config_result.scalar_one_or_none.return_value = config

    parent_result = MagicMock()
    parent_row = MagicMock()
    parent_row.id = uuid4()
    parent_result.scalar_one_or_none.return_value = parent_row

    missing_result = MagicMock()
    missing_result.scalar_one_or_none.return_value = None

    db.execute = AsyncMock(side_effect=[config_result, parent_result, missing_result, MagicMock()])

    with patch(
        "api.services.ewa_task_folder_service.ensure_system_folders",
        new=AsyncMock(),
    ):
        out = await ensure_ewa_task_folder(
            db,
            user_id=user_id,
            task_key=task_key,
            folder_label="Отчёт",
        )

    assert out == folder_item_id
    assert db.execute.await_count == 4
    db.flush.assert_awaited_once()
