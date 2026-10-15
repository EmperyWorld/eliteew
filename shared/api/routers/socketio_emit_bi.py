#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Socket.IO emit helpers for Business Intelligence session progress rooms.
# Invariants:
# - Owner-bound room business_intelligence_{session_id}:user:{user_id}; timestamps via utc_now_iso().
# Related:
# - api/routers/socketio_handler.py
# - documentation/platform/REALTIME-SOCKETIO-AND-WS.md
# ---
"""Business Intelligence Socket.IO outbound emits."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from api.utils.datetime_helpers import utc_now_iso

logger = logging.getLogger(__name__)


def _sio():
    """Lazy AsyncServer bind — emit modules must not import sio at import time."""
    from api.routers.socketio_handler import sio

    return sio


def bi_member_room(session_id: str, user_id: str) -> str:
    return f"business_intelligence_{session_id}:user:{UUID(user_id)}"


async def bi_session_owner(session_id: str) -> str | None:
    """Fail closed using the same session store as BI, without initializing other services."""
    from api.core.database_manager import get_database_manager
    from api.services.business_intelligence.elasticsearch_service import ElasticsearchService

    try:
        manager = await get_database_manager()
        service = ElasticsearchService()
        service.client = manager.get_elasticsearch_client()
        session = await service.get_session(session_id)
        return str(UUID(str(session["user_id"]))) if session else None
    except Exception:
        logger.debug("BI subscription ownership unavailable", exc_info=True)
        return None


async def _emit_bi(event: str, session_id: str, payload: dict[str, Any]) -> None:
    owner = await bi_session_owner(session_id)
    if owner is not None:
        await _sio().emit(event, payload, room=bi_member_room(session_id, owner))


async def send_bi_progress(
    session_id: str, stage: str, progress: int, message: str, details: dict[str, Any] | None = None
) -> None:
    """Send Business Intelligence progress update"""
    channel = f"business_intelligence_{session_id}"
    await _emit_bi(
        "bi_progress",
        session_id,
        {
            "session_id": session_id,
            "stage": stage,
            "progress": progress,
            "message": message,
            "details": details or {},
            "timestamp": utc_now_iso(),
        },
    )
    logger.info("BI Progress sent to %s: %s%% - %s", channel, progress, message)


async def send_bi_completed(session_id: str, result: dict[str, Any]) -> None:
    """Send Business Intelligence completion"""
    channel = f"business_intelligence_{session_id}"
    await _emit_bi(
        "bi_completed",
        session_id,
        {"session_id": session_id, "result": result, "timestamp": utc_now_iso()},
    )
    logger.info("BI Completed sent to %s", channel)


async def send_bi_error(session_id: str, error: str) -> None:
    """Send Business Intelligence error"""
    channel = f"business_intelligence_{session_id}"
    await _emit_bi("bi_error", session_id, {"session_id": session_id, "error": error, "timestamp": utc_now_iso()})
    logger.error("BI Error sent to %s: %s", channel, error)
