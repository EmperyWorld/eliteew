# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.
# Purpose:
# Text LLM (Llama) execution for UGS; document analysis and Faster-Whisper
# live in provider_execution_text_media (mixin keeps same method names).
# Invariants:
# - Text stack base URL from ugs_resolve_text_llm_base_url.
# - decode_binary_payload stays on mixin for ComfyUI media/music callers.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# - api/services/ugs/provider_execution_text_media.py
# ---

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

import aiohttp  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.services.ugs.model_routing_service import UGSModelRoutingService
from api.services.ugs.provider_config_models import ProviderConfig, ProviderError
from api.services.ugs.provider_execution_text_media import (
    build_document_analysis_prompt,
    call_faster_whisper,
    call_llama_document_analysis,
    decode_binary_payload,
    normalize_text_result_payload,
)
from api.services.ugs.provider_runtime_seeds import ugs_resolve_text_llm_base_url
from api.services.ugs.text_llm_constants import ugs_generation_requests_json_object

logger = logging.getLogger(__name__)


class ProviderExecutionTextMixin:
    """Mixin — composed into ProviderManagerServiceV2."""

    async def _call_llama(
        self,
        config: ProviderConfig,
        generation_type: str,
        input_data: dict[str, Any],
        *,
        generation_category: str | None = None,
    ) -> dict[str, Any]:
        """Call Llama provider"""

        from .providers.llama_provider import LlamaProvider

        # Приоритет: URL из админки (generation_providers), иначе LLAMA_URL / compose default
        final_url = ugs_resolve_text_llm_base_url(config.base_url)

        # Reinitialize provider if URL changed or provider doesn't exist
        # Add protection against multiple simultaneous initializations
        if self._llama_provider is None or self._llama_provider.base_url != final_url:
            if self._llama_provider is not None:
                try:
                    async with asyncio.timeout(5.0):
                        await self._llama_provider.close()
                except TimeoutError:
                    logger.warning("Timeout closing old Llama provider, forcing close")
                    self._llama_provider.client = None
                except (aiohttp.ClientError, OSError):  # fmt: skip
                    logger.exception("Error closing old Llama provider")

            logger.info("Initializing Llama provider with URL: %s", final_url)
            self._llama_provider = LlamaProvider(base_url=final_url)
            try:
                async with asyncio.timeout(10.0):
                    await self._llama_provider.initialize()
            except TimeoutError:
                logger.exception("Timeout initializing Llama provider")
                raise
            except (aiohttp.ClientError, OSError) as e:
                logger.exception("Error initializing Llama provider")
                raise ProviderError(str(e)) from e

        if self._llama_provider is None:
            msg = "Llama provider not initialized"
            raise RuntimeError(msg)
        logger.info("Llama call: %s with data keys: %s", generation_type, list(input_data.keys()))

        resolved_model = await UGSModelRoutingService(self.db).resolve_for_type(
            type_key=generation_type,
            provider_name=config.provider_name,
            category=generation_category,
            provider_config=config.config_json if isinstance(config.config_json, dict) else {},
            request_model=str(input_data.get("model")) if input_data.get("model") else None,
        )
        llama_model = resolved_model.model or unified_settings.default_ai_model
        if resolved_model.warnings:
            logger.warning(
                "UGS model routing warnings for %s via %s: %s",
                generation_type,
                config.provider_name,
                "; ".join(resolved_model.warnings),
            )

        try:
            if generation_type in (
                "text_chat",
                "text_chat_response",
                "document_structured_extract",
                "text_code_generation",
                "text_translation",
                "text_summarization",
                "marketing_swot_analysis",
                "marketing_porter_analysis",
                "marketing_competitor_report",
                "marketing_financial_projection",
                "marketing_channel_mix",
                "marketing_customer_insights",
            ) or generation_type.startswith("professional_worlds_realtor_"):
                prompt = input_data.get("prompt") or input_data.get("text") or ""
                options = dict(input_data.get("options") or {})
                # Llama uses num_predict, not max_tokens — convert and remove to avoid "invalid option" warning
                if "max_tokens" in input_data:
                    options["num_predict"] = input_data["max_tokens"]
                else:
                    options.setdefault("num_predict", 8192)
                options.pop("max_tokens", None)
                json_object_output = ugs_generation_requests_json_object(
                    generation_type,
                    input_data,
                )
                result = None
                async for chunk in self._llama_provider.generate_text(
                    prompt=prompt,
                    model=llama_model,
                    options=options,
                    stream=False,
                    json_format=json_object_output,
                ):
                    result = chunk
                    break
                out = dict(result) if result else {}
                # Ensure text is available under common keys for all consumers
                text = out.get("response") or out.get("text") or out.get("content") or ""
                if text and ("text" not in out or "content" not in out):
                    out.setdefault("text", text)
                    out.setdefault("content", text)
                return {
                    "provider": "llama",
                    "generation_type": generation_type,
                    "result": out,
                    "timestamp": datetime.now(UTC).isoformat(),
                }
            if generation_type in (
                "text_rag_chat",
                "text_chat_dialogue",
                "music_generator_lyrics",
                "music_generator_style",
                "music_generator_improve_lyrics",
                "music_generator_suggest_params",
                "music_generator_promo_script",
                "music_generator_v3_lyrics",
                "music_generator_v3_style",
                "music_generator_v3_suggest_params",
                "music_generator_evolution_brief",
                "music_generator_evolution_lyrics",
                "music_generator_evolution_style",
                "music_generator_forge_blueprint",
                "music_generator_forge_lyrics",
                "music_generator_forge_style",
                "image_studio_image_prompt",
                "video_studio_image_prompt",
            ):
                messages = input_data.get("messages") or [{"role": "user", "content": input_data.get("prompt", "")}]
                options = dict(input_data.get("options") or {})
                if "max_tokens" in input_data:
                    options["num_predict"] = input_data["max_tokens"]
                else:
                    options.setdefault("num_predict", 8192)
                options.pop("max_tokens", None)
                json_object_output = ugs_generation_requests_json_object(
                    generation_type,
                    input_data,
                )
                result = None
                async for chunk in self._llama_provider.chat_completion(
                    messages=messages,
                    model=llama_model,
                    options=options,
                    stream=False,
                    json_format=json_object_output,
                ):
                    result = chunk
                    break
                out = dict(result) if result else {}
                text = out.get("response") or out.get("text") or out.get("content") or ""
                if text and ("text" not in out or "content" not in out):
                    out.setdefault("text", text)
                    out.setdefault("content", text)
                return {
                    "provider": "llama",
                    "generation_type": generation_type,
                    "result": out,
                    "timestamp": datetime.now(UTC).isoformat(),
                }
            if generation_type == "document_analysis":
                return await self._call_llama_document_analysis(
                    generation_type=generation_type,
                    input_data=input_data,
                    model=llama_model,
                )
            msg = f"Unsupported Llama generation type: {generation_type}"
            raise ProviderError(msg)
        except ProviderError:
            raise
        except (TimeoutError, aiohttp.ClientError, OSError) as e:
            logger.exception("Llama provider error")
            raise ProviderError(str(e)) from e

    @staticmethod
    def _normalize_text_result_payload(result: dict[str, Any] | None) -> dict[str, Any]:
        return normalize_text_result_payload(result)

    @staticmethod
    def _decode_binary_payload(raw_value: Any, *, field_name: str) -> bytes:
        return decode_binary_payload(raw_value, field_name=field_name)

    @staticmethod
    def _build_document_analysis_prompt(
        *,
        text: str,
        file_name: str,
        analysis_type: str,
        max_chars: int = 12000,
    ) -> tuple[str, dict[str, Any]]:
        return build_document_analysis_prompt(
            text=text,
            file_name=file_name,
            analysis_type=analysis_type,
            max_chars=max_chars,
        )

    async def _call_llama_document_analysis(
        self,
        *,
        generation_type: str,
        input_data: dict[str, Any],
        model: str,
    ) -> dict[str, Any]:
        return await call_llama_document_analysis(
            self._llama_provider,
            generation_type=generation_type,
            input_data=input_data,
            model=model,
        )

    async def _call_faster_whisper(self, generation_type: str, input_data: dict[str, Any]) -> dict[str, Any]:
        return await call_faster_whisper(
            generation_type,
            input_data,
            content_service=self._content_service,
            current_user_id=self._current_user_id,
            current_company_id=self._current_company_id,
            current_project_id=self._current_project_id,
        )
