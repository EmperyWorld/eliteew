"""Контрактные проверки роутера batch-tests (без реальной БД/RabbitMQ)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.core.database_manager import get_postgres_session
from api.schemas.music_batch_tests import MusicBatchApproachListResponse, MusicBatchProgress


@pytest.fixture
def batch_tests_app(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    import api.routers.music_batch_tests as mbt

    approach_id = uuid4()
    summ = SimpleNamespace(
        id=approach_id,
        status="queued",
        progress=MusicBatchProgress(total=1, done=0, failed=0, cancelled=0),
        limits_snapshot={},
    )

    class FakeSvc:
        def __init__(self, db: object) -> None:
            self.create_approach = AsyncMock(return_value=summ)
            self.mark_enqueue_failed = AsyncMock()

    monkeypatch.setattr(mbt, "MusicBatchTestService", FakeSvc)
    monkeypatch.setattr(mbt, "enqueue_music_batch_approach", AsyncMock(return_value=False))

    async def fake_resolve(_user: object, _db: object) -> object:
        return uuid4()

    monkeypatch.setattr(mbt, "resolve_db_user_uuid_with_session", fake_resolve)

    app = FastAPI()
    app.include_router(mbt.router, prefix="/api/v1")

    async def fake_session():
        yield AsyncMock()

    app.dependency_overrides[mbt.require_oauth2_user] = lambda: object()
    app.dependency_overrides[get_postgres_session] = fake_session
    return app


def test_create_approach_503_when_enqueue_fails(batch_tests_app: FastAPI) -> None:
    payload = {
        "workflow_key": "v2",
        "style": "pop",
        "count": 1,
        "duration_seconds": 30,
        "base_prompt": {"lyrics": "hello", "language": "ru"},
        "fixed_params": {},
        "random_params": {},
    }
    with TestClient(batch_tests_app) as client:
        r = client.post("/api/v1/music-generator/batch-tests/approaches", json=payload)
    assert r.status_code == 503
    assert "очередь" in str(r.json().get("detail", "")).lower()


def test_list_approaches_accepts_limit_offset(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.routers.music_batch_tests as mbt

    class FakeListSvc:
        def __init__(self, db: object) -> None:
            pass

        async def list_approaches(self, _user_id: str, *, limit: int = 20, offset: int = 0):
            return MusicBatchApproachListResponse(items=[], total=0, limit=limit, offset=offset)

    monkeypatch.setattr(mbt, "MusicBatchTestService", FakeListSvc)

    async def fake_resolve(_user: object, _db: object) -> object:
        return uuid4()

    monkeypatch.setattr(mbt, "resolve_db_user_uuid_with_session", fake_resolve)

    app = FastAPI()
    app.include_router(mbt.router, prefix="/api/v1")

    async def fake_session():
        yield AsyncMock()

    app.dependency_overrides[mbt.require_oauth2_user] = lambda: object()
    app.dependency_overrides[get_postgres_session] = fake_session

    with TestClient(app) as client:
        r = client.get("/api/v1/music-generator/batch-tests/approaches?limit=5&offset=10")
    assert r.status_code == 200
    body = r.json()
    assert body["limit"] == 5
    assert body["offset"] == 10
