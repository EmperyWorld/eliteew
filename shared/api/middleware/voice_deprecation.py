"""
Voice endpoints deprecation shim.

Adds X-Deprecation and X-Replacement-Endpoint headers to legacy voice routes
so clients can migrate to /api/v1/voice-gateway/*.
"""

import logging
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# Path suffix or exact -> replacement endpoint
LEGACY_VOICE_PATHS: list[tuple[str, str]] = [
    ("/api/v1/live-voice/process", "/api/v1/voice-gateway/process"),
    ("/api/v1/audio-transcription/transcribe", "/api/v1/voice-gateway/transcribe"),
    ("/api/audio-transcription/transcribe", "/api/v1/voice-gateway/transcribe"),
    ("/api/v1/audio-transcription-local/transcribe", "/api/v1/voice-gateway/transcribe"),
    ("/voice-center/synthesize", "/api/v1/voice-gateway/synthesize"),
    ("/api/voice-center/synthesize", "/api/v1/voice-gateway/synthesize"),
    ("/api/v1/voice-center/synthesize", "/api/v1/voice-gateway/synthesize"),
    ("/api/v1/text-to-voice/process", "/api/v1/voice-gateway/process"),
]


class VoiceDeprecationMiddleware(BaseHTTPMiddleware):
    """Add deprecation headers to legacy voice endpoint responses."""

    async def dispatch(self, request: Request, call_next: Callable[[Request], Response]) -> Response:
        response = await call_next(request)
        path = request.url.path.rstrip("/")
        for legacy, replacement in LEGACY_VOICE_PATHS:
            legacy_norm = legacy.rstrip("/")
            if path == legacy_norm or path.endswith(legacy_norm):
                response.headers["X-Deprecation"] = "true"
                response.headers["X-Replacement-Endpoint"] = replacement
                logger.debug(
                    "Voice deprecation shim: %s -> %s",
                    request.url.path,
                    replacement,
                )
                break
        return response
