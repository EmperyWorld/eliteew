# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit/integration-style tests for episodic re-embed batch drain, row pacing, and Qdrant backoff.
# Invariants:
# - No live Postgres/Qdrant/Redis; mocks and pytest-asyncio only.
# Related:
# - api/ewa_platform/companion/episodic/reembed.py
# - api/ewa_platform/companion/episodic/reembed_backoff.py
# ---

from __future__ import annotations

from collections.abc import Callable
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.episodic import reembed as rer
from api.ewa_platform.companion.episodic.reembed_backoff import (
    QdrantUpsertBackoffResult,
    is_transient_qdrant_error,
    upsert_companion_episodic_with_backoff,
)
from api.ewa_platform.persistence_vector.companion_qdrant import CompanionEpisodicPoint

pytestmark = pytest.mark.unit


@pytest.fixture
def fake_pool() -> MagicMock:
    """Lightweight asyncpg pool double for episodic re-embed tests."""

    return MagicMock(name="ewa_asyncpg_pool")


@pytest.fixture
def episode_row() -> dict[str, Any]:
    return {
        "id": "ep-test-001",
        "principal_id": "principal-1",
        "body": "observation:idle app=notes title=doc",
        "kind": "observation",
        "source": "proactive_observer",
        "persona": "parent",
        "importance": 0.35,
        "valence": 0.55,
        "turn_id": None,
        "extra": {},
        "created_at": "2026-05-27T12:00:00+00:00",
    }


def _settings_batch(monkeypatch: pytest.MonkeyPatch, batch: int, *, row_delay_ms: int = 0) -> None:
    monkeypatch.setattr(
        rer,
        "get_cached_setting_int",
        lambda key, default=0: {
            rer._REEMBED_BATCH_ENV: batch,
            rer._REEMBED_ROW_DELAY_MS_ENV: row_delay_ms,
            rer._REEMBED_DRAIN_MAX_ROUNDS_ENV: 48,
        }.get(key, default),
    )


@pytest.mark.asyncio
async def test_is_transient_qdrant_error_detects_rate_limit_and_503() -> None:
    assert is_transient_qdrant_error(RuntimeError("HTTP 429 Too Many Requests"))
    assert is_transient_qdrant_error(RuntimeError("503 Service Unavailable"))
    assert not is_transient_qdrant_error(RuntimeError("invalid payload shape"))


