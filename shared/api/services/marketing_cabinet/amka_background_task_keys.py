# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Single source for marketing AMKA asyncio background task key prefixes used with
# `_spawn_background` / `AMKA_BACKGROUND_TASKS` (plan, execute, auto-cycle chain).
# Invariants:
# - Keys must stay aligned with `cancel_run` in `amka_run_lifecycle.py` and with
#   `MarketingCabinetAmkaDriver.schedule_background_*`.
# - `amka-auto-chain` keys include a unique suffix per enqueue; cancel matches by prefix.
# Related:
# - documentation/product/amka-seed-album/AMKA-BACKGROUND-TASK-KEYS.md
# - shared/api/services/marketing_cabinet/amka_background_tasks.py (`_spawn_background`)
# ---
from __future__ import annotations

AMKA_BG_TASK_PREFIX_PLAN = "amka-plan:"
AMKA_BG_TASK_PREFIX_EXEC = "amka-exec:"
AMKA_BG_TASK_PREFIX_AUTO_CHAIN = "amka-auto-chain:"


def amka_plan_task_key(run_id: object) -> str:
    return f"{AMKA_BG_TASK_PREFIX_PLAN}{run_id}"


def amka_exec_task_key(run_id: object) -> str:
    return f"{AMKA_BG_TASK_PREFIX_EXEC}{run_id}"


def amka_auto_chain_task_key(*, run_id: object, unique_suffix: str) -> str:
    return f"{AMKA_BG_TASK_PREFIX_AUTO_CHAIN}{run_id}:{unique_suffix}"


__all__ = [
    "AMKA_BG_TASK_PREFIX_AUTO_CHAIN",
    "AMKA_BG_TASK_PREFIX_EXEC",
    "AMKA_BG_TASK_PREFIX_PLAN",
    "amka_auto_chain_task_key",
    "amka_exec_task_key",
    "amka_plan_task_key",
]
