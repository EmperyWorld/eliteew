"""
Coqui XTTS v2 Service - High Quality Multilingual TTS (HTTP Client)

Uses remote XTTS service via HTTP.
"""

import logging
from typing import Any

from api.services.base_http_tts_service import BaseHTTPTTSService

logger = logging.getLogger(__name__)


class XTTSService(BaseHTTPTTSService):
    """
    XTTS Service client.
    """

    SERVICE_URL_ENV_KEY = "XTTS_SERVICE_URL"
    DEFAULT_SERVICE_URL = "http://stack9-xtts:8000"
    SERVICE_NAME = "XTTSv2"

    # Default voice
    DEFAULT_VOICE = "en_speaker_0"

    def __init__(self) -> None:
        super().__init__()

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        language: str = "en",
        speed: float = 1.0,
    ) -> bytes:
        """
        Synthesize text to speech using XTTS.
        """
        if voice is None:
            voice = self.DEFAULT_VOICE

        payload = {
            "text": text,
            "voice": voice,
            "language": language,
            "speed": speed,
        }

        return await self._post_synthesize(payload)

    async def get_available_voices(self) -> list[dict[str, Any]]:
        """
        Get list of available TTS voices.
        """
        # XTTS voices are essentially speaker embeddings
        voices = [
            {
                "id": "en_speaker_0",
                "name": "English Speaker 0",
                "language": "en",
                "gender": "female",
                "description": "Default English female voice",
            },
            {
                "id": "en_speaker_1",
                "name": "English Speaker 1",
                "language": "en",
                "gender": "male",
                "description": "Default English male voice",
            },
            {
                "id": "ru_speaker_0",
                "name": "Russian Speaker 0",
                "language": "ru",
                "gender": "female",
                "description": "Default Russian female voice",
            },
        ]
        return voices


# Global singleton instance
_xtts_service: XTTSService | None = None


def get_xtts_service() -> XTTSService:
    """Get global XTTSService instance."""
    global _xtts_service

    if _xtts_service is None:
        _xtts_service = XTTSService()

    return _xtts_service
