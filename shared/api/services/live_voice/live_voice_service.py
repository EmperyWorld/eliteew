"""
Live Voice Service - Главный сервис оркестрации

Объединяет все компоненты для обработки голосовых запросов
"""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from .conversation_storage import ConversationStorage
from .model_preloader import get_model_preloader
from .pipeline_orchestrator import get_pipeline_orchestrator
from .redis_orchestrator import get_redis_orchestrator

logger = logging.getLogger(__name__)


class LiveVoiceService:
    """
    Главный сервис для Live Voice

    Управляет:
    - Pre-loading моделей
    - Создание задач
    - Pipeline обработки
    - Сохранение истории
    """

    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.conversation_storage = ConversationStorage(db_session)

    async def start_session(self, user_id: str, settings: dict[str, Any] | None = None) -> dict[str, Any]:
        """
        Начать сессию (pre-load модели)

        Args:
            user_id: ID пользователя
            settings: Настройки

        Returns:
            Статус сессии
        """
        try:
            preloader = get_model_preloader()
            results = await preloader.preload_all_models(user_id, settings)

            return {
                "success": True,
                "user_id": user_id,
                "models_loaded": results,
                "message": "Сессия начата, модели загружены",
            }

        except Exception as e:
            logger.exception("Failed to start session")
            return {"success": False, "error": str(e)}

    async def process_audio(
        self, user_id: str, audio_data: bytes, settings: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """
        Обработать аудио через полный pipeline

        Args:
            user_id: ID пользователя
            audio_data: Аудио данные
            settings: Настройки обработки

        Returns:
            Результат обработки
        """
        try:
            logger.info("🎤 Starting audio processing for user %s", user_id)

            # Получаем orchestrator и pipeline
            try:
                orchestrator = await get_redis_orchestrator()
                logger.info("Redis orchestrator connected")
            except Exception:
                logger.exception("Failed to connect to Redis")
                # Продолжаем без Redis - создаем task_id локально
                import uuid

                task_id = str(uuid.uuid4())
                logger.warning("Using local task_id (no Redis): %s", task_id)
                orchestrator = None

            pipeline = get_pipeline_orchestrator()

            # Создаем задачу (если Redis доступен)
            if orchestrator:
                try:
                    task_id = await orchestrator.create_task(user_id, audio_data, settings)
                    logger.info("Task created in Redis: %s", task_id)
                except Exception as e:
                    logger.warning("Failed to create task in Redis: %s, using local task_id", e)
                    import uuid

                    task_id = str(uuid.uuid4())
            else:
                import uuid

                task_id = str(uuid.uuid4())

            # Запускаем обработку
            result = await pipeline.process_audio(task_id, user_id, audio_data, settings, orchestrator)
            logger.info(f"Pipeline completed for task {task_id}")

            # Сохранить в историю разговоров для отображения в ConversationHistory
            transcription_text = result.get("transcription") or ""
            ai_response = result.get("ai_response") or ""
            if transcription_text or ai_response:
                try:
                    stages = result.get("stages") or {}
                    trans_ms = 0
                    if isinstance(stages.get("transcription"), dict) and "duration_ms" in stages["transcription"]:
                        trans_ms = int(stages["transcription"]["duration_ms"])
                    await self.conversation_storage.save_conversation(
                        user_id=user_id,
                        task_id=task_id,
                        user_text=transcription_text,
                        ai_response=ai_response,
                        audio_user_url=None,
                        audio_ai_url=result.get("audio_url"),
                        duration_ms=trans_ms,
                    )
                except Exception as save_err:
                    logger.warning("Failed to save conversation to history: %s", save_err)

            return result

        except Exception:
            logger.exception("Failed to process audio")
            raise

    async def get_task_status(self, task_id: str) -> dict[str, Any] | None:
        """
        Получить статус задачи

        Args:
            task_id: ID задачи

        Returns:
            Статус задачи
        """
        orchestrator = await get_redis_orchestrator()
        return await orchestrator.get_task_status(task_id)

    async def get_conversation_history(self, user_id: str, limit: int = 20, offset: int = 0) -> list[dict[str, Any]]:
        """
        Получить историю разговоров

        Args:
            user_id: ID пользователя
            limit: Максимальное количество
            offset: Смещение

        Returns:
            Список разговоров
        """
        return await self.conversation_storage.get_conversations(user_id, limit, offset)

    async def search_history(self, user_id: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
        """
        Поиск по истории

        Args:
            user_id: ID пользователя
            query: Поисковый запрос
            limit: Максимальное количество результатов

        Returns:
            Список найденных разговоров
        """
        return await self.conversation_storage.search_conversations(user_id, query, limit)

    async def stop_session(self, user_id: str) -> None:
        """
        Остановить сессию (unload модели)

        Args:
            user_id: ID пользователя
        """
        try:
            preloader = get_model_preloader()
            await preloader.unload_models(user_id)

            logger.info(f"Session stopped for user {user_id}")

        except Exception:
            logger.exception("Failed to stop session")
