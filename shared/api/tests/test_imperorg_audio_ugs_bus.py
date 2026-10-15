# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract lock: ImperorG optional audio phase goes through UnifiedGenerationService, not ComfyUIProvider.
# Invariants:
# - No live ComfyUI/Postgres; mocks only.
# Related:
# - api/services/imperorg_service.py
# - documentation/product/UGS-AI-ROUTES-AUDIT.md
# ---
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from api.services.imperorg_service import _IMPERORG_AUDIO_TYPE_KEY, ImperorGContext, ImperorGService


@pytest.mark.asyncio
async def test_phase_audio_uses_ugs_generate_not_comfyui_provider() -> None:
    db = MagicMock()
    service = ImperorGService(db)
    instance = SimpleNamespace(
        id=uuid4(),
        site_topic="Acme",
        site_title="Acme Site",
    )
    ctx = ImperorGContext(
        blueprint={"brandCore": "calm", "heroMood": "soft"},
    )

    ugs = MagicMock()
    ugs.generate = AsyncMock(
        return_value={
            "status": "completed",
            "result": {"audio": [{"data": "QQ==", "filename": "a.mp3"}]},
        }
    )
    ugs.close = AsyncMock()

    with (
        patch(
            "api.services.imperorg_service.UnifiedGenerationService",
            return_value=ugs,
        ) as ugs_ctor,
        patch(
            "api.services.ugs.providers.comfyui_provider.ComfyUIProvider",
            side_effect=AssertionError("ComfyUIProvider must not be constructed"),
        ),
    ):
        events: list[str] = []
        async for chunk in service._phase_audio(ctx, instance, "user-1"):  # noqa: SLF001
            events.append(chunk)

    ugs_ctor.assert_called_once_with(db)
    ugs.generate.assert_awaited_once()
    call_kwargs = ugs.generate.await_args.kwargs
    assert call_kwargs["user_id"] == "user-1"
    assert call_kwargs["type_key"] == _IMPERORG_AUDIO_TYPE_KEY
    assert call_kwargs["input_data"]["lyrics"] == ""
    assert call_kwargs["input_data"]["duration"] == 30
    assert "ambient" in call_kwargs["input_data"]["tags"]
    assert str(call_kwargs["idempotency_key"]).startswith("imperorg:audio:")
    ugs.close.assert_awaited_once()

    assert any('"status": "done"' in e for e in events)
    assert ctx.audio_draft is not None
    assert ctx.audio_draft.get("status") == "completed"


@pytest.mark.asyncio
async def test_phase_audio_reports_error_when_ugs_fails() -> None:
    db = MagicMock()
    service = ImperorGService(db)
    instance = SimpleNamespace(id=uuid4(), site_topic="X", site_title="Y")
    ctx = ImperorGContext()

    ugs = MagicMock()
    ugs.generate = AsyncMock(side_effect=RuntimeError("provider down"))
    ugs.close = AsyncMock()

    with patch(
        "api.services.imperorg_service.UnifiedGenerationService",
        return_value=ugs,
    ):
        events: list[str] = []
        async for chunk in service._phase_audio(ctx, instance, "user-1"):  # noqa: SLF001
            events.append(chunk)

    assert any('"status": "error"' in e for e in events)
    assert ctx.audio_draft is None
    ugs.close.assert_awaited_once()
