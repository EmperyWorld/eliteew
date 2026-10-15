# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shared EWA Postgres schema init + platform settings bootstrap for API and workers.
# Invariants:
# - Call after ``open_ewa_orchestration_pool``; idempotent DDL + settings cache reload.
# Related:
# - api/ewa_platform/desktop/pool.py
# - api/ewa_platform/companion/jobs/executor.py
# ---

from __future__ import annotations

import asyncpg

from api.ewa_platform.companion.prompt_blocks.service import bootstrap_prompt_blocks
from api.ewa_platform.persistence_pg.agentic_asyncpg import init_ewa_agentic_schema
from api.ewa_platform.persistence_pg.companion_asyncpg import init_ewa_companion_schema
from api.ewa_platform.persistence_pg.companion_plans_asyncpg import init_ewa_companion_plans_schema
from api.ewa_platform.persistence_pg.companion_user_workflows_asyncpg import (
    init_ewa_companion_user_workflows_schema,
)
from api.ewa_platform.persistence_pg.companion_workflow_catalog_asyncpg import (
    init_ewa_companion_workflow_catalog_schema,
)
from api.ewa_platform.persistence_pg.orchestration_asyncpg import init_ewa_orchestration_schema
from api.ewa_platform.settings.service import bootstrap_ewa_platform_settings


async def init_ewa_data_plane(pool: asyncpg.Pool, *, load_settings: bool = True) -> None:
    await init_ewa_orchestration_schema(pool)
    await init_ewa_companion_schema(pool)
    await init_ewa_agentic_schema(pool)
    await init_ewa_companion_plans_schema(pool)
    await init_ewa_companion_workflow_catalog_schema(pool)
    await init_ewa_companion_user_workflows_schema(pool)
    if load_settings:
        await bootstrap_ewa_platform_settings(pool)
    await bootstrap_prompt_blocks(pool)


__all__ = ["init_ewa_data_plane"]
