# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Startup invariant checks for IMC generation type routing.
# Keeps legacy IMC keys out of generic chat providers so RAG-only flows receive embedding context.
# Invariants:
# - Active IMC research types must not route through miso_provider except allowed legacy entry points.
# - imc_cabinet_filler must use its dedicated provider, not a generic text provider.
# Related:
# - api.services.ugs.providers.imc_rag_research_provider
# - shared/api/migrations/applied/20260506_05_imc_generation_types_rag_provider_repair.sql
# ---
"""Startup checks: IMC generation_types must not route RAG-only flows to generic chat providers."""

from __future__ import annotations

import logging
import os

import asyncpg  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)

_STRICT_ENV = "ELITEEW_STRICT_IMC_GENERATION_TYPES"


async def validate_imc_miso_provider_assignments(pool: asyncpg.Pool) -> list[str]:
    """
    Return type_key values that violate the invariant:
    active + provider miso_provider + type_key like imc_% but not marketing_research_creator,
    plus imc_cabinet_filler when it is not on its dedicated provider.
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT type_key
            FROM generation_types
            WHERE is_active = true
              AND (
                (
                  provider = 'miso_provider'
                  AND type_key LIKE 'imc_%'
                  AND type_key NOT IN ('marketing_research_creator', 'imc_cabinet_filler')
                )
                OR (
                  type_key = 'imc_cabinet_filler'
                  AND provider IS DISTINCT FROM 'imc_cabinet_filler_provider'
                )
              )
            ORDER BY type_key
            """
        )
    return [str(r["type_key"]) for r in rows if r.get("type_key")]


async def log_or_raise_imc_provider_invariant(pool: asyncpg.Pool | None) -> None:
    if pool is None:
        return
    bad = await validate_imc_miso_provider_assignments(pool)
    if not bad:
        return
    msg = (
        "generation_types misconfiguration: active IMC type_key on generic chat provider "
        f"(expected imc_rag_research_provider or dedicated provider): {bad}"
    )
    logger.error(msg)
    strict = os.getenv(_STRICT_ENV, "").lower() in ("1", "true", "yes")
    if strict:
        raise RuntimeError(msg)
