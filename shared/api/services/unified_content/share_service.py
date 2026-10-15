#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Content sharing via `content_shares` (SSOT). Legacy `shared_with_user_ids` is read-only dual-read elsewhere.
# Invariants:
# - Mutations write only `content_shares`; do not sync the legacy array column.
# Related:
# - documentation/product/CONTENT-MANAGER.md
# - api/services/unified_content/content_access_policy.py
# ---
"""
Share Service — explicit shares and collaboration permissions.
"""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-not-found]

from api.schemas.unified_content import (
    AuditAction,
    Permission,
    Share,
    ShareCreate,
    ShareResponse,
    ShareUpdate,
)
from api.services.unified_content.audit_logger import AuditLogger
from api.services.unified_content.content_search_service import ContentSearchService

logger = logging.getLogger(__name__)


class ShareService:
    """
    Content sharing service with permission management.

    Notes:
    - `content_shares` is the SSOT for explicit shares; legacy `shared_with_user_ids` is not written here.
    - `content_shares.shared_*_user_id` are varchar fields, so we compare string IDs directly.
    - Shares are normalized to persistent DB user IDs (`users.id`) even if caller passes email.
    """

    def __init__(
        self,
        db_pool: asyncpg.Pool,
        audit_logger: AuditLogger,
        search_service: ContentSearchService | None = None,
    ):
        self.db_pool = db_pool
        self.audit_logger = audit_logger
        self.search_service = search_service

    @staticmethod
    def _is_same_user(left: Any, right: str) -> bool:
        return str(left) == str(right)

    @staticmethod
    def _map_share_record(record: asyncpg.Record) -> Share:
        return Share(
            id=record["id"],
            content_id=record["content_id"],
            shared_by=str(record["shared_by_user_id"]),
            shared_with=str(record["shared_with_user_id"]),
            permission_level=Permission(str(record["permission"])),
            expires_at=record["expires_at"],
            created_at=record["created_at"],
            accessed_at=record["accessed_at"],
            access_count=int(record["access_count"] or 0),
        )

    @classmethod
    def _map_share_response_record(cls, record: asyncpg.Record) -> ShareResponse:
        base = cls._map_share_record(record)
        return ShareResponse(
            **base.model_dump(),
            content_name=record["content_name"],
            content_type=record["content_type"],
        )

    async def _resolve_user_identifier(
        self,
        conn: asyncpg.Connection,
        user_identifier: str,
    ) -> str:
        candidate = (user_identifier or "").strip()
        if not candidate:
            raise ValueError("Share target is required")

        row = await conn.fetchrow(
            """
            SELECT id
            FROM users
            WHERE (id)::text = $1 OR LOWER(email) = LOWER($1)
            LIMIT 1
            """,
            candidate,
        )
        if not row:
            msg = f"Recipient not found: {user_identifier}"
            raise ValueError(msg)
        return str(row["id"])

    @classmethod
    async def _is_project_lead(
        cls,
        conn: asyncpg.Connection,
        project_id: Any,
        user_id: str,
    ) -> bool:
        if project_id is None:
            return False
        prow = await conn.fetchrow(
            "SELECT created_by FROM projects WHERE id = $1 AND deleted_at IS NULL",
            project_id,
        )
        return bool(prow and prow.get("created_by") is not None and cls._is_same_user(prow["created_by"], user_id))

    @classmethod
    async def _can_manage_shares_for_content(
        cls,
        conn: asyncpg.Connection,
        content: asyncpg.Record,
        user_id: str,
    ) -> bool:
        if cls._is_same_user(content["user_id"], user_id):
            return True
        return await cls._is_project_lead(conn, content.get("project_id"), user_id)

    async def _refresh_search_acl(self, content_id: UUID) -> None:
        if self.search_service is None:
            return
        try:
            await self.search_service.update_index(content_id)
        except Exception:
            logger.exception("Failed to refresh search ACL for content %s", content_id)

    async def create_share(
        self,
        content_id: UUID,
        share_data: ShareCreate,
        user_id: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Share:
        """
        Создать шаринг: владелец контента или руководитель проекта; для project_id получатель — активный участник.
        """
        async with self.db_pool.acquire() as conn, conn.transaction():
            content = await conn.fetchrow(
                """
                SELECT id, user_id, project_id
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                content_id,
            )
            if not content:
                msg = f"Content not found: {content_id}"
                raise ValueError(msg)
            if not await self._can_manage_shares_for_content(conn, content, user_id):
                raise PermissionError("Only owner or project lead can share this content")

            shared_with_user_id = await self._resolve_user_identifier(conn, share_data.shared_with)
            owner_user_id = str(content["user_id"])
            if shared_with_user_id == owner_user_id:
                raise ValueError("Owner already has access to this content")

            proj_id = content.get("project_id")
            if proj_id is not None:
                mem_ok = await conn.fetchval(
                    """
                    SELECT 1
                    FROM project_members
                    WHERE project_id = $1
                      AND user_id = $2::uuid
                      AND status = 'active'
                    LIMIT 1
                    """,
                    proj_id,
                    shared_with_user_id,
                )
                if mem_ok is None:
                    raise ValueError("Выдача доступа возможна только активному участнику проекта")

            shared_by_actor = str(user_id)

            existing = await conn.fetchrow(
                """
                SELECT id
                FROM content_shares
                WHERE content_id = $1 AND shared_with_user_id = $2
                """,
                content_id,
                shared_with_user_id,
            )
            if existing:
                msg = f"Already shared with user: {share_data.shared_with}"
                raise ValueError(msg)

            share_id = uuid4()
            now = datetime.now(UTC)
            share_record = await conn.fetchrow(
                """
                INSERT INTO content_shares (
                    id,
                    content_id,
                    shared_by_user_id,
                    shared_with_user_id,
                    permission,
                    expires_at,
                    created_at,
                    accessed_at,
                    access_count
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, 0)
                RETURNING *
                """,
                share_id,
                content_id,
                shared_by_actor,
                shared_with_user_id,
                share_data.permission_level.value,
                share_data.expires_at,
                now,
            )
            assert share_record is not None

            await self.audit_logger.log(
                content_id=content_id,
                user_id=shared_by_actor,
                action=AuditAction.SHARED,
                details={
                    "share_id": str(share_id),
                    "shared_with": shared_with_user_id,
                    "permission_level": share_data.permission_level.value,
                    "expires_at": share_data.expires_at.isoformat() if share_data.expires_at else None,
                },
                ip_address=ip_address,
                user_agent=user_agent,
            )

        await self._refresh_search_acl(content_id)
        logger.info(
            "Share created: %s | Content: %s | With: %s | Permission: %s",
            share_id,
            content_id,
            shared_with_user_id,
            share_data.permission_level.value,
        )
        return self._map_share_record(share_record)

    async def ensure_gaf_partner_view_share(
        self,
        content_id: UUID,
        owner_user_id: str,
        recipient_user_id: str,
    ) -> None:
        """
        Grant VIEW to the 1:1 GAF chat partner for the sender's attachment.

        ``create_share`` rejects when ``unified_content.project_id`` is set and the
        recipient is not in ``project_members`` — that blocked chat previews for recipients.
        This path only verifies ownership (caller must be the content owner).
        """
        async with self.db_pool.acquire() as conn, conn.transaction():
            content = await conn.fetchrow(
                """
                SELECT id, user_id
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                content_id,
            )
            if not content:
                msg = f"Content not found: {content_id}"
                raise ValueError(msg)
            if not self._is_same_user(content["user_id"], owner_user_id):
                raise PermissionError("Only the content owner can grant GAF attachment access")

            recipient_id = await self._resolve_user_identifier(conn, recipient_user_id)
            owner_id = str(content["user_id"])
            if recipient_id == owner_id:
                return

            existing = await conn.fetchrow(
                """
                SELECT id FROM content_shares
                WHERE content_id = $1 AND shared_with_user_id = $2
                """,
                content_id,
                recipient_id,
            )
            if existing:
                return

            share_id = uuid4()
            now = datetime.now(UTC)
            shared_by = str(owner_user_id)
            await conn.execute(
                """
                INSERT INTO content_shares (
                    id,
                    content_id,
                    shared_by_user_id,
                    shared_with_user_id,
                    permission,
                    expires_at,
                    created_at,
                    accessed_at,
                    access_count
                )
                VALUES ($1, $2, $3, $4, $5, NULL, $6, NULL, 0)
                """,
                share_id,
                content_id,
                shared_by,
                recipient_id,
                Permission.VIEW.value,
                now,
            )

            await self.audit_logger.log(
                content_id=content_id,
                user_id=shared_by,
                action=AuditAction.SHARED,
                details={
                    "share_id": str(share_id),
                    "shared_with": recipient_id,
                    "permission_level": Permission.VIEW.value,
                    "source": "gaf_chat_attachment",
                },
                ip_address=None,
                user_agent=None,
            )

        await self._refresh_search_acl(content_id)
        logger.info(
            "GAF attachment VIEW share ensured | content=%s | with=%s",
            content_id,
            recipient_id,
        )

    async def list_content_shares(self, content_id: UUID, user_id: str) -> list[Share]:
        """
        List all shares for a content (owner or project lead for project-scoped content).
        """
        async with self.db_pool.acquire() as conn:
            content = await conn.fetchrow(
                "SELECT user_id, project_id FROM unified_content WHERE id = $1 AND deleted_at IS NULL",
                content_id,
            )
            if not content:
                msg = f"Content not found: {content_id}"
                raise ValueError(msg)
            if not await self._can_manage_shares_for_content(conn, content, user_id):
                raise PermissionError("Only owner or project lead can list shares")

            shares = await conn.fetch(
                """
                SELECT *
                FROM content_shares
                WHERE content_id = $1
                ORDER BY created_at DESC
                """,
                content_id,
            )
        return [self._map_share_record(share) for share in shares]

    async def update_share(
        self,
        share_id: UUID,
        share_update: ShareUpdate,
        user_id: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Share:
        """
        Update share (content owner or project lead for project-scoped content).
        """
        async with self.db_pool.acquire() as conn, conn.transaction():
            share = await conn.fetchrow(
                """
                SELECT cs.*, uc.user_id AS content_owner, uc.id AS unified_content_id,
                       uc.project_id AS content_project_id
                FROM content_shares cs
                JOIN unified_content uc ON cs.content_id = uc.id
                WHERE cs.id = $1
                """,
                share_id,
            )
            if not share:
                msg = f"Share not found: {share_id}"
                raise ValueError(msg)
            if not await self._can_manage_shares_for_content(
                conn,
                {"user_id": share["content_owner"], "project_id": share.get("content_project_id")},
                user_id,
            ):
                raise PermissionError("Only owner or project lead can update share")

            update_fields: list[str] = []
            update_values: list[Any] = []
            param_count = 1

            if share_update.permission_level is not None:
                update_fields.append(f"permission = ${param_count}")
                update_values.append(share_update.permission_level.value)
                param_count += 1
            if share_update.expires_at is not None:
                update_fields.append(f"expires_at = ${param_count}")
                update_values.append(share_update.expires_at)
                param_count += 1

            if not update_fields:
                return self._map_share_record(share)

            update_values.append(share_id)
            updated_share = await conn.fetchrow(
                f"""
                UPDATE content_shares
                SET {", ".join(update_fields)}
                WHERE id = ${param_count}
                RETURNING *
                """,  # noqa: S608
                *update_values,
            )
            assert updated_share is not None

            content_id = UUID(str(share["unified_content_id"]))
            await self.audit_logger.log(
                content_id=content_id,
                user_id=str(user_id),
                action=AuditAction.UPDATED,
                details={
                    "share_id": str(share_id),
                    "updated_fields": share_update.model_dump(exclude_none=True),
                },
                ip_address=ip_address,
                user_agent=user_agent,
            )

        await self._refresh_search_acl(content_id)
        logger.info("Share updated: %s", share_id)
        return self._map_share_record(updated_share)

    async def delete_share(
        self,
        share_id: UUID,
        user_id: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> bool:
        """
        Revoke share (content owner or project lead for project-scoped content).
        """
        async with self.db_pool.acquire() as conn, conn.transaction():
            share = await conn.fetchrow(
                """
                SELECT cs.*, uc.user_id AS content_owner, uc.id AS unified_content_id,
                       uc.project_id AS content_project_id
                FROM content_shares cs
                JOIN unified_content uc ON cs.content_id = uc.id
                WHERE cs.id = $1
                """,
                share_id,
            )
            if not share:
                msg = f"Share not found: {share_id}"
                raise ValueError(msg)
            if not await self._can_manage_shares_for_content(
                conn,
                {"user_id": share["content_owner"], "project_id": share.get("content_project_id")},
                user_id,
            ):
                raise PermissionError("Only owner or project lead can revoke share")

            content_id = UUID(str(share["unified_content_id"]))
            await conn.execute("DELETE FROM content_shares WHERE id = $1", share_id)
            await self.audit_logger.log(
                content_id=content_id,
                user_id=str(user_id),
                action=AuditAction.UNSHARED,
                details={
                    "share_id": str(share_id),
                    "shared_with": str(share["shared_with_user_id"]),
                },
                ip_address=ip_address,
                user_agent=user_agent,
            )

        await self._refresh_search_acl(content_id)
        logger.info("Share revoked: %s", share_id)
        return True

    async def leave_shared_content(
        self,
        content_id: UUID,
        recipient_user_id: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> bool:
        """
        Remove recipient access without deleting owner content.

        - Drops ``content_shares`` row for the recipient (SSOT; legacy array is not mutated).
        - For friend-visible catalogue entries without an explicit share row, records
          ``content_user_library_removals`` so list/search hide the item for this user only.
        """
        recipient_id = str(recipient_user_id).strip()
        if not recipient_id:
            msg = "recipient_user_id is required"
            raise ValueError(msg)

        async with self.db_pool.acquire() as conn, conn.transaction():
            content = await conn.fetchrow(
                """
                SELECT id, user_id, visibility, friend_visibility, shared_with_user_ids
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                content_id,
            )
            if not content:
                msg = f"Content not found: {content_id}"
                raise ValueError(msg)
            if self._is_same_user(content["user_id"], recipient_id):
                msg = "Content owner must use delete_content"
                raise PermissionError(msg)

            removed = False
            share = await conn.fetchrow(
                """
                SELECT id FROM content_shares
                WHERE content_id = $1 AND shared_with_user_id = $2
                """,
                content_id,
                recipient_id,
            )
            if share:
                await conn.execute("DELETE FROM content_shares WHERE id = $1", share["id"])
                removed = True
                await self.audit_logger.log(
                    content_id=content_id,
                    user_id=recipient_id,
                    action=AuditAction.UNSHARED,
                    details={
                        "recipient_self_remove": True,
                        "share_id": str(share["id"]),
                    },
                    ip_address=ip_address,
                    user_agent=user_agent,
                )

            if not removed:
                visibility = str(content["visibility"] or "")
                friend_vis = bool(content["friend_visibility"])
                can_dismiss = False
                if visibility == "friends":
                    can_dismiss = bool(
                        await conn.fetchval(
                            "SELECT check_mutual_friendship($1::uuid, $2::uuid)",
                            content["user_id"],
                            UUID(recipient_id),
                        )
                    )
                elif (
                    visibility == "shared"
                    and friend_vis
                    and await conn.fetchval(
                        "SELECT check_mutual_friendship($1::uuid, $2::uuid)",
                        content["user_id"],
                        UUID(recipient_id),
                    )
                ):
                    share_rows = await conn.fetch(
                        """
                        SELECT shared_with_user_id
                        FROM content_shares
                        WHERE content_id = $1
                          AND (expires_at IS NULL OR expires_at > NOW())
                        """,
                        content_id,
                    )
                    explicit_ids = {str(row["shared_with_user_id"]) for row in share_rows}
                    legacy_ids = {str(item) for item in (content["shared_with_user_ids"] or [])}
                    combined = explicit_ids | legacy_ids
                    can_dismiss = not combined or recipient_id in combined
                if not can_dismiss:
                    msg = "Cannot remove this content from your library"
                    raise PermissionError(msg)

                await conn.execute(
                    """
                    INSERT INTO content_user_library_removals (user_id, content_id)
                    VALUES ($1::uuid, $2::uuid)
                    ON CONFLICT (user_id, content_id) DO NOTHING
                    """,
                    UUID(recipient_id),
                    content_id,
                )
                await self.audit_logger.log(
                    content_id=content_id,
                    user_id=recipient_id,
                    action=AuditAction.REMOVED_FROM_LIBRARY,
                    details={"visibility": visibility, "friend_visibility": friend_vis},
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
                removed = True

        await self._refresh_search_acl(content_id)
        logger.info(
            "Recipient removed content from library | content=%s | user=%s",
            content_id,
            recipient_id,
        )
        return removed

    async def list_received_shares(
        self, user_id: str, permission_filter: Permission | None = None
    ) -> list[ShareResponse]:
        """
        List all non-expired shares received by user.
        """
        async with self.db_pool.acquire() as conn:
            query = """
                SELECT
                    cs.*,
                    uc.name AS content_name,
                    uc.content_type
                FROM content_shares cs
                JOIN unified_content uc ON cs.content_id = uc.id
                WHERE cs.shared_with_user_id = $1
                  AND uc.deleted_at IS NULL
                  AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
            """
            params: list[Any] = [user_id]
            if permission_filter:
                query += " AND cs.permission = $2"
                params.append(permission_filter.value)
            query += " ORDER BY cs.created_at DESC"
            shares = await conn.fetch(query, *params)
        return [self._map_share_response_record(share) for share in shares]

    async def track_access(self, share_id: UUID, user_id: str) -> Share:
        """
        Track share access (increment counter, update timestamp).
        """
        async with self.db_pool.acquire() as conn:
            share = await conn.fetchrow("SELECT * FROM content_shares WHERE id = $1", share_id)
            if not share:
                msg = f"Share not found: {share_id}"
                raise ValueError(msg)
            if str(share["shared_with_user_id"]) != str(user_id):
                raise PermissionError("Access denied")
            if share["expires_at"] and datetime.now(UTC) > share["expires_at"]:
                raise ValueError("Share has expired")

            updated_share = await conn.fetchrow(
                """
                UPDATE content_shares
                SET accessed_at = $1, access_count = access_count + 1
                WHERE id = $2
                RETURNING *
                """,
                datetime.now(UTC),
                share_id,
            )
            assert updated_share is not None
        return self._map_share_record(updated_share)

    async def check_permission(
        self, content_id: UUID, user_id: str, required_permission: Permission = Permission.VIEW
    ) -> bool:
        """
        Check if user has required permission for content.
        """
        async with self.db_pool.acquire() as conn:
            content = await conn.fetchrow(
                "SELECT user_id, visibility FROM unified_content WHERE id = $1 AND deleted_at IS NULL",
                content_id,
            )
            if not content:
                return False

            if self._is_same_user(content["user_id"], user_id):
                return True
            if content["visibility"] == "public" and required_permission == Permission.VIEW:
                return True

            share = await conn.fetchrow(
                """
                SELECT permission, expires_at
                FROM content_shares
                WHERE content_id = $1 AND shared_with_user_id = $2
                """,
                content_id,
                user_id,
            )
            if not share:
                return False
            if share["expires_at"] and datetime.now(UTC) > share["expires_at"]:
                return False

            permission_hierarchy = {Permission.VIEW: 1, Permission.EDIT: 2, Permission.ADMIN: 3}
            user_permission_level = permission_hierarchy.get(Permission(str(share["permission"])), 0)
            required_level = permission_hierarchy.get(required_permission, 0)
            return user_permission_level >= required_level
