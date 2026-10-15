# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Оркестрация live voice: STT → LLM → TTS и координация шагов пайплайна внутри задачи.
# Invariants:
# - Логи не должны ломать handlers: payload LLM — только через безопасную строковую сериализацию.
# - Лимит LLM для голоса: env ``LIVE_VOICE_LLM_MAX_TOKENS`` (default 2048); длинный ответ режется перед TTS.
# Related:
# - api/services/live_voice/live_voice_service.py, api/routers/voice_gateway.py
# ---
"""Pipeline Orchestrator — обработка аудио: STT → LLM → TTS."""

import base64
import json
import logging
import os
import time
from datetime import UTC, datetime
from typing import Any

from api.core.voice_provider_contract import CANONICAL_TTS_PROVIDER_ID
from api.services.live_voice_settings_service import LiveVoiceSettingsService, resolve_enable_arlekina
from api.services.llama_service import LlamaService
from api.services.unified_audio_service import get_silero_service
from api.services.voice.stt_service import STTService
from api.services.voice.tts_endpoint_resolver import bind_silero_service_url

from .redis_orchestrator import get_redis_orchestrator

logger = logging.getLogger(__name__)


def _preview_llm_result_for_log(obj: object, *, max_chars: int = 2000) -> str:
    """Serialize LLM result for logging without %-format surprises (dict/tuple edge cases)."""
    try:
        if isinstance(obj, dict):
            return json.dumps(obj, ensure_ascii=False, default=str)[:max_chars]
        return str(obj)[:max_chars]
    except Exception:
        return "<unprintable>"


