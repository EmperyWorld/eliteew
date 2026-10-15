# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Live Voice WebSocket Router - Real-time voice communication with AI
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Live Voice WebSocket Router - Real-time voice communication with AI

WebSocket endpoint for real-time voice communication with AI.
Supports on/off mode with automatic transition to inactive state.
"""

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

# isort: off
# NOTE: FastAPI is installed in venv, but linter doesn't see it due to configuration
# This is a linter configuration error, not a code error - module is available at runtime
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect  # type: ignore[import-untyped,reportMissingImports]  # pyright: ignore[reportMissingImports]

# NOTE: Module exists, but linter doesn't see it due to Python path configuration
# This is a linter configuration error, not a code error - module is available at runtime
from api.core.database_manager import get_database_manager  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.core.websocket_auth import (  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
    get_ws_auth_close_code,
    validate_websocket_token,
)
from api.services.auth_provider_service import get_auth_provider_service  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.services.live_voice.pipeline_orchestrator import get_pipeline_orchestrator  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.services.live_voice_settings_service import LiveVoiceSettingsService  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.services.voice.stt_service import STTService  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
from api.services.unified_audio_service import get_silero_service  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]

# isort: on

logger = logging.getLogger(__name__)

router = APIRouter()


class LiveVoiceConnection:
    """Управление соединением Live Voice"""

    def __init__(self, websocket: WebSocket, user_id: str, session_id: str):
        self.websocket = websocket
        self.user_id = user_id
        self.session_id = session_id
        self.is_active = False  # Режим on/off
        self.last_activity = datetime.now(UTC)
        self.inactivity_timer: asyncio.Task | None = None
        self.models_loaded = False
        self.settings: dict[str, Any] | None = None
        self.pipeline = get_pipeline_orchestrator()
        self._db_manager = None

    async def _load_settings(self) -> dict[str, Any]:
        """Load user settings from database"""
        if self.settings is not None:
            return self.settings

        try:
            if self._db_manager is None:
                self._db_manager = await get_database_manager()
            async with self._db_manager.get_postgres_session() as db:
                settings = await LiveVoiceSettingsService.get_settings(self.user_id, db)
                if settings is not None:
                    self.settings = settings  # type: ignore[assignment]
                else:
                    self.settings = LiveVoiceSettingsService.get_default_settings().copy()
            logger.info("Loaded user settings: %s", self.settings)
            # Ensure we always return a dict (never None)
            if self.settings is None:
                self.settings = LiveVoiceSettingsService.get_default_settings().copy()
        except (ValueError, RuntimeError, ConnectionError) as e:  # Database/network errors can be various types
            logger.warning("Failed to load settings, using defaults: %s", e)
            self.settings = LiveVoiceSettingsService.get_default_settings().copy()
        return self.settings  # type: ignore[return-value]

    def reload_settings(self) -> None:
        """Invalidate cached settings so next _load_settings() refetches from DB."""
        self.settings = None

    async def set_active(self, *, active: bool) -> None:
        """Установить режим on/off"""
        self.is_active = active
        self.last_activity = datetime.now(UTC)

        if active:
            # Загружаем модели при включении
            await self._load_models()
            # Отменяем таймер неактивности
            if self.inactivity_timer:
                self.inactivity_timer.cancel()
                self.inactivity_timer = None
        else:
            # Выгружаем модели при выключении
            await self._unload_models()
            # Запускаем таймер неактивности (1 минута)
            self._start_inactivity_timer()

    async def _load_models(self) -> None:
        """Pre-load models for instant response. Canonical: whisper-fast (STT), silero (TTS)."""
        if self.models_loaded:
            return

        try:
            logger.info("🔄 Loading models for session %s", self.session_id)

            # Загружаем настройки пользователя
            await self._load_settings()

            # STT: whisper-fast (stack9) only; no local preload
            try:
                stt_health = await STTService.health_check()
                if stt_health.get("status") == "up":
                    logger.info("whisper-fast (stack9) healthy for session %s", self.session_id)
                else:
                    logger.warning(
                        "whisper-fast (stack9) unavailable for session %s: %s",
                        self.session_id,
                        stt_health,
                    )
            except (RuntimeError, OSError) as e:
                logger.warning("whisper-fast health check failed: %s", e)

            # Предзагрузка TTS (URL из generation_providers / env)
            silero_loaded = False
            try:
                from api.services.voice.tts_endpoint_resolver import bind_silero_service_url

                silero_service = get_silero_service()
                endpoint = await bind_silero_service_url(silero_service)
                # ✅ FIX: Увеличиваем таймаут до 90 секунд (модели могут загружаться долго, особенно на GPU)
                try:
                    async with asyncio.timeout(90.0):
                        await silero_service._load_model()  # noqa: SLF001 - Internal API method
                    logger.info("TTS preloaded provider=%s", endpoint.provider_name)
                    silero_loaded = True
                except TimeoutError:
                    logger.exception("TTS model loading timeout (90s) for session %s", self.session_id)
                    # ✅ FIX: Не блокируем сессию при таймауте - модель загрузится при первом использовании
                    await self._send_message(
                        {
                            "type": "error",
                            "message": "Таймаут загрузки TTS. Модель будет загружена при первом использовании. Попробуйте позже.",
                        }
                    )
                    # Продолжаем работу - модель загрузится при первом синтезе
                except (RuntimeError, OSError, MemoryError) as e:  # Model loading can fail with various errors
                    error_msg = str(e).lower()
                    # ✅ FIX: Проверка на OOM (Out of Memory) ошибки
                    if any(
                        keyword in error_msg
                        for keyword in ["out of memory", "oom", "cuda out of memory", "insufficient memory"]
                    ):
                        logger.exception("💥 GPU/RAM Out of Memory while loading TTS model")
                        await self._send_message(
                            {
                                "type": "error",
                                "message": "Недостаточно памяти GPU/RAM для загрузки модели. Попробуйте позже.",
                            }
                        )
                        # Продолжаем работу - модель может загрузиться позже
                    else:
                        logger.warning("TTS preload failed: %s", e)
                        # Продолжаем работу - модель загрузится при первом использовании
            except (RuntimeError, OSError, ImportError) as e:  # Silero loading can fail with various errors
                logger.warning("Silero preload failed: %s", e)
                # Продолжаем работу - модель загрузится при первом использовании

            self.models_loaded = True
            logger.info(
                "✅ Models loaded for session %s (Silero: %s)",
                self.session_id,
                "loaded" if silero_loaded else "will load on first use",
            )

            # ✅ FIX: Информируем о статусе загрузки моделей
            if silero_loaded:
                await self._send_message({"type": "models_ready", "message": "Модели загружены и готовы к общению"})
            else:
                await self._send_message(
                    {
                        "type": "models_ready",
                        "message": "Модели загружены. Silero будет загружен при первом использовании.",
                    }
                )

        except Exception as e:  # Model loading can fail with various error types
            logger.exception("Failed to load models")
            error_msg = str(e).lower()
            # ✅ FIX: Проверка на OOM ошибки в общем обработчике
            if any(
                keyword in error_msg
                for keyword in ["out of memory", "oom", "cuda out of memory", "insufficient memory"]
            ):
                await self._send_message(
                    {"type": "error", "message": "Недостаточно памяти для загрузки моделей. Попробуйте позже."}
                )
            else:
                await self._send_message({"type": "error", "message": f"Ошибка загрузки моделей: {e!s}"})

    async def _unload_models(self) -> None:
        """Выгрузка моделей при выключении"""
        try:
            self.models_loaded = False
            logger.info("📴 Models unloaded for session %s", self.session_id)

        except (RuntimeError, AttributeError) as e:  # Unloading can fail with various errors (non-critical)
            logger.warning("Error unloading models: %s", e)

    def _start_inactivity_timer(self) -> None:
        """Запустить таймер неактивности (1 минута)"""
        if self.inactivity_timer:
            self.inactivity_timer.cancel()

        inactivity_timeout_seconds = 60

        async def _inactivity_check() -> None:
            await asyncio.sleep(inactivity_timeout_seconds)
            if (
                not self.is_active
                and (datetime.now(UTC) - self.last_activity).total_seconds() >= inactivity_timeout_seconds
            ):
                logger.info("Session %s inactive for 1 minute, unloading models", self.session_id)
                await self._unload_models()
                await self._send_message({"type": "inactive", "message": "Режим переведен в неактивное состояние"})

        self.inactivity_timer = asyncio.create_task(_inactivity_check())

    async def _send_message(self, message: dict[str, Any]) -> None:
        """Отправить сообщение клиенту"""
        try:
            # Проверяем состояние WebSocket перед отправкой
            if self.websocket.client_state.value == 3 or self.websocket.application_state.value == 3:  # 3 = CLOSED
                logger.debug("WebSocket already closed, skipping message send")
                return

            await self.websocket.send_json(message)
        except RuntimeError as e:
            # Игнорируем ошибки о закрытом соединении
            error_msg = str(e).lower()
            if "websocket.close" in error_msg or "response already completed" in error_msg:
                logger.debug("WebSocket closed, skipping message send: %s", e)
            else:
                logger.warning("Failed to send WebSocket message: %s", e)
        except (ConnectionError, WebSocketDisconnect) as e:
            logger.debug("WebSocket connection error (expected on disconnect): %s", e)
        except Exception as e:
            logger.warning("Unexpected error sending WebSocket message: %s", e)

    async def process_audio_chunk(self, audio_data: bytes) -> None:
        """Обработать аудио чанк через PipelineOrchestrator"""
        if not self.is_active:
            await self._send_message({"type": "error", "message": "Режим выключен. Включите режим для общения."})
            return

        if not self.models_loaded:
            await self._send_message({"type": "error", "message": "Модели не загружены. Подождите..."})
            return

        try:
            self.last_activity = datetime.now(UTC)

            # Загружаем настройки если еще не загружены
            await self._load_settings()

            # Создаем task_id
            task_id = str(uuid4())

            # Send transcription status
            await self._send_message(
                {"type": "transcribing", "message": "Recognizing speech..."}
            )  # cSpell:ignore Распознаю

            # Используем PipelineOrchestrator для обработки
            result = await self.pipeline.process_audio(
                task_id=task_id,
                user_id=self.user_id,
                audio_data=audio_data,
                settings=self.settings,
                orchestrator=None,  # Redis не обязателен для WebSocket
            )

            # Send transcription
            transcription_text = result.get("transcription", "").strip()
            if transcription_text:
                # Log transcription
                logger.info("💬 AI reads transcription: %s", transcription_text)  # cSpell:ignore читает транскрипцию

                await self._send_message(
                    {
                        "type": "transcription",
                        "text": transcription_text,
                        "timestamp": datetime.now(UTC).isoformat(),
                    }
                )

            # Send generation status
            await self._send_message(
                {"type": "generating", "message": "Generating response..."}
            )  # cSpell:ignore Генерирую

            # Send AI response (from original pipeline)
            ai_response = result.get("ai_response", "").strip()
            if ai_response:
                # Log AI response
                logger.info("AI responds: %s...", ai_response[:200])  # cSpell:ignore отвечает

                await self._send_message(
                    {
                        "type": "response_text",
                        "text": ai_response,
                        "timestamp": datetime.now(UTC).isoformat(),
                    }
                )

            # Send synthesis status
            await self._send_message(
                {"type": "synthesizing", "message": "Synthesizing speech..."}
            )  # cSpell:ignore Синтезирую

            # Send audio (from original pipeline)
            audio_url = result.get("audio_url", "")
            if audio_url:
                # ✅ ЛОГИРУЕМ ОТПРАВКУ: Голосовой ответ отправлен
                logger.info("Голосовой ответ отправлен через WebSocket (audio_url length: %d)", len(audio_url))

                await self._send_message(
                    {
                        "type": "tts_audio",
                        "audio_url": audio_url,
                        "text": ai_response,
                        "duration_ms": result.get("duration_ms", 0),
                        "timestamp": datetime.now(UTC).isoformat(),
                    }
                )
            else:
                await self._send_message({"type": "error", "message": "Failed to synthesize speech"})

        except Exception as e:  # Audio processing can fail with various errors (transcription, LLM, TTS)
            logger.exception("Process audio chunk failed")
            await self._send_message({"type": "error", "message": f"Ошибка обработки: {e!s}"})


# Хранилище активных соединений
_active_connections: dict[str, LiveVoiceConnection] = {}

# ✅ FIX: Лимиты для защиты от перегрузки
MAX_CONNECTIONS = 100  # Максимальное количество одновременных соединений
MAX_CONNECTIONS_PER_USER = 5  # Максимальное количество соединений на пользователя


@router.websocket("/api/v1/live-voice/ws/{session_id}")
async def live_voice_websocket(websocket: WebSocket, session_id: str, token: str | None = Query(None)) -> None:
    """
    WebSocket endpoint для Live Voice

    Поддерживает:
    - Режим on/off (тумблер)
    - Автоматический переход в неактивное состояние через 1 минуту бездействия
    - Предзагрузку моделей при включении режима

    Message Types (Client → Server):
    - {"type": "set_active", "active": true/false} - включить/выключить режим
    - Audio Chunk (binary) - аудио данные для обработки

    Message Types (Server → Client):
    - {"type": "models_ready"} - модели загружены
    - {"type": "transcribing", "message": "..."} - идет транскрибация
    - {"type": "transcription", "text": "...", "timestamp": "..."} - результат транскрибации
    - {"type": "generating", "message": "..."} - идет генерация ответа
    - {"type": "response_text", "text": "...", "timestamp": "..."} - текст ответа
    - {"type": "synthesizing", "message": "..."} - идет синтез речи
    - {"type": "tts_audio", "audio_url": "...", "text": "...", "duration_ms": 123} - аудио ответ
    - {"type": "inactive", "message": "..."} - режим переведен в неактивное состояние
    - {"type": "error", "message": "..."} - ошибка
    """
    await websocket.accept()

    # Получаем пользователя из токена.
    # Предпочтительный путь: первое сообщение {"type":"auth","token":"..."}.
    # Fallback: Bearer Authorization header или legacy query token.
    user_id = None
    auth_token = token
    auth_error_reason = "Authentication required"

    if not auth_token:
        auth_header = websocket.headers.get("authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            auth_token = auth_header[7:].strip()

    if not auth_token:
        try:
            async with asyncio.timeout(10.0):
                first_message = await websocket.receive()
        except TimeoutError:
            await websocket.close(code=1008, reason="Authentication timeout")
            return
        except WebSocketDisconnect:
            return

        if first_message.get("type") == "websocket.disconnect":
            return

        if "text" in first_message:
            try:
                first_payload = json.loads(first_message["text"])
            except json.JSONDecodeError:
                await websocket.close(code=1008, reason="Authentication required")
                return
            if first_payload.get("type") == "auth":
                candidate = first_payload.get("token")
                if isinstance(candidate, str) and candidate.strip():
                    auth_token = candidate.strip()

    if auth_token:
        try:
            auth_provider = get_auth_provider_service()
            auth_user, auth_error_reason = await validate_websocket_token(auth_token, auth_provider)
            if auth_user:
                user_id = auth_user.id
        except (ValueError, KeyError, RuntimeError) as e:  # Token validation can fail with specific errors
            logger.warning("Failed to validate token: %s", e)

    if not user_id:
        await websocket.close(code=get_ws_auth_close_code(), reason=auth_error_reason)
        return

    # ✅ FIX: Проверка лимита соединений
    total_connections = len(_active_connections)
    if total_connections >= MAX_CONNECTIONS:
        logger.warning(
            "⚠️ Max connections limit reached (%d/%d), rejecting connection for session %s",
            total_connections,
            MAX_CONNECTIONS,
            session_id,
        )
        await websocket.close(code=1013, reason="Insufficient resources: Too many connections")
        return

    # ✅ FIX: Проверка лимита соединений на пользователя
    user_connections = sum(1 for conn in _active_connections.values() if conn.user_id == user_id)
    if user_connections >= MAX_CONNECTIONS_PER_USER:
        logger.warning(
            "⚠️ Max connections per user limit reached (%d/%d) for user %s, rejecting connection for session %s",
            user_connections,
            MAX_CONNECTIONS_PER_USER,
            user_id,
            session_id,
        )
        await websocket.close(code=1013, reason="Insufficient resources: Too many connections per user")
        return

    # ✅ FIX: Закрываем старое соединение c тем же session_id, если оно существует
    if session_id in _active_connections:
        old_connection = _active_connections[session_id]
        try:
            await old_connection.websocket.close(code=1000, reason="New connection")
        except (RuntimeError, ConnectionError) as e:  # Closing old connection can fail
            logger.debug("Failed to close old connection: %s", e)
        _active_connections.pop(session_id, None)
        logger.info("🔄 Closed old connection for session %s", session_id)

    connection = LiveVoiceConnection(websocket, user_id, session_id)
    _active_connections[session_id] = connection

    logger.info(
        "🔌 Live Voice WebSocket connected: session_id=%s, user_id=%s, total_connections=%d",
        session_id,
        user_id,
        len(_active_connections),
    )

    try:
        await connection._send_message(  # noqa: SLF001 - Internal method of LiveVoiceConnection
            {
                "type": "connected",
                "message": "WebSocket соединение установлено",
                "session_id": session_id,
            }
        )
        await connection._send_message({"type": "auth_ok"})  # noqa: SLF001 - Internal method

        while True:
            # Получаем сообщение
            try:
                data = await websocket.receive()
            except WebSocketDisconnect:
                break
            except RuntimeError as e:
                # Handle error "Cannot call receive once a disconnect message has been received"
                if "disconnect" in str(e).lower():
                    logger.info("WebSocket disconnected for session %s", session_id)
                    break
                raise

            # Check if this is a disconnect message
            if data.get("type") == "websocket.disconnect":
                logger.info("WebSocket disconnect message received for session %s", session_id)
                break

            # Обрабатываем текстовые сообщения (JSON)
            if "text" in data:
                try:
                    message = json.loads(data["text"])
                    msg_type = message.get("type")

                    if msg_type == "set_active":
                        active = message.get("active", False)
                        await connection.set_active(active=active)
                        await connection._send_message(  # noqa: SLF001 - Internal method of LiveVoiceConnection
                            {
                                "type": "active_state",
                                "active": active,
                                "message": "Режим включен" if active else "Режим выключен",
                            }
                        )
                    elif msg_type == "reload_settings":
                        connection.reload_settings()
                        await connection._send_message(  # noqa: SLF001 - Internal method
                            {"type": "settings_reloaded", "message": "Настройки будут применены к следующему запросу"}
                        )
                    elif msg_type == "auth":
                        # Повторная аутентификация после handshake не требуется.
                        await connection._send_message({"type": "auth_ok"})  # noqa: SLF001 - Internal method
                    elif msg_type == "ping":
                        await connection._send_message({"type": "pong"})  # noqa: SLF001 - Internal method
                    else:
                        await connection._send_message(  # noqa: SLF001 - Internal method
                            {"type": "error", "message": f"Unknown message type: {msg_type}"}
                        )

                except json.JSONDecodeError:
                    await connection._send_message(  # noqa: SLF001 - Internal method
                        {"type": "error", "message": "Invalid JSON message"}
                    )

            # Обрабатываем бинарные данные (аудио)
            elif "bytes" in data:
                audio_data = data["bytes"]
                await connection.process_audio_chunk(audio_data)

    except WebSocketDisconnect:
        logger.info("🔌 Live Voice WebSocket disconnected: session_id=%s", session_id)
    except Exception:  # WebSocket handler can fail with various errors
        logger.exception("WebSocket error")
    finally:
        # Очистка
        _active_connections.pop(session_id, None)
        await connection._unload_models()  # noqa: SLF001 - Internal method of LiveVoiceConnection
        logger.info("🧹 Cleaned up connection: session_id=%s", session_id)
