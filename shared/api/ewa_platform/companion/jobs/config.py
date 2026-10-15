# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Feature flags for companion async job execution (Celery). OFF by default per master plan Phase 1.
# Invariants:
# - ``EWA_COMPANION_ASYNC_MUSIC_ENABLED`` requires master ``EWA_COMPANION_ASYNC_JOBS_ENABLED``.
# Related:
# - documentation/product/ewa/EWA-COMPANION-BACKGROUND-ORCHESTRATION-MASTER-PLAN.md §9 Phase 1.3 ENV
# ---

from __future__ import annotations

import os


def _env_truthy(raw: str | None) -> bool:
    return str(raw or "").strip().lower() in {"1", "true", "yes", "on"}


def companion_async_jobs_enabled() -> bool:
    """Master switch for Celery companion run executor."""

    return _env_truthy(os.getenv("EWA_COMPANION_ASYNC_JOBS_ENABLED"))


def companion_async_music_enabled() -> bool:
    """When ON (and master switch ON), music generation uses Celery instead of detached asyncio."""

    if not companion_async_jobs_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_ASYNC_MUSIC_ENABLED"))
