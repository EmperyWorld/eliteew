#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# RabbitMQ publisher + management snapshot helpers for queue depth observability.
# Invariants:
# - Publish path degrades gracefully and returns bool status instead of bubbling broker exceptions.
# - Management polling is best-effort; failures do not break request/runtime flows.
# Related:
# - api/core/database_manager.py
# - api/monitoring/metrics.py
# ---
"""
Сервис публикации сообщений в RabbitMQ.
Очереди: UGS/генерации, документы (Whisper, конвертация), уведомления (Telegram, push), Llama длинные задачи.
Использует конфиг из DatabaseConfig.RABBITMQ_CONFIG (exchanges, queues).
"""

import json
import logging
import os
import uuid
from typing import Any

from api.core.database_manager import DatabaseConfig, get_database_manager

try:
    import aio_pika
    from aio_pika import DeliveryMode, Message
except ImportError:
    aio_pika = None  # type: ignore[assignment]
    Message = None  # type: ignore[assignment, misc]
    DeliveryMode = None  # type: ignore[assignment, misc]

logger = logging.getLogger(__name__)

# Ключи очередей из RABBITMQ_CONFIG["queues"]
QUEUE_AI_GENERATION = "ai_generation"
QUEUE_DOCUMENT_PROCESSING = "document_processing"
QUEUE_NOTIFICATIONS = "notifications"
QUEUE_SITE_STUDIO = "site_studio"
RABBITMQ_RETRY_QUEUE_TTL_MS_ENV = "QUEUE_WORKER_RETRY_QUEUE_TTL_MS"


def _logical_message_id(body: dict[str, Any] | str | bytes) -> str:
    if isinstance(body, dict):
        for key in ("request_id", "job_id", "session_id", "content_id", "run_id"):
            value = str(body.get(key) or "").strip()
            if value:
                return value[:255]
        task_type = str(body.get("task_type") or "queue-task").strip() or "queue-task"
        return f"{task_type}:{uuid.uuid4()}"
    return f"rabbitmq:{uuid.uuid4()}"


def _retry_queue_ttl_ms() -> int:
    raw = (os.environ.get(RABBITMQ_RETRY_QUEUE_TTL_MS_ENV) or "").strip()
    if not raw:
        return 300_000
    try:
        return max(1_000, min(3_600_000, int(raw)))
    except ValueError:
        return 300_000


class RabbitMQService:
    """Публикация в очереди RabbitMQ. Очереди объявляются при первом использовании."""

    def __init__(self) -> None:
        self._channel: Any = None

    async def _get_channel(self):  # type: ignore[no-any-return]
        """Ленивое получение канала (один канал на сервис)."""
        if self._channel is not None and not self._channel.is_closed:
            return self._channel
        manager = await get_database_manager()
        if not manager.rabbitmq_connection:
            raise RuntimeError("RabbitMQ not available")
        self._channel = await manager.rabbitmq_connection.channel()
        await self._channel.set_qos(prefetch_count=1)
        return self._channel

    def _queue_name(self, queue_key: str) -> str:
        """Имя очереди в RabbitMQ по ключу из конфига."""
        queues = DatabaseConfig.RABBITMQ_CONFIG.get("queues") or {}
        return queues.get(queue_key, queue_key)

    async def ensure_queues(self) -> None:
        """Объявить все очереди из конфига (идемпотентно). Вызывать при старте приложения по желанию."""
        if aio_pika is None:
            return
        try:
            channel = await self._get_channel()
            queues = DatabaseConfig.RABBITMQ_CONFIG.get("queues") or {}
            for name in queues.values():
                await channel.declare_queue(name, durable=True)
                await channel.declare_queue(f"{name}.dlq", durable=True)
                await channel.declare_queue(
                    f"{name}.retry",
                    durable=True,
                    arguments={
                        "x-message-ttl": _retry_queue_ttl_ms(),
                        "x-dead-letter-exchange": "",
                        "x-dead-letter-routing-key": name,
                    },
                )
            logger.info("RabbitMQ queues declared: %s", list(queues.values()))
        except Exception as e:
            logger.warning("RabbitMQ ensure_queues failed: %s", e)

    async def publish(
        self,
        queue_key: str,
        body: dict[str, Any] | str | bytes,
        *,
        content_type: str = "application/json",
    ) -> bool:
        """
        Опубликовать сообщение в очередь.
        :param queue_key: ключ из RABBITMQ_CONFIG["queues"]
            (ai_generation, document_processing, notifications, site_studio)
        :param body: тело сообщения (dict будет сериализован в JSON)
        :param content_type: application/json по умолчанию
        :return: True если отправлено, False при ошибке (логируем, не бросаем)
        """
        if aio_pika is None or Message is None or DeliveryMode is None:
            return False
        try:
            channel = await self._get_channel()
            queue_name = self._queue_name(queue_key)
            await channel.declare_queue(queue_name, durable=True)
            await channel.declare_queue(f"{queue_name}.dlq", durable=True)
            await channel.declare_queue(
                f"{queue_name}.retry",
                durable=True,
                arguments={
                    "x-message-ttl": _retry_queue_ttl_ms(),
                    "x-dead-letter-exchange": "",
                    "x-dead-letter-routing-key": queue_name,
                },
            )

            if isinstance(body, dict):
                payload = json.dumps(body, default=str).encode("utf-8")
            elif isinstance(body, str):
                payload = body.encode("utf-8")
            else:
                payload = body

            message_id = _logical_message_id(body)
            await channel.default_exchange.publish(
                Message(
                    body=payload,
                    content_type=content_type,
                    delivery_mode=DeliveryMode.PERSISTENT,
                    message_id=message_id,
                    correlation_id=str(body.get("correlation_id") or message_id)
                    if isinstance(body, dict)
                    else message_id,
                ),
                routing_key=queue_name,
                mandatory=True,
            )
            logger.debug("RabbitMQ published to %s (%s bytes)", queue_name, len(payload))
            return True
        except Exception as e:
            logger.warning("RabbitMQ publish to %s failed: %s", queue_key, e)
            return False

    async def publish_ai_generation(
        self, request_id: str, type_key: str, payload: dict[str, Any] | None = None
    ) -> bool:
        """Поставить задачу генерации (UGS) в очередь. Consumer может быть Airflow или воркер."""
        body = {"request_id": request_id, "type_key": type_key, **(payload or {})}
        return await self.publish(QUEUE_AI_GENERATION, body)

    async def publish_document_processing(
        self, task_type: str, content_id: str | None = None, payload: dict[str, Any] | None = None
    ) -> bool:
        """Поставить задачу обработки документа (Whisper, конвертация и т.д.)."""
        body = {"task_type": task_type, "content_id": content_id, **(payload or {})}
        return await self.publish(QUEUE_DOCUMENT_PROCESSING, body)

    async def publish_notification(
        self, channel: str, user_id: str | None = None, payload: dict[str, Any] | None = None
    ) -> bool:
        """Поставить уведомление (Telegram, push, email)."""
        body = {"channel": channel, "user_id": user_id, **(payload or {})}
        return await self.publish(QUEUE_NOTIFICATIONS, body)


