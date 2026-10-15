# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Schedules marketing AMKA asyncio background phases through `MarketingCabinetAmkaDriver` using lazy imports
# so `amka_core` package `__init__` is not loaded during `amka_phase_plan` / `amka_run_lifecycle` import
# (avoids circular import with `AmkaService` ↔ `amka_phases` ↔ `amka_phase_plan`).
# Invariants:
# - Same `amka-plan:` / `amka-exec:` / `amka-auto-chain:` task keys as `_spawn_background` (cancel-run cancellation).
# - Callers must hold a live marketing DB pool; no new pools here.
# Related:
# - shared/api/services/amka_core/marketing_driver.py
# - shared/api/services/marketing_cabinet/amka_run_lifecycle.py
# - documentation/product/amka-seed-album/RFC-001-amka-driver-contract.md (driver boundary, wave 19)
# ---
from __future__ import annotations

from uuid import UUID

import asyncpg  # type: ignore[import-not-found]


def schedule_marketing_amka_plan_background(
    db_pool: asyncpg.Pool,
    *,
    run_id: UUID,
    user_id: UUID,
) -> None:
    """Enqueue `_run_plan_background` via the marketing driver."""
    from api.services.amka_core.marketing_driver import MarketingCabinetAmkaDriver

    MarketingCabinetAmkaDriver(db_pool).schedule_background_plan(run_id=run_id, user_id=user_id)


def schedule_marketing_amka_execute_background(
    db_pool: asyncpg.Pool,
    *,
    run_id: UUID,
    user_id: UUID,
) -> None:
    """Enqueue `_run_execute_background` via the marketing driver."""
    from api.services.amka_core.marketing_driver import MarketingCabinetAmkaDriver

    MarketingCabinetAmkaDriver(db_pool).schedule_background_execute(run_id=run_id, user_id=user_id)


def schedule_marketing_amka_auto_chain_background(
    db_pool: asyncpg.Pool,
    *,
    prev_run_id: UUID,
    user_id: UUID,
) -> None:
    """Enqueue the next auto-cycle attempt via the marketing driver (after execute completes)."""
    from api.services.amka_core.marketing_driver import MarketingCabinetAmkaDriver

    MarketingCabinetAmkaDriver(db_pool).schedule_background_auto_chain(prev_run_id=prev_run_id, user_id=user_id)
