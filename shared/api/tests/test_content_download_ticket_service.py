# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit coverage for Unified Content download ticket issue/consume semantics and middleware public path scope.
# Invariants:
# - Tests use fake Redis only; no live Postgres/Redis or file storage.
# Related:
# - api/services/unified_content/content_download_ticket_service.py
# - api/middleware/oauth2_protection.py
# ---

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import pytest

from api.middleware.oauth2_protection import OAuth2ProtectionMiddleware
from api.services.unified_content import content_download_ticket_service as ticket_module
from api.services.unified_content.content_download_ticket_service import (
    ContentDownloadTicketService,
    ContentDownloadTicketUnavailableError,
)
from api.services.unified_content.performance_metrics import get_metrics


class _FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.ttl: dict[str, int] = {}
        self.deleted: list[str] = []

    async def setex(self, key: str, ttl: int, value: str) -> None:
        self.store[key] = value
        self.ttl[key] = ttl

    async def get(self, key: str) -> bytes | None:
        value = self.store.get(key)
        return value.encode("utf-8") if value is not None else None

    async def delete(self, key: str) -> None:
        self.deleted.append(key)
        self.store.pop(key, None)


class _FakeManager:
    def __init__(self, redis: _FakeRedis | None) -> None:
        self.redis = redis

    async def get_redis_client(self) -> _FakeRedis | None:
        return self.redis


def _payload(redis: _FakeRedis) -> dict[str, Any]:
    assert len(redis.store) == 1
    return json.loads(next(iter(redis.store.values())))


@pytest.mark.anyio
async def test_content_download_ticket_scopes_payload_and_allows_one_replay(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = _FakeRedis()

    async def _manager() -> _FakeManager:
        return _FakeManager(redis)

    monkeypatch.setattr(ticket_module, "get_database_manager", _manager)
    service = ContentDownloadTicketService()
    content_id = UUID("00000000-0000-0000-0000-000000000001")

    ticket, ttl = await service.issue(
        kind="content",
        user_id="user-1",
        resource_id=content_id,
        disposition="inline",
        revision="r1",
    )

    assert ttl == ticket_module.CONTENT_DOWNLOAD_TICKET_TTL_SECONDS
    issued_payload = _payload(redis)
    assert issued_payload["kind"] == "content"
    assert issued_payload["user_id"] == "user-1"
    assert issued_payload["resource_id"] == str(content_id)
    assert issued_payload["disposition"] == "inline"
    assert issued_payload["revision"] == "r1"

    first = await service.consume(ticket, expected_kind="content")
    assert first is not None
    assert first["reuse_remaining"] == ticket_module.CONTENT_DOWNLOAD_TICKET_REUSE_LIMIT
    assert next(iter(redis.ttl.values())) == ticket_module.CONTENT_DOWNLOAD_TICKET_REUSE_GRACE_SECONDS

    second = await service.consume(ticket, expected_kind="content")
    assert second is not None
    assert redis.store == {}

    assert await service.consume(ticket, expected_kind="content") is None


@pytest.mark.anyio
async def test_content_download_ticket_rejects_wrong_kind_and_deletes_key(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = _FakeRedis()

    async def _manager() -> _FakeManager:
        return _FakeManager(redis)

    monkeypatch.setattr(ticket_module, "get_database_manager", _manager)
    service = ContentDownloadTicketService()

    ticket, _ttl = await service.issue(
        kind="content",
        user_id="user-1",
        resource_id=UUID("00000000-0000-0000-0000-000000000002"),
    )

    assert await service.consume(ticket, expected_kind="version") is None
    assert redis.store == {}
    assert redis.deleted


def test_content_download_ticket_public_paths_are_narrow() -> None:
    middleware = OAuth2ProtectionMiddleware(lambda _scope, _receive, _send: None)

    assert middleware._is_public_path("/api/v1/content/00000000-0000-0000-0000-000000000001/download-by-ticket")
    assert middleware._is_public_path(
        "/api/v1/content/versions/00000000-0000-0000-0000-000000000002/download-by-ticket"
    )
    assert middleware._is_public_path("/api/v1/content/batch-download-by-ticket")
    assert middleware._is_public_path("/api/v1/content/download-owned-archive-by-ticket")
    assert middleware._is_public_path("/api/v1/ewrp/00000000-0000-0000-0000-000000000003/pdf")

    assert not middleware._is_public_path("/api/v1/content/00000000-0000-0000-0000-000000000001/download")
    assert not middleware._is_public_path("/api/v1/content/not-a-uuid/download-by-ticket")
    assert not middleware._is_public_path("/api/v1/ewrp/not-a-uuid/pdf")
    assert not middleware._is_public_path("/api/v1/ewrp/00000000-0000-0000-0000-000000000003/status")


@pytest.fixture(autouse=True)
def reset_download_ticket_metrics() -> None:
    get_metrics().reset()


@pytest.mark.anyio
async def test_content_download_ticket_metrics_record_issue_and_consume(monkeypatch: pytest.MonkeyPatch) -> None:
    redis = _FakeRedis()

    async def _manager() -> _FakeManager:
        return _FakeManager(redis)

    monkeypatch.setattr(ticket_module, "get_database_manager", _manager)
    service = ContentDownloadTicketService()
    metrics = get_metrics()

    ticket, _ttl = await service.issue(
        kind="content",
        user_id="user-1",
        resource_id=UUID("00000000-0000-0000-0000-000000000003"),
    )

    snapshot = metrics.get_download_ticket_metrics()
    assert snapshot["issue_ok"] == 1
    assert snapshot["issue_fail"] == 0
    assert snapshot["issue_by_kind"]["content"] == 1
    assert snapshot["blob_fallback_expected"] == 0

    assert await service.consume(ticket, expected_kind="content") is not None
    assert await service.consume("", expected_kind="content") is None
    assert await service.consume(ticket, expected_kind="version") is None

    snapshot = metrics.get_download_ticket_metrics()
    assert snapshot["consume_ok"] == 1
    assert snapshot["consume_fail"] == 2
    assert snapshot["consume_fail_by_reason"]["empty_ticket"] == 1
    assert snapshot["consume_fail_by_reason"]["wrong_kind"] == 1


@pytest.mark.anyio
async def test_content_download_ticket_metrics_record_issue_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    class _BrokenRedis(_FakeRedis):
        async def setex(self, key: str, ttl: int, value: str) -> None:
            raise RuntimeError("redis down")

    async def _manager() -> _FakeManager:
        return _FakeManager(_BrokenRedis())

    monkeypatch.setattr(ticket_module, "get_database_manager", _manager)
    service = ContentDownloadTicketService()
    metrics = get_metrics()

    with pytest.raises(ContentDownloadTicketUnavailableError):
        await service.issue(
            kind="batch",
            user_id="user-1",
            content_ids=[UUID("00000000-0000-0000-0000-000000000004")],
        )

    snapshot = metrics.get_download_ticket_metrics()
    assert snapshot["issue_ok"] == 0
    assert snapshot["issue_fail"] == 1
    assert snapshot["blob_fallback_expected"] == 1
