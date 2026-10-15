#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Celery task for broadcasting the system GAF instruction template to all non-system users after admin action.
# Invariants:
# - Per-recipient Redis ledger prevents duplicate sends when Celery redelivers or retries a broadcast.
# - Broadcast pacing remains bounded to protect DB/socket load.
# Related:
# - api/routers/system_gaf_admin.py
# - api/gaf_chat/system_gaf_instruction.py
# ---
"""Celery: broadcast system GAF instruction template to all non-system users."""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import logging

from api.core.celery_async import run_celery_async
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

# Small delay between sends to smooth DB/socket load on large broadcast runs.
_BROADCAST_SEND_INTERVAL_SEC = 0.02


async def _run_broadcast_instruction_to_all_users(
    *,
    admin_user_id: str | None,
    locale: str = "ru",
) -> dict[str, int]:
    from api.core.database_manager import get_asyncpg_pool, get_database_manager
    from api.gaf_chat.constants import get_gaf_system_user_id
    from api.gaf_chat.service import GafChatService
    from api.gaf_chat.system_gaf_instruction import (
        build_instruction_body_and_metadata,
        fetch_instruction_row,
        normalize_instruction_locale,
    )

    loc = normalize_instruction_locale(locale)

    manager = await get_database_manager()
    pool = await get_asyncpg_pool()
    redis = await manager.get_redis_client()
    gaf_uid = get_gaf_system_user_id()

    logger.info(
        "[SYSTEM_GAF_BROADCAST] start admin_user_id=%s locale=%s",
        admin_user_id or "unknown",
        loc,
    )

    async with pool.acquire() as conn:
        instr = await fetch_instruction_row(conn, loc)
    if instr is None:
        logger.warning("[SYSTEM_GAF_BROADCAST] no instruction row for locale=%s", loc)
        return {"sent": 0, "failed": 0, "skipped_empty_template": 1}

    body_text, meta = build_instruction_body_and_metadata(
        instr["welcome_text"],
        instr["thanks_text"],
        list(instr["steps"] or []),
    )
    if not body_text.strip():
        logger.warning("[SYSTEM_GAF_BROADCAST] template body empty, abort")
        return {"sent": 0, "failed": 0, "skipped_empty_template": 1}
    instr_id = dict(instr).get("id") if not isinstance(instr, dict) else instr.get("id")
    broadcast_seed = f"{loc}:{instr_id or ''}:{body_text}"
    broadcast_id = hashlib.sha256(broadcast_seed.encode("utf-8")).hexdigest()[:24]

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id::text AS id
            FROM users
            WHERE COALESCE(is_system_account, false) = false
              AND id <> $1::uuid
            ORDER BY created_at NULLS LAST
            """,
            gaf_uid,
        )

    svc = GafChatService(pool)
    sent = 0
    failed = 0
    total = len(rows)
    for i, row in enumerate(rows):
        uid_s = row["id"]
        ledger_key = f"system_gaf:broadcast:{broadcast_id}:recipient:{uid_s}"
        if redis is not None:
            try:
                claimed = await redis.set(ledger_key, "in_progress", nx=True, ex=60 * 60 * 24 * 30)
            except Exception:
                logger.debug("[SYSTEM_GAF_BROADCAST] recipient ledger claim skipped user_id=%s", uid_s, exc_info=True)
                claimed = True
            if not claimed:
                continue
        try:
            msg = await svc.send_service_message_to_user(uid_s, body_text, metadata=meta)
            if msg:
                sent += 1
                if redis is not None:
                    await redis.set(ledger_key, "sent", ex=60 * 60 * 24 * 30)
            else:
                failed += 1
                if redis is not None:
                    await redis.delete(ledger_key)
        except Exception:
            failed += 1
            if redis is not None:
                with contextlib.suppress(Exception):
                    await redis.delete(ledger_key)
            logger.exception("[SYSTEM_GAF_BROADCAST] send failed user_id=%s", uid_s)
        if i + 1 < total:
            await asyncio.sleep(_BROADCAST_SEND_INTERVAL_SEC)
        if (i + 1) % 100 == 0 or (i + 1) == total:
            logger.info(
                "[SYSTEM_GAF_BROADCAST] progress %s/%s sent=%s failed=%s",
                i + 1,
                total,
                sent,
                failed,
            )

    logger.info(
        "[SYSTEM_GAF_BROADCAST] done admin_user_id=%s total=%s sent=%s failed=%s",
        admin_user_id or "unknown",
        total,
        sent,
        failed,
    )
    return {"sent": sent, "failed": failed, "total": total}


@celery_app.task(name="api.tasks.system_gaf_broadcast.broadcast_instruction_to_all_users")
def broadcast_instruction_to_all_users(
    admin_user_id: str | None = None,
    locale: str = "ru",
) -> dict[str, int]:
    try:
        return run_celery_async(
            _run_broadcast_instruction_to_all_users(
                admin_user_id=admin_user_id,
                locale=locale,
            ),
        )
    except Exception:
        logger.exception(
            "[SYSTEM_GAF_BROADCAST] task crashed admin_user_id=%s",
            admin_user_id or "unknown",
        )
        raise
