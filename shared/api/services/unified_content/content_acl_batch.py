#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Batch prefetch helpers for Unified Content ACL flags (content_shares + mutual friendship).
# Invariants:
# - Default-deny: missing share/friendship evidence never grants can_delete / access.
# - content_shares is SSOT for explicit shares; shared_with_user_ids remains dual-read only.
# Related:
# - documentation/product/CONTENT-MANAGER.md
# - api/services/unified_content/content_access_policy.py
# - api/services/unified_content/content_storage_service.py
# ---
"""Batch ACL prefetch for list/search/multi-get paths (no per-row SELECT loops)."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]


async def prefetch_active_share_content_ids(
    conn: asyncpg.Connection,
    content_ids: Sequence[UUID],
    viewer_id: str,
) -> set[UUID]:
    """Return content_ids that have an active content_shares row for viewer_id."""
    if not content_ids:
        return set()
    vid = str(viewer_id).strip()
    if not vid:
        return set()
    rows = await conn.fetch(
        """
        SELECT content_id
        FROM content_shares
        WHERE content_id = ANY($1::uuid[])
          AND shared_with_user_id = $2
          AND (expires_at IS NULL OR expires_at > NOW())
        """,
        list(content_ids),
        vid,
    )
    return {row["content_id"] for row in rows}


async def prefetch_mutual_friend_owner_ids(
    conn: asyncpg.Connection,
    owner_ids: Sequence[str | UUID],
    viewer_id: str,
) -> set[str]:
    """Return owner_id strings that are mutual friends with viewer_id."""
    unique_owners: list[str] = []
    seen: set[str] = set()
    for raw in owner_ids:
        oid = str(raw).strip()
        if not oid or oid in seen:
            continue
        seen.add(oid)
        unique_owners.append(oid)
    if not unique_owners:
        return set()
    vid = str(viewer_id).strip()
    if not vid:
        return set()
    rows = await conn.fetch(
        """
        SELECT owner_id::text AS owner_id
        FROM unnest($1::uuid[]) AS owner_id
        WHERE check_mutual_friendship(owner_id, $2::uuid)
        """,
        unique_owners,
        vid,
    )
    return {str(row["owner_id"]) for row in rows}


def viewer_can_remove_from_library_with_prefetch(
    row: Mapping[str, Any] | asyncpg.Record,
    viewer_id: str,
    *,
    shared_content_ids: set[UUID],
    mutual_friend_owner_ids: set[str],
) -> bool:
    """Pure can_delete decision using prefetched share/friendship sets (default-deny)."""
    owner_id = str(row["user_id"])
    vid = str(viewer_id).strip()
    if owner_id == vid:
        return True
    shared_ids = {str(x) for x in (row.get("shared_with_user_ids") or [])}
    if vid in shared_ids:
        return True
    content_id = row["id"]
    if content_id in shared_content_ids:
        return True
    visibility = str(row.get("visibility") or "")
    if visibility == "friends":
        return owner_id in mutual_friend_owner_ids
    if visibility == "shared" and row.get("friend_visibility"):
        if owner_id not in mutual_friend_owner_ids:
            return False
        allowed = row.get("shared_with_user_ids") or []
        return not allowed or vid in {str(x) for x in allowed}
    return False


def content_accessible_with_prefetch(
    row: Mapping[str, Any] | asyncpg.Record,
    viewer_id: str,
    *,
    shared_content_ids: set[UUID],
    mutual_friend_owner_ids: set[str],
) -> bool:
    """Pure read-access decision aligned with hybrid-search ACL (default-deny)."""
    owner_id = str(row["user_id"])
    vid = str(viewer_id).strip()
    visibility = str(row.get("visibility") or "")
    shared_with = row.get("shared_with_user_ids") or []
    friend_visibility = bool(row.get("friend_visibility", False))

    if owner_id == vid or visibility == "public" or vid in {str(x) for x in shared_with}:
        return True
    if row["id"] in shared_content_ids:
        return True
    if friend_visibility and owner_id in mutual_friend_owner_ids:
        allowed = shared_with or []
        if not allowed or vid in {str(x) for x in allowed}:
            return True
    return visibility == "friends" and owner_id in mutual_friend_owner_ids


async def prefetch_acl_sets_for_rows(
    conn: asyncpg.Connection,
    rows: Sequence[Mapping[str, Any] | asyncpg.Record],
    viewer_id: str,
) -> tuple[set[UUID], set[str]]:
    """
    Prefetch share + friendship sets needed for can_delete / access over a page of rows.

    Friendship is checked only for non-owned rows that may need it (friends / friend_visibility).
    """
    vid = str(viewer_id).strip()
    content_ids: list[UUID] = []
    friendship_owner_ids: list[str] = []
    for row in rows:
        owner_id = str(row["user_id"])
        if owner_id == vid:
            continue
        content_ids.append(row["id"])
        visibility = str(row.get("visibility") or "")
        if visibility == "friends" or row.get("friend_visibility"):
            friendship_owner_ids.append(owner_id)

    shared_ids = await prefetch_active_share_content_ids(conn, content_ids, vid)
    friend_ids = await prefetch_mutual_friend_owner_ids(conn, friendship_owner_ids, vid)
    return shared_ids, friend_ids
