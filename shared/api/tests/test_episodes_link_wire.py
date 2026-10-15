# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Wire contract for ``ewa_companion_episode_link`` AsyncPG helpers (Wave 1 graph-lite prelude).
# Invariants:
# - No DB I/O — exercises guard rails + mocked ``fetchrow`` contract.
# Related:
# - api/ewa_platform/persistence_pg/episodes_asyncpg.py
# ---
"""Tests: companion episode_link helpers."""

from __future__ import annotations

import asyncio
from typing import Any

from api.ewa_platform.persistence_pg import episodes_asyncpg as ep_pg


def test_episode_link_insert_blank_ids_noop() -> None:
    calls: list[str] = []

    class _Conn:
        async def fetchrow(self, *_a: Any, **_k: Any) -> dict[str, str]:
            calls.append("fetchrow")
            return {"id": "x"}

        async def execute(self, *_a: Any, **_k: Any) -> str:
            calls.append("execute")
            return "OK"

    class _Tx:
        async def __aenter__(self) -> _Conn:
            return _Conn()

        async def __aexit__(self, *_args: Any) -> None:
            return None

    class _Pool:
        def acquire(self) -> _Tx:
            return _Tx()

    async def _run() -> bool:
        return await ep_pg.episode_link_insert(
            _Pool(),
            link_id="l1",
            principal_id="p1",
            from_episode_id="",
            to_episode_id="e2",
        )

    ok = asyncio.run(_run())
    assert ok is False
    assert calls == []


def test_episode_link_insert_issues_insert() -> None:
    calls: list[str] = []

    class _Conn:
        async def fetchrow(self, *_a: Any, **_k: Any) -> dict[str, str]:
            calls.append("fetchrow")
            return {"id": "l1"}

    class _Tx:
        async def __aenter__(self) -> _Conn:
            return _Conn()

        async def __aexit__(self, *_args: Any) -> None:
            return None

    class _Pool:
        def acquire(self) -> _Tx:
            return _Tx()

    async def _run() -> bool:
        return await ep_pg.episode_link_insert(
            _Pool(),
            link_id="l1",
            principal_id="principal-a",
            from_episode_id="e-from",
            to_episode_id="e-to",
            relation="continues",
            emotion_tag="relief",
        )

    ok = asyncio.run(_run())
    assert ok is True
    assert calls == ["fetchrow"]
