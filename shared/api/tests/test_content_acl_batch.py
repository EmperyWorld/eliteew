# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral Layer C coverage for batch ACL prefetch (list/search/multi-get can_delete + access).
# Invariants:
# - Default-deny when share/friendship evidence is absent.
# - Prefetch helpers issue at most one shares query and one friendship query per page.
# Related:
# - api/services/unified_content/content_acl_batch.py
# - documentation/product/CONTENT-MANAGER.md
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.services.unified_content.content_acl_batch import (
    content_accessible_with_prefetch,
    prefetch_acl_sets_for_rows,
    prefetch_active_share_content_ids,
    prefetch_mutual_friend_owner_ids,
    viewer_can_remove_from_library_with_prefetch,
)


def _row(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": uuid4(),
        "user_id": str(uuid4()),
        "visibility": "private",
        "shared_with_user_ids": [],
        "friend_visibility": False,
    }
    payload.update(overrides)
    return payload


def test_viewer_can_remove_owner_always() -> None:
    viewer = str(uuid4())
    row = _row(user_id=viewer)
    assert (
        viewer_can_remove_from_library_with_prefetch(
            row,
            viewer,
            shared_content_ids=set(),
            mutual_friend_owner_ids=set(),
        )
        is True
    )


def test_viewer_can_remove_via_content_shares_ssot() -> None:
    viewer = str(uuid4())
    content_id = uuid4()
    row = _row(id=content_id, user_id=str(uuid4()), visibility="shared")
    assert (
        viewer_can_remove_from_library_with_prefetch(
            row,
            viewer,
            shared_content_ids={content_id},
            mutual_friend_owner_ids=set(),
        )
        is True
    )


def test_viewer_can_remove_default_deny_without_evidence() -> None:
    viewer = str(uuid4())
    row = _row(visibility="shared", friend_visibility=True)
    assert (
        viewer_can_remove_from_library_with_prefetch(
            row,
            viewer,
            shared_content_ids=set(),
            mutual_friend_owner_ids=set(),
        )
        is False
    )


def test_content_accessible_friends_requires_mutual_friendship() -> None:
    viewer = str(uuid4())
    owner = str(uuid4())
    row = _row(user_id=owner, visibility="friends")
    assert (
        content_accessible_with_prefetch(
            row,
            viewer,
            shared_content_ids=set(),
            mutual_friend_owner_ids=set(),
        )
        is False
    )
    assert (
        content_accessible_with_prefetch(
            row,
            viewer,
            shared_content_ids=set(),
            mutual_friend_owner_ids={owner},
        )
        is True
    )


@pytest.mark.anyio
async def test_prefetch_acl_sets_batches_shares_and_friendship() -> None:
    viewer = str(uuid4())
    owner_a = str(uuid4())
    owner_b = str(uuid4())
    id_a = uuid4()
    id_b = uuid4()
    rows = [
        _row(id=id_a, user_id=owner_a, visibility="friends"),
        _row(id=id_b, user_id=owner_b, visibility="shared", friend_visibility=True),
        _row(user_id=viewer, visibility="private"),  # own — skipped for prefetch targets
    ]
    conn = MagicMock()
    conn.fetch = AsyncMock(
        side_effect=[
            [{"content_id": id_a}],
            [{"owner_id": owner_a}],
        ]
    )

    shared_ids, friend_ids = await prefetch_acl_sets_for_rows(conn, rows, viewer)

    assert shared_ids == {id_a}
    assert friend_ids == {owner_a}
    assert conn.fetch.await_count == 2
    shares_sql = conn.fetch.await_args_list[0].args[0]
    friends_sql = conn.fetch.await_args_list[1].args[0]
    assert "FROM content_shares" in shares_sql
    assert "ANY($1::uuid[])" in shares_sql
    assert "check_mutual_friendship" in friends_sql
    assert "unnest($1::uuid[])" in friends_sql


@pytest.mark.anyio
async def test_prefetch_helpers_noop_on_empty() -> None:
    conn = MagicMock()
    conn.fetch = AsyncMock()
    assert await prefetch_active_share_content_ids(conn, [], "viewer") == set()
    assert await prefetch_mutual_friend_owner_ids(conn, [], "viewer") == set()
    conn.fetch.assert_not_awaited()
