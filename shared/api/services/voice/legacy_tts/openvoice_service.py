"""
OpenVoice Service - Voice Cloning & TTS (HTTP Client)

Uses remote OpenVoice service via HTTP.
"""

import logging
from typing import Any

from api.services.base_http_tts_service import BaseHTTPTTSService

logger = logging.getLogger(__name__)


class OpenVoiceService(BaseHTTPTTSService):
    """
    OpenVoice Service client.
    """

    SERVICE_URL_ENV_KEY = "OPENVOICE_SERVICE_URL"
    DEFAULT_SERVICE_URL = "http://stack9-openvoice:8000"
    SERVICE_NAME = "OpenVoice"

    # Default voice
    DEFAULT_VOICE = "default"

    def __init__(self) -> None:
        super().__init__()

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        speed: float = 1.0,
    ) -> bytes:
        """
        Synthesize text to speech using OpenVoice.
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
        voices = [
            {
                "id": "default",
                "name": "Default Voice",
                "language": "en",
                "gender": "female",
                "description": "Standard OpenVoice voice",
            },
            {
                "id": "clone_sample",
                "name": "Cloned Sample",
                "language": "en",
                "gender": "unknown",
                "description": "Example cloned voice",
            },
        ]
        return voices


# Global singleton instance
_openvoice_service: OpenVoiceService | None = None


def get_openvoice_service() -> OpenVoiceService:
    """Get global OpenVoiceService instance."""
    global _openvoice_service

    if _openvoice_service is None:
        _openvoice_service = OpenVoiceService()

    return _openvoice_service
