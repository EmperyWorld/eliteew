#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# RabbitMQ consumer for durable background jobs (UGS, EWRP, BI, Site Studio, etc.): decode JSON,
# dispatch handlers, bounded retries, DLQ publish, and worker readiness heartbeats.
# Invariants:
# - Handlers must not leave the main queue message unacked; failures retry then DLQ with ack.
# - Between failures optional exponential backoff (`QUEUE_WORKER_RETRY_BACKOFF`, `QUEUE_WORKER_RETRY_BACKOFF_CAP_SEC`).
# - Max handler runs per message before DLQ: `QUEUE_WORKER_MAX_ATTEMPTS` (see `queue_worker_retry.py`).
# - Site Studio heartbeat starts from the logical queue key, not the physical RabbitMQ queue name.
# - Optional RabbitMQ **client name** in management UI via `QUEUE_WORKER_CONNECTION_NAME` (AMQP URL `name=`).
# - DLQ JSON includes `source_queue` (RabbitMQ routing key) for invalid payloads, unknown task types,
#   and terminal failures — does not change handler input messages.
# - Invalid JSON logs a truncated body preview (size-capped) plus RabbitMQ delivery_tag — not the full raw payload.
# Related:
# - api/workers/queue_handlers.py
# - api/workers/queue_worker_retry.py
# - api/services/site_studio_lifecycle_jobs.py
# - api/services/ugs/queue_worker_resilience.py
# - documentation/platform/docker-re_doc/UGS-QUEUE-OPERATOR-ENV.md (operator env table)
# ---
"""RabbitMQ queue worker for durable background jobs."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from contextlib import suppress
from typing import Any

try:
    import aio_pika
except ImportError:  # pragma: no cover
    aio_pika = None  # type: ignore[assignment]

from api.core.database_manager import DatabaseConfig
from api.core.http_clients import close_http_clients, init_http_clients
from api.core.infra_client_timeouts import rabbitmq_connection_resilience_settings
from api.core.logging_config import configure_logging
from api.services.ewrp_queue_resilience import maybe_mark_ewrp_job_failed_from_dlq
from api.services.site_studio_lifecycle_jobs import (
    SITE_STUDIO_QUEUE_NAME,
    record_worker_heartbeat,
)
from api.services.ugs.queue_worker_resilience import maybe_mark_ugs_request_failed_from_dlq
from api.workers.queue_handlers import TASK_HANDLERS
from api.workers.queue_worker_retry import (
    compute_queue_worker_retry_delay_seconds,
    queue_worker_max_attempts,
    queue_worker_prefetch_count,
    queue_worker_rabbitmq_connection_tuning,
)

logger = logging.getLogger("api.queue_worker")

# Comma-separated RabbitMQ queue *keys* from DatabaseConfig.RABBITMQ_CONFIG["queues"].
_QUEUE_FILTER_ENV = "QUEUE_WORKER_ALLOWED_QUEUE_KEYS"
_RETRY_QUEUE_TTL_MS_ENV = "QUEUE_WORKER_RETRY_QUEUE_TTL_MS"


def _parse_queue_key_filter() -> tuple[set[str] | None, str]:
    raw = (os.environ.get(_QUEUE_FILTER_ENV) or "").strip()
    if not raw:
        return None, ""
    return {part.strip() for part in raw.split(",") if part.strip()}, raw


def _with_source_queue(payload: dict[str, Any], queue_name: str) -> dict[str, Any]:
    """Attach RabbitMQ routing queue name for DLQ forensics (does not affect handler payloads)."""
    out = dict(payload)
    out["source_queue"] = queue_name
    return out


def _logical_message_id(payload: dict[str, Any]) -> str:
    for key in ("request_id", "job_id", "session_id", "content_id", "run_id"):
        value = str(payload.get(key) or "").strip()
        if value:
            return value[:255]
    return f"{payload.get('task_type') or 'queue-task'}:{uuid.uuid4()}"


def _retry_queue_ttl_ms() -> int:
    raw = (os.environ.get(_RETRY_QUEUE_TTL_MS_ENV) or "").strip()
    if not raw:
        return 300_000
    try:
        return max(1_000, min(3_600_000, int(raw)))
    except ValueError:
        return 300_000


class QueueWorker:
    def __init__(self) -> None:
        self._connection: Any = None
        self._channel: Any = None
        self._consumer_tags: list[str] = []
        self._max_attempts: int = 3
        self._site_studio_heartbeat_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if aio_pika is None:
            raise RuntimeError("aio-pika is not installed")

        await init_http_clients()
        amqp_url, client_name_label = queue_worker_rabbitmq_connection_tuning(
            DatabaseConfig.get_rabbitmq_url(internal=True)
        )
        logger.info(
            "queue_worker: RabbitMQ client name (management UI)=%r (env QUEUE_WORKER_CONNECTION_NAME)",
            client_name_label,
        )
        rmq = rabbitmq_connection_resilience_settings()
        self._connection = await aio_pika.connect_robust(
            amqp_url,
            heartbeat=int(rmq["heartbeat"]),
            blocked_connection_timeout=int(rmq["blocked_connection_timeout"]),
        )
        self._channel = await self._connection.channel()
        self._max_attempts = queue_worker_max_attempts()
        prefetch = queue_worker_prefetch_count()
        logger.info(
            "queue_worker: prefetch_count=%s max_handler_attempts=%s "
            "(env QUEUE_WORKER_PREFETCH_COUNT, QUEUE_WORKER_MAX_ATTEMPTS)",
            prefetch,
            self._max_attempts,
        )
        # UGS/Llama: prefetch 1 — одна тяжёлая генерация за раз на воркер; >1 только если осознанно нужен параллелизм.
        await self._channel.set_qos(prefetch_count=prefetch)

        queue_defs = dict(DatabaseConfig.RABBITMQ_CONFIG.get("queues") or {})
        allowed, filter_raw = _parse_queue_key_filter()
        if allowed is not None:
            unknown = sorted(allowed.difference(queue_defs.keys()))
            if unknown:
                logger.warning(
                    "QUEUE_WORKER_ALLOWED_QUEUE_KEYS содержит неизвестные ключи (игнорируем): %s; известные=%s",
                    unknown,
                    sorted(queue_defs.keys()),
                )
            selected = {key: name for key, name in queue_defs.items() if key in allowed}
            skipped = sorted(set(queue_defs.keys()) - set(selected.keys()))
            logger.info(
                "queue_worker filter: allowed=%s consuming=%s skipping=%s",
                sorted(allowed),
                list(selected.values()),
                skipped,
            )
            queue_defs = selected
            if not queue_defs:
                raise RuntimeError(
                    f"No RabbitMQ queues selected ({_QUEUE_FILTER_ENV}={filter_raw!r}). "
                    f"Known keys: {sorted(DatabaseConfig.RABBITMQ_CONFIG.get('queues') or ())}"
                )
        else:
            logger.info(
                "queue_worker filter: %(env)s not set — consuming all configured queues: %(queues)s",
                {"env": _QUEUE_FILTER_ENV, "queues": list(queue_defs.values())},
            )

        for queue_name in queue_defs.values():
            await self._declare_queue_topology(queue_name)

        for queue_name in queue_defs.values():
            queue = await self._channel.declare_queue(queue_name, durable=True)
            consumer_tag = await queue.consume(lambda message, q=queue_name: self._handle_message(message, q))
            self._consumer_tags.append(str(consumer_tag))
            logger.info("Worker consuming queue %s", queue_name)
        if SITE_STUDIO_QUEUE_NAME in set(queue_defs.keys()):
            self._site_studio_heartbeat_task = asyncio.create_task(self._site_studio_heartbeat_loop())

    async def close(self) -> None:
        if self._site_studio_heartbeat_task is not None:
            self._site_studio_heartbeat_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._site_studio_heartbeat_task
        if self._channel is not None:
            await self._channel.close()
        if self._connection is not None:
            await self._connection.close()
        await close_http_clients()

    async def _site_studio_heartbeat_loop(self) -> None:
        from api.core.database_manager import get_database_manager

        while True:
            try:
                manager = await get_database_manager()
                async with manager.get_postgres_session() as db:
                    await record_worker_heartbeat(db, metadata={"source": "queue_worker_idle"})
                    await db.commit()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.debug("Site Studio worker heartbeat skipped", exc_info=True)
            await asyncio.sleep(30)

    async def _handle_message(self, message: Any, queue_name: str) -> None:  # noqa: ANN401
        try:
            payload = json.loads(message.body.decode("utf-8"))
        except Exception as exc:
            raw_full = message.body.decode("utf-8", errors="replace")
            preview = raw_full[:512] + ("…" if len(raw_full) > 512 else "")
            dtag = getattr(message, "delivery_tag", None)
            logger.exception(
                "Invalid queue JSON: queue=%s delivery_tag=%s body_preview=%r exc=%s",
                queue_name,
                dtag,
                preview,
                exc,
            )
            await self._publish_to_dlq(
                queue_name,
                _with_source_queue(
                    {"error": "invalid_json", "raw": message.body.decode("utf-8", "ignore")},
                    queue_name,
                ),
            )
            await message.ack()
            return

        request_id_log = str(payload.get("request_id") or "").strip() or "-"

        task_type = str(payload.get("task_type") or "")
        handler = TASK_HANDLERS.get(task_type)
        if handler is None:
            logger.error(
                "No handler for task_type=%s on queue=%s request_id=%s",
                task_type,
                queue_name,
                request_id_log,
            )
            await self._publish_to_dlq(queue_name, _with_source_queue(dict(payload), queue_name))
            await message.ack()
            return

        attempt = int(payload.get("attempt") or 0)
        try:
            await handler(payload)
            await message.ack()
        except Exception as exc:
            logger.exception(
                "Queue handler failed: queue=%s task=%s attempt=%s request_id=%s",
                queue_name,
                task_type,
                attempt,
                request_id_log,
            )
            if attempt + 1 < self._max_attempts:
                retry_payload = dict(payload)
                retry_payload["attempt"] = attempt + 1
                retry_payload["last_error"] = str(exc)
                delay_s = compute_queue_worker_retry_delay_seconds(attempt)
                if delay_s > 0.0:
                    logger.info(
                        "Queue worker retry scheduled: delay=%.2fs queue=%s task=%s next_attempt=%s request_id=%s",
                        delay_s,
                        queue_name,
                        task_type,
                        attempt + 1,
                        request_id_log,
                    )
                    await self._schedule_retry(queue_name, retry_payload, delay_s)
                else:
                    await self._publish(queue_name, retry_payload)
            else:
                dlq_payload = dict(payload)
                dlq_payload["failed_attempts"] = attempt + 1
                dlq_payload["last_error"] = str(exc)
                dlq_payload = _with_source_queue(dlq_payload, queue_name)
                logger.warning(
                    "Queue handler exhausted retries -> DLQ: queue=%s task=%s request_id=%s failed_attempts=%s max_attempts=%s",
                    queue_name,
                    task_type,
                    request_id_log,
                    dlq_payload.get("failed_attempts"),
                    self._max_attempts,
                )
                await self._publish_to_dlq(queue_name, dlq_payload)
                await maybe_mark_ugs_request_failed_from_dlq(dlq_payload)
                await maybe_mark_ewrp_job_failed_from_dlq(dlq_payload)
            await message.ack()

    async def _declare_queue_topology(self, queue_name: str) -> None:
        assert self._channel is not None
        await self._channel.declare_queue(queue_name, durable=True)
        await self._channel.declare_queue(self._dlq_name(queue_name), durable=True)
        await self._channel.declare_queue(
            self._retry_queue_name(queue_name),
            durable=True,
            arguments={
                "x-message-ttl": _retry_queue_ttl_ms(),
                "x-dead-letter-exchange": "",
                "x-dead-letter-routing-key": queue_name,
            },
        )

    async def _publish(self, queue_name: str, payload: dict[str, Any]) -> None:
        assert self._channel is not None
        if aio_pika is None:
            raise RuntimeError("aio-pika is not installed")
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        message_id = _logical_message_id(payload)
        await self._channel.default_exchange.publish(
            aio_pika.Message(
                body=body,
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                message_id=message_id,
                correlation_id=str(payload.get("correlation_id") or message_id),
            ),
            routing_key=queue_name,
            mandatory=True,
        )

    async def _schedule_retry(self, queue_name: str, payload: dict[str, Any], delay_s: float) -> None:
        assert self._channel is not None
        if aio_pika is None:
            raise RuntimeError("aio-pika is not installed")
        retry_queue = self._retry_queue_name(queue_name)
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        delay_ms = max(1_000, int(delay_s * 1000))
        message_id = _logical_message_id(payload)
        await self._channel.default_exchange.publish(
            aio_pika.Message(
                body=body,
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                message_id=message_id,
                correlation_id=str(payload.get("correlation_id") or message_id),
                # aio-pika 9+ validates expiration type; use numeric delay to avoid ValueError(str).
                expiration=delay_ms,
            ),
            routing_key=retry_queue,
            mandatory=True,
        )

    async def _publish_to_dlq(self, queue_name: str, payload: dict[str, Any]) -> None:
        await self._publish(self._dlq_name(queue_name), payload)

    @staticmethod
    def _dlq_name(queue_name: str) -> str:
        return f"{queue_name}.dlq"

    @staticmethod
    def _retry_queue_name(queue_name: str) -> str:
        return f"{queue_name}.retry"


async def _run_forever() -> None:
    configure_logging()  # Uses ELITEEW_LOG_FILE for file output (Vector → VictoriaLogs)
    worker = QueueWorker()
    await worker.start()
    try:
        while True:
            await asyncio.sleep(3600)
    finally:
        await worker.close()


def main() -> None:
    asyncio.run(_run_forever())


if __name__ == "__main__":
    main()
