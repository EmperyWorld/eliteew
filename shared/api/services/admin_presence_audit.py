"""Запись аудита команд админки «Онлайн» (POST /desktop/admin/presence/command)."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def insert_presence_command_audit(
    *,
    admin_id: str,
    admin_email: str | None,
    target_user_id: str,
    action: str,
    delivered: int,
) -> None:
    from api.core.database_manager import get_asyncpg_pool

    pool = await get_asyncpg_pool()
    if not pool:
        logger.warning("admin presence audit: no asyncpg pool")
        return
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO admin_presence_command_audit
                    (admin_id, admin_email, target_user_id, action, delivered)
                VALUES ($1, $2, $3, $4, $5)
                """,
                admin_id,
                (admin_email or "").strip() or None,
                target_user_id,
                action,
                int(delivered),
            )
    except Exception:
        logger.exception(
            "admin presence audit insert failed admin_id=%s target=%s action=%s",
            admin_id,
            target_user_id,
            action,
        )
