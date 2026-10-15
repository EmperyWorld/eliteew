# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for project vault lifecycle helpers (deleted project edit blocking).
# Invariants:
# — (нет)
# Related:
# - api/utils/project_vault_lifecycle.py
# ---

"""Project vault lifecycle helpers and deleted-project edit blocking."""

from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest

from api.utils.project_vault_lifecycle import (
    PROJECT_DELETED_VAULT_DETAIL,
    is_project_vault_active,
    resolve_owner_can_edit,
)


@pytest.mark.asyncio
async def test_is_project_vault_active_true_without_project_id() -> None:
    conn = AsyncMock()
    assert await is_project_vault_active(conn, None) is True
    conn.fetchval.assert_not_called()


@pytest.mark.asyncio
async def test_is_project_vault_active_false_when_project_deleted() -> None:
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=None)
    project_id = uuid4()
    assert await is_project_vault_active(conn, project_id) is False
    conn.fetchval.assert_awaited_once()


@pytest.mark.asyncio
async def test_resolve_owner_can_edit_false_for_owner_when_project_deleted() -> None:
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=None)
    owner_id = str(uuid4())
    project_id = uuid4()
    can_edit = await resolve_owner_can_edit(
        conn,
        owner_user_id=owner_id,
        viewer_user_id=owner_id,
        project_id=project_id,
    )
    assert can_edit is False


@pytest.mark.asyncio
async def test_resolve_owner_can_edit_false_for_non_owner() -> None:
    conn = AsyncMock()
    can_edit = await resolve_owner_can_edit(
        conn,
        owner_user_id=str(uuid4()),
        viewer_user_id=str(uuid4()),
        project_id=uuid4(),
    )
    assert can_edit is False
    conn.fetchval.assert_not_called()


@pytest.mark.asyncio
async def test_resolve_owner_can_edit_false_when_owner_lacks_vault_upload() -> None:
    """Owner of a project-vault file still needs lead or can_upload_project_vault."""
    owner_id = str(uuid4())
    project_id = uuid4()
    lead_id = uuid4()
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=1)  # project active
    conn.fetchrow = AsyncMock(
        side_effect=[
            {"created_by": lead_id},  # not the owner
            {"permissions": []},  # member without vault upload
        ]
    )
    can_edit = await resolve_owner_can_edit(
        conn,
        owner_user_id=owner_id,
        viewer_user_id=owner_id,
        project_id=project_id,
    )
    assert can_edit is False


@pytest.mark.asyncio
async def test_resolve_owner_can_edit_true_when_viewer_is_project_lead() -> None:
    owner_id = str(uuid4())
    project_id = uuid4()
    conn = AsyncMock()
    conn.fetchval = AsyncMock(return_value=1)
    conn.fetchrow = AsyncMock(return_value={"created_by": UUID(owner_id)})
    can_edit = await resolve_owner_can_edit(
        conn,
        owner_user_id=owner_id,
        viewer_user_id=owner_id,
        project_id=project_id,
    )
    assert can_edit is True


def test_project_deleted_vault_detail_is_russian_user_message() -> None:
    assert "удал" in PROJECT_DELETED_VAULT_DETAIL.lower()
