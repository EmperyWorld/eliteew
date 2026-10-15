# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Narrow lock: admin SSO batch buckets include desktop client_class.
# Invariants:
# - desktop rows are not discarded; empty users → empty map.
# Related:
# - api/services/sso_session_registry_query.py
# ---

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from api.services import sso_session_registry_query as query_mod


class _FakeConn:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    async def fetch(self, _sql: str, *_args: Any) -> list[dict[str, Any]]:
        return self.rows


class _Acquire:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self._conn

    async def __aexit__(self, *_exc: object) -> None:
        return None


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self.conn = conn

    def acquire(self) -> _Acquire:
        return _Acquire(self.conn)


@pytest.mark.asyncio
async def test_batch_sso_sessions_includes_desktop(monkeypatch: pytest.MonkeyPatch) -> None:
    now = datetime.now(UTC)
    rows = [
        {
            "keycloak_sub": "user-1",
            "client_class": "desktop",
            "current_session_id": "sid-d",
            "client_id": "empery-desktop",
            "first_seen_at": now - timedelta(minutes=2),
            "last_seen_at": now - timedelta(minutes=1),
            "ip_address": "10.88.89.150",
            "user_agent": "EliteEW-Desktop",
            "replaced_at": None,
            "previous_session_id": None,
        },
        {
            "keycloak_sub": "user-1",
            "client_class": "browser",
            "current_session_id": "sid-b",
            "client_id": "empery-web",
            "first_seen_at": now - timedelta(minutes=5),
            "last_seen_at": now - timedelta(minutes=1),
            "ip_address": "203.0.113.1",
            "user_agent": "Chrome",
            "replaced_at": None,
            "previous_session_id": None,
        },
    ]
    pool = _FakePool(_FakeConn(rows))

    async def _pool() -> _FakePool:
        return pool

    monkeypatch.setattr(query_mod, "get_asyncpg_pool", _pool)
    out = await query_mod.batch_sso_sessions_for_user_ids(["user-1"])
    assert out["user-1"]["desktop"] is not None
    assert out["user-1"]["desktop"]["client_id"] == "empery-desktop"
    assert out["user-1"]["desktop"]["active"] is True
    assert out["user-1"]["browser"] is not None
    assert out["user-1"]["mobile"] is None


def test_directory_sso_active_exists_accepts_desktop() -> None:
    from api.services.admin_users_directory import directory_sso_active_exists

    clause = directory_sso_active_exists("desktop")
    compiled = str(clause.compile(compile_kwargs={"literal_binds": True}))
    assert "desktop" in compiled
