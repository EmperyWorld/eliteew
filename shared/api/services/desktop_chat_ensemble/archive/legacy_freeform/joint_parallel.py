# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Opt-in parallel joint section collection (race path). Wave F0 quality-path
# default is sequential council; parallel only when admin sets the flag true.
# Invariants:
# - Results are ordered by speaker index; gather cancel cancels siblings.
# - Parallel mode never injects peer bodies (task-block isolation only).
# Related:
# - api/services/desktop_chat_ensemble/archive/legacy_freeform/stream_turn.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md (Council Protocol Wave F0)
# ---
"""Parallel joint section collection for legacy freeform ensemble (opt-in)."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from contextlib import suppress
from typing import Any

logger = logging.getLogger(__name__)


def joint_parallel_sections_enabled(defaults: dict[str, Any], *, speaker_count: int) -> bool:
    """Opt-in race path only. Quality default is sequential (Wave F0 council)."""
    if speaker_count < 2:
        return False
    return defaults.get("ensemble_joint_parallel_sections") is True


async def gather_ordered[T](
    coros: list[Awaitable[T]],
    *,
    on_progress: Callable[[], Awaitable[None]] | None = None,
    progress_interval_s: float = 1.5,
) -> list[T]:
    """
    Run awaitables concurrently; return results in input order.
    Optional ``on_progress`` is awaited while waiting (SSE keep-alive).
    """
    tasks = [asyncio.create_task(c) for c in coros]  # type: ignore[arg-type]
    try:
        while True:
            pending = [t for t in tasks if not t.done()]
            if not pending:
                break
            if on_progress is not None:
                await on_progress()
            done, _ = await asyncio.wait(pending, timeout=progress_interval_s)
            if not done and on_progress is None:
                await asyncio.sleep(0)
        return [task.result() for task in tasks]
    except asyncio.CancelledError:
        for task in tasks:
            if not task.done():
                task.cancel()
        for task in tasks:
            if not task.done():
                with suppress(asyncio.CancelledError, Exception):
                    await task
        raise
    except Exception:
        for task in tasks:
            if not task.done():
                task.cancel()
        raise


async def collect_joint_section_text(
    *,
    llama: Any,
    llama_messages: list[dict[str, Any]],
    model: str,
    max_tokens: int,
) -> str:
    """Drain one ``chat_stream`` into a single string (no live SSE)."""
    parts: list[str] = []
    async for piece in llama.chat_stream(
        llama_messages,
        model=model,
        max_tokens=max_tokens,
    ):
        if piece.startswith("[error]"):
            logger.warning("[STEP] ensemble joint_parallel section_error=%s", piece[:200])
            break
        parts.append(piece)
    return "".join(parts).strip()
