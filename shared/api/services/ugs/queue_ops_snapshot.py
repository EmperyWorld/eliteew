# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Operator-facing UGS queue snapshot (Postgres, RabbitMQ management API, Redis leases) without Prometheus.
# Invariants:
# - Snapshot is read-mostly; QueueManagerService.get_queue_stats() may clean stale queue entries.
# - RabbitMQ / Redis failures degrade individual sections, not the whole HTTP handler.
# - ``operator_slo`` is derived from the same snapshot inputs (no extra outbound probes).
# Related:
# - api/routers/ugs_admin/queue_ops_routes.py (GET /queue-ops)
# - documentation/platform/docker-re_doc/UGS-QUEUE-OPERATIONS-RUNBOOK.md
# ---
"""UGS queue operations snapshot for operators (no Prometheus dependency)."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select, text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.database_manager import DatabaseFeatures, get_redis_client
from api.models.database_models import GenerationRequest
from api.monitoring.metrics import update_beat_workers_off_alarm
from api.services.rabbitmq_service import fetch_rabbitmq_queues_snapshot
from api.services.ugs.queue_worker_resilience import _LEASE_KEY_PREFIX
from api.services.ugs.ugs_stale_horizons import (
    stale_pending_in_queue_after,
    stale_pending_orphan_after,
    stale_processing_after,
    stale_processing_estimated_multiplier,
    stale_processing_hours_image,
    stale_processing_hours_music,
    ugs_stale_reaper_interval_minutes,
)
from api.workers.queue_worker_retry import (
    queue_worker_max_attempts,
    queue_worker_prefetch_count,
    queue_worker_rabbitmq_connection_tuning,
)

_LEASE_SCAN_CAP = 10_000


def _env_flag(name: str, default: str = "1") -> bool:
    raw = (os.environ.get(name) or default).strip().lower()
    return raw not in ("0", "false", "no", "off")


def _read_worker_tuning_snapshot() -> dict[str, Any]:
    lease_raw = (os.environ.get("UGS_WORKER_LEASE_SECONDS") or "7200").strip()
    touch_raw = (os.environ.get("UGS_WORKER_LEASE_TOUCH_INTERVAL_SEC") or "120").strip()
    _, client_name = queue_worker_rabbitmq_connection_tuning("amqp://local/")
    return {
        "ugs_worker_lease_seconds": lease_raw,
        "ugs_worker_lease_touch_interval_sec": touch_raw,
        "queue_worker_connection_name": client_name,
        "queue_worker_prefetch_count": queue_worker_prefetch_count(),
        "queue_worker_max_attempts": queue_worker_max_attempts(),
        "queue_worker_retry_backoff": (os.environ.get("QUEUE_WORKER_RETRY_BACKOFF") or "1").strip(),
        "queue_worker_retry_backoff_cap_sec": (os.environ.get("QUEUE_WORKER_RETRY_BACKOFF_CAP_SEC") or "120").strip(),
        "queue_worker_allowed_queue_keys": (os.environ.get("QUEUE_WORKER_ALLOWED_QUEUE_KEYS") or "").strip() or None,
        "queue_worker_log_ugs_handler": _env_flag("QUEUE_WORKER_LOG_UGS_HANDLER", "0"),
        "ugs_stale_reaper_enabled": _env_flag("UGS_STALE_REAPER_ENABLED", "1"),
        "ugs_stale_reaper_interval_minutes": ugs_stale_reaper_interval_minutes(),
        "ugs_dlq_refund_credits": _env_flag("UGS_DLQ_REFUND_CREDITS", "1"),
        "stale_horizons": {
            "pending_orphan_minutes": int(stale_pending_orphan_after().total_seconds() // 60),
            "pending_in_queue_hours": int(stale_pending_in_queue_after().total_seconds() // 3600),
            "processing_hours_default": int(stale_processing_after().total_seconds() // 3600),
            "processing_hours_music": int(stale_processing_hours_music().total_seconds() // 3600),
            "processing_hours_image": int(stale_processing_hours_image().total_seconds() // 3600),
            "processing_estimated_multiplier": stale_processing_estimated_multiplier(),
        },
    }


async def _count_request_statuses(db: AsyncSession) -> dict[str, int]:
    stmt = (
        select(GenerationRequest.status, func.count())
        .where(GenerationRequest.deleted_at.is_(None))
        .group_by(GenerationRequest.status)
    )
    result = await db.execute(stmt)
    out: dict[str, int] = {}
    for status, count in result.all():
        key = str(status or "unknown")
        out[key] = int(count or 0)
    return out


async def _count_dlq_finalized_recent(db: AsyncSession, *, hours: int = 24) -> int:
    stmt = text(
        """
        SELECT COUNT(*)::int
        FROM generation_requests
        WHERE deleted_at IS NULL
          AND status = 'failed'
          AND COALESCE(request_metadata->>'queue_worker_dlq', '') <> ''
          AND updated_at >= NOW() - make_interval(hours => :hours)
        """
    )
    result = await db.execute(stmt, {"hours": hours})
    return int(result.scalar() or 0)


def build_operator_slo(
    *,
    postgres_stats: dict[str, Any],
    stale_candidates: dict[str, Any],
    request_statuses: dict[str, int],
    dlq_failed_24h: int,
) -> dict[str, Any]:
    """
    Derive compact operator SLO cues from queue-ops inputs (no extra I/O).

    ``failed_share`` uses non-deleted request status totals (not a rolling 24h window).
    """
    completed = int(request_statuses.get("completed", 0) or 0)
    failed = int(request_statuses.get("failed", 0) or 0)
    terminal = completed + failed
    failed_share = round(failed / terminal, 4) if terminal > 0 else None

    oldest_raw = postgres_stats.get("pending_oldest_age_seconds")
    oldest_age: float | None
    try:
        oldest_age = float(oldest_raw) if oldest_raw is not None else None
    except TypeError, ValueError:
        oldest_age = None

    stale_total = int(stale_candidates.get("total", 0) or 0)
    total_queued = int(postgres_stats.get("total_queued", 0) or 0)

    level = "healthy"
    if (
        (oldest_age is not None and oldest_age >= 1800)
        or (failed_share is not None and failed_share >= 0.35)
        or dlq_failed_24h > 0
        or stale_total > 5
        or total_queued >= 1000
    ):
        level = "degraded"
    elif (
        (oldest_age is not None and oldest_age >= 300)
        or (failed_share is not None and failed_share >= 0.15)
        or stale_total > 0
        or total_queued >= 50
    ):
        level = "warning"

    return {
        "level": level,
        "pending_oldest_age_seconds": oldest_age,
        "failed_share": failed_share,
        "failed_count": failed,
        "completed_count": completed,
        "stale_total": stale_total,
        "dlq_finalized_failed_24h": int(dlq_failed_24h or 0),
        "total_queued": total_queued,
    }


async def _count_active_ugs_worker_leases() -> dict[str, Any]:
    try:
        redis = await get_redis_client()
    except Exception as exc:
        return {"available": False, "error": str(exc), "active_leases": None, "truncated": None}

    count = 0
    truncated = False
    try:
        async for _key in redis.scan_iter(match=f"{_LEASE_KEY_PREFIX}*", count=200):
            count += 1
            if count >= _LEASE_SCAN_CAP:
                truncated = True
                break
    except Exception as exc:
        return {"available": False, "error": str(exc), "active_leases": None, "truncated": None}

    return {"available": True, "error": None, "active_leases": count, "truncated": truncated}


def _build_hints(
    *,
    postgres_stats: dict[str, Any],
    stale_candidates: dict[str, int],
    rabbitmq: dict[str, Any],
    redis_leases: dict[str, Any],
) -> list[dict[str, str]]:
    hints: list[dict[str, str]] = []
    oldest = postgres_stats.get("pending_oldest_age_seconds")
    if isinstance(oldest, (int, float)) and oldest >= 3600:
        hints.append(
            {
                "level": "warning",
                "code": "pending_oldest_age_high",
                "message": f"Самая старая pending-задача в очереди ~{int(oldest // 60)} мин — проверьте воркер и Redis lease.",
            }
        )

    stale_total = int(
        stale_candidates.get("total")
        or (
            stale_candidates.get("pending_orphan", stale_candidates.get("stale_pending_orphaned", 0))
            + stale_candidates.get("pending_in_queue", stale_candidates.get("stale_pending_queue_timeout", 0))
            + stale_candidates.get("processing", stale_candidates.get("stale_processing_timeout", 0))
        )
        or 0
    )
    if stale_total > 0:
        pending_orphan = int(
            stale_candidates.get("pending_orphan", stale_candidates.get("stale_pending_orphaned", 0)) or 0
        )
        pending_in_queue = int(
            stale_candidates.get("pending_in_queue", stale_candidates.get("stale_pending_queue_timeout", 0)) or 0
        )
        processing = int(stale_candidates.get("processing", stale_candidates.get("stale_processing_timeout", 0)) or 0)
        hints.append(
            {
                "level": "info",
                "code": "stale_candidates_present",
                "message": (
                    f"Есть {stale_total} кандидат(ов) на stale-cleanup "
                    f"(orphan={pending_orphan}, in_queue={pending_in_queue}, processing={processing}). "
                    "Celery reaper или throttled dashboard cleanup обработает эти строки."
                ),
            }
        )

    if not rabbitmq.get("ok") and DatabaseFeatures.ENABLE_RABBITMQ:
        err = str(rabbitmq.get("error") or "unknown")
        hints.append(
            {
                "level": "warning",
                "code": "rabbitmq_management_snapshot_failed",
                "message": (
                    "RabbitMQ Management API недоступен для queue-ops snapshot "
                    f"({err}). Проверьте RABBITMQ_MANAGEMENT_INTERNAL_PORT (in-stack 15672) "
                    "и доступ stack1-rabbitmq из API."
                ),
            }
        )

    if rabbitmq.get("ok"):
        for row in rabbitmq.get("queues") or []:
            if not isinstance(row, dict):
                continue
            name = str(row.get("name", ""))
            ready = int(row.get("messages_ready", 0) or 0)
            if name.endswith(".dlq") and ready > 0:
                hints.append(
                    {
                        "level": "warning",
                        "code": "dlq_messages_ready",
                        "message": f"В DLQ {name!r} сообщений ready={ready} — смотрите тело и request_metadata.queue_worker_*.",
                    }
                )
            elif not name.endswith(".dlq") and ready >= 50:
                hints.append(
                    {
                        "level": "warning",
                        "code": "main_queue_backlog",
                        "message": f"Очередь {name!r} backlog ready={ready} — проверьте queue_worker и prefetch.",
                    }
                )

    if redis_leases.get("available") and int(redis_leases.get("active_leases") or 0) > 0:
        lease_count = int(redis_leases["active_leases"])
        hints.append(
            {
                "level": "info",
                "code": "active_worker_leases",
                "message": f"Активных Redis lease UGS: {lease_count}"
                + (" (scan truncated)" if redis_leases.get("truncated") else ""),
            }
        )
    elif redis_leases.get("available") is False:
        hints.append(
            {
                "level": "warning",
                "code": "redis_lease_unavailable",
                "message": "Redis недоступен — воркер использует Postgres advisory lock на сессии БД; при отсутствии db-сессии возможны дубликаты.",
            }
        )

    beat_enabled = _env_flag("UGS_STALE_REAPER_ENABLED", "1")
    lease_count = int(redis_leases.get("active_leases") or 0) if redis_leases.get("available") else None
    backlog_total = int(postgres_stats.get("total_queued", 0) or 0)
    beat_on_workers_off = update_beat_workers_off_alarm(
        beat_enabled=beat_enabled,
        active_worker_leases=lease_count,
        backlog_total=backlog_total,
    )
    if beat_on_workers_off:
        hints.append(
            {
                "level": "warning",
                "code": "beat_on_workers_off",
                "message": "UGS stale-reaper/beat включен, но активных worker lease нет при непустой очереди.",
            }
        )

    return hints


def _normalize_stale_candidates(raw: dict[str, int] | None) -> dict[str, int]:
    """
    Return stale counters with canonical keys while preserving legacy aliases.

    Canonical keys are consumed by typed frontend contracts. Legacy keys remain
    in payload for backward compatibility with existing operators/scripts.
    """
    source = raw or {}
    pending_orphan = int(source.get("pending_orphan", source.get("stale_pending_orphaned", 0)) or 0)
    pending_in_queue = int(source.get("pending_in_queue", source.get("stale_pending_queue_timeout", 0)) or 0)
    processing = int(source.get("processing", source.get("stale_processing_timeout", 0)) or 0)
    total = int(source.get("total", pending_orphan + pending_in_queue + processing) or 0)
    return {
        "pending_orphan": pending_orphan,
        "pending_in_queue": pending_in_queue,
        "processing": processing,
        "total": total,
        # Legacy aliases (compat)
        "stale_pending_orphaned": pending_orphan,
        "stale_pending_queue_timeout": pending_in_queue,
        "stale_processing_timeout": processing,
    }


def _overall_status(
    *,
    postgres_stats: dict[str, Any],
    rabbitmq: dict[str, Any],
    hints: list[dict[str, str]],
) -> str:
    if any(h.get("level") == "warning" for h in hints):
        return "degraded"
    oldest = postgres_stats.get("pending_oldest_age_seconds")
    if isinstance(oldest, (int, float)) and oldest >= 7200:
        return "degraded"
    if not rabbitmq.get("ok") and DatabaseFeatures.ENABLE_RABBITMQ:
        return "degraded"
    total_queued = int(postgres_stats.get("total_queued", 0) or 0)
    if total_queued >= 1000:
        return "degraded"
    return "healthy"


async def build_queue_ops_snapshot(db: AsyncSession) -> dict[str, Any]:
    """
    Aggregate operator snapshot for UGS queue path (Postgres + RabbitMQ + Redis).

    Does not mutate queue state except ``get_queue_stats`` stale entry cleanup.
    """
    from api.services.ugs.queue_manager_service import QueueManagerService  # noqa: PLC0415

    queue_manager = QueueManagerService(db)
    postgres_stats = await queue_manager.get_queue_stats()
    stale_candidates_raw = await queue_manager.count_stale_candidates()
    stale_candidates = _normalize_stale_candidates(stale_candidates_raw)
    request_statuses = await _count_request_statuses(db)
    dlq_failed_24h = await _count_dlq_finalized_recent(db, hours=24)

    rabbitmq = await fetch_rabbitmq_queues_snapshot()
    redis_leases = await _count_active_ugs_worker_leases()
    worker_tuning = _read_worker_tuning_snapshot()

    hints = _build_hints(
        postgres_stats=postgres_stats,
        stale_candidates=stale_candidates,
        rabbitmq=rabbitmq,
        redis_leases=redis_leases,
    )
    if dlq_failed_24h > 0:
        hints.append(
            {
                "level": "warning",
                "code": "dlq_failures_recent",
                "message": f"За последние 24ч в failed через DLQ: {dlq_failed_24h}. Проверьте source_queue и queue_worker retries.",
            }
        )
    status = _overall_status(postgres_stats=postgres_stats, rabbitmq=rabbitmq, hints=hints)
    operator_slo = build_operator_slo(
        postgres_stats=postgres_stats,
        stale_candidates=stale_candidates,
        request_statuses=request_statuses,
        dlq_failed_24h=dlq_failed_24h,
    )

    return {
        "status": status,
        "timestamp": datetime.now(UTC).isoformat(),
        "postgres": {
            **postgres_stats,
            "request_status_counts": request_statuses,
            "dlq_finalized_failed_24h": dlq_failed_24h,
            "stale_candidates": stale_candidates,
        },
        "rabbitmq": rabbitmq,
        "redis": {"ugs_worker_leases": redis_leases},
        "worker_tuning": worker_tuning,
        "operator_slo": operator_slo,
        "hints": hints,
        "log_grep": [
            "queue_worker: prefetch_count=",
            "UGS worker lease not acquired",
            "Queue handler exhausted retries -> DLQ",
            "Marked %s stale generation request(s) as failed",
            "QUEUE_WORKER_LOG_UGS_HANDLER",
        ],
    }
