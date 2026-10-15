#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for OAuth-gated mobile APK download router.
# Invariants:
# - Missing APK on disk returns 503; present file streams with 200.
# - Ticket download allows exactly one same-client replay in a short grace window.
# Related:
# - api/routers/mobile_app.py
# ---
"""Tests for mobile APK distribution router."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers import mobile_app as mobile_app_router

_FAKE_USER_ID = UUID("11111111-1111-1111-1111-111111111111")


class _FakeRedisTicketStore:
    def __init__(self) -> None:
        self._data: dict[str, str] = {}

    async def setex(self, key: str, _ttl: int, value: str) -> None:
        self._data[key] = value

    async def get(self, key: str) -> str | None:
        return self._data.get(key)

    async def delete(self, key: str) -> None:
        self._data.pop(key, None)


class _FakeRedisManager:
    def __init__(self, redis: _FakeRedisTicketStore) -> None:
        self._redis = redis

    async def get_redis_client(self) -> _FakeRedisTicketStore:
        return self._redis


def _install_fake_ticket_store(monkeypatch: pytest.MonkeyPatch) -> _FakeRedisTicketStore:
    redis = _FakeRedisTicketStore()
    manager = _FakeRedisManager(redis)

    async def _fake_get_database_manager() -> _FakeRedisManager:
        return manager

    monkeypatch.setattr(mobile_app_router, "get_database_manager", _fake_get_database_manager)
    return redis


def _mobile_app_test_app(
    monkeypatch: pytest.MonkeyPatch,
    *,
    apk_path: Path,
    ensure_apk: bool = True,
) -> FastAPI:
    apk_path.parent.mkdir(parents=True, exist_ok=True)
    if ensure_apk and not apk_path.exists():
        apk_path.write_bytes(b"PK" + b"\x00" * 64)
    monkeypatch.setattr(mobile_app_router, "_resolve_apk_path", lambda: apk_path)
    monkeypatch.setattr(mobile_app_router, "_candidate_apk_paths", lambda: (apk_path,))

    async def _local_release_state(
        apk_path: Path,
        *,
        apk_ok: bool,
        apk_size: int | None,
    ) -> tuple[bool, int | None, object]:
        from api.services.mobile_apk_metadata import read_mobile_apk_metadata

        return apk_ok, apk_size, read_mobile_apk_metadata(apk_path)

    monkeypatch.setattr(
        mobile_app_router,
        "resolve_mobile_apk_release_state",
        _local_release_state,
    )

    async def _fake_db_user(
        _current_user: AuthUser,
        _db: object,
    ) -> UUID:
        return _FAKE_USER_ID

    monkeypatch.setattr(
        mobile_app_router,
        "resolve_db_user_uuid_with_session",
        _fake_db_user,
    )

    async def _noop_download_audit(
        *,
        user_id: str,
        request: object | None,
        apk_path: Path,
        apk_size_bytes: int | None,
        source: str,
    ) -> None:
        return None

    monkeypatch.setattr(
        mobile_app_router,
        "_record_mobile_apk_download_event",
        _noop_download_audit,
    )

    async def _fake_batch_sso(_user_ids: list[str]) -> dict[str, dict[str, object]]:
        return {}

    async def _fake_login_history(_user_id: str, *, limit: int = 20) -> list[dict[str, object]]:
        return []

    monkeypatch.setattr(
        mobile_app_router,
        "batch_sso_sessions_for_user_ids",
        _fake_batch_sso,
    )
    monkeypatch.setattr(
        mobile_app_router,
        "list_sso_login_history_for_user",
        _fake_login_history,
    )

    app = FastAPI()
    app.include_router(mobile_app_router.router, prefix="/api/v1")

    async def _fake_user() -> AuthUser:
        return AuthUser(
            id=str(_FAKE_USER_ID),
            username="trusted",
            email="trusted@example.com",
            role="emperyworld_member",
        )

    async def _fake_db():
        session = AsyncMock(spec=AsyncSession)

        async def _execute(_stmt: object) -> MagicMock:
            result = MagicMock()
            result.one_or_none.return_value = None
            return result

        session.execute = AsyncMock(side_effect=_execute)
        yield session

    app.dependency_overrides[require_oauth2_user] = _fake_user
    app.dependency_overrides[get_postgres_session] = _fake_db
    return app


@pytest.fixture
def mobile_app_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    apk = tmp_path / "empery-mobile.apk"
    return TestClient(_mobile_app_test_app(monkeypatch, apk_path=apk))


def test_mobile_app_download_missing_apk_returns_503(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    missing = tmp_path / "missing.apk"
    app = _mobile_app_test_app(monkeypatch, apk_path=missing, ensure_apk=False)
    response = TestClient(app).get("/api/v1/mobile-app/download")
    assert response.status_code == 503


def test_mobile_app_download_streams_file(mobile_app_client: TestClient) -> None:
    response = mobile_app_client.get("/api/v1/mobile-app/download")
    assert response.status_code == 200
    assert response.content.startswith(b"PK")
    assert response.headers.get("accept-ranges") == "bytes"


def test_mobile_app_download_supports_range(mobile_app_client: TestClient) -> None:
    response = mobile_app_client.get(
        "/api/v1/mobile-app/download",
        headers={"Range": "bytes=0-15"},
    )
    assert response.status_code == 206
    assert len(response.content) == 16
    assert response.content.startswith(b"PK")
    assert response.headers.get("content-range", "").startswith("bytes 0-15/")


def test_mobile_app_download_ticket_returns_one_time_url(
    mobile_app_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_issue(_user_id: str) -> tuple[str, int]:
        return "ticket-abc", 120

    monkeypatch.setattr(mobile_app_router, "_issue_download_ticket", _fake_issue)

    response = mobile_app_client.post("/api/v1/mobile-app/download-ticket")
    assert response.status_code == 200
    payload = response.json()
    assert payload["download_url"] == "/api/v1/mobile-app/download-by-ticket?ticket=ticket-abc"
    assert payload["expires_in_seconds"] == 120


def test_mobile_app_download_by_ticket_streams_file(
    mobile_app_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_consume(ticket: str, *, request: object | None = None) -> str | None:
        if ticket == "ticket-ok":
            return str(_FAKE_USER_ID)
        return None

    monkeypatch.setattr(mobile_app_router, "_consume_download_ticket", _fake_consume)

    response = mobile_app_client.get("/api/v1/mobile-app/download-by-ticket?ticket=ticket-ok")
    assert response.status_code == 200
    assert response.content.startswith(b"PK")


def test_mobile_app_download_by_ticket_invalid_returns_401(
    mobile_app_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_consume(_ticket: str, *, request: object | None = None) -> str | None:
        return None

    monkeypatch.setattr(mobile_app_router, "_consume_download_ticket", _fake_consume)

    response = mobile_app_client.get("/api/v1/mobile-app/download-by-ticket?ticket=expired-ticket")
    assert response.status_code == 401


def test_mobile_app_download_by_ticket_allows_single_grace_reuse_same_client(
    mobile_app_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_fake_ticket_store(monkeypatch)
    issue = mobile_app_client.post("/api/v1/mobile-app/download-ticket")
    assert issue.status_code == 200
    download_url = issue.json()["download_url"]
    headers = {
        "User-Agent": "MobileBrowser/125",
        "X-Forwarded-For": "203.0.113.9",
    }

    first = mobile_app_client.get(download_url, headers=headers)
    second = mobile_app_client.get(download_url, headers=headers)
    third = mobile_app_client.get(download_url, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 401


def test_mobile_app_download_by_ticket_rejects_reuse_from_other_client(
    mobile_app_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_fake_ticket_store(monkeypatch)
    issue = mobile_app_client.post("/api/v1/mobile-app/download-ticket")
    assert issue.status_code == 200
    download_url = issue.json()["download_url"]

    first = mobile_app_client.get(
        download_url,
        headers={"User-Agent": "MobileBrowser/125", "X-Forwarded-For": "203.0.113.9"},
    )
    second = mobile_app_client.get(
        download_url,
        headers={"User-Agent": "AnotherBrowser/1", "X-Forwarded-For": "198.51.100.7"},
    )
    assert first.status_code == 200
    assert second.status_code == 401


def test_mobile_app_download_by_ticket_reuse_expires_after_grace_window(
    mobile_app_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_fake_ticket_store(monkeypatch)
    now = {"value": 1_750_000_000}
    monkeypatch.setattr(mobile_app_router.time, "time", lambda: now["value"])
    issue = mobile_app_client.post("/api/v1/mobile-app/download-ticket")
    assert issue.status_code == 200
    download_url = issue.json()["download_url"]
    headers = {
        "User-Agent": "MobileBrowser/125",
        "X-Forwarded-For": "203.0.113.9",
    }

    first = mobile_app_client.get(download_url, headers=headers)
    now["value"] += mobile_app_router._DOWNLOAD_TICKET_REUSE_GRACE_SECONDS + 1
    second = mobile_app_client.get(download_url, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 401


def test_mobile_app_overview_includes_version_from_sidecar(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    apk = tmp_path / "empery-mobile.apk"
    apk.write_bytes(b"PK" + b"\x00" * 64)
    sidecar = apk.with_name(f"{apk.name}.meta.json")
    sidecar.write_text(
        '{"version_code": 42, "version_name": "1.2.3"}',
        encoding="utf-8",
    )
    app = _mobile_app_test_app(monkeypatch, apk_path=apk)
    response = TestClient(app).get("/api/v1/mobile-app/overview")
    assert response.status_code == 200
    payload = response.json()
    assert payload["apk_available"] is True
    assert payload["version_code"] == 42
    assert payload["version_name"] == "1.2.3"


def test_mobile_app_overview_includes_sha256_from_sidecar(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    apk = tmp_path / "empery-mobile.apk"
    apk.write_bytes(b"PK" + b"\x00" * 64)
    sidecar = apk.with_name(f"{apk.name}.meta.json")
    sha = "a" * 64
    sidecar.write_text(
        (
            '{"version_code": 42, "version_name": "1.2.3", '
            f'"sha256": "{sha}", '
            '"published_at": "2026-06-17T00:00:00+00:00", '
            '"release_notes": "Flagship release", '
            '"release_notes_history": [{"version_code": 42, "version_name": "1.2.3", "release_notes": "Flagship release"}], '
            '"min_supported_version_code": 41}'
        ),
        encoding="utf-8",
    )

    async def _fallback_state(
        apk_path: Path,
        *,
        apk_ok: bool,
        apk_size: int | None,
    ) -> tuple[bool, int | None, object]:
        from api.services.mobile_apk_metadata import read_mobile_apk_metadata

        meta = read_mobile_apk_metadata(apk_path)
        return apk_ok, apk_size, meta

    monkeypatch.setattr(mobile_app_router, "resolve_mobile_apk_release_state", _fallback_state)

    app = _mobile_app_test_app(monkeypatch, apk_path=apk)
    response = TestClient(app).get("/api/v1/mobile-app/overview")
    assert response.status_code == 200
    payload = response.json()
    assert payload["apk_sha256"] == sha
    assert payload["published_at"] == "2026-06-17T00:00:00+00:00"
    assert payload["release_notes"] == "Flagship release"
    assert payload["release_notes_history"][0]["version_code"] == 42
    assert payload["min_supported_version_code"] == 41


def test_mobile_app_overview_version_null_without_sidecar(
    mobile_app_client: TestClient,
) -> None:
    response = mobile_app_client.get("/api/v1/mobile-app/overview")
    assert response.status_code == 200
    payload = response.json()
    assert payload["version_code"] is None
    assert payload["version_name"] is None


def test_mobile_app_overview_aggregates_skipped_release_notes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    apk = tmp_path / "empery-mobile.apk"
    apk.write_bytes(b"PK" + b"\x00" * 64)
    sidecar = apk.with_name(f"{apk.name}.meta.json")
    sidecar.write_text(
        json.dumps(
            {
                "version_code": 126,
                "version_name": "0.2.116",
                "release_notes": "Music mini player",
                "release_notes_history": [
                    {
                        "version_code": 124,
                        "version_name": "0.2.114",
                        "release_notes": "Files UX",
                    },
                    {
                        "version_code": 125,
                        "version_name": "0.2.115",
                        "release_notes": "UGS list",
                    },
                    {
                        "version_code": 126,
                        "version_name": "0.2.116",
                        "release_notes": "Music mini player",
                    },
                ],
            }
        ),
        encoding="utf-8",
    )

    async def _fallback_state(
        apk_path: Path,
        *,
        apk_ok: bool,
        apk_size: int | None,
    ) -> tuple[bool, int | None, object]:
        from api.services.mobile_apk_metadata import read_mobile_apk_metadata

        meta = read_mobile_apk_metadata(apk_path)
        return apk_ok, apk_size, meta

    monkeypatch.setattr(mobile_app_router, "resolve_mobile_apk_release_state", _fallback_state)

    app = _mobile_app_test_app(monkeypatch, apk_path=apk)
    response = TestClient(app).get(
        "/api/v1/mobile-app/overview",
        params={"installed_version_code": 123},
    )
    assert response.status_code == 200
    payload = response.json()
    notes = payload["release_notes"]
    assert notes.startswith("Вы пропустили несколько обновлений")
    assert "Версия 0.2.114" in notes
    assert "Версия 0.2.115" in notes
    assert "Версия 0.2.116" in notes
