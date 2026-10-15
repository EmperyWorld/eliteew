# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for the EWRP FastAPI router without a real database or RabbitMQ.
# Invariants:
# - Tests stub persistence/billing boundaries and assert HTTP contract behavior.
# - PDF access tests must cover both authenticated ownership and tokenized direct links.
# Related:
# - api/routers/ewrp.py
# - documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md
# ---
"""Контрактные проверки роутера EWRP (без реальной БД/RabbitMQ)."""

from __future__ import annotations

import sys
from types import ModuleType, SimpleNamespace
from typing import Protocol
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.schemas.ewrp import EwrpCreateResponse


class _TrackedBilling(Protocol):
    record_usage: AsyncMock
    refund_credits: AsyncMock


def _ensure_tenacity_stub() -> None:
    """Minimal tenacity stub so `api.core.oauth2_auth` imports in contract tests."""
    if "tenacity" in sys.modules:
        return
    stub = ModuleType("tenacity")

    def _passthrough_decorator(*_args: object, **_kwargs: object):
        def _wrap(fn: object) -> object:
            return fn

        return _wrap

    setattr(stub, "RetryError", Exception)
    setattr(stub, "retry", _passthrough_decorator)
    setattr(stub, "retry_if_exception_type", lambda *_a, **_k: None)
    setattr(stub, "stop_after_attempt", lambda *_a, **_k: None)
    setattr(stub, "wait_exponential", lambda *_a, **_k: None)
    sys.modules["tenacity"] = stub


def _fake_user() -> SimpleNamespace:
    uid = uuid4()
    return SimpleNamespace(id=str(uid))


def _scalar_result(value: object) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def _scalars_result(items: list[object]) -> MagicMock:
    result = MagicMock()
    scalars = MagicMock()
    scalars.all.return_value = items
    result.scalars.return_value = scalars
    return result


@pytest.fixture
def ewrp_app(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    _ensure_tenacity_stub()
    import api.routers.ewrp as ewrp

    class FakeBilling:
        def __init__(self, _db: object) -> None:
            self.check_limits = AsyncMock()
            self.record_usage = AsyncMock(return_value=True)
            self.refund_credits = AsyncMock(return_value=True)

    monkeypatch.setattr(ewrp, "BillingService", FakeBilling)
    monkeypatch.setattr(ewrp, "is_queue_enabled", lambda *_a, **_k: False)
    monkeypatch.setattr(
        ewrp,
        "get_rabbitmq_service",
        lambda: SimpleNamespace(publish_ai_generation=AsyncMock(return_value=False)),
    )
    monkeypatch.setattr(ewrp, "_run_ewrp_pipeline", AsyncMock())

    app = FastAPI()
    app.include_router(ewrp.router, prefix="/api/v1")
    return app


def _mount_session(app: FastAPI, db: AsyncMock, user: object | None) -> None:
    _ensure_tenacity_stub()
    from api.core.database_manager import get_postgres_session
    from api.core.oauth2_auth import get_optional_oauth2_user

    async def fake_session():
        yield db

    app.dependency_overrides[get_postgres_session] = fake_session
    app.dependency_overrides[get_optional_oauth2_user] = lambda: user


def test_quote_ewrp_unauthorized_401(ewrp_app: FastAPI) -> None:
    db = AsyncMock()
    _mount_session(ewrp_app, db, None)
    with TestClient(ewrp_app) as client:
        r = client.get("/api/v1/ewrp/quote", params={"num_slides": 5})
    assert r.status_code == 401


def test_quote_ewrp_returns_cost_and_allowed(ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    import api.routers.ewrp as ewrp

    class QuoteBilling:
        def __init__(self, _db: object) -> None:
            self.get_available_credits = AsyncMock(return_value=2500)

    monkeypatch.setattr(ewrp, "BillingService", QuoteBilling)

    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=_scalar_result(SimpleNamespace(type_key="ewrp_presentation", cost_credits=200.0))
    )
    _mount_session(ewrp_app, db, _fake_user())
    with TestClient(ewrp_app) as client:
        r = client.get("/api/v1/ewrp/quote", params={"num_slides": 5})
    assert r.status_code == 200
    body = r.json()
    assert body["num_slides"] == 5
    assert body["credits_per_slide"] == 200
    assert body["credit_cost"] == 1000
    assert body["available_credits"] == 2500
    assert body["allowed"] is True


def test_quote_ewrp_not_allowed_when_short(ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    import api.routers.ewrp as ewrp

    class QuoteBilling:
        def __init__(self, _db: object) -> None:
            self.get_available_credits = AsyncMock(return_value=100)

    monkeypatch.setattr(ewrp, "BillingService", QuoteBilling)

    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=_scalar_result(SimpleNamespace(type_key="ewrp_presentation", cost_credits=200.0))
    )
    _mount_session(ewrp_app, db, _fake_user())
    with TestClient(ewrp_app) as client:
        r = client.get("/api/v1/ewrp/quote", params={"num_slides": 5})
    assert r.status_code == 200
    body = r.json()
    assert body["credit_cost"] == 1000
    assert body["allowed"] is False


def test_create_ewrp_unauthorized_401(ewrp_app: FastAPI) -> None:
    db = AsyncMock()
    _mount_session(ewrp_app, db, None)
    with TestClient(ewrp_app) as client:
        r = client.post(
            "/api/v1/ewrp",
            json={"topic": "Test topic for EWRP", "num_slides": 5},
        )
    assert r.status_code == 401


def test_create_ewrp_503_when_billing_type_missing(ewrp_app: FastAPI) -> None:
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(None))
    _mount_session(ewrp_app, db, _fake_user())
    with TestClient(ewrp_app) as client:
        r = client.post(
            "/api/v1/ewrp",
            json={"topic": "Test topic for EWRP", "num_slides": 5},
        )
    assert r.status_code == 503
    assert "ewrp_presentation" in str(r.json().get("detail", ""))


