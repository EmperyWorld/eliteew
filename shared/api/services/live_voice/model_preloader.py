"""
Model Preloader - Pre-load моделей для быстрой обработки (Stack9 policy).

STT = whisper-fast (stack9) only; TTS URL from generation_providers (piper → silero).
"""

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from api.services.llama_service import LlamaService
from api.services.unified_audio_service import get_silero_service
from api.services.voice.stt_service import STTService
from api.services.voice.tts_endpoint_resolver import bind_silero_service_url

logger = logging.getLogger(__name__)

# Таймаут неактивности перед unload (5 минут)
INACTIVITY_TIMEOUT = 300  # секунд


class ModelPreloader:
    """
    Pre-loader моделей для Live Voice

    Управляет жизненным циклом моделей:
    - Pre-load при активации
    - Unload при неактивности
    - Мониторинг использования памяти
    """

    def __init__(self) -> None:
        self._loaded_models: dict[str, Any] = {}
        self._user_sessions: dict[str, datetime] = {}  # user_id -> last_activity
        self._unload_tasks: dict[str, asyncio.Task] = {}

    async def preload_all_models(self, user_id: str, settings: dict[str, Any] | None = None) -> dict[str, bool]:
        """
        Pre-load всех моделей для пользователя

        Args:
            user_id: ID пользователя
            settings: Настройки (whisper_model, llama_model, tts_voice)

        Returns:
            Словарь с результатами загрузки
        """
        from api.utils.llama_models import get_model_or_default

        settings = settings or {}
        requested_llama_model = settings.get("llama_model")
        llama_model = await get_model_or_default(requested_llama_model)
        tts_voice = settings.get("tts_voice", "auto")

        results = {
            "whisper": False,
            "llama": False,
            "tts": False,
        }

        try:
            stt_health = await STTService.health_check()
            results["whisper"] = stt_health.get("status") == "up"
            if results["whisper"]:
                logger.info("whisper-fast (stack9) ready")
            else:
                logger.warning("whisper-fast (stack9) not ready: %s", stt_health.get("error"))
        except Exception:
            logger.exception("whisper-fast health check failed")

        try:
            # Pre-load Llama (warm model)
            logger.info("Pre-loading Llama model: %s", llama_model)
            # Получаем URL из конфигурации (для Docker: http://stack2-llama:11434)
            from api.core.unified_config import unified_settings  # noqa: PLC0415

            llama_url = getattr(unified_settings, "llama_url", "http://stack2-llama:11434")
            async with LlamaService(base_url=llama_url) as llama_service:
                # Отправляем dummy запрос для загрузки модели в память
                await llama_service.chat(
                    messages=[{"role": "user", "content": "Hello"}],
                    model=llama_model,
                    max_tokens=5,
                )
            results["llama"] = True
            logger.info("Llama model '%s' pre-loaded", llama_model)

        except Exception:
            logger.exception("Failed to pre-load Llama")

        try:
            # Pre-load TTS (URL from generation_providers / env fallback)
            silero_service = get_silero_service()
            endpoint = await bind_silero_service_url(silero_service)
            logger.info("Pre-loading TTS (%s) voice: %s", endpoint.provider_name, tts_voice)
            await silero_service._load_model()
            results["tts"] = True
            logger.info("TTS voice pre-loaded provider=%s", endpoint.provider_name)

        except Exception:
            logger.exception("Failed to pre-load TTS")

        # Обновляем активность пользователя
        self._user_sessions[user_id] = datetime.now(UTC)

        # Отменяем задачу unload если она была запланирована
        if user_id in self._unload_tasks:
            self._unload_tasks[user_id].cancel()
            del self._unload_tasks[user_id]

        return results

    async def ensure_models_loaded(self, user_id: str, settings: dict[str, Any] | None = None) -> bool:
        """
        Убедиться что модели загружены

        Args:
            user_id: ID пользователя
            settings: Настройки

        Returns:
            True если модели загружены
        """
        # Проверяем активность
        if user_id in self._user_sessions:
            self._user_sessions[user_id] = datetime.now(UTC)
            return True

        # Если не активны, pre-load
        results = await self.preload_all_models(user_id, settings)
        return all(results.values())

    async def unload_models(self, user_id: str) -> None:
        """
        Unload модели для пользователя (при неактивности)

        Args:
            user_id: ID пользователя
        """
        if user_id not in self._user_sessions:
            return

        logger.info("🔄 Unloading models for user %s (inactivity)", user_id)

        # Удаляем из активных сессий
        del self._user_sessions[user_id]

        # Примечание: Whisper и Llama модели остаются в памяти для других пользователей
        # Полный unload не выполняется, так как модели могут использоваться другими

        logger.info("Models unloaded for user %s", user_id)

    async def schedule_unload(self, user_id: str) -> None:
        """
        Запланировать unload моделей через INACTIVITY_TIMEOUT

        Args:
            user_id: ID пользователя
        """
        if user_id in self._unload_tasks:
            # Отменяем предыдущую задачу
            self._unload_tasks[user_id].cancel()

        async def _unload_after_timeout() -> None:
            await asyncio.sleep(INACTIVITY_TIMEOUT)
            # Проверяем что пользователь все еще неактивен
            if user_id in self._user_sessions:
                last_activity = self._user_sessions[user_id]
                if (datetime.now(UTC) - last_activity).total_seconds() >= INACTIVITY_TIMEOUT:
                    await self.unload_models(user_id)

        self._unload_tasks[user_id] = asyncio.create_task(_unload_after_timeout())

    async def get_model_status(self, user_id: str) -> dict[str, Any]:
        """
        Получить статус моделей для пользователя (STT = whisper-fast stack9).
        """
        is_active = user_id in self._user_sessions
        last_activity_dt = self._user_sessions.get(user_id) if is_active else None

        whisper_loaded = False
        whisper_models: list[str] = []
        try:
            stt_health = await STTService.health_check()
            if stt_health.get("status") == "up":
                whisper_loaded = True
                whisper_models = ["whisper-fast (stack9)"]
        except Exception as exc:  # noqa: BLE001 — STT health is informational for preload status
            logger.debug(
                "Live voice STT health probe skipped user_id=%s err=%s",
                user_id,
                exc,
                exc_info=True,
            )

        return {
            "user_id": user_id,
            "is_active": is_active,
            "last_activity": (last_activity_dt.isoformat() if last_activity_dt is not None else None),
            "whisper_loaded": whisper_loaded,
            "whisper_models": whisper_models,
            "llama_ready": True,
            "tts_ready": True,
        }


# Singleton instance
_preloader: ModelPreloader | None = None


def get_model_preloader() -> ModelPreloader:
    """Получить экземпляр ModelPreloader"""
    global _preloader
    if _preloader is None:
        _preloader = ModelPreloader()
    return _preloader
