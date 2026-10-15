# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure contract tests for compound file chain parsing (no DB / asyncpg).
# Invariants:
# - No HTTP; ``parse_compound_file_chain`` only.
# Related:
# - api/ewa_platform/companion/orchestration/compound_file_chain.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.compound_file_chain import parse_compound_file_chain


def test_parse_compound_discuss_then_open_same_turn() -> None:
    chain = parse_compound_file_chain("прочитай notes.md и открой в редакторе")
    assert chain is not None
    assert chain.kind == "discuss_then_open"
    assert chain.head_line == "прочитай notes.md"
    assert "редактор" in chain.tail_line
    assert chain.defer_tail is False


def test_parse_compound_discuss_defer_tail_with_potom() -> None:
    chain = parse_compound_file_chain("прочитай notes.md, потом открой в редакторе")
    assert chain is not None
    assert chain.kind == "discuss_then_open"
    assert chain.defer_tail is True


def test_parse_compound_list_then_open_en() -> None:
    chain = parse_compound_file_chain("show me the files and open in doc editor")
    assert chain is not None
    assert chain.kind == "list_then_open"
    assert chain.defer_tail is False


def test_parse_compound_rejects_single_intent() -> None:
    assert parse_compound_file_chain("прочитай notes.md") is None
    assert parse_compound_file_chain("открой в редакторе") is None
