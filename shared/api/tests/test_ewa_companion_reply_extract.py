# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Golden tests for **structured JSON-first** companion replies plus legacy tail fallback in
# ``extract_visible_reply_memory_actions``.
# Invariants:
# - Pure helpers — no Postgres / HTTP LLM.
# Related:
# - api/ewa_platform/companion/ux/reply_extract.py
# - api/services/ewa_companion/memory.py
# - api/services/ewa_companion/actions.py
# ---
"""Tests: companion_reply_extract JSON envelope + tails."""

from __future__ import annotations

import json
import sys
import types

sys.modules.setdefault("asyncpg", types.ModuleType("asyncpg"))

from api.ewa_platform.companion.ux.reply_extract import extract_visible_reply_memory_actions


def test_extract_prefers_json_envelope_visible_reply_only() -> None:
    envelope = {"visible_reply": "Hello!", "memory": [], "actions": []}
    vis, mem, acts = extract_visible_reply_memory_actions(json.dumps(envelope))
    assert vis == "Hello!"
    assert mem == []
    assert acts == []


def test_extract_json_envelope_merges_memory_and_actions_from_envelope() -> None:
    envelope = {
        "visible_reply": "Done.",
        "memory": [{"type": "fact", "content": "User likes tea", "importance": 0.9}],
        "actions": [
            {"type": "focus_app", "app_component": "EWDeskApp"},
            {"type": "close_app", "app_component": "MusicPlayer"},
        ],
    }
    text = json.dumps(envelope)
    vis, mem, acts = extract_visible_reply_memory_actions(text)
    assert vis.strip() == "Done."
    assert len(mem) >= 1
    assert mem[0]["content"] == "User likes tea"
    assert len(acts) == 2
    assert acts[0]["type"] == "focus_app"
    assert acts[1]["type"] == "close_app"


def test_extract_visible_text_plus_actions_tail_when_not_single_json_blob() -> None:
    """Whole string is not `{...}` JSON only — envelope path is skipped; tail parser still extracts actions."""

    text = 'Done.\n<<ACTIONS>>[{"type":"close_app","app_component":"MusicPlayer"}]<<END>>'
    vis, mem, acts = extract_visible_reply_memory_actions(text)
    assert vis.strip() == "Done."
    assert acts and acts[0]["type"] == "close_app"
    assert mem == []


def test_extract_loose_json_envelope_with_unescaped_inner_quotes() -> None:
    """Models often emit invalid JSON when Russian prose contains straight double quotes."""

    broken = '{"visible_reply":"Иди, поиграй в "уровень" с кем-нибудь.","memory":[]}'
    vis, mem, acts = extract_visible_reply_memory_actions(broken)
    assert vis == 'Иди, поиграй в "уровень" с кем-нибудь.'
    assert mem == []
    assert acts == []


def test_reply_stream_should_buffer_json_envelope_prefix() -> None:
    from api.ewa_platform.companion.ux.reply_extract import (
        reply_stream_should_buffer_json_envelope,
    )

    assert reply_stream_should_buffer_json_envelope('{"visible_reply":"Hi')
    assert not reply_stream_should_buffer_json_envelope("Привет!")


def test_extract_legacy_tails_only() -> None:
    reply = (
        "Visible\n<<MEMORY>>"
        + json.dumps([{"type": "preference", "content": "dark mode", "importance": 0.4}])
        + "<<END>>\n"
        + '<<ACTIONS>>[{"type":"minimize_app","app_component":"ClipboardManager"}]<<END>>'
    )
    vis, mem, acts = extract_visible_reply_memory_actions(reply)
    assert "Visible" in vis
    assert any(m.get("content") == "dark mode" for m in mem)
    assert acts and acts[0]["type"] == "minimize_app"


def test_extract_malformed_angle_memory_tail_not_visible() -> None:
    """Models sometimes emit ``<>[…]<`` instead of ``<<MEMORY>>[…]<<END>>``."""

    reply = (
        "Ты po&T. Ты мой пользователь в EliteEW. "
        '<>[{"type":"fact","content":"Пользователь подтвердил свое имя po&T.","importance":0.5}]<'
    )
    vis, mem, acts = extract_visible_reply_memory_actions(reply)
    assert vis == "Ты po&T. Ты мой пользователь в EliteEW."
    assert len(mem) == 1
    assert "po&T" in mem[0]["content"]
    assert "<>" not in vis
    assert acts == []
