# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for orchestration LLM context metrics and env-guarded slimming helpers.
# Invariants:
# - No network; deterministic sizes on UTF-8 JSON.
# Related:
# - api/ewa_platform/llm/context_budget.py
# ---
from __future__ import annotations

import json

from api.ewa_platform.llm.context_budget import (
    apply_env_orchestration_llm_slimming,
    json_utf8_byte_length,
    observation_windows_count_for_log,
    orchestration_variable_component_utf8,
    slim_domain_hints_for_llm,
    slim_observation_for_llm,
)


def test_observation_windows_count_for_log() -> None:
    assert observation_windows_count_for_log(None) is None
    assert observation_windows_count_for_log({"observation_kind": "active_app_changed"}) is None
    assert observation_windows_count_for_log({"observation_kind": "window_list_snapshot", "windows": [1, 2]}) == 2


def test_json_utf8_byte_length_counts_unicode() -> None:
    assert json_utf8_byte_length({"x": "ё"}) > json_utf8_byte_length({"x": "a"})


def test_orchestration_variable_component_utf8_splits_fields() -> None:
    variables = {
        "observation": {"observation_kind": "window_list_snapshot", "windows": []},
        "heuristic_intent": {"intent_kind": "noop"},
        "domain_hints": {"documents": {"open_document_count": 1}},
        "companion_wire": {"companion_profile_json": "{}"},
    }
    sizes = orchestration_variable_component_utf8(variables)
    assert set(sizes.keys()) == {"observation", "heuristic_intent", "domain_hints", "companion_wire"}
    assert all(v >= 0 for v in sizes.values())


def test_slim_observation_truncates_window_tail() -> None:
    wins = [{"id": str(i)} for i in range(10)]
    obs = {"observation_kind": "window_list_snapshot", "windows": wins}
    slim, meta = slim_observation_for_llm(obs, max_windows=3)
    assert meta is not None
    assert meta["windows_dropped"] == 7
    assert len(slim["windows"]) == 3
    assert slim["windows"][0]["id"] == "7"
    assert slim["_ewa_context_slim"]["windows_kept"] == 3


def test_slim_domain_hints_trims_to_budget_without_placeholder() -> None:
    fat = {"k": "x" * 50000}
    assert json_utf8_byte_length(fat) > 2048
    slim, meta = slim_domain_hints_for_llm(fat, max_utf8=2048)
    assert meta is not None
    assert json_utf8_byte_length(slim) <= 2048
    assert meta.get("strategy") == "deep_trim"


def test_slim_domain_hints_placeholder_when_budget_impossibly_small() -> None:
    hints = {str(i): {"blob": "z" * 800} for i in range(40)}
    slim, meta = slim_domain_hints_for_llm(hints, max_utf8=180)
    assert meta is not None
    assert slim.get("_ewa_domain_hints_oversized") is True
    assert json_utf8_byte_length(slim) <= 180


def test_apply_env_orchestration_llm_slimming_respects_domain_budget(monkeypatch) -> None:
    monkeypatch.setenv("EWA_ORCH_LLM_SLIM_DOMAIN_HINTS_UTF8", "500")
    monkeypatch.delenv("EWA_ORCH_LLM_SLIM_OBSERVATION_WINDOWS", raising=False)
    variables = {"domain_hints": {"blob": "z" * 4000}}
    meta = apply_env_orchestration_llm_slimming(variables)
    assert meta.get("slimmed") is True
    assert json_utf8_byte_length(variables["domain_hints"]) <= 520


def test_apply_env_orchestration_llm_slimming_windows(monkeypatch) -> None:
    monkeypatch.setenv("EWA_ORCH_LLM_SLIM_OBSERVATION_WINDOWS", "2")
    monkeypatch.delenv("EWA_ORCH_LLM_SLIM_DOMAIN_HINTS_UTF8", raising=False)
    variables = {
        "observation": {"observation_kind": "window_list_snapshot", "windows": [{"i": n} for n in range(5)]},
    }
    meta = apply_env_orchestration_llm_slimming(variables)
    assert meta.get("slimmed") is True
    assert len(variables["observation"]["windows"]) == 2


def test_slim_domain_hints_deep_trim_reduces_nested_strings() -> None:
    hints = {"ugs": {"routes": [{"name": "n", "payload": "p" * 2500}]}}
    slim, meta = slim_domain_hints_for_llm(hints, max_utf8=1200)
    assert meta is not None
    assert meta.get("strategy") == "deep_trim"
    assert json_utf8_byte_length(slim) <= 1220
    loaded = json.loads(json.dumps(slim))
    assert "ugs" in loaded
