"""Behavioral tests: EWRP background pipeline failure handling."""

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Assert refund + job finalization when EWRP background tasks raise after billing.
# Invariants:
# - Mirrors `_run_ewrp_pipeline` and slide regen handlers in `api.routers.ewrp`.
# - Pipeline passes job context fields into `EwrpService.run_pipeline`.
# Related:
# - `test_ewrp_queue_resilience.py`, `ewrp.py`
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest


class _FakeSessionCM:
    def __init__(self, db: AsyncMock) -> None:
        self._db = db

    async def __aenter__(self) -> AsyncMock:
        return self._db

    async def __aexit__(self, *_args: object) -> None:
        return None


def _scalar_result(value: object) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def _mount_pipeline_db(monkeypatch: pytest.MonkeyPatch, db: AsyncMock) -> None:
    manager = MagicMock()
    manager.get_postgres_session = MagicMock(return_value=_FakeSessionCM(db))
    get_manager = AsyncMock(return_value=manager)
    monkeypatch.setattr(
        "api.core.database_manager.get_database_manager",
        get_manager,
    )
    monkeypatch.setattr(
        "api.routers.ewrp.get_database_manager",
        get_manager,
    )


@pytest.mark.anyio
async def test_run_ewrp_pipeline_finalizes_on_service_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.ewrp as ewrp

    job_id = uuid4()
    user_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        title="Deck",
        topic="Topic",
        num_slides=5,
        extra_context=None,
        source_content_id=None,
    )

    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_pipeline_db(monkeypatch, db)

    finalize = AsyncMock()
    monkeypatch.setattr(
        "api.services.ewrp_queue_resilience.finalize_ewrp_job_queue_failure",
        finalize,
    )

    class BoomService:
        async def run_pipeline(self, **_kwargs: object) -> None:
            raise RuntimeError("pipeline boom")

    monkeypatch.setattr(ewrp, "EwrpService", BoomService)

    await ewrp._run_ewrp_pipeline(str(job_id), str(user_id))

    finalize.assert_awaited_once()
    args, kwargs = finalize.await_args
    assert args[0] == str(job_id)
    assert args[1] == str(user_id)
    assert "pipeline boom" in str(args[2])
    assert kwargs.get("refund") is True


@pytest.mark.anyio
async def test_run_ewrp_pipeline_skips_finalize_when_job_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.ewrp as ewrp

    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(None))
    _mount_pipeline_db(monkeypatch, db)

    finalize = AsyncMock()
    monkeypatch.setattr(
        "api.services.ewrp_queue_resilience.finalize_ewrp_job_queue_failure",
        finalize,
    )

    await ewrp._run_ewrp_pipeline(str(uuid4()), str(uuid4()))

    finalize.assert_not_awaited()


@pytest.mark.anyio
async def test_run_ewrp_pipeline_passes_extra_context_to_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.ewrp as ewrp

    job_id = uuid4()
    user_id = uuid4()
    source_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        title="Deck",
        topic="Topic",
        num_slides=5,
        extra_context="Enterprise buyers",
        source_content_id=source_id,
    )

    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_pipeline_db(monkeypatch, db)

    captured: dict[str, object] = {}

    class TrackingService:
        async def run_pipeline(self, **kwargs: object) -> None:
            captured.update(kwargs)

    monkeypatch.setattr(ewrp, "EwrpService", TrackingService)

    await ewrp._run_ewrp_pipeline(str(job_id), str(user_id))

    assert captured.get("extra_context") == "Enterprise buyers"
    assert captured.get("source_content_id") == source_id
    assert captured.get("job_id") == job_id


@pytest.mark.anyio
async def test_run_ewrp_slide_image_regen_refunds_and_marks_failed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.ewrp as ewrp

    job_id = uuid4()
    user_id = uuid4()
    gen_type = SimpleNamespace(type_key="image_generation_comfyui", cost_credits=50)
    refund = AsyncMock(return_value=True)

    class FakeBilling:
        def __init__(self, _db: object) -> None:
            self.refund_credits = refund

    monkeypatch.setattr(ewrp, "BillingService", FakeBilling)

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(gen_type),
            MagicMock(),
        ]
    )
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    _mount_pipeline_db(monkeypatch, db)

    class BoomService:
        async def regenerate_slide_image_workflow(self, *_args: object, **_kwargs: object) -> None:
            raise RuntimeError("ugs unavailable")

    monkeypatch.setattr(ewrp, "EwrpService", BoomService)

    await ewrp._run_ewrp_slide_image_regen(
        str(job_id),
        str(user_id),
        0,
        "sunset over mountains",
        50,
        "image_generation_comfyui",
    )

    refund.assert_awaited_once()
    db.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_run_ewrp_slide_text_regen_refunds_and_marks_failed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.routers.ewrp as ewrp

    job_id = uuid4()
    user_id = uuid4()
    gen_type = SimpleNamespace(type_key="ewrp_slide_text_regen", cost_credits=10)
    refund = AsyncMock(return_value=True)

    class FakeBilling:
        def __init__(self, _db: object) -> None:
            self.refund_credits = refund

    monkeypatch.setattr(ewrp, "BillingService", FakeBilling)

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(gen_type),
            MagicMock(),
        ]
    )
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    _mount_pipeline_db(monkeypatch, db)

    class BoomService:
        async def regenerate_slide_text_workflow(self, *_args: object, **_kwargs: object) -> None:
            raise RuntimeError("llm timeout")

    monkeypatch.setattr(ewrp, "EwrpService", BoomService)

    await ewrp._run_ewrp_slide_text_regen(
        str(job_id),
        str(user_id),
        1,
        "make bullets shorter",
        10,
        "ewrp_slide_text_regen",
    )

    refund.assert_awaited_once()
    db.commit.assert_awaited_once()
