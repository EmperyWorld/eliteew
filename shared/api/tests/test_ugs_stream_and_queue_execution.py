# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for extracted UGS stream loop and queue worker execution (no live DB/Redis).
# Related:
# - api/services/ugs/direct_generation_execution.py
# - api/services/ugs/stream_generation_runtime.py
# - api/services/ugs/queue_worker_execution.py
# ---
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.services.ugs.direct_generation_execution import run_direct_generation
from api.services.ugs.queue_worker_execution import run_process_queued_request
from api.services.ugs.stream_generation_runtime import iter_stream_generation_events


@pytest.mark.asyncio
async def test_iter_stream_generation_events_emits_result_on_completed() -> None:
    calls = {"status": 0}

    async def get_status(_request_id: str) -> dict:
        calls["status"] += 1
        if calls["status"] == 1:
            return {"status": "processing", "progress": 50}
        return {"status": "completed", "progress": 100}

    async def get_result(_request_id: str) -> dict:
        return {"result": {"ok": True}, "result_preview": {"ok": True}, "metadata": {}}

    events = []
    async for ev in iter_stream_generation_events(
        request_id="req-1",
        get_status=get_status,
        get_result=get_result,
        poll_interval=0.01,
        keep_alive_interval=999.0,
    ):
        events.append(ev)

    assert events[-1]["event"] == "result"
    assert events[-1]["status"] == "completed"


@pytest.mark.asyncio
async def test_run_process_queued_request_skips_when_lease_held() -> None:
    service = MagicMock()
    service._get_request_with_type = AsyncMock(
        return_value=SimpleNamespace(
            status="pending",
            user_id="u1",
            generation_type=SimpleNamespace(type_key="text_chat", provider="llama"),
        )
    )
    service._normalize_status = MagicMock(return_value="pending")

    with patch(
        "api.services.ugs.queue_worker_execution.acquire_ugs_worker_lease",
        new=AsyncMock(return_value=(False, None)),
    ):
        out = await run_process_queued_request(service, "req-lease")

    assert out["status"] == "skipped"
    assert out["reason"] == "worker_lease_held"
    service._process_direct_generation.assert_not_called()


@pytest.mark.asyncio
async def test_run_process_queued_request_short_circuits_terminal() -> None:
    service = MagicMock()
    service._get_request_with_type = AsyncMock(
        return_value=SimpleNamespace(
            status="completed",
            generation_type=SimpleNamespace(type_key="t"),
        )
    )
    service._normalize_status = MagicMock(return_value="completed")

    out = await run_process_queued_request(service, "req-done")
    assert out == {"request_id": "req-done", "status": "completed"}


@pytest.mark.asyncio
async def test_run_direct_generation_fails_empty_provider_payload() -> None:
    service = MagicMock()
    service.provider_manager.initialize = AsyncMock()
    service.provider_manager.execute_generation = AsyncMock(return_value={})
    service.provider_manager.set_execute_progress_callback = MagicMock()
    service.db.commit = AsyncMock()
    service.queue_manager.update_queue_status = AsyncMock()
    service.metrics_service.record_generation_complete = AsyncMock()
    service._serialize_request_metadata = MagicMock(return_value={})
    service._update_request_lifecycle = MagicMock()
    service._log_lifecycle = MagicMock()

    request = SimpleNamespace(
        id="req-empty",
        input_data={"prompt": "render"},
        project_id=None,
        company_id=None,
        retry_count=0,
        status="pending",
    )
    generation_type = SimpleNamespace(
        type_key="image_banner",
        provider="stable_diffusion",
        category="image",
        estimated_time=1,
    )

    with pytest.raises(ValueError, match="пустой результат"):
        await run_direct_generation(service, request, generation_type, "user-1")

    assert request.status == "failed"
    assert request.error_message == "AI-провайдер вернул пустой результат."
    service.queue_manager.update_queue_status.assert_awaited_with("req-empty", "failed")
    service.metrics_service.record_generation_complete.assert_awaited()
    complete_call = service.metrics_service.record_generation_complete.await_args
    assert complete_call is not None
    assert complete_call.kwargs["success"] is False
