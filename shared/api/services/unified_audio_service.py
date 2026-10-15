#!/usr/bin/env python3
"""
🔥 UNIFIED AUDIO SERVICE 🔥
Consolidated TTS/STT service with provider abstraction

Features:
- Multiple TTS providers (Silero, Kokoro, Piper, XTTS, OpenVoice)
- STT support (Whisper)
- Automatic provider selection based on language/requirements
- Health monitoring and failover
- Backwards compatibility with existing services
"""

import asyncio
import logging
from enum import StrEnum
from typing import Any, cast

from api.services.base_http_tts_service import BaseHTTPTTSService
from api.services.voice.legacy_tts.kokoro_service import KokoroService
from api.services.voice.legacy_tts.openvoice_service import OpenVoiceService
from api.services.voice.legacy_tts.piper_service import PiperService
from api.services.voice.legacy_tts.silero_service import SileroService
from api.services.voice.legacy_tts.xtts_service import XTTSService

logger = logging.getLogger(__name__)


class AudioProvider(StrEnum):
    """Available audio providers"""

    SILERO = "silero"
    KOKORO = "kokoro"
    PIPER = "piper"
    XTTS = "xtts"
    OPENVOICE = "openvoice"


class Language(StrEnum):
    """Supported languages"""

    RU = "ru-RU"
    EN_US = "en-US"
    EN_GB = "en-GB"
    AUTO = "auto"


