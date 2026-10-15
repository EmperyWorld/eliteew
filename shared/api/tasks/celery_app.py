#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery application: Redis broker/backend, task queues, worker tuning, and beat schedule (including
# periodic UGS/Music Evolution stale reapers).
# Invariants:
# - Celery Redis DB index must stay aligned with API (`CELERY_REDIS_DB`); beat schedule file under /tmp
#   for container writability.
# Related:
# - api/tasks/tasks.py
# - api/services/ugs/ugs_stale_horizons.py (UGS_STALE_REAPER_INTERVAL_MINUTES)
# ---
"""Celery app factory and configuration for EliteEW background tasks."""

from __future__ import annotations

import logging
import os
import warnings
from datetime import timedelta

warnings.filterwarnings(
    "ignore",
    message="pkg_resources is deprecated as an API.*",
    category=UserWarning,
)
from typing import Any

from celery import Celery  # type: ignore[import-not-found]
from celery.schedules import crontab  # type: ignore[import-untyped]
from kombu import Exchange, Queue  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.ewa_platform.agentic.config import (
    agentic_lease_reaper_enabled,
    agentic_lease_reaper_interval_sec,
)
from api.ewa_platform.companion.plans.config import (
    companion_meta_evolution_beat_enabled,
    companion_meta_evolution_beat_interval_minutes,
)
from api.services.desktop_client.air_enroll_settings import get_air_enroll_settings
from api.services.ugs.ugs_stale_horizons import ugs_stale_reaper_interval_minutes
from api.services.unified_content.storage_migrate_service import (
    unified_content_hard_purge_beat_enabled,
    unified_content_hard_purge_interval_hours,
)

logger = logging.getLogger(__name__)


# Получаем URL для Redis с паролем если нужно
def get_redis_url(db_number: int = 0) -> str:
    """
    Получить URL для Redis с учетом пароля

    Args:
        db_number: Номер базы данных Redis

    Returns:
        URL для подключения к Redis
    """
    return unified_settings.get_connection_string("redis", str(db_number) if db_number is not None else None)


def _celery_redis_db_index() -> int:
    """Must match API broker: .env.stack0.backend CELERY_REDIS_DB (compose may set CELERY_BROKER_URL)."""
    raw = os.environ.get("CELERY_REDIS_DB", "0")
    try:
        return int(raw)
    except ValueError:
        return 0


def _env_int(name: str, default: int, *, minimum: int = 1, maximum: int = 86_400) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return max(minimum, min(maximum, int(raw)))
    except ValueError:
        return default


# Инициализация Celery приложения (broker DB = CELERY_REDIS_DB, default 0)
_celery_db = _celery_redis_db_index()
celery_broker_url = get_redis_url(_celery_db)
celery_backend_url = get_redis_url(_celery_db)

celery_app = Celery(
    "eliteew_tasks",
    broker=celery_broker_url,
    backend=celery_backend_url,
)


_celery_on_after_configure = celery_app.on_after_configure
if _celery_on_after_configure is None:
    msg = "Celery on_after_configure signal is unavailable"
    raise RuntimeError(msg)


@_celery_on_after_configure.connect
def _register_ewa_worker_pool_lifecycle(**_kwargs: Any) -> None:  # pyright: ignore[reportUnusedFunction]
    """E4: persistent event loop + process-level EWA pool (close on worker shutdown only)."""

    from celery.signals import worker_process_init, worker_process_shutdown, worker_shutdown

    @worker_process_init.connect(weak=False)
    def _on_worker_process_init(**__kwargs: Any) -> None:  # pyright: ignore[reportUnusedFunction]
        from api.core.celery_async import ensure_celery_worker_loop, mark_celery_worker_mode

        # Mark before any DatabaseManager.initialize() so health monitor stays off
        # (Celery loop is only pumped inside run_until_complete — see celery_async).
        mark_celery_worker_mode()
        ensure_celery_worker_loop()

    @worker_process_shutdown.connect(weak=False)
    def _on_worker_process_shutdown(**__kwargs: Any) -> None:  # pyright: ignore[reportUnusedFunction]
        from api.core.celery_async import shutdown_celery_async_resources

        shutdown_celery_async_resources()

    @worker_shutdown.connect(weak=False)
    def _on_worker_shutdown(**__kwargs: Any) -> None:  # pyright: ignore[reportUnusedFunction]
        from api.core.celery_async import shutdown_celery_async_resources

        shutdown_celery_async_resources()


