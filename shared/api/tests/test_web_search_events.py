# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Tests for web search event recording, stats aggregation, and query fingerprinting.
# Related:
# - api/services/web_search_events_service.py
# ---

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest

from api.models.web_search_event import WebSearchEvent
from api.services import web_search_events_service as ev


@dataclass
class _ScalarDb:
    rows: list[WebSearchEvent] = field(default_factory=list)
    added: list[WebSearchEvent] = field(default_factory=list)

    async def commit(self) -> None:
        self.rows.extend(self.added)
        self.added.clear()

    async def rollback(self) -> None:
        self.added.clear()

    def add(self, obj: Any) -> None:  # noqa: ANN401
        if isinstance(obj, WebSearchEvent):
            self.added.append(obj)


def test_web_search_query_fingerprint_is_stable() -> None:
    assert ev.web_search_query_fingerprint("Hello") == ev.web_search_query_fingerprint("  hello  ")
    assert ev.web_search_query_fingerprint("") == ""


@pytest.mark.asyncio
async def test_record_web_search_event_persists_row() -> None:
    db = _ScalarDb()
    uid = uuid4()
    await ev.record_web_search_event(
        db,  # type: ignore[arg-type]
        surface="desktop",
        status="ok",
        latency_ms=42,
        hit_count=2,
        error_code=None,
        cache_hit=False,
        actor_user_id=uid,
        query="test query",
    )
    assert len(db.rows) == 1
    row = db.rows[0]
    assert row.surface == "desktop"
    assert row.status == "ok"
    assert row.provider == "yandex"
    assert row.hit_count == 2
    assert row.query_fingerprint == ev.web_search_query_fingerprint("test query")
    assert row.actor_user_id == uid


@pytest.mark.asyncio
async def test_record_web_search_event_skips_without_db() -> None:
    await ev.record_web_search_event(
        None,
        surface="desktop",
        status="ok",
        latency_ms=1,
    )


@pytest.mark.asyncio
async def test_get_web_search_stats_aggregates(monkeypatch: pytest.MonkeyPatch) -> None:
    now = datetime.now(UTC)
    rows = [
        WebSearchEvent(
            surface="desktop",
            status="ok",
            provider="yandex",
            latency_ms=100,
            hit_count=3,
            cache_hit=True,
            created_at=now - timedelta(hours=1),
        ),
        WebSearchEvent(
            surface="ewa",
            status="empty",
            provider="yandex",
            latency_ms=200,
            hit_count=0,
            cache_hit=False,
            created_at=now - timedelta(hours=2),
        ),
        WebSearchEvent(
            surface="desktop",
            status="error",
            provider="yandex",
            latency_ms=50,
            hit_count=0,
            error_code="http_429",
            created_at=now - timedelta(hours=3),
        ),
    ]

    class _StatsDb:
        async def scalar(self, stmt: Any) -> int | None:  # noqa: ANN401
            sql = str(stmt)
            if "count" in sql.lower():
                if "status = :status_1" in sql or "status = 'ok'" in sql:
                    return sum(1 for r in rows if r.status == "ok")
                if "status = :status_2" in sql or "empty" in sql:
                    return sum(1 for r in rows if r.status == "empty")
                if "error" in sql:
                    return sum(1 for r in rows if r.status == "error")
                if "blocked" in sql:
                    return 0
                if "quota_denied" in sql:
                    return 0
                if "cache_hit" in sql:
                    return sum(1 for r in rows if r.cache_hit)
                return len(rows)
            return None

        async def scalars(self, stmt: Any):  # noqa: ANN401
            class _Result:
                def all(self) -> list[int]:
                    return [r.latency_ms for r in rows if r.status in {"ok", "empty"}]

            return _Result()

        async def execute(self, stmt: Any):  # noqa: ANN401
            class _Result:
                def all(self) -> list[tuple[str, int]]:
                    counts: dict[str, int] = {}
                    for r in rows:
                        counts[r.surface] = counts.get(r.surface, 0) + 1
                    return sorted(counts.items())

            return _Result()

    stats = await ev.get_web_search_stats(_StatsDb(), period="24h")  # type: ignore[arg-type]
    assert stats["total"] == 3
    assert stats["ok"] == 1
    assert stats["empty"] == 1
    assert stats["error"] == 1
    assert stats["cache_hits"] == 1
    assert "by_surface" in stats
