# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# SSE polling loop for UGS stream endpoint: progress/keep_alive until terminal status, then result/error.
# Invariants:
# - Yields event dicts with ``event`` key matching router SSE contract (started is emitted by router).
# - Does not close until result, error, or cancelled event is yielded for terminal states.
# Related:
# - api/routers/ugs/generation.py (generate_content_stream)
# - api/services/ugs/unified_generation_service.py
# ---
"""UGS SSE stream event generator (status poll loop)."""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

from api.services.queue_features import utcnow_naive


async def iter_stream_generation_events(
    *,
    request_id: str,
    get_status: Callable[[str], Awaitable[dict[str, Any]]],
    get_result: Callable[[str], Awaitable[dict[str, Any]]],
    poll_interval: float = 3.0,
    keep_alive_interval: float = 8.0,
) -> AsyncIterator[dict[str, Any]]:
    """
    Async generator yielding SSE event dicts for ``stream_generation_events``.

    ``get_status`` / ``get_result`` are bound methods on ``UnifiedGenerationService``.
    """
    last_keep_alive = time.monotonic()
    last_status: str | None = None
    st = "pending"

    while True:
        try:
            status_payload = await get_status(request_id)
        except (PermissionError, ValueError) as exc:
            yield {"event": "error", "request_id": request_id, "error": str(exc)}
            return

        st = status_payload.get("status") or "pending"
        now = time.monotonic()
        if now - last_keep_alive >= keep_alive_interval:
            yield {
                "event": "keep_alive",
                "request_id": request_id,
                "status": st,
                "stage": status_payload.get("stage"),
                "progress": status_payload.get("progress"),
                "progress_message": status_payload.get("progress_message"),
                "last_heartbeat_at": status_payload.get("last_heartbeat_at"),
                "timestamp": utcnow_naive().isoformat(),
            }
            last_keep_alive = now

        progress_event = "queued" if st == "queued" and last_status != "queued" else "progress"
        yield {
            "event": progress_event,
            "request_id": request_id,
            "status": st,
            "stage": status_payload.get("stage"),
            "progress": status_payload.get("progress"),
            "progress_message": status_payload.get("progress_message"),
            "execution_backend": status_payload.get("execution_backend"),
            "provider_name": status_payload.get("provider_name"),
            "provider_attempt": status_payload.get("provider_attempt"),
            "retry_count": status_payload.get("retry_count"),
            "last_heartbeat_at": status_payload.get("last_heartbeat_at"),
            "queued_at": status_payload.get("queued_at"),
            "estimated_completion": status_payload.get("estimated_completion"),
            "payload": status_payload,
        }
        last_status = str(st)
        if st in ("completed", "failed", "cancelled"):
            break
        await asyncio.sleep(poll_interval)

    if st == "completed":
        try:
            result_payload = await get_result(request_id)
            yield {
                "event": "result",
                "request_id": request_id,
                "status": "completed",
                "result": result_payload.get("result"),
                "result_preview": result_payload.get("result_preview"),
                "metadata": result_payload.get("metadata"),
                "data": result_payload,
            }
        except (PermissionError, ValueError) as exc:
            yield {"event": "error", "request_id": request_id, "error": str(exc)}
    elif st == "cancelled":
        yield {
            "event": "cancelled",
            "request_id": request_id,
            "status": st,
            "stage": status_payload.get("stage"),
            "progress_message": status_payload.get("progress_message") or "Запрос отменён.",
            "payload": status_payload,
        }
    else:
        yield {
            "event": "error",
            "request_id": request_id,
            "status": st,
            "stage": status_payload.get("stage"),
            "error": status_payload.get("error") or status_payload.get("error_message") or st,
            "error_type": status_payload.get("error_type"),
            "payload": status_payload,
        }
