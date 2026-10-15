# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve Live Voice / voice-gateway TTS HTTP base_url from generation_providers
# (silero → SILERO_SERVICE_URL env fallback). Piper soft-retired.
# Invariants:
# - Does not change UGS type_key routing; only binds the shared SileroService URL.
# - Short TTL cache avoids a DB round-trip per TTS chunk.
# Related:
# - api/services/voice_gateway_service.py
# - api/core/voice_provider_contract.py
# - documentation/product/ewa/EWA-COMPANION-VOICE-TTS.md
# ---

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

VOICE_TTS_PROVIDER_PREFERENCE: tuple[str, ...] = ("silero",)
_ENV_TTS_URL_KEY = "SILERO_SERVICE_URL"
_CACHE_TTL_SEC = 15.0


@dataclass(frozen=True)
class VoiceTtsEndpoint:
    """Resolved TTS HTTP endpoint for voice-gateway / Live Voice."""

    provider_name: str
    base_url: str
    source: Literal["db", "env"]


_cache_expires_at = 0.0
_cache_endpoint: VoiceTtsEndpoint | None = None


def _normalize_base_url(raw: str | None) -> str:
    return (raw or "").strip().rstrip("/")


def _env_fallback_endpoint() -> VoiceTtsEndpoint:
    url = _normalize_base_url(os.getenv(_ENV_TTS_URL_KEY, ""))
    return VoiceTtsEndpoint(
        provider_name="env",
        base_url=url,
        source="env",
    )


def _pick_preferred(
    rows: dict[str, str],
) -> VoiceTtsEndpoint | None:
    for name in VOICE_TTS_PROVIDER_PREFERENCE:
        url = rows.get(name)
        if url:
            return VoiceTtsEndpoint(provider_name=name, base_url=url, source="db")
    return None


def clear_voice_tts_endpoint_cache() -> None:
    """Test helper: drop resolver cache."""
    global _cache_expires_at, _cache_endpoint
    _cache_expires_at = 0.0
    _cache_endpoint = None


async def _load_enabled_tts_urls(db: AsyncSession) -> dict[str, str]:
    result = await db.execute(
        text(
            """
            SELECT provider_name, base_url
            FROM generation_providers
            WHERE enabled = TRUE
              AND provider_name IN ('silero')
              AND base_url IS NOT NULL
              AND TRIM(base_url::text) <> ''
            """
        )
    )
    out: dict[str, str] = {}
    for row in result.mappings():
        name = str(row["provider_name"] or "").strip().lower()
        url = _normalize_base_url(str(row["base_url"] or ""))
        if name and url:
            out[name] = url
    return out


async def resolve_voice_tts_endpoint(
    db: AsyncSession | None = None,
    *,
    force_refresh: bool = False,
) -> VoiceTtsEndpoint:
    """
    Resolve TTS base_url: enabled DB silero → SILERO_SERVICE_URL.

    When ``db`` is None, opens a short postgres session for the lookup.
    On DB errors, falls back to env without raising.
    """
    global _cache_expires_at, _cache_endpoint

    now = time.monotonic()
    if not force_refresh and _cache_endpoint is not None and now < _cache_expires_at and _cache_endpoint.base_url:
        return _cache_endpoint

    endpoint: VoiceTtsEndpoint | None = None
    try:
        if db is not None:
            rows = await _load_enabled_tts_urls(db)
            endpoint = _pick_preferred(rows)
        else:
            from api.core.database_manager import get_database_manager  # noqa: PLC0415

            manager = await get_database_manager()
            async with manager.get_postgres_session() as session:
                rows = await _load_enabled_tts_urls(session)
                endpoint = _pick_preferred(rows)
    except Exception as exc:
        logger.warning(
            "[STEP] voice_tts_endpoint_db_skip — falling back to env: %s",
            exc,
        )
        endpoint = None

    if endpoint is None or not endpoint.base_url:
        endpoint = _env_fallback_endpoint()

    _cache_endpoint = endpoint
    _cache_expires_at = now + _CACHE_TTL_SEC
    logger.info(
        "[STEP] voice_tts_endpoint provider=%s url=%s source=%s",
        endpoint.provider_name,
        endpoint.base_url or "<empty>",
        endpoint.source,
    )
    return endpoint


async def bind_silero_service_url(
    service: Any | None = None,
    *,
    db: AsyncSession | None = None,
    force_refresh: bool = False,
) -> VoiceTtsEndpoint:
    """Resolve endpoint and assign ``service.service_url`` on the shared TTS client."""
    from api.services.unified_audio_service import get_silero_service  # noqa: PLC0415

    endpoint = await resolve_voice_tts_endpoint(db, force_refresh=force_refresh)
    svc = service if service is not None else get_silero_service()
    next_url = endpoint.base_url
    prev = _normalize_base_url(getattr(svc, "service_url", None))
    if next_url and prev != next_url:
        svc.service_url = next_url
        logger.info(
            "[STEP] voice_tts_service_url_bound provider=%s url=%s (was=%s)",
            endpoint.provider_name,
            next_url,
            prev or "<empty>",
        )
    elif not next_url:
        logger.warning(
            "[STEP] voice_tts_endpoint_empty provider=%s source=%s",
            endpoint.provider_name,
            endpoint.source,
        )
    return endpoint
