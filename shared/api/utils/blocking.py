#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Bounded executor helpers for short blocking CPU/file/network SDK work invoked from async API paths.
# Invariants:
# - Blocking work must pass through the shared semaphore instead of spawning unbounded request threads.
# - Callers set operation-specific timeouts so stalled SDK/subprocess paths release request capacity.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---
"""Bounded helpers for running synchronous work from async request handlers."""

from __future__ import annotations

import asyncio
from collections.abc import Callable

_DEFAULT_BLOCKING_TIMEOUT_SECONDS = 60.0
_BLOCKING_WORK_SEMAPHORE = asyncio.Semaphore(8)


async def run_blocking_work[T](
    func: Callable[..., T],
    *args: object,
    blocking_timeout: float = _DEFAULT_BLOCKING_TIMEOUT_SECONDS,
    **kwargs: object,
) -> T:
    """Run a synchronous callable behind a shared bulkhead and timeout."""
    async with _BLOCKING_WORK_SEMAPHORE:
        return await asyncio.wait_for(asyncio.to_thread(func, *args, **kwargs), timeout=blocking_timeout)
