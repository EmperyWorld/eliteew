# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for Desktop AI Chat offline eval aggregated JSON summary.
# Invariants:
# - Golden fixture documents AI_CHAT_EVAL_JSON_SUMMARY=1 shape.
# Related:
# - api/services/desktop_chat/offline_eval_summary_contract.py
# ---

"""Desktop AI Chat offline eval JSON summary contract tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from api.services.desktop_chat.offline_eval_summary_contract import (
    build_offline_eval_summary,
    validate_offline_eval_summary,
)

_GOLDEN_FIXTURE = Path(__file__).parent / "fixtures" / "desktop_chat_offline_eval_summary_golden.json"


def test_offline_eval_summary_golden_fixture_validates() -> None:
    payload = json.loads(_GOLDEN_FIXTURE.read_text(encoding="utf-8"))
    validate_offline_eval_summary(payload)


def test_build_offline_eval_summary_matches_golden_shape() -> None:
    golden = json.loads(_GOLDEN_FIXTURE.read_text(encoding="utf-8"))
    built = build_offline_eval_summary(
        frontend_status="ok",
        assert_json=golden["assert_cli"],
        ops_manifest_json=golden["ops_manifest"],
        skip_assert_cli=False,
        skip_ops_manifest=False,
    )
    validate_offline_eval_summary(built)
    assert built["product"] == golden["product"]
    assert built["ops_manifest"]["gate_count"] == golden["ops_manifest"]["gate_count"]


def test_offline_eval_summary_rejects_missing_ops_manifest_gate_count() -> None:
    payload = json.loads(_GOLDEN_FIXTURE.read_text(encoding="utf-8"))
    payload["ops_manifest"] = {"ops_manifest": "ok"}
    with pytest.raises(ValueError, match="gate_count"):
        validate_offline_eval_summary(payload)


def test_offline_eval_summary_allows_skipped_sections() -> None:
    summary = build_offline_eval_summary(
        frontend_status="skipped",
        assert_json=None,
        ops_manifest_json=None,
        skip_assert_cli=True,
        skip_ops_manifest=True,
    )
    validate_offline_eval_summary(summary)
    assert summary["assert_cli"] == "skipped"
    assert summary["ops_manifest"] == "skipped"
