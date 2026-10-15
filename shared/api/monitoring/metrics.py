#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Central Prometheus metric definitions and helper emitters for queue/runtime/AI operations.
# Invariants:
# - Metrics are best-effort and must never raise into business flows.
# - Alarm gauges expose `1` for active and `0` for inactive state.
# Related:
# - api/core/database_manager.py
# - api/services/chat_memory_service.py
# - api/services/rerank_client.py
# ---
from __future__ import annotations

"""Business-level metrics registration and helpers."""

import asyncio
import logging
import os
import time
from collections.abc import Mapping
from contextlib import suppress
from typing import Any

from prometheus_client import Counter, Gauge, Histogram, Summary  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)

try:
    from api.utils.monitoring import monitoring_registry
except Exception:  # noqa: BLE001 - monitoring registry fallback for slim/unit-test envs
    from prometheus_client import CollectorRegistry  # type: ignore[import-not-found]

    monitoring_registry = CollectorRegistry()

# UGS queue metrics ---------------------------------------------------------
ugs_queue_total = Gauge(
    "ugs_queue_total",
    "Total number of generation requests in UGS queues",
    registry=monitoring_registry,
)

ugs_queue_pending = Gauge(
    "ugs_queue_pending",
    "Number of pending generation requests in UGS",
    registry=monitoring_registry,
)

ugs_queue_processing = Gauge(
    "ugs_queue_processing",
    "Number of processing generation requests in UGS",
    registry=monitoring_registry,
)

ugs_queue_by_priority = Gauge(
    "ugs_queue_by_priority",
    "UGS queue length grouped by priority",
    labelnames=("priority",),
    registry=monitoring_registry,
)

ugs_queue_by_type = Gauge(
    "ugs_queue_by_type",
    "UGS queue length grouped by queue name",
    labelnames=("queue_name",),
    registry=monitoring_registry,
)

ugs_queue_pending_oldest_age_seconds = Gauge(
    "ugs_queue_pending_oldest_age_seconds",
    "Approximate age in seconds of the oldest pending UGS row (generation_queue.created_at vs now)",
    registry=monitoring_registry,
)

rabbitmq_queue_messages_ready = Gauge(
    "rabbitmq_queue_messages_ready",
    "Messages ready per RabbitMQ queue (Management HTTP API)",
    labelnames=("queue",),
    registry=monitoring_registry,
)
rabbitmq_queue_messages_unacked = Gauge(
    "rabbitmq_queue_messages_unacked",
    "Messages unacknowledged per RabbitMQ queue (Management HTTP API)",
    labelnames=("queue",),
    registry=monitoring_registry,
)

# Runtime / retry observability ------------------------------------------------
event_loop_lag_seconds = Gauge(
    "event_loop_lag_seconds",
    "Event-loop scheduling lag (actual wake-up minus planned sleep interval)",
    registry=monitoring_registry,
)

embedding_request_duration_seconds = Summary(
    "embedding_request_duration_seconds",
    "Embedding HTTP request latency",
    labelnames=("operation", "status"),
    registry=monitoring_registry,
)

embedding_retry_outcomes_total = Counter(
    "embedding_retry_outcomes_total",
    "Embedding retry outcomes",
    labelnames=("operation", "outcome"),
    registry=monitoring_registry,
)

rerank_request_duration_seconds = Summary(
    "rerank_request_duration_seconds",
    "Rerank HTTP latency",
    labelnames=("status",),
    registry=monitoring_registry,
)

rerank_retry_outcomes_total = Counter(
    "rerank_retry_outcomes_total",
    "Rerank retry outcomes",
    labelnames=("outcome",),
    registry=monitoring_registry,
)

desktop_stream_coordination_degraded_total = Counter(
    "desktop_stream_coordination_degraded_total",
    "Desktop AI Chat stream lock/idempotency degraded events",
    labelnames=("mode", "reason", "operation"),
    registry=monitoring_registry,
)

desktop_ai_chat_stream_total = Counter(
    "desktop_ai_chat_stream_total",
    "Desktop AI Chat stream completions",
    labelnames=("outcome",),
    registry=monitoring_registry,
)

desktop_ai_chat_rag_empty_total = Counter(
    "desktop_ai_chat_rag_empty_total",
    "Desktop AI Chat turns with zero RAG/memory hits",
    labelnames=("layer", "profile"),
    registry=monitoring_registry,
)

desktop_ai_chat_stream_duration_seconds = Summary(
    "desktop_ai_chat_stream_duration_seconds",
    "Desktop AI Chat stream duration",
    labelnames=("outcome",),
    registry=monitoring_registry,
)

# Desktop shell_state SLI (Wave C) --------------------------------------------
desktop_shell_state_patch_total = Counter(
    "desktop_shell_state_patch_total",
    "Desktop shell_state PATCH outcomes",
    labelnames=("result",),
    registry=monitoring_registry,
)

desktop_shell_state_patch_latency_seconds = Histogram(
    "desktop_shell_state_patch_latency_seconds",
    "Desktop shell_state PATCH latency in seconds",
    labelnames=("result",),
    registry=monitoring_registry,
)

desktop_shell_state_get_304_total = Counter(
    "desktop_shell_state_get_304_total",
    "Desktop shell_state GET responses that returned 304 Not Modified",
    registry=monitoring_registry,
)

