# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests: stack0 KBSEW client maps HTTP 409 index_stale to typed errors.
# Invariants:
# - Opaque "request failed (409)" must not be the only signal for stale indexes.
# Related:
# - api/services/kbsew/kbsew_client.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.services.kbsew.kbsew_client import (
    KbsewIndexStaleError,
    kbsew_search_barrel,
)


@pytest.mark.asyncio
async def test_kbsew_search_maps_index_stale_409() -> None:
    response = MagicMock()
    response.status_code = 409
    response.text = (
        '{"detail":{"code":"index_stale","message":"Index stale",'
        '"stale_assets":3,"required_pipeline":"kbsew-ingest-v3"}}'
    )

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.post = AsyncMock(return_value=response)

    with patch("api.services.kbsew.kbsew_client.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(KbsewIndexStaleError) as exc_info:
            await kbsew_search_barrel(
                query="бренд",
                barrel_id="da11ce9f-1d46-4747-8112-7210ebf9f6f2",
                limit=5,
            )

    err = exc_info.value
    assert err.stale_assets == 3
    assert err.required_pipeline == "kbsew-ingest-v3"


@pytest.mark.asyncio
async def test_prefetch_injects_stale_note_instead_of_silent_skip() -> None:
    from api.services.kbsew.kbsew_prefetch import prefetch_kbsew_outcome

    defaults = {
        "kbsew_search_settings": {
            "enabled": True,
            "allowed_barrels": ["da11ce9f-1d46-4747-8112-7210ebf9f6f2"],
            "agents": {"desktop": True},
            "chunks_per_barrel": 5,
            "rerank_enabled": False,
        }
    }
    with patch(
        "api.services.kbsew.kbsew_prefetch.kbsew_search_with_settings",
        new=AsyncMock(
            side_effect=KbsewIndexStaleError(
                "stale",
                stale_assets=1,
                required_pipeline="kbsew-ingest-v3",
            )
        ),
    ):
        outcome = await prefetch_kbsew_outcome(
            query="маркетинг бренд",
            agent_id="desktop",
            defaults=defaults,
        )
    assert outcome.status == "stale"
    assert outcome.barrels_stale == 1
    assert outcome.block is not None
    assert "обновляется" in outcome.block.lower()
    summary = outcome.as_summary(agent_id="desktop")
    assert summary["kbsew_prefetch_status"] == "stale"
    assert summary["kbsew_prefetch_applied"] is True