def test_create_ewrp_402_when_insufficient_credits(ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    import api.routers.ewrp as ewrp

    class BrokeBilling:
        def __init__(self, _db: object) -> None:
            self.check_limits = AsyncMock()
            self.record_usage = AsyncMock(return_value=False)
            self.refund_credits = AsyncMock(return_value=True)

    monkeypatch.setattr(ewrp, "BillingService", BrokeBilling)

    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(SimpleNamespace(type_key="ewrp_presentation")))
    _mount_session(ewrp_app, db, _fake_user())
    with TestClient(ewrp_app) as client:
        r = client.post(
            "/api/v1/ewrp",
            json={"topic": "Test topic for EWRP", "num_slides": 5},
        )
    assert r.status_code == 402


def test_create_ewrp_idempotency_replay(ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    import api.routers.ewrp as ewrp

    replay_id = uuid4()

    async def fake_replay(_user_id: UUID, _key: str, _db: object) -> EwrpCreateResponse:
        return EwrpCreateResponse(
            id=replay_id,
            status="queued",
            message="replay",
        )

    monkeypatch.setattr(ewrp, "_ewrp_try_idempotency_replay", fake_replay)

    db = AsyncMock()
    _mount_session(ewrp_app, db, _fake_user())
    with TestClient(ewrp_app) as client:
        r = client.post(
            "/api/v1/ewrp",
            json={"topic": "Test topic for EWRP", "num_slides": 5},
            headers={"Idempotency-Key": "idem-key-12345678"},
        )
    assert r.status_code == 200
    assert r.json()["id"] == str(replay_id)
    db.execute.assert_not_called()


def test_create_ewrp_success_queues_job(ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    import api.routers.ewrp as ewrp

    billing_instances: list[_TrackedBilling] = []

    class TrackingBilling:
        def __init__(self, _db: object) -> None:
            self.check_limits = AsyncMock()
            self.record_usage = AsyncMock(return_value=True)
            self.refund_credits = AsyncMock(return_value=True)
            billing_instances.append(self)

    monkeypatch.setattr(ewrp, "BillingService", TrackingBilling)
    monkeypatch.setattr(ewrp, "_ewrp_remember_idempotency_key", AsyncMock())

    user = _fake_user()
    new_id = uuid4()

    async def fake_refresh(job: object) -> None:
        setattr(job, "id", new_id)

    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(SimpleNamespace(type_key="ewrp_presentation")))
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock(side_effect=fake_refresh)
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(
            "/api/v1/ewrp",
            json={
                "topic": "Test topic for EWRP pipeline",
                "num_slides": 5,
                "presentation_theme": "midnight",
            },
        )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "queued"
    assert body["id"] == str(new_id)
    db.add.assert_called_once()
    db.commit.assert_awaited()
    assert len(billing_instances) == 1
    assert billing_instances[0].record_usage.await_count == 1


def test_create_ewrp_success_persists_extra_context_and_source_content(
    ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    import api.routers.ewrp as ewrp

    monkeypatch.setattr(
        ewrp,
        "BillingService",
        type(
            "FakeBilling",
            (),
            {
                "__init__": lambda self, _db: None,
                "check_limits": AsyncMock(),
                "record_usage": AsyncMock(return_value=True),
                "refund_credits": AsyncMock(return_value=True),
            },
        ),
    )
    monkeypatch.setattr(ewrp, "_ewrp_remember_idempotency_key", AsyncMock())

    user = _fake_user()
    new_id = uuid4()
    source_id = uuid4()
    added: list[object] = []

    async def fake_refresh(job: object) -> None:
        setattr(job, "id", new_id)

    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(SimpleNamespace(type_key="ewrp_presentation")))
    db.add = MagicMock(side_effect=lambda job: added.append(job))
    db.commit = AsyncMock()
    db.refresh = AsyncMock(side_effect=fake_refresh)
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(
            "/api/v1/ewrp",
            json={
                "topic": "Test topic for EWRP with context",
                "num_slides": 5,
                "extra_context": "  Focus on enterprise buyers  ",
                "source_content_id": str(source_id),
            },
        )
    assert r.status_code == 200
    assert len(added) == 1
    job = added[0]
    assert getattr(job, "extra_context") == "Focus on enterprise buyers"
    assert getattr(job, "source_content_id") == source_id


def test_get_ewrp_status_includes_extra_context_and_source_content(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    job_id = uuid4()
    source_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="completed",
        progress=100,
        error_message=None,
        pdf_path="/tmp/deck.pdf",
        slides_json=[{"title": "S1", "bullets": []}],
        topic="Topic",
        title="Title",
        num_slides=5,
        extra_context="Board-ready summary",
        source_content_id=source_id,
        presentation_theme="classic",
        default_slide_layout=None,
        updated_at=None,
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.get(f"/api/v1/ewrp/{job_id}/status")
    assert r.status_code == 200
    body = r.json()
    assert body["extra_context"] == "Board-ready summary"
    assert body["source_content_id"] == str(source_id)


def test_download_ewrp_slide_image_owner(
    ewrp_app: FastAPI,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    job_id = uuid4()
    user = _fake_user()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="completed",
        slides_json=[{"title": "S1", "bullets": [], "image_filename": "slide_1.png"}],
    )
    monkeypatch.setenv("GENERATED_FILES_BASE", str(tmp_path))
    out_dir = tmp_path / "generated_files" / "ewrp" / str(job_id)
    out_dir.mkdir(parents=True)
    (out_dir / "slide_1.png").write_bytes(b"\x89PNG\r\n\x1a\n")

    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_session(ewrp_app, db, user)

    with TestClient(ewrp_app) as client:
        r = client.get(f"/api/v1/ewrp/{job_id}/slides/0/image")

    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/png")
    assert r.content.startswith(b"\x89PNG")


def test_download_ewrp_slide_image_falls_back_to_disk_when_db_filename_missing(
    ewrp_app: FastAPI,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    job_id = uuid4()
    user = _fake_user()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="completed",
        slides_json=[{"title": "S1", "bullets": [], "image_filename": None}],
    )
    monkeypatch.setenv("GENERATED_FILES_BASE", str(tmp_path))
    out_dir = tmp_path / "generated_files" / "ewrp" / str(job_id)
    out_dir.mkdir(parents=True)
    (out_dir / "slide_1.png").write_bytes(b"\x89PNG\r\n\x1a\n")

    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_session(ewrp_app, db, user)

    with TestClient(ewrp_app) as client:
        r = client.get(f"/api/v1/ewrp/{job_id}/slides/0/image")

    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/png")
    assert r.content.startswith(b"\x89PNG")


def test_get_ewrp_status_backfills_ready_slide_images_from_disk(
    ewrp_app: FastAPI,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    user = _fake_user()
    job_id = uuid4()
    monkeypatch.setenv("GENERATED_FILES_BASE", str(tmp_path))
    out_dir = tmp_path / "generated_files" / "ewrp" / str(job_id)
    out_dir.mkdir(parents=True)
    (out_dir / "slide_1.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="completed",
        progress=100,
        error_message=None,
        pdf_path=None,
        slides_json=[{"title": "S1", "bullets": ["A"], "image_filename": None}],
        topic="Topic",
        title="Title",
        num_slides=1,
        extra_context=None,
        source_content_id=None,
        presentation_theme="classic",
        default_slide_layout=None,
        updated_at=None,
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_session(ewrp_app, db, user)

    with TestClient(ewrp_app) as client:
        r = client.get(f"/api/v1/ewrp/{job_id}/status")

    assert r.status_code == 200
    slide = r.json()["slides"][0]
    assert slide["image_filename"] == "slide_1.png"
    assert slide["image_ready"] is True


def test_get_ewrp_status_marks_missing_slide_image_not_ready(
    ewrp_app: FastAPI,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    user = _fake_user()
    job_id = uuid4()
    monkeypatch.setenv("GENERATED_FILES_BASE", str(tmp_path))
    (tmp_path / "generated_files" / "ewrp" / str(job_id)).mkdir(parents=True)
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="completed",
        progress=100,
        error_message=None,
        pdf_path=None,
        slides_json=[{"title": "S1", "bullets": ["A"], "image_filename": "slide_1.png"}],
        topic="Topic",
        title="Title",
        num_slides=1,
        extra_context=None,
        source_content_id=None,
        presentation_theme="classic",
        default_slide_layout=None,
        updated_at=None,
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_session(ewrp_app, db, user)

    with TestClient(ewrp_app) as client:
        r = client.get(f"/api/v1/ewrp/{job_id}/status")

    assert r.status_code == 200
    slide = r.json()["slides"][0]
    assert slide["image_filename"] == "slide_1.png"
    assert slide["image_ready"] is False


def test_download_ewrp_pdf_token_is_reusable_within_ttl(
    ewrp_app: FastAPI,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    """Direct EWA/chat links need the same token for open + download actions."""

    import api.routers.ewrp as ewrp

    job_id = uuid4()

    class FakeRedis:
        def __init__(self) -> None:
            self.store = {f"{ewrp.EWRP_PDF_TOKEN_PREFIX}{job_id}": "token-1"}

        async def get(self, key: str) -> str | None:
            return self.store.get(key)

        async def delete(self, key: str) -> None:
            self.store.pop(key, None)

    pdf_path = tmp_path / "presentation.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n")
    job = SimpleNamespace(
        id=job_id,
        user_id=uuid4(),
        status="completed",
        pdf_path=str(pdf_path),
    )
    redis = FakeRedis()
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    monkeypatch.setattr(
        ewrp,
        "get_database_manager",
        AsyncMock(return_value=SimpleNamespace(get_redis_client=AsyncMock(return_value=redis))),
    )
    _mount_session(ewrp_app, db, None)

    with TestClient(ewrp_app) as client:
        first = client.get(f"/api/v1/ewrp/{job_id}/pdf?token=token-1")
        second = client.get(f"/api/v1/ewrp/{job_id}/pdf?token=token-1")

    assert first.status_code == 200
    assert second.status_code == 200
    assert redis.store[f"{ewrp.EWRP_PDF_TOKEN_PREFIX}{job_id}"] == "token-1"


def test_create_ewrp_refunds_on_persist_failure(ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    import api.routers.ewrp as ewrp

    billing_instances: list[_TrackedBilling] = []

    class TrackingBilling:
        def __init__(self, _db: object) -> None:
            self.check_limits = AsyncMock()
            self.record_usage = AsyncMock(return_value=True)
            self.refund_credits = AsyncMock(return_value=True)
            billing_instances.append(self)

    monkeypatch.setattr(ewrp, "BillingService", TrackingBilling)

    user = _fake_user()
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(SimpleNamespace(type_key="ewrp_presentation")))
    db.add = MagicMock()
    db.commit = AsyncMock(side_effect=RuntimeError("db down"))
    db.rollback = AsyncMock()
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app, raise_server_exceptions=False) as client:
        r = client.post(
            "/api/v1/ewrp",
            json={"topic": "Test topic for EWRP", "num_slides": 5},
        )
    assert r.status_code == 500
    assert len(billing_instances) == 1
    assert billing_instances[0].refund_credits.await_count == 1


def test_duplicate_ewrp_404_when_missing(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(None))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(f"/api/v1/ewrp/{uuid4()}/duplicate")
    assert r.status_code == 404


def test_duplicate_ewrp_success_creates_new_job(ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    import api.routers.ewrp as ewrp

    billing_instances: list[_TrackedBilling] = []

    class TrackingBilling:
        def __init__(self, _db: object) -> None:
            self.check_limits = AsyncMock()
            self.record_usage = AsyncMock(return_value=True)
            self.refund_credits = AsyncMock(return_value=True)
            billing_instances.append(self)

    monkeypatch.setattr(ewrp, "BillingService", TrackingBilling)

    user = _fake_user()
    src_id = uuid4()
    new_id = uuid4()
    src = SimpleNamespace(
        id=src_id,
        user_id=UUID(str(user.id)),
        title="Source deck",
        topic="Source topic",
        num_slides=7,
        extra_context="ctx",
        source_content_id=None,
        default_slide_layout="columns",
        presentation_theme="classic",
    )

    async def fake_refresh(job: object) -> None:
        setattr(job, "id", new_id)

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(src),
            _scalar_result(SimpleNamespace(type_key="ewrp_presentation")),
        ]
    )
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock(side_effect=fake_refresh)
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(f"/api/v1/ewrp/{src_id}/duplicate")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "queued"
    assert body["id"] == str(new_id)
    assert body["id"] != str(src_id)
    db.add.assert_called_once()
    assert billing_instances[0].record_usage.await_count == 1


def test_get_ewrp_status_includes_updated_at(ewrp_app: FastAPI) -> None:
    from datetime import UTC, datetime

    user = _fake_user()
    job_id = uuid4()
    updated = datetime(2026, 5, 27, 10, 30, tzinfo=UTC)
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="failed",
        progress=12,
        error_message="Pipeline timeout",
        pdf_path=None,
        slides_json=None,
        topic="Topic",
        title="Title",
        num_slides=5,
        extra_context=None,
        source_content_id=None,
        presentation_theme="classic",
        default_slide_layout=None,
        updated_at=updated,
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.get(f"/api/v1/ewrp/{job_id}/status")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "failed"
    assert body["error_message"] == "Pipeline timeout"
    assert body["updated_at"] is not None


def test_update_slides_rejects_in_progress_job(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="generating_images",
        slides_json=[],
        pdf_path=None,
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.put(
            f"/api/v1/ewrp/{job_id}/slides",
            json={"slides": [{"title": "Slide 1", "bullets": ["a"]}]},
        )
    assert r.status_code == 400
    assert "завершена" in str(r.json().get("detail", "")).lower()


def test_update_slides_rejects_empty_slide_title(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="completed",
        slides_json=[{"title": "Old", "bullets": []}],
        pdf_path="/tmp/x.pdf",
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.put(
            f"/api/v1/ewrp/{job_id}/slides",
            json={"slides": [{"title": "  ", "bullets": []}]},
        )
    assert r.status_code == 400
    assert "заголовок" in str(r.json().get("detail", "")).lower()


def test_list_jobs_returns_error_message_for_failed(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    job = SimpleNamespace(
        id=uuid4(),
        title="T",
        topic="Topic",
        num_slides=5,
        status="failed",
        progress=0,
        error_message="MinIO unreachable",
        created_at=None,
        updated_at=None,
        completed_at=None,
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalars_result([job]))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.get("/api/v1/ewrp/jobs")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["error_message"] == "MinIO unreachable"


def test_retry_ewrp_401_unauthorized(ewrp_app: FastAPI) -> None:
    db = AsyncMock()
    _mount_session(ewrp_app, db, None)
    with TestClient(ewrp_app) as client:
        r = client.post(f"/api/v1/ewrp/{uuid4()}/retry")
    assert r.status_code == 401


def test_retry_ewrp_400_when_fresh_in_progress(ewrp_app: FastAPI) -> None:
    from datetime import UTC, datetime

    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="generating_images",
        updated_at=datetime.now(UTC),
        num_slides=5,
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(f"/api/v1/ewrp/{job_id}/retry")
    assert r.status_code == 400
    assert "повтор" in str(r.json().get("detail", "")).lower()


def test_retry_ewrp_402_when_insufficient_credits(ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    import api.routers.ewrp as ewrp

    class BrokeBilling:
        def __init__(self, _db: object) -> None:
            self.check_limits = AsyncMock()
            self.record_usage = AsyncMock(return_value=False)
            self.refund_credits = AsyncMock(return_value=True)

    monkeypatch.setattr(ewrp, "BillingService", BrokeBilling)

    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="failed",
        updated_at=None,
        num_slides=5,
    )
    gen_type = SimpleNamespace(type_key="ewrp_presentation")
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(job),
            _scalar_result(gen_type),
        ]
    )
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(f"/api/v1/ewrp/{job_id}/retry")
    assert r.status_code == 402


def test_retry_ewrp_success_failed_rebills(ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    import api.routers.ewrp as ewrp

    billing_instances: list[_TrackedBilling] = []

    class TrackingBilling:
        def __init__(self, _db: object) -> None:
            self.check_limits = AsyncMock()
            self.record_usage = AsyncMock(return_value=True)
            self.refund_credits = AsyncMock(return_value=True)
            billing_instances.append(self)

    monkeypatch.setattr(ewrp, "BillingService", TrackingBilling)

    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="failed",
        updated_at=None,
        num_slides=5,
    )
    gen_type = SimpleNamespace(type_key="ewrp_presentation")
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(job),
            _scalar_result(gen_type),
            MagicMock(),
        ]
    )
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(f"/api/v1/ewrp/{job_id}/retry")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == str(job_id)
    assert body["status"] == "queued"
    assert len(billing_instances) == 1
    assert billing_instances[0].record_usage.await_count == 1


def test_retry_ewrp_stale_in_progress_skips_billing(ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    from datetime import UTC, datetime, timedelta

    import api.routers.ewrp as ewrp

    billing_instances: list[_TrackedBilling] = []

    class TrackingBilling:
        def __init__(self, _db: object) -> None:
            self.check_limits = AsyncMock()
            self.record_usage = AsyncMock(return_value=True)
            self.refund_credits = AsyncMock(return_value=True)
            billing_instances.append(self)

    monkeypatch.setattr(ewrp, "BillingService", TrackingBilling)

    user = _fake_user()
    job_id = uuid4()
    stale_at = datetime.now(UTC) - timedelta(hours=3)
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="queued",
        updated_at=stale_at,
        num_slides=5,
    )
    gen_type = SimpleNamespace(type_key="ewrp_presentation")
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(job),
            _scalar_result(gen_type),
            MagicMock(),
        ]
    )
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(f"/api/v1/ewrp/{job_id}/retry")
    assert r.status_code == 200
    assert len(billing_instances) == 1
    assert billing_instances[0].record_usage.await_count == 0


