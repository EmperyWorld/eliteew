#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Celery task for sending the system GAF onboarding instruction once per user.
# Invariants:
# - The users row is atomically claimed before sending to avoid duplicate messages on task redelivery.
# - System GAF accounts are skipped before any side effect.
# Related:
# - api/core/oauth2_auth.py
# - api/gaf_chat/system_gaf_instruction.py
# ---
"""Celery: send system GAF onboarding instruction once per user."""

from __future__ import annotations

import logging
from uuid import UUID

from api.core.celery_async import run_celery_async
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run_send_system_gaf_onboarding(user_id: str) -> None:
    from api.core.database_manager import get_asyncpg_pool, get_database_manager
    from api.gaf_chat.constants import is_gaf_system_user_id
    from api.gaf_chat.service import GafChatService
    from api.gaf_chat.system_gaf_instruction import (
        build_instruction_body_and_metadata,
        fetch_instruction_row,
        instruction_locale_from_user_preferences,
    )

    await get_database_manager()
    pool = await get_asyncpg_pool()
    uid = UUID(str(user_id).strip())
    if is_gaf_system_user_id(str(uid)):
        return

    async with pool.acquire() as conn:
        urow = await conn.fetchrow(
            """
            UPDATE users
            SET onboarding_gaf_sent_at = NOW()
            WHERE id = $1 AND onboarding_gaf_sent_at IS NULL
            RETURNING preferences
            """,
            uid,
        )
        if urow is None:
            return

    locale = instruction_locale_from_user_preferences(urow["preferences"])
    async with pool.acquire() as conn:
        instr = await fetch_instruction_row(conn, locale)
    if instr is None and locale != "ru":
        async with pool.acquire() as conn:
            instr = await fetch_instruction_row(conn, "ru")
    if instr is None:
        return
    body_text, meta = build_instruction_body_and_metadata(
        instr["welcome_text"],
        instr["thanks_text"],
        list(instr["steps"] or []),
    )
    if not body_text.strip():
        return

    svc = GafChatService(pool)
    msg = await svc.send_service_message_to_user(str(uid), body_text, metadata=meta)
    if msg is None:
        return


@celery_app.task(name="api.tasks.onboarding_gaf.send_system_gaf_onboarding")
def send_system_gaf_onboarding(user_id: str) -> None:
    try:
        run_celery_async(_run_send_system_gaf_onboarding(user_id))
    except Exception:
        logger.exception("[ONBOARDING_GAF] task failed user_id=%s", user_id)
        raise


def schedule_system_gaf_onboarding_for_user(user_id: str) -> None:
    try:
        send_system_gaf_onboarding.delay(user_id)
    except Exception:
        logger.exception("[ONBOARDING_GAF] enqueue failed user_id=%s", user_id)
