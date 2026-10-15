#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.
# Purpose:
# Facade for DB-driven UGS provider orchestration; composes domain mixins.
# Invariants:
# - Import-stable public API: ProviderManagerServiceV2, ProviderConfig, exceptions, session helpers.
# Related:
# - api/services/ugs/unified_generation_service.py
# ---

"""
UGS Provider Manager Service V2 - Database-Driven Provider Management
Updated: 2025-10-22 (Phase 2)
Status: PRODUCTION-READY

Real-time voice (chat, live TTS/STT): use api.services.voice_gateway_service / Voice Gateway
API directly, not UGS — UGS is for async/batch generation; voice through UGS is slow.
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Any

# Re-exported for contract tests that monkeypatch provider_manager_service_v2 module attributes.
import httpx  # type: ignore[import-not-found]  # noqa: F401
from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.search_runtime_config_service import resolve_effective_search_runtime_config
from api.services.studio_comfy_workflows import (
    build_ace_music_v4_sft_workflow,
    build_ace_music_workflow,
    build_music_forge_ace15_mvp_workflow,
)
from api.services.ugs.provider_config_models import (
    AllProvidersFailedError,
    ProviderConfig,
    ProviderError,
    ProviderNotFoundError,
    _normalize_provider_row,
)
from api.services.ugs.provider_execution_comfyui import ProviderExecutionComfyuiMixin
from api.services.ugs.provider_execution_dispatch import ProviderExecutionDispatchMixin
from api.services.ugs.provider_execution_integrations import ProviderExecutionIntegrationsMixin
from api.services.ugs.provider_execution_media import ProviderExecutionMediaMixin
from api.services.ugs.provider_execution_text import ProviderExecutionTextMixin
from api.services.ugs.provider_health_service import ProviderHealthServiceMixin
from api.services.ugs.provider_http_session import (
    ProviderHTTPSessionMixin,
    close_global_http_session,
    get_global_http_session,
)
from api.services.ugs.provider_runtime_seeds import get_runtime_provider_seed, ugs_resolve_text_llm_base_url
from api.services.web_search_quota_service import try_consume_web_search_quota

logger = logging.getLogger(__name__)

# Keep import bindings on this module for contract tests that monkeypatch these names.
_MONKEYPATCH_IMPORT_HOOKS: tuple[object, ...] = (
    resolve_effective_search_runtime_config,
    build_ace_music_v4_sft_workflow,
    build_ace_music_workflow,
    build_music_forge_ace15_mvp_workflow,
    try_consume_web_search_quota,
)

__all__ = [
    "AllProvidersFailedError",
    "ProviderConfig",
    "ProviderError",
    "ProviderManagerServiceV2",
    "ProviderNotFoundError",
    "close_global_http_session",
    "get_global_http_session",
    "get_runtime_provider_seed",
    "ugs_resolve_text_llm_base_url",
]


class ProviderManagerServiceV2(
    ProviderExecutionIntegrationsMixin,
    ProviderExecutionMediaMixin,
    ProviderExecutionTextMixin,
    ProviderExecutionComfyuiMixin,
    ProviderExecutionDispatchMixin,
    ProviderHealthServiceMixin,
    ProviderHTTPSessionMixin,
):
    """Database-driven provider management with fallback support"""

    def __init__(self, db: AsyncSession, content_service: Any | None = None):
        self.db = db
        self.session = None
        self._provider_cache: dict[str, ProviderConfig] = {}
        self._cache_timestamp: datetime | None = None
        self._cache_ttl = timedelta(minutes=5)  # Cache provider configs for 5 minutes
        # Cached provider client instances
        self._stable_diffusion_provider: Any | None = None
        self._supir_provider: Any | None = None
        self._sadtalker_provider: Any | None = None
        self._localai_provider: Any | None = None
        self._openwebui_provider: Any | None = None
        self._silero_service: Any | None = None
        self._comfyui_provider: Any | None = None
        self._comfyui_providers_by_base_url: dict[str, Any] = {}
        self._llama_provider: Any | None = None
        self._miso_provider: Any | None = None
        self._imc_cabinet_filler_provider: Any | None = None
        self._imc_rag_research_provider: Any | None = None
        self._image_cache: dict[str, str | None] = {}
        self._content_service = content_service  # ContentStorageService for saving audio/transcription
        # User context for unified content saving (set during execute_generation)
        self._current_user_id: str | None = None
        self._current_project_id: str | None = None
        self._current_company_id: str | None = None
        self._execute_progress_callback: Callable[[float, str], Awaitable[None]] | None = None

    async def initialize(self) -> None:
        """Initialize the provider manager"""
        if self.session is None:
            # Use global singleton HTTP session to prevent resource leaks
            await self._ensure_http_session()
            logger.debug("ProviderManagerServiceV2 initialized with global HTTP session")

    async def close(self) -> None:
        """
        Close connections and cleanup resources.

        Note: Global HTTP session is NOT closed here as it's shared between instances.
        It's closed during application shutdown via close_global_http_session().
        """
        # Don't close the global session here - it's shared between instances
        # Just clear the reference
        self.session = None

        # Close provider clients if they expose close()
        provider_attrs = [
            "_stable_diffusion_provider",
            "_supir_provider",
            "_sadtalker_provider",
            "_localai_provider",
            "_openwebui_provider",
            "_silero_service",
            "_comfyui_provider",
            "_llama_provider",
            "_miso_provider",
            "_imc_cabinet_filler_provider",
            "_imc_rag_research_provider",
        ]

        closed_count = 0
        failed_count = 0
        seen_provider_ids: set[int] = set()

        for attr in provider_attrs:
            provider = getattr(self, attr, None)
            if provider is None:
                continue

            provider_id = id(provider)
            if provider_id in seen_provider_ids:
                setattr(self, attr, None)
                continue
            seen_provider_ids.add(provider_id)

            close_fn = getattr(provider, "close", None)
            if close_fn is None:
                # Provider doesn't have close method, just clear reference
                setattr(self, attr, None)
                continue

            try:
                result = close_fn()
                if asyncio.iscoroutine(result):
                    await result
                setattr(self, attr, None)
                closed_count += 1
            except (OSError, ValueError, TypeError) as exc:
                logger.warning("Failed to close provider %s: %s", attr, exc)
                failed_count += 1
                # Still clear reference even if close failed
                setattr(self, attr, None)

        for base_url, provider in self._comfyui_providers_by_base_url.items():
            if provider is None:
                continue
            provider_id = id(provider)
            if provider_id in seen_provider_ids:
                continue
            seen_provider_ids.add(provider_id)
            close_fn = getattr(provider, "close", None)
            if close_fn is None:
                continue
            try:
                result = close_fn()
                if asyncio.iscoroutine(result):
                    await result
                closed_count += 1
            except (OSError, ValueError, TypeError) as exc:
                logger.warning(
                    "Failed to close provider _comfyui_providers_by_base_url[%s]: %s",
                    base_url,
                    exc,
                )
                failed_count += 1

        self._comfyui_providers_by_base_url = {}

        if closed_count > 0 or failed_count > 0:
            logger.debug(
                "ProviderManagerServiceV2 cleanup: %s providers closed, %s failed to close",
                closed_count,
                failed_count,
            )

    def set_execute_progress_callback(self, callback: Callable[[float, str], Awaitable[None]] | None) -> None:
        """Async callback (progress 0–100, message) during execute_generation; caller must clear after await."""
        self._execute_progress_callback = callback

    async def __aenter__(self) -> ProviderManagerServiceV2:
        """Async context manager entry"""
        await self.initialize()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,  # BaseException is built-in
        exc: BaseException | None,
        tb: object,
    ) -> bool:
        """Async context manager exit - ensure cleanup"""
        await self.close()
        return False

    async def get_provider_config(self, provider_name: str) -> ProviderConfig:
        """Load provider config from database with caching"""
        # Check cache
        if (
            self._cache_timestamp
            and datetime.now(UTC) - self._cache_timestamp < self._cache_ttl
            and provider_name in self._provider_cache
        ):
            return self._provider_cache[provider_name]

        # Load from database
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
            WHERE provider_name = :name AND enabled = TRUE
        """)

        result = await self.db.execute(query, {"name": provider_name})
        row = result.mappings().one_or_none()

        if not row:
            # Transitional fallback for known runtime providers until DB bootstrap is completed.
            config = self._default_provider_config(provider_name)
            if config is not None:
                return config
            msg = f"Provider {provider_name} not found or disabled"
            raise ProviderNotFoundError(msg)

        config = ProviderConfig(_normalize_provider_row(dict(row)))

        # Update cache
        self._provider_cache[provider_name] = config
        self._cache_timestamp = datetime.now(UTC)

        return config

    def _default_provider_config(self, provider_name: str) -> ProviderConfig | None:
        """Return fallback config for a known runtime provider when DB row is missing."""
        default_seed = get_runtime_provider_seed(provider_name)
        return ProviderConfig(default_seed) if default_seed is not None else None

    async def get_available_providers(self, generation_type: str | None = None) -> list[dict[str, Any]]:
        """Return all providers from DB for status overview.
        Health check is done by the router; we include everyone so unhealthy providers are visible too.

        When every DB row is missing or disabled, the overview would otherwise be empty while
        `generation_types` still references providers — merge runtime seeds from
        `get_bootstrap_provider_seeds()` so operators still see expected endpoints (and can re-enable rows).
        """
        query = text("""
            SELECT
                provider_name,
                provider_type,
                base_url,
                max_concurrent,
                config_json,
                cost_per_request,
                display_label
            FROM generation_providers
            WHERE enabled = TRUE
            ORDER BY provider_name
        """)

        result = await self.db.execute(query)
        providers = [dict(row._mapping) for row in result]

        # Return list for router to run check_provider_status on each (all from DB, like ComfyUI)
        merged: list[dict[str, Any]] = [
            {
                "name": p["provider_name"],
                "type": p["provider_type"],
                "base_url": p["base_url"],
                "max_concurrent": p.get("max_concurrent"),
                "cost_per_request": p.get("cost_per_request"),
                "config": p.get("config_json"),
                "display_label": p.get("display_label"),
            }
            for p in providers
        ]
        names = {entry["name"] for entry in merged}
        for seed in await self.get_bootstrap_provider_seeds():
            pname_raw = seed.get("provider_name")
            pname = pname_raw.strip() if isinstance(pname_raw, str) else ""
            if not pname or pname in names:
                continue
            merged.append(
                {
                    "name": pname,
                    "type": seed.get("provider_type"),
                    "base_url": seed.get("base_url"),
                    "max_concurrent": seed.get("max_concurrent"),
                    "cost_per_request": seed.get("cost_per_request"),
                    "config": seed.get("config_json"),
                    "display_label": seed.get("display_label"),
                }
            )
            names.add(pname)

        # ComfyUI is often absent from `generation_types.provider` on trimmed DBs while the media stack
        # is still deployed; without this, `/providers/status` and the UGS hub health strip hide it.
        for pname in ("comfyui",):
            if pname in names:
                continue
            seed = get_runtime_provider_seed(pname)
            if seed is None:
                continue
            merged.append(
                {
                    "name": pname,
                    "type": seed.get("provider_type"),
                    "base_url": seed.get("base_url"),
                    "max_concurrent": seed.get("max_concurrent"),
                    "cost_per_request": seed.get("cost_per_request"),
                    "config": seed.get("config_json"),
                    "display_label": seed.get("display_label"),
                }
            )
            names.add(pname)
        merged.sort(key=lambda x: str(x.get("name") or ""))
        return merged

    async def get_bootstrap_provider_seeds(self) -> list[dict[str, Any]]:
        """Build missing runtime provider rows from generation_types/provider usage."""
        query = text("""
            SELECT DISTINCT provider
            FROM generation_types
            WHERE is_active = TRUE
              AND provider IS NOT NULL
              AND provider <> ''
              AND provider NOT IN (
                  SELECT provider_name
                  FROM generation_providers
                  WHERE enabled = TRUE
              )
            ORDER BY provider
        """)
        result = await self.db.execute(query)
        seeds: list[dict[str, Any]] = []
        for row in result:
            provider_name = row[0]
            if not isinstance(provider_name, str):
                continue
            seed = get_runtime_provider_seed(provider_name)
            if seed is not None:
                seeds.append({"provider_name": provider_name, **seed})
        return seeds

    async def load_comfyui_workflow_template_json(self, workflow_slug: str | None) -> dict[str, Any] | None:
        if workflow_slug is None or not workflow_slug.strip():
            return None

        query = text("""
            SELECT json_body
            FROM comfyui_workflows
            WHERE is_active = TRUE
              AND slug = :slug
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT 1
        """)
        result = await self.db.execute(query, {"slug": workflow_slug.strip()})
        row = result.mappings().one_or_none()
        if row is None:
            return None

        workflow_data = row.get("json_body")
        return workflow_data if isinstance(workflow_data, dict) else None
