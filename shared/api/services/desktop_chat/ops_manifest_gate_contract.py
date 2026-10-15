# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Validate Desktop AI Chat ops manifest JSON gate list (count + required IDs).
# Invariants:
# - Single owner for required gate ID sets used by offline eval and operator checks.
# Related:
# - docker/scripts/desktop-ai-chat-ops-manifest-gate-contract.py
# - api/tests/fixtures/desktop_chat_ops_manifest_golden.json
# ---

"""Ops manifest gate contract for Desktop AI Chat operator gates."""

from __future__ import annotations

import os
from typing import Any

BASE_REQUIRED_GATE_IDS = frozenset(
    {
        "desktop-ai-chat-ops-manifest",
        "desktop-ai-chat-routing-smoke",
        "desktop-ai-chat-offline-eval",
        "desktop-ai-chat-offline-eval-json",
        "desktop-ai-chat-assert-done-context",
        "desktop-ai-chat-vault-replay",
        "desktop-ai-chat-routing-smoke-json-check",
        "desktop-ai-chat-ops-manifest-gate-contract",
        "desktop-ai-chat-offline-eval-sh",
        "desktop-ai-chat-routing-smoke-sh",
        "desktop-ai-chat-routing-smoke-json",
    }
)
ROUTING_JSON_SHELL_GATE_ID = "desktop-ai-chat-routing-smoke-json-check-sh"


def skip_routing_json_check_from_env() -> bool:
    return os.environ.get("AI_CHAT_EVAL_SKIP_ROUTING_JSON_CHECK", "") == "1"


def required_gate_ids(*, skip_routing_json_check: bool) -> frozenset[str]:
    required = set(BASE_REQUIRED_GATE_IDS)
    if not skip_routing_json_check:
        required.add(ROUTING_JSON_SHELL_GATE_ID)
    return frozenset(required)


def min_gate_count(*, skip_routing_json_check: bool) -> int:
    return len(required_gate_ids(skip_routing_json_check=skip_routing_json_check))


def manifest_gate_ids(data: dict[str, Any]) -> frozenset[str]:
    gates = data.get("gates")
    if not isinstance(gates, list):
        raise ValueError("ops manifest gates missing or not a list")
    ids = {item.get("id") for item in gates if isinstance(item, dict) and item.get("id")}
    if not ids and gates:
        raise ValueError("ops manifest gate ids missing or invalid")
    return frozenset(str(gate_id) for gate_id in ids if isinstance(gate_id, str))


def validate_manifest_matches_golden(data: dict[str, Any], *, golden_data: dict[str, Any]) -> None:
    live = manifest_gate_ids(data)
    golden = manifest_gate_ids(golden_data)
    if live == golden:
        return
    missing = sorted(golden - live)
    extra = sorted(live - golden)
    raise ValueError(f"ops manifest golden drift missing={missing!r} extra={extra!r}")


def validate_manifest(data: dict[str, Any], *, skip_routing_json_check: bool) -> dict[str, Any]:
    if data.get("status") != "ok":
        raise ValueError(f"ops manifest status={data.get('status')!r}")
    gates = data.get("gates")
    if not isinstance(gates, list):
        raise ValueError("ops manifest gates missing or not a list")

    minimum = min_gate_count(skip_routing_json_check=skip_routing_json_check)
    if len(gates) < minimum:
        raise ValueError(f"ops manifest gate count={len(gates)} expected>={minimum}")

    required = required_gate_ids(skip_routing_json_check=skip_routing_json_check)
    present = manifest_gate_ids(data)
    missing = sorted(required - present)
    if missing:
        raise ValueError(f"ops manifest missing gates={missing!r}")

    token_gates = sorted(
        gate_id
        for item in gates
        if isinstance(item, dict) and item.get("requires_token") is True
        for gate_id in [item.get("id")]
        if isinstance(gate_id, str)
    )
    return {
        "ops_manifest": "ok",
        "gate_count": len(gates),
        "required_gate_count": len(required),
        "token_required_gates": token_gates,
    }
