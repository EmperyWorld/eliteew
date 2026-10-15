# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Product assistant SSE stream contract: event types, keep-alive, MusicForge inject link.
# Invariants:
# - Source-level checks avoid FastAPI/DB/manifest import at collection time.
# Related:
# - api/routers/product_desktop_assistant.py
# ---

from __future__ import annotations

import re
from pathlib import Path

_ASSISTANT_ROUTER_PATH = Path(__file__).resolve().parents[1] / "routers" / "product_desktop_assistant.py"


def test_assistant_stream_sse_event_types_are_documented_in_router() -> None:
    text = _ASSISTANT_ROUTER_PATH.read_text(encoding="utf-8")
    stream_idx = text.index("async def assistant_chat_stream")
    stream_block = text[stream_idx : stream_idx + 6000]
    for event_type in ("token", "meta", "error", "done"):
        assert f'"type": "{event_type}"' in stream_block or f"'type': '{event_type}'" in stream_block
    assert 'media_type="text/event-stream"' in stream_block


def test_assistant_stream_emits_keep_alive_comment_on_timeout() -> None:
    text = _ASSISTANT_ROUTER_PATH.read_text(encoding="utf-8")
    assert 'yield ": keep-alive\\n\\n"' in text
    assert "asyncio.wait_for(queue.get(), timeout=2.0)" in text


def test_desktop_link_inject_rules_include_music_forge_app() -> None:
    text = _ASSISTANT_ROUTER_PATH.read_text(encoding="utf-8")
    assert "_DESKTOP_LINK_INJECT_RULES" in text
    assert "MusicForgeApp" in text
    assert any(k in text for k in ("сделать песню", "написать песню", "генератор музыки", "студия песен"))


def test_maybe_inject_desktop_app_link_music_forge_studio() -> None:
    from api.routers import product_desktop_assistant as pda

    user = "Как открыть студию песен и написать песню?"
    reply = "Используйте приложение на рабочем столе."
    out = pda._maybe_inject_desktop_app_markdown_link(user, reply)
    assert "/__eliteew-desktop-open-app__/MusicForgeApp" in out
    assert re.search(r"\[.+?\]\(/__eliteew-desktop-open-app__/MusicForgeApp\)", out)


def test_maybe_inject_skips_when_music_forge_link_already_present() -> None:
    from api.routers import product_desktop_assistant as pda

    user = "Как сделать песню?"
    reply = "Уже есть ссылка [Студия](/__eliteew-desktop-open-app__/MusicForgeApp)."
    out = pda._maybe_inject_desktop_app_markdown_link(user, reply)
    assert out.count("/__eliteew-desktop-open-app__/MusicForgeApp") == 1
