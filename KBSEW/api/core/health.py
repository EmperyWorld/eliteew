# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Dependency readiness checks for KBSEW (PG, Qdrant, Seaweed/MinIO).
# Invariants:
# - /health stays liveness-only; readiness failures are reported via /ready.
# Related:
# - api/main.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import asyncio
import logging
from typing import Any

from api.core.config import get_settings
from api.core.database import get_pool
from api.services.object_store import get_minio_client
from api.services.qdrant_store import get_qdrant_client

logger = logging.getLogger(__name__)


async def _check_postgres() -> dict[str, Any]:
    pool = get_pool()
    value = await pool.fetchval("SELECT 1")
    if value != 1:
        raise RuntimeError(f"unexpected SELECT 1 result: {value!r}")
    return {"ok": True}


async def _check_qdrant() -> dict[str, Any]:
    client = get_qdrant_client()
    # Lightweight reachability: list collections (metadata only).
    await client.get_collections()
    return {"ok": True}


async def _check_minio() -> dict[str, Any]:
    settings = get_settings()
    client = get_minio_client()
    # bucket_exists is a cheap HEAD against SeaweedFS S3 API (reachability + bucket).
    exists = await asyncio.to_thread(client.bucket_exists, settings.minio_bucket)
    if not exists:
        raise RuntimeError(f"minio bucket missing: {settings.minio_bucket}")
    return {"ok": True, "bucket": settings.minio_bucket}


async def collect_readiness() -> dict[str, Any]:
    """Return readiness payload; never raises — failed checks set ok=false."""
    checks: dict[str, Any] = {}
    overall = True

    for name, coro_factory in (
        ("postgres", _check_postgres),
        ("qdrant", _check_qdrant),
        ("minio", _check_minio),
    ):
        try:
            checks[name] = await coro_factory()
        except Exception as exc:  # noqa: BLE001 — readiness must degrade, not crash
            overall = False
            checks[name] = {"ok": False, "error": str(exc)[:300]}
            logger.warning(
                "[STEP] kbsew_ready_check_fail check=%s reason=%s", name, exc
            )

    return {
        "status": "ok" if overall else "degraded",
        "service": get_settings().service_name,
        "ready": overall,
        "checks": checks,
    }