# Unified Admin shell nav SLI (section opens) ---------------------------------
admin_shell_section_select_total = Counter(
    "admin_shell_section_select_total",
    "Unified Admin shell section select events",
    labelnames=("section", "embedded"),
    registry=monitoring_registry,
)

queue_duplicate_suppression_total = Counter(
    "queue_duplicate_suppression_total",
    "Queue duplicate suppression events",
    labelnames=("source", "outcome"),
    registry=monitoring_registry,
)

# EWA agentic reliability (Gate G6) --------------------------------------------
ewa_agentic_orphan_sessions = Gauge(
    "ewa_agentic_orphan_sessions",
    "Active agentic sessions with no lease older than the orphan stale window",
    registry=monitoring_registry,
)

ewa_agentic_mirror_sync_fail_total = Counter(
    "ewa_agentic_mirror_sync_fail_total",
    "Agentic Operations mirror sync failures (safe_sync best-effort path)",
    registry=monitoring_registry,
)

ewa_agentic_celery_nonretryable_total = Counter(
    "ewa_agentic_celery_nonretryable_total",
    "Agentic sessions terminalized due to non-retryable Celery/DB faults",
    labelnames=("error_class",),
    registry=monitoring_registry,
)

ewa_agentic_orphan_sweep_total = Counter(
    "ewa_agentic_orphan_sweep_total",
    "Orphan agentic sessions processed by the G2 sweeper",
    labelnames=("outcome",),
    registry=monitoring_registry,
)

# EWA operations observability (Gate E6) ---------------------------------------
EWA_CELERY_BEAT_LAST_SUCCESS_KEY = "ewa:ops:celery_beat:last_success_unix"
EWA_CELERY_BEAT_LAST_TASK_KEY = "ewa:ops:celery_beat:last_task"
EWA_REAPER_LAST_REAPED_KEY = "ewa:ops:reaper:last_reaped"
EWA_REAPER_LAST_SUCCESS_KEY = "ewa:ops:reaper:last_success_unix"

_EWA_REAPER_DOMAINS: tuple[str, ...] = (
    "music",
    "image",
    "presentation",
    "generic",
    "agentic_orphans_swept",
)
_EWA_JOB_ENQUEUE_OUTCOMES = frozenset({"enqueued", "skipped", "failed"})
_EWA_JOB_EXECUTE_OUTCOMES = frozenset({"ok", "skipped", "failed"})

ewa_celery_beat_last_success_timestamp_seconds = Gauge(
    "ewa_celery_beat_last_success_timestamp_seconds",
    "Unix timestamp of the last successful EWA Celery beat/maintenance heartbeat",
    registry=monitoring_registry,
)

ewa_companion_reaper_last_reaped = Gauge(
    "ewa_companion_reaper_last_reaped",
    "Rows reaped by the last EWA universal companion/media reaper sweep",
    labelnames=("domain",),
    registry=monitoring_registry,
)

ewa_companion_reaper_last_success_timestamp_seconds = Gauge(
    "ewa_companion_reaper_last_success_timestamp_seconds",
    "Unix timestamp of the last successful EWA universal companion/media reaper sweep",
    registry=monitoring_registry,
)

ewa_companion_reaper_runs_total = Counter(
    "ewa_companion_reaper_runs_total",
    "EWA universal companion/media reaper sweep outcomes by domain",
    labelnames=("domain", "outcome"),
    registry=monitoring_registry,
)

unified_content_hard_purge_runs_total = Counter(
    "unified_content_hard_purge_runs_total",
    "Scheduled unified_content soft-delete hard-purge beat outcomes",
    labelnames=("outcome",),
    registry=monitoring_registry,
)

unified_content_hard_purge_last_purged = Gauge(
    "unified_content_hard_purge_last_purged",
    "Rows hard-purged in the last successful beat run",
    registry=monitoring_registry,
)

content_storage_integrity_events_total = Counter(
    "content_storage_integrity_events_total",
    "Unified content storage integrity events (quarantine/recheck/permanent_delete/owner_scan)",
    labelnames=("event", "outcome"),
    registry=monitoring_registry,
)

ewa_companion_job_enqueue_total = Counter(
    "ewa_companion_job_enqueue_total",
    "Durable EWA companion job enqueue outcomes",
    labelnames=("outcome",),
    registry=monitoring_registry,
)

ewa_companion_job_execute_total = Counter(
    "ewa_companion_job_execute_total",
    "Durable EWA companion job execution outcomes",
    labelnames=("outcome", "reason"),
    registry=monitoring_registry,
)

site_studio_lifecycle_jobs_total = Counter(
    "site_studio_lifecycle_jobs_total",
    "Site Studio lifecycle job terminal outcomes",
    labelnames=("task_type", "status"),
    registry=monitoring_registry,
)

site_studio_lifecycle_duration_seconds = Summary(
    "site_studio_lifecycle_duration_seconds",
    "Site Studio lifecycle task duration",
    labelnames=("task_type", "status"),
    registry=monitoring_registry,
)

site_studio_worker_ready = Gauge(
    "site_studio_worker_ready",
    "Whether a Site Studio worker heartbeat is fresh enough for lifecycle actions",
    registry=monitoring_registry,
)

