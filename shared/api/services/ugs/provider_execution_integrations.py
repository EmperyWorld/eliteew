# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.
# Purpose:
# Integration providers: MISO, IMC, LocalAI, OpenWebUI for UGS.
# Invariants:
# - OpenWebUI web_search honors use_web_search and quota gates.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# ---

import contextlib
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import aiohttp  # type: ignore[import-not-found]
import httpx  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.services.ugs.model_routing_service import UGSModelRoutingService
from api.services.ugs.provider_config_models import ProviderConfig, ProviderError
from api.services.ugs.provider_runtime_seeds import ugs_resolve_text_llm_base_url
from api.services.web_search_quota_service import (
    WebSearchQuotaExceededError,
    format_quota_denied_user_message,
)

logger = logging.getLogger(__name__)


class ProviderExecutionIntegrationsMixin:
    """Mixin — composed into ProviderManagerServiceV2."""

    async def _call_miso(
        self,
        config: ProviderConfig,
        generation_type: str,
        input_data: dict[str, Any],
        *,
        generation_category: str | None = None,
    ) -> dict[str, Any]:
        """Call MISO (Marketing Research Creator) provider"""
        try:
            from api.services.ugs.providers.miso_provider import MISOProvider
        except ImportError:
            from .providers.miso_provider import MISOProvider

        final_url = ugs_resolve_text_llm_base_url(config.base_url)

        if self._miso_provider is None or self._miso_provider.llama_base_url != final_url:
            if self._miso_provider is not None:
                await self._miso_provider.close()
            self._miso_provider = MISOProvider(llama_base_url=final_url)
            await self._miso_provider.initialize()

        logger.info("MISO call: %s with data keys: %s", generation_type, list(input_data.keys()))

        try:
            gen_key = str(generation_type or "").strip()
            # ИМК (`imc_*`, кроме устаревших путей) — через imc_rag_research_provider / imc_cabinet_filler_provider, не MISO
            if gen_key == "marketing_research_creator":
                payload = dict(input_data)
                # Канонический ключ типа из запроса UGS (истина — gen_key, не подмена из клиента)
                payload["ugs_type_key"] = gen_key
                if not input_data.get("model"):
                    resolved_model = await UGSModelRoutingService(self.db).resolve_for_type(
                        type_key=gen_key,
                        provider_name=config.provider_name,
                        category=generation_category,
                        provider_config=config.config_json if isinstance(config.config_json, dict) else {},
                    )
                    if resolved_model.model:
                        payload["model"] = resolved_model.model

                result = await self._miso_provider.generate(
                    payload,
                    db=self.db,
                    user_id=self._current_user_id,
                )
                metadata = result.get("metadata", {}) if isinstance(result, dict) else {}

                return {
                    "provider": "miso_provider",
                    "generation_type": gen_key,
                    "timestamp": datetime.now(UTC).isoformat(),
                    "result": result,
                    "metadata": metadata,
                }
            msg = f"Unsupported generation type '{gen_key}' for MISO provider"
            raise ProviderError(msg)

        except ProviderError:
            raise
        except (TimeoutError, aiohttp.ClientError, OSError, RuntimeError, ValueError, TypeError) as e:
            logger.exception("MISO provider error")
            msg = f"MISO research failed: {e}"
            raise ProviderError(msg) from e

    async def _call_imc_cabinet_filler(
        self,
        config: ProviderConfig,
        generation_type: str,
        input_data: dict[str, Any],
        *,
        generation_category: str | None = None,
    ) -> dict[str, Any]:
        """ИМК «Заполнитель»: отдельный провайдер, не MISO."""
        try:
            from api.services.ugs.providers.imc_cabinet_filler_provider import ImcCabinetFillerProvider
        except ImportError:
            from .providers.imc_cabinet_filler_provider import ImcCabinetFillerProvider

        final_url = ugs_resolve_text_llm_base_url(config.base_url)

        if self._imc_cabinet_filler_provider is None or self._imc_cabinet_filler_provider.llama_base_url != final_url:
            if self._imc_cabinet_filler_provider is not None:
                await self._imc_cabinet_filler_provider.close()
            self._imc_cabinet_filler_provider = ImcCabinetFillerProvider(llama_base_url=final_url)
            await self._imc_cabinet_filler_provider.initialize()

        gen_key = str(generation_type or "").strip()
        try:
            payload = dict(input_data)
            payload["ugs_type_key"] = gen_key
            if not input_data.get("model"):
                resolved_model = await UGSModelRoutingService(self.db).resolve_for_type(
                    type_key=gen_key,
                    provider_name=config.provider_name,
                    category=generation_category,
                    provider_config=config.config_json if isinstance(config.config_json, dict) else {},
                )
                if resolved_model.model:
                    payload["model"] = resolved_model.model

            result = await self._imc_cabinet_filler_provider.generate(payload)
            metadata = result.get("metadata", {}) if isinstance(result, dict) else {}

            return {
                "provider": "imc_cabinet_filler_provider",
                "generation_type": gen_key,
                "timestamp": datetime.now(UTC).isoformat(),
                "result": result,
                "metadata": metadata,
            }
        except (TimeoutError, aiohttp.ClientError, OSError, RuntimeError, ValueError, TypeError) as e:
            logger.exception("ImcCabinetFiller provider error")
            msg = f"ImcCabinetFiller failed: {e}"
            raise ProviderError(msg) from e

    async def _call_imc_rag_research(
        self,
        config: ProviderConfig,
        generation_type: str,
        input_data: dict[str, Any],
        *,
        generation_category: str | None = None,
    ) -> dict[str, Any]:
        """ИМК markdown-исследования (RAG-only), не MISO."""
        try:
            from api.services.ugs.providers.imc_rag_research_provider import ImcRagResearchProvider
        except ImportError:
            from .providers.imc_rag_research_provider import ImcRagResearchProvider

        final_url = ugs_resolve_text_llm_base_url(config.base_url)

        if self._imc_rag_research_provider is None or self._imc_rag_research_provider.llama_base_url != final_url:
            if self._imc_rag_research_provider is not None:
                await self._imc_rag_research_provider.close()
            self._imc_rag_research_provider = ImcRagResearchProvider(llama_base_url=final_url)
            await self._imc_rag_research_provider.initialize()

        gen_key = str(generation_type or "").strip()
        try:
            payload = dict(input_data)
            payload["ugs_type_key"] = gen_key
            if not input_data.get("model"):
                resolved_model = await UGSModelRoutingService(self.db).resolve_for_type(
                    type_key=gen_key,
                    provider_name=config.provider_name,
                    category=generation_category,
                    provider_config=config.config_json if isinstance(config.config_json, dict) else {},
                )
                if resolved_model.model:
                    payload["model"] = resolved_model.model

            result = await self._imc_rag_research_provider.generate(
                payload,
                on_progress=self._execute_progress_callback,
                db=self.db,
                user_id=self._current_user_id,
            )
            metadata = result.get("metadata", {}) if isinstance(result, dict) else {}

            return {
                "provider": "imc_rag_research_provider",
                "generation_type": gen_key,
                "timestamp": datetime.now(UTC).isoformat(),
                "result": result,
                "metadata": metadata,
            }
        except httpx.ReadTimeout as e:
            logger.exception("ImcRagResearch Llama HTTP read timeout")
            sec = float(getattr(unified_settings, "imc_rag_llama_generate_timeout_seconds", 1200.0) or 1200.0)
            msg = (
                f"Llama не ответил за {int(sec)} с (HTTP read timeout). "
                "Часто при большом num_predict или когда несколько генераций делят одну GPU. "
                "Увеличьте IMC_RAG_LLAMA_GENERATE_TIMEOUT_SEC в env API/воркера или не запускайте несколько тяжёлых ИМК одновременно."
            )
            raise ProviderError(msg) from e
        except (TimeoutError, aiohttp.ClientError, OSError, RuntimeError, ValueError, TypeError) as e:
            logger.exception("ImcRagResearch provider error")
            msg = f"ImcRagResearch failed: {e}"
            raise ProviderError(msg) from e

    async def _call_localai(self, generation_type: str, input_data: dict[str, Any]) -> dict[str, Any]:
        """Call LocalAI provider"""
        if self._localai_provider is None:
            from .providers.localai_provider import LocalAIProvider

            self._localai_provider = LocalAIProvider()
            await self._localai_provider.initialize()

        logger.info("LocalAI call: %s with data keys: %s", generation_type, list(input_data.keys()))

        try:
            if generation_type.startswith("text_"):
                result = await self._localai_provider.text_generation(**input_data)
                return dict(result) if result else {}
            if generation_type.startswith("vision_"):
                result = await self._localai_provider.vision_analysis(**input_data)
                return dict(result) if result else {}
            if generation_type.startswith("multimodal_"):
                result = await self._localai_provider.multimodal_generation(**input_data)
                return dict(result) if result else {}
            result = await self._localai_provider.chat_completion(
                messages=[{"role": "user", "content": input_data.get("prompt", "")}]
            )
            return dict(result) if result else {}
        except (TimeoutError, aiohttp.ClientError, OSError) as e:
            logger.exception("LocalAI provider error")
            raise ProviderError(str(e)) from e

    async def _get_or_create_openwebui_provider(self, base_url: str) -> Any:
        from .providers.openwebui_provider import OpenWebUIProvider

        normalized = str(base_url or "").strip().rstrip("/")
        cached = self._openwebui_provider
        if cached is not None and str(getattr(cached, "base_url", "") or "").rstrip("/") == normalized:
            return cached
        if cached is not None:
            with contextlib.suppress(Exception):
                await cached.close()
        provider = OpenWebUIProvider(base_url=normalized or None)
        await provider.initialize()
        self._openwebui_provider = provider
        return provider

    async def _call_openwebui(
        self,
        config: ProviderConfig,
        generation_type: str,
        input_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Call OpenWebUI provider using the same base_url as health probes."""
        catalog = getattr(unified_settings, "openwebui", None)
        catalog_url = str(getattr(catalog, "internal_url", "") or "").strip().rstrip("/")
        seed_fallback = "http://stack0-openwebui:8080"
        resolved_base = str(config.base_url or "").strip().rstrip("/") or catalog_url or seed_fallback
        self._openwebui_provider = await self._get_or_create_openwebui_provider(resolved_base)

        if self._openwebui_provider is None:
            msg = "OpenWebUI provider not initialized"
            raise RuntimeError(msg)
        logger.info(
            "OpenWebUI call: %s base_url=%s data keys: %s",
            generation_type,
            resolved_base,
            list(input_data.keys()),
        )

        try:
            if generation_type.startswith("rag_"):
                result = await self._openwebui_provider.rag_query(**input_data)
                return dict(result) if result else {}
            if generation_type.startswith("web_search_"):
                from api.services.ugs import provider_manager_service_v2 as _pms_v2

                if input_data.get("use_web_search") is not True:
                    return {
                        "content": "Web search is disabled for this generation. Set use_web_search=true to opt in.",
                        "metadata": {"web_search_skipped": True, "reason": "use_web_search_false"},
                    }
                runtime = await _pms_v2.resolve_effective_search_runtime_config(self.db, surface="ugs")
                if not runtime.surface_enabled:
                    return {
                        "content": "Web search is disabled by administrator for UGS routes.",
                        "metadata": {"web_search_skipped": True, "reason": "surface_disabled"},
                    }
                if not self._current_user_id:
                    return {
                        "content": "Web search requires authenticated user context.",
                        "metadata": {"web_search_skipped": True, "reason": "missing_user_context"},
                    }
                if runtime.quota_enforced:
                    try:
                        await _pms_v2.try_consume_web_search_quota(self.db, UUID(self._current_user_id))
                    except WebSearchQuotaExceededError as exc:
                        return {
                            "content": format_quota_denied_user_message(exc.status),
                            "metadata": {"web_search_skipped": True, "reason": "quota_exceeded"},
                        }
                provider_payload = {k: v for k, v in input_data.items() if k != "use_web_search"}
                query = str(provider_payload.get("query") or "").strip()
                if query:
                    from api.services.kbsew.kbsew_agent_runtime import resolve_kbsew_context_for_surface

                    kbsew_block = await resolve_kbsew_context_for_surface(
                        agent_id="ugs",
                        query=query,
                        db=self.db,
                        max_total_chars=3500,
                    )
                    if kbsew_block:
                        provider_payload["query"] = f"{query}\n\n{kbsew_block}"
                result = await self._openwebui_provider.web_search_chat(**provider_payload)
                return dict(result) if result else {}
            if generation_type.startswith("document_qa"):
                result = await self._openwebui_provider.document_qa(**input_data)
                return dict(result) if result else {}
            result = await self._openwebui_provider.chat_with_rag(
                messages=[{"role": "user", "content": input_data.get("query", "")}]
            )
            return dict(result) if result else {}
        except (TimeoutError, aiohttp.ClientError, OSError) as e:
            logger.exception("OpenWebUI provider error")
            raise ProviderError(str(e)) from e
