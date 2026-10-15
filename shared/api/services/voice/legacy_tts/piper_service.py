"""
Piper TTS Service - Fast & Lightweight TTS (HTTP Client)

Uses remote Piper TTS service via HTTP.
"""

import logging
from typing import Any

from api.services.base_http_tts_service import BaseHTTPTTSService

logger = logging.getLogger(__name__)


class PiperService(BaseHTTPTTSService):
    """
    Piper TTS Service client.
    """

    SERVICE_URL_ENV_KEY = "PIPER_SERVICE_URL"
    DEFAULT_SERVICE_URL = "http://stack9-piper:8000"
    SERVICE_NAME = "PiperTTS"

    # Default voice
    DEFAULT_VOICE = "en_US-lessac-medium"

    def __init__(self) -> None:
        super().__init__()

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        speed: float = 1.0,
    ) -> bytes:
        """
        Synthesize text to speech using Piper.
        """
        if voice is None:
            voice = self.DEFAULT_VOICE

        payload = {
            "text": text,
            "voice": voice,
            "speed": speed,
        }

        return await self._post_synthesize(payload)

    async def get_available_voices(self) -> list[dict[str, Any]]:
        """
        Get list of available TTS voices.
        """
        # Hardcoded list for now, ideally fetch from remote
        voices = [
            {
                "id": "en_US-lessac-medium",
                "name": "Lessac (US)",
                "language": "en-US",
                "gender": "female",
                "description": "Medium quality US English voice",
            },
            {
                "id": "en_US-lessac-high",
                "name": "Lessac (US) High",
                "language": "en-US",
                "gender": "female",
                "description": "High quality US English voice",
            },
            {
                "id": "en_GB-alan-medium",
                "name": "Alan (GB)",
                "language": "en-GB",
                "gender": "male",
                "description": "Medium quality British English voice",
            },
            {
                "id": "ru_RU-denis-medium",
                "name": "Denis (RU)",
                "language": "ru-RU",
                "gender": "male",
                "description": "Medium quality Russian voice",
            },
            {
                "id": "ru_RU-dmitri-medium",
                "name": "Dmitri (RU)",
                "language": "ru-RU",
                "gender": "male",
                "description": "Medium quality Russian voice",
            },
        ]
        return voices


# Global singleton instance
_piper_service: PiperService | None = None


def get_piper_service() -> PiperService:
    """Get global PiperService instance."""
    global _piper_service

    if _piper_service is None:
        _piper_service = PiperService()

    return _piper_service
