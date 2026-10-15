# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Process-level EWA Postgres pool for Celery workers (E4 / V-H6).
# Invariants:
# - One asyncpg pool per worker process + event loop; tasks must not close it.
# - Requires persistent Celery event loop (``run_celery_async``); pool is loop-bound.
# - Shutdown closes the pool via ``close_ewa_worker_pool``.
# Related:
# - api/core/celery_async.py
# - api/ewa_platform/bootstrap/data_plane.py
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (E4 / V-H6)
# ---

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

from api.ewa_platform.bootstrap.data_plane import init_ewa_data_plane
from api.ewa_platform.persistence_pg.orchestration_asyncpg import open_ewa_orchestration_pool

logger = logging.getLogger(__name__)

_pool: Any | None = None
_pool_loop_id: int | None = None
_pool_min_size: int = 1
_pool_max_size: int = 4


def ewa_worker_pool_max_size() -> int:
    raw = os.environ.get("EWA_CELERY_POOL_MAX_SIZE", "").strip()
    if raw:
        try:
            return max(1, min(32, int(raw)))
        except ValueError:
            pass
    return 4


def ewa_worker_pool_min_size() -> int:
    raw = os.environ.get("EWA_CELERY_POOL_MIN_SIZE", "").strip()
    if raw:
        try:
            return max(1, min(ewa_worker_pool_max_size(), int(raw)))
        except ValueError:
            pass
    return 1


def _pool_is_closed(pool: Any) -> bool:
    closed = getattr(pool, "_closed", None)
    if isinstance(closed, bool):
        return closed
    is_closing = getattr(pool, "is_closing", None)
    if callable(is_closing):
        try:
            return bool(is_closing())
        except Exception:
            return False
    return False


async def get_ewa_worker_pool(
    *,
    min_size: int | None = None,
    max_size: int | None = None,
) -> Any:  # noqa: ANN401
    """Return the process-level EWA pool for the current event loop (create if needed)."""

    global _pool, _pool_loop_id, _pool_min_size, _pool_max_size

    dsn = os.getenv("EWA_DATABASE_URL", "").strip()
    if not dsn:
        raise RuntimeError("EWA_DATABASE_URL_unset")

    loop = asyncio.get_running_loop()
    loop_id = id(loop)
    want_min = min_size if min_size is not None else ewa_worker_pool_min_size()
    want_max = max_size if max_size is not None else ewa_worker_pool_max_size()
    want_max = max(want_min, want_max)

    if (
        _pool is not None
        and _pool_loop_id == loop_id
        and not _pool_is_closed(_pool)
        and _pool_min_size == want_min
        and _pool_max_size == want_max
    ):
        return _pool

    if _pool is not None and not _pool_is_closed(_pool):
        try:
            await _pool.close()
        except Exception:
            logger.debug("[STEP] ewa_worker_pool_recreate_close_failed", exc_info=True)
        _pool = None
        _pool_loop_id = None

    started = time.perf_counter()
    pool = await open_ewa_orchestration_pool(dsn, min_size=want_min, max_size=want_max)
    await init_ewa_data_plane(pool)
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    _pool = pool
    _pool_loop_id = loop_id
    _pool_min_size = want_min
    _pool_max_size = want_max
    logger.info(
        "[STEP] ewa_worker_pool_opened elapsed_ms=%s min_size=%s max_size=%s reused=0",
        elapsed_ms,
        want_min,
        want_max,
    )
    return pool


async def open_initialized_ewa_worker_pool(*, min_size: int = 1, max_size: int = 4) -> Any:  # noqa: ANN401
    """Compatibility alias — returns the process-level pool; do not close after each task."""

    return await get_ewa_worker_pool(min_size=min_size, max_size=max_size)


async def close_ewa_worker_pool() -> None:
    """Close the process-level pool (worker shutdown / tests)."""

    global _pool, _pool_loop_id
    pool = _pool
    _pool = None
    _pool_loop_id = None
    if pool is None or _pool_is_closed(pool):
        return
    try:
        await pool.close()
        logger.info("[STEP] ewa_worker_pool_closed")
    except Exception:
        logger.debug("[STEP] ewa_worker_pool_close_failed", exc_info=True)


def reset_ewa_worker_pool_for_tests() -> None:
    """Drop singleton refs without awaiting close (unit tests with mocks)."""

    global _pool, _pool_loop_id
    _pool = None
    _pool_loop_id = None


__all__ = [
    "close_ewa_worker_pool",
    "ewa_worker_pool_max_size",
    "ewa_worker_pool_min_size",
    "get_ewa_worker_pool",
    "open_initialized_ewa_worker_pool",
    "reset_ewa_worker_pool_for_tests",
]