def test_retry_ewrp_404_when_missing(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(None))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(f"/api/v1/ewrp/{uuid4()}/retry")
    assert r.status_code == 404


def test_delete_ewrp_401_unauthorized(ewrp_app: FastAPI) -> None:
    db = AsyncMock()
    _mount_session(ewrp_app, db, None)
    with TestClient(ewrp_app) as client:
        r = client.delete(f"/api/v1/ewrp/{uuid4()}")
    assert r.status_code == 401


def test_delete_ewrp_404_when_missing(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(None))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.delete(f"/api/v1/ewrp/{uuid4()}")
    assert r.status_code == 404


def test_delete_ewrp_204_success(ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    import api.routers.ewrp as ewrp

    user = _fake_user()
    job_id = uuid4()
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(job_id),
            MagicMock(),
        ]
    )
    db.commit = AsyncMock()
    monkeypatch.setattr(ewrp, "_ewrp_job_output_dir", lambda _jid: None)
    monkeypatch.setattr(
        ewrp,
        "get_database_manager",
        AsyncMock(return_value=SimpleNamespace(get_redis_client=AsyncMock(return_value=None))),
    )
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.delete(f"/api/v1/ewrp/{job_id}")
    assert r.status_code == 204
    assert db.commit.await_count == 1


def test_regenerate_slide_image_401_unauthorized(ewrp_app: FastAPI) -> None:
    db = AsyncMock()
    _mount_session(ewrp_app, db, None)
    with TestClient(ewrp_app) as client:
        r = client.post(
            f"/api/v1/ewrp/{uuid4()}/slides/0/regenerate-image",
            json={"prompt": "sunset over mountains"},
        )
    assert r.status_code == 401


