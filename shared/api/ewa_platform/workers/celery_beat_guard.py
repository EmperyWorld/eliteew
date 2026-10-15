# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared try/except wrapper for EWA Celery beat tasks — structured failure logs without swallowing.
# Invariants:
# - Re-raises after log so Celery retry/beat visibility remains intact.
# Related:
# - api/ewa_platform/workers/episodic_reembed_task.py
# - api/ewa_platform/workers/daily_rollup_task.py
# ---

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from api.core.celery_async import run_celery_async
from api.monitoring.metrics import record_ewa_celery_beat_success

logger = logging.getLogger(__name__)


def run_celery_beat_task[T](task_name: str, runner: Callable[[], Awaitable[T]]) -> T:
    """Execute async beat body with structured logging on failure."""

    label = str(task_name or "celery_beat_task").strip() or "celery_beat_task"
    try:
        result = run_celery_async(runner())
        record_ewa_celery_beat_success(task=label)
        return result
    except Exception:
        logger.exception("[STEP] %s_failed", label)
        raise


def run_celery_beat_task_dict(
    task_name: str,
    runner: Callable[[], Awaitable[dict[str, Any]]],
) -> dict[str, Any]:
    return run_celery_beat_task(task_name, runner)
