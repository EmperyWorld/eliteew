# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Backend-owned Курсорина mission runner + enqueue with concurrency gates.
# Invariants:
# - HTTP only creates/queues; Celery runs the loop to terminal.
# - Per-user and global active caps prevent API/worker pile-up.
# Related:
# - documentation/product/desktop/KURSORINA.md
# - api/tasks/kursorina.py
# ---

from __future__ import annotations

import logging
import os
from uuid import UUID

from api.services.kursorina.loop import tick_mission
from api.services.kursorina.runtime import ToolRuntime
from api.services.kursorina.store import (
    claim_queued_mission,
    count_active_missions,
    get_mission_by_id,
    save_mission,
)

logger = logging.getLogger(__name__)


def max_per_user() -> int:
    return max(1, min(int(os.getenv("KURSORINA_MAX_PER_USER", "1") or "1"), 5))


def max_global() -> int:
    return max(1, min(int(os.getenv("KURSORINA_MAX_GLOBAL", "32") or "32"), 200))


class KursorinaCapacityError(Exception):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


async def assert_can_enqueue(*, principal_id: str) -> None:
    user_n = await count_active_missions(principal_id=principal_id)
    if user_n >= max_per_user():
        raise KursorinaCapacityError(
            "У вас уже выполняется задача Курсорины. Дождитесь окончания или отмените её.",
            code="per_user_limit",
        )
    global_n = await count_active_missions(principal_id=None)
    if global_n >= max_global():
        raise KursorinaCapacityError(
            "Сейчас много задач в очереди. Попробуйте чуть позже.",
            code="global_limit",
        )


def enqueue_mission_run(*, mission_id: str, user_id: str) -> str:
    from api.tasks.kursorina import run_kursorina_mission_task

    async_result = run_kursorina_mission_task.delay(mission_id, user_id)
    task_id = str(getattr(async_result, "id", "") or "")
    logger.info(
        "[STEP] kursorina_enqueued mission_id=%s task_id=%s user_id=%s",
        mission_id[:48],
        task_id[:48],
        user_id[:48],
    )
    return task_id


async def run_mission_background(*, mission_id: str, user_id: str) -> None:
    """Celery async body: drive loop until terminal or cancel."""
    from api.core.database_manager import get_database_manager

    uid = UUID(str(user_id))
    mission = await get_mission_by_id(mission_id=mission_id)
    if mission is None:
        logger.info("[STEP] kursorina_job_missing mission_id=%s", mission_id[:48])
        return
    if mission.principal_id != str(uid):
        logger.info("[STEP] kursorina_job_principal_mismatch mission_id=%s", mission_id[:48])
        mission.status = "blocked"
        mission.block_reason = "principal mismatch — задача остановлена"
        await save_mission(mission)
        return
    if mission.status in {"completed", "blocked", "cancelled"}:
        return

    try:
        db_manager = await get_database_manager()
        async with db_manager.get_postgres_session() as db:
            runtime = ToolRuntime(db=db, user_id=uid, web_enabled=True)
            mission = await get_mission_by_id(mission_id=mission_id)
            if mission is None:
                return
            if mission.status in {"completed", "blocked", "cancelled"}:
                return
            if mission.cancel_requested:
                mission.status = "cancelled"
                mission.block_reason = mission.block_reason or "cancelled by user"
                await save_mission(mission)
                return
            # Claim queued→running atomically (lost claim → cancel won or already running).
            if mission.status == "queued":
                claimed = await claim_queued_mission(mission)
                if claimed is None:
                    again = await get_mission_by_id(mission_id=mission_id)
                    if again is None:
                        return
                    if again.cancel_requested or again.status == "cancelled":
                        again.status = "cancelled"
                        again.block_reason = again.block_reason or "cancelled by user"
                        await save_mission(again)
                        mission = again
                        return
                    if again.status != "running":
                        return
                    mission = again
                else:
                    mission = claimed
            elif mission.status != "running":
                return

            rounds = 0
            while mission.status == "running" and rounds < 40:
                fresh = await get_mission_by_id(mission_id=mission_id)
                if fresh is None:
                    return
                if fresh.cancel_requested or fresh.status == "cancelled":
                    mission.cancel_requested = True
                    mission.status = "cancelled"
                    mission.block_reason = mission.block_reason or "cancelled by user"
                    await save_mission(mission)
                    break
                if fresh.status in {"completed", "blocked"}:
                    return
                mission.cancel_requested = fresh.cancel_requested
                mission = await tick_mission(mission, max_steps=3, runtime=runtime)
                rounds += 1

            if mission.status == "running":
                mission.status = "blocked"
                mission.block_reason = mission.block_reason or "mission time budget exceeded"
            await save_mission(mission)
    except Exception as exc:  # noqa: BLE001 — must terminalize so capacity unlocks
        logger.info(
            "[STEP] kursorina_job_fail mission_id=%s err=%s",
            mission_id[:48],
            type(exc).__name__,
        )
        try:
            stuck = await get_mission_by_id(mission_id=mission_id)
            if stuck is not None and stuck.status in {"queued", "running"}:
                stuck.status = "blocked"
                stuck.block_reason = "Внутренняя ошибка выполнения. Попробуйте ещё раз."
                await save_mission(stuck)
                mission = stuck
        except Exception as save_exc:  # noqa: BLE001
            logger.info(
                "[STEP] kursorina_job_fail_save_err mission_id=%s err=%s",
                mission_id[:48],
                type(save_exc).__name__,
            )
            raise exc from save_exc
        raise

    logger.info(
        "[STEP] kursorina_job_done mission_id=%s status=%s",
        mission_id[:48],
        mission.status,
    )


__all__ = (
    "KursorinaCapacityError",
    "assert_can_enqueue",
    "enqueue_mission_run",
    "max_global",
    "max_per_user",
    "run_mission_background",
)
