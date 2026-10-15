# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Friend card profile, relationship updates, and user reports.
# Invariants:
# - Part of FriendsService package; do not import friends_service facade from here.
# Related:
# - api/services/friends_service.py
# ---

from __future__ import annotations

import logging
from uuid import UUID, uuid4

from api.monitoring.metrics import observe_social_hub_block, observe_social_hub_report
from api.services.friends.circles import FriendsCirclesMixin
from api.services.profile_privacy import (
    batch_viewer_circle_hits,
    privacy_from_joined_row,
    redact_profile_fields,
)

logger = logging.getLogger(__name__)

REPORT_DEDUP_WINDOW_HOURS = 24


class FriendsProfileMixin(FriendsCirclesMixin):
    async def get_friend_profile(self, current_user_id: str, friend_user_id: str) -> dict:
        """Return detailed friend profile and private relationship metadata for current user."""
        current_uuid = self._parse_user_uuid(current_user_id)
        friend_uuid = self._parse_user_uuid(friend_user_id)
        if current_uuid is None or friend_uuid is None:
            raise ValueError("Некорректный идентификатор пользователя")

        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT
                    u.id,
                    u.username,
                    u.avatar_url,
                    u.full_name,
                    u.bio,
                    (upp.user_id IS NOT NULL) AS privacy_join_present,
                    upp.discoverability,
                    upp.avatar_visibility,
                    upp.avatar_circle_id,
                    upp.full_name_visibility,
                    upp.full_name_circle_id,
                    upp.bio_visibility,
                    upp.bio_circle_id,
                    f.created_at AS friendship_created_at,
                    f.is_favorite,
                    f.is_muted,
                    f.is_blocked,
                    f.share_activity_with_friend,
                    f.private_note,
                    f.note_updated_at,
                    COALESCE(reverse_f.share_activity_with_friend, TRUE) AS activity_visible_to_current_user,
                    CASE
                        WHEN COALESCE(reverse_f.share_activity_with_friend, TRUE) THEN stats.last_activity
                        ELSE NULL
                    END AS last_activity_at,
                    chat.last_message_at AS last_interaction_at
                FROM friendships f
                JOIN users u ON u.id = f.friend_id
                LEFT JOIN user_profile_privacy upp ON upp.user_id = u.id
                LEFT JOIN friendships reverse_f
                  ON reverse_f.user_id = u.id
                 AND reverse_f.friend_id = $1
                LEFT JOIN user_dashboard_stats_mv stats ON stats.user_id = u.id
                LEFT JOIN gaf_chats chat
                  ON LEAST(chat.user_id_1, chat.user_id_2) = LEAST($1, u.id)
                 AND GREATEST(chat.user_id_1, chat.user_id_2) = GREATEST($1, u.id)
                WHERE f.user_id = $1 AND f.friend_id = $2
                LIMIT 1
                """,
                current_uuid,
                friend_uuid,
            )

            if row is None:
                raise ValueError("Пользователь не в списке друзей")

            circles = await self._fetch_friend_circles(conn, current_uuid, friend_uuid)

            priv = privacy_from_joined_row(row)
            pairs: list[tuple[UUID, UUID]] = []
            for key_vis, key_c in (
                ("avatar_visibility", "avatar_circle_id"),
                ("full_name_visibility", "full_name_circle_id"),
                ("bio_visibility", "bio_circle_id"),
            ):
                if str(priv.get(key_vis) or "").lower() == "circle":
                    cid = priv.get(key_c)
                    if cid is not None:
                        pairs.append((UUID(str(cid)), friend_uuid))
            circle_hits = await batch_viewer_circle_hits(conn, viewer_user_id=current_uuid, pairs=pairs)

            avatar_url, full_name, bio = redact_profile_fields(
                subject_id=friend_uuid,
                viewer_id=current_uuid,
                is_friend=True,
                privacy=priv,
                avatar_url=row["avatar_url"],
                full_name=row["full_name"],
                bio=row["bio"],
                circle_hits=circle_hits,
            )

        return {
            "id": str(row["id"]),
            "username": row["username"],
            "avatar_url": avatar_url,
            "full_name": full_name,
            "bio": bio,
            "is_favorite": bool(row["is_favorite"]),
            "is_muted": bool(row["is_muted"]),
            "is_blocked": bool(row["is_blocked"]),
            "share_activity_with_friend": bool(row["share_activity_with_friend"]),
            "activity_visible_to_current_user": bool(row["activity_visible_to_current_user"]),
            "private_note": row["private_note"],
            "note_updated_at": self._serialize_dt(row["note_updated_at"]),
            "friendship_created_at": self._serialize_dt(row["friendship_created_at"]),
            "last_activity_at": self._serialize_dt(row["last_activity_at"]),
            "last_interaction_at": self._serialize_dt(row["last_interaction_at"]),
            "circles": circles,
        }

    async def update_friend_relationship(
        self,
        current_user_id: str,
        friend_user_id: str,
        *,
        is_favorite: bool | None = None,
        is_muted: bool | None = None,
        is_blocked: bool | None = None,
        share_activity_with_friend: bool | None = None,
        circle_ids: list[str] | None = None,
        private_note: str | None = None,
    ) -> dict:
        """Update private relationship metadata for a friend."""
        current_uuid = self._parse_user_uuid(current_user_id)
        friend_uuid = self._parse_user_uuid(friend_user_id)
        if current_uuid is None or friend_uuid is None:
            raise ValueError("Некорректный идентификатор пользователя")
        if (
            is_favorite is None
            and is_muted is None
            and is_blocked is None
            and share_activity_with_friend is None
            and circle_ids is None
            and private_note is None
        ):
            raise ValueError("Нет данных для обновления")

        update_parts: list[str] = []
        params: list[object] = [current_uuid, friend_uuid]
        param_index = 3

        if is_favorite is not None:
            update_parts.append(f"is_favorite = ${param_index}")
            params.append(is_favorite)
            param_index += 1

        if is_muted is not None:
            update_parts.append(f"is_muted = ${param_index}")
            params.append(is_muted)
            param_index += 1

        if is_blocked is not None:
            update_parts.append(f"is_blocked = ${param_index}")
            params.append(is_blocked)
            param_index += 1

        if share_activity_with_friend is not None:
            update_parts.append(f"share_activity_with_friend = ${param_index}")
            params.append(share_activity_with_friend)
            param_index += 1

        if private_note is not None:
            normalized_note = private_note.strip()
            update_parts.append(f"private_note = ${param_index}")
            params.append(normalized_note or None)
            param_index += 1
            update_parts.append("note_updated_at = NOW()")

        async with self.db_pool.acquire() as conn, conn.transaction():
            if update_parts:
                updated = await conn.fetchrow(
                    f"""
                        UPDATE friendships
                        SET {", ".join(update_parts)}
                        WHERE user_id = $1 AND friend_id = $2
                        RETURNING friend_id
                        """,
                    *params,
                )
            else:
                updated = await conn.fetchrow(
                    """
                        SELECT friend_id
                        FROM friendships
                        WHERE user_id = $1 AND friend_id = $2
                        LIMIT 1
                        """,
                    current_uuid,
                    friend_uuid,
                )

            if updated is None:
                raise ValueError("Пользователь не в списке друзей")

            if circle_ids is not None:
                await self._sync_friend_circles(conn, current_uuid, friend_uuid, circle_ids)

        if is_blocked is True:
            observe_social_hub_block(outcome="set")
        elif is_blocked is False:
            observe_social_hub_block(outcome="cleared")

        return await self.get_friend_profile(current_user_id, friend_user_id)

    async def report_user(
        self,
        reporter_user_id: str,
        reported_user_id: str,
        *,
        reason: str,
        details: str | None = None,
    ) -> dict:
        reporter_uuid = self._parse_user_uuid(reporter_user_id)
        reported_uuid = self._parse_user_uuid(reported_user_id)
        if reporter_uuid is None or reported_uuid is None:
            raise ValueError("Некорректный идентификатор пользователя")
        if reporter_uuid == reported_uuid:
            raise ValueError("Нельзя отправить жалобу на себя")

        normalized_reason = (reason or "").strip()[:80]
        normalized_details = (details or "").strip()[:2000] or None
        if not normalized_reason:
            raise ValueError("Укажите причину жалобы")

        report_id = uuid4()
        async with self.db_pool.acquire() as conn:
            recent_report = await conn.fetchrow(
                """
                SELECT id
                FROM social_user_reports
                WHERE reporter_user_id = $1
                  AND reported_user_id = $2
                  AND created_at >= NOW() - ($3::int * INTERVAL '1 hour')
                ORDER BY created_at DESC
                LIMIT 1
                """,
                reporter_uuid,
                reported_uuid,
                REPORT_DEDUP_WINDOW_HOURS,
            )
            if recent_report:
                observe_social_hub_report(outcome="duplicate")
                raise ValueError("Жалоба уже отправлена на проверку")

            await conn.execute(
                """
                INSERT INTO social_user_reports (
                    id, reporter_user_id, reported_user_id, reason, details
                )
                VALUES ($1, $2, $3, $4, $5)
                """,
                report_id,
                reporter_uuid,
                reported_uuid,
                normalized_reason,
                normalized_details,
            )
        observe_social_hub_report(outcome="created")
        return {"id": str(report_id), "status": "received"}
