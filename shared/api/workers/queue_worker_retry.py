#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure helpers for RabbitMQ queue consumer: AMQP URL client name (management UI), QoS prefetch,
# max handler attempts before DLQ, and retry delay (exponential backoff + jitter); used by
# `api/workers/queue_worker.py` so operators can tune resilience without code changes.
# Invariants:
# - No side effects except reading ``os.environ``; safe to unit-test without brokers.
# Related:
# - api/workers/queue_worker.py
# ---
"""Queue worker RabbitMQ tuning: connection name, prefetch, max attempts, retry backoff."""

from __future__ import annotations

import os
import random


def queue_worker_max_attempts() -> int:
    """
    Maximum handler executions per queued message before publishing to DLQ.

    The message ``attempt`` field is 0-based; a value of **3** allows ``attempt`` 0, 1, 2
    (three runs), then DLQ.
    """
    raw = (os.environ.get("QUEUE_WORKER_MAX_ATTEMPTS") or "3").strip()
    try:
        n = int(raw)
    except ValueError:
        n = 3
    return max(1, min(n, 20))


def queue_worker_prefetch_count() -> int:
    """
    RabbitMQ QoS prefetch for the consumer channel (unacked deliveries per consumer).

    Default **1** matches one in-flight heavy UGS job per worker; raise only when handlers are
    lightweight and parallelism is desired.
    """
    raw = (os.environ.get("QUEUE_WORKER_PREFETCH_COUNT") or "1").strip()
    try:
        n = int(raw)
    except ValueError:
        n = 1
    return max(1, min(n, 32))


def queue_worker_rabbitmq_connection_tuning(base_url: str) -> tuple[str, str]:
    """
    Build AMQP URL with ``name=`` for RabbitMQ management UI / connection list (aiormq/aio-pika).

    If ``name=`` is already present in ``base_url``, the URL is returned unchanged.
    Returns ``(url, display_label)`` where ``display_label`` is always the intended client name for logs.
    """
    from urllib.parse import quote

    raw = (os.environ.get("QUEUE_WORKER_CONNECTION_NAME") or "eliteew-queue-worker").strip()
    display = (raw[:128] if raw else "eliteew-queue-worker") or "eliteew-queue-worker"
    if "name=" in base_url.lower():
        return base_url, display
    sep = "&" if "?" in base_url else "?"
    return f"{base_url}{sep}name={quote(display, safe='')}", display


def _retry_backoff_cap_seconds() -> float:
    raw = (os.environ.get("QUEUE_WORKER_RETRY_BACKOFF_CAP_SEC") or "120").strip()
    try:
        cap = float(raw)
    except ValueError:
        return 120.0
    return max(1.0, min(cap, 600.0))


def compute_queue_worker_retry_delay_seconds(failed_attempt_index: int) -> float:
    """
    Exponential backoff + jitter before re-publishing after a handler failure.

    ``failed_attempt_index`` is the message ``attempt`` field when the handler failed (0-based).
    """
    if os.environ.get("QUEUE_WORKER_RETRY_BACKOFF", "1").strip().lower() in {"0", "false", "no"}:
        return 0.0
    cap = _retry_backoff_cap_seconds()
    base = min(2.0 ** max(0, failed_attempt_index), cap)
    jitter = random.uniform(0.0, 1.0)
    return base + jitter
