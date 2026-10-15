# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Lazy-configured token-bucket rate limit for ``POST …/companion-observation`` keyed by **oauth principal**
# (same id as companion ``principal_id``). Prevents buggy or hostile clients from spamming anticipation ticks + PG inserts.
# Invariants:
# - In-process buckets only (**not** shared across API workers); ops requiring cluster-wide limits should add Redis later.
# - Disabled when ``EWA_COMPANION_OBSERVATION_RATE_LIMIT_DISABLED`` is truthy — default is **enabled** with sane defaults.
# - Parsed per-minute caps are clamped to a bounded range; invalid env falls back to default.
# Related:
# - api/ewa_platform/gateways/routers/companion_chat.py (``post_companion_observation``)
# - api/services/rate_limiter.py (``RateLimiter``)
# ---
"""Configurable rate limiting for proactive companion observation ticks."""

from __future__ import annotations

import logging
import os

from api.services.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

__all__ = [
    "COMPANION_OBSERVATION_RATE_LIMIT_ENV_KEY",
    "COMPANION_OBSERVATION_RATE_LIMIT_DEFAULT_PER_MIN",
    "get_companion_observation_rate_limiter",
    "companion_observation_rate_limit_allow",
    "parse_companion_observation_rate_limit_per_minute_from_env",
    "reset_companion_observation_rate_limiter_for_tests",
]

_LIMITER_SINGLETON: RateLimiter | None = None

COMPANION_OBSERVATION_RATE_LIMIT_ENV_KEY = "EWA_COMPANION_OBSERVATION_RATE_LIMIT_PER_MIN"
COMPANION_OBSERVATION_RATE_LIMIT_DISABLED_ENV = "EWA_COMPANION_OBSERVATION_RATE_LIMIT_DISABLED"
COMPANION_OBSERVATION_RATE_LIMIT_DEFAULT_PER_MIN = 120
_RATE_LIMIT_MIN = 20
_RATE_LIMIT_MAX = 480
_CLEANUP_INTERVAL_SEC = 120


def _env_truthy(raw: str | None) -> bool:
    return (raw or "").strip().lower() in {"1", "true", "yes", "on"}


def companion_observation_rate_limit_disabled_from_env() -> bool:
    return _env_truthy(os.environ.get(COMPANION_OBSERVATION_RATE_LIMIT_DISABLED_ENV))


def parse_companion_observation_rate_limit_per_minute_from_env() -> int:
    """Parse ``EWA_COMPANION_OBSERVATION_RATE_LIMIT_PER_MIN``; clamp; default on empty/invalid."""

    raw = os.environ.get(COMPANION_OBSERVATION_RATE_LIMIT_ENV_KEY)
    if raw is None or not str(raw).strip():
        return COMPANION_OBSERVATION_RATE_LIMIT_DEFAULT_PER_MIN
    try:
        value = int(str(raw).strip(), 10)
    except (TypeError, ValueError):  # fmt: skip
        logger.warning(
            "[STEP] companion_observation_rate_limit_env_invalid raw=%s using_default=%s",
            raw,
            COMPANION_OBSERVATION_RATE_LIMIT_DEFAULT_PER_MIN,
        )
        return COMPANION_OBSERVATION_RATE_LIMIT_DEFAULT_PER_MIN
    return max(_RATE_LIMIT_MIN, min(_RATE_LIMIT_MAX, value))


def get_companion_observation_rate_limiter() -> RateLimiter:
    """Singleton token bucket matching sustained cap (burst equals per-minute allowance)."""

    global _LIMITER_SINGLETON
    if _LIMITER_SINGLETON is None:
        per_min = parse_companion_observation_rate_limit_per_minute_from_env()
        _LIMITER_SINGLETON = RateLimiter(
            requests_per_minute=per_min,
            burst_capacity=per_min,
            cleanup_interval=_CLEANUP_INTERVAL_SEC,
        )
    return _LIMITER_SINGLETON


def reset_companion_observation_rate_limiter_for_tests() -> None:
    global _LIMITER_SINGLETON
    _LIMITER_SINGLETON = None


def companion_observation_rate_limit_allow(principal_id: str) -> tuple[bool, float | None]:
    """Return ``(allowed, retry_after_seconds)`` for one observation tick."""

    if companion_observation_rate_limit_disabled_from_env():
        return True, None
    pid = str(principal_id or "").strip()
    if not pid:
        return True, None
    return get_companion_observation_rate_limiter().check_rate_limit(pid)