def test_regenerate_slide_image_404_when_missing(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(None))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(
            f"/api/v1/ewrp/{uuid4()}/slides/0/regenerate-image",
            json={"prompt": "sunset over mountains"},
        )
    assert r.status_code == 404


def test_regenerate_slide_image_400_when_in_progress(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="generating_images",
        slides_json=[{"title": "Slide 1", "bullets": []}],
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(
            f"/api/v1/ewrp/{job_id}/slides/0/regenerate-image",
            json={"prompt": "sunset over mountains"},
        )
    assert r.status_code == 400
    assert "заверш" in str(r.json().get("detail", "")).lower()


def test_regenerate_slide_image_success_sets_generating_images(
    ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    import api.routers.ewrp as ewrp

    monkeypatch.setattr(ewrp, "_run_ewrp_slide_image_regen", AsyncMock())

    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="completed",
        progress=100,
        error_message=None,
        slides_json=[{"title": "Slide 1", "bullets": []}],
        pdf_path="/tmp/deck.pdf",
        topic="Topic",
        title="Title",
        num_slides=1,
        extra_context=None,
        source_content_id=None,
        presentation_theme="classic",
        default_slide_layout=None,
        updated_at=None,
    )
    gen_type = SimpleNamespace(type_key="image_generation_comfyui", cost_credits=50)
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(job),
            _scalar_result(gen_type),
        ]
    )
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(
            f"/api/v1/ewrp/{job_id}/slides/0/regenerate-image",
            json={"prompt": "sunset over mountains"},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "generating_images"
    assert job.status == "generating_images"
    db.commit.assert_awaited()


def test_regenerate_slide_image_402_when_insufficient_credits(
    ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    import api.routers.ewrp as ewrp

    class BrokeBilling:
        def __init__(self, _db: object) -> None:
            self.check_limits = AsyncMock()
            self.record_usage = AsyncMock(return_value=False)

    monkeypatch.setattr(ewrp, "BillingService", BrokeBilling)

    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="completed",
        slides_json=[{"title": "Slide 1", "bullets": []}],
    )
    gen_type = SimpleNamespace(type_key="image_generation_comfyui", cost_credits=50)
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(job),
            _scalar_result(gen_type),
        ]
    )
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(
            f"/api/v1/ewrp/{job_id}/slides/0/regenerate-image",
            json={"prompt": "sunset over mountains"},
        )
    assert r.status_code == 402


