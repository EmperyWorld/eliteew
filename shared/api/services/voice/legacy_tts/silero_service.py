# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# HTTP client for Stack9 Qwen3-TTS (legacy name SileroService for call sites).
# Invariants:
# - Voice ids resolve via api.services.qwen3_tts_voices before POST /synthesize.
# - Unknown companion_* / profile ids are not rewritten locally — Qwen3 resolves them.
# Related:
# - api/services/qwen3_tts_voices.py
# - docker/builders/stack9-qwen3-tts/qwen3_tts_service.py
# ---

"""Silero TTS Service - Russian Language Support (HTTP Client)

Uses remote Qwen3-TTS service via HTTP (Stack9).
"""

import logging
import re
import unicodedata
from typing import Any

from api.services.base_http_tts_service import BaseHTTPTTSService
from api.services.qwen3_tts_voices import (
    QWEN3_TTS_DEFAULT_PROFILE,
    list_qwen3_tts_voice_catalog,
    resolve_qwen3_tts_profile_id,
)

logger = logging.getLogger(__name__)


class SileroService(BaseHTTPTTSService):
    """Qwen3-TTS HTTP client (legacy SileroService name)."""

    SERVICE_URL_ENV_KEY = "SILERO_SERVICE_URL"
    DEFAULT_SERVICE_URL = "http://stack9-f5-tts:8000"
    SERVICE_NAME = "SileroTTS"

    DEFAULT_VOICE = QWEN3_TTS_DEFAULT_PROFILE

    def __init__(self) -> None:
        super().__init__()

    async def _load_model(self) -> None:
        """No-op: TTS is HTTP-based, no local model to preload."""
        return

    def _clean_text_for_tts(self, text: str) -> str:
        """Clean text before TTS synthesis."""
        if not text:
            return ""

        # Convert to string if not already
        text = str(text)

        # Remove markdown formatting
        text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)
        text = re.sub(r"\*\*([^\*]+)\*\*", r"\1", text)
        text = re.sub(r"\*([^\*]+)\*", r"\1", text)
        text = re.sub(r"__([^_]+)__", r"\1", text)
        text = re.sub(r"_([^_]+)_", r"\1", text)
        text = re.sub(r"```[^`]*```", "", text, flags=re.DOTALL)
        text = re.sub(r"`([^`]+)`", r"\1", text)
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"https?://[^\s]+", "", text)
        text = re.sub(r"\S+@\S+", "", text)

        # Remove emoji and special unicode characters
        text = "".join(char for char in text if unicodedata.category(char)[0] != "So" or char in ".,!?;:")

        # Remove special control characters
        text = re.sub(r"[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]", "", text)

        # Normalize unicode
        text = unicodedata.normalize("NFKD", text)

        # Remove zero-width characters
        text = re.sub(r"[\u200b-\u200f\u202a-\u202e\u2060-\u206f]", "", text)

        # Normalize whitespace
        text = re.sub(r"\s+", " ", text)

        # Remove empty lines
        text = "\n".join(line.strip() for line in text.split("\n") if line.strip())

        # Ensure text contains only printable characters
        text = re.sub(r"[^\w\s\u0400-\u04FF\u0500-\u052F.,!?;:\-()\"\']", "", text, flags=re.UNICODE)

        # Final cleanup
        text = text.encode("utf-8", errors="ignore").decode("utf-8")

        result = text.strip()
        if not result:
            logger.warning("Text after cleaning is empty, using fallback")
            return "Привет."

        return result

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        speed: float = 1.0,
        sample_rate: int | None = None,
    ) -> bytes:
        """Synthesize text to speech via Qwen3-TTS HTTP API."""
        profile_id = resolve_qwen3_tts_profile_id(voice)

        text = self._clean_text_for_tts(text)
        if len(text) > 500:
            text = text[:500].rsplit(" ", 1)[0].strip() or text[:500].strip()
            logger.info("TTS text truncated to %d chars for companion latency", len(text))

        payload = {
            "text": text,
            "voice": profile_id,
            "speed": speed,
            "sample_rate": sample_rate or 48000,
        }

        return await self._post_synthesize(payload)

    async def fetch_live_voice_profile_ids(self) -> set[str]:
        """Profile ids reported by stack9 GET /health (empty when unreachable)."""
        url = f"{self.service_url}/health"
        try:
            response = await self._client.get(url, timeout=5.0)
            response.raise_for_status()
            data = response.json() if response.content else {}
            voices = data.get("available_voices")
            if isinstance(voices, list):
                return {str(v) for v in voices}
        except Exception as exc:
            logger.debug("Qwen3 /health unavailable for voice catalog: %s", exc)
        return set()

    async def get_available_voices(self) -> list[dict[str, Any]]:
        """Qwen3 profiles + legacy aliases; merges live ids from stack9 /health when up."""
        live_ids = await self.fetch_live_voice_profile_ids()
        return list_qwen3_tts_voice_catalog(live_profile_ids=live_ids or None)


# Global singleton instance
_silero_service: SileroService | None = None


def get_silero_service() -> SileroService:
    """Get global SileroService instance."""
    global _silero_service

    if _silero_service is None:
        _silero_service = SileroService()

    return _silero_service


# Preferred name for new code; SileroService kept for import stability.
Qwen3TtsHttpClient = SileroService
