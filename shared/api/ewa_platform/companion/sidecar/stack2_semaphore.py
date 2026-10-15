# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `ewa_platform/companion/sidecar/stack2_semaphore.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Cross-coroutine throttle for **stack2 embedding** HTTP calls. The previous companion turn issued **≥6** parallel
# embed POSTs against the same /v1/embeddings endpoint (one per recall query, one per episode write, one for HCM
# slim, etc.). Under TEI/llama-cpp this saturated the worker pool and slowed the visible chat response.
# Provides:
#   * a process-wide ``asyncio.Semaphore`` sized via ``EWA_COMPANION_EMBED_PARALLELISM`` (default ``2``);
#   * a per-turn ``contextvars.ContextVar`` counter so each chat turn logs how many embed HTTP calls fired;
#   * convenience helpers ``embed_one`` / ``embed_batch`` that wrap ``aiohttp_compat_embeddings_dict`` /
#     ``httpx_compat_embeddings_first`` with the semaphore + telemetry.
# Invariants:
# - The semaphore lives at module scope and is **lazily** constructed inside the running event loop so importing
#   this module does not create a stale loop binding.
# - Telemetry never prints embedding vectors; only counts and elapsed milliseconds (``[STEP] companion_embed_call``).
# - Batch path collapses a list of input texts into **one** HTTP request when the embed surface supports it
#   (OpenAI /v1/embeddings accepts ``input: [list]`` natively).
# Related:
# - api/ewa_platform/companion/memory/retrieval.py (per-turn recall embed)
# - api/ewa_platform/companion/episodic/writer.py (write-time embed)
# - api/ewa_platform/companion/episodic/reembed.py (background reembed worker)
# - api/utils/llm_openai_compat_http.py (transport)
# ---
"""Global semaphore + telemetry around stack2 embedding HTTP calls."""

from __future__ import annotations

import asyncio
import contextlib
import contextvars
import logging
import os
import time
from collections.abc import AsyncIterator, Sequence
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import aiohttp
    import httpx

logger = logging.getLogger(__name__)


_DEFAULT_PARALLELISM = 2
_semaphore: asyncio.Semaphore | None = None

# Per-turn embed call counter — stored as a **mutable** single-element list so child tasks created by
# ``asyncio.gather`` mutate the same counter as the parent (``ContextVar`` only copies the *reference*).
_embed_call_counter: contextvars.ContextVar[list[int]] = contextvars.ContextVar("companion_embed_call_counter")


def get_companion_embed_parallelism() -> int:
    """Return the configured maximum parallel stack2 embed HTTP calls (env override)."""
    raw = os.getenv("EWA_COMPANION_EMBED_PARALLELISM")
    if raw is None:
        return _DEFAULT_PARALLELISM
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):  # fmt: skip
        return _DEFAULT_PARALLELISM
    return max(1, min(value, 8))


def _get_semaphore() -> asyncio.Semaphore:
    """Lazily create the semaphore bound to the current event loop."""
    global _semaphore  # noqa: PLW0603 — module-level singleton, intentional
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(get_companion_embed_parallelism())
    return _semaphore


def _counter_ref() -> list[int]:
    """Return the mutable per-turn counter cell, lazily attaching one to the current context."""
    try:
        return _embed_call_counter.get()
    except LookupError:
        cell: list[int] = [0]
        _embed_call_counter.set(cell)
        return cell


def reset_embed_counter() -> None:
    """Reset the per-turn embed call counter (call once at the start of a chat turn)."""
    cell = _counter_ref()
    cell[0] = 0


def get_embed_counter() -> int:
    """Return how many embed HTTP calls fired in the current asyncio context."""
    return _counter_ref()[0]


@contextlib.asynccontextmanager
async def embed_slot(*, reason: str = "embed") -> AsyncIterator[None]:
    """Acquire one slot of the stack2 embed semaphore for the duration of the ``async with`` block.

    Logs a single ``[STEP] companion_embed_call`` line with elapsed milliseconds and per-turn count.
    """

    sem = _get_semaphore()
    cell = _counter_ref()
    start = time.perf_counter()
    await sem.acquire()
    try:
        cell[0] += 1
        yield
    finally:
        sem.release()
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        logger.info(
            "[STEP] companion_embed_call reason=%s count=%s elapsed_ms=%s",
            reason,
            cell[0],
            elapsed_ms,
        )


async def embed_one_httpx(
    client: httpx.AsyncClient,
    embed_base_url: str,
    *,
    model: str,
    text: str,
    dimensions: int | None = None,
    timeout: Any = None,
    force_openai: bool = False,
    reason: str = "embed_one",
) -> list[float]:
    """Single-text embedding using ``httpx`` with semaphore + telemetry."""
    from api.utils.llm_openai_compat_http import httpx_compat_embeddings_first  # noqa: PLC0415

    async with embed_slot(reason=reason):
        return await httpx_compat_embeddings_first(
            client,
            embed_base_url,
            model=model,
            text=text,
            dimensions=dimensions,
            timeout=timeout,
            force_openai=force_openai,
        )


async def embed_batch_aiohttp(
    session: aiohttp.ClientSession,
    embed_base_url: str,
    *,
    model: str,
    texts: Sequence[str],
    dimensions: int | None = None,
    timeout: Any = None,
    force_openai: bool = False,
    reason: str = "embed_batch",
) -> list[list[float]]:
    """Batch embedding using ``aiohttp`` with semaphore + telemetry — fires **one** HTTP call per batch."""
    from api.utils.llm_openai_compat_http import aiohttp_compat_embeddings_dict  # noqa: PLC0415

    payload = list(texts)
    if not payload:
        return []
    async with embed_slot(reason=reason):
        data = await aiohttp_compat_embeddings_dict(
            session,
            embed_base_url,
            model=model,
            input_data=payload if len(payload) > 1 else payload[0],
            dimensions=dimensions,
            timeout=timeout,
            force_openai=force_openai,
        )
    embeddings = data.get("embeddings") if isinstance(data, dict) else None
    if isinstance(embeddings, list):
        return [list(e) for e in embeddings if isinstance(e, list)]
    return []


__all__ = (
    "embed_batch_aiohttp",
    "embed_one_httpx",
    "embed_slot",
    "get_companion_embed_parallelism",
    "get_embed_counter",
    "reset_embed_counter",
)