def test_regenerate_slide_image_400_invalid_slide_index(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="completed",
        slides_json=[{"title": "Slide 1", "bullets": []}],
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(
            f"/api/v1/ewrp/{job_id}/slides/3/regenerate-image",
            json={"prompt": "sunset over mountains"},
        )
    assert r.status_code == 400
    assert "индекс" in str(r.json().get("detail", "")).lower()


def test_regenerate_slide_text_401_unauthorized(ewrp_app: FastAPI) -> None:
    db = AsyncMock()
    _mount_session(ewrp_app, db, None)
    with TestClient(ewrp_app) as client:
        r = client.post(
            f"/api/v1/ewrp/{uuid4()}/slides/0/regenerate-text",
            json={"instruction": "shorter bullets"},
        )
    assert r.status_code == 401


def test_regenerate_slide_text_404_when_missing(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(None))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(
            f"/api/v1/ewrp/{uuid4()}/slides/0/regenerate-text",
            json={"instruction": "shorter bullets"},
        )
    assert r.status_code == 404


def test_regenerate_slide_text_400_when_in_progress(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="building_pdf",
        slides_json=[{"title": "Slide 1", "bullets": []}],
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_scalar_result(job))
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(
            f"/api/v1/ewrp/{job_id}/slides/0/regenerate-text",
            json={"instruction": "shorter bullets"},
        )
    assert r.status_code == 400


def test_regenerate_slide_text_402_when_insufficient_credits(
    ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    import api.routers.ewrp as ewrp

    class BrokeBilling:
        def __init__(self, _db: object) -> None:
            self.check_limits = AsyncMock()
            self.record_usage = AsyncMock(return_value=False)

    monkeypatch.setattr(ewrp, "BillingService", BrokeBilling)

    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="completed",
        slides_json=[{"title": "Slide 1", "bullets": []}],
    )
    gen_type = SimpleNamespace(type_key="ewrp_slide_text_regen", cost_credits=10)
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(job),
            _scalar_result(gen_type),
        ]
    )
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(
            f"/api/v1/ewrp/{job_id}/slides/0/regenerate-text",
            json={"instruction": "shorter bullets"},
        )
    assert r.status_code == 402


