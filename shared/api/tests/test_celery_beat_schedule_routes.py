# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: every Celery beat_schedule task resolves to a known queue (route or default).
# Invariants:
# - New beat entries must either match task_routes or intentionally use default queue short.
# Related:
# - api/tasks/celery_app.py
# - documentation/platform/CELERY-BEAT-AND-QUEUES.md
# ---
"""Beat schedule ↔ queue route regression."""

from __future__ import annotations

from api.tasks.celery_app import celery_app


def _queue_for_task(task_name: str) -> str:
    """Mirror Celery dict route order: first match wins (insertion order)."""
    routes = getattr(celery_app.conf, "task_routes", None) or {}
    default_q = str(getattr(celery_app.conf, "task_default_queue", "short") or "short")
    if not isinstance(routes, dict):
        return default_q
    for pattern, conf in routes.items():
        if not isinstance(conf, dict):
            continue
        queue = str(conf.get("queue") or default_q)
        if pattern == task_name:
            return queue
        if not isinstance(pattern, str):
            continue
        if pattern.endswith(".*"):
            prefix = pattern[:-2]
            if task_name.startswith(prefix + ".") or task_name.startswith(prefix):
                # prefix is module path without trailing dot issues
                if task_name.startswith(prefix):
                    return queue
        elif "*" in pattern:
            parts = [p for p in pattern.split("*") if p]
            if all(p in task_name for p in parts):
                return queue
    return default_q


def test_every_beat_entry_resolves_to_declared_queue() -> None:
    known = {q.name for q in (getattr(celery_app.conf, "task_queues", None) or ()) if getattr(q, "name", None)}
    default_q = str(getattr(celery_app.conf, "task_default_queue", "short") or "short")
    known.add(default_q)

    schedule = getattr(celery_app.conf, "beat_schedule", None) or {}
    assert isinstance(schedule, dict) and schedule, "beat_schedule must be non-empty"

    for beat_name, conf in schedule.items():
        assert isinstance(conf, dict), beat_name
        task = str(conf.get("task") or "")
        assert task, f"beat {beat_name} missing task"
        queue = _queue_for_task(task)
        assert queue in known, f"beat {beat_name} task {task} → queue {queue!r} not in {sorted(known)}"


def test_video_call_ringing_reconcile_on_short_queue() -> None:
    assert _queue_for_task("api.tasks.video_call_ringing_reconcile.reconcile_stale_ringing_video_calls") == "short"
