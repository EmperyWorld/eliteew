# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phased Celery control.inspect for Admin workers-ops (essentials first, detail best-effort).
# Invariants:
# - Celery inspect waits ~reply_timeout per broadcast; never pack 7 calls under a 6s outer budget.
# - Phase A (ping + active_queues) drives pool online; Phase B fills task tables when time remains.
# Related:
# - documentation/platform/docker-re_doc/ADMIN-WORKERS-OPS.md
# - documentation/platform/docker-re_doc/STACK0-HEALTHCHECK-LAYERS.md
# ---
"""Phased Celery inspect for Admin snapshot."""

from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

# Celery Inspect typically waits the full reply window for broadcast replies.
INSPECT_REPLY_TIMEOUT_SEC = 2.5
# Phase A must finish under outer wait_for (ping + active_queues ≈ 2 × reply timeout).
INSPECT_ESSENTIAL_BUDGET_SEC = 12.0
# Optional detail (stats/active/reserved/scheduled/registered) after essentials.
INSPECT_DETAIL_BUDGET_SEC = 15.0
# Outer asyncio.wait_for ceiling for the whole sync inspect thread.
INSPECT_TOTAL_BUDGET_SEC = INSPECT_ESSENTIAL_BUDGET_SEC + INSPECT_DETAIL_BUDGET_SEC + 2.0


def empty_celery_slice(*, status: str, error: str | None) -> dict[str, Any]:
    return {
        "status": status,
        "error": error,
        "ping": {},
        "stats": {},
        "active_queues": {},
        "active": [],
        "reserved": [],
        "scheduled": [],
        "registered": {},
        "workers_online": [],
        "inspect_phases": {"essential_sec": None, "detail_sec": None, "detail_skipped": []},
    }


def trim_task_list(raw: Any, *, limit: int = 50) -> list[dict[str, Any]]:
    if not isinstance(raw, dict):
        return []
    items: list[dict[str, Any]] = []
    for worker, tasks in raw.items():
        if not isinstance(tasks, list):
            continue
        for task in tasks:
            if not isinstance(task, dict):
                continue
            items.append(
                {
                    "worker": str(worker),
                    "id": str(task.get("id") or task.get("request", {}).get("id") or ""),
                    "name": str(task.get("name") or task.get("request", {}).get("task") or ""),
                    "args": task.get("args"),
                    "kwargs": task.get("kwargs"),
                    "time_start": task.get("time_start"),
                }
            )
            if len(items) >= limit:
                return items
    return items


def _safe_call(label: str, fn, errors: list[str]) -> Any:
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001 — degrade path
        errors.append(f"{label}:{type(exc).__name__}")
        logger.warning("[STEP] workers_ops_inspect_%s_fail err=%s", label, exc)
        return None


def inspect_celery_sync(
    *,
    reply_timeout: float = INSPECT_REPLY_TIMEOUT_SEC,
    detail: bool = True,
) -> dict[str, Any]:
    """Run Celery inspect in two phases so Overview stays honest under load."""
    from api.tasks.celery_app import celery_app

    inspector = celery_app.control.inspect(timeout=reply_timeout)
    if inspector is None:
        return empty_celery_slice(status="degraded", error="inspect_unavailable")

    errors: list[str] = []
    detail_skipped: list[str] = []
    t0 = time.monotonic()

    ping_raw = _safe_call("ping", inspector.ping, errors)
    ping: dict[str, Any] = ping_raw if isinstance(ping_raw, dict) else {}

    aq_raw = _safe_call("active_queues", inspector.active_queues, errors)
    active_queues: dict[str, Any] = aq_raw if isinstance(aq_raw, dict) else {}
    essential_sec = round(time.monotonic() - t0, 3)

    stats: dict[str, Any] = {}
    active_raw: dict[str, Any] = {}
    reserved_raw: dict[str, Any] = {}
    scheduled_raw: dict[str, Any] = {}
    registered: dict[str, Any] = {}
    detail_sec: float | None = None

    if detail:
        t1 = time.monotonic()
        detail_deadline = t1 + INSPECT_DETAIL_BUDGET_SEC

        def _have_time() -> bool:
            return time.monotonic() < detail_deadline

        if _have_time():
            stats_raw = _safe_call("stats", inspector.stats, errors)
            stats = stats_raw if isinstance(stats_raw, dict) else {}
        else:
            detail_skipped.append("stats")

        if _have_time():
            active_got = _safe_call("active", inspector.active, errors)
            active_raw = active_got if isinstance(active_got, dict) else {}
        else:
            detail_skipped.append("active")

        if _have_time():
            reserved_got = _safe_call("reserved", inspector.reserved, errors)
            reserved_raw = reserved_got if isinstance(reserved_got, dict) else {}
        else:
            detail_skipped.append("reserved")

        if _have_time():
            scheduled_got = _safe_call("scheduled", inspector.scheduled, errors)
            scheduled_raw = scheduled_got if isinstance(scheduled_got, dict) else {}
        else:
            detail_skipped.append("scheduled")

        if _have_time():
            registered_raw = _safe_call("registered", inspector.registered, errors)
            if isinstance(registered_raw, dict):
                for worker, tasks in registered_raw.items():
                    if isinstance(tasks, list):
                        registered[str(worker)] = [str(t) for t in tasks[:80]]
                    else:
                        registered[str(worker)] = []
        else:
            detail_skipped.append("registered")

        detail_sec = round(time.monotonic() - t1, 3)
    else:
        detail_skipped.extend(["stats", "active", "reserved", "scheduled", "registered"])

    workers_online = sorted({str(w) for w in ping})
    status = "ok" if workers_online and not errors else ("degraded" if workers_online or ping else "unavailable")
    if not workers_online and not ping and not stats and not active_queues:
        status = "unavailable"

    return {
        "status": status,
        "error": ";".join(errors) if errors else None,
        "ping": ping,
        "stats": stats,
        "active_queues": active_queues,
        "active": trim_task_list(active_raw),
        "reserved": trim_task_list(reserved_raw),
        "scheduled": trim_task_list(scheduled_raw),
        "registered": registered,
        "workers_online": workers_online,
        "inspect_phases": {
            "essential_sec": essential_sec,
            "detail_sec": detail_sec,
            "detail_skipped": detail_skipped,
            "reply_timeout_sec": reply_timeout,
        },
    }
