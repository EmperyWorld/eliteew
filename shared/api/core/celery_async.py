# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Run async coroutines inside Celery prefork workers on a process-persistent event
# loop so loop-bound clients (HTTP, DatabaseManager, EWA asyncpg) can be reused (E4).
# Invariants:
# - One event loop per worker process; do not ``asyncio.run`` (new loop) per task.
# - Per-task cleanup of HTTP/DB/EWA pools is forbidden — close only on worker shutdown.
# - Drop stale module-level client refs when the event loop identity changes.
# - Prefork mode is marked so DatabaseManager does not start a background health
#   monitor (wait_for deadlines are monotonic and expire while the loop is stopped
#   between ``run_until_complete`` calls → false ES TimeoutError on one ForkPoolWorker).
# Related:
# - api/core/http_clients.py
# - api/core/database_manager.py
# - api/ewa_platform/workers/ewa_pool.py
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (E4 / V-H6)
# ---

from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

_T = TypeVar("_T")

_worker_loop: asyncio.AbstractEventLoop | None = None
_celery_worker_mode: bool = False


def mark_celery_worker_mode() -> None:
    """Mark this process as a Celery prefork worker (call from worker_process_init)."""

    global _celery_worker_mode
    _celery_worker_mode = True


def is_celery_worker_mode() -> bool:
    """True when this process is a Celery prefork child (or parent after init mark)."""

    return _celery_worker_mode


def ensure_celery_worker_loop() -> asyncio.AbstractEventLoop:
    """Return (creating if needed) the process-persistent event loop for this worker."""

    global _worker_loop
    mark_celery_worker_mode()
    loop = _worker_loop
    if loop is not None and not loop.is_closed():
        return loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    _worker_loop = loop
    logger.info("[STEP] celery_worker_loop_opened")
    return loop


async def _cleanup_celery_async_resources() -> None:
    """Full teardown for worker shutdown (not per-task)."""

    from api.core.database_manager import db_manager
    from api.core.http_clients import close_http_clients

    try:
        from api.ewa_platform.workers.ewa_pool import close_ewa_worker_pool

        await close_ewa_worker_pool()
    except Exception:
        logger.debug("celery_async: close_ewa_worker_pool failed", exc_info=True)

    try:
        await close_http_clients()
    except Exception:
        logger.debug("celery_async: close_http_clients failed", exc_info=True)

    if db_manager.is_initialized:
        try:
            await db_manager.close_all_connections()
        except Exception:
            logger.debug("celery_async: close_all_connections failed", exc_info=True)


def shutdown_celery_async_resources() -> None:
    """Close process-level async resources and the worker event loop (Celery shutdown)."""

    global _worker_loop
    loop = _worker_loop
    if loop is None or loop.is_closed():
        _worker_loop = None
        return
    try:
        loop.run_until_complete(_cleanup_celery_async_resources())
    except Exception:
        logger.debug("celery_async: shutdown cleanup failed", exc_info=True)
    try:
        loop.close()
    except Exception:
        logger.debug("celery_async: loop.close failed", exc_info=True)
    _worker_loop = None
    logger.info("[STEP] celery_worker_loop_closed")


async def _run_with_loop_clients(coro: Coroutine[Any, Any, _T]) -> _T:  # noqa: UP047
    from api.core.http_clients import drop_http_clients_for_closed_loop, init_http_clients

    # Drop only when the owning loop closed/changed; same persistent loop keeps clients.
    drop_http_clients_for_closed_loop()
    await init_http_clients()
    return await coro


def run_celery_async(coro: Coroutine[Any, Any, _T]) -> _T:  # noqa: UP047
    """Run ``coro`` on the process-persistent worker event loop (E4)."""

    loop = ensure_celery_worker_loop()
    return loop.run_until_complete(_run_with_loop_clients(coro))


__all__ = [
    "ensure_celery_worker_loop",
    "is_celery_worker_mode",
    "mark_celery_worker_mode",
    "run_celery_async",
    "shutdown_celery_async_resources",
]
