# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery task for Gen/Forge factory Intention ticks (queue ``ewa_factory``).
# Invariants:
# - Concurrency expected 1 at worker pool; self-chains remaining_ticks.
# - Pause / terminal / missing id → no Celery retry storm.
# Related:
# - api/ewa_platform/factory/jobs/enqueue.py
# - documentation/platform/docker-re_doc/ADMIN-FACTORY-OPS.md
# ---

from __future__ import annotations

import logging
from typing import Any

from api.ewa_platform.factory.jobs.enqueue import enqueue_factory_tick
from api.ewa_platform.factory.models import TERMINAL_STATUSES, FactoryStatus
from api.ewa_platform.factory.service import get_factory_service
from api.ewa_platform.factory.state_machine import FactoryTransitionError
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

FACTORY_TICK_SOFT_TIME_LIMIT_SEC = 120
FACTORY_TICK_TIME_LIMIT_SEC = 180


@celery_app.task(
    name="api.ewa_platform.workers.factory_task_runner.factory_intention_tick_task",
    bind=True,
    max_retries=2,
    soft_time_limit=FACTORY_TICK_SOFT_TIME_LIMIT_SEC,
    time_limit=FACTORY_TICK_TIME_LIMIT_SEC,
    acks_late=True,
    reject_on_worker_lost=True,
)
def factory_intention_tick_task(
    self: Any,
    *,
    intention_id: str,
    verify_passed: bool = True,
    remaining_ticks: int = 1,
) -> dict[str, Any]:
    """Execute one factory FSM tick; chain while remaining_ticks > 1."""

    iid = str(intention_id or "").strip()
    rem = max(1, int(remaining_ticks or 1))
    svc = get_factory_service()
    try:
        item = svc.tick(iid, verify_passed=bool(verify_passed))
    except KeyError:
        logger.warning("[STEP] factory_tick_not_found intention_id=%s", iid)
        return {"ok": False, "reason": "not_found", "intention_id": iid}
    except FactoryTransitionError as exc:
        logger.info(
            "[STEP] factory_tick_blocked intention_id=%s err=%s",
            iid,
            exc,
        )
        return {
            "ok": False,
            "reason": "transition_blocked",
            "intention_id": iid,
            "detail": str(exc),
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("[STEP] factory_tick_failed intention_id=%s err=%s", iid, exc)
        raise self.retry(
            exc=exc,
            countdown=min(30, 2 ** int(getattr(self.request, "retries", 0) or 0)),
        ) from exc

    status = str(item.get("status") or "")
    next_rem = rem - 1
    chained_id: str | None = None
    if next_rem > 0 and status not in {s.value for s in TERMINAL_STATUSES} and status != FactoryStatus.PAUSED.value:
        chained_id = enqueue_factory_tick(
            intention_id=iid,
            verify_passed=bool(verify_passed),
            remaining_ticks=next_rem,
        )
    logger.info(
        "[STEP] factory_tick_done intention_id=%s status=%s stage=%s chained=%s",
        iid,
        status,
        item.get("stage"),
        chained_id,
    )
    return {
        "ok": True,
        "intention_id": iid,
        "item": item,
        "remaining_ticks": next_rem,
        "chained_task_id": chained_id,
    }
