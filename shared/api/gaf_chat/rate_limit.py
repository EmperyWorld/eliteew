# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `gaf_chat/rate_limit.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""
GAF Chat: rate limit for **sending** messages only.

**Where it is used** (see ``api/gaf_chat/router.py``):
  ``POST /api/v1/gaf-chat/chats/{chat_id}/messages`` — before body validation,
  keyed by ``content_user_id`` (current user's DB id from ``get_current_user_db_id``).
  On exceed: HTTP 429 and ``Retry-After`` from the token bucket wait time (router
  falls back to 60 seconds if ``retry_after`` is missing).

**Mechanism**: in-process token bucket via ``api.services.rate_limiter.RateLimiter``.
Not shared across API workers or hosts; each process has its own counters.

**Configuration** (environment only; read once at first use — lazy singleton in
``get_gaf_chat_rate_limiter()``):

``GAF_CHAT_RATE_LIMIT_PER_MIN`` (``GAF_RATE_LIMIT_PER_MIN_ENV``)
  Sustained cap: send requests per minute **per user**. Integer.
  **Default** ``GAF_RATE_LIMIT_DEFAULT_PER_MIN``: **60** / minute.
  Parsed values are clamped to ``[GAF_RATE_LIMIT_MIN, GAF_RATE_LIMIT_MAX]``: **30–120**.
  Non-numeric or empty env → default (same as unset).

**Bucket tuning** (fixed in code, not env):
  ``burst_capacity`` equals the per-minute limit so a user may send up to that many
  messages in a short burst, then refill at ``limit/60`` tokens per second.
  ``cleanup_interval`` (``GAF_RATE_LIMIT_CLEANUP_INTERVAL_SEC``, default 120 s) controls
  how often idle per-user buckets are scanned for removal
  (see ``RateLimiter._cleanup_old_entries``).

**Tests**: ``reset_gaf_chat_rate_limiter_for_tests()`` clears the singleton; use
``gaf_chat_rate_limit_test_env()`` to temporarily set env and rebuild the limiter.

**Metrics / observability** (no code here yet): production counting belongs next to the
decision point in ``api.gaf_chat.router`` after ``check_rate_limit`` (allowed vs denied,
optionally labels for ``retry_after`` buckets). A shared helper could wrap the limiter
call later; this module stays configuration + singleton only.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager

from api.services.rate_limiter import RateLimiter

__all__ = [
    "GAF_CHAT_REFILL_WINDOW_SECONDS",
    "GAF_RATE_LIMIT_CLEANUP_INTERVAL_SEC",
    "GAF_RATE_LIMIT_DEFAULT_PER_MIN",
    "GAF_RATE_LIMIT_MAX",
    "GAF_RATE_LIMIT_MIN",
    "GAF_RATE_LIMIT_PER_MIN_ENV",
    "gaf_chat_rate_limit_test_env",
    "gaf_chat_tokens_per_second_for_per_minute_limit",
    "get_gaf_chat_rate_limiter",
    "parse_gaf_chat_rate_limit_per_minute_from_env",
    "reset_gaf_chat_rate_limiter_for_tests",
]

_GAF_RATE_LIMITER: RateLimiter | None = None

# Token-bucket refill interval matches RateLimiter (sustained average over one minute).
GAF_CHAT_REFILL_WINDOW_SECONDS = 60

# Env var name (document in stack0 backend env templates / operator docs).
GAF_RATE_LIMIT_PER_MIN_ENV = "GAF_CHAT_RATE_LIMIT_PER_MIN"

# Defaults and bounds (product docs often cite ~30–60/min; ops may raise up to max).
GAF_RATE_LIMIT_DEFAULT_PER_MIN = 60
GAF_RATE_LIMIT_MIN = 30
GAF_RATE_LIMIT_MAX = 120

# How often RateLimiter runs bucket cleanup (seconds).
GAF_RATE_LIMIT_CLEANUP_INTERVAL_SEC = 120


def gaf_chat_tokens_per_second_for_per_minute_limit(per_minute: int) -> float:
    """
    Sustained refill rate for the token bucket: ``per_minute / 60`` tokens per second.

    ``RateLimiter`` stores the same value as ``refill_rate``; burst capacity here equals
    ``per_minute``, so a user may spend up to that many tokens at once, then refills at
    this rate until capacity is full again.
    """
    return per_minute / float(GAF_CHAT_REFILL_WINDOW_SECONDS)


def parse_gaf_chat_rate_limit_per_minute_from_env() -> int:
    """Read ``GAF_CHAT_RATE_LIMIT_PER_MIN``, clamp to ``[MIN, MAX]``, default on bad input."""
    raw = os.environ.get(GAF_RATE_LIMIT_PER_MIN_ENV)
    if raw is None or not str(raw).strip():
        return GAF_RATE_LIMIT_DEFAULT_PER_MIN
    try:
        value = int(str(raw).strip(), 10)
    except (TypeError, ValueError):  # fmt: skip
        return GAF_RATE_LIMIT_DEFAULT_PER_MIN
    return max(GAF_RATE_LIMIT_MIN, min(GAF_RATE_LIMIT_MAX, value))


def get_gaf_chat_rate_limiter() -> RateLimiter:
    """Lazy singleton for GAF ``send_message`` (per ``content_user_id``, per minute)."""
    global _GAF_RATE_LIMITER
    if _GAF_RATE_LIMITER is None:
        per_min = parse_gaf_chat_rate_limit_per_minute_from_env()
        # Bucket math: burst_capacity == per_min matches sustained cap (one minute of
        # allowance as tokens); refill_rate inside RateLimiter is per_min/60 (see
        # gaf_chat_tokens_per_second_for_per_minute_limit).
        _GAF_RATE_LIMITER = RateLimiter(
            requests_per_minute=per_min,
            burst_capacity=per_min,
            cleanup_interval=GAF_RATE_LIMIT_CLEANUP_INTERVAL_SEC,
        )
    return _GAF_RATE_LIMITER


def reset_gaf_chat_rate_limiter_for_tests() -> None:
    """Drop the singleton so the next ``get_gaf_chat_rate_limiter()`` rebuilds from env."""
    global _GAF_RATE_LIMITER
    _GAF_RATE_LIMITER = None


@contextmanager
def gaf_chat_rate_limit_test_env(*, per_min_env_value: str | None) -> Iterator[None]:
    """
    Temporarily set ``GAF_CHAT_RATE_LIMIT_PER_MIN`` and reset the limiter singleton.

    For **tests only**. Saves the previous env value (or absence), assigns
    ``per_min_env_value`` when not ``None`` (otherwise removes the variable so
    defaults apply), calls ``reset_gaf_chat_rate_limiter_for_tests()``, then ``yield``.
    On exit, restores env and resets again so other tests see a clean state.

    Pass e.g. ``\"40\"`` for a numeric limit, ``\"\"`` or ``\"x\"`` to exercise
    default parsing, ``\"5\"`` / ``\"500\"`` to exercise clamping.
    """
    key = GAF_RATE_LIMIT_PER_MIN_ENV
    had_key = key in os.environ
    previous = os.environ.get(key)
    try:
        if per_min_env_value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = per_min_env_value
        reset_gaf_chat_rate_limiter_for_tests()
        yield
    finally:
        if had_key:
            assert previous is not None
            os.environ[key] = previous
        else:
            os.environ.pop(key, None)
        reset_gaf_chat_rate_limiter_for_tests()
