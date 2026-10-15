# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# O3b chat completions for the active AI provider (json + stream) via OpenAI-compat helpers.
# Invariants:
# - Fail closed when probe/model/API key missing; never log third-party keys.
# - Pack allowlist hard floor via get_active_ai_provider_snapshot.
# Related:
# - api/utils/llm_openai_compat_http.py
# - documentation/platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md §5
# ---

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Mapping
from dataclasses import dataclass
from typing import Any

import httpx

from api.services.ai_provider_router.policy import (
    AiProviderKind,
    AiProviderNotConfiguredError,
)
from api.services.ai_provider_router.runtime import (
    get_active_ai_provider_snapshot,
    probe_provider,
)
from api.utils.llm_openai_compat_http import (
    httpx_compat_chat_completion_json,
    httpx_compat_chat_completion_stream,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class AiProviderCompletionEndpoint:
    """Resolved completion target for one policy-selected provider."""

    kind: AiProviderKind
    base_url: str
    model: str
    #: Bearer token for third-party only; never logged.
    api_key: str | None = None


def _third_party_api_key() -> str:
    from api.core.unified_config import unified_settings

    try:
        return str(getattr(unified_settings, "eliteew_ai_third_party_api_key", "") or "").strip()
    except Exception:
        return ""


def resolve_active_completion_endpoint(
    *,
    user_preference: str | AiProviderKind | None = None,
) -> AiProviderCompletionEndpoint:
    """Map policy + O3a probe → call endpoint; fail closed if not callable."""
    snap = get_active_ai_provider_snapshot(user_preference=user_preference)
    probe = probe_provider(snap.provider)
    base = str(getattr(probe, "base_url", "") or "").strip()
    model = str(getattr(probe, "model", "") or "").strip()
    if not probe.is_configured() or not base:
        raise AiProviderNotConfiguredError(f"AI provider {snap.provider.value} base URL is not configured")
    if not model:
        raise AiProviderNotConfiguredError(f"AI provider {snap.provider.value} model is not configured")

    api_key: str | None = None
    if snap.provider is AiProviderKind.THIRD_PARTY:
        api_key = _third_party_api_key()
        if not api_key:
            raise AiProviderNotConfiguredError(
                "ai.third_party API key is not configured (ELITEEW_AI_THIRD_PARTY_API_KEY)"
            )

    return AiProviderCompletionEndpoint(
        kind=snap.provider,
        base_url=base,
        model=model,
        api_key=api_key,
    )


def _httpx_headers(endpoint: AiProviderCompletionEndpoint) -> dict[str, str]:
    if endpoint.api_key:
        return {"Authorization": f"Bearer {endpoint.api_key}"}
    return {}


async def chat_completion_json(
    messages: list[dict[str, Any]],
    *,
    user_preference: str | AiProviderKind | None = None,
    options: Mapping[str, Any] | None = None,
    timeout_sec: float = 120.0,
) -> dict[str, Any]:
    """Non-streaming chat via active provider; returns httpx_compat response dict."""
    endpoint = resolve_active_completion_endpoint(user_preference=user_preference)
    logger.debug(
        "[STEP] ai_provider_chat_json kind=%s model=%s",
        endpoint.kind.value,
        endpoint.model,
    )
    timeout = httpx.Timeout(timeout_sec)
    async with httpx.AsyncClient(headers=_httpx_headers(endpoint)) as client:
        return await httpx_compat_chat_completion_json(
            client,
            endpoint.base_url,
            model=endpoint.model,
            messages=messages,
            options=dict(options) if options else None,
            timeout=timeout,
        )


async def chat_completion_stream(
    messages: list[dict[str, Any]],
    *,
    user_preference: str | AiProviderKind | None = None,
    options: Mapping[str, Any] | None = None,
    timeout_sec: float = 120.0,
) -> AsyncIterator[str]:
    """Streaming chat deltas via active provider (non-empty text chunks)."""
    endpoint = resolve_active_completion_endpoint(user_preference=user_preference)
    logger.debug(
        "[STEP] ai_provider_chat_stream kind=%s model=%s",
        endpoint.kind.value,
        endpoint.model,
    )
    timeout = httpx.Timeout(timeout_sec)
    async with httpx.AsyncClient(headers=_httpx_headers(endpoint)) as client:
        async for piece in httpx_compat_chat_completion_stream(
            client,
            endpoint.base_url,
            model=endpoint.model,
            messages=messages,
            options=dict(options) if options else None,
            timeout=timeout,
        ):
            yield piece