# ============================================================================
# CELERY CONFIGURATION
# ============================================================================

# Task Serialization
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.timezone = "UTC"  # type: ignore[assignment]
celery_app.conf.enable_utc = True

# Task Result Settings
celery_app.conf.result_expires = 3600  # Results expire after 1 hour
celery_app.conf.task_result_expires = 3600
celery_app.conf.result_persistent = True  # Persist results across restarts

# Task Execution Settings
celery_app.conf.task_acks_late = True  # Acknowledge after task completion
celery_app.conf.worker_prefetch_multiplier = _env_int("CELERY_WORKER_PREFETCH_MULTIPLIER", 1, minimum=1, maximum=16)
celery_app.conf.task_reject_on_worker_lost = True  # Requeue on worker crash

# Task Time Limits
celery_app.conf.task_time_limit = 600  # 10 minutes hard limit
celery_app.conf.task_soft_time_limit = 540  # 9 minutes soft limit

# Task Retry Settings
celery_app.conf.task_max_retries = 3
celery_app.conf.task_default_retry_delay = 60  # 1 minute between retries

# Worker Settings
celery_app.conf.worker_max_tasks_per_child = 1000  # Restart worker after 1000 tasks
celery_app.conf.worker_disable_rate_limits = False  # Enable rate limiting
celery_app.conf.broker_transport_options = {
    "socket_timeout": _env_int("CELERY_REDIS_SOCKET_TIMEOUT", 10, minimum=1, maximum=300),
    "socket_connect_timeout": _env_int("CELERY_REDIS_SOCKET_CONNECT_TIMEOUT", 5, minimum=1, maximum=300),
    "retry_on_timeout": True,
    "visibility_timeout": _env_int("CELERY_REDIS_VISIBILITY_TIMEOUT", 3600, minimum=60, maximum=86_400),
}
celery_app.conf.result_backend_transport_options = {
    "retry_on_timeout": True,
    "socket_timeout": _env_int("CELERY_REDIS_SOCKET_TIMEOUT", 10, minimum=1, maximum=300),
    "socket_connect_timeout": _env_int("CELERY_REDIS_SOCKET_CONNECT_TIMEOUT", 5, minimum=1, maximum=300),
}

# Default Queue Configuration
celery_app.conf.task_default_queue = "short"
celery_app.conf.task_default_exchange = "tasks"  # type: ignore[assignment]
celery_app.conf.task_default_exchange_type = "direct"
celery_app.conf.task_default_routing_key = "short"  # type: ignore[assignment]

# Queue Definitions
celery_app.conf.task_queues = (
    Queue("short", Exchange("tasks"), routing_key="short", queue_arguments={"x-max-priority": 10}),
    Queue("maintenance", Exchange("tasks"), routing_key="maintenance", queue_arguments={"x-max-priority": 10}),
    Queue("broadcast", Exchange("tasks"), routing_key="broadcast", queue_arguments={"x-max-priority": 10}),
    Queue("ewa_companion", Exchange("tasks"), routing_key="ewa_companion", queue_arguments={"x-max-priority": 10}),
    Queue("ewa_agentic", Exchange("tasks"), routing_key="ewa_agentic", queue_arguments={"x-max-priority": 10}),
    Queue(
        "ewa_agentic_step", Exchange("tasks"), routing_key="ewa_agentic_step", queue_arguments={"x-max-priority": 10}
    ),
    Queue("ewa_factory", Exchange("tasks"), routing_key="ewa_factory", queue_arguments={"x-max-priority": 10}),
    Queue("ewa_reembed", Exchange("tasks"), routing_key="ewa_reembed", queue_arguments={"x-max-priority": 10}),
    Queue(
        "desktop_discussion",
        Exchange("tasks"),
        routing_key="desktop_discussion",
        queue_arguments={"x-max-priority": 10},
    ),
)

