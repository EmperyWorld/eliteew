# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for **companion intent planner** JSON parsing (fenced / brace slice) without HTTP or Postgres.
# Invariants:
# - Pure string parsing only; no network.
# Related:
# - api/ewa_platform/companion/sidecar/intent_planner.py
# ---
"""Tests: EWA companion intent planner JSON helpers."""

from __future__ import annotations

from api.ewa_platform.companion.sidecar.intent_planner import parse_llm_json_object


def test_parse_llm_json_object_plain() -> None:
    blob = parse_llm_json_object('{"intent": "chat_only", "confidence": 0.3}')
    assert blob == {"intent": "chat_only", "confidence": 0.3}


def test_parse_llm_json_object_fenced() -> None:
    raw = """```json
{"intent": "recall_memory", "confidence": 0.9}
```"""
    blob = parse_llm_json_object(raw)
    assert blob == {"intent": "recall_memory", "confidence": 0.9}


def test_parse_llm_json_object_brace_slice() -> None:
    raw = 'noise before {"intent":"file_delete","confidence":0.85} trailing'
    blob = parse_llm_json_object(raw)
    assert blob == {"intent": "file_delete", "confidence": 0.85}


def test_parse_llm_json_object_empty() -> None:
    assert parse_llm_json_object("") is None
    assert parse_llm_json_object("   ") is None
