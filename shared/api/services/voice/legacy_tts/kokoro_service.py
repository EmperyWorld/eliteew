"""
Kokoro TTS Service - English Language Support (HTTP Client)

Uses remote Kokoro TTS service via HTTP.
"""

import logging
from typing import Any

from api.services.base_http_tts_service import BaseHTTPTTSService

logger = logging.getLogger(__name__)


class KokoroService(BaseHTTPTTSService):
    """
    Kokoro TTS Service client.
    """

    SERVICE_URL_ENV_KEY = "KOKORO_SERVICE_URL"
    DEFAULT_SERVICE_URL = "http://stack9-kokoro:8000"
    SERVICE_NAME = "KokoroTTS"

    # Default voice
    DEFAULT_VOICE = "af_sarah"

    def __init__(self) -> None:
        super().__init__()

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        speed: float = 1.0,
        pitch: float = 1.0,
    ) -> bytes:
        """
        Synthesize text to speech using Kokoro.
        """
        if voice is None:
            voice = self.DEFAULT_VOICE

        payload = {
            "text": text,
            "voice": voice,
            "speed": speed,
            "pitch": pitch,  # Note: Remote might ignore pitch if not supported by Kokoro
        }

        return await self._post_synthesize(payload)

    async def get_available_voices(self) -> list[dict[str, Any]]:
        """
        Get list of available TTS voices.
        """
        # Hardcoded list to match previous local implementation and avoid async init issues
        # Ideally this should be fetched from the remote service
        voices = [
            {
                "id": "af_sarah",
                "name": "Sarah",
                "language": "en-US",
                "gender": "female",
                "description": "American female voice, neutral tone",
            },
            {
                "id": "af_sky",
                "name": "Sky",
                "language": "en-US",
                "gender": "female",
                "description": "American female voice",
            },
            {
                "id": "am_michael",
                "name": "Michael",
                "language": "en-US",
                "gender": "male",
                "description": "American male voice",
            },
            {
                "id": "am_adam",
                "name": "Adam",
                "language": "en-US",
                "gender": "male",
                "description": "American male voice",
            },
            {
                "id": "bf_emma",
                "name": "Emma",
                "language": "en-GB",
                "gender": "female",
                "description": "British female voice",
            },
            {
                "id": "bm_james",
                "name": "James",
                "language": "en-GB",
                "gender": "male",
                "description": "British male voice",
            },
        ]
        return voices


# Global singleton instance
_kokoro_service: KokoroService | None = None


def get_kokoro_service() -> KokoroService:
    """Get global KokoroService instance."""
    global _kokoro_service

    if _kokoro_service is None:
        _kokoro_service = KokoroService()

    return _kokoro_service