celery_app.conf.task_routes = {
    "api.ewa_platform.workers.companion_task_runner.companion_run_task": {
        "queue": "ewa_companion",
        "routing_key": "ewa_companion",
    },
    "api.ewa_platform.workers.agentic_task_runner.agentic_loop_tick_task": {
        "queue": "ewa_agentic",
        "routing_key": "ewa_agentic",
    },
    "api.ewa_platform.workers.agentic_step_runner.agentic_step_task": {
        "queue": "ewa_agentic_step",
        "routing_key": "ewa_agentic_step",
    },
    "api.ewa_platform.workers.factory_task_runner.factory_intention_tick_task": {
        "queue": "ewa_factory",
        "routing_key": "ewa_factory",
    },
    "api.tasks.desktop_discussion_batch.discussion_batch_task": {
        "queue": "desktop_discussion",
        "routing_key": "desktop_discussion",
    },
    "api.ewa_platform.workers.evolution_tick_task.*": {"queue": "ewa_companion", "routing_key": "ewa_companion"},
    "api.ewa_platform.workers.meta_evolution_sweep_task.*": {
        "queue": "ewa_companion",
        "routing_key": "ewa_companion",
    },
    "api.ewa_platform.workers.episodic_reembed_task.*": {"queue": "ewa_reembed", "routing_key": "ewa_reembed"},
    "api.tasks.system_gaf_broadcast.*": {"queue": "broadcast", "routing_key": "broadcast"},
    "api.tasks.onboarding_gaf.*": {"queue": "broadcast", "routing_key": "broadcast"},
    "api.tasks.desktop_ai_solo_slot_cleanup.*": {"queue": "maintenance", "routing_key": "maintenance"},
    "api.tasks.mobile_private_tunnel_edge_sync.*": {
        "queue": "maintenance",
        "routing_key": "maintenance",
    },
    "api.tasks.desktop_client_portal_edge_sync.*": {
        "queue": "maintenance",
        "routing_key": "maintenance",
    },
    "api.tasks.desktop_client_air_enroll_reconcile.*": {
        "queue": "maintenance",
        "routing_key": "maintenance",
    },
    # Before api.tasks.*stale* — reconcile_stale_* must not land on maintenance.
    "api.tasks.video_call_ringing_watchdog.*": {
        "queue": "short",
        "routing_key": "short",
    },
    "api.tasks.video_call_ringing_reconcile.*": {
        "queue": "short",
        "routing_key": "short",
    },
    "api.tasks.*stale*": {"queue": "maintenance", "routing_key": "maintenance"},
}
celery_app.conf.task_annotations = {
    # E8 / V-M6: keep a global short-queue ceiling, but do not throttle EWA agentic /
    # companion / maintenance hygiene under the same 100/m blanket (fan-out + reapers).
    "*": {
        "rate_limit": "100/m",
    },
    "api.ewa_platform.workers.agentic_task_runner.agentic_loop_tick_task": {
        "rate_limit": None,
    },
    "api.ewa_platform.workers.agentic_step_runner.agentic_step_task": {
        "rate_limit": None,
    },
    "api.ewa_platform.workers.companion_task_runner.companion_run_task": {
        "rate_limit": None,
    },
    "api.tasks.desktop_discussion_batch.discussion_batch_task": {
        "rate_limit": None,
    },
    "api.tasks.ewa_universal_orphan_reaper.run_ewa_universal_orphan_sweep_task": {
        "rate_limit": None,
    },
    "api.tasks.companion_music_stale_run_reaper.reap_stale_companion_music_runs_task": {
        "rate_limit": None,
    },
    "api.tasks.companion_image_stale_run_reaper.reap_stale_companion_image_runs_task": {
        "rate_limit": None,
    },
    "api.tasks.companion_presentation_stale_run_reaper.reap_stale_companion_presentation_runs_task": {
        "rate_limit": None,
    },
    "api.tasks.agentic_lease_reaper.sweep_stale_agentic_leases_task": {
        "rate_limit": None,
    },
    "api.tasks.ugs_stale_request_reaper.run_ugs_stale_request_cleanup_task": {
        "rate_limit": None,
    },
    "api.tasks.video_call_ringing_reconcile.reconcile_stale_ringing_video_calls": {
        "rate_limit": None,
    },
}

# Monitoring
celery_app.conf.worker_send_task_events = True
celery_app.conf.task_send_sent_event = True

# Logging
celery_app.conf.worker_hijack_root_logger = False

# Celery Beat Schedule File (fix permission issues)
# Use /tmp directory which is writable in Docker containers

celery_app.conf.beat_schedule_filename = os.path.join("/tmp", "celerybeat-schedule")

_ugs_stale_reaper_schedule_min = ugs_stale_reaper_interval_minutes()
_music_evolution_stale_reaper_schedule_min = _env_int("MUSIC_EVOLUTION_STALE_REAPER_INTERVAL_MINUTES", 3, maximum=240)
# E1: cross-domain orphan orchestrator interval (seconds).
_ewa_universal_orphan_reaper_interval_sec = _env_int(
    "EWA_UNIVERSAL_ORPHAN_REAPER_INTERVAL_SEC", 180, minimum=60, maximum=3600
)
_companion_turn_dedup_cleanup_schedule_min = _env_int(
    "EWA_COMPANION_TURN_DEDUP_CLEANUP_INTERVAL_MINUTES", 60, maximum=24 * 60
)

