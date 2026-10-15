#!/usr/bin/env python3
"""
Audit Logger Service
Unified Content System - Phase 1 Week 2

Logs all content operations for compliance and security auditing.
"""

import json
import logging
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class AuditLogger:
    """
    Audit logging service for content operations

    Tracks all actions: created, updated, deleted, shared, accessed, etc.
    """

    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool

    async def log(
        self,
        content_id: UUID,
        user_id: str,
        action: str,
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> UUID | None:
        """
        Log an audit event

        Args:
            content_id: Content UUID
            user_id: User ID performing the action
            action: Action type (created, updated, deleted, shared, accessed_view, accessed_download, etc.)
            details: Optional action-specific details (JSONB)
            ip_address: Client IP address
            user_agent: Client user agent string

        Returns:
            UUID of created audit log entry
        """
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    INSERT INTO content_audit_log (
                        content_id, user_id, action, details,
                        ip_address, user_agent, created_at
                    )
                    VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW())
                    RETURNING id
                    """,
                    content_id,
                    user_id,
                    action,
                    json.dumps(details or {}),
                    ip_address,
                    user_agent,
                )

                if row is None:
                    logger.error("Failed to create audit log: no row returned")
                    return None

                log_id = row["id"]
                logger.debug(
                    "Audit log created: %s | Action: %s | Content: %s | User: %s",
                    log_id,
                    action,
                    content_id,
                    user_id,
                )
                return log_id

        except Exception:
            logger.exception("Failed to create audit log")
            # Don't fail the main operation if audit logging fails
            # Just log the error and continue
            return None

    async def get_content_history(self, content_id: UUID, limit: int = 100) -> list:
        """
        Get audit history for specific content

        Args:
            content_id: Content UUID
            limit: Maximum number of entries to return

        Returns:
            List of audit log entries (newest first)
        """
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, user_id, action, details, ip_address,
                       user_agent, created_at
                FROM content_audit_log
                WHERE content_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                content_id,
                limit,
            )
            return [dict(row) for row in rows]

    async def list_activity_feed(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        """
        Recent content_audit_log rows for the acting user (Content Manager activity panel).
        """
        uid = str(user_id).strip()
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT cal.id::text AS id,
                       cal.content_id,
                       cal.action,
                       cal.details,
                       cal.created_at,
                       uc.name AS content_name
                FROM content_audit_log cal
                LEFT JOIN unified_content uc ON uc.id = cal.content_id
                WHERE (cal.user_id)::text = $1
                ORDER BY cal.created_at DESC
                LIMIT $2
                """,
                uid,
                limit,
            )
            return [dict(row) for row in rows]

    async def get_user_activity(self, user_id: str, limit: int = 100) -> list:
        """
        Get user's recent activity across all content

        Args:
            user_id: User ID
            limit: Maximum number of entries to return

        Returns:
            List of audit log entries (newest first)
        """
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, content_id, action, details, ip_address,
                       user_agent, created_at
                FROM content_audit_log
                WHERE user_id = $1::uuid
                ORDER BY created_at DESC
                LIMIT $2
                """,
                user_id,
                limit,
            )
            return [dict(row) for row in rows]