class UnifiedAudioService:
    """
    Unified audio service that manages multiple TTS providers
    and provides a single interface for text-to-speech synthesis.
    """

    def __init__(self) -> None:
        self._providers: dict[AudioProvider, BaseHTTPTTSService] = {}
        self._provider_health: dict[AudioProvider, bool] = {}
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize all audio providers"""
        if self._initialized:
            return

        logger.info("Initializing Unified Audio Service")

        # Only Silero is initialized at startup (stack9 others are unavailable / not used)
        self._providers = {
            AudioProvider.SILERO: SileroService(),
        }

        # Check health of registered providers only
        await self._check_all_providers_health()

        self._initialized = True
        logger.info("Unified Audio Service initialized")

    async def _check_all_providers_health(self) -> None:
        """Check health status of all providers"""
        tasks = []
        for provider_name, provider in self._providers.items():
            tasks.append(self._check_provider_health(provider_name, provider))

        await asyncio.gather(*tasks, return_exceptions=True)

    async def _check_provider_health(self, provider_name: AudioProvider, provider: BaseHTTPTTSService) -> None:
        """Check health of a specific provider"""
        try:
            is_healthy = await provider.health_check()
            self._provider_health[provider_name] = is_healthy
            status = "ok" if is_healthy else "fail"
            logger.info("%s %s provider health check", status, provider_name.value)
        except Exception as e:
            self._provider_health[provider_name] = False
            logger.warning("%s provider health check failed: %s", provider_name.value, e)

    async def synthesize(
        self,
        text: str,
        provider: AudioProvider | None = None,
        language: Language = Language.AUTO,
        voice: str | None = None,
        speed: float = 1.0,
        **kwargs: Any,
    ) -> tuple[bytes, AudioProvider]:
        """
        Synthesize text to speech using the best available provider.

        Args:
            text: Text to synthesize
            provider: Specific provider to use (auto-select if None)
            language: Target language for provider selection
            voice: Voice ID (provider-specific)
            speed: Speech speed multiplier
            **kwargs: Additional provider-specific parameters

        Returns:
            tuple[bytes, AudioProvider]: Audio data and provider used
        """
        if not self._initialized:
            await self.initialize()

        # Select provider
        if provider is None:
            provider = await self._select_best_provider(language)

        if provider not in self._providers:
            raise ValueError(f"Provider '{provider}' not available")

        provider_instance = self._providers[provider]

        # Check provider health
        if not self._provider_health.get(provider, False):
            logger.warning(f"Provider {provider} is unhealthy, attempting failover")
            fallback_provider = await self._get_fallback_provider(provider)
            if fallback_provider:
                provider = fallback_provider
                provider_instance = self._providers[provider]
            else:
                error_msg = f"No healthy provider available for language {language}"
                raise RuntimeError(error_msg)

        try:
            # Synthesize with selected provider
            if (
                provider == AudioProvider.SILERO
                or provider == AudioProvider.KOKORO
                or provider == AudioProvider.PIPER
                or provider == AudioProvider.XTTS
                or provider == AudioProvider.OPENVOICE
            ):
                tts: Any = provider_instance
                audio = await tts.synthesize(text=text, voice=voice, speed=speed, **kwargs)
            else:
                error_msg = f"Unknown provider: {provider}"
                raise ValueError(error_msg)

            logger.info("Synthesized with %s provider", provider.value)
            return audio, provider

        except Exception:
            logger.exception("Synthesis failed with %s", provider.value)

            # Try fallback providers
            fallback_provider = await self._get_fallback_provider(provider)
            if fallback_provider:
                logger.info(
                    "🔄 Retrying with fallback provider %s",
                    fallback_provider.value,
                )
                return await self.synthesize(
                    text=text,
                    provider=fallback_provider,
                    language=language,
                    voice=voice,
                    speed=speed,
                    **kwargs,
                )

            raise

    async def _select_best_provider(self, language: Language) -> AudioProvider:
        """Select the best provider for a given language"""
        healthy_providers = [provider for provider, healthy in self._provider_health.items() if healthy]

        if not healthy_providers:
            logger.info("No TTS providers healthy at startup; re-checking (stack9 may have been starting)")
            await self._check_all_providers_health()
            healthy_providers = [provider for provider, healthy in self._provider_health.items() if healthy]

        if not healthy_providers:
            raise RuntimeError("No healthy providers available")

        # Language-based provider selection
        if language == Language.RU:
            # Prefer Silero for Russian
            if AudioProvider.SILERO in healthy_providers:
                return AudioProvider.SILERO
            if AudioProvider.PIPER in healthy_providers:
                return AudioProvider.PIPER

        elif language in (Language.EN_US, Language.EN_GB):
            # Prefer Kokoro for English
            if AudioProvider.KOKORO in healthy_providers:
                return AudioProvider.KOKORO
            if AudioProvider.PIPER in healthy_providers:
                return AudioProvider.PIPER

        # Auto selection - prefer quality order
        preference_order = [
            AudioProvider.KOKORO,
            AudioProvider.SILERO,
            AudioProvider.XTTS,
            AudioProvider.OPENVOICE,
            AudioProvider.PIPER,
        ]

        for provider in preference_order:
            if provider in healthy_providers:
                return provider

        # Fallback to any healthy provider
        return healthy_providers[0]

    async def _get_fallback_provider(self, exclude_provider: AudioProvider) -> AudioProvider | None:
        """Get a fallback provider excluding the specified one"""
        healthy_providers = [
            provider for provider, healthy in self._provider_health.items() if healthy and provider != exclude_provider
        ]
        if not healthy_providers:
            await self._check_all_providers_health()
            healthy_providers = [
                provider
                for provider, healthy in self._provider_health.items()
                if healthy and provider != exclude_provider
            ]
        return healthy_providers[0] if healthy_providers else None

    async def get_available_voices(self, provider: AudioProvider | None = None) -> list[dict[str, Any]]:
        """
        Get available voices from providers.

        Args:
            provider: Specific provider or None for all providers

        Returns:
            List of voice information dictionaries
        """
        if not self._initialized:
            await self.initialize()

        if provider is None:
            # Get voices from all healthy providers
            all_voices = []
            for provider_name, provider_instance in self._providers.items():
                if self._provider_health.get(provider_name, False):
                    try:
                        tts: Any = provider_instance
                        voices = await tts.get_available_voices()
                        for voice in voices:
                            voice["provider"] = provider_name.value
                        all_voices.extend(voices)
                    except Exception as e:
                        logger.warning(f"Failed to get voices from {provider_name.value}: {e}")
            return all_voices
        else:
            # Get voices from specific provider
            if provider not in self._providers:
                raise ValueError(f"Provider '{provider}' not available")

            provider_instance = self._providers[provider]
            tts_single: Any = provider_instance
            voices = await tts_single.get_available_voices()
            for voice in voices:
                voice["provider"] = provider.value
            return voices

    async def get_provider_status(self) -> dict[str, Any]:
        """Get status of all providers"""
        if not self._initialized:
            await self.initialize()

        status = {
            "initialized": self._initialized,
            "providers": {},
            "healthy_count": 0,
            "unhealthy_count": 0,
        }

        for provider_name, is_healthy in self._provider_health.items():
            provider_info = {
                "name": provider_name.value,
                "healthy": is_healthy,
                "service_url": self._providers[provider_name].service_url,
            }
            status["providers"][provider_name.value] = provider_info

            if is_healthy:
                status["healthy_count"] += 1
            else:
                status["unhealthy_count"] += 1

        return status

    async def health_check(self) -> bool:
        """Check if any provider is healthy"""
        if not self._initialized:
            await self.initialize()

        return any(self._provider_health.values())

    # Backwards compatibility methods
    def get_silero_service(self) -> SileroService:
        """Get Silero service instance (backwards compatibility)"""
        if not self._initialized or AudioProvider.SILERO not in self._providers:
            return SileroService()
        return cast(SileroService, self._providers[AudioProvider.SILERO])

    def get_kokoro_service(self) -> KokoroService:
        """Get Kokoro service instance (backwards compatibility)"""
        if not self._initialized or AudioProvider.KOKORO not in self._providers:
            return KokoroService()
        return cast(KokoroService, self._providers[AudioProvider.KOKORO])

    def get_piper_service(self) -> PiperService:
        """Get Piper service instance (backwards compatibility)"""
        if not self._initialized or AudioProvider.PIPER not in self._providers:
            return PiperService()
        return cast(PiperService, self._providers[AudioProvider.PIPER])

    def get_xtts_service(self) -> XTTSService:
        """Get XTTS service instance (backwards compatibility)"""
        if not self._initialized or AudioProvider.XTTS not in self._providers:
            return XTTSService()
        return cast(XTTSService, self._providers[AudioProvider.XTTS])

    def get_openvoice_service(self) -> OpenVoiceService:
        """Get OpenVoice service instance (backwards compatibility)"""
        if not self._initialized or AudioProvider.OPENVOICE not in self._providers:
            return OpenVoiceService()
        return cast(OpenVoiceService, self._providers[AudioProvider.OPENVOICE])

    async def close(self) -> None:
        """Close all provider connections"""
        for provider in self._providers.values():
            if hasattr(provider, "close"):
                await provider.close()


# Global singleton instance
_unified_audio_service: UnifiedAudioService | None = None


def get_unified_audio_service() -> UnifiedAudioService:
    """Get global UnifiedAudioService instance."""
    global _unified_audio_service

    if _unified_audio_service is None:
        _unified_audio_service = UnifiedAudioService()

    return _unified_audio_service


# Backwards compatibility functions
def get_silero_service() -> SileroService:
    """Get Silero service (backwards compatibility)"""
    return get_unified_audio_service().get_silero_service()


def get_kokoro_service() -> KokoroService:
    """Get Kokoro service (backwards compatibility)"""
    return get_unified_audio_service().get_kokoro_service()


def get_piper_service() -> PiperService:
    """Get Piper service (backwards compatibility)"""
    return get_unified_audio_service().get_piper_service()


def get_xtts_service() -> XTTSService:
    """Get XTTS service (backwards compatibility)"""
    return get_unified_audio_service().get_xtts_service()


def get_openvoice_service() -> OpenVoiceService:
    """Get OpenVoice service (backwards compatibility)"""
    return get_unified_audio_service().get_openvoice_service()
