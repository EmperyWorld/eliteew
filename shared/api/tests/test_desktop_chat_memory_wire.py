# ---
# EliteEW · Empery World
# https://empery.world
# ---
# Purpose:
# Regression: desktop chat turn memory + chat_history cleanup wiring.
# Related:
# - api/services/desktop_chat/service.py
# - api/routers/desktop_ai_chat.py
# ---

from __future__ import annotations

from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]


def _read(rel: str) -> str:
    return (API_ROOT / rel).read_text(encoding="utf-8")


def test_desktop_service_records_turn_memory() -> None:
    source = _read("services/desktop_chat/service.py")
    assert "record_desktop_chat_turn_memory" in source
    assert '_DESKTOP_CHAT_MEMORY_PROFILE = "desktop_ai_chat"' in source
    assert "search_memory(" in source
    assert "chat_memory_hits" in source
    assert "idempotency_key=" in source
    assert "source_message_id=" in source


def test_ensemble_legacy_stream_records_turn_memory() -> None:
    source = _read("services/desktop_chat_ensemble/archive/legacy_freeform/stream_turn.py")
    assert "record_desktop_chat_turn_memory" in source
    assert "memory_turn_assistant" in source


def test_ensemble_blueprint_stream_records_turn_memory() -> None:
    source = _read("services/desktop_chat_ensemble/blueprint/stream_turn.py")
    assert "record_desktop_chat_turn_memory" in source


def test_desktop_chat_delete_clears_chat_history() -> None:
    source = _read("routers/desktop_ai_chat.py")
    assert source.count("delete_chat_history_for_session") >= 2
