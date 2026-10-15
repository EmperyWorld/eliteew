# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for deterministic EWA companion catalogue SearchIntent parsing: content/body scope, UI display query,
# and filters used before LLM/action augmentation.
# Invariants:
# - Pure helper tests; no DB, LLM, or desktop side effects.
# - Query extraction must avoid passing whole user prompts into Content Manager filters.
# Related:
# - api/ewa_platform/companion/sidecar/search_intent.py
# ---
"""Tests: companion structured search intent."""

from __future__ import annotations

from api.ewa_platform.companion.sidecar.search_intent import resolve_companion_search_intent


def test_content_search_intent_extracts_body_query() -> None:
    intent = resolve_companion_search_intent("найди документы где написано амортизация")
    assert intent is not None
    assert intent.browse_all is False
    assert intent.scope == "hybrid"
    assert intent.display_query == "амортизация"
    assert intent.body_query == "амортизация"
    assert intent.filters.content_types == ["document"]


def test_hybrid_search_intent_strips_ui_context() -> None:
    intent = resolve_companion_search_intent("открой поиск в контент менеджере")
    assert intent is None

    intent = resolve_companion_search_intent("найди файлы про договор в контент менеджере")
    assert intent is not None
    assert intent.scope == "hybrid"
    assert intent.display_query == "договор"
    assert intent.body_query == "договор"


def test_browse_intent_keeps_audio_exclusion_filter() -> None:
    intent = resolve_companion_search_intent("посмотри список всех документов без аудио")
    assert intent is not None
    assert intent.browse_all is True
    assert intent.display_query == ""
    assert intent.filters.exclude_audio is True
    assert intent.filters.content_types == ["document"]
