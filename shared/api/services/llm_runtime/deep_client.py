# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 4 deep LLM OpenAI-compat client (``.136`` llama-deep) with inflight isolation.
# Invariants:
# - Resolves URL only via ``job_class=deep`` (never remaps to interactive ``LLAMA_URL``).
# - Process-local semaphore ``LLAMA_DEEP_MAX_INFLIGHT`` (default 1) caps concurrent 31B jobs.
# - Missing/unavailable deep → ``DeepLlmUnavailableError`` or honest degrade at callers.
# Related:
# - documentation/platform/LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md Phase 4
# - api/services/llm_runtime/job_class.py
# ---
"""Thin deep LLM completion helper (job_class=deep only)."""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

import httpx

from api.services.llm_runtime.job_class import DeepLlmUnavailableError, resolve_llm_base_url
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)

_DEFAULT_INFLIGHT = 1
_semaphore: asyncio.Semaphore | None = None


def deep_llm_enabled() -> bool:
    """Product gate for companion/agentic deep hops (default off until ops smoke)."""

    raw = (os.getenv("EWA_DEEP_LLM_ENABLED") or "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def llama_deep_max_inflight() -> int:
    raw = (os.getenv("LLAMA_DEEP_MAX_INFLIGHT") or str(_DEFAULT_INFLIGHT)).strip()
    try:
        value = int(raw)
    except TypeError, ValueError:
        value = _DEFAULT_INFLIGHT
    return max(1, min(value, 4))


def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore  # noqa: PLW0603 — process singleton
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(llama_deep_max_inflight())
    return _semaphore


def reset_deep_llm_inflight_for_tests() -> None:
    """Drop lazy semaphore (tests only)."""

    global _semaphore  # noqa: PLW0603
    _semaphore = None


def resolve_deep_base_url() -> str:
    """Return deep base URL or raise ``DeepLlmUnavailableError`` (no interactive fallback)."""

    return resolve_llm_base_url(job_class="deep")


async def deep_chat_completion(
    client: httpx.AsyncClient,
    *,
    messages: list[dict[str, Any]],
    model: str | None = None,
    options: dict[str, Any] | None = None,
    timeout: httpx.Timeout | None = None,
    reason: str = "deep_chat",
) -> dict[str, Any]:
    """Non-stream chat completion against ``LLAMA_DEEP_URL`` under inflight semaphore."""

    base = resolve_deep_base_url()
    model_name = (
        (model or "").strip()
        or (os.getenv("LLAMA_DEEP_MODEL") or "").strip()
        or (os.getenv("LLAMA_MODEL") or "").strip()
        or "gemma-4-31B-it-Q4_K_M.gguf"
    )
    sem = _get_semaphore()
    t0 = time.perf_counter()
    await sem.acquire()
    wait_ms = int((time.perf_counter() - t0) * 1000)
    try:
        logger.info(
            "[STEP] llm_deep_acquire reason=%s wait_ms=%s inflight_cap=%s base=%s",
            reason,
            wait_ms,
            llama_deep_max_inflight(),
            base,
        )
        started = time.perf_counter()
        try:
            data = await httpx_compat_chat_completion_json(
                client,
                base,
                model=model_name,
                messages=messages,
                options=options or {"temperature": 0.4, "num_predict": 1024},
                timeout=timeout,
            )
        except Exception:
            logger.warning(
                "[STEP] llm_deep_fail reason=%s base=%s elapsed_ms=%s",
                reason,
                base,
                int((time.perf_counter() - started) * 1000),
                exc_info=True,
            )
            raise
        logger.info(
            "[STEP] llm_deep_ok reason=%s base=%s elapsed_ms=%s response_chars=%s",
            reason,
            base,
            int((time.perf_counter() - started) * 1000),
            len(str(data.get("response") or "")),
        )
        return data
    finally:
        sem.release()


__all__ = [
    "DeepLlmUnavailableError",
    "deep_chat_completion",
    "deep_llm_enabled",
    "llama_deep_max_inflight",
    "reset_deep_llm_inflight_for_tests",
    "resolve_deep_base_url",
]
