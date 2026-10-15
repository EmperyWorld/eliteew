# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Redis pub/sub bridge for companion task SSE events (Phase 2): Celery worker → API stream.
# Invariants:
# - Channel per principal: ``ewa:companion:task_events:{principal_id}``; payload is JSON with ``event`` + ``data``.
# - Best-effort publish; failures must not break job execution.
# Related:
# - api/ewa_platform/companion/turn/stream_events.py
# - documentation/product/ewa/EWA-COMPANION-BACKGROUND-ORCHESTRATION-MASTER-PLAN.md §6.3
# ---

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
from collections.abc import AsyncIterator, Mapping
from typing import Any

logger = logging.getLogger(__name__)

_CHANNEL_PREFIX = "ewa:companion:task_events:"


def task_events_channel(principal_id: str) -> str:
    return f"{_CHANNEL_PREFIX}{str(principal_id or '').strip()}"


def format_task_sse_event(event_name: str, payload: Mapping[str, Any]) -> str:
    """Format one SSE block for companion task lifecycle events."""

    body = json.dumps(dict(payload), ensure_ascii=False, separators=(",", ":"))
    return f"event: {event_name}\ndata: {body}\n\n"


def publish_task_event_sync(
    *,
    principal_id: str,
    event_name: str,
    payload: Mapping[str, Any],
) -> None:
    """Best-effort Redis PUBLISH (sync — safe from Celery worker)."""

    pid = str(principal_id or "").strip()
    if not pid:
        return
    try:
        import redis

        from api.tasks.celery_app import get_redis_url

        raw_db = os.environ.get("CELERY_REDIS_DB", "0")
        try:
            db_index = int(raw_db)
        except ValueError:
            db_index = 0
        redis_url = get_redis_url(db_index)
        if not redis_url.strip():
            return
        message = json.dumps({"event": event_name, "data": dict(payload)}, ensure_ascii=False)
        cli = redis.Redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=1.0, socket_timeout=1.0)
        try:
            cli.publish(task_events_channel(pid), message)
        finally:
            cli.connection_pool.disconnect()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_task_event_publish_failed event=%s err=%s", event_name, exc)
        from api.ewa_platform.companion.orchestration.execution_ledger import record_persist_failure

        record_persist_failure(
            "sse",
            "task_event_publish_failed",
            reason_message_ru="Не удалось отправить событие задачи в поток — обновите панель операций.",
            reason_message_en="Failed to publish task event to the stream — refresh the operations panel.",
            refs={"event": event_name, "principal_id": pid},
        )


async def publish_task_event_async(
    *,
    principal_id: str,
    event_name: str,
    payload: Mapping[str, Any],
) -> None:
    """Non-blocking Redis publish from async API/Celery-adjacent coroutines."""

    await asyncio.to_thread(
        publish_task_event_sync,
        principal_id=principal_id,
        event_name=event_name,
        payload=payload,
    )


def task_event_payload_run_id(payload: Mapping[str, Any]) -> str:
    """Resolve durable run id from a task SSE payload (multiple legacy keys)."""

    for key in ("run_id", "task_run_id", "id"):
        raw = payload.get(key)
        if raw is not None and str(raw).strip():
            return str(raw).strip()
    task_run = payload.get("task_run")
    if isinstance(task_run, Mapping):
        nested = task_run.get("id")
        if nested is not None and str(nested).strip():
            return str(nested).strip()
    return ""


def format_run_snapshot_sse_event(run: Mapping[str, Any]) -> str:
    """Initial reconnect snapshot for a single task run (Phase 5.5)."""

    return format_task_sse_event("run_snapshot", {"run": dict(run)})


async def iter_task_events_sse(
    *,
    principal_id: str,
    stop_event: Any | None = None,
    run_id_filter: str | None = None,
) -> AsyncIterator[str]:
    """Subscribe to Redis task events for one principal; yield SSE-formatted strings."""

    pid = str(principal_id or "").strip()
    if not pid:
        return
    filter_run_id = str(run_id_filter or "").strip()
    try:
        import redis.asyncio as aioredis
        from redis.exceptions import RedisError

        from api.tasks.celery_app import get_redis_url

        raw_db = os.environ.get("CELERY_REDIS_DB", "0")
        try:
            db_index = int(raw_db)
        except ValueError:
            db_index = 0
        redis_url = get_redis_url(db_index)
        if not redis_url.strip():
            return
        cli = aioredis.from_url(redis_url, decode_responses=True)
        pubsub = cli.pubsub()
        await pubsub.subscribe(task_events_channel(pid))
        try:
            while True:
                if stop_event is not None and getattr(stop_event, "is_set", lambda: False)():
                    break
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if not msg or msg.get("type") != "message":
                    continue
                raw = msg.get("data")
                if not isinstance(raw, str):
                    continue
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if not isinstance(parsed, dict):
                    continue
                event_name = str(parsed.get("event") or "").strip()
                data = parsed.get("data")
                if not event_name or not isinstance(data, dict):
                    continue
                if filter_run_id and task_event_payload_run_id(data) != filter_run_id:
                    continue
                yield format_task_sse_event(event_name, data)
        finally:
            with contextlib.suppress(RedisError, OSError):
                await pubsub.unsubscribe(task_events_channel(pid))
                await pubsub.close()
                await cli.aclose()
    except Exception as exc:  # noqa: BLE001
        logger.debug("[STEP] companion_task_event_subscribe_failed principal=%s err=%s", pid, exc)


__all__ = (
    "format_run_snapshot_sse_event",
    "format_task_sse_event",
    "iter_task_events_sse",
    "publish_task_event_async",
    "publish_task_event_sync",
    "task_event_payload_run_id",
    "task_events_channel",
)
