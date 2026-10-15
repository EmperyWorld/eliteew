# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Enforce ``max_concurrent_per_principal`` for music, image, and presentation async runs
# before Celery enqueue (WF-4 / E8 / Trust Restoration T2).
# Invariants:
# - Counts only durable PG runs in active statuses; never invent queue depth.
# - Catalog caps come from tool_catalog_v2; gate fails closed with unavailable reply.
# Related:
# - api/ewa_platform/companion/orchestration/tool_catalog_v2.py
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# - documentation/product/ewa/EWA-TRUST-RESTORATION-PROGRAM-2026-07-09.md
# ---

from __future__ import annotations

import asyncpg

from api.ewa_platform.companion.orchestration.tool_catalog_v2 import tool_descriptor_v2
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg


def music_max_concurrent_per_principal() -> int:
    desc = tool_descriptor_v2("music_generation")
    if desc is None:
        return 1
    return max(1, int(desc.max_concurrent_per_principal or 1))


def image_max_concurrent_per_principal() -> int:
    desc = tool_descriptor_v2("image_generation")
    if desc is None:
        desc = tool_descriptor_v2("image_tool")
    if desc is None:
        return 1
    return max(1, int(desc.max_concurrent_per_principal or 1))


def presentation_max_concurrent_per_principal() -> int:
    desc = tool_descriptor_v2("presentation_generation")
    if desc is None:
        return 1
    return max(1, int(desc.max_concurrent_per_principal or 1))


async def companion_music_capacity_exceeded(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    exclude_run_id: str | None = None,
) -> bool:
    """Return True when another async music run is already active for the principal."""

    active = await companion_pg.companion_task_count_active_music_runs(
        pool,
        principal_id=principal_id,
        exclude_run_id=exclude_run_id,
    )
    return active >= music_max_concurrent_per_principal()


async def companion_image_capacity_exceeded(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    exclude_run_id: str | None = None,
) -> bool:
    """Return True when another async image run is already active for the principal."""

    active = await companion_pg.companion_task_count_active_image_runs(
        pool,
        principal_id=principal_id,
        exclude_run_id=exclude_run_id,
    )
    return active >= image_max_concurrent_per_principal()


async def companion_presentation_capacity_exceeded(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    exclude_run_id: str | None = None,
) -> bool:
    """Return True when another async presentation run is already active for the principal."""

    active = await companion_pg.companion_task_count_active_presentation_runs(
        pool,
        principal_id=principal_id,
        exclude_run_id=exclude_run_id,
    )
    return active >= presentation_max_concurrent_per_principal()


def music_busy_reply(*, ru: bool) -> str:
    if ru:
        return "Сейчас уже идёт генерация музыки — дождись завершения или спроси «на каком этапе генерация»."
    return "Music generation is already in progress — wait for it to finish or ask for the current stage."


def image_busy_reply(*, ru: bool) -> str:
    if ru:
        return "Сейчас уже идёт генерация изображения — дождись завершения или спроси «на каком этапе картинка»."
    return "Image generation is already in progress — wait for it to finish or ask for the current stage."


def presentation_busy_reply(*, ru: bool) -> str:
    if ru:
        return "Сейчас уже идёт генерация презентации — дождись завершения или спроси «на каком этапе презентация»."
    return "Presentation generation is already in progress — wait for it to finish or ask for the current stage."


__all__ = (
    "companion_image_capacity_exceeded",
    "companion_music_capacity_exceeded",
    "companion_presentation_capacity_exceeded",
    "image_busy_reply",
    "image_max_concurrent_per_principal",
    "music_busy_reply",
    "music_max_concurrent_per_principal",
    "presentation_busy_reply",
    "presentation_max_concurrent_per_principal",
)
