# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# In-process cache + resolve API for companion prompt blocks (DB override → code canon).
# Invariants:
# - get_prompt_block never raises; missing/empty DB falls back to canon.
# - bootstrap seeds canon with ON CONFLICT DO NOTHING then loads cache.
# Related:
# - api/ewa_platform/persistence_pg/prompt_blocks_asyncpg.py
# ---
"""Prompt-block loader service."""

from __future__ import annotations

import logging
import threading
from typing import Any

import asyncpg

from api.ewa_platform.companion.prompt_blocks.canon import (
    PROMPT_BLOCK_CANON,
    PromptBlockSpec,
    canon_body,
    list_prompt_block_canon,
)
from api.ewa_platform.persistence_pg import prompt_blocks_asyncpg as blocks_pg

logger = logging.getLogger(__name__)

_cache: dict[str, str] = {}
_lock = threading.RLock()
_loaded = False


def clear_prompt_block_cache() -> None:
    global _loaded
    with _lock:
        _cache.clear()
        _loaded = False


def list_prompt_block_specs() -> tuple[PromptBlockSpec, ...]:
    return list_prompt_block_canon()


def get_prompt_block(block_key: str, *, default: str | None = None) -> str:
    """Return DB body if non-empty, else code canon (or ``default``)."""

    key = (block_key or "").strip()
    if not key:
        return default or ""
    with _lock:
        if _loaded and key in _cache:
            body = _cache[key]
            if str(body).strip():
                return str(body)
    fallback = canon_body(key)
    if fallback:
        return fallback
    return default if default is not None else ""


def _apply_cache(values: dict[str, str]) -> None:
    global _loaded
    with _lock:
        _cache.clear()
        _cache.update(values)
        _loaded = True


async def bootstrap_prompt_blocks(pool: asyncpg.Pool) -> None:
    await blocks_pg.init_ewa_companion_prompt_blocks_schema(pool)
    seed_rows = [(s.block_key, s.category, s.description, s.body_text) for s in list_prompt_block_canon()]
    inserted = await blocks_pg.seed_prompt_blocks(pool, seed_rows)
    values = await blocks_pg.load_all_prompt_block_bodies(pool)
    _apply_cache(values)
    logger.info(
        "[STEP] companion_prompt_blocks_bootstrap keys=%s inserted=%s",
        len(values),
        inserted,
    )


async def reload_prompt_blocks(pool: asyncpg.Pool) -> None:
    values = await blocks_pg.load_all_prompt_block_bodies(pool)
    _apply_cache(values)
    logger.info("[STEP] companion_prompt_blocks_reload keys=%s", len(values))


async def update_prompt_block(
    pool: asyncpg.Pool,
    *,
    block_key: str,
    body_text: str,
    actor_sub: str | None,
) -> dict[str, Any] | None:
    if block_key not in PROMPT_BLOCK_CANON:
        return None
    row = await blocks_pg.update_prompt_block_body(
        pool,
        block_key=block_key,
        body_text=body_text,
        actor_sub=actor_sub,
    )
    if row is None:
        # Row missing — insert from canon shell then update
        spec = PROMPT_BLOCK_CANON[block_key]
        await blocks_pg.seed_prompt_blocks(
            pool,
            [(spec.block_key, spec.category, spec.description, spec.body_text)],
        )
        row = await blocks_pg.update_prompt_block_body(
            pool,
            block_key=block_key,
            body_text=body_text,
            actor_sub=actor_sub,
        )
    await reload_prompt_blocks(pool)
    return row


__all__ = (
    "bootstrap_prompt_blocks",
    "clear_prompt_block_cache",
    "get_prompt_block",
    "list_prompt_block_specs",
    "reload_prompt_blocks",
    "update_prompt_block",
)
