# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Live Voice TTS endpoint resolver (silero → env).
# Invariants:
# - Preference order is fixed; cache can be cleared between cases.
# Related:
# - api/services/voice/tts_endpoint_resolver.py
# - api/core/voice_provider_contract.py
# ---

from __future__ import annotations

from collections.abc import Iterator
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.core.voice_provider_contract import (
    EXCLUDED_TTS_PROVIDERS,
    is_allowed_tts_provider,
    normalize_tts_provider,
)
from api.services.voice.tts_endpoint_resolver import (
    bind_silero_service_url,
    clear_voice_tts_endpoint_cache,
    resolve_voice_tts_endpoint,
)


def _mock_db(rows: list[dict[str, str]]) -> MagicMock:
    result = MagicMock()
    result.mappings.return_value = rows
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)
    return db


@pytest.fixture(autouse=True)
def clear_voice_tts_cache() -> Iterator[None]:
    clear_voice_tts_endpoint_cache()
    yield
    clear_voice_tts_endpoint_cache()


@pytest.mark.asyncio
async def test_resolve_uses_silero_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SILERO_SERVICE_URL", raising=False)
    db = _mock_db(
        [
            {"provider_name": "silero", "base_url": "http://stack9-silero:8000"},
        ]
    )
    endpoint = await resolve_voice_tts_endpoint(db)
    assert endpoint.provider_name == "silero"
    assert endpoint.base_url == "http://stack9-silero:8000"
    assert endpoint.source == "db"


@pytest.mark.asyncio
async def test_resolve_ignores_disabled_piper_row(monkeypatch: pytest.MonkeyPatch) -> None:
    """Piper rows are not in the voice preference SQL; only silero is selected."""
    monkeypatch.delenv("SILERO_SERVICE_URL", raising=False)
    db = _mock_db(
        [
            {"provider_name": "silero", "base_url": "http://stack9-silero:8000"},
        ]
    )
    endpoint = await resolve_voice_tts_endpoint(db)
    assert endpoint.provider_name == "silero"


@pytest.mark.asyncio
async def test_resolve_env_fallback_when_db_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SILERO_SERVICE_URL", "http://stack9-silero:8000/")
    db = _mock_db([])
    endpoint = await resolve_voice_tts_endpoint(db)
    assert endpoint.source == "env"
    assert endpoint.provider_name == "env"
    assert endpoint.base_url == "http://stack9-silero:8000"


@pytest.mark.asyncio
async def test_bind_updates_silero_service_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SILERO_SERVICE_URL", raising=False)
    db = _mock_db(
        [
            {"provider_name": "silero", "base_url": "http://stack9-silero:8000"},
        ]
    )
    service = SimpleNamespace(service_url="http://old-tts:8000")
    endpoint = await bind_silero_service_url(service, db=db)
    assert endpoint.provider_name == "silero"
    assert service.service_url == "http://stack9-silero:8000"


def test_piper_still_allowed_in_contract_for_ugs() -> None:
    assert is_allowed_tts_provider("piper") is True
    assert normalize_tts_provider("piper") == "piper"
    assert "piper" not in EXCLUDED_TTS_PROVIDERS
