# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure helpers for MusicForge orphan/stale run detection (no DB/HTTP imports).
# Invariants:
# - Non-terminal runs idle longer than MUSIC_FORGE_STALE_RUN_SECONDS are stale.
# Related:
# - api/services/music_forge/pipeline.py
# ---
"""Stale-run detection for MusicForge durable runs."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

MUSIC_FORGE_TERMINAL_STATUSES = frozenset({"completed", "failed", "cancelled"})
MUSIC_FORGE_STALE_RUN_SECONDS = 20 * 60
MUSIC_FORGE_STALE_ERROR = {
    "stage": "stale_run",
    "message": "Generation stalled after the worker stopped updating. Start a new song.",
}


def music_forge_run_is_stale(
    *,
    status: str,
    updated_at: datetime | None,
    now: datetime | None = None,
    stale_after_seconds: int = MUSIC_FORGE_STALE_RUN_SECONDS,
) -> bool:
    """True when a non-terminal run has not been updated within the stale window."""
    if status in MUSIC_FORGE_TERMINAL_STATUSES or updated_at is None:
        return False
    clock = now or datetime.now(UTC)
    stamp = updated_at if updated_at.tzinfo is not None else updated_at.replace(tzinfo=UTC)
    if clock.tzinfo is None:
        clock = clock.replace(tzinfo=UTC)
    return clock - stamp.astimezone(UTC) >= timedelta(seconds=stale_after_seconds)
