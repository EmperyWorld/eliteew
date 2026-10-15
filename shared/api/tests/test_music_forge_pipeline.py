# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for MusicForge pipeline lifecycle: idempotency, enqueue failure, stale runs,
# feedback ownership, and cancellation.
# Invariants:
# - Tests use FakeAsyncSession patterns; preflight/budget hooks are bypassed unless under test.
# Related:
# - api/services/music_forge/pipeline.py
# - api/routers/music_forge.py
# ---

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from fastapi import HTTPException

from api.routers.music_forge import cancel_music_forge_run, create_music_forge_run
from api.schemas.music_forge import MusicForgeRunCreate
from api.services.music_forge.billing_gate import MusicForgeBillingGate
from api.services.music_forge.config import MusicForgeConfigService, code_default_bundle
from api.services.music_forge.pipeline import MusicForgePipelineService, MusicForgeRunCreateResult
from api.services.music_forge.stale import MUSIC_FORGE_STALE_ERROR


@dataclass
class _RecordedExecute:
    sql: str
    params: dict[str, Any]


class _FakeMappings:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def first(self) -> dict[str, Any] | None:
        return self._rows[0] if self._rows else None

    def all(self) -> list[dict[str, Any]]:
        return self._rows


class _FakeResult:
    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self._rows = rows or []

    def mappings(self) -> _FakeMappings:
        return _FakeMappings(self._rows)

    def first(self) -> dict[str, Any] | None:
        return self._rows[0] if self._rows else None

    def scalar_one(self) -> Any:
        row = self.first()
        if row is None:
            raise RuntimeError("no scalar row")
        if isinstance(row, dict):
            return next(iter(row.values()))
        return row


class _FakeAsyncSession:
    def __init__(self, execute_results: list[list[dict[str, Any]] | dict[str, Any]] | None = None) -> None:
        self.executes: list[_RecordedExecute] = []
        self.commits = 0
        self.rollbacks = 0
        self.execute_results: list[list[dict[str, Any]]] = []
        for item in execute_results or []:
            if isinstance(item, dict):
                self.execute_results.append([item])
            else:
                self.execute_results.append(list(item))

    async def execute(self, statement: Any, params: dict[str, Any] | None = None) -> _FakeResult:
        sql = str(getattr(statement, "text", statement))
        self.executes.append(_RecordedExecute(sql=sql, params=dict(params or {})))
        rows = self.execute_results.pop(0) if self.execute_results else []
        return _FakeResult(rows)

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        self.rollbacks += 1