@pytest.mark.asyncio
async def test_reembed_batch_size_respects_settings_cache(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _settings_batch(monkeypatch, 256)
    assert rer.reembed_batch_size() == 256
    _settings_batch(monkeypatch, 128)
    assert rer.reembed_batch_size() == 128


@pytest.mark.asyncio
async def test_reembed_drain_stops_when_queue_empty(
    monkeypatch: pytest.MonkeyPatch,
    fake_pool: MagicMock,
) -> None:
    monkeypatch.setattr(rer, "hcm_episodic_enabled", lambda: True)

    async def fake_count(_pool: Any, *, principal_id: str | None = None) -> int:
        return 0

    monkeypatch.setattr(rer, "episodes_pending_count", fake_count)

    out = await rer.companion_reembed_drain_pending_backlog(fake_pool)
    assert out["rounds"] == 0
    assert out["pending_remaining"] == 0
    assert out["indexed_total"] == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("batch_size,expected_rounds", [(128, 4), (256, 2)])
async def test_reembed_drain_runs_rounds_until_drained_or_cap(
    monkeypatch: pytest.MonkeyPatch,
    fake_pool: MagicMock,
    batch_size: int,
    expected_rounds: int,
) -> None:
    """Simulate backlog shrink per batch (128×3 + remainder, or 256×1 + remainder)."""

    monkeypatch.setattr(rer, "hcm_episodic_enabled", lambda: True)
    _settings_batch(monkeypatch, batch_size)

    if batch_size == 128:
        pending_sequence = [400, 272, 144, 16, 0]
    else:
        pending_sequence = [400, 144, 0]
    batch_calls: list[int] = []

    async def fake_count(_pool: Any, *, principal_id: str | None = None) -> int:
        return pending_sequence.pop(0) if pending_sequence else 0

    async def fake_batch(_pool: Any, *, principal_id: str | None = None) -> dict[str, Any]:
        size = rer.reembed_batch_size()
        batch_calls.append(size)
        return {"examined": size, "indexed": size, "failed": 0, "batch_size": size}

    monkeypatch.setattr(rer, "episodes_pending_count", fake_count)
    monkeypatch.setattr(rer, "companion_reembed_pending_episodes_batch", fake_batch)

    out = await rer.companion_reembed_drain_pending_backlog(fake_pool, max_rounds=10)

    assert out["rounds"] == expected_rounds
    assert len(batch_calls) == expected_rounds
    assert all(size == batch_size for size in batch_calls)
    assert out["indexed_total"] == batch_size * expected_rounds
    assert out["pending_remaining"] == 0


@pytest.mark.asyncio
async def test_reembed_drain_respects_max_rounds_cap(
    monkeypatch: pytest.MonkeyPatch,
    fake_pool: MagicMock,
) -> None:
    monkeypatch.setattr(rer, "hcm_episodic_enabled", lambda: True)
    _settings_batch(monkeypatch, 128)

    async def fake_count(_pool: Any, *, principal_id: str | None = None) -> int:
        return 900

    async def fake_batch(_pool: Any, *, principal_id: str | None = None) -> dict[str, Any]:
        return {"examined": 128, "indexed": 128, "failed": 0}

    monkeypatch.setattr(rer, "episodes_pending_count", fake_count)
    monkeypatch.setattr(rer, "companion_reembed_pending_episodes_batch", fake_batch)

    out = await rer.companion_reembed_drain_pending_backlog(fake_pool, max_rounds=2)

    assert out["rounds"] == 2
    assert out["max_rounds"] == 2
    assert out["pending_remaining"] == 900


@pytest.mark.asyncio
async def test_batch_row_pacing_calls_asyncio_sleep_with_configured_delay(
    monkeypatch: pytest.MonkeyPatch,
    fake_pool: MagicMock,
    episode_row: dict[str, Any],
) -> None:
    """``EWA_COMPANION_EPISODES_REEMBED_ROW_DELAY_MS`` → seconds passed to ``asyncio.sleep``."""

    monkeypatch.setattr(rer, "hcm_episodic_enabled", lambda: True)
    _settings_batch(monkeypatch, 128, row_delay_ms=50)

    rows = [dict(episode_row, id=f"ep-{i}") for i in range(3)]

    async def fake_pending(_pool: Any, *, principal_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        return rows

    async def fake_count(_pool: Any, *, principal_id: str | None = None) -> int:
        return 0

    async def fake_client() -> object:
        return object()

    async def fake_index(_pool: Any, _client: Any, *, ep: dict[str, Any]) -> tuple[bool, bool]:
        return True, False

    sleep_calls: list[float] = []

    async def fake_sleep(delay: float) -> None:
        sleep_calls.append(delay)

    monkeypatch.setattr(rer, "episodes_pending_vector", fake_pending)
    monkeypatch.setattr(rer, "episodes_pending_count", fake_count)
    monkeypatch.setattr(rer, "_qdrant_client", fake_client)
    monkeypatch.setattr(rer, "_index_episode_row", fake_index)
    monkeypatch.setattr(rer.asyncio, "sleep", fake_sleep)

    out = await rer.companion_reembed_pending_episodes_batch(fake_pool)

    assert out["examined"] == 3
    assert out["indexed"] == 3
    assert sleep_calls == [0.05, 0.05]


@pytest.mark.asyncio
async def test_reembed_transient_qdrant_exhaustion_leaves_row_pending(
    monkeypatch: pytest.MonkeyPatch,
    fake_pool: MagicMock,
    episode_row: dict[str, Any],
) -> None:
    failed_marks: list[str] = []
    indexed_marks: list[str] = []

    async def fake_embed(_text: str) -> tuple[list[float], str, int]:
        return [0.1, 0.2, 0.3], "embed-model", 3

    async def fake_ensure(_client: Any, *, dim: int) -> bool:
        return True

    async def fake_upsert(*_args: Any, **_kwargs: Any) -> QdrantUpsertBackoffResult:
        return QdrantUpsertBackoffResult(ok=False, transient_exhausted=True)

    async def fake_failed(_pool: Any, *, episode_id: str, reason: str) -> bool:
        failed_marks.append(f"{episode_id}:{reason}")
        return True

    async def fake_indexed(_pool: Any, *, episode_id: str, vector_model: str | None, vector_dim: int | None) -> bool:
        indexed_marks.append(f"{episode_id}:{vector_model}:{vector_dim}")
        return True

    monkeypatch.setattr(rer, "_embed_text", fake_embed)
    monkeypatch.setattr(rer, "ensure_companion_episodic_collection", fake_ensure)
    monkeypatch.setattr(rer, "upsert_companion_episodic_with_backoff_result", fake_upsert)
    monkeypatch.setattr(rer, "episode_mark_failed", fake_failed)
    monkeypatch.setattr(rer, "episode_mark_indexed", fake_indexed)

    did_index, did_fail = await rer._index_episode_row(fake_pool, object(), ep=episode_row)

    assert (did_index, did_fail) == (False, False)
    assert failed_marks == []
    assert indexed_marks == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("exc_factory", "expected_transient"),
    [
        (lambda: RuntimeError("HTTP 429 Too Many Requests"), True),
        (lambda: RuntimeError("503 Service Unavailable"), True),
        (lambda: TimeoutError("request timed out"), True),
        (lambda: ValueError("bad vector dimension"), False),
    ],
)
async def test_upsert_backoff_transient_detection(
    exc_factory: Callable[[], BaseException],
    expected_transient: bool,
) -> None:
    assert is_transient_qdrant_error(exc_factory()) is expected_transient


@pytest.mark.asyncio
async def test_upsert_backoff_retries_transient_then_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"n": 0}
    sleep_delays: list[float] = []

    async def fake_upsert(*_args: Any, **_kwargs: Any) -> bool:
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("429 Too Many Requests")
        if calls["n"] == 2:
            raise RuntimeError("503 Service Unavailable")
        return True

    async def fake_sleep(delay: float) -> None:
        sleep_delays.append(delay)

    monkeypatch.setattr(
        "api.ewa_platform.companion.episodic.reembed_backoff.upsert_companion_episodic",
        fake_upsert,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.episodic.reembed_backoff.asyncio.sleep",
        fake_sleep,
    )

    point = CompanionEpisodicPoint(
        episode_id="ep-backoff-1",
        principal_id="p1",
        body="hello",
    )
    ok = await upsert_companion_episodic_with_backoff(
        object(),
        dim=768,
        point=point,
        vector=[0.1, 0.2, 0.3],
        max_attempts=4,
        base_delay_sec=0.1,
        max_delay_sec=0.4,
    )

    assert ok is True
    assert calls["n"] == 3
    assert sleep_delays == [0.1, 0.2]


@pytest.mark.asyncio
async def test_upsert_backoff_exhausts_on_persistent_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"n": 0}

    async def fake_upsert(*_args: Any, **_kwargs: Any) -> bool:
        calls["n"] += 1
        raise TimeoutError("timed out")

    monkeypatch.setattr(
        "api.ewa_platform.companion.episodic.reembed_backoff.upsert_companion_episodic",
        fake_upsert,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.episodic.reembed_backoff.asyncio.sleep",
        AsyncMock(),
    )

    point = CompanionEpisodicPoint(
        episode_id="ep-backoff-2",
        principal_id="p1",
        body="hello",
    )
    ok = await upsert_companion_episodic_with_backoff(
        object(),
        dim=768,
        point=point,
        vector=[0.1],
        max_attempts=3,
        base_delay_sec=0.01,
        max_delay_sec=0.05,
    )

    assert ok is False
    assert calls["n"] == 3
