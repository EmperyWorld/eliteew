# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Integration tests for ``AsyncPgOrchestrationStores`` and orchestrator persistence when DSN is set.
# Invariants:
# - Skips when ``EWA_DATABASE_URL`` is unset; uses unique ``session_id`` and deletes rows after.
# Related:
# - api/ewa_platform/core/orchestrator.py
# - api/ewa_platform/persistence_pg/orchestration_asyncpg.py
# ---
from __future__ import annotations

import asyncio
import os
import uuid

import pytest

from api.ewa_platform.contracts.desktop_observation import DesktopObservationKind
from api.ewa_platform.contracts.policy_context import PolicyContext
from api.ewa_platform.core.orchestration_context import OrchestrationContext
from api.ewa_platform.core.orchestrator import run_orchestration_turn
from api.ewa_platform.persistence_pg.orchestration_asyncpg import (
    AsyncPgOrchestrationStores,
    init_ewa_orchestration_schema,
    open_ewa_orchestration_pool,
)
from api.ewa_platform.testing.fake_desktop_driver import FakeDesktopDriver
from api.ewa_platform.testing.fake_llm_client import FakeLlmClient
from api.ewa_platform.testing.fake_policy_engine import FakePolicyEngine


@pytest.mark.integration
def test_asyncpg_orchestration_session_and_events_roundtrip() -> None:
    dsn = os.environ.get("EWA_DATABASE_URL")
    if not dsn:
        pytest.skip("EWA_DATABASE_URL not set")

    sid = f"s-pg-{uuid.uuid4()}"

    async def body() -> None:
        pool = await open_ewa_orchestration_pool(dsn, min_size=1, max_size=2)
        try:
            await init_ewa_orchestration_schema(pool)
            stores = AsyncPgOrchestrationStores(pool)
            assert await stores.get(sid) is None
            await stores.save(sid, {"phase": "planning", "n": 1})
            got = await stores.get(sid)
            assert got is not None
            assert got["phase"] == "planning"
            await stores.append(sid, {"kind": "observation", "payload": {"x": 1}})
            await stores.append(sid, {"kind": "intent_result", "ok": True})
            events = await stores.list_for_session(sid)
            assert len(events) == 2
            assert events[0]["seq"] == 0
            assert events[1]["seq"] == 1
            tail = await stores.list_for_session(sid, after_seq=0)
            assert len(tail) == 1
            assert tail[0]["seq"] == 1
        finally:
            async with pool.acquire() as conn:
                await conn.execute("DELETE FROM ewa_orchestration_session WHERE session_id = $1", sid)
            await pool.close()

    asyncio.run(body())


@pytest.mark.integration
def test_asyncpg_orchestrator_persists_session_snapshot() -> None:
    dsn = os.environ.get("EWA_DATABASE_URL")
    if not dsn:
        pytest.skip("EWA_DATABASE_URL not set")

    sid = f"s-orch-{uuid.uuid4()}"

    async def body() -> None:
        pool = await open_ewa_orchestration_pool(dsn, min_size=1, max_size=2)
        try:
            await init_ewa_orchestration_schema(pool)
            stores = AsyncPgOrchestrationStores(pool)
            ctx = OrchestrationContext(
                sessions=stores,
                events=stores,
                desktop=FakeDesktopDriver(),
                policy=FakePolicyEngine(allow=True),
                llm=FakeLlmClient(),
            )
            pctx = PolicyContext(principal_id="test-user", role_names=frozenset({"user"}))
            await run_orchestration_turn(
                ctx,
                session_id=sid,
                observation={
                    "observation_kind": DesktopObservationKind.ACTIVE_APP_CHANGED.value,
                    "app_component": "App",
                    "window_id": "w1",
                },
                policy_context=pctx,
            )
            st = await stores.get(sid)
            assert st is not None
            assert dict(st)["turns"] == 1
            assert dict(st)["last_branch"] == "intent_executed"
            events = await stores.list_for_session(sid)
            assert len(events) == 2
        finally:
            async with pool.acquire() as conn:
                await conn.execute("DELETE FROM ewa_orchestration_session WHERE session_id = $1", sid)
            await pool.close()

    asyncio.run(body())
