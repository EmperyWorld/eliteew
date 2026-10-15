# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Tests **``_scrub_reply_lines_with_unknown_uc_tokens``** / **``_authoritative_uc_tokens_for_turn``** — companion visible
# replies must not surface LLM-invented ``uc=`` rows unless those ids appear in shell listing, catalog appendix, or user text.
# Invariants:
# - Pure helpers from ``chat_turn``; no HTTP / DB.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""Tests: scrub hallucinated uc= lines from companion chat replies."""

from __future__ import annotations

from api.ewa_platform.companion.turn.chat_turn import (
    _authoritative_uc_tokens_for_turn,
    _coerce_visible_reply_for_turn,
    _scrub_reply_lines_with_unknown_uc_tokens,
)


def _shell_one_uc() -> dict:
    return {
        "windows": [
            {
                "window_id": "w1",
                "z_index": 1,
                "surface_listing": "- Report [document] uc=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\n",
            },
        ],
    }


def test_scrub_drops_lines_with_unknown_uc() -> None:
    auth = _authoritative_uc_tokens_for_turn(None, "", "")
    raw = "Intro line.\n- `uc=7f2a1c9e-8d4b-4f2e-9a1b-0c8d2e3f4a5b` — fake\nOutro."
    out = _scrub_reply_lines_with_unknown_uc_tokens(raw, auth)
    assert "7f2a1c9e" not in out.lower()
    assert "Intro" in out and "Outro" in out


def test_scrub_keeps_uc_from_user_line() -> None:
    uid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    auth = _authoritative_uc_tokens_for_turn(None, "", f"open uc={uid} in editor")
    raw = f"Ok — `{uid}`."
    out = _scrub_reply_lines_with_unknown_uc_tokens(raw, auth)
    assert uid in out


def test_scrub_keeps_uc_from_catalog_appendix() -> None:
    uid = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff"
    apx = f"**Catalog:**\n- x [document] uc={uid}\n"
    auth = _authoritative_uc_tokens_for_turn(None, apx, "")
    out = _scrub_reply_lines_with_unknown_uc_tokens(f"- row uc={uid}", auth)
    assert uid in out


def test_authoritative_includes_shell_listing() -> None:
    uid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    auth = _authoritative_uc_tokens_for_turn(_shell_one_uc(), "", "")
    assert uid.lower() in auth


def test_coerce_applies_scrub_before_truncate() -> None:
    uid_fake = "deadbeef-dead-beef-dead-beefdeadbeef"
    shell = _shell_one_uc()
    reply = _coerce_visible_reply_for_turn(
        f"Я всё открыла.\n- uc={uid_fake}\n",
        user_line="привет",
        actions=None,
        shell_norm=shell,
        catalog_appendix="",
    )
    assert uid_fake not in reply
    assert "Я всё" in reply