site_studio_queue_publish_failures_total = Counter(
    "site_studio_queue_publish_failures_total",
    "Site Studio lifecycle queue publish failures",
    labelnames=("task_type",),
    registry=monitoring_registry,
)

ops_alarm_state = Gauge(
    "ops_alarm_state",
    "Operational alarm state (1 active, 0 inactive)",
    labelnames=("alarm",),
    registry=monitoring_registry,
)

_SUSTAINED_ALARM_SECONDS = max(60, int((os.getenv("UGS_QUEUE_ALARM_SUSTAIN_SECONDS") or "300").strip() or "300"))
_QUEUE_DEPTH_ALARM_THRESHOLD = max(1, int((os.getenv("UGS_QUEUE_DEPTH_ALARM_THRESHOLD") or "200").strip() or "200"))
_QUEUE_AGE_ALARM_THRESHOLD_SEC = max(
    60,
    int((os.getenv("UGS_QUEUE_AGE_ALARM_THRESHOLD_SEC") or "1800").strip() or "1800"),
)
_alarm_breach_since: dict[str, float] = {}


# UGS generation metrics ----------------------------------------------------
ugs_generation_duration_seconds = Summary(
    "ugs_generation_duration_seconds",
    "Generation latency by provider and generation type",
    labelnames=("provider", "generation_type", "status"),
    registry=monitoring_registry,
)

ugs_generation_failures_total = Counter(
    "ugs_generation_failures_total",
    "Total provider failures in UGS",
    labelnames=("provider", "generation_type"),
    registry=monitoring_registry,
)

# MusicForge pipeline counters (mirror Redis music_forge:metric:v1:* names) ---
music_forge_metric_total = Counter(
    "music_forge_metric_total",
    "MusicForge pipeline events (dual-write with Redis music_forge:metric:v1)",
    labelnames=("name", "step"),
    registry=monitoring_registry,
)


# GPU metrics ----------------------------------------------------------------
gpu_usage_percent = Gauge(
    "gpu_usage_percent",
    "Current GPU utilization percentage",
    registry=monitoring_registry,
)

gpu_memory_used_mb = Gauge(
    "gpu_memory_used_mb",
    "GPU memory used in megabytes",
    registry=monitoring_registry,
)

gpu_memory_total_mb = Gauge(
    "gpu_memory_total_mb",
    "Total GPU memory in megabytes",
    registry=monitoring_registry,
)

gpu_temperature_celsius = Gauge(
    "gpu_temperature_celsius",
    "GPU temperature in Celsius",
    registry=monitoring_registry,
)

gpu_power_watts = Gauge(
    "gpu_power_watts",
    "GPU power usage in watts",
    registry=monitoring_registry,
)

gpu_encoder_usage_percent = Gauge(
    "gpu_encoder_usage_percent",
    "GPU encoder utilization percentage",
    registry=monitoring_registry,
)

gpu_decoder_usage_percent = Gauge(
    "gpu_decoder_usage_percent",
    "GPU decoder utilization percentage",
    registry=monitoring_registry,
)


# AI service (ComfyUI / Llama / etc.) metrics --------------------------------
AI_SERVICE_LABELS: tuple[str, ...] = ("llama", "comfyui")

ai_service_cpu_percent = Gauge(
    "ai_service_cpu_percent",
    "CPU utilization percent per AI service container",
    labelnames=("service",),
    registry=monitoring_registry,
)

ai_service_memory_mb = Gauge(
    "ai_service_memory_mb",
    "Memory usage in MB per AI service container",
    labelnames=("service",),
    registry=monitoring_registry,
)

ai_service_network_rx_bps = Gauge(
    "ai_service_network_rx_bps",
    "Inbound network throughput (bytes/sec) per AI service",
    labelnames=("service",),
    registry=monitoring_registry,
)

ai_service_network_tx_bps = Gauge(
    "ai_service_network_tx_bps",
    "Outbound network throughput (bytes/sec) per AI service",
    labelnames=("service",),
    registry=monitoring_registry,
)


# Document processing metrics -----------------------------------------------
document_processing_in_progress = Gauge(
    "document_processing_in_progress",
    "Number of documents being processed",
    registry=monitoring_registry,
)

document_processing_duration_seconds = Summary(
    "document_processing_duration_seconds",
    "Document processing duration by pipeline",
    labelnames=("pipeline", "status"),
    registry=monitoring_registry,
)


# Helper functions ----------------------------------------------------------
def update_ugs_queue_metrics(
    *,
    total: int,
    pending: int,
    processing: int | None = None,
    per_priority: dict[int, int] | None = None,
    per_queue: dict[str, int] | None = None,
    pending_oldest_age_seconds: float | None = None,
) -> None:
    """Push queue statistics into Prometheus gauges."""

    ugs_queue_total.set(total)
    ugs_queue_pending.set(pending)
    if processing is not None:
        ugs_queue_processing.set(processing)
    if pending_oldest_age_seconds is not None:
        ugs_queue_pending_oldest_age_seconds.set(max(0.0, float(pending_oldest_age_seconds)))

    if per_priority is not None:
        # Normalize priorities 1..10 to avoid stale values
        for priority in range(1, 11):
            value = per_priority.get(priority, 0)
            ugs_queue_by_priority.labels(priority=str(priority)).set(value)

    if per_queue is not None:
        for queue_name, value in per_queue.items():
            ugs_queue_by_type.labels(queue_name=queue_name).set(value)