def _run_row(
    *,
    run_id: str = "11111111-1111-1111-1111-111111111111",
    user_id: str = "22222222-2222-2222-2222-222222222222",
    status: str = "queued",
    content_id: str | None = None,
    updated_at: datetime | None = None,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    return {
        "id": run_id,
        "user_id": user_id,
        "status": status,
        "idea": "Night drive home",
        "language": "ru",
        "style_hint": None,
        "constraints": None,
        "duration_seconds": 180,
        "progress_current": 0,
        "progress_total": 8,
        "normalized_input": {"model_lane": "SFT XL"},
        "song_blueprint": {},
        "lyrics_payload": {},
        "style_capsule": {},
        "render_payload": {},
        "result_payload": {},
        "error_payload": {},
        "content_id": content_id,
        "ugs_request_id": None,
        "started_at": None,
        "completed_at": None,
        "cancelled_at": None,
        "created_at": now,
        "updated_at": updated_at or now,
    }


class _FakeUser:
    id = "22222222-2222-2222-2222-222222222222"
    role = "emperyworld_member"


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def _noop_preflight(self, *, user_id: str, audio_type_key: str) -> None:
    return None


async def _noop_budget(self, *, user_id: str, user_role: str | None) -> None:
    return None


@pytest.mark.anyio
async def test_create_run_idempotency_reuse(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _FakeAsyncSession(
        execute_results=[
            [{"id": "11111111-1111-1111-1111-111111111111", "status": "running", "created": False}],
            *([] for _ in range(11)),
        ]
    )
    monkeypatch.setattr(MusicForgeBillingGate, "preflight_credits", _noop_preflight)
    monkeypatch.setattr(MusicForgeBillingGate, "enforce_run_budget", _noop_budget)
    monkeypatch.setattr(
        MusicForgeConfigService,
        "get_active",
        AsyncMock(return_value=code_default_bundle()),
    )
    service = MusicForgePipelineService(db)  # type: ignore[arg-type]

    result = await service.create_run(
        user_id="22222222-2222-2222-2222-222222222222",
        body=MusicForgeRunCreate(idea="Night drive", idempotency_key="same-key"),
    )

    assert result == MusicForgeRunCreateResult(
        run_id=UUID("11111111-1111-1111-1111-111111111111"),
        status="running",
        created=False,
    )
    assert "ON CONFLICT (user_id, idempotency_key)" in db.executes[0].sql


@pytest.mark.anyio
async def test_router_enqueue_fail_marks_failed_503(monkeypatch: pytest.MonkeyPatch) -> None:
    run_id = "11111111-1111-1111-1111-111111111111"

    class _FakeRequest:
        headers = {"Idempotency-Key": "same-key"}

    class _FakeUser:
        id = "22222222-2222-2222-2222-222222222222"
        role = "emperyworld_member"

    class _FakeTask:
        @staticmethod
        def delay(run_id_arg: str, user_id_arg: str) -> None:
            raise RuntimeError("celery down")

    class _FakeService:
        def __init__(self, db: object) -> None:
            self.db = db

        async def create_run(self, *, user_id: str, body: MusicForgeRunCreate, user_role: str | None = None):
            assert user_id == _FakeUser.id
            return MusicForgeRunCreateResult(
                run_id=UUID(run_id),
                status="queued",
                created=True,
            )

        async def _set_run_status(self, run_id_arg: str, status: str, *, error_payload: dict[str, Any] | None = None):
            assert run_id_arg == run_id
            assert status == "failed"
            assert error_payload is not None
            assert error_payload.get("stage") == "celery_enqueue"

    monkeypatch.setattr("api.routers.music_forge.MusicForgePipelineService", _FakeService)
    monkeypatch.setattr("api.routers.music_forge.run_music_forge_pipeline_task", _FakeTask)

    with pytest.raises(HTTPException) as exc_info:
        await create_music_forge_run(
            MusicForgeRunCreate(idea="Night drive"),
            request=_FakeRequest(),  # type: ignore[arg-type]
            user=_FakeUser(),  # type: ignore[arg-type]
            db=object(),  # type: ignore[arg-type]
        )

    assert exc_info.value.status_code == 503


@pytest.mark.anyio
async def test_stale_fetch_fails_run(monkeypatch: pytest.MonkeyPatch) -> None:
    stale_updated = datetime.now(UTC) - timedelta(minutes=30)
    run = _run_row(status="running", updated_at=stale_updated)
    db = _FakeAsyncSession(
        execute_results=[
            [run],
            [{"status": "failed"}],
            [],
            [{**run, "status": "failed", "error_payload": dict(MUSIC_FORGE_STALE_ERROR)}],
            [],
        ]
    )
    service = MusicForgePipelineService(db)  # type: ignore[arg-type]
    monkeypatch.setattr(
        "api.services.music_forge.pipeline.music_forge_run_is_stale",
        lambda **kwargs: True,
    )

    result = await service.fetch_run(
        run_id="11111111-1111-1111-1111-111111111111",
        user_id="22222222-2222-2222-2222-222222222222",
    )

    assert result.status == "failed"
    assert result.error_payload.get("stage") == "stale_run"
    assert any("status = 'failed'" in item.sql for item in db.executes)


@pytest.mark.anyio
async def test_feedback_owner_403(monkeypatch: pytest.MonkeyPatch) -> None:
    run = _run_row(
        status="completed",
        content_id="33333333-3333-3333-3333-333333333333",
    )

    class _FakeContent:
        user_id = "99999999-9999-9999-9999-999999999999"

    class _FakeContentService:
        async def get_content(self, content_id: str, user_id: str, check_permissions: bool = True):
            return _FakeContent()

    db = _FakeAsyncSession(execute_results=[[run], []])
    service = MusicForgePipelineService(db, content_service=_FakeContentService())  # type: ignore[arg-type]

    async def _fetch_run(*, run_id: str, user_id: str):
        from api.services.music_forge.pipeline_repository import run_out_from_rows

        return run_out_from_rows(run, [])

    monkeypatch.setattr(service, "fetch_run", _fetch_run)

    with pytest.raises(HTTPException) as exc_info:
        await service.record_feedback(
            run_id="11111111-1111-1111-1111-111111111111",
            user_id="22222222-2222-2222-2222-222222222222",
            rating="like",
            reason_code=None,
            reason_custom=None,
        )

    assert exc_info.value.status_code == 403


@pytest.mark.anyio
async def test_cancel_sets_cancelled(monkeypatch: pytest.MonkeyPatch) -> None:
    run = _run_row(status="running")

    class _FakeService:
        def __init__(self, db: object) -> None:
            self.db = db

        async def cancel_run(self, *, run_id: str, user_id: str):
            from api.services.music_forge.pipeline_repository import run_out_from_rows

            return run_out_from_rows({**run, "status": "cancelled"}, [])

    monkeypatch.setattr("api.routers.music_forge.MusicForgePipelineService", _FakeService)

    result = await cancel_music_forge_run(
        run_id="11111111-1111-1111-1111-111111111111",
        user=_FakeUser(),  # type: ignore[name-defined]
        db=object(),  # type: ignore[arg-type]
    )

    assert result.status == "cancelled"
