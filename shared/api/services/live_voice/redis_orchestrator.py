# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/live_voice/redis_orchestrator.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""
Redis Orchestrator - Управление задачами через Redis

✅ FIX: Использует обычные Redis команды (SET/GET) вместо JSON.SET
для совместимости с Redis без модуля RedisJSON
"""

import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from redis.asyncio import Redis  # type: ignore[import-untyped]

from api.core.database_manager import get_database_manager

logger = logging.getLogger(__name__)

# Redis DB для Live Voice (используем DB 15 для изоляции)
REDIS_DB = 15


class RedisOrchestrator:
    """
    Оркестратор задач через Redis 8+ JSON

    Использует JSON команды Redis для управления состоянием задач
    """

    def __init__(self) -> None:
        self.redis_client: Redis | None = None
        self._connection_string: str | None = None

    async def connect(self) -> None:
        """Connect to Redis via DatabaseManager (DB 15 for Live Voice)."""
        if self.redis_client:
            return

        try:
            manager = await get_database_manager()
            redis = await manager.get_redis_client(db=REDIS_DB)
            if redis is None:
                return
            self.redis_client = redis
            await redis.ping()
            logger.info("RedisOrchestrator connected (DatabaseManager DB %s)", REDIS_DB)
        except Exception:
            logger.exception("RedisOrchestrator connection failed")
            logger.warning("Continuing without Redis cache for Live Voice")
            self.redis_client = None

    async def disconnect(self) -> None:
        """Release Redis reference (pool owned by DatabaseManager)."""
        if self.redis_client:
            self.redis_client = None
            self.redis_client = None
            logger.info("RedisOrchestrator disconnected")

    def _ensure_redis(self) -> Redis:
        """Ensure Redis connection is available"""
        if self.redis_client is None:
            raise RuntimeError("Redis not initialized. Call connect() first.")
        return self.redis_client

    async def create_task(self, user_id: str, audio_data: bytes, settings: dict[str, Any] | None = None) -> str:
        """
        Создать новую задачу обработки

        Args:
            user_id: ID пользователя
            audio_data: Аудио данные (bytes)
            settings: Настройки обработки

        Returns:
            task_id: UUID задачи
        """
        await self.connect()

        task_id = str(uuid.uuid4())
        audio_base64 = self._encode_audio(audio_data)

        task_data = {
            "user_id": user_id,
            "audio_base64": audio_base64,
            "status": "pending",
            "stage": "recording",
            "settings": settings or {},
            "stages": {
                "recording": {"started": datetime.now(UTC).isoformat()},
                "transcription": {},
                "llm": {},
                "tts": {},
                "playback": {},
            },
            "created_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat(),
        }

        try:
            redis_client = self._ensure_redis()
            # ✅ FIX: Используем обычный SET вместо JSON.SET
            await redis_client.set(
                f"live_voice:task:{task_id}",
                json.dumps(task_data),
                ex=3600,  # TTL 1 час
            )

            # Добавляем в список задач пользователя (используем LIST вместо JSON array)
            tasks_key = f"live_voice:tasks:{user_id}"
            task_entry = json.dumps({"task_id": task_id, "created_at": task_data["created_at"]})
            await redis_client.lpush(tasks_key, task_entry)
            await redis_client.expire(tasks_key, 86400)  # 24 часа
            # Ограничиваем размер списка (последние 100 задач)
            await redis_client.ltrim(tasks_key, 0, 99)

            logger.info("Task created: %s for user %s", task_id, user_id)
            return task_id

        except Exception:
            logger.exception("Failed to create task")
            raise

    async def update_task_stage(self, task_id: str, stage: str, data: dict[str, Any] | None = None) -> None:
        """
        Обновить этап обработки задачи

        Args:
            task_id: ID задачи
            stage: Этап (transcription, llm, tts, playback)
            data: Дополнительные данные
        """
        await self.connect()

        update_data = {
            "stage": stage,
            "updated_at": datetime.now(UTC).isoformat(),
        }

        # Обновляем информацию о этапе
        if data:
            update_data.update(data)

        # Обновляем stages
        stage_info = {"started": datetime.now(UTC).isoformat(), **(data or {})}

        try:
            # ✅ FIX: Получаем текущие данные, обновляем и сохраняем обратно
            redis_client = self._ensure_redis()
            task_key = f"live_voice:task:{task_id}"
            task_data_str = await redis_client.get(task_key)

            if task_data_str:
                task_data: dict[str, Any] = json.loads(task_data_str)
            else:
                logger.warning("Task %s not found, creating minimal task data", task_id)
                task_data = {"stage": stage, "updated_at": update_data["updated_at"]}

            # Обновляем данные
            task_data["stage"] = stage
            task_data["updated_at"] = update_data["updated_at"]
            if "stages" not in task_data:
                task_data["stages"] = {}
            task_data["stages"][stage] = stage_info

            # Сохраняем обратно
            await redis_client.set(task_key, json.dumps(task_data), ex=3600)

            logger.debug("Task %s stage updated to %s", task_id, stage)

        except Exception as e:
            logger.exception("Failed to update task stage: %s", e)
            # ✅ FIX: Не бросаем исключение, чтобы не прерывать pipeline
            logger.warning("Continuing without Redis update for task %s", task_id)

    async def update_task_status(self, task_id: str, status: str, result: dict[str, Any] | None = None) -> None:
        """
        Обновить статус задачи

        Args:
            task_id: ID задачи
            status: Статус (pending, processing, completed, failed)
            result: Результат обработки
        """
        await self.connect()

        update_data = {
            "status": status,
            "updated_at": datetime.now(UTC).isoformat(),
        }

        if result:
            update_data.update(result)

        try:
            # ✅ FIX: Получаем текущие данные, обновляем и сохраняем обратно
            redis_client = self._ensure_redis()
            task_key = f"live_voice:task:{task_id}"
            task_data_str = await redis_client.get(task_key)

            if task_data_str:
                task_data: dict[str, Any] = json.loads(task_data_str)
            else:
                logger.warning("Task %s not found, creating minimal task data", task_id)
                task_data = {"status": status, "updated_at": update_data["updated_at"]}

            # Обновляем данные
            task_data["status"] = status
            task_data["updated_at"] = update_data["updated_at"]
            if result:
                task_data.update(result)

            # Сохраняем обратно
            await redis_client.set(task_key, json.dumps(task_data), ex=3600)

            logger.debug("Task %s status updated to %s", task_id, status)

        except Exception as e:
            logger.exception("Failed to update task status: %s", e)
            # ✅ FIX: Не бросаем исключение, чтобы не прерывать pipeline
            logger.warning("Continuing without Redis update for task %s", task_id)

    async def get_task_status(self, task_id: str) -> dict[str, Any] | None:
        """
        Получить статус задачи

        Args:
            task_id: ID задачи

        Returns:
            Данные задачи или None
        """
        await self.connect()

        try:
            # ✅ FIX: Используем обычный GET вместо JSON.GET
            redis_client = self._ensure_redis()
            result = await redis_client.get(f"live_voice:task:{task_id}")

            if result:
                return json.loads(result)

            return None

        except Exception as e:
            logger.exception("Failed to get task status: %s", e)
            return None

    async def save_to_history(self, user_id: str, task_data: dict[str, Any]) -> None:
        """
        Сохранить задачу в историю пользователя

        Args:
            user_id: ID пользователя
            task_data: Данные задачи
        """
        await self.connect()

        history_entry = {
            "task_id": task_data.get("task_id"),
            "user_text": task_data.get("user_text") or task_data.get("transcription"),
            "ai_response": task_data.get("ai_response") or task_data.get("llm_response"),
            "duration_ms": task_data.get("duration_ms", 0),
            "created_at": datetime.now(UTC).isoformat(),
        }

        try:
            # ✅ FIX: Используем LIST вместо JSON array
            redis_client = self._ensure_redis()
            history_key = f"live_voice:history:{user_id}"
            await redis_client.lpush(history_key, json.dumps(history_entry))
            await redis_client.expire(history_key, 86400)  # 24 часа
            # Ограничиваем размер истории (последние 100 записей)
            await redis_client.ltrim(history_key, 0, 99)

            logger.debug("Task saved to history for user %s", user_id)

        except Exception as e:
            logger.exception("Failed to save to history: %s", e)
            # Не бросаем исключение, так как это не критично

    async def remove_history_entry_by_task_id(self, user_id: str, task_id: str) -> None:
        """Drop cached history rows matching task_id (e.g. after DB delete)."""
        await self.connect()
        try:
            redis_client = self._ensure_redis()
            history_key = f"live_voice:history:{user_id}"
            raw_entries = await redis_client.lrange(history_key, 0, -1)
            if not raw_entries:
                return
            kept: list[str] = []
            for entry in raw_entries:
                try:
                    parsed = json.loads(entry)
                except (TypeError, json.JSONDecodeError):  # fmt: skip
                    kept.append(entry)
                    continue
                if str(parsed.get("task_id") or "") == str(task_id):
                    continue
                kept.append(entry)
            if len(kept) == len(raw_entries):
                return
            await redis_client.delete(history_key)
            for item in reversed(kept):
                await redis_client.lpush(history_key, item)
            if kept:
                await redis_client.expire(history_key, 86400)
            logger.debug("Removed history cache entries for task_id=%s user=%s", task_id, user_id)
        except Exception as e:
            logger.exception("Failed to remove history cache entry: %s", e)

    async def get_user_history(self, user_id: str, limit: int = 20) -> list[dict[str, Any]]:
        """
        Получить историю пользователя

        Args:
            user_id: ID пользователя
            limit: Максимальное количество записей

        Returns:
            Список записей истории
        """
        await self.connect()

        try:
            # ✅ FIX: Используем LRANGE для получения списка
            redis_client = self._ensure_redis()
            history_key = f"live_voice:history:{user_id}"
            history_list = await redis_client.lrange(history_key, 0, limit - 1)

            if history_list:
                # Парсим JSON из каждой записи
                return [json.loads(entry) for entry in history_list]

            return []

        except Exception as e:
            logger.exception("Failed to get user history: %s", e)
            return []

    def _encode_audio(self, audio_data: bytes) -> str:
        """Кодировать аудио в base64"""
        import base64

        return base64.b64encode(audio_data).decode("utf-8")

    def _decode_audio(self, audio_base64: str) -> bytes:
        """Декодировать base64 в аудио"""
        import base64

        return base64.b64decode(audio_base64)


# Singleton instance
_orchestrator: RedisOrchestrator | None = None


async def get_redis_orchestrator() -> RedisOrchestrator:
    """Получить экземпляр RedisOrchestrator"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = RedisOrchestrator()
        await _orchestrator.connect()
    return _orchestrator
