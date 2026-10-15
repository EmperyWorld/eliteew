# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# File-focus ring + deictic DocEditor open without shell ``surface_listing``.
# Related:
# - api/ewa_platform/companion/sidecar/file_focus.py
# - api/ewa_platform/companion/storage/doceditor_content_resolve.py
# ---
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import pytest

from api.ewa_platform.companion.sidecar.file_focus import (
    COMPANION_FILE_FOCUS_KEY,
    file_focus_prompt_section,
    file_focus_stack_from_profile,
    focus_entry_from_parts,
)
from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    augment_actions_doceditor_via_content_search,
    user_intent_doceditor_open_with_file,
)


@dataclass
class _FakeContent:
    id: UUID
    name: str


class _FailsListContent:
    async def list_content(self, **_kw: Any) -> tuple[list[Any], int]:
        raise AssertionError("list_content unexpected when file focus has uc")


def test_user_intent_short_editor_phrase_ru() -> None:
    assert user_intent_doceditor_open_with_file("открой его в редакторе")
    assert user_intent_doceditor_open_with_file("open it in the editor")


def test_file_focus_prompt_section_renders_stack() -> None:
    uid = "aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    profile = {
        "learned_preferences": {
            COMPANION_FILE_FOCUS_KEY: {
                "stack": [
                    focus_entry_from_parts(
                        unified_content_id=uid,
                        name="notes.md",
                        source="catalog_discuss",
                    ),
                ],
            },
        },
    }
    section = file_focus_prompt_section(profile)
    assert "File_focus" in section
    assert "notes.md" in section
    assert uid in section
    stack = file_focus_stack_from_profile(profile)
    assert stack == [("notes.md", uid)]


def test_deictic_open_uses_file_focus_without_shell(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_DOC_OPEN_VIA_CONTENT_SEARCH", "1")
    uid = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    profile = {
        "learned_preferences": {
            COMPANION_FILE_FOCUS_KEY: {
                "stack": [
                    focus_entry_from_parts(
                        unified_content_id=uid,
                        name="report.md",
                        source="catalog_preview",
                    ),
                ],
            },
        },
    }
    focus_stack = file_focus_stack_from_profile(profile)
    svc = _FailsListContent()

    async def _run() -> list[dict[str, Any]]:
        return await augment_actions_doceditor_via_content_search(
            "открой его в редакторе",
            [],
            content_catalog_user_id="11111111-1111-1111-1111-111111111111",
            oauth2_sub=None,
            query_svc=svc,
            shell_norm=None,
            file_focus_stack=focus_stack,
        )

    actions = asyncio.run(_run())
    assert actions[0]["app_component"] == "DocEditor"
    assert actions[0]["unified_content_id"] == uid


def test_resolve_file_target_deictic_from_profile() -> None:
    from api.ewa_platform.companion.orchestration.flows.catalog_resolve import resolve_file_target

    uid = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
    profile = {
        "learned_preferences": {
            COMPANION_FILE_FOCUS_KEY: {
                "stack": [
                    focus_entry_from_parts(
                        unified_content_id=uid,
                        name="focus.md",
                        source="catalog_discuss",
                    ),
                ],
            },
        },
    }

    async def _run() -> Any:
        return await resolve_file_target(
            _FailsListContent(),
            content_user_id="11111111-1111-1111-1111-111111111111",
            oauth2_sub=None,
            phrase="его",
            profile=profile,
        )

    match = asyncio.run(_run())
    assert match is not None
    assert match.unified_content_id == uid
    assert match.label == "focus.md"


def test_deictic_open_uses_same_turn_catalog_row(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_DOC_OPEN_VIA_CONTENT_SEARCH", "1")
    uid = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
    row = _FakeContent(id=uid, name="fresh.md")
    svc = _FailsListContent()

    async def _run() -> list[dict[str, Any]]:
        return await augment_actions_doceditor_via_content_search(
            "open it in the editor",
            [],
            content_catalog_user_id="11111111-1111-1111-1111-111111111111",
            oauth2_sub=None,
            query_svc=svc,
            shell_norm=None,
            turn_catalog_rows=[row],
        )

    actions = asyncio.run(_run())
    assert actions[0]["unified_content_id"] == str(uid)
