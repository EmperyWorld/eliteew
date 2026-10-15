#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression test for UGS direct-execution cancellation handling so cancelled provider calls do not stay in
# perpetual `processing`.
# Invariants:
# - `UnifiedGenerationService._process_direct_generation` marks request as `cancelled` on `asyncio.CancelledError`.
# - Queue status update is emitted with `cancelled` for the same request id.
# Related:
# - api/services/ugs/unified_generation_service.py
# ---

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from api.services.ugs.unified_generation_service import UnifiedGenerationService


@pytest.mark.asyncio
async def test_process_direct_generation_marks_request_cancelled_on_provider_cancelled() -> None:
    db = SimpleNamespace(
        commit=AsyncMock(),
        rollback=AsyncMock(),
        execute=AsyncMock(),
    )
    service = UnifiedGenerationService(db, content_service=None)
    service.provider_manager.initialize = AsyncMock()
    service.provider_manager.execute_generation = AsyncMock(side_effect=asyncio.CancelledError())
    service.queue_manager.update_queue_status = AsyncMock(return_value=True)
    service.metrics_service.record_generation_complete = AsyncMock()

    request = SimpleNamespace(
        id=uuid4(),
        user_id="f1b654a6-56a7-4718-ae95-3c7534a3982e",
        status="pending",
        retry_count=0,
        started_at=None,
        completed_at=None,
        updated_at=datetime.now(UTC).replace(tzinfo=None),
        request_metadata={},
        input_data={"lyrics": "stub"},
        output_data=None,
        error_message=None,
        project_id=None,
        company_id=None,
    )
    generation_type = SimpleNamespace(
        provider="comfyui",
        type_key="music_generator_generate_ace_v2",
        category="music",
        estimated_time=60,
        cost_credits=1,
    )

    with pytest.raises(asyncio.CancelledError):
        await service._process_direct_generation(request, generation_type, str(request.user_id))  # noqa: SLF001

    assert request.status == "cancelled"
    assert "cancelled" in str(request.error_message).lower()
    service.queue_manager.update_queue_status.assert_awaited_once_with(str(request.id), "cancelled")
