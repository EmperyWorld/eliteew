# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Friends list and pending request read queries.
# Invariants:
# - Part of FriendsService package; do not import friends_service facade from here.
# Related:
# - api/services/friends_service.py
# ---

from __future__ import annotations

from uuid import UUID

import asyncpg  # type: ignore[import-not-found,import-untyped]

from api.services.friends.circles import FriendsCirclesMixin


class FriendsGraphQueriesMixin(FriendsCirclesMixin):
    async def _fetch_friends(self, conn: asyncpg.Connection, user_id: UUID) -> list[dict]:
        rows = await conn.fetch(
            """
            SELECT
                u.id,
                u.username,
                u.avatar_url,
                u.full_name,
                COALESCE(u.is_trusted, FALSE) AS is_trusted,
                NULLIF(BTRIM(COALESCE(u.admin_badge_label, '')), '') AS admin_badge_label,
                NULLIF(BTRIM(COALESCE(u.admin_badge_hint, '')), '') AS admin_badge_hint,
                f.is_favorite,
                f.is_muted,
                f.is_blocked,
                f.share_activity_with_friend,
                COALESCE(reverse_f.share_activity_with_friend, TRUE) AS activity_visible_to_current_user,
                CASE
                    WHEN COALESCE(reverse_f.share_activity_with_friend, TRUE) THEN stats.last_activity
                    ELSE NULL
                END AS last_activity_at,
                chat.last_message_at AS last_interaction_at
            FROM friendships f
            JOIN users u ON u.id = f.friend_id
            LEFT JOIN friendships reverse_f
              ON reverse_f.user_id = u.id
             AND reverse_f.friend_id = $1
            LEFT JOIN user_dashboard_stats_mv stats ON stats.user_id = u.id
            LEFT JOIN gaf_chats chat
              ON LEAST(chat.user_id_1, chat.user_id_2) = LEAST($1, u.id)
             AND GREATEST(chat.user_id_1, chat.user_id_2) = GREATEST($1, u.id)
            WHERE f.user_id = $1
            ORDER BY
                f.is_favorite DESC,
                f.is_blocked ASC,
                COALESCE(
                    chat.last_message_at,
                    CASE
                        WHEN COALESCE(reverse_f.share_activity_with_friend, TRUE) THEN stats.last_activity
                        ELSE NULL
                    END
                ) DESC NULLS LAST,
                COALESCE(NULLIF(BTRIM(u.username), ''), NULLIF(BTRIM(u.full_name), ''), u.id::text) ASC
            """,
            user_id,
        )
        friend_ids = [UUID(str(row["id"])) for row in rows]
        circle_map = await self._fetch_circle_rows_for_friend_ids(conn, user_id, friend_ids)
        return [
            {
                "id": str(r["id"]),
                "username": r["username"],
                "avatar_url": r["avatar_url"],
                "full_name": r["full_name"],
                "is_trusted": bool(r.get("is_trusted")),
                "admin_badge_label": r.get("admin_badge_label"),
                "admin_badge_hint": r.get("admin_badge_hint"),
                "is_favorite": bool(r.get("is_favorite")),
                "is_muted": bool(r.get("is_muted")),
                "is_blocked": bool(r.get("is_blocked")),
                "share_activity_with_friend": bool(r.get("share_activity_with_friend", True)),
                "activity_visible_to_current_user": bool(r.get("activity_visible_to_current_user", True)),
                "last_activity_at": self._serialize_dt(r.get("last_activity_at")),
                "last_interaction_at": self._serialize_dt(r.get("last_interaction_at")),
                "circles": circle_map.get(str(r["id"]), []),
            }
            for r in rows
        ]

    async def _fetch_incoming_requests(self, conn: asyncpg.Connection, user_id: UUID) -> list[dict]:
        rows = await conn.fetch(
            """
            SELECT fr.id, fr.from_user_id, fr.created_at,
                   u.username, u.avatar_url, u.full_name
            FROM friend_requests fr
            JOIN users u ON u.id = fr.from_user_id
            WHERE fr.to_user_id = $1 AND fr.status = 'pending'
              AND NOT EXISTS (
                SELECT 1 FROM friendships f
                WHERE (f.user_id = $1 AND f.friend_id = fr.from_user_id)
                   OR (f.friend_id = $1 AND f.user_id = fr.from_user_id)
              )
            ORDER BY fr.created_at DESC
            """,
            user_id,
        )
        return [
            {
                "id": str(r["id"]),
                "from_user_id": str(r["from_user_id"]),
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "username": r["username"],
                "avatar_url": r["avatar_url"],
                "full_name": r["full_name"],
            }
            for r in rows
        ]

    async def _fetch_sent_requests(self, conn: asyncpg.Connection, user_id: UUID) -> list[dict]:
        rows = await conn.fetch(
            """
            SELECT fr.id, fr.to_user_id, fr.created_at,
                   u.username, u.avatar_url, u.full_name
            FROM friend_requests fr
            JOIN users u ON u.id = fr.to_user_id
            WHERE fr.from_user_id = $1 AND fr.status = 'pending'
              AND NOT EXISTS (
                SELECT 1 FROM friendships f
                WHERE (f.user_id = $1 AND f.friend_id = fr.to_user_id)
                   OR (f.friend_id = $1 AND f.user_id = fr.to_user_id)
              )
            ORDER BY fr.created_at DESC
            """,
            user_id,
        )
        return [
            {
                "id": str(r["id"]),
                "to_user_id": str(r["to_user_id"]),
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "username": r["username"],
                "avatar_url": r["avatar_url"],
                "full_name": r["full_name"],
            }
            for r in rows
        ]

    async def list_friends(self, user_id: str) -> list[dict]:
        """List current user's friends with id, username, avatar_url, full_name."""
        uid = self._parse_user_uuid(user_id)
        if uid is None:
            return []
        async with self.db_pool.acquire() as conn:
            return await self._fetch_friends(conn, uid)

    async def list_incoming_requests(self, user_id: str) -> list[dict]:
        """List pending requests to current user; exclude senders who are already friends."""
        uid = self._parse_user_uuid(user_id)
        if uid is None:
            return []
        async with self.db_pool.acquire() as conn:
            return await self._fetch_incoming_requests(conn, uid)

    async def list_sent_requests(self, user_id: str) -> list[dict]:
        """List pending requests sent by current user; exclude recipients who are already friends."""
        uid = self._parse_user_uuid(user_id)
        if uid is None:
            return []
        async with self.db_pool.acquire() as conn:
            return await self._fetch_sent_requests(conn, uid)
