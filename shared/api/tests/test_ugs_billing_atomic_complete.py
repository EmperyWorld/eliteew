# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests: UGS completed shares one transaction with credit deduct; cancel refunds only billed rows.
# Invariants:
# - No live Postgres; mocks only.
# Related:
# - api/services/ugs/direct_generation_execution.py
# - api/services/ugs/generation_cancel.py
# - documentation/product/UGS-FLOW-AND-CONFIG.md
# ---
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.services.ugs.direct_generation_execution import (
    UgsBillingFailedError,
    run_direct_generation,
)
from api.services.ugs.generation_cancel import GenerationCancelMixin


@contextmanager
def mute_ugs_notifications() -> Iterator[None]:
    """Patch facade notification factory used by finalize_successful_direct_generation."""
    notify = MagicMock()
    notify.send_to_user = AsyncMock()
    with patch(
        "api.services.ugs.direct_generation_execution.get_notification_service",
        return_value=notify,
    ):
        yield


def _build_service(*, deduct_ok: bool) -> MagicMock:
    service = MagicMock()
    service.provider_manager.initialize = AsyncMock()
    service.provider_manager.execute_generation = AsyncMock(return_value={"result": {"text": "ok"}, "metadata": {}})
    service.provider_manager.set_execute_progress_callback = MagicMock()
    service.db.commit = AsyncMock()
    service.db.rollback = AsyncMock()
    service.db.flush = AsyncMock()
    service.queue_manager.update_queue_status = AsyncMock()
    service.metrics_service.record_generation_complete = AsyncMock()
    service.cache_service.set = AsyncMock()
    service._serialize_request_metadata = MagicMock(return_value={"execution_backend": "direct_provider"})
    service._update_request_lifecycle = MagicMock()
    service._log_lifecycle = MagicMock()
    service._sanitize_generation_result = MagicMock(side_effect=lambda x: x)
    service._enrich_result_with_assets = AsyncMock(side_effect=lambda result, provider=None: result)
    service._persist_result_images_to_shared_storage = AsyncMock(side_effect=lambda result, *_a: result)
    service._estimate_output_size = MagicMock(return_value=12)
    service._to_iso = MagicMock(return_value=None)
    service.billing_service.deduct_credits_without_commit = AsyncMock(return_value=deduct_ok)
    service.billing_service.record_usage = AsyncMock(return_value=True)
    return service


class _CancelHost(GenerationCancelMixin):
    """Typed host for GenerationCancelMixin unit tests (composition attrs declared)."""

    db: Any
    queue_manager: Any
    billing_service: Any
    _normalize_status: Any
    _serialize_request_metadata: Any
    _update_request_lifecycle: Any
    _log_lifecycle: Any

    def __init__(self, request_row: SimpleNamespace) -> None:
        self.db = MagicMock()
        self.db.execute = AsyncMock(
            return_value=SimpleNamespace(scalar_one_or_none=MagicMock(return_value=request_row))
        )
        self.db.commit = AsyncMock()
        self.queue_manager = MagicMock()
        self.queue_manager.remove_from_queue = AsyncMock()
        self.billing_service = MagicMock()
        self.billing_service.refund_credits = AsyncMock(return_value=True)
        self._normalize_status = MagicMock(return_value="processing")
        self._serialize_request_metadata = MagicMock(return_value={})
        self._update_request_lifecycle = MagicMock()
        self._log_lifecycle = MagicMock()


@pytest.mark.asyncio
async def test_run_direct_generation_deducts_before_completed_commit() -> None:
    service = _build_service(deduct_ok=True)
    call_order: list[str] = []

    async def _deduct(user_id: str, amount: int) -> bool:
        call_order.append(f"deduct:{user_id}:{amount}")
        return True

    async def _commit() -> None:
        call_order.append("commit")

    service.billing_service.deduct_credits_without_commit = AsyncMock(side_effect=_deduct)
    service.db.commit = AsyncMock(side_effect=_commit)

    request = SimpleNamespace(
        id="req-bill-ok",
        input_data={"prompt": "hi"},
        project_id=None,
        company_id=None,
        retry_count=0,
        status="pending",
        credits_used=None,
        output_data=None,
        error_message=None,
    )
    generation_type = SimpleNamespace(
        type_key="text_chat",
        provider="llama",
        category="text",
        estimated_time=1,
        cost_credits=7,
        display_name="Chat",
    )

    with mute_ugs_notifications():
        out = await run_direct_generation(service, request, generation_type, "user-1")

    assert out["status"] == "completed"
    assert request.status == "completed"
    assert int(request.credits_used) == 7
    # processing commit happens before execute; deduct must precede the completed commit
    assert "deduct:user-1:7" in call_order
    deduct_idx = call_order.index("deduct:user-1:7")
    assert "commit" in call_order[deduct_idx + 1 :]
    service.billing_service.record_usage.assert_not_awaited()
    service.queue_manager.update_queue_status.assert_awaited_with("req-bill-ok", "completed")


