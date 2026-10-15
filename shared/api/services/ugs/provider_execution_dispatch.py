# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.
# Purpose:
# UGS generation dispatch with fallback chain across providers.
# Invariants:
# - ProviderNotFoundError on primary does not attempt fallback.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# ---

import logging
from typing import Any

from sqlalchemy import text  # type: ignore[import-not-found]

from api.services.ugs.provider_config_models import (
    AllProvidersFailedError,
    ProviderConfig,
    ProviderError,
    ProviderNotFoundError,
    _normalize_provider_row,
)
from api.services.ugs.text_llm_constants import TEXT_LLM_PROVIDER_TYPES

logger = logging.getLogger(__name__)


class ProviderExecutionDispatchMixin:
    """Mixin — composed into ProviderManagerServiceV2."""

    async def execute_generation(
        self,
        provider_name: str,
        generation_type: str,
        input_data: dict[str, Any],
        generation_category: str | None = None,
        user_id: str | None = None,
        project_id: str | None = None,
        company_id: str | None = None,
    ) -> dict[str, Any]:
        """Execute generation with automatic fallback"""
        # Store user context for unified content saving
        self._current_user_id = user_id
        self._current_project_id = project_id
        self._current_company_id = company_id
        try:
            return await self._execute_with_fallback(
                provider_name,
                generation_type,
                input_data,
                generation_category=generation_category,
            )
        finally:
            # Clear context after execution
            self._current_user_id = None
            self._current_project_id = None
            self._current_company_id = None

    async def _execute_with_fallback(
        self,
        primary_provider: str,
        generation_type: str,
        input_data: dict[str, Any],
        *,
        generation_category: str | None = None,
    ) -> dict[str, Any]:
        """Execute with fallback logic"""
        tried_providers = []
        last_error = None

        def annotate_result(
            raw_result: dict[str, Any],
            *,
            resolved_provider: str,
            fallback_used: bool,
        ) -> dict[str, Any]:
            result = dict(raw_result) if isinstance(raw_result, dict) else {"result": raw_result}
            metadata = dict(result.get("metadata") or {})
            metadata["provider_resolution"] = {
                "primary_provider": primary_provider,
                "resolved_provider": resolved_provider,
                "fallback_used": fallback_used,
                "attempt_count": len(tried_providers) + 1,
                "tried_providers": [*tried_providers, resolved_provider],
            }
            result["metadata"] = metadata
            return result

        # Try primary provider first
        try:
            result = await self._call_provider(
                primary_provider,
                generation_type,
                input_data,
                generation_category=generation_category,
            )
            await self._record_provider_success(primary_provider)
            return annotate_result(
                result,
                resolved_provider=primary_provider,
                fallback_used=False,
            )
        except ProviderNotFoundError as e:
            # Provider not found or disabled - don't try fallback, raise immediately
            logger.exception("Provider %s not found or disabled", primary_provider)
            msg = f"All providers failed for {generation_type}: Provider {primary_provider} not found or disabled"
            raise AllProvidersFailedError(msg) from e
        except ProviderError as e:
            logger.warning("Provider %s failed, attempting fallback: %s", primary_provider, e)
            tried_providers.append(primary_provider)
            last_error = e

        # Try fallback providers
        try:
            fallback_providers = await self._get_fallback_providers(primary_provider, generation_type)
        except (OSError, ValueError, TypeError) as e:
            logger.warning("Failed to get fallback providers: %s", e)
            fallback_providers = []

        for fallback in fallback_providers:
            if fallback.provider_name in tried_providers:
                continue

            try:
                result = await self._call_provider(
                    fallback.provider_name,
                    generation_type,
                    input_data,
                    generation_category=generation_category,
                )
                await self._record_fallback_success(primary_provider, fallback.provider_name)
                return annotate_result(
                    result,
                    resolved_provider=fallback.provider_name,
                    fallback_used=True,
                )
            except ProviderNotFoundError:
                # Skip this fallback if not found
                logger.warning(
                    "Fallback provider %s not found or disabled, trying next",
                    fallback.provider_name,
                )
                tried_providers.append(fallback.provider_name)
                continue
            except ProviderError as e:
                logger.warning(
                    "Fallback provider failed: primary=%s, fallback=%s, error=%s",
                    primary_provider,
                    fallback.provider_name,
                    e,
                )
                tried_providers.append(fallback.provider_name)
                last_error = e

        # All providers failed
        await self._record_provider_failure(primary_provider, str(last_error))
        msg = f"All providers failed for {generation_type}: {last_error}"
        raise AllProvidersFailedError(msg)

    async def _call_provider(
        self,
        provider_name: str,
        generation_type: str,
        input_data: dict[str, Any],
        *,
        generation_category: str | None = None,
    ) -> dict[str, Any]:
        """Call a specific provider based on provider type"""
        config = await self.get_provider_config(provider_name)

        logger.info(
            "Calling provider: %s, type=%s, config_type=%s",
            provider_name,
            generation_type,
            config.provider_type,
        )

        # ИМК «Заполнитель»: отдельный класс; в generation_providers.provider_type часто «miso» (CHECK в БД)
        if (provider_name or "").strip() == "imc_cabinet_filler_provider":
            return await self._call_imc_cabinet_filler(
                config,
                generation_type,
                input_data,
                generation_category=generation_category,
            )

        # ИМК RAG-only исследования (imc_rag_*): не MISO, без веб-поиска
        if (provider_name or "").strip() == "imc_rag_research_provider":
            return await self._call_imc_rag_research(
                config,
                generation_type,
                input_data,
                generation_category=generation_category,
            )

        # Route to appropriate provider implementation
        if config.provider_type == "stable_diffusion":
            return await self._call_stable_diffusion(generation_type, input_data)
        if config.provider_type == "supir":
            return await self._call_supir(generation_type, input_data)
        if config.provider_type == "sadtalker":
            return await self._call_sadtalker(generation_type, input_data)
        if config.provider_type == "localai":
            return await self._call_localai(generation_type, input_data)
        if config.provider_type == "openwebui":
            return await self._call_openwebui(config, generation_type, input_data)
        if config.provider_type in TEXT_LLM_PROVIDER_TYPES:
            return await self._call_llama(
                config,
                generation_type,
                input_data,
                generation_category=generation_category,
            )
        if config.provider_type == "comfyui":
            return await self._call_comfyui(config, generation_type, input_data)
        if config.provider_type == "faster_whisper":
            return await self._call_faster_whisper(generation_type, input_data)
        if config.provider_type in ("silero", "piper"):
            return await self._call_silero(config, generation_type, input_data)
        if config.provider_type == "miso":
            return await self._call_miso(
                config,
                generation_type,
                input_data,
                generation_category=generation_category,
            )
        # Provider type not implemented - return error instead of mock
        logger.error(
            "Provider type %s not implemented for provider %s",
            config.provider_type,
            provider_name,
        )
        msg = (
            f"Provider type '{config.provider_type}' is not implemented. "
            f"Please contact support or use a different provider."
        )
        raise ValueError(msg)

    def _get_provider_config(self, provider_name: str) -> ProviderConfig:
        """Get provider config from cache (synchronous version)"""
        if provider_name in self._provider_cache:
            return self._provider_cache[provider_name]
        # This is a fallback - normally should be cached
        msg = f"Provider {provider_name} not in cache"
        raise ProviderNotFoundError(msg)

    async def _get_fallback_providers(self, primary_provider: str, generation_type: str) -> list[ProviderConfig]:
        """Get fallback providers for a generation type"""
        query = text("""
            SELECT
                provider_name,
                provider_type,
                base_url,
                api_key_required,
                health_endpoint,
                timeout_seconds,
                max_concurrent,
                enabled,
                config_json,
                fallback_for,
                cost_per_request
            FROM generation_providers
            WHERE enabled = TRUE
            AND provider_name != :primary
            AND :primary = ANY(fallback_for)
            ORDER BY cost_per_request ASC  -- Prefer cheaper providers
        """)

        result = await self.db.execute(query, {"primary": primary_provider})
        return [ProviderConfig(_normalize_provider_row(dict(row._mapping))) for row in result]

    async def _record_provider_success(self, provider_name: str) -> None:
        """Record successful provider usage"""
        # Could add success metrics here
        logger.info("Provider success: %s", provider_name)

    async def _record_fallback_success(self, primary_provider: str, fallback_provider: str) -> None:
        """Record successful fallback usage"""
        logger.info("Fallback success: primary=%s, fallback=%s", primary_provider, fallback_provider)

    async def _record_provider_failure(self, provider_name: str, error: str) -> None:
        """Record provider failure"""
        logger.warning("Provider failure: %s, error=%s", provider_name, error)