_prev_beat = getattr(celery_app.conf, "beat_schedule", None)
celery_app.conf.beat_schedule = {
    **(_prev_beat if isinstance(_prev_beat, dict) else {}),
    "desktop-ai-solo-slot-cleanup": {
        "task": "api.tasks.desktop_ai_solo_slot_cleanup.cleanup_expired_solo_slot_heroes",
        "schedule": timedelta(minutes=5),
    },
    "desktop-discussion-lease-reaper": {
        "task": "api.tasks.desktop_discussion_lease_reaper.reap_stale_discussion_leases_task",
        "schedule": timedelta(minutes=2),
        "kwargs": {"limit": 50},
    },
    "music-batch-stale-running-reaper": {
        "task": "api.tasks.music_batch_stale_running_reaper.reap_stale_music_batch_running_rows_task",
        "schedule": timedelta(minutes=3),
    },
    "companion-music-stale-run-reaper": {
        "task": "api.tasks.companion_music_stale_run_reaper.reap_stale_companion_music_runs_task",
        "schedule": timedelta(minutes=3),
    },
    "companion-presentation-stale-run-reaper": {
        "task": "api.tasks.companion_presentation_stale_run_reaper.reap_stale_companion_presentation_runs_task",
        "schedule": timedelta(minutes=3),
    },
    "companion-image-stale-run-reaper": {
        "task": "api.tasks.companion_image_stale_run_reaper.reap_stale_companion_image_runs_task",
        "schedule": timedelta(minutes=3),
    },
    # E1: cross-domain orphan orchestrator (agentic + media + generic companion).
    # Domain-specific beats remain for independent cadence; orchestrator closes V-H1/V-C3 gaps.
    "ewa-universal-orphan-reaper": {
        "task": "api.tasks.ewa_universal_orphan_reaper.run_ewa_universal_orphan_sweep_task",
        "schedule": timedelta(seconds=_ewa_universal_orphan_reaper_interval_sec),
    },
    "music-evolution-stale-run-reaper": {
        "task": "api.tasks.music_evolution.reap_stale_music_evolution_runs",
        "schedule": timedelta(minutes=_music_evolution_stale_reaper_schedule_min),
    },
    "music-forge-orphan-run-reconcile": {
        "task": "api.tasks.music_forge.reconcile_orphan_runs",
        "schedule": timedelta(minutes=5),
        "kwargs": {"limit": 50},
    },
    "ugs-stale-request-reaper": {
        "task": "api.tasks.ugs_stale_request_reaper.run_ugs_stale_request_cleanup_task",
        "schedule": timedelta(minutes=_ugs_stale_reaper_schedule_min),
    },
    "companion-episodic-reembed-pending": {
        "task": "api.ewa_platform.workers.episodic_reembed_task.run_companion_episodic_pending_reembed",
        "schedule": timedelta(minutes=5),
    },
    "companion-daily-rollup-utc": {
        "task": "api.ewa_platform.workers.daily_rollup_task.run_companion_daily_rollup",
        "schedule": crontab(hour=4, minute=20),
        "kwargs": {},
    },
    "companion-turn-dedup-cleanup": {
        "task": "api.ewa_platform.workers.turn_dedup_cleanup_task.run_companion_turn_dedup_cleanup",
        "schedule": timedelta(minutes=_companion_turn_dedup_cleanup_schedule_min),
    },
    "web-search-events-cleanup": {
        "task": "api.tasks.web_search_events_cleanup.run_web_search_events_cleanup_task",
        "schedule": timedelta(hours=24),
    },
    "video-call-ringing-reconcile": {
        "task": "api.tasks.video_call_ringing_reconcile.reconcile_stale_ringing_video_calls",
        "schedule": timedelta(seconds=15),
        "kwargs": {"limit": 50},
    },
}
if agentic_lease_reaper_enabled():
    celery_app.conf.beat_schedule["agentic-lease-reaper"] = {
        "task": "api.tasks.agentic_lease_reaper.sweep_stale_agentic_leases_task",
        "schedule": timedelta(seconds=agentic_lease_reaper_interval_sec()),
    }
