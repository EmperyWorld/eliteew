# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User lookup and relationship-aware directory search with privacy filters.
# Invariants:
# - Part of FriendsService package; do not import friends_service facade from here.
# Related:
# - api/services/friends_service.py
# ---

from __future__ import annotations

from uuid import UUID

from api.services.friends.base import FriendsServiceBase
from api.services.profile_privacy import (
    SEARCH_DISCOVERABILITY_WHERE,
    batch_viewer_circle_hits,
    privacy_from_joined_row,
    redact_profile_fields,
)


class FriendsSearchMixin(FriendsServiceBase):
    async def find_user_by_username(self, username: str) -> dict | None:
        """Look up user by username (case-insensitive). Returns id, username, avatar_url, full_name or None."""
        name = (username or "").strip()
        if not name:
            return None
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, username, avatar_url, full_name, COALESCE(is_trusted, FALSE) AS is_trusted,
                       NULLIF(BTRIM(COALESCE(admin_badge_label, '')), '') AS admin_badge_label,
                       NULLIF(BTRIM(COALESCE(admin_badge_hint, '')), '') AS admin_badge_hint
                FROM users
                WHERE LOWER(username) = LOWER($1)
                  AND NOT COALESCE(is_system_account, FALSE)
                """,
                name,
            )
        if not row:
            return None
        return {
            "id": str(row["id"]),
            "username": row["username"],
            "avatar_url": row["avatar_url"],
            "full_name": row["full_name"],
            "is_trusted": bool(row.get("is_trusted")),
            "admin_badge_label": row.get("admin_badge_label"),
            "admin_badge_hint": row.get("admin_badge_hint"),
        }

    async def find_user_by_id(self, user_id: str | UUID) -> dict | None:
        """Look up user by id. Returns id, username, avatar_url, full_name or None."""
        uid = self._parse_user_uuid(str(user_id))
        if uid is None:
            return None
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, username, avatar_url, full_name,
                       COALESCE(is_trusted, FALSE) AS is_trusted,
                       NULLIF(BTRIM(COALESCE(admin_badge_label, '')), '') AS admin_badge_label,
                       NULLIF(BTRIM(COALESCE(admin_badge_hint, '')), '') AS admin_badge_hint,
                       COALESCE(is_system_account, FALSE) AS is_system_account
                FROM users WHERE id = $1
                """,
                uid,
            )
        if not row:
            return None
        return {
            "id": str(row["id"]),
            "username": row["username"],
            "avatar_url": row["avatar_url"],
            "full_name": row["full_name"],
            "is_trusted": bool(row.get("is_trusted")),
            "admin_badge_label": row.get("admin_badge_label"),
            "admin_badge_hint": row.get("admin_badge_hint"),
            "is_system_account": bool(row.get("is_system_account")),
        }

    async def search_users(self, current_user_id: str, query: str, limit: int = 8) -> list[dict]:
        """Search users and annotate their relationship to the current user."""
        current_uuid = self._parse_user_uuid(current_user_id)
        needle = (query or "").strip()
        if current_uuid is None or not needle:
            return []

        search_like = f"%{needle}%"
        search_prefix = f"{needle}%"
        safe_limit = max(1, min(int(limit), 20))

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT
                    u.id,
                    u.username,
                    u.avatar_url,
                    u.full_name,
                    COALESCE(u.is_trusted, FALSE) AS is_trusted,
                    NULLIF(BTRIM(COALESCE(u.admin_badge_label, '')), '') AS admin_badge_label,
                    NULLIF(BTRIM(COALESCE(u.admin_badge_hint, '')), '') AS admin_badge_hint,
                    (upp.user_id IS NOT NULL) AS privacy_join_present,
                    upp.discoverability,
                    upp.avatar_visibility,
                    upp.avatar_circle_id,
                    upp.full_name_visibility,
                    upp.full_name_circle_id,
                    upp.bio_visibility,
                    upp.bio_circle_id,
                    current_friendship.is_muted,
                    current_friendship.is_blocked,
                    current_friendship.share_activity_with_friend,
                    COALESCE(reverse_f.share_activity_with_friend, TRUE) AS activity_visible_to_current_user,
                    stats.last_activity AS last_activity_at,
                    chat.last_message_at AS last_interaction_at,
                    CASE
                        WHEN EXISTS (
                            SELECT 1
                            FROM friendships f
                            WHERE f.user_id = $1 AND f.friend_id = u.id
                        ) THEN 'friend'
                        WHEN EXISTS (
                            SELECT 1
                            FROM friend_requests fr
                            WHERE fr.from_user_id = u.id AND fr.to_user_id = $1 AND fr.status = 'pending'
                        ) THEN 'incoming_request'
                        WHEN EXISTS (
                            SELECT 1
                            FROM friend_requests fr
                            WHERE fr.from_user_id = $1 AND fr.to_user_id = u.id AND fr.status = 'pending'
                        ) THEN 'outgoing_request'
                        ELSE 'can_send'
                    END AS relationship_status,
                    COALESCE(
                        (
                            SELECT fr.id
                            FROM friend_requests fr
                            WHERE fr.from_user_id = u.id AND fr.to_user_id = $1 AND fr.status = 'pending'
                            ORDER BY fr.created_at DESC
                            LIMIT 1
                        ),
                        (
                            SELECT fr.id
                            FROM friend_requests fr
                            WHERE fr.from_user_id = $1 AND fr.to_user_id = u.id AND fr.status = 'pending'
                            ORDER BY fr.created_at DESC
                            LIMIT 1
                        )
                    ) AS request_id
                FROM users u
                LEFT JOIN user_profile_privacy upp ON upp.user_id = u.id
                LEFT JOIN friendships current_friendship
                  ON current_friendship.user_id = $1
                 AND current_friendship.friend_id = u.id
                LEFT JOIN friendships reverse_f
                  ON reverse_f.user_id = u.id
                 AND reverse_f.friend_id = $1
                LEFT JOIN user_dashboard_stats_mv stats ON stats.user_id = u.id
                LEFT JOIN gaf_chats chat
                  ON LEAST(chat.user_id_1, chat.user_id_2) = LEAST($1, u.id)
                 AND GREATEST(chat.user_id_1, chat.user_id_2) = GREATEST($1, u.id)
                WHERE u.id <> $1
                  AND NOT COALESCE(u.is_system_account, FALSE)
                  AND (
                    COALESCE(u.username, '') ILIKE $2
                    OR COALESCE(u.full_name, '') ILIKE $2
                  )
                  AND ({SEARCH_DISCOVERABILITY_WHERE.strip()})
                ORDER BY
                    CASE
                        WHEN LOWER(COALESCE(u.username, '')) = LOWER($3) THEN 0
                        WHEN LOWER(COALESCE(u.username, '')) LIKE LOWER($4) THEN 1
                        WHEN LOWER(COALESCE(u.full_name, '')) LIKE LOWER($4) THEN 2
                        ELSE 3
                    END,
                    CASE
                        WHEN EXISTS (
                            SELECT 1
                            FROM friendships f
                            WHERE f.user_id = $1 AND f.friend_id = u.id
                        ) THEN 0
                        WHEN EXISTS (
                            SELECT 1
                            FROM friend_requests fr
                            WHERE fr.from_user_id = u.id AND fr.to_user_id = $1 AND fr.status = 'pending'
                        ) THEN 1
                        WHEN EXISTS (
                            SELECT 1
                            FROM friend_requests fr
                            WHERE fr.from_user_id = $1 AND fr.to_user_id = u.id AND fr.status = 'pending'
                        ) THEN 2
                        ELSE 3
                    END,
                    COALESCE(current_friendship.is_blocked, FALSE) ASC,
                    COALESCE(
                        chat.last_message_at,
                        CASE
                            WHEN COALESCE(reverse_f.share_activity_with_friend, TRUE) THEN stats.last_activity
                            ELSE NULL
                        END
                    ) DESC NULLS LAST,
                    COALESCE(NULLIF(BTRIM(u.username), ''), NULLIF(BTRIM(u.full_name), ''), u.id::text) ASC
                LIMIT $5
                """,
                current_uuid,
                search_like,
                needle,
                search_prefix,
                safe_limit,
            )

            pairs: list[tuple[UUID, UUID]] = []
            for row in rows:
                priv = privacy_from_joined_row(row)
                sid = row["id"]
                for key_vis, key_c in (
                    ("avatar_visibility", "avatar_circle_id"),
                    ("full_name_visibility", "full_name_circle_id"),
                ):
                    if str(priv.get(key_vis) or "").lower() == "circle":
                        cid = priv.get(key_c)
                        if cid is not None:
                            pairs.append((UUID(str(cid)), sid))
            circle_hits = await batch_viewer_circle_hits(conn, viewer_user_id=current_uuid, pairs=pairs)

            out: list[dict] = []
            for row in rows:
                priv = privacy_from_joined_row(row)
                sid = row["id"]
                is_friend = row["relationship_status"] == "friend"
                avatar_url, full_name, _bio = redact_profile_fields(
                    subject_id=sid,
                    viewer_id=current_uuid,
                    is_friend=is_friend,
                    privacy=priv,
                    avatar_url=row["avatar_url"],
                    full_name=row["full_name"],
                    bio=None,
                    circle_hits=circle_hits,
                )
                out.append(
                    {
                        "id": str(row["id"]),
                        "username": row["username"],
                        "avatar_url": avatar_url,
                        "full_name": full_name,
                        "is_trusted": bool(row.get("is_trusted")),
                        "admin_badge_label": row.get("admin_badge_label"),
                        "admin_badge_hint": row.get("admin_badge_hint"),
                        "relationship_status": row["relationship_status"],
                        "request_id": str(row["request_id"]) if row["request_id"] else None,
                        "is_muted": bool(row.get("is_muted")),
                        "is_blocked": bool(row.get("is_blocked")),
                        "share_activity_with_friend": bool(row.get("share_activity_with_friend", True)),
                        "activity_visible_to_current_user": bool(row.get("activity_visible_to_current_user", True)),
                        "last_activity_at": self._serialize_dt(
                            row.get("last_activity_at") if row.get("activity_visible_to_current_user", True) else None
                        ),
                        "last_interaction_at": self._serialize_dt(row.get("last_interaction_at")),
                    }
                )
            return out
