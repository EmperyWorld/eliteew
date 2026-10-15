# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   desktop_json_response_format_enabled and reply extract boundaries.
# Related:
#   - api/services/desktop_chat/llm/json_sidecar.py
#   - tests/test_music_llm_json_mode.py (httpx_compat json_object contract)
# ---

from __future__ import annotations

from api.services.desktop_chat.llm.runtime import desktop_json_response_format_enabled
from api.services.desktop_chat.ux.reply_extract import extract_visible_solo_reply


def test_desktop_json_response_format_defaults_on() -> None:
    assert desktop_json_response_format_enabled({}) is True
    assert desktop_json_response_format_enabled({"desktop_json_response_format": False}) is False


def test_extract_visible_solo_reply_envelope() -> None:
    raw = '{"visible_reply":"Привет","tool_hint":null}'
    assert extract_visible_solo_reply(raw) == "Привет"


def test_extract_visible_solo_reply_plain() -> None:
    assert extract_visible_solo_reply("  Просто текст  ") == "Просто текст"
