# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for **catalog keyword discovery** appendix without implicit Content Manager ``open_app`` side effects.
# Invariants:
# - Mock ``list_content``; assert markdown lists only server-returned ids.
# Related:
# - api/ewa_platform/companion/storage/catalog_find.py
# ---
"""Tests: companion catalogue find augmentation."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from unittest.mock import AsyncMock
from uuid import UUID

import pytest


@pytest.fixture(autouse=True)
def enable_catalog_find(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_CATALOG_FIND", raising=False)
    os.environ["EWA_COMPANION_CATALOG_FIND"] = "1"


@dataclass
class FakeRow:
    id: UUID
    name: str
    content_type: str = "document"
    mime_type: str = "text/plain"
    search_matched_scope: str | None = None
    search_snippet: str | None = None


def test_catalog_find_appendix_without_cm_filter() -> None:
    from api.ewa_platform.companion.storage.catalog_find import augment_companion_catalog_find_reply

    u1 = UUID("11111111-1111-1111-1111-111111111111")

    svc = AsyncMock()
    svc.list_content = AsyncMock(return_value=([FakeRow(id=u1, name="finance-audit")], 1))

    actions, appendix = asyncio.run(
        augment_companion_catalog_find_reply(
            "найди файлы про финансы",
            [],
            content_catalog_user_id="catalog-user",
            oauth2_sub=None,
            query_svc=svc,
        )
    )
    assert "finance-audit" in appendix
    assert "Catalog (EwaFile keyword)" in appendix
    assert "uc=" in appendix
    assert svc.list_content.call_args.kwargs.get("limit") == 30
    assert svc.list_content.call_args.kwargs.get("search_scope") == "hybrid"
    assert svc.list_content.call_args.kwargs.get("folder_item_id") == "ewa_file"
    assert actions == []


def test_catalog_find_body_scope_adds_snippet_and_clean_filter() -> None:
    from api.ewa_platform.companion.storage.catalog_find import augment_companion_catalog_find_reply

    u1 = UUID("12121212-1212-1212-1212-121212121212")

    svc = AsyncMock()
    svc.list_content = AsyncMock(
        return_value=(
            [
                FakeRow(
                    id=u1,
                    name="contract.md",
                    search_matched_scope="content",
                    search_snippet="... существенная амортизация оборудования ...",
                )
            ],
            1,
        )
    )

    actions, appendix = asyncio.run(
        augment_companion_catalog_find_reply(
            "найди документы где написано амортизация",
            [],
            content_catalog_user_id="catalog-user",
            oauth2_sub=None,
            query_svc=svc,
        )
    )
    assert svc.list_content.call_args.kwargs.get("search_scope") == "hybrid"
    assert svc.list_content.call_args.kwargs.get("search_query") == "амортизация"
    assert "match: content" in appendix
    assert "амортизация" in appendix
    assert actions == []


def test_catalog_browse_ru_no_shell_lists_without_search_query() -> None:
    from api.ewa_platform.companion.storage.catalog_find import augment_companion_catalog_find_reply

    u1 = UUID("22222222-2222-2222-2222-222222222222")
    u2 = UUID("33333333-3333-3333-3333-333333333333")
    svc = AsyncMock()
    svc.list_content = AsyncMock(
        return_value=(
            [
                FakeRow(id=u1, name="alpha"),
                FakeRow(id=u2, name="beta"),
            ],
            15,
        )
    )

    actions, appendix = asyncio.run(
        augment_companion_catalog_find_reply(
            "посмотри список всех файлов",
            [],
            content_catalog_user_id="catalog-user",
            oauth2_sub=None,
            query_svc=svc,
        )
    )
    svc.list_content.assert_called_once()
    call_kw = svc.list_content.call_args.kwargs
    assert call_kw.get("search_query") is None
    assert call_kw.get("limit") == 200
    assert call_kw.get("user_id") == "catalog-user"
    assert call_kw.get("folder_item_id") == "ewa_file"
    assert "Catalog (EwaFile browse)" in appendix
    assert "Total rows in **EwaFile** workspace" in appendix
    assert actions == []


def test_catalog_bundle_builds_clickable_file_list_surface() -> None:
    from api.ewa_platform.companion.storage.catalog_find import (
        CompanionCatalogFindBundle,
        catalog_find_bundle_output_surface,
    )
    from api.ewa_platform.gateways.runtime_gateway.runtime_context import normalize_catalog_filters

    u1 = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    bundle = CompanionCatalogFindBundle(
        browse_all=True,
        keyword_query="",
        filters=normalize_catalog_filters(),
        preferences=None,
        collected_rows=(FakeRow(id=u1, name="alpha.md", search_snippet="hello"),),
        appendix="---\n**Catalog (EwaFile browse):**\n- alpha.md `uc=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`\n",
    )

    surface = catalog_find_bundle_output_surface(bundle)

    assert surface is not None
    assert surface["mode"] == "file_list"
    assert surface["payload"]["items"][0] == {
        "unifiedContentId": str(u1),
        "title": "alpha.md",
        "contentType": "document",
        "mimeType": "text/plain",
        "updatedAt": "",
        "snippet": "hello",
    }


def test_catalog_find_find_only_empty_tail_browses() -> None:
    from api.ewa_platform.companion.storage.catalog_find import augment_companion_catalog_find_reply

    u1 = UUID("44444444-4444-4444-4444-444444444444")
    svc = AsyncMock()
    svc.list_content = AsyncMock(return_value=([FakeRow(id=u1, name="solo")], 1))

    _, appendix = asyncio.run(
        augment_companion_catalog_find_reply(
            "найди файлы",
            [],
            content_catalog_user_id="catalog-user",
            oauth2_sub=None,
            query_svc=svc,
        )
    )
    svc.list_content.assert_called_once()
    assert svc.list_content.call_args.kwargs.get("search_query") is None
    assert "Catalog (EwaFile browse)" in appendix


def test_augment_with_prebuilt_skips_list_content() -> None:
    from api.ewa_platform.companion.storage.catalog_find import (
        CompanionCatalogFindBundle,
        augment_companion_catalog_find_reply,
    )
    from api.ewa_platform.gateways.runtime_gateway.runtime_context import normalize_catalog_filters

    u1 = UUID("55555555-5555-5555-5555-555555555555")
    bundle = CompanionCatalogFindBundle(
        browse_all=True,
        keyword_query="",
        filters=normalize_catalog_filters(),
        preferences=None,
        collected_rows=(FakeRow(id=u1, name="prefetched"),),
        appendix=("---\n**Catalog (browse):**\n- prefetched `uc=55555555-5555-5555-5555-555555555555`\n"),
    )
    svc = AsyncMock()
    actions, appendix = asyncio.run(
        augment_companion_catalog_find_reply(
            "посмотри список всех файлов",
            [],
            content_catalog_user_id="catalog-user",
            oauth2_sub=None,
            query_svc=svc,
            prebuilt_bundle=bundle,
        )
    )
    svc.list_content.assert_not_called()
    assert "prefetched" in appendix
    assert actions == []


def test_catalog_find_skip_when_doc_open_intent() -> None:
    from api.ewa_platform.companion.storage.catalog_find import augment_companion_catalog_find_reply

    svc = AsyncMock()

    merged, appendix = asyncio.run(
        augment_companion_catalog_find_reply(
            "открой отчёт в редакторе документов",
            [],
            content_catalog_user_id="catalog-user",
            oauth2_sub=None,
            query_svc=svc,
        )
    )
    svc.list_content.assert_not_called()
    assert merged == []
    assert appendix == ""


def test_merge_catalog_appendix_dedupes_model_echo() -> None:
    from api.ewa_platform.companion.turn.chat_turn import _merge_visible_reply_catalog_appendix

    cat = "---\n**Catalog (browse):**\n- alpha `uc=22222222-2222-2222-2222-222222222222`\n"
    body = f"См. каталог ниже.\n\n{cat}\n\n{cat}"
    merged = _merge_visible_reply_catalog_appendix(body, cat)
    assert merged.count("**Catalog (browse):**") == 1
    assert merged.endswith(cat.strip())


def test_file_list_surface_suppresses_visible_catalog_appendix() -> None:
    from api.ewa_platform.companion.turn.chat_turn import _merge_visible_reply_catalog_appendix_unless_surface

    cat = "---\n**Catalog (browse):**\n- alpha `uc=22222222-2222-2222-2222-222222222222`\n"
    visible = f"Вот файлы.\n\n{cat}"

    merged = _merge_visible_reply_catalog_appendix_unless_surface(visible, cat, {"mode": "file_list"})

    assert merged == "Вот файлы."
    assert "uc=" not in merged
    assert "Catalog" not in merged
