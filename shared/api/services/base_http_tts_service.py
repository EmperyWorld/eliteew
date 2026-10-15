import base64
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class BaseHTTPTTSService:
    """
    Base class for HTTP-based TTS services.
    """

    SERVICE_URL_ENV_KEY = ""
    DEFAULT_SERVICE_URL = ""
    SERVICE_NAME = "BaseTTS"

    def __init__(self) -> None:
        self.service_url = os.getenv(self.SERVICE_URL_ENV_KEY, self.DEFAULT_SERVICE_URL)
        self._client = httpx.AsyncClient(timeout=60.0)
        logger.info(f"{self.SERVICE_NAME} initialized with URL: {self.service_url}")

    async def _post_synthesize(self, payload: dict[str, Any]) -> bytes:
        """
        Send synthesis request to the remote service.

        Supports:
        - audio/wav (or octet-stream) body — qwen3-tts stack9
        - legacy JSON { audio_base64 } — silero stack9 profile
        """
        url = f"{self.service_url}/synthesize"
        synth_timeout = float(os.getenv("TTS_HTTP_SYNTHESIZE_TIMEOUT_SEC", "180"))
        try:
            response = await self._client.post(url, json=payload, timeout=synth_timeout)
            response.raise_for_status()

            content_type = (response.headers.get("content-type") or "").lower()
            if content_type.startswith("audio/") or content_type.startswith("application/octet-stream"):
                if not response.content:
                    raise ValueError("Empty audio body from TTS service")
                return response.content

            data = response.json()
            audio_base64 = data.get("audio_base64")
            if not audio_base64:
                raise ValueError("No audio in response (expected audio/wav body or audio_base64 JSON)")
            return base64.b64decode(audio_base64)

        except httpx.RequestError as e:
            logger.error(f"Connection error to {self.SERVICE_NAME}: {e}")
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error from {self.SERVICE_NAME}: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in {self.SERVICE_NAME}: {e}")
            raise

    async def health_check(self) -> bool:
        """Check service health. Treats 200 OK as healthy even if JSON lacks status."""
        if not (self.service_url or "").strip():
            logger.debug("%s health check skipped (empty service URL)", self.SERVICE_NAME)
            return False
        url = f"{self.service_url}/health"
        try:
            response = await self._client.get(url, timeout=5.0)
            response.raise_for_status()
            data = response.json() if response.content else {}
            if data.get("status") == "healthy":
                return True
            return response.status_code == 200
        except httpx.HTTPStatusError as e:
            logger.warning(
                "%s health check failed: HTTP %s",
                self.SERVICE_NAME,
                e.response.status_code,
            )
            return False
        except httpx.RequestError as e:
            # DNS / connection refused / timeout when optional stack (e.g. stack9-silero) is down.
            logger.debug(
                "%s health check: host unreachable or network error (%s)",
                self.SERVICE_NAME,
                e,
            )
            return False
        except Exception as e:
            logger.warning(
                "%s health check failed: %s",
                self.SERVICE_NAME,
                e,
            )
            return False

    async def close(self):
        await self._client.aclose()
