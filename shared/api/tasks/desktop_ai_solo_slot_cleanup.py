"""Celery: periodically clear solo hero/prompt on expired solo slots (optional UX cleanup)."""

from __future__ import annotations

import logging

from api.core.celery_async import run_celery_async
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run_cleanup_expired_solo_slot_heroes() -> None:
    from api.core.database_manager import get_asyncpg_pool, get_database_manager

    await get_database_manager()
    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        status = await conn.execute(
            """
            UPDATE desktop_ai_chats
            SET
              system_prompt_override = NULL,
              llama_model = NULL,
              settings = COALESCE(settings, '{}'::jsonb) - 'desktop_hero_id',
              updated_at = NOW()
            WHERE solo_slot_ends_at IS NOT NULL
              AND solo_slot_ends_at < NOW()
              AND COALESCE(settings->>'desktop_chat_mode', 'solo') <> 'ensemble'
              AND (
                system_prompt_override IS NOT NULL
                OR llama_model IS NOT NULL
                OR (COALESCE(settings, '{}'::jsonb) ? 'desktop_hero_id')
              )
            """
        )
        cnt = 0
        if isinstance(status, str):
            parts = status.split()
            if len(parts) >= 2 and parts[0] == "UPDATE":
                try:
                    cnt = int(parts[1])
                except ValueError:
                    cnt = 0
        if cnt:
            logger.info("[SOLO_SLOT_CLEANUP] cleared hero fields on %s chat(s)", cnt)


@celery_app.task(name="api.tasks.desktop_ai_solo_slot_cleanup.cleanup_expired_solo_slot_heroes")
def cleanup_expired_solo_slot_heroes() -> None:
    try:
        run_celery_async(_run_cleanup_expired_solo_slot_heroes())
    except Exception:
        logger.exception("[SOLO_SLOT_CLEANUP] task failed")
        raise