if companion_meta_evolution_beat_enabled():
    celery_app.conf.beat_schedule["companion-meta-evolution-sweep"] = {
        "task": "api.ewa_platform.workers.meta_evolution_sweep_task.run_companion_meta_evolution_sweep",
        "schedule": timedelta(minutes=companion_meta_evolution_beat_interval_minutes()),
        "kwargs": {},
    }

if unified_settings.mobile_private_tunnel_edge_sync_enabled:
    _mobile_wg_edge_reconcile_min = unified_settings.mobile_private_tunnel_edge_reconcile_interval_minutes
    celery_app.conf.beat_schedule["mobile-wg-edge-peer-reconcile"] = {
        "task": "api.tasks.mobile_private_tunnel_edge_sync.sync_mobile_wg_edge_peers",
        "schedule": timedelta(minutes=_mobile_wg_edge_reconcile_min),
        "kwargs": {"trigger": "beat_reconcile"},
    }

if unified_settings.desktop_client_portal_edge_sync_enabled:
    _portal_wg_edge_reconcile_min = unified_settings.desktop_client_portal_edge_reconcile_interval_minutes
    celery_app.conf.beat_schedule["desktop-portal-wg-edge-peer-reconcile"] = {
        "task": "api.tasks.desktop_client_portal_edge_sync.sync_desktop_portal_wg_edge_peers",
        "schedule": timedelta(minutes=_portal_wg_edge_reconcile_min),
        "kwargs": {"trigger": "beat_reconcile"},
    }

if get_air_enroll_settings().enabled:
    _air_enroll_reconcile_sec = get_air_enroll_settings().reconcile_interval_seconds
    celery_app.conf.beat_schedule["desktop-client-air-enroll-reconcile"] = {
        "task": "api.tasks.desktop_client_air_enroll_reconcile.reconcile_desktop_client_air_enroll",
        "schedule": timedelta(seconds=_air_enroll_reconcile_sec),
        "kwargs": {"trigger": "beat_reconcile"},
    }

if unified_content_hard_purge_beat_enabled():
    _unified_content_hard_purge_hours = unified_content_hard_purge_interval_hours()
    celery_app.conf.beat_schedule["unified-content-hard-purge"] = {
        "task": "api.tasks.unified_content_hard_purge.run_unified_content_hard_purge_task",
        "schedule": timedelta(hours=_unified_content_hard_purge_hours),
    }

# Auto-discover tasks
celery_app.autodiscover_tasks(["api.tasks"])

logger.info("Celery application initialized")
logger.info(
    f"   - Broker: {celery_broker_url.split('@')[-1] if '@' in celery_broker_url else celery_broker_url}"
)  # Скрываем пароль в логах
logger.info(f"   - Backend: {celery_backend_url.split('@')[-1] if '@' in celery_backend_url else celery_backend_url}")
logger.info(f"   - Queues: {len(celery_app.conf.task_queues)}")
logger.info(
    "   - UGS stale reaper beat: every %s min (UGS_STALE_REAPER_INTERVAL_MINUTES)",
    _ugs_stale_reaper_schedule_min,
)
logger.info(
    "   - Music Evolution stale reaper beat: every %s min (MUSIC_EVOLUTION_STALE_REAPER_INTERVAL_MINUTES)",
    _music_evolution_stale_reaper_schedule_min,
)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def get_celery_app() -> Celery:
    """
    Получить экземпляр Celery приложения

    Returns:
        Celery app instance
    """
    return celery_app


def get_task_result(task_id: str) -> Any:
    """
    Получить результат задачи по task_id

    Args:
        task_id: ID задачи

    Returns:
        Результат задачи или None
    """
    from celery.result import AsyncResult  # type: ignore[import-not-found]

    result = AsyncResult(task_id, app=celery_app)

    if result.ready():
        return result.get()

    return None


def get_task_status(task_id: str) -> dict[str, Any]:
    """
    Получить статус задачи

    Args:
        task_id: ID задачи

    Returns:
        Словарь со статусом задачи
    """
    from celery.result import AsyncResult  # type: ignore[import-not-found]

    result = AsyncResult(task_id, app=celery_app)

    return {
        "task_id": task_id,
        "status": result.state,  # PENDING, STARTED, SUCCESS, FAILURE, RETRY
        "result": result.result if result.ready() else None,
        "info": result.info if hasattr(result, "info") else None,
        "traceback": result.traceback if result.failed() else None,
    }
