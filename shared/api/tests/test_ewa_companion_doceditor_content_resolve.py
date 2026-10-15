# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for **deterministic** DocEditor open augmentation: intent/phrase extraction, catalogue row picking, merging
# allowlisted ``open_app`` payloads.
# Invariants:
# - No Postgres I/O — fake ``query_svc``.
# Related:
# - api/ewa_platform/companion/storage/doceditor_content_resolve.py
# ---
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import pytest

from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    augment_actions_doceditor_via_content_search,
    collect_surface_listing_anchors,
    companion_catalog_search_variants,
    extract_doc_search_phrase,
    merge_doceditor_open_with_unified_id,
    normalize_doc_open_phrase_after_extract,
    parse_surface_listing_line,
    pick_content_row_for_doc_open,
    user_intent_doceditor_open_with_file,
    user_line_may_probe_file_open,
)


@dataclass
class _FakeContent:
    id: UUID
    name: str
    original_filename: str | None = None
    content_type: str = "document"


class _FailsListContent:
    async def list_content(self, **_kw: Any) -> tuple[list[Any], int]:
        raise AssertionError("list_content unexpected when listing embeds uc=")


class _FakeQuery:
    def __init__(self, items: list[_FakeContent]) -> None:
        self._items = items

    async def list_content(self, **_kwargs: Any) -> tuple[list[_FakeContent], int]:
        return list(self._items), len(self._items)


def test_catalog_variants_splits_multiword() -> None:
    v = companion_catalog_search_variants("finance audit support")
    assert v[0] == "finance audit support"
    assert "finance" in v
    assert "audit" in v


def test_pick_multi_token_prefers_hyphenated_match() -> None:
    needle = UUID("aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    hit = _FakeContent(id=needle, name="AI Chat || finance-audit-support_skill_EW.txt")
    miss = _FakeContent(id=UUID(int=77), name="Gardening quarterly.txt")
    picked = pick_content_row_for_doc_open([hit, miss], "finance audit support ew")
    assert picked is not None
    assert picked.id == needle


def test_user_intent_doceditor_positive() -> None:
    assert user_intent_doceditor_open_with_file("Открой отчёт в редакторе документов")
    assert user_intent_doceditor_open_with_file("Please open quarterly report in the document editor")


def test_user_intent_doceditor_negative() -> None:
    assert not user_intent_doceditor_open_with_file("Как дела?")
    assert not user_intent_doceditor_open_with_file("Открой музыкальный плеер")


def test_user_line_may_probe_file_open() -> None:
    assert user_line_may_probe_file_open("открой файл notes.md")
    assert user_line_may_probe_file_open("открой notes.md в редакторе")
    assert not user_line_may_probe_file_open("Как дела?")
    assert not user_line_may_probe_file_open("открой музыкальный плеер")
    assert not user_line_may_probe_file_open("расскажи анекдот")


@pytest.mark.parametrize(
    ("line", "expected"),
    [
        ("Открой «Договор v2» в редакторе документов", "Договор v2"),
        ('Open "Notes Q1" in document editor', "Notes Q1"),
        ("Открой отчёт в редакторе документов", "отчёт"),
        ("Открой plan.docx в DocEditor покажи", "plan.docx"),
    ],
)
def test_extract_doc_search_phrase(line: str, expected: str) -> None:
    got = extract_doc_search_phrase(line)
    assert got == expected


def test_pick_content_exact_name_over_ambiguous_search() -> None:
    needle = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    a = _FakeContent(id=needle, name="Alpha")
    b = _FakeContent(id=UUID(int=2), name="Beta")
    picked = pick_content_row_for_doc_open([a, b], "alpha")
    assert picked is not None
    assert picked.id == needle


def test_augment_actions_inserts_doceditor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_DOC_OPEN_VIA_CONTENT_SEARCH", "1")
    uid = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    fq = _FakeQuery([_FakeContent(id=uid, name="Spec", original_filename="spec.md")])

    async def _run() -> list[dict[str, Any]]:
        return await augment_actions_doceditor_via_content_search(
            "Открой spec.md в редакторе документов",
            [],
            content_catalog_user_id="11111111-1111-1111-1111-111111111111",
            oauth2_sub=None,
            query_svc=fq,
        )

    actions = asyncio.run(_run())
    assert len(actions) == 1
    assert actions[0]["type"] == "open_app"
    assert actions[0]["app_component"] == "DocEditor"
    assert actions[0]["unified_content_id"] == str(uid)


def test_augment_skips_when_unified_already_present(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_DOC_OPEN_VIA_CONTENT_SEARCH", "1")
    fq = _FakeQuery([_FakeContent(id=UUID(int=99), name="X")])
    pre = [{"type": "open_app", "app_component": "DocEditor", "unified_content_id": "prior"}]

    async def _run() -> list[dict[str, Any]]:
        return await augment_actions_doceditor_via_content_search(
            "Открой X в редакторе документов",
            pre,
            content_catalog_user_id="11111111-1111-1111-1111-111111111111",
            oauth2_sub=None,
            query_svc=fq,
        )

    actions = asyncio.run(_run())
    assert actions == pre


def test_normalize_strips_editor_preamble_before_pronoun() -> None:
    raw = extract_doc_search_phrase("открой в редакторе документов его")
    assert normalize_doc_open_phrase_after_extract(raw) == "его"


def test_parse_surface_listing_roundtrip() -> None:
    n, uc = parse_surface_listing_line("- 2 ЦА_JTBD ПРИМЕР .docx [document] uc=aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    assert n == "2 ЦА_JTBD ПРИМЕР .docx"
    assert uc == "aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


def test_collect_surface_listing_prefers_focused_window() -> None:
    shell = {
        "schema_version": 1,
        "active_window_id": "focused",
        "windows": [
            {
                "window_id": "other",
                "app_component": "DesktopFolderWindow",
                "z_index": 100,
                "minimized": False,
                "surface_listing": "- old.txt",
            },
            {
                "window_id": "focused",
                "app_component": "ContentManagerPro",
                "z_index": 1,
                "minimized": False,
                "surface_listing": "- target.docx uc=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            },
        ],
    }
    anchors = collect_surface_listing_anchors(shell)
    assert len(anchors) == 1
    assert anchors[0][0] == "target.docx"


def test_deictic_open_uses_uc_from_shell_without_catalog_query(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_DOC_OPEN_VIA_CONTENT_SEARCH", "1")
    uid = "aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    shell = {
        "schema_version": 1,
        "active_window_id": "w1",
        "windows": [
            {
                "window_id": "w1",
                "app_component": "ContentManagerPro",
                "z_index": 3,
                "minimized": False,
                "surface_listing": f"- 2 ЦА_JTBD ПРИМЕР .docx [document] uc={uid}",
            }
        ],
    }
    svc = _FailsListContent()

    async def _run() -> list[dict[str, Any]]:
        return await augment_actions_doceditor_via_content_search(
            "открой в редакторе документов его",
            [],
            content_catalog_user_id="11111111-1111-1111-1111-111111111111",
            oauth2_sub=None,
            query_svc=svc,
            shell_norm=shell,
        )

    actions = asyncio.run(_run())
    assert actions[0].get("unified_content_id") == uid


def test_merge_upgrades_doceditor_without_id() -> None:
    uid = "cccccccc-cccc-cccc-cccc-cccccccccccc"
    merged = merge_doceditor_open_with_unified_id(
        [{"type": "open_app", "app_component": "DocEditor"}],
        unified_id=uid,
        rationale="ok",
    )
    assert merged[0].get("unified_content_id") == uid
