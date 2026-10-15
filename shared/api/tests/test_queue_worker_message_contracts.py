# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for QueueWorker contracts: startup queue selection, Site Studio heartbeat readiness,
# invalid payloads, retries, and DLQ finalization metadata.
# Invariants:
# - No live RabbitMQ broker; publish/ack are mocked.
# - Site Studio worker readiness must be tied to the logical queue key, not the physical queue name.
# - DLQ payloads must carry source_queue for operator forensics.
# Related:
# - api/workers/queue_worker.py
# - api/services/site_studio_lifecycle_jobs.py
# - api/services/ugs/queue_worker_resilience.py
# ---
"""Queue worker message handling contract tests."""

from __future__ import annotations

import asyncio
import importlib
import json
import sys
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock

import pytest


def _message(body: bytes, delivery_tag: int = 1) -> SimpleNamespace:
    return SimpleNamespace(body=body, delivery_tag=delivery_tag, ack=AsyncMock())


def _import_queue_worker(monkeypatch: pytest.MonkeyPatch):
    handlers_module = ModuleType("api.workers.queue_handlers")
    setattr(handlers_module, "TASK_HANDLERS", {})
    monkeypatch.setitem(sys.modules, "api.workers.queue_handlers", handlers_module)
    from api.workers import queue_worker as qw

    return importlib.reload(qw)


