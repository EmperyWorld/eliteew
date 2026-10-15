# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for companion chat turn dedup (client_turn_id replay cache, Phase 3).
# Invariants:
# - No live Postgres — companion_asyncpg is mocked.
# Related:
# - api/ewa_platform/companion/turn/turn_dedup.py
# ---

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import MagicMock

import pytest

from api.ewa_platform.companion.turn import turn_dedup


@pytest.mark.unit
def test_normalize_client_turn_id_trims_and_caps() -> None:
    assert turn_dedup.normalize_client_turn_id("  abc  ") == "abc"
    assert len(turn_dedup.normalize_client_turn_id("x" * 200)) == 128
    assert turn_dedup.normalize_client_turn_id(None) == ""
    assert turn_dedup.normalize_client_turn_id("") == ""


@pytest.mark.unit
def test_try_fetch_returns_none_without_client_turn_id() -> None:
    pool = MagicMock()
    out = asyncio.run(
        turn_dedup.companion_turn_dedup_try_fetch_response(
            pool,
            principal_id="p1",
            client_turn_id=None,
        )
    )
    assert out is None
    pool.acquire.assert_not_called()


@pytest.mark.unit
def test_try_fetch_returns_snapshot(monkeypatch: pytest.MonkeyPatch) -> None:
    snap = {"reply": "Hi again", "companion_revision": 3}

    async def fake_fetch(
        _pool: Any,
        *,
        principal_id: str,
        client_turn_id: str,
    ) -> dict[str, Any]:
        assert principal_id == "p1"
        assert client_turn_id == "turn-1"
        return {"response_snapshot": snap}

    monkeypatch.setattr(
        turn_dedup.companion_pg,
        "companion_turn_dedup_fetch",
        fake_fetch,
    )
    out = asyncio.run(
        turn_dedup.companion_turn_dedup_try_fetch_response(
            MagicMock(),
            principal_id="p1",
            client_turn_id="turn-1",
        )
    )
    assert out == snap


@pytest.mark.unit
def test_store_skips_empty_client_turn_id(monkeypatch: pytest.MonkeyPatch) -> None:
    called = {"n": 0}

    async def fake_upsert(*_a: Any, **_k: Any) -> None:
        called["n"] += 1

    monkeypatch.setattr(
        turn_dedup.companion_pg,
        "companion_turn_dedup_upsert",
        fake_upsert,
    )
    asyncio.run(
        turn_dedup.companion_turn_dedup_store_response(
            MagicMock(),
            principal_id="p1",
            client_turn_id="",
            response={"reply": "x"},
        )
    )
    assert called["n"] == 0


@pytest.mark.unit
def test_sse_replay_emits_delta_final_done() -> None:
    snapshot = {
        "reply": "Cached reply",
        "companion_revision": 5,
        "actions": [],
    }

    async def collect() -> list[str]:
        chunks: list[str] = []
        async for piece in turn_dedup.iter_companion_turn_dedup_sse_replay(snapshot):
            chunks.append(piece)
        return chunks

    chunks = asyncio.run(collect())
    joined = "".join(chunks)
    assert "event: delta" in joined
    assert "Cached reply" in joined
    assert "event: final" in joined
    assert "event: done" in joined
    assert "idempotent_replay" in joined


@pytest.mark.unit
def test_ttl_hours_default_and_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_TURN_DEDUP_TTL_HOURS", raising=False)
    assert turn_dedup.companion_turn_dedup_ttl_hours() == 24
    monkeypatch.setenv("EWA_COMPANION_TURN_DEDUP_TTL_HOURS", "48")
    assert turn_dedup.companion_turn_dedup_ttl_hours() == 48
    monkeypatch.setenv("EWA_COMPANION_TURN_DEDUP_TTL_HOURS", "9999")
    assert turn_dedup.companion_turn_dedup_ttl_hours() == turn_dedup._MAX_TTL_HOURS


@pytest.mark.unit
def test_purge_expired_delegates_to_pg(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}

    async def fake_delete(_pool: Any, *, cutoff) -> int:
        seen["cutoff"] = cutoff
        return 3

    monkeypatch.setattr(
        turn_dedup.companion_pg,
        "companion_turn_dedup_delete_older_than",
        fake_delete,
    )
    monkeypatch.setenv("EWA_COMPANION_TURN_DEDUP_TTL_HOURS", "24")
    deleted = asyncio.run(turn_dedup.companion_turn_dedup_purge_expired(MagicMock()))
    assert deleted == 3
    assert seen["cutoff"] is not None
