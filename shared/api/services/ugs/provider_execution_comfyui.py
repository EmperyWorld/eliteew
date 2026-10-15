# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.
# Purpose:
# ComfyUI URL resolution, provider factory, health/output fetch, and thin dispatch
# to music + media execution helpers for UGS.
# Invariants:
# - Lazy ComfyUIProvider import inside _get_or_create_comfyui_provider.
# - Image/video/studio branches live in provider_execution_comfyui_media;
#   music/ACE/DiffRhythm/m2m in provider_execution_comfyui_music.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# - api/services/ugs/provider_execution_comfyui_media.py
# - api/services/ugs/provider_execution_comfyui_music.py
# ---

import logging
import os
from typing import Any

import aiohttp  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.services.ugs.provider_config_models import ProviderConfig, ProviderError
from api.services.ugs.provider_execution_comfyui_media import execute_comfyui_media_generation
from api.services.ugs.provider_execution_comfyui_music import execute_comfyui_music_generation
from api.services.ugs.provider_runtime_seeds import (
    _COMFYUI_DEFAULT_BASE_URL,
    _COMFYUI_MIN_MUSIC_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)


class ProviderExecutionComfyuiMixin:
    """Mixin — composed into ProviderManagerServiceV2."""

    @staticmethod
    def _normalize_comfyui_url(raw_url: Any) -> str:
        return str(raw_url or "").strip().rstrip("/")

    @staticmethod
    def _is_audio_comfy_generation_type(generation_type: str) -> bool:
        return generation_type.startswith("music_generator_")

    def _resolve_comfyui_base_url(self, config: ProviderConfig, generation_type: str) -> str:
        config_json = config.config_json if isinstance(config.config_json, dict) else {}
        configured_base_url = self._normalize_comfyui_url(config.base_url)
        common_env_base_url = self._normalize_comfyui_url(os.environ.get("COMFYUI_URL"))
        unified_default_base_url = self._normalize_comfyui_url(unified_settings.comfyui_url)
        default_base_url = (
            configured_base_url or common_env_base_url or unified_default_base_url or _COMFYUI_DEFAULT_BASE_URL
        )

        if self._is_audio_comfy_generation_type(generation_type):
            return (
                self._normalize_comfyui_url(
                    config_json.get("audio_base_url") or config_json.get("comfyui_audio_base_url")
                )
                or self._normalize_comfyui_url(os.environ.get("COMFYUI_AUDIO_URL"))
                or default_base_url
            )

        return (
            self._normalize_comfyui_url(config_json.get("image_base_url") or config_json.get("comfyui_image_base_url"))
            or self._normalize_comfyui_url(os.environ.get("COMFYUI_IMAGE_URL"))
            or default_base_url
        )

    async def _get_or_create_comfyui_provider(self, base_url: str) -> Any:
        from .providers.comfyui_provider import ComfyUIProvider

        normalized_base_url = self._normalize_comfyui_url(base_url) or _COMFYUI_DEFAULT_BASE_URL
        cached = self._comfyui_providers_by_base_url.get(normalized_base_url)
        if cached is not None:
            self._comfyui_provider = cached
            return cached

        comfyui_provider = ComfyUIProvider(base_url=normalized_base_url)
        await comfyui_provider.initialize()
        self._comfyui_providers_by_base_url[normalized_base_url] = comfyui_provider
        self._comfyui_provider = comfyui_provider
        return comfyui_provider

    async def fetch_comfyui_image(self, filename: str, subfolder: str = "") -> str | None:
        cache_key = f"{subfolder}:{filename}" if subfolder else filename
        cached_value = self._image_cache.get(cache_key)
        if cached_value is not None:
            return cached_value

        active_base_url = self._normalize_comfyui_url(getattr(self._comfyui_provider, "base_url", None))
        base_url = (
            active_base_url
            or self._normalize_comfyui_url(os.environ.get("COMFYUI_IMAGE_URL"))
            or self._normalize_comfyui_url(os.environ.get("COMFYUI_URL"))
            or self._normalize_comfyui_url(unified_settings.comfyui_url)
            or _COMFYUI_DEFAULT_BASE_URL
        )
        comfyui_provider = await self._get_or_create_comfyui_provider(base_url)
        try:
            image_data = await comfyui_provider.fetch_image_data(filename, subfolder)
            if image_data:
                self._image_cache[cache_key] = image_data
            return str(image_data) if image_data is not None else None
        except (TimeoutError, aiohttp.ClientError, OSError) as error:
            logger.warning("Failed to fetch ComfyUI image %s: %s", filename, error)
            return None

    async def fetch_comfyui_output_audio(self, filename: str, subfolder: str = "") -> str | None:
        """Base64 payload for audio saved under ComfyUI output (SaveAudio / SaveAudioMP3)."""
        cache_key = f"out-audio:{subfolder}:{filename}" if subfolder else f"out-audio:{filename}"
        cached_value = self._image_cache.get(cache_key)
        if cached_value is not None:
            return cached_value

        active_base_url = self._normalize_comfyui_url(getattr(self._comfyui_provider, "base_url", None))
        base_url = (
            active_base_url
            or self._normalize_comfyui_url(os.environ.get("COMFYUI_AUDIO_URL"))
            or self._normalize_comfyui_url(os.environ.get("COMFYUI_URL"))
            or self._normalize_comfyui_url(unified_settings.comfyui_url)
            or _COMFYUI_DEFAULT_BASE_URL
        )
        comfyui_provider = await self._get_or_create_comfyui_provider(base_url)
        try:
            raw = await comfyui_provider.fetch_output_file_data_b64(filename, subfolder)
            if raw:
                self._image_cache[cache_key] = raw
            return raw
        except (TimeoutError, aiohttp.ClientError, OSError) as error:
            logger.warning("Failed to fetch ComfyUI output audio %s: %s", filename, error)
            return None

    async def fetch_comfyui_output_video(self, filename: str, subfolder: str = "") -> str | None:
        """Base64 payload for video saved under ComfyUI output (SaveVideo)."""
        cache_key = f"out-video:{subfolder}:{filename}" if subfolder else f"out-video:{filename}"
        cached_value = self._image_cache.get(cache_key)
        if cached_value is not None:
            return cached_value

        active_base_url = self._normalize_comfyui_url(getattr(self._comfyui_provider, "base_url", None))
        base_url = (
            active_base_url
            or self._normalize_comfyui_url(os.environ.get("COMFYUI_URL"))
            or self._normalize_comfyui_url(unified_settings.comfyui_url)
            or _COMFYUI_DEFAULT_BASE_URL
        )
        comfyui_provider = await self._get_or_create_comfyui_provider(base_url)
        try:
            raw = await comfyui_provider.fetch_output_file_data_b64(filename, subfolder)
            if raw:
                self._image_cache[cache_key] = raw
            return raw
        except (TimeoutError, aiohttp.ClientError, OSError) as error:
            logger.warning("Failed to fetch ComfyUI output video %s: %s", filename, error)
            return None

    async def _call_comfyui(
        self, config: ProviderConfig, generation_type: str, input_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Call ComfyUI provider"""
        comfyui_base_url = self._resolve_comfyui_base_url(config, generation_type)
        await self._get_or_create_comfyui_provider(comfyui_base_url)
        comfy = self._comfyui_provider
        if comfy is None:
            msg = "ComfyUI provider unavailable"
            raise ProviderError(msg)
        contour = "audio" if self._is_audio_comfy_generation_type(generation_type) else "image"
        logger.info(
            "ComfyUI call: %s contour=%s base_url=%s data_keys=%s",
            generation_type,
            contour,
            comfyui_base_url,
            list(input_data.keys()),
        )

        try:
            # Honor provider timeout while keeping a stronger floor for long music workflows.
            music_timeout_seconds = max(
                _COMFYUI_MIN_MUSIC_TIMEOUT_SECONDS,
                min(int(config.timeout_seconds or _COMFYUI_MIN_MUSIC_TIMEOUT_SECONDS), 1800),
            )
            media_payload = await execute_comfyui_media_generation(
                comfy,
                generation_type,
                input_data,
                decode_binary_payload=self._decode_binary_payload,
                load_comfyui_workflow_template_json=self.load_comfyui_workflow_template_json,
                db=self.db,
            )
            if media_payload is not None:
                return media_payload

            music_payload = await execute_comfyui_music_generation(
                comfy,
                generation_type,
                input_data,
                music_timeout_seconds,
                decode_binary_payload=self._decode_binary_payload,
            )
            if music_payload is not None:
                return music_payload

            msg = f"Unsupported ComfyUI generation type: {generation_type}"
            raise ProviderError(msg)
        except ProviderError:
            raise
        except (TimeoutError, aiohttp.ClientError, OSError) as e:
            logger.exception("ComfyUI provider error")
            raise ProviderError(str(e)) from e
