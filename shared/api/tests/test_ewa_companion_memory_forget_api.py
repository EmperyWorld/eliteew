# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for companion profile memory forget (DELETE by content_hash).
# Invariants:
# - No live Postgres; ``companion_asyncpg`` helpers are monkeypatched at module boundary.
# Related:
# - api/ewa_platform/gateways/routers/companion_profile.py
# - api/ewa_platform/companion/memory/hcm_store.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

pytest.importorskip("jose")

from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.companion.memory import MEMORY_NS, merge_memory_entries
from api.ewa_platform.gateways.routers.companion_profile import router as companion_profile_router
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

_PRINCIPAL = "u-forget"


def _seed_memory_rows() -> list[dict[str, Any]]:
    merged, _ = merge_memory_entries(
        [],
        [
            {
                "type": "fact",
                "kind": "preference",
                "content": "Likes calm voice",
                "importance": 0.8,
                "source": "user_explicit",
            },
            {
                "type": "fact",
                "kind": "fact",
                "content": "Works on module generator",
                "importance": 0.7,
                "source": "llm",
            },
        ],
    )
    return merged


def _profile_row(*, memory_rows: list[dict[str, Any]], revision: int = 3) -> dict[str, Any]:
    return {
        "principal_id": _PRINCIPAL,
        "schema_version": "1",
        "seed_persona_id": "mela",
        "baseline": {},
        "learned_preferences": {MEMORY_NS: memory_rows},
        "style_parameters": {},
        "companion_revision": revision,
        "updated_at": "2026-06-22T12:00:00+00:00",
    }


def _app(*, pool: object | None = object()) -> FastAPI:
    app = FastAPI()
    app.include_router(companion_profile_router, prefix="/api/v1/ewa")
    app.state.ewa_orchestration_pool = pool

    async def fake_user() -> User:
        return User(id=_PRINCIPAL, email="a@b.c", username="t", role="user")

    app.dependency_overrides[require_oauth2_user] = fake_user
    return app


@pytest.mark.unit
def test_memory_forget_removes_row_and_returns_profile(monkeypatch: pytest.MonkeyPatch) -> None:
    memory_rows = _seed_memory_rows()
    target_hash = str(memory_rows[0]["content_hash"])
    row = _profile_row(memory_rows=memory_rows)
    fetch_mock = AsyncMock(return_value=row)
    kept = [dict(r) for r in memory_rows if str(r.get("content_hash")) != target_hash]
    patch_mock = AsyncMock(return_value=_profile_row(memory_rows=kept, revision=4))
    monkeypatch.setattr(companion_pg, "companion_profile_fetch", fetch_mock)
    monkeypatch.setattr(companion_pg, "companion_profile_patch", patch_mock)
    client = TestClient(_app())
    response = client.delete(f"/api/v1/ewa/companion-profile/memory/{target_hash}")
    assert response.status_code == 200
    body = response.json()
    assert body["companion_revision"] == 4
    assert "Likes calm voice" not in body.get("memory_display", [])
    patch_mock.assert_awaited_once()
    patch_call = patch_mock.await_args
    assert patch_call is not None
    assert patch_call.kwargs["audit_action"] == "companion_memory_forget"


@pytest.mark.unit
def test_memory_forget_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    row = _profile_row(memory_rows=_seed_memory_rows())
    monkeypatch.setattr(companion_pg, "companion_profile_fetch", AsyncMock(return_value=row))
    client = TestClient(_app())
    response = client.delete("/api/v1/ewa/companion-profile/memory/doesnotexist0000")
    assert response.status_code == 404
    assert response.json()["detail"] == "companion_memory_not_found"


@pytest.mark.unit
def test_memory_forget_revision_conflict(monkeypatch: pytest.MonkeyPatch) -> None:
    memory_rows = _seed_memory_rows()
    target_hash = str(memory_rows[0]["content_hash"])
    row = _profile_row(memory_rows=memory_rows)
    monkeypatch.setattr(companion_pg, "companion_profile_fetch", AsyncMock(return_value=row))
    monkeypatch.setattr(companion_pg, "companion_profile_patch", AsyncMock(return_value=None))
    client = TestClient(_app())
    response = client.delete(f"/api/v1/ewa/companion-profile/memory/{target_hash}")
    assert response.status_code == 409