@pytest.mark.asyncio
async def test_run_direct_generation_billing_failed_not_completed() -> None:
    service = _build_service(deduct_ok=False)
    request = SimpleNamespace(
        id="req-bill-fail",
        input_data={"prompt": "hi"},
        project_id=None,
        company_id=None,
        retry_count=0,
        status="pending",
        credits_used=None,
        output_data=None,
        error_message=None,
    )
    generation_type = SimpleNamespace(
        type_key="text_chat",
        provider="llama",
        category="text",
        estimated_time=1,
        cost_credits=5,
        display_name="Chat",
    )

    with mute_ugs_notifications(), pytest.raises(ValueError, match="Недостаточно кредитов"):
        await run_direct_generation(service, request, generation_type, "user-1")

    assert request.status == "failed"
    assert request.credits_used is None
    assert isinstance(request.output_data, dict)
    assert request.output_data.get("result") is None
    assert request.output_data.get("metadata", {}).get("billing_failed") is True
    service.queue_manager.update_queue_status.assert_awaited_with("req-bill-fail", "failed")
    metrics_kwargs = service.metrics_service.record_generation_complete.await_args.kwargs
    assert metrics_kwargs["success"] is False
    assert metrics_kwargs["error_type"] == "billing_failed"
    service.billing_service.record_usage.assert_not_awaited()


@pytest.mark.asyncio
async def test_run_direct_generation_zero_cost_skips_deduct() -> None:
    service = _build_service(deduct_ok=True)
    request = SimpleNamespace(
        id="req-free",
        input_data={"prompt": "hi"},
        project_id=None,
        company_id=None,
        retry_count=0,
        status="pending",
        credits_used=None,
        output_data=None,
        error_message=None,
    )
    generation_type = SimpleNamespace(
        type_key="text_chat",
        provider="llama",
        category="text",
        estimated_time=1,
        cost_credits=0,
        display_name="Chat",
    )

    with mute_ugs_notifications():
        out = await run_direct_generation(service, request, generation_type, "user-1")
    assert out["status"] == "completed"
    service.billing_service.deduct_credits_without_commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_cancel_generation_skips_refund_when_not_billed() -> None:
    host = _CancelHost(
        SimpleNamespace(
            id="req-cancel",
            user_id="user-1",
            status="processing",
            credits_used=None,
            generation_type=SimpleNamespace(type_key="text_chat", cost_credits=9),
        )
    )

    out = await host.cancel_generation("550e8400-e29b-41d4-a716-446655440000", user_id="user-1")
    assert "отменена" in out["message"].lower() or "успешно" in out["message"].lower()
    host.billing_service.refund_credits.assert_not_awaited()


@pytest.mark.asyncio
async def test_cancel_generation_refunds_billed_credits_used() -> None:
    gen_type = SimpleNamespace(type_key="text_chat", cost_credits=9)
    host = _CancelHost(
        SimpleNamespace(
            id="req-cancel-billed",
            user_id="user-1",
            status="processing",
            credits_used=4,
            generation_type=gen_type,
        )
    )

    await host.cancel_generation("550e8400-e29b-41d4-a716-446655440000", user_id="user-1")
    host.billing_service.refund_credits.assert_awaited_once()
    assert host.billing_service.refund_credits.await_args.kwargs["credit_amount"] == 4


def test_ugs_billing_failed_error_is_distinct() -> None:
    err = UgsBillingFailedError("x")
    assert str(err) == "x"
