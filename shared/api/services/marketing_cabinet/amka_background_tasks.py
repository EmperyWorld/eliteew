# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Registry of in-process asyncio tasks for marketing AMKA background phases (plan, execute, auto-chain).
# Invariants:
# - One task per logical key; duplicate spawns while the previous task is running are ignored.
# - Task keys are documented in `documentation/product/amka-seed-album/AMKA-BACKGROUND-TASK-KEYS.md`.
# Related:
# - shared/api/services/marketing_cabinet/amka_service_support.py (re-exports for legacy star-imports)
# - shared/api/services/amka_core/marketing_driver.py
# ---
from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

AMKA_BACKGROUND_TASKS: dict[str, asyncio.Task[None]] = {}


def _spawn_background(
    task_key: str,
    coro_or_factory: Awaitable[Any] | Callable[[], Awaitable[Any]],
) -> None:
    existing = AMKA_BACKGROUND_TASKS.get(task_key)
    if existing is not None and not existing.done():
        return
    coro = coro_or_factory() if callable(coro_or_factory) else coro_or_factory
    task = asyncio.create_task(coro)
    AMKA_BACKGROUND_TASKS[task_key] = task

    def _cleanup(done_task: asyncio.Task[None]) -> None:
        current = AMKA_BACKGROUND_TASKS.get(task_key)
        if current is done_task:
            AMKA_BACKGROUND_TASKS.pop(task_key, None)

    task.add_done_callback(_cleanup)


__all__ = ["AMKA_BACKGROUND_TASKS", "_spawn_background"]
