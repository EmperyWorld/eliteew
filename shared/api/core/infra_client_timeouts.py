# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Env-driven timeout/retry defaults for Elasticsearch and RabbitMQ clients (overlay latency resilience).
# Invariants:
# - Pure os.environ reads; safe to unit-test without brokers.
# - Invalid/missing values fall back to clamped defaults (no raise).
# Related:
# - api/core/database_manager.py
# - api/services/elasticsearch_service.py
# - api/workers/queue_worker.py
# ---
"""Parse and clamp Elasticsearch / RabbitMQ client resilience settings from the environment."""

from __future__ import annotations

import os
from typing import Any


def _env_raw(*names: str) -> str | None:
    for name in names:
        raw = os.environ.get(name)
        if raw is not None and str(raw).strip() != "":
            return str(raw).strip()
    return None


def env_float(
    *names: str,
    default: float,
    minimum: float,
    maximum: float,
) -> float:
    raw = _env_raw(*names)
    if raw is None:
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    return max(minimum, min(maximum, value))


def env_int(
    *names: str,
    default: int,
    minimum: int,
    maximum: int,
) -> int:
    raw = _env_raw(*names)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return max(minimum, min(maximum, value))


def env_bool(*names: str, default: bool = True) -> bool:
    raw = _env_raw(*names)
    if raw is None:
        return default
    return raw.lower() in {"1", "true", "yes", "on"}


def elasticsearch_resilience_settings() -> dict[str, Any]:
    """
    Settings for AsyncElasticsearch / aiohttp ES clients.

    Env (aliases):
    - ELASTICSEARCH_REQUEST_TIMEOUT (default 60)
    - ELASTICSEARCH_MAX_RETRIES or ELASTIC_MAX_RETRIES (default 2)
    - ELASTICSEARCH_RETRY_ON_TIMEOUT (default true)
    - ELASTICSEARCH_CONNECT_TIMEOUT (default 15) — aiohttp connect
    - ELASTICSEARCH_DEAD_NODE_BACKOFF_FACTOR (default 2)
    - ELASTICSEARCH_MAX_DEAD_NODE_BACKOFF (default 30)
    - ELASTICSEARCH_SOFT_RECONNECT_INTERVAL_SEC (default 60)
    - ELASTICSEARCH_HEALTH_CHECK_TIMEOUT (default 10) — asyncio.wait_for around cluster.health
    """
    request_timeout = env_float(
        "ELASTICSEARCH_REQUEST_TIMEOUT",
        default=60.0,
        minimum=5.0,
        maximum=300.0,
    )
    connect_timeout = env_float(
        "ELASTICSEARCH_CONNECT_TIMEOUT",
        default=15.0,
        minimum=1.0,
        maximum=120.0,
    )
    # Connect must not exceed total request budget for aiohttp.
    connect_timeout = min(connect_timeout, request_timeout)
    health_check_timeout = env_float(
        "ELASTICSEARCH_HEALTH_CHECK_TIMEOUT",
        default=10.0,
        minimum=2.0,
        maximum=60.0,
    )
    # Health probe must stay under request budget (avoid 60s×retries blocking Celery).
    health_check_timeout = min(health_check_timeout, request_timeout)
    return {
        "request_timeout": request_timeout,
        "connect_timeout": connect_timeout,
        "health_check_timeout": health_check_timeout,
        "max_retries": env_int(
            "ELASTICSEARCH_MAX_RETRIES",
            "ELASTIC_MAX_RETRIES",
            default=2,
            minimum=0,
            maximum=10,
        ),
        "retry_on_timeout": env_bool("ELASTICSEARCH_RETRY_ON_TIMEOUT", default=True),
        "dead_node_backoff_factor": env_float(
            "ELASTICSEARCH_DEAD_NODE_BACKOFF_FACTOR",
            default=2.0,
            minimum=1.0,
            maximum=60.0,
        ),
        "max_dead_node_backoff": env_float(
            "ELASTICSEARCH_MAX_DEAD_NODE_BACKOFF",
            default=30.0,
            minimum=1.0,
            maximum=600.0,
        ),
        "soft_reconnect_interval_sec": env_float(
            "ELASTICSEARCH_SOFT_RECONNECT_INTERVAL_SEC",
            default=60.0,
            minimum=15.0,
            maximum=600.0,
        ),
        "retry_on_status": (502, 503, 504),
    }


def rabbitmq_connection_resilience_settings() -> dict[str, int]:
    """
    Heartbeat / blocked-connection settings for aio_pika.connect_robust.

    Env:
    - RABBITMQ_HEARTBEAT (default 60)
    - RABBITMQ_BLOCKED_CONNECTION_TIMEOUT (default 300)
    """
    return {
        "heartbeat": env_int(
            "RABBITMQ_HEARTBEAT",
            default=60,
            minimum=10,
            maximum=600,
        ),
        "blocked_connection_timeout": env_int(
            "RABBITMQ_BLOCKED_CONNECTION_TIMEOUT",
            default=300,
            minimum=30,
            maximum=3600,
        ),
    }


def filter_supported_kwargs(callable_obj: Any, kwargs: dict[str, Any]) -> dict[str, Any]:
    """Drop kwargs not accepted by ``callable_obj`` (signature inspection)."""
    try:
        import inspect

        sig = inspect.signature(callable_obj)
        params = sig.parameters
        if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values()):
            return dict(kwargs)
        allowed = set(params)
        return {k: v for k, v in kwargs.items() if k in allowed}
    except TypeError, ValueError:
        return dict(kwargs)
