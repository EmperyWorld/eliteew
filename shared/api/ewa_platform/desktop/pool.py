# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Optional asyncpg pool for ``EWA_DATABASE_URL`` (orchestration sessions + event log schema init).
# Loads EWA platform settings from Postgres into process cache on startup.
# Invariants:
# - Pool is owned by ``app.state``; callers must not close it outside lifespan shutdown.
# - When DSN is unset, ``app.state.ewa_orchestration_pool`` stays ``None`` (in-memory stores per request).
# - Separate ``EWA_DATABASE_URL`` is an explicit EWA data-boundary exception documented in the runbook.
# Related:
# - shared/api/ewa_platform/persistence_pg/orchestration_asyncpg.py
# - shared/api/main.py (lifespan)
# - shared/api/ewa_platform/desktop/ewa_health_snapshot.py (/api/health aggregation + ensure)
# - documentation/platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md
# ---
"""EWA orchestration Postgres pool (optional)."""

from __future__ import annotations

import asyncio
import logging
import os

from fastapi import FastAPI  # type: ignore[import-untyped]

from api.ewa_platform.bootstrap.data_plane import init_ewa_data_plane
from api.ewa_platform.persistence_pg.orchestration_asyncpg import (
    open_ewa_orchestration_pool,
)

logger = logging.getLogger(__name__)

_ensure_lock = asyncio.Lock()


async def init_ewa_orchestration_pool_if_configured(app: FastAPI) -> None:
    """Create ``app.state.ewa_orchestration_pool`` when ``EWA_DATABASE_URL`` is set."""

    dsn = os.getenv("EWA_DATABASE_URL", "").strip()
    if not dsn:
        app.state.ewa_orchestration_pool = None
        logger.info("EWA orchestration pool: disabled (EWA_DATABASE_URL unset)")
        return
    pool = await open_ewa_orchestration_pool(dsn, min_size=1, max_size=10)
    await init_ewa_data_plane(pool)
    app.state.ewa_orchestration_pool = pool
    logger.info("EWA orchestration pool: enabled")


async def ensure_ewa_orchestration_pool(app: FastAPI) -> object | None:
    """Return open pool when DSN is set; self-heal if lifespan left pool unset.

    Used by aggregate ``/api/health`` so a brief startup race does not keep
    public ``ok:false`` after the DSN is configured and PG is reachable.
    """

    existing = getattr(app.state, "ewa_orchestration_pool", None)
    if existing is not None:
        return existing
    dsn = os.getenv("EWA_DATABASE_URL", "").strip()
    if not dsn:
        return None
    async with _ensure_lock:
        existing = getattr(app.state, "ewa_orchestration_pool", None)
        if existing is not None:
            return existing
        try:
            await init_ewa_orchestration_pool_if_configured(app)
        except Exception:
            logger.exception("[STEP] ewa_orchestration_pool_ensure_failed")
            return None
        return getattr(app.state, "ewa_orchestration_pool", None)


async def close_ewa_orchestration_pool(app: FastAPI) -> None:
    """Close orchestration pool if present."""

    pool = getattr(app.state, "ewa_orchestration_pool", None)
    if pool is not None:
        await pool.close()
        app.state.ewa_orchestration_pool = None
        logger.info("EWA orchestration pool: closed")
