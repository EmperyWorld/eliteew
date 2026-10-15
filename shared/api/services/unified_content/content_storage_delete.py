#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Soft delete and restore paths for Unified Content with index/RAG cleanup side effects.
# Invariants:
# - Delete permission follows owner/platform-admin/share-leave rules unchanged from monolith.
# Related:
# - api/services/unified_content/content_storage_service.py
# ---
"""Delete and restore operations for Unified Content storage."""

from __future__ import annotations

import logging
from uuid import UUID

from api.schemas.unified_content import AuditAction, Content
from api.services.unified_content.content_storage_mixin_host import ContentStorageMixinHost

logger = logging.getLogger(__name__)


class ContentStorageDeleteMixin(ContentStorageMixinHost):
    async def delete_content(
        self,
        content_id: UUID,
        user_id: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
        *,
        allow_delete_as_platform_admin: bool = False,
    ) -> bool:
        """
        Soft delete content (sets deleted_at timestamp)

        Args:
            content_id: Content UUID
            user_id: User ID (from auth)
            ip_address: Client IP for audit
            user_agent: Client user agent for audit
            allow_delete_as_platform_admin: If True, caller has verified app admin / emperyworld_admin
                (same rule as ``require_content_admin``). Allows delete when the user can read the row
                via share/public/friends but is not the owner.

        Returns:
            True if deleted

        Raises:
            PermissionError: If user lacks delete access
        """
        # Read access (owner, public, share, friends, …).
        content = await self.get_content(content_id, user_id)

        is_owner = str(content.user_id) == str(user_id)
        if is_owner or allow_delete_as_platform_admin:
            delete_audit_details: dict[str, object] = {}
            if not is_owner and allow_delete_as_platform_admin:
                delete_audit_details = {
                    "platform_admin_delete": True,
                    "content_owner_id": str(content.user_id),
                }
                logger.info(
                    "Content delete by platform admin: content_id=%s",
                    content_id,
                )

            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE unified_content
                    SET deleted_at = NOW(), updated_by = $1, updated_at = NOW()
                    WHERE id = $2
                    """,
                    user_id,
                    content_id,
                )

            await self.audit_logger.log(
                content_id=content_id,
                user_id=user_id,
                action=AuditAction.DELETED,
                details=delete_audit_details,
                ip_address=ip_address,
                user_agent=user_agent,
            )

            if self.search_service:
                try:
                    await self.search_service.delete_from_index(content_id)
                    logger.info("Content removed from Elasticsearch: %s", content_id)
                except Exception:
                    logger.exception("Failed to remove content %s from index", content_id)

            if content.project_id:
                try:
                    from api.services.marketing_project_rag_service import delete_marketing_rag_chunks_for_content

                    await delete_marketing_rag_chunks_for_content(content.project_id, content_id)
                except Exception:
                    logger.exception("Failed to remove marketing RAG vectors for %s", content_id)

            try:
                from api.services.unified_content.unified_content_qdrant_service import delete_qdrant_chunks_for_content

                await delete_qdrant_chunks_for_content(content_id)
            except Exception:
                logger.exception("Failed to remove unified content Qdrant vectors for %s", content_id)

            logger.info("Content soft deleted: %s", content_id)
            return True

        if not content.can_delete:
            msg = "Only owner can delete content"
            raise PermissionError(msg)

        from api.services.unified_content.share_service import ShareService

        share_service = ShareService(self.db_pool, self.audit_logger, self.search_service)
        await share_service.leave_shared_content(
            content_id,
            user_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        logger.info("Content removed from recipient library: %s", content_id)
        return True

    async def restore_content(
        self,
        content_id: UUID,
        user_id: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Content:
        """
        Restore soft-deleted content

        Args:
            content_id: Content UUID
            user_id: User ID (from auth)
            ip_address: Client IP for audit
            user_agent: Client user agent for audit

        Returns:
            Restored Content object

        Raises:
            PermissionError: If user lacks restore access
            ValueError: If content not found or not deleted
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM unified_content WHERE id = $1", content_id)

            if not row:
                msg = f"Content {content_id} not found"
                raise ValueError(msg)

            if str(row["user_id"]) != str(user_id):
                msg = "Only owner can restore content"
                raise PermissionError(msg)

            if not row["deleted_at"]:
                msg = f"Content {content_id} is not deleted"
                raise ValueError(msg)

            await conn.execute(
                """
                UPDATE unified_content
                SET deleted_at = NULL, updated_by = $1, updated_at = NOW()
                WHERE id = $2
                """,
                user_id,
                content_id,
            )

        # Audit log
        await self.audit_logger.log(
            content_id=content_id,
            user_id=user_id,
            action=AuditAction.RESTORED,
            details={},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        logger.info("Content restored: %s", content_id)
        restored = await self.get_content(content_id, user_id, check_permissions=False)
        try:
            from api.services.marketing_project_rag_service import index_unified_content_marketing_rag

            await index_unified_content_marketing_rag(self.db_pool, content_id)
        except Exception:
            logger.exception("Marketing RAG reindex after restore failed for %s", content_id)
        try:
            from api.services.unified_content.unified_content_qdrant_service import index_unified_content_qdrant

            await index_unified_content_qdrant(self.db_pool, content_id)
        except Exception:
            logger.exception("Unified content Qdrant reindex after restore failed for %s", content_id)
        return restored
