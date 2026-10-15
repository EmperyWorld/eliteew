# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit locks for Studio GU voice contracts: settings whisper coerce, STT health
# model_size forwarding, process settings merge helper behavior.
# Invariants:
# - whisper_model always equals unified_settings.whisper_model_size after normalize.
# Related:
# - api/services/live_voice_settings_service.py
# - api/services/voice/stt_service.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.services.live_voice_settings_service import (
    LiveVoiceSettingsService,
    validate_and_normalize_settings_row,
)


@pytest.mark.unit
def test_validate_coerces_whisper_model_to_server_loaded() -> None:
    with patch("api.core.unified_config.unified_settings") as settings:
        settings.whisper_model_size = "large-v3"
        settings.default_ai_model = "test-llama"
        row = validate_and_normalize_settings_row(
            {
                **LiveVoiceSettingsService.get_default_settings(),
                "whisper_model": "turbo",
            }
        )
    assert row["whisper_model"] == "large-v3"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_stt_health_check_forwards_model_size() -> None:
    from api.services.voice.stt_service import STTService

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": "healthy",
        "model_size": "large-v3",
        "device": "cuda",
        "model_loaded": True,
    }

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.get = AsyncMock(return_value=mock_resp)

    with patch("api.services.voice.stt_service.httpx.AsyncClient", return_value=mock_client):
        health: dict[str, Any] = await STTService.health_check()

    assert health["status"] == "up"
    assert health["model_size"] == "large-v3"
    assert health["device"] == "cuda"
    assert health["model_loaded"] is True
