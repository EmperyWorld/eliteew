# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Build a JSON-safe **EWA Postgres** health snapshot for aggregate API health endpoints (pool presence, optional ``SELECT 1``).
# Invariants:
# - Does not log DSNs or raw SQL errors with connection secrets; probe errors surface as exception class name only.
# - When ``EWA_DATABASE_URL`` is unset, status is **disabled** and optional probe is skipped.
# Related:
# - api/main.py (``/api/health``, ``/api/database/health``)
# - api/ewa_platform/desktop/pool.py
# - documentation/platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md
# ---
"""EWA Postgres health snapshot for /api/health aggregation."""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any


def _env_truthy(raw: str | None) -> bool:
    if raw is None:
        return False
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def ewa_health_pg_probe_enabled() -> bool:
    """Return True when ``EWA_HEALTH_PG_PROBE`` requests an explicit ``SELECT 1`` (default: off)."""

    return _env_truthy(os.getenv("EWA_HEALTH_PG_PROBE"))


def merge_api_overall_status_with_ewa(overall: str, ewa_status: str) -> str:
    """If EWA is required-but-broken, degrade an otherwise healthy overall status."""

    if ewa_status in ("", "disabled", "healthy"):
        return overall
    if ewa_status == "down":
        if overall == "healthy":
            return "degraded"
        return overall
    if ewa_status == "degraded":
        if overall == "healthy":
            return "degraded"
        return overall
    return overall


def merge_api_overall_status_with_celery_beat(overall: str, beat_status: str) -> str:
    """Degrade healthy overall when Celery beat heartbeat is stale (Trust T5 / V-H2)."""

    if beat_status != "stale":
        return overall
    if overall == "healthy":
        return "degraded"
    return overall


async def build_ewa_postgres_health_payload(
    app: object,
    *,
    pg_probe: bool | None = None,
) -> dict[str, Any]:
    """Return EWA orchestration DB status for operators (and load balancers via ``/api/health``)."""

    configured = bool(os.getenv("EWA_DATABASE_URL", "").strip())
    pool = getattr(getattr(app, "state", None), "ewa_orchestration_pool", None)
    pool_open = pool is not None
    do_probe = ewa_health_pg_probe_enabled() if pg_probe is None else pg_probe

    out: dict[str, Any] = {
        "configured": configured,
        "pool_open": pool_open,
        "pg_probe_requested": bool(do_probe),
    }

    if not configured:
        out["status"] = "disabled"
        return out

    if not pool_open:
        # Self-heal: lifespan race or worker without pool yet (DSN configured).
        try:
            from api.ewa_platform.desktop.pool import ensure_ewa_orchestration_pool

            pool = await ensure_ewa_orchestration_pool(app)  # type: ignore[arg-type]
            pool_open = pool is not None
            out["pool_open"] = pool_open
            if pool_open:
                out["pool_ensure"] = "opened"
        except Exception as exc:  # noqa: BLE001 — aggregate health must not throw
            out["pool_ensure"] = type(exc).__name__
            out["status"] = "down"
            return out

    if not pool_open:
        out["status"] = "down"
        return out

    out["status"] = "healthy"

    if not do_probe:
        return out

    start = time.perf_counter()
    try:
        async with pool.acquire() as conn:  # type: ignore[union-attr]
            await conn.execute("SELECT 1")
        elapsed_ms = round((time.perf_counter() - start) * 1000.0, 3)
        out["pg_probe"] = {"ok": True, "latency_ms": elapsed_ms}
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001 — aggregate health must not throw
        elapsed_ms = round((time.perf_counter() - start) * 1000.0, 3)
        out["pg_probe"] = {
            "ok": False,
            "latency_ms": elapsed_ms,
            "error": type(exc).__name__,
        }
        out["status"] = "degraded"

    return out
