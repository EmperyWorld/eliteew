#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Structural lock for desktop-ai-chat-004 service atomization.
# Invariants:
# - Facade ≤200 LOC; each service_*.py domain module ≤800 LOC.
# - Public import path api.services.desktop_chat.service re-exports orchestration symbols.
# Related:
# - api.services.desktop_chat.service*; documentation/product/DESKTOP-LLAMA-CHAT.md
# ---
"""Desktop AI Chat service atomization contract."""

from __future__ import annotations

from pathlib import Path

import api.services.desktop_chat.service as facade

PKG = Path(__file__).resolve().parents[1] / "services" / "desktop_chat"


def _loc(name: str) -> int:
    return len((PKG / name).read_text(encoding="utf-8").splitlines())


def test_desktop_chat_service_modules_under_loc_caps() -> None:
    assert _loc("service.py") <= 200
    for name in (
        "service_helpers.py",
        "service_rag.py",
        "service_persist.py",
        "service_tool_loop.py",
        "service_stream.py",
    ):
        assert _loc(name) <= 800, name


def test_facade_reexports_orchestration_symbols() -> None:
    for symbol in (
        "stream_chat_turn",
        "build_rag_prefix",
        "run_tool_loop",
        "messages_for_llama",
        "persist_user_message",
        "persist_assistant_message",
        "persist_user_message_isolated",
        "persist_assistant_message_isolated",
        "apply_ensemble_document_confirm",
        "fetch_config_defaults",
        "load_chat_for_user",
        "load_speaker_context",
        "resolve_desktop_chat_model",
        "verify_project_for_chat",
        "try_recover_tool_calls_from_assistant_text",
        "_assistant_claims_no_web_data",
        "_maybe_temporal_short_circuit_reply",
        "_post_router_tool_followup_nudge",
        "_assistant_metadata_with_prompt_versions",
    ):
        assert hasattr(facade, symbol), symbol
