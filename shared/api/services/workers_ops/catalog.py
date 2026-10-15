# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Static Celery catalogs for Admin workers-ops (queues, beat schedule, rate limits).
# Invariants:
# - No broker I/O; reads celery_app.conf only.
# Related:
# - api/tasks/celery_app.py
# ---
"""Celery config catalogs for Admin workers-ops."""

from __future__ import annotations

from datetime import timedelta
from typing import Any


def known_celery_queue_names() -> frozenset[str]:
    from api.tasks.celery_app import celery_app

    names: set[str] = set()
    queues = getattr(celery_app.conf, "task_queues", None) or ()
    for q in queues:
        name = getattr(q, "name", None)
        if isinstance(name, str) and name.strip():
            names.add(name.strip())
    default_q = getattr(celery_app.conf, "task_default_queue", None)
    if isinstance(default_q, str) and default_q.strip():
        names.add(default_q.strip())
    return frozenset(names)


def schedule_summary(entry: Any) -> str:
    """Human-readable beat schedule fragment (no secrets)."""
    if entry is None:
        return "—"
    if isinstance(entry, timedelta):
        return f"every {entry.total_seconds():.0f}s"
    schedule = getattr(entry, "schedule", entry)
    if isinstance(schedule, timedelta):
        return f"every {schedule.total_seconds():.0f}s"
    run_every = getattr(schedule, "run_every", None)
    if isinstance(run_every, timedelta):
        return f"every {run_every.total_seconds():.0f}s"
    minute = getattr(schedule, "minute", None)
    hour = getattr(schedule, "hour", None)
    if minute is not None or hour is not None:
        return f"crontab minute={minute!s} hour={hour!s}"
    return str(schedule)[:120]


def beat_schedule_catalog() -> list[dict[str, str]]:
    from api.tasks.celery_app import celery_app

    raw = getattr(celery_app.conf, "beat_schedule", None) or {}
    out: list[dict[str, str]] = []
    if not isinstance(raw, dict):
        return out
    for name, conf in raw.items():
        if not isinstance(conf, dict):
            continue
        task = str(conf.get("task") or "")
        schedule = schedule_summary(conf.get("schedule"))
        out.append({"name": str(name), "task": task, "schedule": schedule})
    out.sort(key=lambda row: row["name"])
    return out


def queue_catalog() -> list[dict[str, str]]:
    from api.tasks.celery_app import celery_app

    rows: list[dict[str, str]] = []
    for q in getattr(celery_app.conf, "task_queues", None) or ():
        name = getattr(q, "name", None)
        if not isinstance(name, str) or not name.strip():
            continue
        routing_key = getattr(q, "routing_key", "") or ""
        rows.append({"name": name.strip(), "routing_key": str(routing_key)})
    return rows


def celery_rate_limit_policy() -> dict[str, Any]:
    """Expose Celery task_annotations rate_limit: global default + explicit None exemptions."""
    from api.tasks.celery_app import celery_app

    annotations = getattr(celery_app.conf, "task_annotations", None) or {}
    default_rate_limit: str | None = None
    exempt_tasks: list[str] = []

    if isinstance(annotations, dict):
        star = annotations.get("*")
        if isinstance(star, dict):
            raw_default = star.get("rate_limit")
            if raw_default is not None:
                default_rate_limit = str(raw_default)
        for task_name, conf in annotations.items():
            if task_name == "*":
                continue
            if isinstance(conf, dict) and conf.get("rate_limit") is None:
                exempt_tasks.append(str(task_name))

    exempt_tasks.sort()
    return {
        "default_rate_limit": default_rate_limit,
        "exempt_tasks": exempt_tasks,
    }
