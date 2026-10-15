# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for agentic session revision guards and config helpers.
# Invariants:
# - No live Postgres — fake asyncpg pool/connection only.
# Related:
# - api/ewa_platform/persistence_pg/agentic_asyncpg.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from api.ewa_platform.agentic import config as agentic_config
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg


class _FakeTransaction:
    async def __aenter__(self) -> _FakeTransaction:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


def _session_row(*, session_revision: int = 1, status: str = "init") -> dict[str, Any]:
    now = datetime(2026, 7, 5, 12, 0, 0, tzinfo=UTC)
    return {
        "id": "sess-1",
        "principal_id": "principal-1",
        "status": status,
        "session_revision": session_revision,
        "goal_json": {"text": "plan trip"},
        "plan_summary": "",
        "active_node_id": None,
        "policy_json": {},
        "working_memory_json": {},
        "gate_json": {},
        "linked_task_run_id": None,
        "lease_holder": None,
        "leased_until": None,
        "last_heartbeat_at": None,
        "iteration_count": 0,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    }


class _FakeConn:
    def __init__(self, *, session_revision: int = 1, status: str = "init") -> None:
        self.session_revision = session_revision
        self.status = status

    def transaction(self) -> _FakeTransaction:
        return _FakeTransaction()

    async def fetchrow(self, query: str, *args: Any) -> dict[str, Any] | None:
        q = query.strip().lower()
        if "for update" in q and "select session_revision" in q:
            return {"session_revision": self.session_revision, "status": self.status}
        if "update ewa_agentic_sessions" in q:
            session_id, principal_id = args[0], args[1]
            if session_id != "sess-1" or principal_id != "principal-1":
                return None
            for arg in args[3:]:
                if isinstance(arg, str) and arg in (
                    agentic_pg.ACTIVE_SESSION_STATUSES | agentic_pg.TERMINAL_SESSION_STATUSES
                ):
                    self.status = arg
            self.session_revision += 1
            return _session_row(session_revision=self.session_revision, status=self.status)
        return None


class _FakeConnContext:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self._conn

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    def acquire(self) -> _FakeConnContext:
        return _FakeConnContext(self._conn)


@pytest.mark.asyncio
async def test_agentic_session_update_bumps_revision() -> None:
    conn = _FakeConn(session_revision=2, status="planning")
    pool = _FakePool(conn)

    updated = await agentic_pg.agentic_session_update(
        pool,  # type: ignore[arg-type]
        session_id="sess-1",
        principal_id="principal-1",
        status="executing",
        expect_revision=2,
    )
    assert updated is not None
    assert updated["session_revision"] == 3
    assert updated["status"] == "executing"


@pytest.mark.asyncio
async def test_agentic_session_update_rejects_stale_revision() -> None:
    conn = _FakeConn(session_revision=5, status="executing")
    pool = _FakePool(conn)

    updated = await agentic_pg.agentic_session_update(
        pool,  # type: ignore[arg-type]
        session_id="sess-1",
        principal_id="principal-1",
        status="completed",
        expect_revision=3,
    )
    assert updated is None


def test_agentic_substrate_disabled_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_AGENTIC_SUBSTRATE_ENABLED", raising=False)
    assert agentic_config.agentic_substrate_enabled() is False


def test_agentic_substrate_enabled_when_env_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    assert agentic_config.agentic_substrate_enabled() is True


def test_agentic_substrate_enabled_from_db_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    """After bootstrap, EWA_* reads DB cache via os.getenv shim (compose env ignored)."""

    from api.ewa_platform.settings import service as settings_service

    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "0")
    settings_service._apply_cache({"EWA_AGENTIC_SUBSTRATE_ENABLED": "1"})
    settings_service.install_ewa_settings_getenv_shim()
    assert agentic_config.agentic_substrate_enabled() is True
