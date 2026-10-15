"""
Unified Voice Gateway Service (Stack9 only).

Canonical STT: whisper-fast.
TTS HTTP URL: generation_providers (piper → silero) via tts_endpoint_resolver;
SILERO_SERVICE_URL is emergency env fallback only.
Uses existing STTService and SileroService; enforces provider contract.
Reuses live voice pipeline for full session flow (transcribe -> LLM -> TTS).

Voice for chat/real-time MUST use this service (synthesize_speech, transcribe_audio),
not UGS — routing voice through UGS is slow; keep direct gateway only.
"""

import logging
import time
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from api.core.voice_provider_contract import normalize_tts_provider
from api.services.qwen3_tts_voices import qwen3_tts_default_profile
from api.services.unified_audio_service import get_silero_service
from api.services.voice.stt_service import STTService
from api.services.voice.tts_endpoint_resolver import bind_silero_service_url

logger = logging.getLogger(__name__)


async def transcribe_audio(
    audio_data: bytes,
    *,
    language: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """
    Transcribe audio via canonical STT (whisper-fast). Returns dict with text, language, segments, etc.
    """
    start = time.perf_counter()
    try:
        result = await STTService.transcribe(audio_data, language=language)
        if not isinstance(result, dict):
            raise RuntimeError("STT returned invalid response")
        duration_ms = int((time.perf_counter() - start) * 1000)
        logger.debug(
            "Voice STT completed",
            extra={
                "stage": "stt",
                "duration_ms": duration_ms,
                "provider": "whisper-fast",
                "audio_bytes": len(audio_data),
            },
        )
        return result
    except Exception as e:
        duration_ms = int((time.perf_counter() - start) * 1000)
        logger.error(
            "Voice STT failed: %s",
            e,
            extra={"stage": "stt", "duration_ms": duration_ms, "provider": "whisper-fast", "error": str(e)},
        )
        raise


async def synthesize_speech(
    text: str,
    *,
    voice: str | None = None,
    speed: float = 1.0,
    volume: float = 1.0,
    provider: str | None = None,
    db_session: AsyncSession | None = None,
) -> bytes:
    """
    Synthesize speech via shared TTS HTTP client.
    URL from generation_providers (piper → silero) or SILERO_SERVICE_URL fallback.
    """
    _ = normalize_tts_provider(provider)
    start = time.perf_counter()
    voice_id = voice or qwen3_tts_default_profile()
    try:
        service = get_silero_service()
        endpoint = await bind_silero_service_url(service, db=db_session)
        out = await service.synthesize(
            text=text,
            voice=voice_id,
            speed=speed,
        )
        duration_ms = int((time.perf_counter() - start) * 1000)
        logger.info(
            "Voice TTS completed",
            extra={
                "stage": "tts",
                "duration_ms": duration_ms,
                "provider": endpoint.provider_name,
                "voice": voice_id,
                "text_chars": len(text),
            },
        )
        return out
    except Exception as e:
        duration_ms = int((time.perf_counter() - start) * 1000)
        logger.error(
            "Voice TTS failed: %s",
            e,
            extra={"stage": "tts", "duration_ms": duration_ms, "provider": "voice_tts", "error": str(e)},
        )
        raise


async def get_available_voices(*, db_session: AsyncSession | None = None) -> list[dict[str, Any]]:
    """Return list of available voices from the resolved TTS endpoint."""
    service = get_silero_service()
    await bind_silero_service_url(service, db=db_session)
    return await service.get_available_voices()


async def check_health(*, db_session: AsyncSession | None = None) -> dict[str, Any]:
    """Check gateway health (STT and TTS backends)."""
    from api.services.voice.stt_service import STTService as STT

    stt_health = await STT.health_check()
    silero = get_silero_service()
    endpoint = await bind_silero_service_url(silero, db=db_session)
    tts_ok = bool((silero.service_url or "").strip())
    tts_reachable = await silero.health_check() if tts_ok else False
    return {
        "status": "up" if stt_health.get("status") == "up" and tts_ok and tts_reachable else "degraded",
        "stt": stt_health,
        "tts": {
            "provider": endpoint.provider_name,
            "configured": tts_ok,
            "reachable": tts_reachable,
            "base_url": endpoint.base_url or None,
            "source": endpoint.source,
        },
    }


async def process_audio_session(
    user_id: str,
    audio_data: bytes,
    settings: dict[str, Any] | None,
    db_session: AsyncSession,
) -> dict[str, Any]:
    """
    Run full voice pipeline (transcribe -> LLM -> TTS). Reuses live voice pipeline logic.
    """
    from api.services.live_voice.live_voice_service import LiveVoiceService

    service = LiveVoiceService(db_session)
    return await service.process_audio(user_id=user_id, audio_data=audio_data, settings=settings)


async def process_text_to_speech(
    user_id: str,
    text: str,
    settings: dict[str, Any] | None,
    db_session: AsyncSession,
) -> dict[str, Any]:
    """
    Text -> LLM -> TTS (silero only). Unified path for text-to-voice; replaces legacy trash service.
    Returns dict with success, user_text, ai_response, audio_url, audio_base64, duration_ms, stages, language, voice.
    """
    import base64
    import time

    from api.services.live_voice_settings_service import (
        LiveVoiceSettingsService,
        resolve_enable_arlekina,
    )
    from api.services.llama_service import LlamaService
    from api.utils.llama_models import get_model_or_default

    settings = settings or {}
    start_time = time.time()
    stages: dict[str, Any] = {}

    # Persona from settings (merge with DB if needed)
    persisted = await LiveVoiceSettingsService.get_settings(user_id, db_session)
    merged = {**persisted, **settings}
    use_arlekina = resolve_enable_arlekina(merged)
    system_prompt = LiveVoiceSettingsService.system_prompt_for_settings(merged)
    logger.debug(
        "Voice gateway process_text_to_speech: resolved enable_arlekina for system prompt",
        extra={
            "stage": "voice_persona",
            "user_id": user_id,
            "enable_arlekina": use_arlekina,
        },
    )

    # LLM
    requested_model = merged.get("llama_model")
    llama_model = await get_model_or_default(requested_model)
    temperature = float(merged.get("temperature", 0.7))
    max_tokens = int(merged.get("max_tokens", 500))
    import os

    from api.core.unified_config import unified_settings  # noqa: PLC0415

    llama_url = (
        (os.environ.get("LLAMA_BASE_URL") or getattr(unified_settings, "llama_url", None) or "").strip().rstrip("/")
    )
    llm_start = time.time()
    async with LlamaService(base_url=llama_url) as llama_service:
        llm_result = await llama_service.chat(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            model=llama_model,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
        )
    ai_response = (llm_result or {}).get("text", "").strip()
    if not ai_response:
        logger.error(
            "Voice text-to-speech LLM returned empty",
            extra={"stage": "llm", "user_id": user_id, "provider": "llama"},
        )
        raise ValueError("LLM не вернул ответ")
    if len(ai_response) > 2000:
        ai_response = ai_response[:2000].rsplit(".", 1)[0] + "." if "." in ai_response[:2000] else ai_response[:2000]
    stages["llm"] = {"duration_ms": int((time.time() - llm_start) * 1000)}

    # TTS — URL from generation_providers (piper → silero) / env fallback
    tts_start = time.time()
    tts_speed_val = merged.get("tts_speed")
    if tts_speed_val is None:
        tts_speed_val = merged.get("speed", 1.0)
    tts_speed_val = float(tts_speed_val) if tts_speed_val is not None else 1.0
    default_voice = qwen3_tts_default_profile()
    tts_voice = (merged.get("tts_voice") or default_voice).strip() or default_voice
    silero = get_silero_service()
    await bind_silero_service_url(silero, db=db_session)
    max_chunk = 250
    if len(ai_response) <= max_chunk:
        audio_data = await silero.synthesize(text=ai_response, voice=tts_voice, speed=tts_speed_val)
    else:
        # Chunk by sentences
        sentences: list[str] = []
        cur = ""
        for c in ai_response:
            cur += c
            if c in ".!?\n" and len(cur.strip()) > 10:
                sentences.append(cur.strip())
                cur = ""
        if cur.strip():
            sentences.append(cur.strip())
        chunks: list[str] = []
        cur_chunk = ""
        for s in sentences:
            if len(cur_chunk) + len(s) + 1 <= max_chunk:
                cur_chunk += (" " if cur_chunk else "") + s
            else:
                if cur_chunk:
                    chunks.append(cur_chunk)
                cur_chunk = s
        if cur_chunk:
            chunks.append(cur_chunk)
        from api.utils.wav_merge import merge_wav_int16_chunks

        audio_chunks_list: list[bytes] = []
        for ch in chunks:
            audio_chunks_list.append(await silero.synthesize(text=ch, voice=tts_voice, speed=tts_speed_val))
        audio_data = merge_wav_int16_chunks(audio_chunks_list)
    stages["tts"] = {"duration_ms": int((time.time() - tts_start) * 1000)}

    total_ms = int((time.time() - start_time) * 1000)
    logger.info(
        "Voice process_text_to_speech completed",
        extra={
            "stage": "voice_pipeline",
            "duration_ms": total_ms,
            "user_id": user_id,
            "stages": stages,
        },
    )
    audio_base64 = base64.b64encode(audio_data).decode("utf-8")
    audio_url = f"data:audio/wav;base64,{audio_base64}"
    tts_language = merged.get("language", "ru")
    if tts_language == "auto":
        tts_language = "ru"
    return {
        "success": True,
        "user_text": text,
        "ai_response": ai_response,
        "audio_url": audio_url,
        "audio_base64": audio_base64,
        "duration_ms": total_ms,
        "stages": stages,
        "language": tts_language,
        "voice": tts_voice,
    }


# Bounded LLM fallback: allowed voice command IDs (must match frontend commandCatalog).
VOICE_COMMAND_IDS = frozenset(
    {
        "open_gaf_chat",
        "open_content",
        "open_ugs_analytics",
        "open_presentations",
        "open_doc_editor",
        "open_image_studio",
        "open_video_studio",
        "open_music_player",
        "open_music_generator",
        "open_clipboard",
        "open_app_store",
        "open_site_studio",
        "open_social_hub",
        "open_marketing_cabinet",
        "open_studio_gu",
        "focus_next_window",
        "focus_previous_window",
        "open_command_palette",
        "voice_sound_mute",
        "voice_sound_unmute",
        "voice_sound_toggle",
        "create_folder",
        "minimize_all",
        "show_desktop",
        "close_window",
        "time",
        "date",
        "weather",
        "help",
        "clear_history",
        "thanks",
        "greeting",
    }
)

MAP_INTENT_SYSTEM = """You are a strict intent classifier for a voice assistant.
Given the user's utterance, respond with EXACTLY one of these command IDs, or UNKNOWN if none match:
open_gaf_chat, open_content, open_ugs_analytics, open_presentations, open_doc_editor,
open_image_studio, open_video_studio, open_music_player, open_music_generator,
open_clipboard, open_app_store, open_site_studio, open_social_hub,
open_marketing_cabinet, open_studio_gu,
focus_next_window, focus_previous_window, open_command_palette,
voice_sound_mute, voice_sound_unmute, voice_sound_toggle,
create_folder, minimize_all, show_desktop, close_window,
time, date, weather, help, clear_history, thanks, greeting.
Reply with only the command_id (one word) or UNKNOWN. No explanation."""


async def map_transcript_to_intent(transcript: str) -> str | None:
    """
    Bounded LLM fallback: map user transcript to a known command ID only.
    Returns command_id or None (no free execution).
    """
    import os

    from api.core.unified_config import unified_settings
    from api.services.llama_service import LlamaService
    from api.utils.llama_models import get_model_or_default

    transcript = (transcript or "").strip()
    if not transcript:
        return None
    llama_url = (
        (os.environ.get("LLAMA_BASE_URL") or getattr(unified_settings, "llama_url", None) or "").strip().rstrip("/")
    )
    if not llama_url:
        logger.warning("Voice map_intent: no Llama URL, skipping LLM fallback")
        return None
    model = await get_model_or_default(None)
    try:
        async with LlamaService(base_url=llama_url) as llama_service:
            out = await llama_service.generate(
                prompt=transcript,
                model=model,
                temperature=0.1,
                max_tokens=50,
                system_prompt=MAP_INTENT_SYSTEM,
                stream=False,
            )
        text = (out.get("text") or "").strip().upper()
        if text == "UNKNOWN":
            return None
        candidate = text.lower().strip()
        if candidate in VOICE_COMMAND_IDS:
            return candidate
        return None
    except Exception as e:
        logger.warning("Voice map_intent LLM failed: %s", e)
        return None
