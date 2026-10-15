"""Voice domain: Voice Center, transcription, gateway, live voice, legacy TTS compatibility."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI  # type: ignore[import-untyped]


def register_domain_voice(app: FastAPI) -> None:
    """Register voice and transcription routers."""
    from api.routers.audio_transcription import router as audio_transcription_router  # noqa: PLC0415
    from api.routers.audio_transcription_local import (  # noqa: PLC0415
        router as audio_transcription_local_router,
    )
    from api.routers.live_voice import router as live_voice  # noqa: PLC0415
    from api.routers.live_voice_websocket import router as live_voice_websocket_router  # noqa: PLC0415
    from api.routers.text_to_voice import router as text_to_voice  # noqa: PLC0415
    from api.routers.tts_kokoro import router as kokoro_tts_router  # noqa: PLC0415
    from api.routers.voice_center import router as voice_center  # noqa: PLC0415
    from api.routers.voice_center_transcription import (  # noqa: PLC0415
        router as voice_center_transcription_router,
    )
    from api.routers.voice_commands import router as voice_commands_router  # noqa: PLC0415
    from api.routers.voice_gateway import router as voice_gateway_router  # noqa: PLC0415

    app.include_router(voice_center, prefix="/api", tags=["Voice Center - Stack9 TTS Widget"])
    app.include_router(
        voice_center,
        prefix="/api/v1",
        tags=["Voice Center - Stack9 TTS Widget (v1)"],
    )
    app.include_router(
        audio_transcription_router,
        prefix="/api/v1/audio-transcription",
        tags=["Audio Transcription - WhisperX STT"],
    )
    app.include_router(
        audio_transcription_router,
        prefix="/api/audio-transcription",
        tags=["Audio Transcription - WhisperX STT (Legacy)"],
    )
    app.include_router(
        audio_transcription_local_router,
        prefix="/api/v1/audio-transcription-local",
        tags=["Audio Transcription - Local Whisper (faster-whisper)"],
    )
    app.include_router(
        audio_transcription_local_router,
        prefix="/api/audio-transcription-local",
        tags=["Audio Transcription - Local Whisper (faster-whisper) (Legacy)"],
    )
    app.include_router(voice_center_transcription_router, tags=["Voice Center - Transcription"])
    app.include_router(voice_gateway_router, tags=["Voice Gateway - Unified STT/TTS (Stack9)"])
    app.include_router(live_voice, tags=["Live Voice"])
    app.include_router(live_voice_websocket_router, tags=["Live Voice - WebSocket Real-time"])
    app.include_router(voice_commands_router, tags=["Voice Commands - Audit & Policy"])
    app.include_router(text_to_voice, tags=["Text to Voice - Text input with voice response"])
    app.include_router(
        kokoro_tts_router,
        prefix="/api/v1/tts",
        tags=["Legacy TTS Compatibility - AI Avatar Studio"],
    )
    app.include_router(
        kokoro_tts_router,
        prefix="/api/tts",
        tags=["Legacy TTS Compatibility - AI Avatar Studio (Legacy)"],
    )
