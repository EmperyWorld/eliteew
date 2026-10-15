# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Distributed circuit breaker for MusicForge upstream (ComfyUI / UGS LLM).
# Invariants:
# - Open breaker blocks create/execute with music_forge_upstream_unavailable (HTTP 503).
# - State in Redis; Redis down → fail-open for create (log) but still record best-effort.
# Related:
# - api/services/music_forge/pipeline.py
# - api/routers/music_forge_admin.py
# - documentation/product/MUSIC-FORGE-APP.md
# ---
"""MusicForge upstream circuit breaker (Redis-backed)."""

from __future__ import annotations

import logging
import time
from typing import Any, Literal

logger = logging.getLogger(__name__)

UpstreamName = Literal["comfy", "ugs"]

BREAKER_THRESHOLD = 5
BREAKER_COOLDOWN_SEC = 60
REDIS_PREFIX = "music_forge:breaker"


class MusicForgeUpstreamUnavailableError(RuntimeError):
    """Upstream circuit open — create/execute must return HTTP 503."""

    def __init__(self, upstream: str, detail: str = "music_forge_upstream_unavailable") -> None:
        self.upstream = upstream
        self.detail = detail
        super().__init__(detail)


async def _redis() -> Any | None:
    try:
        from api.core.database_manager import get_database_manager

        manager = await get_database_manager()
        return await manager.get_redis_client()
    except Exception:
        logger.debug("[STEP] music_forge_breaker_redis_skip", exc_info=True)
        return None


def _fail_key(upstream: UpstreamName) -> str:
    return f"{REDIS_PREFIX}:{upstream}:failures"


def _open_key(upstream: UpstreamName) -> str:
    return f"{REDIS_PREFIX}:{upstream}:opened_at"


async def get_breaker_state(upstream: UpstreamName) -> dict[str, Any]:
    """Snapshot for admin/overview: failures, open, opened_at."""
    redis = await _redis()
    if redis is None:
        return {"upstream": upstream, "failures": 0, "open": False, "opened_at": None, "redis": False}
    try:
        raw_fail = await redis.get(_fail_key(upstream))
        raw_open = await redis.get(_open_key(upstream))
        failures = int(raw_fail or 0)
        opened_at = float(raw_open) if raw_open is not None else None
        # half-open: после cooldown open=False → один probe разрешён.
        is_open = bool(opened_at is not None and time.time() - opened_at < BREAKER_COOLDOWN_SEC)
        return {
            "upstream": upstream,
            "failures": failures,
            "open": is_open,
            "opened_at": opened_at,
            "redis": True,
            "threshold": BREAKER_THRESHOLD,
            "cooldown_sec": BREAKER_COOLDOWN_SEC,
        }
    except Exception:
        logger.debug("[STEP] music_forge_breaker_state_skip upstream=%s", upstream, exc_info=True)
        return {"upstream": upstream, "failures": 0, "open": False, "opened_at": None, "redis": False}


async def assert_upstream_closed(upstream: UpstreamName) -> None:
    """Raise MusicForgeUpstreamUnavailableError if breaker is open (cooldown not elapsed)."""
    state = await get_breaker_state(upstream)
    if state.get("open"):
        logger.error(
            "[STEP] music_forge_upstream_unavailable upstream=%s failures=%s",
            upstream,
            state.get("failures"),
        )
        raise MusicForgeUpstreamUnavailableError(upstream)


async def record_upstream_success(upstream: UpstreamName) -> None:
    """Reset failure streak and clear open stamp."""
    redis = await _redis()
    if redis is None:
        return
    try:
        await redis.delete(_fail_key(upstream), _open_key(upstream))
        logger.info("[STEP] music_forge_breaker_closed upstream=%s", upstream)
    except Exception:
        logger.debug("[STEP] music_forge_breaker_success_skip upstream=%s", upstream, exc_info=True)


async def record_upstream_failure(upstream: UpstreamName) -> None:
    """Increment failures; open breaker at threshold."""
    redis = await _redis()
    if redis is None:
        return
    try:
        failures = int(await redis.incr(_fail_key(upstream)))
        await redis.expire(_fail_key(upstream), BREAKER_COOLDOWN_SEC * 10)
        if failures >= BREAKER_THRESHOLD:
            await redis.set(_open_key(upstream), str(time.time()))
            await redis.expire(_open_key(upstream), BREAKER_COOLDOWN_SEC)
            logger.error(
                "[STEP] music_forge_breaker_open upstream=%s failures=%s",
                upstream,
                failures,
            )
        else:
            logger.warning(
                "[STEP] music_forge_breaker_fail upstream=%s failures=%s",
                upstream,
                failures,
            )
    except Exception:
        logger.debug("[STEP] music_forge_breaker_failure_skip upstream=%s", upstream, exc_info=True)
