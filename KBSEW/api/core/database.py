# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Asyncpg pool owner for KBSEW (pattern aligned with EliteEW DatabaseManager).
# Invariants:
# - Single pool per process; acquired via lifespan only.
# - Pool init registers json/jsonb codecs so jsonb columns arrive as dict.
# ---

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg
from asyncpg.pool import PoolConnectionProxy

from api.core.config import get_settings
from api.core.json_codec import register_json_codecs

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def init_pool() -> asyncpg.Pool:
    global _pool  # noqa: PLW0603
    if _pool is not None:
        return _pool
    settings = get_settings()
    _pool = await asyncpg.create_pool(
        dsn=settings.postgres_dsn,
        min_size=1,
        max_size=10,
        command_timeout=60,
        init=register_json_codecs,
    )
    logger.info(
        "[STEP] kbsew_db_pool ready host=%s db=%s",
        settings.postgres_host,
        settings.postgres_db,
    )
    return _pool


async def close_pool() -> None:
    global _pool  # noqa: PLW0603
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("[STEP] kbsew_db_pool closed")


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("KBSEW database pool not initialized")
    return _pool


@asynccontextmanager
async def connection() -> AsyncIterator[PoolConnectionProxy]:
    """Yield a pooled connection (asyncpg ``PoolConnectionProxy`` from ``pool.acquire``)."""

    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn
