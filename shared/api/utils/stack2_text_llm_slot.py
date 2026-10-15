# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Process-wide concurrency gate for HTTP calls to stack2 main chat LLM (``stack2-llama-chat``).
# Matches server ``--parallel`` / ``LLAMA_CHAT_PARALLEL`` so API does not overload a single slot.
# Invariants:
# - Tool-router, embed, and rerank hosts are never gated here (separate stack2 services / parallelism).
# - Semaphore is lazily bound to the running event loop (safe for Celery ``asyncio.run`` restarts).
# Related:
# - api/utils/llm_openai_compat_http.py
# - documentation/platform/STACK2-LLM-CONTRACT.md
# ---
"""Slot limiter for stack2-llama-chat text HTTP (chat / generate / stream)."""

from __future__ import annotations

import asyncio
import contextlib
import contextvars
import logging
import os
import time
from collections.abc import AsyncIterator

from api.core.unified_config import unified_settings
from api.services.ugs.text_llm_constants import (
    _DOCKER_INTERNAL_LLM_HOST_MARKERS,
    CANONICAL_DOCKER_TEXT_LLM_URL,
    resolve_ugs_text_llm_base_url,
)

logger = logging.getLogger(__name__)

_DEFAULT_PARALLELISM = 1

_NON_CHAT_HOST_MARKERS: tuple[str, ...] = (
    "llama-tool-router",
    "llama-embed",
    "llama-rerank",
    "tei-embed",
)

_semaphore: asyncio.Semaphore | None = None
_slot_depth: contextvars.ContextVar[int] = contextvars.ContextVar("stack2_text_llm_slot_depth", default=0)


def _norm_base(url: str) -> str:
    return (url or "").strip().rstrip("/")


def _canonical_main_chat_base() -> str:
    return _norm_base(
        resolve_ugs_text_llm_base_url(None, env_llama_url=unified_settings.llama_url or CANONICAL_DOCKER_TEXT_LLM_URL)
    )


def get_stack2_text_llm_parallelism() -> int:
    """Mirror ``LLAMA_CHAT_PARALLEL`` from stack2 compose (default 1)."""

    raw = os.getenv("LLAMA_CHAT_PARALLEL", str(_DEFAULT_PARALLELISM)).strip()
    try:
        value = int(raw)
    except (TypeError, ValueError):  # fmt: skip
        value = _DEFAULT_PARALLELISM
    return max(1, min(value, 8))


def is_stack2_main_chat_llm_base(base_url: str) -> bool:
    """True when ``base_url`` targets main stack2 chat LLM (not tool-router / embed / rerank)."""

    u = _norm_base(base_url)
    if not u:
        return False
    low = u.lower()
    for marker in _NON_CHAT_HOST_MARKERS:
        if marker in low:
            return False
    canonical = _canonical_main_chat_base().lower()
    candidates = {
        canonical,
        _norm_base(unified_settings.llama_url).lower(),
        _norm_base(os.getenv("LLAMA_URL", "")).lower(),
    }
    if low in {c for c in candidates if c}:
        return True
    return any(marker in low for marker in _DOCKER_INTERNAL_LLM_HOST_MARKERS)


def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore  # noqa: PLW0603 — module singleton
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(get_stack2_text_llm_parallelism())
    return _semaphore


def reset_stack2_text_llm_slot_for_tests() -> None:
    """Drop lazy semaphore (tests only)."""

    global _semaphore  # noqa: PLW0603
    _semaphore = None


@contextlib.asynccontextmanager
async def stack2_text_llm_slot(*, reason: str = "text_llm") -> AsyncIterator[None]:
    """Hold one stack2 main-chat slot for the duration of an outbound LLM HTTP call."""

    depth = _slot_depth.get()
    if depth > 0:
        yield
        return

    sem = _get_semaphore()
    t0 = time.perf_counter()
    await sem.acquire()
    wait_ms = int((time.perf_counter() - t0) * 1000)
    token = _slot_depth.set(depth + 1)
    try:
        if wait_ms >= 5:
            logger.info(
                "[STEP] stack2_text_llm_slot acquired reason=%s wait_ms=%s parallelism=%s",
                reason,
                wait_ms,
                get_stack2_text_llm_parallelism(),
            )
        yield
    finally:
        _slot_depth.reset(token)
        sem.release()


@contextlib.asynccontextmanager
async def maybe_stack2_text_llm_slot(base_url: str, *, reason: str = "text_llm") -> AsyncIterator[None]:
    """Acquire slot only for main chat LLM bases."""

    if is_stack2_main_chat_llm_base(base_url):
        async with stack2_text_llm_slot(reason=reason):
            yield
    else:
        yield


__all__ = (
    "get_stack2_text_llm_parallelism",
    "is_stack2_main_chat_llm_base",
    "maybe_stack2_text_llm_slot",
    "reset_stack2_text_llm_slot_for_tests",
    "stack2_text_llm_slot",
)
