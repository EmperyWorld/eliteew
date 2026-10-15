# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for RabbitMQ queue worker: AMQP client name, QoS prefetch, max attempts, retry backoff.
# Invariants:
# - No live broker; patch env and random for deterministic assertions.
# Related:
# - api/workers/queue_worker_retry.py
# ---
"""Tests for queue worker retry backoff and max attempts."""

from __future__ import annotations

import random

import pytest

from api.workers.queue_worker_retry import (
    compute_queue_worker_retry_delay_seconds,
    queue_worker_max_attempts,
    queue_worker_prefetch_count,
    queue_worker_rabbitmq_connection_tuning,
)


def test_compute_queue_worker_retry_delay_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("QUEUE_WORKER_RETRY_BACKOFF", "0")
    assert compute_queue_worker_retry_delay_seconds(0) == 0.0
    assert compute_queue_worker_retry_delay_seconds(2) == 0.0


def test_compute_queue_worker_retry_delay_exponential(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("QUEUE_WORKER_RETRY_BACKOFF", "1")
    monkeypatch.setenv("QUEUE_WORKER_RETRY_BACKOFF_CAP_SEC", "120")
    monkeypatch.setattr(random, "uniform", lambda _a, _b: 0.0)

    assert compute_queue_worker_retry_delay_seconds(0) == 1.0
    assert compute_queue_worker_retry_delay_seconds(1) == 2.0
    assert compute_queue_worker_retry_delay_seconds(2) == 4.0


def test_compute_queue_worker_retry_delay_respects_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("QUEUE_WORKER_RETRY_BACKOFF", "1")
    monkeypatch.setenv("QUEUE_WORKER_RETRY_BACKOFF_CAP_SEC", "10")
    monkeypatch.setattr(random, "uniform", lambda _a, _b: 0.0)

    assert compute_queue_worker_retry_delay_seconds(10) == 10.0


def test_queue_worker_max_attempts_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("QUEUE_WORKER_MAX_ATTEMPTS", raising=False)
    assert queue_worker_max_attempts() == 3


def test_queue_worker_max_attempts_clamp(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("QUEUE_WORKER_MAX_ATTEMPTS", "0")
    assert queue_worker_max_attempts() == 1
    monkeypatch.setenv("QUEUE_WORKER_MAX_ATTEMPTS", "99")
    assert queue_worker_max_attempts() == 20


def test_queue_worker_prefetch_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("QUEUE_WORKER_PREFETCH_COUNT", raising=False)
    assert queue_worker_prefetch_count() == 1


def test_queue_worker_prefetch_clamp(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("QUEUE_WORKER_PREFETCH_COUNT", "0")
    assert queue_worker_prefetch_count() == 1
    monkeypatch.setenv("QUEUE_WORKER_PREFETCH_COUNT", "100")
    assert queue_worker_prefetch_count() == 32


def test_queue_worker_rabbitmq_connection_name_appended(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("QUEUE_WORKER_CONNECTION_NAME", "worker-a")
    url, label = queue_worker_rabbitmq_connection_tuning("amqp://u:p@h:5672/vhost")
    assert "name=" in url
    assert label == "worker-a"


def test_queue_worker_rabbitmq_connection_name_skips_if_url_has_name(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("QUEUE_WORKER_CONNECTION_NAME", "ignored")
    base = "amqp://u:p@h:5672/vhost?name=already"
    url, label = queue_worker_rabbitmq_connection_tuning(base)
    assert url == base
    assert label == "ignored"
