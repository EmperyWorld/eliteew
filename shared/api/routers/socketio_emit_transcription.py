#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Socket.IO emit helpers for Voice Center transcription task progress rooms.
# Invariants:
# - Progress/complete/error use transcription_{task_id}; chunk events use transcription:{task_id}.
# Related:
# - api/routers/socketio_handler.py
# - documentation/platform/REALTIME-SOCKETIO-AND-WS.md
# ---
"""Voice Center transcription Socket.IO outbound emits."""

from __future__ import annotations

import logging
from typing import Any

from api.utils.datetime_helpers import utc_now_iso

logger = logging.getLogger(__name__)


def _sio():
    """Lazy AsyncServer bind — emit modules must not import sio at import time."""
    from api.routers.socketio_handler import sio

    return sio


async def send_transcription_progress(
    task_id: str, progress: int, message: str, details: dict[str, Any] | None = None
) -> None:
    """Send Voice Center transcription progress update"""
    channel = f"transcription_{task_id}"
    await _sio().emit(
        "transcription:progress",
        {
            "task_id": task_id,
            "progress": progress,
            "message": message,
            "details": details or {},
            "timestamp": utc_now_iso(),
        },
        room=channel,
    )
    logger.debug("🎤 Transcription progress sent to %s: %s%% - %s", channel, progress, message)


async def send_transcription_complete(task_id: str, result: dict[str, Any]) -> None:
    """Send Voice Center transcription completion"""
    channel = f"transcription_{task_id}"
    await _sio().emit(
        "transcription:complete",
        {"task_id": task_id, "result": result, "timestamp": utc_now_iso()},
        room=channel,
    )
    logger.info("Transcription completed sent to %s", channel)


async def send_transcription_chunk_progress(
    task_id: str, chunk_index: int, total_chunks: int, progress: int, message: str
) -> None:
    """Send chunk processing progress update"""
    channel = f"transcription:{task_id}"
    await _sio().emit(
        "transcription:chunk_progress",
        {
            "task_id": task_id,
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "progress": progress,
            "message": message,
            "timestamp": utc_now_iso(),
        },
        room=channel,
    )
    logger.debug("🎤 Chunk progress sent: chunk %s/%s - %s%% - %s", chunk_index + 1, total_chunks, progress, message)


async def send_transcription_chunk_complete(
    task_id: str, chunk_index: int, total_chunks: int, result: dict[str, Any]
) -> None:
    """Send chunk completion notification"""
    channel = f"transcription:{task_id}"
    await _sio().emit(
        "transcription:chunk_complete",
        {
            "task_id": task_id,
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "result": result,
            "timestamp": utc_now_iso(),
        },
        room=channel,
    )
    logger.debug("🎤 Chunk complete sent: chunk %s/%s", chunk_index + 1, total_chunks)


async def send_transcription_error(task_id: str, error: str) -> None:
    """Send Voice Center transcription error"""
    channel = f"transcription_{task_id}"
    await _sio().emit(
        "transcription:error",
        {"task_id": task_id, "error": error, "timestamp": utc_now_iso()},
        room=channel,
    )
    logger.error("Transcription error sent to %s: %s", channel, error)
