# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Durable background companion task execution (Celery enqueue + step executor).
# Invariants:
# - Long-running work must not rely on in-process ``asyncio.create_task`` when async flags are ON.
# Related:
# - api/ewa_platform/companion/jobs/enqueue.py
# - api/ewa_platform/workers/companion_task_runner.py
# ---

from api.ewa_platform.companion.jobs.config import (
    companion_async_jobs_enabled,
    companion_async_music_enabled,
)
from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run
from api.ewa_platform.companion.jobs.executor import execute_companion_run

__all__ = (
    "companion_async_jobs_enabled",
    "companion_async_music_enabled",
    "enqueue_companion_run",
    "execute_companion_run",
)
