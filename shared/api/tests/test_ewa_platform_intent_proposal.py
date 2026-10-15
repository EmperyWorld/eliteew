# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for EWA orchestration LLM intent JSON parsing helpers.
# Invariants:
# - No network; no ``api.services.amka_core``.
# Related:
# - api/ewa_platform/llm/intent_proposal.py
# ---
from __future__ import annotations

import json

import pytest

from api.ewa_platform.llm.intent_proposal import (
    orchestration_turn_llm_user_content,
    parse_desktop_intent_from_llm_completion,
)


def test_parse_intent_plain_json() -> None:
    blob = {"intent": {"intent_kind": "focus_window", "window_id": "w1"}}
    got = parse_desktop_intent_from_llm_completion(json.dumps(blob))
    assert got == blob["intent"]


def test_parse_intent_fenced_json_block() -> None:
    raw = 'Prefix\n```json\n{"intent": {"intent_kind": "focus_window", "window_id": "wx"}}\n```\n'
    got = parse_desktop_intent_from_llm_completion(raw)
    assert got is not None
    assert got["window_id"] == "wx"


def test_parse_intent_null_means_none() -> None:
    assert parse_desktop_intent_from_llm_completion('{"intent":null}') is None


def test_orchestration_user_payload_has_null_hints_when_absent() -> None:
    raw = orchestration_turn_llm_user_content(
        {"observation_kind": "window_list_snapshot", "windows": []},
        None,
    )
    blob = json.loads(raw)
    assert blob["domain_hints"] is None
    assert blob["heuristic_intent"] is None
    assert blob["companion_wire"] is None


def test_orchestration_user_payload_merges_domain_hints() -> None:
    raw = orchestration_turn_llm_user_content(
        {"observation_kind": "window_list_snapshot"},
        None,
        domain_hints={"documents": {"open_document_count": 0}},
    )
    blob = json.loads(raw)
    assert blob["domain_hints"] == {"documents": {"open_document_count": 0}}


def test_orchestration_user_payload_merges_companion_wire() -> None:
    cw = {"companion_profile_json": "{}"}
    raw = orchestration_turn_llm_user_content(
        {"observation_kind": "window_list_snapshot"},
        None,
        companion_wire=cw,
    )
    blob = json.loads(raw)
    assert blob["companion_wire"] == cw


def test_parse_intent_rejects_malformed_inner() -> None:
    blob = {"intent": {"intent_kind": "focus_window", "window_id": "  "}}
    assert parse_desktop_intent_from_llm_completion(json.dumps(blob)) is None


@pytest.mark.parametrize("bad", ["", "not-json", '{"foo":1}'])
def test_parse_intent_rejects_garbage(bad: str) -> None:
    assert parse_desktop_intent_from_llm_completion(bad) is None
