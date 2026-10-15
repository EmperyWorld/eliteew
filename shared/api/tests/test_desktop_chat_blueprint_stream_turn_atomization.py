#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Structural lock for desktop-ai-chat-012 blueprint stream_turn atomization (Wave 4).
# Invariants:
# - Facade re-exports stream_blueprint_turn + helpers used by tests.
# - Child stream_*.py modules exist and stay under soft LOC caps.
# Related:
# - api.services.desktop_chat_ensemble.blueprint.stream_turn
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---
"""Blueprint stream_turn atomization contract."""

from __future__ import annotations

from pathlib import Path

import api.services.desktop_chat_ensemble.blueprint.stream_turn as facade

PKG = Path(__file__).resolve().parents[1] / "services" / "desktop_chat_ensemble" / "blueprint"

_CHILD_MODULES = (
    "council.py",
    "stream_metadata.py",
    "stream_planning.py",
    "stream_step_loop.py",
    "stream_finalize.py",
)


def _loc(name: str) -> int:
    return len((PKG / name).read_text(encoding="utf-8").splitlines())


def test_blueprint_stream_turn_children_exist() -> None:
    for name in _CHILD_MODULES:
        assert (PKG / name).is_file(), name
    assert (PKG / "stream_turn.py").is_file()


def test_blueprint_stream_modules_under_loc_caps() -> None:
    assert _loc("stream_turn.py") <= 200
    for name in _CHILD_MODULES:
        assert _loc(name) <= 800, name


def test_facade_reexports_stream_blueprint_turn_and_helpers() -> None:
    assert callable(facade.stream_blueprint_turn)
    for symbol in (
        "_step_max_tokens",
        "_blueprint_quality_status",
        "_outline_metadata",
        "_steps_preview_metadata",
        "_plan_sse_payload",
    ):
        assert hasattr(facade, symbol), symbol