def observe_ugs_generation(
    *,
    provider: str,
    generation_type: str,
    duration_seconds: float,
    status: str,
    failed: bool = False,
) -> None:
    """Record generation latency and optional failure counter."""

    ugs_generation_duration_seconds.labels(
        provider=provider,
        generation_type=generation_type,
        status=status,
    ).observe(duration_seconds)

    if failed:
        ugs_generation_failures_total.labels(
            provider=provider,
            generation_type=generation_type,
        ).inc()


def observe_event_loop_lag(*, lag_seconds: float) -> None:
    event_loop_lag_seconds.set(max(0.0, float(lag_seconds)))


def observe_embedding_request(*, operation: str, duration_seconds: float, status: str) -> None:
    embedding_request_duration_seconds.labels(operation=operation, status=status).observe(
        max(0.0, float(duration_seconds))
    )


def observe_embedding_retry(*, operation: str, outcome: str) -> None:
    embedding_retry_outcomes_total.labels(operation=operation, outcome=outcome).inc()


def observe_rerank_request(*, duration_seconds: float, status: str) -> None:
    rerank_request_duration_seconds.labels(status=status).observe(max(0.0, float(duration_seconds)))


def observe_rerank_retry(*, outcome: str) -> None:
    rerank_retry_outcomes_total.labels(outcome=outcome).inc()


def observe_desktop_stream_coordination(*, event: str, mode: str, reason: str, operation: str) -> None:
    with suppress(Exception):
        if event == "degraded":
            desktop_stream_coordination_degraded_total.labels(
                mode=mode or "unknown",
                reason=reason or "unknown",
                operation=operation or "unknown",
            ).inc()


def observe_desktop_ai_chat_stream(*, outcome: str, duration_ms: int | None = None) -> None:
    with suppress(Exception):
        desktop_ai_chat_stream_total.labels(outcome=outcome).inc()
        if duration_ms is not None:
            desktop_ai_chat_stream_duration_seconds.labels(outcome=outcome).observe(
                max(0.0, float(duration_ms) / 1000.0)
            )


def observe_desktop_ai_chat_rag_empty(*, layer: str, profile: str) -> None:
    with suppress(Exception):
        desktop_ai_chat_rag_empty_total.labels(layer=layer, profile=profile or "unknown").inc()


def observe_desktop_shell_state_patch(*, result: str, duration_seconds: float | None = None) -> None:
    """Best-effort shell_state PATCH SLI.

    ``result``: ok | conflict_412 | error | idempotent_replay | redis_unavailable | in_progress_409
    """
    with suppress(Exception):
        allowed = {
            "ok",
            "conflict_412",
            "error",
            "idempotent_replay",
            "redis_unavailable",
            "in_progress_409",
        }
        label = result if result in allowed else "error"
        desktop_shell_state_patch_total.labels(result=label).inc()
        if duration_seconds is not None:
            desktop_shell_state_patch_latency_seconds.labels(result=label).observe(max(0.0, float(duration_seconds)))


def observe_desktop_shell_state_get_304() -> None:
    """Best-effort counter for shell_state GET 304 (If-None-Match hit)."""
    with suppress(Exception):
        desktop_shell_state_get_304_total.inc()


def observe_admin_shell_section_select(*, section: str, embedded: bool) -> None:
    """Best-effort Unified Admin section-open counter. Labels are bounded section ids."""
    with suppress(Exception):
        sec = (section or "").strip()[:64] or "unknown"
        admin_shell_section_select_total.labels(
            section=sec,
            embedded="true" if embedded else "false",
        ).inc()


def observe_music_forge_metric(name: str, **labels: Any) -> None:
    """Best-effort Prometheus mirror of Redis MusicForge counters."""
    with suppress(Exception):
        metric_name = (name or "").strip()[:64] or "unknown"
        step_raw = labels.get("step")
        step = str(step_raw).strip()[:64] if step_raw is not None else ""
        music_forge_metric_total.labels(name=metric_name, step=step or "").inc()


def observe_queue_duplicate_suppression(*, source: str, outcome: str) -> None:
    queue_duplicate_suppression_total.labels(source=source, outcome=outcome).inc()


def set_ewa_agentic_orphan_sessions(*, count: int) -> None:
    """Publish current orphan candidate count and sustain ops_alarm_state."""

    with suppress(Exception):
        n = max(0, int(count))
        ewa_agentic_orphan_sessions.set(float(n))
        _update_sustained_alarm(
            alarm="agentic_orphan_sessions",
            breached=n >= 1,
            now_mono=time.monotonic(),
        )


def observe_ewa_agentic_mirror_sync_fail() -> None:
    with suppress(Exception):
        ewa_agentic_mirror_sync_fail_total.inc()


def observe_ewa_agentic_celery_nonretryable(*, error_class: str) -> None:
    with suppress(Exception):
        label = (error_class or "unknown").strip()[:80] or "unknown"
        ewa_agentic_celery_nonretryable_total.labels(error_class=label).inc()


def observe_ewa_agentic_orphan_sweep(*, outcome: str) -> None:
    with suppress(Exception):
        ewa_agentic_orphan_sweep_total.labels(outcome=(outcome or "unknown")[:40]).inc()