def test_regenerate_slide_text_success_sets_generating_content(
    ewrp_app: FastAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    import api.routers.ewrp as ewrp

    monkeypatch.setattr(ewrp, "_run_ewrp_slide_text_regen", AsyncMock())

    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="completed",
        progress=100,
        error_message=None,
        slides_json=[{"title": "Slide 1", "bullets": []}],
        pdf_path="/tmp/deck.pdf",
        topic="Topic",
        title="Title",
        num_slides=1,
        extra_context=None,
        source_content_id=None,
        presentation_theme="classic",
        default_slide_layout=None,
        updated_at=None,
    )
    gen_type = SimpleNamespace(type_key="ewrp_slide_text_regen", cost_credits=10)
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(job),
            _scalar_result(gen_type),
        ]
    )
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(
            f"/api/v1/ewrp/{job_id}/slides/0/regenerate-text",
            json={"instruction": "shorter bullets"},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "generating_content"
    assert job.status == "generating_content"
    db.commit.assert_awaited()


def test_regenerate_slide_image_503_when_billing_type_missing(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="completed",
        slides_json=[{"title": "Slide 1", "bullets": []}],
    )
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(job),
            _scalar_result(None),
        ]
    )
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(
            f"/api/v1/ewrp/{job_id}/slides/0/regenerate-image",
            json={"prompt": "sunset over mountains"},
        )
    assert r.status_code == 503
    assert "ugs" in str(r.json().get("detail", "")).lower() or "изображ" in str(r.json().get("detail", "")).lower()


def test_regenerate_slide_text_503_when_billing_type_missing(ewrp_app: FastAPI) -> None:
    user = _fake_user()
    job_id = uuid4()
    job = SimpleNamespace(
        id=job_id,
        user_id=UUID(str(user.id)),
        status="completed",
        slides_json=[{"title": "Slide 1", "bullets": []}],
    )
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalar_result(job),
            _scalar_result(None),
        ]
    )
    _mount_session(ewrp_app, db, user)
    with TestClient(ewrp_app) as client:
        r = client.post(
            f"/api/v1/ewrp/{job_id}/slides/0/regenerate-text",
            json={"instruction": "shorter bullets"},
        )
    assert r.status_code == 503
    assert (
        "ewrp_slide_text_regen" in str(r.json().get("detail", "")).lower()
        or "текст" in str(r.json().get("detail", "")).lower()
    )
