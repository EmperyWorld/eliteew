# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioral tests for **catalogue file discuss** intent gating: discuss/summarize must not steal server-first rewrite lines.
# Invariants:
# - Pure unit tests — no DB or HTTP.
# Related:
# - api/ewa_platform/companion/storage/catalog_file_discuss.py
# - api/ewa_platform/companion/server_first/v2.py
# ---
"""Tests: user_intent_catalog_file_discuss vs server-first full-replace."""

from __future__ import annotations

import asyncio

import pytest

from api.ewa_platform.companion.server_first.v2 import (
    companion_user_intent_server_first_v2_full_replace,
)
from api.ewa_platform.companion.storage import catalog_file_discuss
from api.ewa_platform.companion.storage.catalog_file_discuss import user_intent_catalog_file_discuss


@pytest.mark.unit
def test_catalog_discuss_intent_positive_ru() -> None:
    line = "посмотри в файле EWA.md есть информация , прочитай его и обсудим"
    assert user_intent_catalog_file_discuss(line)


@pytest.mark.unit
def test_catalog_discuss_intent_positive_en() -> None:
    assert user_intent_catalog_file_discuss("Please summarize notes.txt for me")


@pytest.mark.unit
def test_catalog_discuss_intent_requires_discuss_verb() -> None:
    assert not user_intent_catalog_file_discuss("EWA.md")


@pytest.mark.unit
def test_catalog_discuss_intent_requires_file_hint() -> None:
    assert not user_intent_catalog_file_discuss("давай обсудим проект без файла")


@pytest.mark.unit
def test_catalog_discuss_yields_to_server_first_full_replace() -> None:
    line = "Полностью перепиши EWA.md в более коротком стиле"
    assert companion_user_intent_server_first_v2_full_replace(line)
    assert not user_intent_catalog_file_discuss(line)


@pytest.mark.unit
def test_build_system_prompt_appends_final_reminder_when_catalog_discuss_block() -> None:
    """When memory override contains the catalogue-discuss marker, shell snapshot is not the last word on visibility."""

    from api.ewa_platform.companion.memory import MEMORY_NS
    from api.ewa_platform.companion.persona.character import CHARACTER_NS
    from api.ewa_platform.companion.turn import chat_turn

    profile = {
        "schema_version": "1",
        "seed_persona_id": "parent",
        "baseline": {},
        "learned_preferences": {
            CHARACTER_NS: {
                "traits": {},
                "values": [],
                "beliefs": [],
                "pride": [],
                "mood": {},
                "bonds_with_user": {},
                "growth_log": [],
            },
            MEMORY_NS: [],
        },
        "style_parameters": {},
        "companion_revision": 1,
    }
    mem = "### Сервер: текст файла из каталога (только чтение, этот ход)\n```\nhello\n```"
    prompt = chat_turn._build_system_prompt(profile, None, memory_section_override=mem)
    assert "FINAL_REMINDER__catalogue_body_in_memory" in prompt
    assert "EwaApp" in prompt


@pytest.mark.unit
def test_catalog_discuss_memory_block_uses_shared_text_normalizer(monkeypatch: pytest.MonkeyPatch) -> None:
    class _FakeStorage:
        async def read_file_bytes_for_owner(self, *_args: object) -> tuple[bytes, dict[str, object]]:
            return (
                b"<h1>Hello</h1><p>First<br>Second</p>",
                {
                    "name": "page.html",
                    "original_filename": "page.html",
                    "mime_type": "text/html",
                },
            )

    monkeypatch.setattr(catalog_file_discuss, "make_content_storage_service", lambda _pool: _FakeStorage())

    async def _run() -> str | None:
        return await catalog_file_discuss._read_catalog_text_block(
            object(),  # type: ignore[arg-type]
            principal_id="p1",
            content_catalog_user_id="11111111-1111-1111-1111-111111111111",
            uc=catalog_file_discuss.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
            file_label="page.html",
            user_line="please summarize page.html",
        )

    block = asyncio.run(_run())

    assert block is not None
    assert "# Hello" in block
    assert "First" in block
    assert "<h1>" not in block
