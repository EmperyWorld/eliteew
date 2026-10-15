# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Directed friendship controls and interactability asserts.
# Invariants:
# - Part of FriendsService package; do not import friends_service facade from here.
# Related:
# - api/services/friends_service.py
# ---

from __future__ import annotations

from uuid import UUID

import asyncpg  # type: ignore[import-not-found,import-untyped]

from api.services.friends.base import FriendsServiceBase


class FriendsRelationshipControlsMixin(FriendsServiceBase):
    async def _fetch_relationship_controls(
        self,
        conn: asyncpg.Connection,
        current_user_id: UUID,
        other_user_id: UUID,
    ) -> dict:
        row = await conn.fetchrow(
            """
            SELECT
                COALESCE(current_f.is_muted, FALSE) AS is_muted,
                COALESCE(current_f.is_blocked, FALSE) AS is_blocked,
                COALESCE(current_f.share_activity_with_friend, TRUE) AS share_activity_with_friend,
                COALESCE(reverse_f.is_blocked, FALSE) AS blocked_by_other,
                EXISTS(
                    SELECT 1
                    FROM friendships f
                    WHERE f.user_id = $1 AND f.friend_id = $2
                ) AS is_friend
            FROM (SELECT 1) AS sentinel
            LEFT JOIN friendships current_f
              ON current_f.user_id = $1
             AND current_f.friend_id = $2
            LEFT JOIN friendships reverse_f
              ON reverse_f.user_id = $2
             AND reverse_f.friend_id = $1
            """,
            current_user_id,
            other_user_id,
        )
        if row is None:
            return {
                "is_muted": False,
                "is_blocked": False,
                "share_activity_with_friend": True,
                "blocked_by_other": False,
                "is_friend": False,
            }
        return {
            "is_muted": bool(row["is_muted"]),
            "is_blocked": bool(row["is_blocked"]),
            "share_activity_with_friend": bool(row["share_activity_with_friend"]),
            "blocked_by_other": bool(row["blocked_by_other"]),
            "is_friend": bool(row["is_friend"]),
        }

    async def get_relationship_controls(self, current_user_id: str, other_user_id: str) -> dict:
        current_uuid = self._parse_user_uuid(current_user_id)
        other_uuid = self._parse_user_uuid(other_user_id)
        if current_uuid is None or other_uuid is None:
            raise ValueError("Некорректный идентификатор пользователя")
        async with self.db_pool.acquire() as conn:
            return await self._fetch_relationship_controls(conn, current_uuid, other_uuid)

    async def assert_can_interact(
        self,
        current_user_id: str,
        other_user_id: str,
        *,
        action_label: str,
    ) -> dict:
        controls = await self.get_relationship_controls(current_user_id, other_user_id)
        if controls["is_blocked"]:
            raise ValueError(f"Сначала снимите блокировку, чтобы {action_label}")
        if controls["blocked_by_other"]:
            raise ValueError(f"Пользователь ограничил взаимодействие с вами: нельзя {action_label}")
        return controls