class PipelineOrchestrator:
    """
    Оркестратор pipeline обработки

    Управляет последовательной обработкой:
    1. Transcription (Whisper)
    2. LLM Generation (Llama)
    3. TTS Synthesis (Kokoro/Silero)
    4. Response
    """

    def __init__(self) -> None:
        # LlamaService будет использоваться через async context manager
        pass

    async def process_audio(
        self,
        task_id: str,
        user_id: str,
        audio_data: bytes,
        settings: dict[str, Any] | None = None,
        orchestrator: Any | None = None,
    ) -> dict[str, Any]:
        """
        Обработать аудио через полный pipeline

        Args:
            task_id: ID задачи
            user_id: ID пользователя
            audio_data: Аудио данные
            settings: Настройки обработки

        Returns:
            Результат обработки
        """
        settings = settings or {}
        start_time = time.time()

        # Получаем orchestrator если не передан
        if orchestrator is None:
            try:
                orchestrator = await get_redis_orchestrator()
            except Exception as e:
                logger.warning("Redis orchestrator unavailable: %s, continuing without Redis", e)
                orchestrator = None

        # Вспомогательная функция для безопасного обновления статуса
        async def safe_update_stage(stage: str, data: dict) -> None:
            if orchestrator:
                try:
                    await orchestrator.update_task_stage(task_id, stage, data)
                except Exception as e:
                    logger.warning("Failed to update stage %s in Redis: %s", stage, e)

        try:
            # Этап 1: Транскрибация
            await safe_update_stage("transcription", {"started": datetime.now(UTC).isoformat()})

            language = settings.get("language", "ru")
            transcription_language = language if language and language not in ("", "auto") else "ru"
            logger.info(
                "[STEP] live_voice transcription start task_id=%s language=%s",
                task_id,
                transcription_language,
                extra={
                    "stage": "live_voice_transcription",
                    "task_id": task_id,
                    "language": transcription_language,
                },
            )

            stt_result = await STTService.transcribe(audio_data, language=transcription_language or None)

            transcription_text = stt_result.get("text", "").strip()
            stt_duration_ms = stt_result.get("duration_ms")
            if isinstance(stt_duration_ms, int):
                transcription_duration = stt_duration_ms / 1000.0
            else:
                transcription_duration = time.time() - start_time

            if not transcription_text:
                msg = (
                    "Система не смогла распознать речь. Попробуйте говорить чуть громче или дольше и повторите попытку."
                )
                raise ValueError(msg)

            # Ограничиваем длину транскрипции для LLM (чтобы не генерировать слишком длинные ответы)
            original_transcription_length = len(transcription_text)
            if len(transcription_text) > 500:
                transcription_text = transcription_text[:500]
                logger.warning(
                    f"⚠️ Transcription truncated to 500 chars for LLM input (was {original_transcription_length})"
                )

            await safe_update_stage(
                "transcription",
                {
                    "completed": datetime.now(UTC).isoformat(),
                    "duration_ms": int(transcription_duration * 1000),
                    "text": transcription_text,
                },
            )

            preview = transcription_text[:200] + ("..." if len(transcription_text) > 200 else "")
            logger.info(
                "[STEP] live_voice transcription done task_id=%s chars=%s duration_s=%.2f truncated_from=%s preview=%r",
                task_id,
                len(transcription_text),
                transcription_duration,
                original_transcription_length,
                preview,
                extra={
                    "stage": "live_voice_transcription",
                    "task_id": task_id,
                    "chars": len(transcription_text),
                    "duration_ms": int(transcription_duration * 1000),
                },
            )

            # Этап 2: Генерация ответа через Llama
            await safe_update_stage("llm", {"started": datetime.now(UTC).isoformat()})

            from api.utils.llama_models import get_model_or_default

            requested_model = settings.get("llama_model")
            llama_model = await get_model_or_default(requested_model)

            # Single source of truth with LiveVoiceSettingsService.system_prompt_for_settings (same rules).
            use_arlekina = resolve_enable_arlekina(settings)
            system_prompt = (
                LiveVoiceSettingsService.ARLEKINA_SYSTEM_PROMPT
                if use_arlekina
                else LiveVoiceSettingsService.DEFAULT_ASSISTANT_PROMPT
            )
            logger.info(
                "[STEP] live_voice llm chat_start task_id=%s persona=%s model=%s",
                task_id,
                "arlekina" if use_arlekina else "default_assistant",
                llama_model,
                extra={
                    "stage": "live_voice_llm",
                    "task_id": task_id,
                    "persona": "arlekina" if use_arlekina else "default_assistant",
                    "llama_model": llama_model,
                },
            )

            llm_start = time.time()
            # Используем async context manager для LlamaService
            from api.core.unified_config import unified_settings  # noqa: PLC0415

            llama_url = (
                (os.environ.get("LLAMA_BASE_URL") or getattr(unified_settings, "llama_url", None) or "")
                .strip()
                .rstrip("/")
            )
            # Лимит токенов: слишком низкий max_tokens даёт finish_reason=length с пустым content на некоторых GGUF;
            # итог для TTS всё равно режем ниже (~2000 символов).
            max_tokens_lv = int(os.environ.get("LIVE_VOICE_LLM_MAX_TOKENS", "2048"))
            async with LlamaService(base_url=llama_url) as llama_service:
                llm_result = await llama_service.chat(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": transcription_text},
                    ],
                    model=llama_model,
                    temperature=0.7,
                    max_tokens=max_tokens_lv,
                    stream=False,
                )

            ai_response = llm_result.get("text", "") if llm_result else ""
            llm_error = llm_result.get("error") if isinstance(llm_result, dict) else None
            fr = str(llm_result.get("finish_reason") or "").lower() if isinstance(llm_result, dict) else ""
            llm_duration = time.time() - llm_start

            # Проверяем наличие ошибки в результате
            if llm_error:
                logger.error(
                    "❌ LLM вернул ошибку: %s. Model: %s, Result: %s",
                    llm_error,
                    llama_model,
                    _preview_llm_result_for_log(llm_result),
                )
                msg = f"Ошибка LLM: {llm_error}. Модель '{llama_model}' может быть недоступна."
                raise ValueError(msg)

            if not ai_response and fr == "length":
                retry_cap = min(8192, max(max_tokens_lv * 2, 4096))
                logger.warning(
                    "[STEP] live_voice llm empty finish_reason=length; retry task_id=%s max_tokens=%s",
                    task_id,
                    retry_cap,
                )
                async with LlamaService(base_url=llama_url) as llama_service:
                    llm_result = await llama_service.chat(
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": transcription_text},
                        ],
                        model=llama_model,
                        temperature=0.7,
                        max_tokens=retry_cap,
                        stream=False,
                    )
                ai_response = llm_result.get("text", "") if llm_result else ""
                llm_error = llm_result.get("error") if isinstance(llm_result, dict) else None
                llm_duration = time.time() - llm_start
                if llm_error:
                    logger.error(
                        "❌ LLM вернул ошибку (retry): %s. Model: %s, Result: %s",
                        llm_error,
                        llama_model,
                        _preview_llm_result_for_log(llm_result),
                    )
                    msg = f"Ошибка LLM: {llm_error}. Модель '{llama_model}' может быть недоступна."
                    raise ValueError(msg)

            if not ai_response:
                logger.error("LLM не вернул ответ. Result: %s", _preview_llm_result_for_log(llm_result))
                msg = f"LLM не вернул ответ. Модель: {llama_model}"
                raise ValueError(msg)

            logger.info(
                "[STEP] live_voice llm chat_done task_id=%s response_chars=%s duration_s=%.2f",
                task_id,
                len(ai_response),
                llm_duration,
                extra={
                    "stage": "live_voice_llm",
                    "task_id": task_id,
                    "response_chars": len(ai_response),
                    "duration_ms": int(llm_duration * 1000),
                },
            )

            # ✅ FIX: Silero поддерживает до 250 символов на чанк, но мы разбиваем длинные тексты
            # Ограничиваем общую длину до 2000 символов для разумного времени генерации
            original_llm_length = len(ai_response)
            if len(ai_response) > 2000:
                truncated = ai_response[:2000]
                # Пытаемся найти последнее предложение
                last_sentence = max(
                    truncated.rfind("."),
                    truncated.rfind("!"),
                    truncated.rfind("?"),
                    truncated.rfind("\n"),
                )
                if last_sentence > 1500:  # Если нашли в последних 25% (2000 * 0.75 = 1500)
                    ai_response = truncated[: last_sentence + 1]
                    logger.info(
                        f"⚠️ LLM response truncated to {len(ai_response)} chars for TTS (was {original_llm_length})"
                    )
                else:
                    ai_response = truncated
                    logger.warning(
                        f"⚠️ LLM response hard-truncated to 2000 chars (no sentence boundary found, was {original_llm_length})"
                    )

            await safe_update_stage(
                "llm",
                {
                    "completed": datetime.now(UTC).isoformat(),
                    "duration_ms": int(llm_duration * 1000),
                    "text": ai_response,
                },
            )

            # Этап 3: Синтез речи
            await safe_update_stage("tts", {"started": datetime.now(UTC).isoformat()})

            logger.info("🔊 Starting TTS synthesis for task %s", task_id)
            tts_voice = settings.get("tts_voice", "auto")
            # Normalized: backend and API use tts_speed/tts_volume; accept speed/volume as alias
            tts_speed = (
                settings.get("tts_speed") if settings.get("tts_speed") is not None else settings.get("speed", 1.0)
            )
            tts_speed = float(tts_speed) if tts_speed is not None else 1.0

            # Определяем язык для выбора TTS (по умолчанию русский)
            tts_language = settings.get("language", "ru")
            if tts_language == "auto":
                # Простое определение языка по символам
                if any(
                    char in ai_response for char in "абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
                ):
                    tts_language = "ru"
                else:
                    tts_language = "en"

            logger.info("🔊 Starting TTS for language: %s, voice: %s", tts_language, tts_voice)
            tts_start = time.time()

            # Graceful degradation: если TTS недоступен, продолжаем без аудио.
            audio_data_result: bytes | None = None
            try:
                if tts_language == "ru":
                    # Stack9 policy: shared Silero-compatible HTTP client; URL from generation_providers.
                    logger.info("Using voice TTS HTTP client for Russian (DB/env resolved)")
                    silero_service = get_silero_service()
                    await bind_silero_service_url(silero_service)

                    # Маппинг старых voice aliases на актуальные голоса Silero.
                    silero_voice_map = {
                        "ru_natalia": "xenia",
                        "ru_dmitry": "eugene",
                        "ru_anna": "baya",
                        "ru_alexey": "aidar",
                        "xenia": "xenia",
                        "baya": "baya",
                        "eugene": "eugene",
                        "aidar": "aidar",
                    }

                    # Определяем голос (по умолчанию xenia).
                    if tts_voice == "auto" or not tts_voice or tts_voice not in silero_voice_map:
                        silero_voice = "xenia"
                    else:
                        silero_voice = silero_voice_map.get(tts_voice, "xenia")

                    # Обработка длинных текстов: разбиваем на части и склеиваем
                    max_chunk_length = 250  # Безопасная длина для Silero
                    if len(ai_response) > max_chunk_length:
                        logger.info(f"Text too long ({len(ai_response)} chars), splitting into chunks")
                        # Разбиваем по предложениям
                        sentences = []
                        current_sentence = ""
                        for char in ai_response:
                            current_sentence += char
                            if char in ".!?\n" and len(current_sentence.strip()) > 10:
                                sentences.append(current_sentence.strip())
                                current_sentence = ""
                        if current_sentence.strip():
                            sentences.append(current_sentence.strip())

                        # Группируем предложения в чанки
                        chunks = []
                        current_chunk = ""
                        for sentence in sentences:
                            if len(current_chunk) + len(sentence) + 1 <= max_chunk_length:
                                current_chunk += (" " if current_chunk else "") + sentence
                            else:
                                if current_chunk:
                                    chunks.append(current_chunk)
                                current_chunk = sentence
                        if current_chunk:
                            chunks.append(current_chunk)

                        # Синтезируем каждый чанк и склеиваем
                        audio_chunks = []
                        for i, chunk in enumerate(chunks):
                            logger.info(f"Synthesizing chunk {i + 1}/{len(chunks)}: {len(chunk)} chars")
                            chunk_audio = await silero_service.synthesize(
                                text=chunk, voice=silero_voice, speed=tts_speed
                            )
                            audio_chunks.append(chunk_audio)

                        # Склеиваем аудио чанки через science sidecar (scipy float WAV) с stdlib fallback.
                        from api.services.science_stack.science_client import request_merge_wav_chunks
                        from api.utils.wav_merge import merge_wav_int16_chunks

                        audio_data_result = await request_merge_wav_chunks(audio_chunks)
                        if audio_data_result is None:
                            logger.warning(
                                "[STEP] live_voice_wav_merge_sidecar_skip — falling back to stdlib int16 merge"
                            )
                            audio_data_result = merge_wav_int16_chunks(audio_chunks)

                        logger.info(
                            f"✅ Silero TTS completed (chunked): {len(audio_data_result)} bytes from {len(chunks)} chunks"
                        )
                    else:
                        # Короткий текст - синтезируем напрямую
                        audio_data_result = await silero_service.synthesize(
                            text=ai_response, voice=silero_voice, speed=tts_speed
                        )
                        logger.info(
                            f"✅ Silero TTS completed: {len(audio_data_result) if audio_data_result else 0} bytes"
                        )
                else:
                    # Stack9 policy: shared TTS HTTP client for all languages (MVP).
                    logger.info(
                        "🎙️ Using voice TTS HTTP client for non-RU (stack9 policy: %s label retained)",
                        CANONICAL_TTS_PROVIDER_ID,
                    )
                    silero_service = get_silero_service()
                    await bind_silero_service_url(silero_service)
                    silero_voice = (tts_voice and tts_voice.strip()) or "xenia"
                    audio_data_result = await silero_service.synthesize(
                        text=ai_response, voice=silero_voice, speed=tts_speed
                    )
                    logger.info(
                        "✅ Silero TTS completed: %s bytes",
                        len(audio_data_result) if audio_data_result else 0,
                    )
            except Exception as e:
                logger.warning(
                    "TTS synthesis failed (Silero unavailable), continuing without audio: %s",
                    e,
                    extra={
                        "stage": "tts",
                        "provider": "silero",
                        "error": str(e),
                        "graceful": True,
                    },
                )
                logger.debug("TTS error details:", exc_info=True)
                audio_data_result = None

            tts_duration = time.time() - tts_start

            # ✅ FIX: Не падаем если TTS не вернул аудио - просто продолжаем без audio_url
            audio_url: str | None = None
            if not audio_data_result:
                logger.warning("TTS не вернул аудио данные - возвращаем результат без audio_url")
            else:
                logger.info(
                    f"📦 Audio data type: {type(audio_data_result)}, length: {len(audio_data_result) if hasattr(audio_data_result, '__len__') else 'N/A'}"
                )

                # Конвертируем в base64 для передачи
                try:
                    # Убеждаемся, что это bytes
                    if isinstance(audio_data_result, str):
                        audio_bytes = audio_data_result.encode("utf-8")
                    elif isinstance(audio_data_result, bytes):
                        audio_bytes = audio_data_result
                    else:
                        audio_bytes = bytes(audio_data_result)

                    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
                    audio_url = f"data:audio/wav;base64,{audio_base64}"
                    logger.info("Audio converted to base64: %s chars", len(audio_base64))
                except Exception:
                    logger.exception("Failed to convert audio to base64")
                    audio_url = None  # Продолжаем без аудио

            await safe_update_stage(
                "tts",
                {
                    "completed": datetime.now(UTC).isoformat(),
                    "duration_ms": int(tts_duration * 1000),
                    "audio_url": audio_url,  # Может быть None
                },
            )

            if audio_data_result:
                logger.info(f"TTS synthesis completed: {len(audio_data_result)} bytes in {tts_duration:.2f}s")
            else:
                logger.info("TTS synthesis skipped (service unavailable) - text-only response")

            # Общий результат
            total_duration = time.time() - start_time

            result = {
                "task_id": task_id,
                "transcription": transcription_text,
                "ai_response": ai_response,
                "audio_url": audio_url,  # Может быть None если TTS недоступен
                "duration_ms": int(total_duration * 1000),
                "stages": {
                    "transcription": {"duration_ms": int(transcription_duration * 1000)},
                    "llm": {"duration_ms": int(llm_duration * 1000)},
                    "tts": {"duration_ms": int(tts_duration * 1000)},
                },
            }

            # Обновляем статус задачи (если Redis доступен)
            if orchestrator:
                try:
                    await orchestrator.update_task_status(task_id, "completed", result)
                    await orchestrator.save_to_history(
                        user_id,
                        {
                            "task_id": task_id,
                            "transcription": transcription_text,
                            "llm_response": ai_response,
                            "duration_ms": int(total_duration * 1000),
                        },
                    )
                except Exception as e:
                    logger.warning("Failed to save to Redis history: %s", e)

            logger.info(
                "Voice pipeline completed",
                extra={
                    "stage": "voice_pipeline",
                    "task_id": task_id,
                    "user_id": user_id,
                    "duration_ms": int(total_duration * 1000),
                    "stages": result["stages"],
                },
            )

            return result

        except Exception as e:
            logger.exception(
                "Voice pipeline failed for task %s: %s",
                task_id,
                e,
                extra={
                    "stage": "pipeline_fail",
                    "task_id": task_id,
                    "user_id": user_id,
                    "error": str(e),
                },
            )

            # Обновляем статус ошибки (если Redis доступен)
            if orchestrator:
                try:
                    await orchestrator.update_task_status(task_id, "failed", {"error": str(e)})
                except Exception as e2:
                    logger.warning("Failed to update error status in Redis: %s", e2)

            raise


# Singleton instance
_orchestrator: PipelineOrchestrator | None = None


def get_pipeline_orchestrator() -> PipelineOrchestrator:
    """Получить экземпляр PipelineOrchestrator"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = PipelineOrchestrator()
    return _orchestrator