def _normalize_ewa_ops_outcome(
    raw: str,
    *,
    allowed: frozenset[str],
    fallback: str,
) -> str:
    value = str(raw or "").strip().lower()
    return value if value in allowed else fallback


def _normalize_metric_reason(reason: str | None) -> str:
    return (str(reason or "none").strip().lower().replace(" ", "_") or "none")[:40]


def _to_float_or_none(value: Any) -> float | None:  # noqa: ANN401 - Redis returns driver-dependent scalar types
    if value is None:
        return None
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="ignore")
    try:
        return float(value)
    except TypeError, ValueError:
        return None


def _to_int(value: Any) -> int:  # noqa: ANN401 - Redis returns driver-dependent scalar types
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="ignore")
    try:
        return max(0, int(value))
    except TypeError, ValueError:
        return 0


def _env_flag(name: str, *, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _ewa_celery_beat_stale_seconds() -> int:
    from api.ewa_platform.settings.access import ewa_getenv_int

    return max(60, ewa_getenv_int("EWA_CELERY_BEAT_STALE_SECONDS", default=600))


async def _get_ewa_ops_redis_client() -> Any:  # type: ignore[type-arg] # noqa: ANN401
    from api.core.database_manager import get_redis_client

    return await get_redis_client()


async def _redis_call(redis: Any, method_name: str, *args: Any, **kwargs: Any) -> Any:  # noqa: ANN401
    method = getattr(redis, method_name)
    result = method(*args, **kwargs)
    if hasattr(result, "__await__"):
        return await result
    return result


async def _record_ewa_celery_beat_success_redis(*, task: str, timestamp: float) -> None:
    redis = await _get_ewa_ops_redis_client()
    await _redis_call(redis, "set", EWA_CELERY_BEAT_LAST_SUCCESS_KEY, str(timestamp))
    if task:
        await _redis_call(redis, "set", EWA_CELERY_BEAT_LAST_TASK_KEY, task[:120])


async def _record_ewa_universal_reaper_sweep_redis(*, counts: Mapping[str, int], timestamp: float) -> None:
    redis = await _get_ewa_ops_redis_client()
    payload = {domain: str(max(0, int(counts.get(domain, 0) or 0))) for domain in _EWA_REAPER_DOMAINS}
    await _redis_call(redis, "hset", EWA_REAPER_LAST_REAPED_KEY, mapping=payload)
    await _redis_call(redis, "set", EWA_REAPER_LAST_SUCCESS_KEY, str(timestamp))


def _run_ewa_ops_redis_coro(coro_factory: Any) -> None:  # noqa: ANN401 - keeps helpers sync for Celery/API callers
    try:
        running_loop = asyncio.get_running_loop()
    except RuntimeError:
        running_loop = None

    if running_loop is not None and running_loop.is_running():
        with suppress(Exception):
            running_loop.create_task(coro_factory())
        return

    with suppress(Exception):
        from api.core import celery_async

        worker_loop = getattr(celery_async, "_worker_loop", None)
        if worker_loop is not None and not worker_loop.is_closed():
            celery_async.run_celery_async(coro_factory())
            return

    with suppress(Exception):
        asyncio.run(coro_factory())


def record_ewa_celery_beat_success(*, task: str) -> None:
    """Persist a durable beat heartbeat and mirror it into the local Prometheus gauge."""

    with suppress(Exception):
        timestamp = time.time()
        label = str(task or "celery_beat_task").strip() or "celery_beat_task"
        ewa_celery_beat_last_success_timestamp_seconds.set(timestamp)
        set_ops_alarm_state(alarm="ewa_celery_beat_stale", active=False)
        _run_ewa_ops_redis_coro(lambda: _record_ewa_celery_beat_success_redis(task=label, timestamp=timestamp))


def record_ewa_universal_reaper_sweep(*, counts: Mapping[str, int], ok: bool) -> None:
    """Persist the last EWA reaper sweep and update local counters/gauges."""

    with suppress(Exception):
        normalized = {domain: max(0, int(counts.get(domain, 0) or 0)) for domain in _EWA_REAPER_DOMAINS}
        outcome = "ok" if ok else "error"
        for domain, value in normalized.items():
            ewa_companion_reaper_runs_total.labels(domain=domain, outcome=outcome).inc()
            ewa_companion_reaper_last_reaped.labels(domain=domain).set(float(value))
        if ok:
            timestamp = time.time()
            ewa_companion_reaper_last_success_timestamp_seconds.set(timestamp)
            _run_ewa_ops_redis_coro(
                lambda: _record_ewa_universal_reaper_sweep_redis(counts=normalized, timestamp=timestamp)
            )


def record_unified_content_hard_purge_run(*, stats: Mapping[str, Any], ok: bool) -> None:
    """Mirror last scheduled hard-purge stats into Prometheus (best-effort)."""

    with suppress(Exception):
        outcome = "ok" if ok else "error"
        unified_content_hard_purge_runs_total.labels(outcome=outcome).inc()
        if ok:
            unified_content_hard_purge_last_purged.set(float(int(stats.get("purged") or 0)))


def observe_content_storage_integrity(*, event: str, outcome: str) -> None:
    """Best-effort counter for broken-files quarantine / recheck / purge / scan."""

    with suppress(Exception):
        content_storage_integrity_events_total.labels(
            event=str(event or "unknown")[:64],
            outcome=str(outcome or "unknown")[:32],
        ).inc()


def observe_ewa_companion_job_enqueue(*, outcome: str) -> None:
    with suppress(Exception):
        normalized = _normalize_ewa_ops_outcome(
            outcome,
            allowed=_EWA_JOB_ENQUEUE_OUTCOMES,
            fallback="failed",
        )
        ewa_companion_job_enqueue_total.labels(outcome=normalized).inc()


def observe_ewa_companion_job_execute(*, outcome: str, reason: str | None = None) -> None:
    with suppress(Exception):
        normalized = _normalize_ewa_ops_outcome(
            outcome,
            allowed=_EWA_JOB_EXECUTE_OUTCOMES,
            fallback="failed",
        )
        ewa_companion_job_execute_total.labels(outcome=normalized, reason=_normalize_metric_reason(reason)).inc()


def observe_ewa_companion_job_execute_result(result: Mapping[str, Any] | None) -> None:
    with suppress(Exception):
        payload = dict(result or {})
        reason = str(payload.get("reason") or payload.get("status") or "none")
        if payload.get("skipped") is True:
            observe_ewa_companion_job_execute(outcome="skipped", reason=reason)
        elif bool(payload.get("ok")):
            observe_ewa_companion_job_execute(outcome="ok", reason=reason)
        else:
            observe_ewa_companion_job_execute(outcome="failed", reason=reason)


async def refresh_ewa_ops_observability_from_redis_async() -> None:
    """Refresh API-process gauges/alarms from durable Redis state."""

    with suppress(Exception):
        redis = await _get_ewa_ops_redis_client()
        last_beat_raw = await _redis_call(redis, "get", EWA_CELERY_BEAT_LAST_SUCCESS_KEY)
        last_beat = _to_float_or_none(last_beat_raw)
        if last_beat is None:
            beat_stale = _env_flag("EWA_CELERY_BEAT_STALE_REQUIRE_HEARTBEAT", default=False)
        else:
            ewa_celery_beat_last_success_timestamp_seconds.set(last_beat)
            beat_stale = (time.time() - last_beat) > _ewa_celery_beat_stale_seconds()
        set_ops_alarm_state(alarm="ewa_celery_beat_stale", active=beat_stale)

        last_reaper_raw = await _redis_call(redis, "get", EWA_REAPER_LAST_SUCCESS_KEY)
        last_reaper = _to_float_or_none(last_reaper_raw)
        if last_reaper is not None:
            ewa_companion_reaper_last_success_timestamp_seconds.set(last_reaper)

        raw_reaped = await _redis_call(redis, "hgetall", EWA_REAPER_LAST_REAPED_KEY)
        reaped = raw_reaped if isinstance(raw_reaped, Mapping) else {}
        counts: dict[str, int] = {}
        for domain in _EWA_REAPER_DOMAINS:
            value = _to_int(reaped.get(domain) or reaped.get(domain.encode("utf-8")))
            counts[domain] = value
            ewa_companion_reaper_last_reaped.labels(domain=domain).set(float(value))

        now_mono = time.monotonic()
        _update_sustained_alarm(
            alarm="ewa_companion_generic_orphans_sustained",
            breached=counts.get("generic", 0) >= 1,
            now_mono=now_mono,
        )
        media_orphans = counts.get("music", 0) + counts.get("image", 0) + counts.get("presentation", 0)
        _update_sustained_alarm(
            alarm="ewa_media_orphans_sustained",
            breached=media_orphans >= 1,
            now_mono=now_mono,
        )


def is_ops_alarm_active(*, alarm: str) -> bool:
    """Return True when the named ``ops_alarm_state`` gauge is currently active (1.0)."""

    try:
        return float(ops_alarm_state.labels(alarm=str(alarm or "").strip())._value.get()) >= 1.0
    except Exception:  # noqa: BLE001 — health callers must never raise on gauge read
        return False


async def build_celery_beat_health_slice() -> dict[str, Any]:
    """Truthful Celery beat readiness for ``/api/health`` (Trust T5 / V-H2).

    Does not invent HA: single beat remains SPOF. Surfaces stale/missing heartbeat
    so operators are not deceived by a green liveness-only health payload.
    """

    await refresh_ewa_ops_observability_from_redis_async()
    last_success = _to_float_or_none(ewa_celery_beat_last_success_timestamp_seconds._value.get())
    stale_threshold = _ewa_celery_beat_stale_seconds()
    require_heartbeat = _env_flag("EWA_CELERY_BEAT_STALE_REQUIRE_HEARTBEAT", default=False)
    stale = is_ops_alarm_active(alarm="ewa_celery_beat_stale")
    age_seconds: float | None = None
    if last_success is not None and last_success > 0:
        age_seconds = max(0.0, time.time() - float(last_success))

    if last_success is None or last_success <= 0:
        status = "unknown" if not require_heartbeat else "stale"
        if require_heartbeat:
            stale = True
    elif stale or (age_seconds is not None and age_seconds > stale_threshold):
        status = "stale"
        stale = True
    else:
        status = "ok"

    return {
        "status": status,
        "stale": bool(stale),
        "last_success_unix": last_success if last_success and last_success > 0 else None,
        "age_seconds": age_seconds,
        "stale_threshold_seconds": stale_threshold,
        "require_heartbeat": require_heartbeat,
        "spof": True,
        "note": "Single Celery beat process; stale means reapers/schedulers may be stopped.",
    }


def refresh_ewa_ops_observability_from_redis() -> None:
    """Sync-facing best-effort Redis refresh for Prometheus scrape call sites."""

    _run_ewa_ops_redis_coro(refresh_ewa_ops_observability_from_redis_async)


def observe_site_studio_lifecycle_job(*, task_type: str, status: str, duration_ms: int | None = None) -> None:
    try:
        site_studio_lifecycle_jobs_total.labels(task_type=task_type, status=status).inc()
        if duration_ms is not None:
            site_studio_lifecycle_duration_seconds.labels(task_type=task_type, status=status).observe(
                max(0.0, duration_ms / 1000)
            )
    except Exception as exc:  # noqa: BLE001 — metrics are best-effort and must not raise
        logger.debug(
            "site_studio lifecycle metric skipped task_type=%s status=%s err=%s",
            task_type,
            status,
            exc,
            exc_info=True,
        )


def set_site_studio_worker_ready(*, ready: bool) -> None:
    with suppress(Exception):
        site_studio_worker_ready.set(1.0 if ready else 0.0)


def record_site_studio_queue_publish_failure(*, task_type: str) -> None:
    with suppress(Exception):
        site_studio_queue_publish_failures_total.labels(task_type=task_type).inc()


def set_ops_alarm_state(*, alarm: str, active: bool) -> None:
    ops_alarm_state.labels(alarm=alarm).set(1.0 if active else 0.0)


def _update_sustained_alarm(*, alarm: str, breached: bool, now_mono: float) -> bool:
    if not breached:
        _alarm_breach_since.pop(alarm, None)
        set_ops_alarm_state(alarm=alarm, active=False)
        return False
    since = _alarm_breach_since.get(alarm)
    if since is None:
        _alarm_breach_since[alarm] = now_mono
        set_ops_alarm_state(alarm=alarm, active=False)
        return False
    active = (now_mono - since) >= _SUSTAINED_ALARM_SECONDS
    set_ops_alarm_state(alarm=alarm, active=active)
    return active


def update_ugs_queue_alarm_states(*, total_queued: int, pending_oldest_age_seconds: float | None) -> dict[str, bool]:
    """Update sustained queue alarms from latest queue stats snapshot."""
    now_mono = time.monotonic()
    depth_breached = int(total_queued) >= _QUEUE_DEPTH_ALARM_THRESHOLD
    age_breached = (
        pending_oldest_age_seconds is not None and float(pending_oldest_age_seconds) >= _QUEUE_AGE_ALARM_THRESHOLD_SEC
    )
    depth_active = _update_sustained_alarm(alarm="queue_depth_sustained", breached=depth_breached, now_mono=now_mono)
    age_active = _update_sustained_alarm(alarm="queue_age_sustained", breached=age_breached, now_mono=now_mono)
    return {
        "queue_depth_sustained": depth_active,
        "queue_age_sustained": age_active,
    }


def update_beat_workers_off_alarm(
    *,
    beat_enabled: bool,
    active_worker_leases: int | None,
    backlog_total: int,
) -> bool:
    """
    Alarm semantics: scheduler/beat appears enabled but no active workers while backlog grows.
    """
    leases = 0 if active_worker_leases is None else max(0, int(active_worker_leases))
    active = bool(beat_enabled and int(backlog_total) > 0 and leases == 0)
    set_ops_alarm_state(alarm="beat_on_workers_off", active=active)
    return active


def observe_document_processing(
    *,
    pipeline: str,
    duration_seconds: float,
    status: str,
) -> None:
    """Record document processing statistics for Prometheus."""

    document_processing_duration_seconds.labels(
        pipeline=pipeline,
        status=status,
    ).observe(duration_seconds)


def set_document_processing_in_progress(count: int) -> None:
    document_processing_in_progress.set(count)


def update_gpu_metrics(metric_data: dict[str, Any] | None) -> None:
    """Update GPU-related gauges from Prometheus data."""

    if not metric_data:
        gpu_usage_percent.set(0.0)
        gpu_memory_used_mb.set(0.0)
        gpu_memory_total_mb.set(0.0)
        gpu_temperature_celsius.set(0.0)
        gpu_power_watts.set(0.0)
        gpu_encoder_usage_percent.set(0.0)
        gpu_decoder_usage_percent.set(0.0)
        return

    gpu_usage_percent.set(metric_data.get("usage_percent", 0.0))

    memory_info = metric_data.get("memory", {})
    gpu_memory_used_mb.set(memory_info.get("used_mb", 0.0))
    gpu_memory_total_mb.set(memory_info.get("total_mb", 0.0))

    gpu_temperature_celsius.set(metric_data.get("temperature_c", 0.0))
    gpu_power_watts.set(metric_data.get("power_watts", 0.0))

    utilization = metric_data.get("utilization", {})
    gpu_encoder_usage_percent.set(utilization.get("encoder_percent", 0.0))
    gpu_decoder_usage_percent.set(utilization.get("decoder_percent", 0.0))


def update_ai_service_metrics(metrics: dict[str, dict[str, Any]] | None) -> None:
    """Update AI service gauges (ComfyUI, Llama, etc.)."""

    data = metrics or {}

    for service_name in AI_SERVICE_LABELS:
        values = data.get(service_name, {})

        cpu_percent = values.get("cpu_percent", 0.0)
        ai_service_cpu_percent.labels(service=service_name).set(cpu_percent)

        memory_mb = values.get("memory_mb", 0.0)
        ai_service_memory_mb.labels(service=service_name).set(memory_mb)

        network_rx = values.get("network_rx_bps", 0.0)
        ai_service_network_rx_bps.labels(service=service_name).set(network_rx)

        network_tx = values.get("network_tx_bps", 0.0)
        ai_service_network_tx_bps.labels(service=service_name).set(network_tx)


# Presentation metrics --------------------------------------------------------
presentation_generations_total = Counter(
    "presentation_generations_total",
    "Total number of presentation generation requests",
    labelnames=("status", "ai_model", "theme"),
    registry=monitoring_registry,
)

presentation_generation_duration_seconds = Summary(
    "presentation_generation_duration_seconds",
    "Presentation generation duration in seconds",
    labelnames=("status", "ai_model", "num_slides"),
    registry=monitoring_registry,
)

presentation_slides_generated_total = Counter(
    "presentation_slides_generated_total",
    "Total number of slides generated",
    labelnames=("status",),
    registry=monitoring_registry,
)

presentation_images_generated_total = Counter(
    "presentation_images_generated_total",
    "Total number of images generated for presentations",
    labelnames=("status",),
    registry=monitoring_registry,
)

presentation_generation_errors_total = Counter(
    "presentation_generation_errors_total",
    "Total number of presentation generation errors",
    labelnames=("error_type", "step"),
    registry=monitoring_registry,
)

presentation_generations_in_progress = Gauge(
    "presentation_generations_in_progress",
    "Number of presentations currently being generated",
    registry=monitoring_registry,
)

presentation_exports_total = Counter(
    "presentation_exports_total",
    "Total number of presentation exports",
    labelnames=("format", "status"),
    registry=monitoring_registry,
)

presentation_websocket_connections = Gauge(
    "presentation_websocket_connections",
    "Number of active WebSocket connections for collaboration",
    registry=monitoring_registry,
)


# Helper functions for presentation metrics -----------------------------------
def observe_presentation_generation(
    *,
    status: str,
    ai_model: str,
    theme: str,
    num_slides: int,
    duration_seconds: float,
    slides_generated: int = 0,
    images_generated: int = 0,
    error_type: str | None = None,
    step: str | None = None,
) -> None:
    """Record presentation generation metrics."""
    presentation_generations_total.labels(
        status=status,
        ai_model=ai_model,
        theme=theme,
    ).inc()

    presentation_generation_duration_seconds.labels(
        status=status,
        ai_model=ai_model,
        num_slides=str(num_slides),
    ).observe(duration_seconds)

    if slides_generated > 0:
        presentation_slides_generated_total.labels(status=status).inc(slides_generated)

    if images_generated > 0:
        presentation_images_generated_total.labels(status=status).inc(images_generated)

    if error_type and step:
        presentation_generation_errors_total.labels(
            error_type=error_type,
            step=step,
        ).inc()


def set_presentation_generations_in_progress(count: int) -> None:
    """Update the number of presentations currently being generated."""
    presentation_generations_in_progress.set(count)


def inc_presentation_generations_in_progress() -> None:
    """Increment the number of presentations currently being generated."""
    presentation_generations_in_progress.inc()


def dec_presentation_generations_in_progress() -> None:
    """Decrement the number of presentations currently being generated."""
    presentation_generations_in_progress.dec()


def observe_presentation_export(
    *,
    format: str,  # html, pdf, pptx
    status: str,
) -> None:
    """Record presentation export metrics."""
    presentation_exports_total.labels(
        format=format,
        status=status,
    ).inc()


def set_presentation_websocket_connections(count: int) -> None:
    """Update the number of active WebSocket connections."""
    presentation_websocket_connections.set(count)


# Social Hub / friends graph --------------------------------------------------
social_hub_friend_requests_total = Counter(
    "social_hub_friend_requests_total",
    "Social Hub friend-request outcomes",
    labelnames=("outcome",),
    registry=monitoring_registry,
)

social_hub_reports_total = Counter(
    "social_hub_reports_total",
    "Social Hub user-report outcomes",
    labelnames=("outcome",),
    registry=monitoring_registry,
)

social_hub_blocks_total = Counter(
    "social_hub_blocks_total",
    "Social Hub block flag changes on friendships",
    labelnames=("outcome",),
    registry=monitoring_registry,
)


def observe_social_hub_friend_request(*, outcome: str) -> None:
    """Record friend-request outcome (sent|blocked|rate_limited|rejected)."""
    with suppress(Exception):
        social_hub_friend_requests_total.labels(outcome=str(outcome or "unknown")[:64]).inc()


def observe_social_hub_report(*, outcome: str) -> None:
    """Record user-report outcome (created|duplicate)."""
    with suppress(Exception):
        social_hub_reports_total.labels(outcome=str(outcome or "unknown")[:64]).inc()


def observe_social_hub_block(*, outcome: str) -> None:
    """Record block toggle (set|cleared)."""
    with suppress(Exception):
        social_hub_blocks_total.labels(outcome=str(outcome or "unknown")[:64]).inc()
