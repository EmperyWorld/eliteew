# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Cross-worker admission control for heavy LLM agentic tools so concurrency=2
# workers do not thrash a single llama-chat slot into SoftTimeLimit storms.
# Invariants:
# - Short tools never take the lease.
# - Redis unavailable → open (allow) with structured skip log; never raise to Act.
# Related:
# - documentation/product/ewa/EWA-COMPANION-STABILITY-PERF-CONTRACT.md
# ---

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from uuid import uuid4

from api.ewa_platform.agentic.config import (
    agentic_llm_admission_enabled,
    agentic_llm_admission_lease_sec,
)

logger = logging.getLogger(__name__)

_HEAVY_TOOLS = frozenset({"call_expert_chat", "file_create"})
_REDIS_KEY = "ewa_agentic_llm_heavy"


def is_heavy_llm_tool(tool_name: str) -> bool:
    return str(tool_name or "").strip() in _HEAVY_TOOLS


async def _redis() -> Any | None:
    try:
        from api.core.database_manager import get_redis_client

        return await get_redis_client()
    except Exception as exc:  # noqa: BLE001 — admission degrades open
        logger.debug("[STEP] agentic_llm_admission_redis_skip err=%s", exc)
        return None


async def try_acquire_heavy_llm_lease(*, session_id: str, tool_name: str) -> tuple[bool, str | None]:
    """Try to acquire the global heavy-LLM lease. Returns (acquired, token)."""

    if not agentic_llm_admission_enabled() or not is_heavy_llm_tool(tool_name):
        return True, None
    token = f"{session_id}:{uuid4().hex[:12]}"
    ttl = agentic_llm_admission_lease_sec()
    redis = await _redis()
    if redis is None:
        logger.info(
            "[STEP] agentic_llm_admission acquired session_id=%s tool=%s mode=open_no_redis",
            session_id,
            tool_name,
        )
        return True, None
    try:
        ok = await redis.set(_REDIS_KEY, token, nx=True, ex=ttl)
        if ok:
            logger.info(
                "[STEP] agentic_llm_admission acquired session_id=%s tool=%s token=%s",
                session_id,
                tool_name,
                token[:24],
            )
            return True, token
        logger.info(
            "[STEP] agentic_llm_admission wait session_id=%s tool=%s",
            session_id,
            tool_name,
        )
        return False, None
    except Exception as exc:  # noqa: BLE001 — open on Redis faults
        logger.debug("[STEP] agentic_llm_admission_set_skip err=%s", exc)
        return True, None


async def release_heavy_llm_lease(*, token: str | None) -> None:
    if not token:
        return
    redis = await _redis()
    if redis is None:
        return
    try:
        current = await redis.get(_REDIS_KEY)
        if current is None:
            return
        cur = current.decode() if isinstance(current, (bytes, bytearray)) else str(current)
        if cur == token:
            await redis.delete(_REDIS_KEY)
            logger.info("[STEP] agentic_llm_admission released token=%s", token[:24])
    except Exception as exc:  # noqa: BLE001
        logger.debug("[STEP] agentic_llm_admission_release_skip err=%s", exc)


@asynccontextmanager
async def heavy_llm_admission(*, session_id: str, tool_name: str) -> AsyncIterator[bool]:
    """Yield True if work may proceed; False if caller should retry_wait."""

    acquired, token = await try_acquire_heavy_llm_lease(session_id=session_id, tool_name=tool_name)
    try:
        yield acquired
    finally:
        if acquired and token:
            await release_heavy_llm_lease(token=token)


__all__ = (
    "heavy_llm_admission",
    "is_heavy_llm_tool",
    "release_heavy_llm_lease",
    "try_acquire_heavy_llm_lease",
)