@pytest.mark.asyncio
async def test_start_site_studio_filtered_worker_starts_readiness_heartbeat(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    qw = _import_queue_worker(monkeypatch)

    class _Queue:
        async def consume(self, _callback: object) -> str:
            return "consumer-tag"

    class _Channel:
        def __init__(self) -> None:
            self.declared: list[str] = []

        async def set_qos(self, *, prefetch_count: int) -> None:
            assert prefetch_count == 1

        async def declare_queue(self, queue_name: str, *, durable: bool) -> _Queue:
            assert durable is True
            self.declared.append(queue_name)
            return _Queue()

        async def close(self) -> None:
            return None

    class _Connection:
        def __init__(self, channel: _Channel) -> None:
            self._channel = channel

        async def channel(self) -> _Channel:
            return self._channel

        async def close(self) -> None:
            return None

    channel = _Channel()
    monkeypatch.setenv("QUEUE_WORKER_ALLOWED_QUEUE_KEYS", "site_studio")
    monkeypatch.setattr(qw.DatabaseConfig, "RABBITMQ_CONFIG", {"queues": {"site_studio": "site-studio.runtime.queue"}})
    monkeypatch.setattr(qw.DatabaseConfig, "get_rabbitmq_url", lambda *, internal: "amqp://guest:guest@rabbitmq:5672/")
    monkeypatch.setattr(qw, "aio_pika", SimpleNamespace(connect_robust=AsyncMock(return_value=_Connection(channel))))
    monkeypatch.setattr(qw, "init_http_clients", AsyncMock())
    monkeypatch.setattr(qw, "close_http_clients", AsyncMock())

    heartbeat_started = asyncio.Event()

    async def _heartbeat_loop(self: object) -> None:
        heartbeat_started.set()
        await asyncio.sleep(3600)

    monkeypatch.setattr(qw.QueueWorker, "_site_studio_heartbeat_loop", _heartbeat_loop)
    worker = qw.QueueWorker()
    worker._declare_queue_topology = AsyncMock()  # type: ignore[method-assign]

    await worker.start()
    await asyncio.wait_for(heartbeat_started.wait(), timeout=1)

    assert channel.declared == ["site-studio.runtime.queue"]
    assert worker._site_studio_heartbeat_task is not None
    assert not worker._site_studio_heartbeat_task.done()

    await worker.close()
    qw.close_http_clients.assert_awaited_once()


@pytest.mark.asyncio
async def test_handle_message_invalid_json_sends_dlq_with_source_queue(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    qw = _import_queue_worker(monkeypatch)

    worker = qw.QueueWorker()
    published: list[tuple[str, dict[str, object]]] = []
    worker._publish_to_dlq = AsyncMock(side_effect=lambda q, p: published.append((q, p)))  # type: ignore[method-assign]
    worker._publish = AsyncMock()  # type: ignore[method-assign]

    message = _message(b"{not-json", delivery_tag=77)
    await worker._handle_message(message, "ai.generation.queue")

    worker._publish_to_dlq.assert_awaited_once()
    assert published[0][0] == "ai.generation.queue"
    assert published[0][1]["error"] == "invalid_json"
    assert published[0][1]["source_queue"] == "ai.generation.queue"
    message.ack.assert_awaited_once()


@pytest.mark.asyncio
async def test_handle_message_unknown_task_type_routes_to_dlq(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    qw = _import_queue_worker(monkeypatch)

    monkeypatch.setattr(qw, "TASK_HANDLERS", {})
    worker = qw.QueueWorker()
    published: list[dict[str, object]] = []
    worker._publish_to_dlq = AsyncMock(side_effect=lambda _q, p: published.append(p))  # type: ignore[method-assign]
    worker._publish = AsyncMock()  # type: ignore[method-assign]

    payload = {"task_type": "unknown_task", "request_id": "req-1"}
    message = _message(json.dumps(payload).encode("utf-8"))
    await worker._handle_message(message, "ai.generation.queue")

    worker._publish_to_dlq.assert_awaited_once()
    assert published[0]["task_type"] == "unknown_task"
    assert published[0]["source_queue"] == "ai.generation.queue"
    message.ack.assert_awaited_once()


@pytest.mark.asyncio
async def test_handle_message_failure_schedules_retry_with_attempt_and_last_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    qw = _import_queue_worker(monkeypatch)

    handler = AsyncMock(side_effect=RuntimeError("boom"))
    monkeypatch.setattr(qw, "TASK_HANDLERS", {"ugs_generation": handler})
    monkeypatch.setattr(qw, "compute_queue_worker_retry_delay_seconds", lambda _attempt: 2.0)

    worker = qw.QueueWorker()
    worker._max_attempts = 3
    scheduled: list[tuple[str, dict[str, object], float]] = []
    worker._schedule_retry = AsyncMock(side_effect=lambda q, p, d: scheduled.append((q, p, d)))  # type: ignore[method-assign]
    worker._publish = AsyncMock()  # type: ignore[method-assign]
    worker._publish_to_dlq = AsyncMock()  # type: ignore[method-assign]
    monkeypatch.setattr(qw, "maybe_mark_ugs_request_failed_from_dlq", AsyncMock())
    monkeypatch.setattr(qw, "maybe_mark_ewrp_job_failed_from_dlq", AsyncMock())

    payload = {
        "task_type": "ugs_generation",
        "request_id": "550e8400-e29b-41d4-a716-446655440000",
        "attempt": 0,
    }
    message = _message(json.dumps(payload).encode("utf-8"))
    await worker._handle_message(message, "ai.generation.queue")

    worker._schedule_retry.assert_awaited_once()
    worker._publish.assert_not_awaited()
    worker._publish_to_dlq.assert_not_awaited()
    assert scheduled[0][0] == "ai.generation.queue"
    assert scheduled[0][1]["attempt"] == 1
    assert "boom" in str(scheduled[0][1]["last_error"])
    assert scheduled[0][2] == 2.0
    message.ack.assert_awaited_once()


@pytest.mark.asyncio
async def test_handle_message_exhausted_retries_sends_dlq_with_failed_attempts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    qw = _import_queue_worker(monkeypatch)

    handler = AsyncMock(side_effect=RuntimeError("still-failing"))
    monkeypatch.setattr(qw, "TASK_HANDLERS", {"ugs_generation": handler})
    monkeypatch.setattr(qw, "compute_queue_worker_retry_delay_seconds", lambda _attempt: 0.0)
    mark_ugs = AsyncMock()
    mark_ewrp = AsyncMock()
    monkeypatch.setattr(qw, "maybe_mark_ugs_request_failed_from_dlq", mark_ugs)
    monkeypatch.setattr(qw, "maybe_mark_ewrp_job_failed_from_dlq", mark_ewrp)

    worker = qw.QueueWorker()
    worker._max_attempts = 2
    dlq_payloads: list[tuple[str, dict[str, object]]] = []
    worker._publish_to_dlq = AsyncMock(side_effect=lambda q, p: dlq_payloads.append((q, p)))  # type: ignore[method-assign]
    worker._publish = AsyncMock()  # type: ignore[method-assign]
    worker._schedule_retry = AsyncMock()  # type: ignore[method-assign]

    payload = {
        "task_type": "ugs_generation",
        "request_id": "550e8400-e29b-41d4-a716-446655440000",
        "attempt": 1,
    }
    message = _message(json.dumps(payload).encode("utf-8"))
    await worker._handle_message(message, "ai.generation.queue")

    worker._publish.assert_not_awaited()
    worker._schedule_retry.assert_not_awaited()
    worker._publish_to_dlq.assert_awaited_once()
    dlq_queue, dlq_payload = dlq_payloads[0]
    assert dlq_queue == "ai.generation.queue"
    assert dlq_payload["failed_attempts"] == 2
    assert dlq_payload["source_queue"] == "ai.generation.queue"
    mark_ugs.assert_awaited_once_with(dlq_payload)
    mark_ewrp.assert_awaited_once_with(dlq_payload)
    message.ack.assert_awaited_once()


@pytest.mark.asyncio
async def test_schedule_retry_uses_numeric_expiration_for_aio_pika() -> None:
    qw = importlib.import_module("api.workers.queue_worker")
    qw = importlib.reload(qw)

    published: list[tuple[object, str, bool]] = []

    class _Message:
        def __init__(self, **kwargs: object) -> None:
            self.kwargs = kwargs

    class _Exchange:
        async def publish(self, message: object, routing_key: str, mandatory: bool) -> None:
            published.append((message, routing_key, mandatory))

    worker = qw.QueueWorker()
    worker._channel = SimpleNamespace(default_exchange=_Exchange())
    setattr(qw, "aio_pika", SimpleNamespace(Message=_Message, DeliveryMode=SimpleNamespace(PERSISTENT=2)))

    await worker._schedule_retry(
        "ai.generation.queue",
        {
            "task_type": "ugs_generation",
            "request_id": "550e8400-e29b-41d4-a716-446655440000",
        },
        1.25,
    )

    assert len(published) == 1
    message, routing_key, mandatory = published[0]
    assert routing_key == "ai.generation.queue.retry"
    assert mandatory is True
    expiration = message.kwargs["expiration"]  # type: ignore[attr-defined]
    assert isinstance(expiration, int)
    assert expiration == 1250