async def fetch_rabbitmq_queues_snapshot() -> dict[str, Any]:
    """
    Poll RabbitMQ Management API for queue depths (operator snapshot, no Prometheus).

    Returns ``{ok, error, queues: [{name, messages_ready, messages_unacknowledged, consumers}]}``.
    """
    from api.core.database_manager import DatabaseFeatures  # noqa: PLC0415

    if not DatabaseFeatures.ENABLE_RABBITMQ:
        return {"ok": False, "error": "rabbitmq_disabled", "queues": []}

    try:
        import aiohttp  # noqa: PLC0415
    except ImportError:
        return {"ok": False, "error": "aiohttp_not_installed", "queues": []}

    cfg = DatabaseConfig.RABBITMQ_CONFIG
    user = os.environ.get("RABBITMQ_USER", cfg.get("username", "admin"))
    password = os.environ.get("RABBITMQ_PASSWORD", "") or ""
    host = cfg.get("internal_host", "stack1-rabbitmq")
    port = int(cfg.get("management_internal_port") or cfg.get("management_port") or 15672)
    url = f"http://{host}:{port}/api/queues"
    try:
        auth = aiohttp.BasicAuth(user, password)
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(auth=auth) as session, session.get(url, timeout=timeout) as resp:
            if resp.status != 200:
                return {"ok": False, "error": f"management_api_status_{resp.status}", "queues": []}
            raw = await resp.json()
    except Exception as exc:
        logger.debug("RabbitMQ management snapshot failed: %s", exc)
        return {"ok": False, "error": str(exc), "queues": []}

    if not isinstance(raw, list):
        return {"ok": False, "error": "unexpected_response_shape", "queues": []}

    configured_names = set((cfg.get("queues") or {}).values())
    rows: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", ""))
        if configured_names and name not in configured_names and not name.endswith(".dlq"):
            continue
        rows.append(
            {
                "name": name,
                "messages_ready": int(item.get("messages_ready", 0) or 0),
                "messages_unacknowledged": int(item.get("messages_unacknowledged", 0) or 0),
                "consumers": int(item.get("consumers", 0) or 0),
            }
        )
    rows.sort(key=lambda r: str(r.get("name", "")))
    return {"ok": True, "error": None, "queues": rows}


async def refresh_rabbitmq_queue_metrics_for_prometheus() -> None:
    """Poll RabbitMQ Management API and set ``rabbitmq_queue_messages_ready`` gauges."""
    from api.monitoring.metrics import (
        rabbitmq_queue_messages_ready,
        rabbitmq_queue_messages_unacked,
    )  # noqa: PLC0415

    snapshot = await fetch_rabbitmq_queues_snapshot()
    if not snapshot.get("ok"):
        return
    for row in snapshot.get("queues") or []:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name", ""))
        ready = int(row.get("messages_ready", 0) or 0)
        unacked = int(row.get("messages_unacknowledged", 0) or 0)
        rabbitmq_queue_messages_ready.labels(queue=name).set(ready)
        rabbitmq_queue_messages_unacked.labels(queue=name).set(unacked)


_rabbitmq_service: RabbitMQService | None = None


def get_rabbitmq_service() -> RabbitMQService:
    """Синглтон сервиса RabbitMQ."""
    global _rabbitmq_service  # noqa: PLW0603
    if _rabbitmq_service is None:
        _rabbitmq_service = RabbitMQService()
    return _rabbitmq_service
