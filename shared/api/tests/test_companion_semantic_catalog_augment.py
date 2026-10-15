# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Boundary tests for companion catalog **semantic augment** (feature flag + graceful degrade).
# Invariants:
# - Flag OFF → no merge; flag ON without service → unchanged collected rows.
# Related:
# - api/ewa_platform/companion/storage/semantic_catalog_augment.py
# ---
"""Tests: companion semantic catalog augment."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest


@dataclass
class FakeRow:
    id: UUID
    name: str


def test_semantic_augment_disabled_returns_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.storage.semantic_catalog_augment import (
        augment_catalog_collected_semantic,
    )

    monkeypatch.setenv("EWA_COMPANION_SEMANTIC_CATALOG_ENABLED", "0")
    row = FakeRow(id=UUID("11111111-1111-1111-1111-111111111111"), name="a")
    out, used = asyncio.run(
        augment_catalog_collected_semantic(
            [row],
            query="finance report",
            content_user_id="user-1",
            query_svc=AsyncMock(),
        )
    )
    assert used is False
    assert out == [row]


def test_semantic_augment_enabled_without_service_is_noop(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.storage.semantic_catalog_augment import (
        augment_catalog_collected_semantic,
    )

    monkeypatch.setenv("EWA_COMPANION_SEMANTIC_CATALOG_ENABLED", "1")
    row = FakeRow(id=UUID("22222222-2222-2222-2222-222222222222"), name="b")
    with patch(
        "api.ewa_platform.companion.storage.semantic_catalog_augment._resolve_semantic_search_service",
        new=AsyncMock(return_value=None),
    ):
        out, used = asyncio.run(
            augment_catalog_collected_semantic(
                [row],
                query="contract terms",
                content_user_id="user-1",
                query_svc=AsyncMock(),
            )
        )
    assert used is False
    assert out == [row]


def test_semantic_augment_skips_when_keyword_hits_sufficient(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.storage.semantic_catalog_augment import (
        augment_catalog_collected_semantic,
    )

    monkeypatch.setenv("EWA_COMPANION_SEMANTIC_CATALOG_ENABLED", "1")
    rows = [
        FakeRow(id=UUID("11111111-1111-1111-1111-111111111111"), name="a"),
        FakeRow(id=UUID("22222222-2222-2222-2222-222222222222"), name="b"),
    ]
    search_svc = AsyncMock()
    search_svc.search = AsyncMock()
    with patch(
        "api.ewa_platform.companion.storage.semantic_catalog_augment._resolve_semantic_search_service",
        new=AsyncMock(return_value=search_svc),
    ):
        out, used = asyncio.run(
            augment_catalog_collected_semantic(
                rows,
                query="contract terms",
                content_user_id="11111111-1111-1111-1111-111111111111",
                query_svc=AsyncMock(),
            )
        )
    assert used is False
    assert out == rows
    search_svc.search.assert_not_called()


def test_semantic_augment_merges_acl_checked_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    from types import SimpleNamespace

    from api.ewa_platform.companion.storage.semantic_catalog_augment import (
        augment_catalog_collected_semantic,
    )

    monkeypatch.setenv("EWA_COMPANION_SEMANTIC_CATALOG_ENABLED", "1")
    content_id = UUID("33333333-3333-3333-3333-333333333333")
    user_id = "11111111-1111-1111-1111-111111111111"
    hit = SimpleNamespace(content_id=content_id, title="hit", description="snippet", score=0.9, metadata={})
    search_svc = AsyncMock()
    search_svc.search = AsyncMock(return_value=[hit])
    content = SimpleNamespace(
        id=content_id,
        name="merged-doc",
        content_type="document",
        description="body",
        mime_type="text/plain",
    )
    query_svc = AsyncMock()
    query_svc.get_content = AsyncMock(return_value=content)
    with patch(
        "api.ewa_platform.companion.storage.semantic_catalog_augment._resolve_semantic_search_service",
        new=AsyncMock(return_value=search_svc),
    ):
        out, used = asyncio.run(
            augment_catalog_collected_semantic(
                [],
                query="договор",
                content_user_id=user_id,
                query_svc=query_svc,
            )
        )
    assert used is True
    assert len(out) == 1
    assert str(out[0].id) == str(content_id)
    assert out[0].name == "merged-doc"
    assert out[0].search_matched_scope == "semantic"
    query_svc.get_content.assert_awaited_once_with(content_id, user_id)
