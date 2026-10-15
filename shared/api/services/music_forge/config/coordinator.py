# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Distributed MusicForge config generation stamp (Redis + process-local match).
# Invariants:
# - Local cache valid only when generation matches Redis/PG stamp (не TTL-only).
# - Redis недоступен → process cache не используется (reload из PG каждый раз).
# Related:
# - api/services/music_forge/config/gateway.py
# - documentation/product/MUSIC-FORGE-APP.md
# ---
"""MusicForge config cache coordinator (Variant A: Redis generation)."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.services.music_forge.config.types import MusicForgeConfigBundle

logger = logging.getLogger(__name__)

REDIS_GENERATION_KEY = "music_forge:config:generation"

# Process cache: (generation, bundle)
_local_cache: tuple[int, MusicForgeConfigBundle] | None = None


def clear_local_cache() -> None:
    """Сбросить process-local cache (после activate / тесты)."""
    global _local_cache
    _local_cache = None


def get_local_cached(generation: int) -> MusicForgeConfigBundle | None:
    """Вернуть bundle только если generation совпадает."""
    if _local_cache is None:
        return None
    cached_gen, bundle = _local_cache
    if cached_gen != generation:
        return None
    return bundle


def set_local_cache(generation: int, bundle: MusicForgeConfigBundle) -> None:
    """Сохранить process-local snapshot под generation stamp."""
    global _local_cache
    _local_cache = (generation, bundle)


async def _redis() -> Any | None:
    try:
        from api.core.database_manager import get_database_manager

        manager = await get_database_manager()
        return await manager.get_redis_client()
    except Exception:
        logger.debug("[STEP] music_forge_config_redis_skip unavailable", exc_info=True)
        return None


async def read_redis_generation() -> int | None:
    """Прочитать generation из Redis; None если ключа нет или Redis недоступен."""
    redis = await _redis()
    if redis is None:
        return None
    try:
        raw = await redis.get(REDIS_GENERATION_KEY)
        if raw is None:
            return None
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        return int(raw)
    except Exception:
        logger.debug("[STEP] music_forge_config_redis_get_skip", exc_info=True)
        return None


async def publish_generation(generation: int) -> None:
    """Опубликовать generation в Redis после PG commit."""
    redis = await _redis()
    if redis is None:
        logger.error("[STEP] music_forge_config_generation_publish_skip generation=%s", generation)
        return
    try:
        await redis.set(REDIS_GENERATION_KEY, str(int(generation)))
        logger.info("[STEP] music_forge_config_generation_published generation=%s", generation)
    except Exception:
        logger.exception("[STEP] music_forge_config_generation_publish_fail generation=%s", generation)


async def fetch_pg_generation(db: AsyncSession) -> int:
    """Durable generation из music_forge_config_meta (без commit — строка сидится миграцией)."""
    row = (
        await db.execute(
            text(
                """
                SELECT generation FROM music_forge_config_meta WHERE id = 1 LIMIT 1
                """
            )
        )
    ).first()
    if row is not None:
        return int(row[0])
    # До миграции / пустой meta: fail-soft stamp 0 (force reload; activate bump создаст строку).
    logger.error("[STEP] music_forge_config_meta_missing — using generation=0")
    return 0


async def bump_pg_generation(db: AsyncSession) -> int:
    """Инкремент generation в той же PG-транзакции, что activate."""
    result = await db.execute(
        text(
            """
            INSERT INTO music_forge_config_meta (id, generation, updated_at)
            VALUES (1, 1, NOW())
            ON CONFLICT (id) DO UPDATE
            SET generation = music_forge_config_meta.generation + 1,
                updated_at = NOW()
            RETURNING generation
            """
        )
    )
    row = result.first()
    if row is None:
        raise RuntimeError("music_forge_config_meta_bump_failed")
    return int(row[0])
