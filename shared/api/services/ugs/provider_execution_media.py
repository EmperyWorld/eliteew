# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Media providers: Stable Diffusion, SUPIR, SadTalker, Silero/Piper TTS (stack9 HTTP).
# Invariants:
# - Piper and Silero share Silero-compatible /synthesize JSON; Silero row is never replaced by Piper.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# - docker/builders/stack9-piper/
# ---

import base64
import logging
from datetime import UTC, datetime
from typing import Any

import aiohttp  # type: ignore[import-not-found]

from api.services.ugs.provider_config_models import ProviderConfig, ProviderError

logger = logging.getLogger(__name__)


class ProviderExecutionMediaMixin:
    """Mixin — composed into ProviderManagerServiceV2."""

    async def _call_stable_diffusion(self, generation_type: str, input_data: dict[str, Any]) -> dict[str, Any]:
        """Call Stable Diffusion provider"""
        from .providers.stable_diffusion_provider import StableDiffusionProvider

        if self._stable_diffusion_provider is None:
            self._stable_diffusion_provider = StableDiffusionProvider()
            await self._stable_diffusion_provider.initialize()

        if self._stable_diffusion_provider is None:
            msg = "Stable Diffusion provider not initialized"
            raise RuntimeError(msg)
        logger.info(
            "Stable Diffusion call: %s with data keys: %s",
            generation_type,
            list(input_data.keys()),
        )

        try:
            if generation_type == "text_to_image":
                result = await self._stable_diffusion_provider.text_to_image(**input_data)
                return dict(result) if result else {}
            if generation_type == "image_to_image":
                result = await self._stable_diffusion_provider.image_to_image(**input_data)
                return dict(result) if result else {}
            if generation_type == "inpainting":
                result = await self._stable_diffusion_provider.inpainting(**input_data)
                return dict(result) if result else {}
            if generation_type == "controlnet":
                result = await self._stable_diffusion_provider.controlnet_generation(**input_data)
                return dict(result) if result else {}
            # Default to text_to_image
            result = await self._stable_diffusion_provider.text_to_image(**input_data)
            return dict(result) if result else {}
        except (TimeoutError, aiohttp.ClientError) as e:
            logger.exception("Stable Diffusion provider network error")
            msg = f"Network error: {e}"
            raise ProviderError(msg) from e
        except ValueError as e:
            logger.exception("Stable Diffusion provider validation error")
            msg = f"Invalid input: {e}"
            raise ProviderError(msg) from e
        except (OSError, TypeError) as e:
            logger.exception("Stable Diffusion provider unexpected error")
            msg = f"Unexpected error: {e}"
            raise ProviderError(msg) from e

    async def _call_supir(self, generation_type: str, input_data: dict[str, Any]) -> dict[str, Any]:
        """Call SUPIR provider"""
        from .providers.supir_provider import SUPIRProvider

        if self._supir_provider is None:
            self._supir_provider = SUPIRProvider()
            await self._supir_provider.initialize()

        if self._supir_provider is None:
            msg = "SUPIR provider not initialized"
            raise RuntimeError(msg)
        logger.info("SUPIR call: %s with data keys: %s", generation_type, list(input_data.keys()))

        try:
            if generation_type == "upscaling":
                result = await self._supir_provider.upscale_4k(**input_data)
                return dict(result) if result else {}
            if generation_type == "restoration":
                result = await self._supir_provider.restore_image(**input_data)
                return dict(result) if result else {}
            if generation_type == "enhancement":
                result = await self._supir_provider.enhance_image(**input_data)
                return dict(result) if result else {}
            # Default to upscaling
            result = await self._supir_provider.upscale_4k(**input_data)
            return dict(result) if result else {}
        except (TimeoutError, aiohttp.ClientError, OSError) as e:
            logger.exception("SUPIR provider error")
            raise ProviderError(str(e)) from e

    async def _call_sadtalker(self, generation_type: str, input_data: dict[str, Any]) -> dict[str, Any]:
        """Call SadTalker provider"""
        from .providers.sadtalker_provider import SadTalkerProvider

        if self._sadtalker_provider is None:
            self._sadtalker_provider = SadTalkerProvider()
            await self._sadtalker_provider.initialize()

        if self._sadtalker_provider is None:
            msg = "SadTalker provider not initialized"
            raise RuntimeError(msg)
        logger.info("SadTalker call: %s with data keys: %s", generation_type, list(input_data.keys()))

        try:
            if generation_type == "avatar_animation":
                result = await self._sadtalker_provider.animate_avatar(**input_data)
                return dict(result) if result else {}
            if generation_type == "lip_sync":
                result = await self._sadtalker_provider.lip_sync_only(**input_data)
                return dict(result) if result else {}
            # Default to avatar animation
            result = await self._sadtalker_provider.animate_avatar(**input_data)
            return dict(result) if result else {}
        except (TimeoutError, aiohttp.ClientError, OSError) as e:
            logger.exception("SadTalker provider error")
            raise ProviderError(str(e)) from e

    @staticmethod
    def _normalize_stack9_tts_voice(raw_voice: Any, *, provider_type: str) -> str:
        voice = str(raw_voice or "").strip().lower()
        if provider_type == "piper":
            if voice.startswith("companion_") or voice.startswith("diktofon_"):
                return "irina"
            piper_aliases = {
                "": "irina",
                "default": "irina",
                "female": "irina",
                "woman": "irina",
                "xenia": "irina",
                "baya": "irina",
                "kseniya": "irina",
                "ru_female": "irina",
                "ru_RU-irina-medium": "irina",
            }
            return piper_aliases.get(voice, voice or "irina")
        voice_aliases = {
            "default": "xenia",
            "af_sarah": "xenia",
            "ru_natalia": "xenia",
            "female": "xenia",
            "male": "aidar",
            "ru_male": "aidar",
            "ru_female": "xenia",
        }
        return voice_aliases.get(voice, voice or "xenia")

    # Back-compat alias for callers/tests that still import the Silero-only name.
    @staticmethod
    def _normalize_silero_voice(raw_voice: Any) -> str:
        return ProviderExecutionMediaMixin._normalize_stack9_tts_voice(raw_voice, provider_type="silero")

    async def _call_silero(
        self, config: ProviderConfig, generation_type: str, input_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Call stack9 HTTP TTS (Silero or Piper) via Silero-compatible client."""
        from api.services.voice.legacy_tts.silero_service import get_silero_service  # noqa: PLC0415

        provider_type = str(config.provider_type or "silero").strip().lower()
        if generation_type not in (
            "audio_generation_tts",
            "audio_generation_piper",
            "audio_generation_f5_tts",
            "audio_tts_kokoro",
            "audio_tts_multilingual",
        ):
            msg = f"{provider_type} provider does not support generation type: {generation_type}"
            raise ProviderError(msg)

        text = input_data.get("text") or input_data.get("prompt")
        if not text:
            msg = f"{provider_type} TTS generation requires 'text'"
            raise ProviderError(msg)

        config_data = config.config_json if isinstance(config.config_json, dict) else {}
        defaults = config_data.get("defaults", {}) if isinstance(config_data.get("defaults"), dict) else {}
        default_voice = "irina" if provider_type == "piper" else "xenia"

        voice = self._normalize_stack9_tts_voice(
            input_data.get("voice") or config_data.get("default_voice") or defaults.get("voice") or default_voice,
            provider_type=provider_type,
        )

        try:
            speed = float(input_data.get("speed", defaults.get("speed", 1.0)))
        except (TypeError, ValueError):  # fmt: skip
            msg = f"Invalid 'speed' value for {provider_type} provider"
            raise ProviderError(msg) from None

        language = str(input_data.get("language") or defaults.get("language") or "ru")
        response_format = str(config_data.get("response_format") or "wav")
        base_url = (config.base_url or "").rstrip("/")
        if not base_url:
            msg = f"{provider_type} provider base_url is not configured"
            raise ProviderError(msg)

        if self._silero_service is None:
            self._silero_service = get_silero_service()
        self._silero_service.service_url = base_url

        start_time = datetime.now(UTC)
        try:
            audio_bytes = await self._silero_service.synthesize(text=text, voice=voice, speed=speed)
        except Exception as exc:
            msg = f"{provider_type} request failed: {exc}"
            raise ProviderError(msg) from exc

        elapsed_ms = int((datetime.now(UTC) - start_time).total_seconds() * 1000)
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        media_type = f"audio/{response_format}"

        return {
            "provider": config.provider_name,
            "generation_type": generation_type,
            "timestamp": datetime.now(UTC).isoformat(),
            "result": {
                "audio_base64": audio_b64,
                "audio_data": audio_b64,
                "audio_url": f"data:{media_type};base64,{audio_b64}",
                "format": media_type,
                "voice": voice,
                "language": language,
                "speed": speed,
                "response_time_ms": elapsed_ms,
            },
        }
