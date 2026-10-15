# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Privacy-safe Social Hub feed/read models over friend requests, friendships, shared content, and action summaries.
# Invariants:
# - Feed rows expose relationship metadata only; no private notes, message bodies, or hidden profile fields.
# - Viewer scope is always the authenticated user and blocked contacts are excluded from every read model.
# Related:
# - api/routers/social_hub.py
# - api/services/friends_service.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from api.gaf_chat.constants import CONTENT_SUBTYPE_GAF_CHAT_VOICE
from api.services.profile_privacy import (
    batch_viewer_circle_hits,
    privacy_from_joined_row,
    redact_profile_fields,
)


class SocialHubFeedService:
    def __init__(self, db_pool: asyncpg.Pool) -> None:
        self.db_pool = db_pool

    @staticmethod
    def _parse_uuid(value: str) -> UUID | None:
        try:
            return UUID(str(value))
        except (TypeError, ValueError):  # fmt: skip
            return None

    @staticmethod
    def _parse_cursor(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Некорректный cursor ленты") from exc
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed

    @staticmethod
    def _serialize_row(
        row: asyncpg.Record | dict,
        *,
        viewer_uuid: UUID,
        circle_hits: set[tuple[UUID, UUID]],
    ) -> dict:
        created_at = row["created_at"]
        if isinstance(created_at, datetime):
            created_at = created_at.astimezone(UTC).isoformat()
        subject_id = row.get("subject_user_id")
        subject_uuid = subject_id if isinstance(subject_id, UUID) else UUID(str(subject_id))
        avatar_url, full_name, _bio = redact_profile_fields(
            subject_id=subject_uuid,
            viewer_id=viewer_uuid,
            is_friend=bool(row.get("is_friend")),
            privacy=privacy_from_joined_row(row),
            avatar_url=row.get("avatar_url"),
            full_name=row.get("full_name"),
            bio=None,
            circle_hits=circle_hits,
        )
        return {
            "id": row["id"],
            "type": row["type"],
            "created_at": created_at,
            "actor_user_id": str(row["actor_user_id"]) if row.get("actor_user_id") else None,
            "target_user_id": str(row["target_user_id"]) if row.get("target_user_id") else None,
            "username": row.get("username"),
            "full_name": full_name,
            "avatar_url": avatar_url,
            "summary": row.get("summary"),
        }

    @staticmethod
    def _serialize_shared_content_row(row: asyncpg.Record | dict) -> dict:
        created_at = row["created_at"]
        updated_at = row["updated_at"]
        if isinstance(created_at, datetime):
            created_at = created_at.astimezone(UTC).isoformat()
        if isinstance(updated_at, datetime):
            updated_at = updated_at.astimezone(UTC).isoformat()
        thumbnail_path = row.get("thumbnail_path")
        thumbnail_url = f"/api/v1/content/{row['id']}/thumbnail" if thumbnail_path else None
        return {
            "id": str(row["id"]),
            "name": row.get("name"),
            "title": row.get("title"),
            "content_type": row.get("content_type"),
            "mime_type": row.get("mime_type"),
            "file_size": row.get("file_size"),
            "visibility": row.get("visibility"),
            "direction": row.get("direction"),
            "shared_reason": row.get("shared_reason"),
            "created_at": created_at,
            "updated_at": updated_at,
            "thumbnail_url": thumbnail_url,
        }

    @staticmethod
    def _serialize_action_row(row: asyncpg.Record | dict) -> dict:
        created_at = row.get("created_at")
        if isinstance(created_at, datetime):
            created_at = created_at.astimezone(UTC).isoformat()
        return {
            "id": row["id"],
            "type": row["type"],
            "severity": row["severity"],
            "title": row["title"],
            "summary": row["summary"],
            "count": int(row.get("count") or 0),
            "target_tab": row.get("target_tab"),
            "target_id": row.get("target_id"),
            "created_at": created_at,
        }

    @staticmethod
    def _visible_fields_for_audience(
        privacy: dict[str, object | None], *, audience: str, circle_id: UUID | None
    ) -> list[str]:
        fields: list[str] = []
        for field in ("avatar", "full_name", "bio"):
            visibility = str(privacy.get(f"{field}_visibility") or "everyone")
            field_circle = privacy.get(f"{field}_circle_id")
            if (
                visibility == "everyone"
                or (audience == "friends" and visibility == "friends_only")
                or (
                    audience == "circle"
                    and visibility == "circle"
                    and circle_id
                    and str(field_circle) == str(circle_id)
                )
            ):
                fields.append(field)
        return fields

    @staticmethod
    def _privacy_preview_warnings(privacy: dict[str, object | None], circles_by_id: dict[str, dict]) -> list[str]:
        warnings: list[str] = []
        if privacy.get("discoverability") == "hidden":
            warnings.append("discoverability_hidden")
        for field in ("avatar", "full_name", "bio"):
            visibility = str(privacy.get(f"{field}_visibility") or "everyone")
            circle_id = privacy.get(f"{field}_circle_id")
            if visibility == "circle":
                circle = circles_by_id.get(str(circle_id)) if circle_id else None
                if circle is None:
                    warnings.append(f"{field}_circle_missing")
                elif int(circle.get("members_count") or 0) == 0:
                    warnings.append(f"{field}_circle_empty")
            elif visibility == "none":
                warnings.append(f"{field}_hidden")
        return warnings

    async def list_shared_content(
        self,
        user_id: str,
        friend_user_id: str,
        *,
        limit: int = 12,
    ) -> dict:
        viewer_uuid = self._parse_uuid(user_id)
        friend_uuid = self._parse_uuid(friend_user_id)
        if viewer_uuid is None:
            raise ValueError("Некорректный идентификатор пользователя")
        if friend_uuid is None:
            raise ValueError("Некорректный идентификатор друга")
        if viewer_uuid == friend_uuid:
            raise ValueError("Друг должен отличаться от текущего пользователя")

        bounded_limit = max(1, min(int(limit), 24))
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                WITH relationship AS (
                    SELECT
                        EXISTS (
                            SELECT 1
                            FROM friendships vf
                            JOIN friendships fv
                              ON fv.user_id = $2
                             AND fv.friend_id = $1
                            WHERE vf.user_id = $1
                              AND vf.friend_id = $2
                              AND COALESCE(vf.is_blocked, false) = false
                              AND COALESCE(fv.is_blocked, false) = false
                        ) AS can_share
                )
                SELECT
                    uc.id,
                    uc.name,
                    uc.title,
                    uc.content_type,
                    uc.mime_type,
                    uc.file_size,
                    uc.visibility,
                    uc.created_at,
                    uc.updated_at,
                    uc.thumbnail_path,
                    CASE
                        WHEN uc.user_id = $2 THEN 'from_friend'
                        ELSE 'to_friend'
                    END AS direction,
                    CASE
                        WHEN uc.visibility = 'friends' THEN 'friends_visibility'
                        WHEN COALESCE(uc.friend_visibility, false) THEN 'friend_visibility'
                        ELSE 'direct_share'
                    END AS shared_reason
                FROM unified_content uc
                CROSS JOIN relationship r
                WHERE r.can_share = true
                  AND uc.deleted_at IS NULL
                  AND COALESCE(uc.sub_type, '') <> $4
                  AND uc.user_id IN ($1, $2)
                  AND NOT EXISTS (
                      SELECT 1
                      FROM content_user_library_removals removed
                      WHERE removed.content_id = uc.id
                        AND removed.user_id = $1
                  )
                  AND (
                      (
                          uc.user_id = $2
                          AND (
                              uc.visibility = 'friends'
                              OR (
                                  uc.visibility = 'shared'
                                  AND (
                                      COALESCE(uc.friend_visibility, false)
                                      OR $1::text = ANY(COALESCE(uc.shared_with_user_ids::text[], ARRAY[]::text[]))
                                      OR EXISTS (
                                          SELECT 1
                                          FROM content_shares cs
                                          WHERE cs.content_id = uc.id
                                            AND cs.shared_with_user_id::text = $1::text
                                            AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
                                      )
                                  )
                              )
                          )
                      )
                      OR (
                          uc.user_id = $1
                          AND (
                              uc.visibility = 'friends'
                              OR (
                                  uc.visibility = 'shared'
                                  AND (
                                      COALESCE(uc.friend_visibility, false)
                                      OR $2::text = ANY(COALESCE(uc.shared_with_user_ids::text[], ARRAY[]::text[]))
                                      OR EXISTS (
                                          SELECT 1
                                          FROM content_shares cs
                                          WHERE cs.content_id = uc.id
                                            AND cs.shared_with_user_id::text = $2::text
                                            AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
                                      )
                                  )
                              )
                          )
                      )
                  )
                ORDER BY uc.updated_at DESC, uc.created_at DESC, uc.id DESC
                LIMIT $3
                """,
                viewer_uuid,
                friend_uuid,
                bounded_limit,
                CONTENT_SUBTYPE_GAF_CHAT_VOICE,
            )
        return {"items": [self._serialize_shared_content_row(row) for row in rows]}

    async def get_action_inbox(
        self,
        user_id: str,
        *,
        limit: int = 12,
    ) -> dict:
        viewer_uuid = self._parse_uuid(user_id)
        if viewer_uuid is None:
            raise ValueError("Некорректный идентификатор пользователя")

        bounded_limit = max(1, min(int(limit), 24))
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                WITH incoming AS (
                    SELECT
                        COUNT(*)::int AS item_count,
                        MAX(created_at) AS created_at
                    FROM friend_requests
                    WHERE to_user_id = $1
                      AND status = 'pending'
                ),
                stale_sent AS (
                    SELECT
                        COUNT(*)::int AS item_count,
                        MAX(created_at) AS created_at
                    FROM friend_requests
                    WHERE from_user_id = $1
                      AND status = 'pending'
                      AND created_at < NOW() - INTERVAL '7 days'
                ),
                relationship_controls AS (
                    SELECT
                        COUNT(*)::int AS item_count,
                        MAX(created_at) AS created_at
                    FROM friendships
                    WHERE user_id = $1
                      AND (COALESCE(is_muted, false) = true OR COALESCE(is_blocked, false) = true)
                ),
                privacy_settings AS (
                    SELECT
                        CASE
                            WHEN COALESCE(discoverability, 'public') = 'hidden' THEN 1 ELSE 0
                        END
                        + CASE WHEN COALESCE(avatar_visibility, 'everyone') <> 'everyone' THEN 1 ELSE 0 END
                        + CASE WHEN COALESCE(full_name_visibility, 'everyone') <> 'everyone' THEN 1 ELSE 0 END
                        + CASE WHEN COALESCE(bio_visibility, 'everyone') <> 'everyone' THEN 1 ELSE 0 END
                        AS item_count,
                        updated_at AS created_at
                    FROM user_profile_privacy
                    WHERE user_id = $1
                ),
                empty_circles AS (
                    SELECT
                        COUNT(*)::int AS item_count,
                        MAX(updated_at) AS created_at
                    FROM (
                        SELECT fc.id, fc.updated_at
                        FROM friend_circles fc
                        LEFT JOIN friend_circle_memberships fcm
                          ON fcm.circle_id = fc.id
                         AND fcm.owner_user_id = fc.owner_user_id
                        WHERE fc.owner_user_id = $1
                        GROUP BY fc.id, fc.updated_at
                        HAVING COUNT(fcm.friend_user_id) = 0
                    ) empty_circle_rows
                ),
                cards AS (
                    SELECT
                        'incoming_requests'::text AS id,
                        'incoming_requests'::text AS type,
                        'high'::text AS severity,
                        'Incoming friend requests'::text AS title,
                        'Review pending requests from people who want to connect.'::text AS summary,
                        item_count AS count,
                        'inbox'::text AS target_tab,
                        'incoming'::text AS target_id,
                        created_at
                    FROM incoming
                    WHERE item_count > 0
                    UNION ALL
                    SELECT
                        'stale_sent_requests',
                        'stale_sent_requests',
                        'medium',
                        'Stale sent requests',
                        'Follow up or cancel requests that have waited more than a week.',
                        item_count,
                        'inbox',
                        'sent',
                        created_at
                    FROM stale_sent
                    WHERE item_count > 0
                    UNION ALL
                    SELECT
                        'privacy_review',
                        'privacy_review',
                        'medium',
                        'Profile privacy review',
                        'Some public profile fields are hidden or limited by circle rules.',
                        item_count,
                        'privacy',
                        'preview',
                        created_at
                    FROM privacy_settings
                    WHERE item_count > 0
                    UNION ALL
                    SELECT
                        'relationship_controls',
                        'relationship_controls',
                        'low',
                        'Muted or blocked contacts',
                        'Review limited relationships so your feed and notifications stay intentional.',
                        item_count,
                        'friends',
                        'limited',
                        created_at
                    FROM relationship_controls
                    WHERE item_count > 0
                    UNION ALL
                    SELECT
                        'empty_circles',
                        'empty_circles',
                        'low',
                        'Empty friend lists',
                        'Add contacts or remove empty lists before using them in privacy previews.',
                        item_count,
                        'circles',
                        'empty',
                        created_at
                    FROM empty_circles
                    WHERE item_count > 0
                )
                SELECT *
                FROM cards
                ORDER BY
                    CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                    created_at DESC NULLS LAST,
                    id ASC
                LIMIT $2
                """,
                viewer_uuid,
                bounded_limit,
            )
        return {"items": [self._serialize_action_row(row) for row in rows]}

    async def get_privacy_preview(self, user_id: str) -> dict:
        viewer_uuid = self._parse_uuid(user_id)
        if viewer_uuid is None:
            raise ValueError("Некорректный идентификатор пользователя")

        async with self.db_pool.acquire() as conn:
            privacy_row = await conn.fetchrow(
                """
                SELECT
                    user_id,
                    discoverability,
                    avatar_visibility,
                    avatar_circle_id,
                    full_name_visibility,
                    full_name_circle_id,
                    bio_visibility,
                    bio_circle_id
                FROM user_profile_privacy
                WHERE user_id = $1
                """,
                viewer_uuid,
            )
            circle_rows = await conn.fetch(
                """
                SELECT
                    fc.id,
                    fc.name,
                    COUNT(fcm.friend_user_id)::int AS members_count
                FROM friend_circles fc
                LEFT JOIN friend_circle_memberships fcm
                  ON fcm.circle_id = fc.id
                 AND fcm.owner_user_id = fc.owner_user_id
                WHERE fc.owner_user_id = $1
                GROUP BY fc.id, fc.name, fc.sort_order
                ORDER BY fc.sort_order ASC, fc.name ASC
                """,
                viewer_uuid,
            )

        privacy = {
            "discoverability": privacy_row.get("discoverability") if privacy_row else "public",
            "avatar_visibility": privacy_row.get("avatar_visibility") if privacy_row else "everyone",
            "avatar_circle_id": privacy_row.get("avatar_circle_id") if privacy_row else None,
            "full_name_visibility": privacy_row.get("full_name_visibility") if privacy_row else "everyone",
            "full_name_circle_id": privacy_row.get("full_name_circle_id") if privacy_row else None,
            "bio_visibility": privacy_row.get("bio_visibility") if privacy_row else "everyone",
            "bio_circle_id": privacy_row.get("bio_circle_id") if privacy_row else None,
        }
        circles = [
            {
                "id": str(row["id"]),
                "name": row["name"],
                "members_count": int(row.get("members_count") or 0),
            }
            for row in circle_rows
        ]
        circles_by_id = {circle["id"]: circle for circle in circles}
        audiences = [
            {
                "id": "everyone",
                "label": "Everyone",
                "visible_fields": self._visible_fields_for_audience(privacy, audience="everyone", circle_id=None),
                "people_count": None,
            },
            {
                "id": "friends",
                "label": "Friends",
                "visible_fields": self._visible_fields_for_audience(privacy, audience="friends", circle_id=None),
                "people_count": None,
            },
            {
                "id": "blocked",
                "label": "Blocked contacts",
                "visible_fields": [],
                "people_count": None,
            },
        ]
        for circle in circles:
            audiences.append(
                {
                    "id": f"circle:{circle['id']}",
                    "label": circle["name"],
                    "visible_fields": self._visible_fields_for_audience(
                        privacy,
                        audience="circle",
                        circle_id=UUID(circle["id"]),
                    ),
                    "people_count": circle["members_count"],
                }
            )

        return {
            "discoverability": privacy["discoverability"],
            "fields": {
                "avatar": {
                    "visibility": privacy["avatar_visibility"],
                    "circle_id": str(privacy["avatar_circle_id"]) if privacy["avatar_circle_id"] else None,
                },
                "full_name": {
                    "visibility": privacy["full_name_visibility"],
                    "circle_id": str(privacy["full_name_circle_id"]) if privacy["full_name_circle_id"] else None,
                },
                "bio": {
                    "visibility": privacy["bio_visibility"],
                    "circle_id": str(privacy["bio_circle_id"]) if privacy["bio_circle_id"] else None,
                },
            },
            "audiences": audiences,
            "warnings": self._privacy_preview_warnings(privacy, circles_by_id),
        }

    async def list_feed(
        self,
        user_id: str,
        *,
        limit: int = 30,
        cursor: str | None = None,
        circle_id: str | None = None,
        types: list[str] | None = None,
    ) -> dict:
        viewer_uuid = self._parse_uuid(user_id)
        if viewer_uuid is None:
            raise ValueError("Некорректный идентификатор пользователя")
        cursor_dt = self._parse_cursor(cursor)
        circle_uuid = self._parse_uuid(circle_id) if circle_id else None
        if circle_id and circle_uuid is None:
            raise ValueError("Некорректный идентификатор круга")

        bounded_limit = max(1, min(int(limit), 50))
        type_filter = [item for item in (types or []) if item]

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                WITH friendship_events AS (
                    SELECT
                        'friendship:' || f.user_id::text || ':' || f.friend_id::text AS id,
                        'friendship_created'::text AS type,
                        f.created_at,
                        f.friend_id AS actor_user_id,
                        f.user_id AS target_user_id,
                        f.friend_id AS subject_user_id,
                        TRUE AS is_friend,
                        u.username,
                        u.full_name,
                        u.avatar_url,
                        (upp.user_id IS NOT NULL) AS privacy_join_present,
                        upp.discoverability,
                        upp.avatar_visibility,
                        upp.avatar_circle_id,
                        upp.full_name_visibility,
                        upp.full_name_circle_id,
                        upp.bio_visibility,
                        upp.bio_circle_id,
                        'Friendship established'::text AS summary
                    FROM friendships f
                    JOIN users u ON u.id = f.friend_id
                    LEFT JOIN user_profile_privacy upp ON upp.user_id = f.friend_id
                    WHERE f.user_id = $1
                      AND COALESCE(f.is_blocked, false) = false
                      AND ($4::uuid IS NULL OR EXISTS (
                          SELECT 1
                          FROM friend_circle_memberships fcm
                          WHERE fcm.circle_id = $4
                            AND fcm.owner_user_id = $1
                            AND fcm.friend_user_id = f.friend_id
                      ))
                ),
                request_events AS (
                    SELECT
                        'request:' || fr.id::text AS id,
                        ('friend_request_' || fr.status)::text AS type,
                        fr.created_at,
                        fr.from_user_id AS actor_user_id,
                        fr.to_user_id AS target_user_id,
                        other_user.id AS subject_user_id,
                        EXISTS (
                            SELECT 1
                            FROM friendships ff
                            WHERE ff.user_id = $1 AND ff.friend_id = other_user.id
                        ) AS is_friend,
                        other_user.username,
                        other_user.full_name,
                        other_user.avatar_url,
                        (upp.user_id IS NOT NULL) AS privacy_join_present,
                        upp.discoverability,
                        upp.avatar_visibility,
                        upp.avatar_circle_id,
                        upp.full_name_visibility,
                        upp.full_name_circle_id,
                        upp.bio_visibility,
                        upp.bio_circle_id,
                        'Friend request updated'::text AS summary
                    FROM friend_requests fr
                    JOIN users other_user
                      ON other_user.id = CASE
                          WHEN fr.from_user_id = $1 THEN fr.to_user_id
                          ELSE fr.from_user_id
                      END
                    LEFT JOIN user_profile_privacy upp ON upp.user_id = other_user.id
                    WHERE (fr.from_user_id = $1 OR fr.to_user_id = $1)
                      AND NOT EXISTS (
                          SELECT 1
                          FROM friendships blocked_f
                          WHERE (
                              (blocked_f.user_id = $1 AND blocked_f.friend_id = other_user.id)
                              OR (blocked_f.user_id = other_user.id AND blocked_f.friend_id = $1)
                          )
                            AND COALESCE(blocked_f.is_blocked, false) = true
                      )
                      AND ($4::uuid IS NULL OR EXISTS (
                          SELECT 1
                          FROM friend_circle_memberships fcm
                          WHERE fcm.circle_id = $4
                            AND fcm.owner_user_id = $1
                            AND fcm.friend_user_id = other_user.id
                      ))
                ),
                shared_content_events AS (
                    SELECT
                        'shared_content:' || uc.id::text AS id,
                        'shared_content_updated'::text AS type,
                        GREATEST(uc.updated_at, uc.created_at) AS created_at,
                        uc.user_id AS actor_user_id,
                        $1 AS target_user_id,
                        uc.user_id AS subject_user_id,
                        TRUE AS is_friend,
                        u.username,
                        u.full_name,
                        u.avatar_url,
                        (upp.user_id IS NOT NULL) AS privacy_join_present,
                        upp.discoverability,
                        upp.avatar_visibility,
                        upp.avatar_circle_id,
                        upp.full_name_visibility,
                        upp.full_name_circle_id,
                        upp.bio_visibility,
                        upp.bio_circle_id,
                        CASE
                            WHEN uc.user_id = $1 THEN 'You shared content with friends'
                            ELSE 'Shared content visible to you'
                        END::text AS summary
                    FROM unified_content uc
                    JOIN friendships vf
                      ON vf.user_id = $1
                     AND vf.friend_id = uc.user_id
                     AND COALESCE(vf.is_blocked, false) = false
                    JOIN friendships fv
                      ON fv.user_id = uc.user_id
                     AND fv.friend_id = $1
                     AND COALESCE(fv.is_blocked, false) = false
                    JOIN users u ON u.id = uc.user_id
                    LEFT JOIN user_profile_privacy upp ON upp.user_id = uc.user_id
                    WHERE uc.deleted_at IS NULL
                      AND uc.user_id <> $1
                      AND COALESCE(uc.sub_type, '') <> $6
                      AND (
                          uc.visibility = 'friends'
                          OR (
                              uc.visibility = 'shared'
                              AND (
                                  COALESCE(uc.friend_visibility, false)
                                  OR $1::text = ANY(COALESCE(uc.shared_with_user_ids::text[], ARRAY[]::text[]))
                                  OR EXISTS (
                                      SELECT 1
                                      FROM content_shares cs
                                      WHERE cs.content_id = uc.id
                                        AND cs.shared_with_user_id::text = $1::text
                                        AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
                                  )
                              )
                          )
                      )
                      AND ($4::uuid IS NULL OR EXISTS (
                          SELECT 1
                          FROM friend_circle_memberships fcm
                          WHERE fcm.circle_id = $4
                            AND fcm.owner_user_id = $1
                            AND fcm.friend_user_id = uc.user_id
                      ))
                ),
                feed AS (
                    SELECT * FROM friendship_events
                    UNION ALL
                    SELECT * FROM request_events
                    UNION ALL
                    SELECT * FROM shared_content_events
                )
                SELECT *
                FROM feed
                WHERE ($2::timestamptz IS NULL OR created_at < $2)
                  AND (CARDINALITY($3::text[]) = 0 OR type = ANY($3::text[]))
                ORDER BY created_at DESC, id DESC
                LIMIT $5
                """,
                viewer_uuid,
                cursor_dt,
                type_filter,
                circle_uuid,
                bounded_limit + 1,
                CONTENT_SUBTYPE_GAF_CHAT_VOICE,
            )
            privacy_pairs: list[tuple[UUID, UUID]] = []
            for row in rows[:bounded_limit]:
                subject_id = row.get("subject_user_id")
                if not subject_id:
                    continue
                subject_uuid = subject_id if isinstance(subject_id, UUID) else UUID(str(subject_id))
                for key in ("avatar_circle_id", "full_name_circle_id", "bio_circle_id"):
                    circle_value = row.get(key)
                    if circle_value:
                        circle_uuid_value = circle_value if isinstance(circle_value, UUID) else UUID(str(circle_value))
                        privacy_pairs.append((circle_uuid_value, subject_uuid))
            circle_hits = await batch_viewer_circle_hits(
                conn,
                viewer_user_id=viewer_uuid,
                pairs=privacy_pairs,
            )

        items = [
            self._serialize_row(row, viewer_uuid=viewer_uuid, circle_hits=circle_hits) for row in rows[:bounded_limit]
        ]
        next_cursor = None
        if len(rows) > bounded_limit and items:
            next_cursor = items[-1]["created_at"]
        return {"items": items, "next_cursor": next_cursor}
