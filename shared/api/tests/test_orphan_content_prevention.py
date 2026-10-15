# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Audit A-09 — companion task_run payloads must tombstone orphaned unified_content_id refs at HTTP delivery.
# Invariants:
# - Phase-0 test documents legacy broken state (raw payload invites 404 download).
# - Guard runs on task-run GET/list without mutating Postgres rows.
# Related:
# - api/ewa_platform/companion/operations/result_payload_content_guard.py
# - api/ewa_platform/gateways/routers/companion_chat.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

pytest.importorskip("jose")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.companion.operations import result_payload_content_guard as guard
from api.ewa_platform.gateways.routers import companion_chat as companion_chat_router
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

_ORPHAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
_PRESENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
_RUN_ID = "run-orphan-image-1"
_PRINCIPAL = "user-principal-1"


def _image_run(*, result_payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = result_payload or {
        "unified_content_id": _ORPHAN_ID,
        "image_url": f"/api/v1/content/{_ORPHAN_ID}/download",
        "prompt_preview": "sunset over lake",
        "image_tool_mode": "generate",
    }
    return {
        "id": _RUN_ID,
        "principal_id": _PRINCIPAL,
        "status": "completed",
        "intent_kind": "image_generation_background",
        "user_message": "draw sunset",
        "plan_payload": {},
        "confirmation_state": {},
        "result_payload": payload,
        "error_payload": {},
        "execution_mode": "async",
        "run_revision": 1,
        "created_at": "2026-07-04T02:00:00Z",
        "updated_at": "2026-07-04T02:01:00Z",
        "completed_at": "2026-07-04T02:01:00Z",
    }


class _FakeAcquire:
    def __init__(self, conn: Any) -> None:
        self._conn = conn

    async def __aenter__(self) -> Any:
        return self._conn

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakeContentPool:
    def __init__(self, existing_ids: set[str]) -> None:
        self._existing_ids = existing_ids

    def acquire(self) -> _FakeAcquire:
        conn = self

        async def fetch(_query: str, ids: list[str]) -> list[dict[str, str]]:
            return [{"id": cid} for cid in ids if cid in self._existing_ids]

        conn.fetch = fetch  # type: ignore[method-assign]
        return _FakeAcquire(conn)


def test_legacy_orphan_payload_invites_broken_download_path() -> None:
    """Phase-0 evidence: stored payload still points at missing content (FE would 404)."""

    raw = _image_run()["result_payload"]
    assert raw["unified_content_id"] == _ORPHAN_ID
    assert guard.CONTENT_AVAILABILITY_KEY not in raw
    assert f"/api/v1/content/{_ORPHAN_ID}/download" in str(raw.get("image_url") or "")


@pytest.mark.asyncio
async def test_sanitize_marks_orphan_unified_content_unavailable() -> None:
    pool = _FakeContentPool(existing_ids=set())
    sanitized = await guard.sanitize_task_run_content_references(_image_run(), content_pool=pool)
    payload = sanitized["result_payload"]
    assert payload["unified_content_id"] == _ORPHAN_ID
    assert payload[guard.CONTENT_AVAILABILITY_KEY] == guard.CONTENT_STATUS_MISSING
    assert payload["unified_content_id_status"] == guard.CONTENT_STATUS_MISSING
    assert payload.get("image_url") is None


@pytest.mark.asyncio
async def test_sanitize_preserves_available_content_references() -> None:
    run = _image_run(
        result_payload={
            "unified_content_id": _PRESENT_ID,
            "image_url": f"/api/v1/content/{_PRESENT_ID}/download",
            "prompt_preview": "keep me",
        }
    )
    pool = _FakeContentPool(existing_ids={_PRESENT_ID})
    sanitized = await guard.sanitize_task_run_content_references(run, content_pool=pool)
    payload = sanitized["result_payload"]
    assert payload["unified_content_id"] == _PRESENT_ID
    assert payload[guard.CONTENT_AVAILABILITY_KEY] == guard.CONTENT_STATUS_AVAILABLE
    assert payload.get("unified_content_id_status") != guard.CONTENT_STATUS_MISSING
    assert f"/api/v1/content/{_PRESENT_ID}/download" in str(payload.get("image_url") or "")


def test_task_run_get_returns_sanitized_payload_for_orphan_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """HTTP integration: GET task-run returns 200 with missing tombstone, not a crash."""

    app = FastAPI()
    app.state.ewa_orchestration_pool = object()
    app.include_router(companion_chat_router.router, prefix="/api/v1/ewa")

    async def fake_user() -> User:
        return User(id=_PRINCIPAL, email="a@b.c", username="t", role="admin")

    app.dependency_overrides[require_oauth2_user] = fake_user

    monkeypatch.setattr(
        companion_pg,
        "companion_task_run_fetch_for_principal",
        AsyncMock(return_value=_image_run()),
    )
    monkeypatch.setattr(
        companion_pg,
        "companion_task_steps_list",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(
        companion_chat_router,
        "_content_catalog_pool",
        AsyncMock(return_value=_FakeContentPool(existing_ids=set())),
    )

    response = TestClient(app).get(f"/api/v1/ewa/companion-chat/task-runs/{_RUN_ID}")
    assert response.status_code == 200
    body = response.json()
    payload = body["result_payload"]
    assert payload["unified_content_id"] == _ORPHAN_ID
    assert payload[guard.CONTENT_AVAILABILITY_KEY] == guard.CONTENT_STATUS_MISSING
    assert payload.get("image_url") is None
