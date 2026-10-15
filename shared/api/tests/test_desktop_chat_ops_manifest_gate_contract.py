# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for Desktop AI Chat ops manifest gate contract validation.
# Invariants:
# - Golden fixture must stay aligned with ops_manifest_gate_contract owner.
# Related:
# - api/services/desktop_chat/ops_manifest_gate_contract.py
# - api/tests/fixtures/desktop_chat_ops_manifest_golden.json
# ---

"""Desktop AI Chat ops manifest gate contract tests."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

import pytest

from api.services.desktop_chat.ops_manifest_gate_contract import (
    manifest_gate_ids,
    required_gate_ids,
    validate_manifest,
    validate_manifest_matches_golden,
)

_GOLDEN_FIXTURE = Path(__file__).parent / "fixtures" / "desktop_chat_ops_manifest_golden.json"


def test_golden_fixture_gate_ids_match_contract_owner() -> None:
    payload = json.loads(_GOLDEN_FIXTURE.read_text(encoding="utf-8"))
    assert manifest_gate_ids(payload) == required_gate_ids(skip_routing_json_check=False)


def test_validate_manifest_matches_golden_rejects_extra_gate() -> None:
    payload = json.loads(_GOLDEN_FIXTURE.read_text(encoding="utf-8"))
    payload["gates"] = [
        *payload["gates"],
        {
            "id": "desktop-ai-chat-extra-gate",
            "script": "extra.sh",
            "requires_token": False,
            "dry_run_status": "ok",
        },
    ]
    with pytest.raises(ValueError, match="golden drift"):
        validate_manifest_matches_golden(payload, golden_data=json.loads(_GOLDEN_FIXTURE.read_text(encoding="utf-8")))


def test_gate_contract_accepts_twelve_gate_golden_fixture() -> None:
    payload = json.loads(_GOLDEN_FIXTURE.read_text(encoding="utf-8"))
    summary = validate_manifest(payload, skip_routing_json_check=False)
    assert summary["ops_manifest"] == "ok"
    assert summary["gate_count"] == 12
    assert summary["required_gate_count"] == 12


def test_gate_contract_rejects_missing_ops_manifest_dewa_gate() -> None:
    payload = json.loads(_GOLDEN_FIXTURE.read_text(encoding="utf-8"))
    payload["gates"] = [
        {**item, "id": "desktop-ai-chat-ops-manifest-stale"} if item["id"] == "desktop-ai-chat-ops-manifest" else item
        for item in payload["gates"]
    ]
    with pytest.raises(ValueError, match="desktop-ai-chat-ops-manifest"):
        validate_manifest(payload, skip_routing_json_check=False)


def test_gate_contract_rejects_missing_offline_eval_json_dewa_gate() -> None:
    payload = json.loads(_GOLDEN_FIXTURE.read_text(encoding="utf-8"))
    payload["gates"] = [
        {**item, "id": "desktop-ai-chat-offline-eval-json-stale"}
        if item["id"] == "desktop-ai-chat-offline-eval-json"
        else item
        for item in payload["gates"]
    ]
    with pytest.raises(ValueError, match="desktop-ai-chat-offline-eval-json"):
        validate_manifest(payload, skip_routing_json_check=False)


def test_gate_contract_rejects_missing_gate_contract_dewa_gate() -> None:
    payload = json.loads(_GOLDEN_FIXTURE.read_text(encoding="utf-8"))
    payload["gates"] = [
        {**item, "id": "desktop-ai-chat-ops-manifest-gate-contract-stale"}
        if item["id"] == "desktop-ai-chat-ops-manifest-gate-contract"
        else item
        for item in payload["gates"]
    ]
    with pytest.raises(ValueError, match="desktop-ai-chat-ops-manifest-gate-contract"):
        validate_manifest(payload, skip_routing_json_check=False)


def test_gate_contract_skip_routing_json_check_allows_eleven_gates() -> None:
    payload = deepcopy(json.loads(_GOLDEN_FIXTURE.read_text(encoding="utf-8")))
    payload["gates"] = [
        item for item in payload["gates"] if item["id"] != "desktop-ai-chat-routing-smoke-json-check-sh"
    ]
    summary = validate_manifest(payload, skip_routing_json_check=True)
    assert summary["gate_count"] == 11
    assert summary["required_gate_count"] == 11
