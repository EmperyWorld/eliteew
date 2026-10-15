# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Legacy think JSON (action_payload + UPPER decision_type) → discriminated union v1.
# Invariants:
# - Missing/null ``decision_type`` is repaired from payload shape (tool/plan/gate) before hard fail.
# Related:
# - api/ewa_platform/agentic/kernel/think_command_v1.py
# ---

from __future__ import annotations

import contextlib
import logging
from collections.abc import Mapping
from typing import Any, Literal

logger = logging.getLogger(__name__)

StructuredDecisionType = Literal["continue", "intervene", "mutate", "terminate"]

_LEGACY_TO_STRUCTURED: dict[str, StructuredDecisionType] = {
    "CONTINUE_EXECUTION": "continue",
    "CONTINUE": "continue",
    "continue": "continue",
    "REQUEST_HUMAN_INTERVENTION": "intervene",
    "REQUEST_HUM_INTERV": "intervene",
    "REQUEST_HUMAN": "intervene",
    "intervene": "intervene",
    "TERMINATE_SESSION": "terminate",
    "TERMINATE": "terminate",
    "terminate": "terminate",
    "MUTATE_PLAN": "mutate",
    "MUTATE": "mutate",
    "mutate": "mutate",
}


def _infer_decision_from_shape(
    *,
    payload: Mapping[str, Any] | None = None,
    action_payload: Mapping[str, Any] | None = None,
    data: Mapping[str, Any] | None = None,
) -> StructuredDecisionType | None:
    """Best-effort decision_type when LLM omitted/null the field but left executable shape."""

    src = payload if isinstance(payload, Mapping) else {}
    act = action_payload if isinstance(action_payload, Mapping) else {}
    root = data if isinstance(data, Mapping) else {}

    tool_name = str(src.get("tool_name") or act.get("tool_name") or root.get("tool_name") or "").strip()
    # Prefer continue only when a concrete tool is named.
    if tool_name:
        return "continue"

    gate = src.get("gate_json") if "gate_json" in src else act.get("gate_json")
    if isinstance(gate, Mapping) and str(gate.get("prompt") or "").strip():
        return "intervene"

    plan_nodes = src.get("plan_nodes") if "plan_nodes" in src else act.get("plan_nodes")
    if isinstance(plan_nodes, list) and plan_nodes:
        return "mutate"
    if str(src.get("patch_instructions") or act.get("patch_instructions") or "").strip():
        return "mutate"

    return None


def _normalize_decision(
    raw: Any,
    *,
    allow_infer: bool = False,
    payload: Mapping[str, Any] | None = None,
    action_payload: Mapping[str, Any] | None = None,
    data: Mapping[str, Any] | None = None,
) -> StructuredDecisionType:
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        if allow_infer:
            inferred = _infer_decision_from_shape(
                payload=payload,
                action_payload=action_payload,
                data=data,
            )
            if inferred is not None:
                logger.warning(
                    "[STEP] agentic_think_decision_type_repaired raw=%r inferred=%s",
                    raw,
                    inferred,
                )
                return inferred
            # Empty think with no executable shape → terminate (safe loop exit), not hard crash.
            logger.warning(
                "[STEP] agentic_think_decision_type_default_terminate raw=%r",
                raw,
            )
            return "terminate"
        raise ValueError(f"unknown decision_type: {raw!r}")

    key = str(raw).strip()
    upper = key.upper()
    if key in _LEGACY_TO_STRUCTURED:
        return _LEGACY_TO_STRUCTURED[key]
    if upper in _LEGACY_TO_STRUCTURED:
        return _LEGACY_TO_STRUCTURED[upper]

    if allow_infer:
        inferred = _infer_decision_from_shape(
            payload=payload,
            action_payload=action_payload,
            data=data,
        )
        if inferred is not None:
            logger.warning(
                "[STEP] agentic_think_decision_type_repaired raw=%r inferred=%s",
                raw,
                inferred,
            )
            return inferred

    raise ValueError(f"unknown decision_type: {raw!r}")


def adapt_legacy_think_blob(blob: Mapping[str, Any]) -> dict[str, Any]:
    """Convert legacy or partial LLM blobs into discriminated-union shape."""

    data = dict(blob)
    if "payload" in data and isinstance(data["payload"], Mapping):
        payload = dict(data["payload"])
        root_raw = data.get("decision_type")
        payload_raw = payload.get("decision_type")
        # Prefer root; fall back to payload tag. Do not silently overwrite an explicit mismatch —
        # Pydantic root/payload match validator must still reject conflicting tags.
        if root_raw is None or (isinstance(root_raw, str) and not str(root_raw).strip()):
            raw_dt = payload_raw
            repairing_missing = True
        else:
            raw_dt = root_raw
            repairing_missing = False

        dt = _normalize_decision(
            raw_dt,
            allow_infer=True,
            payload=payload,
            data=data,
        )
        data["decision_type"] = dt
        if repairing_missing or payload_raw is None or (isinstance(payload_raw, str) and not str(payload_raw).strip()):
            payload["decision_type"] = dt
            if repairing_missing:
                if dt == "continue":
                    payload.setdefault("tool_name", data.get("tool_name") or "")
                    payload.setdefault("tool_args", {})
                elif dt == "intervene":
                    payload.setdefault("gate_json", {})
                elif dt == "mutate":
                    payload.setdefault("plan_nodes", [])
                else:
                    payload = {"decision_type": "terminate"}
        else:
            # Keep payload tag as-is (normalized only if it is a known alias).
            with contextlib.suppress(ValueError):
                payload["decision_type"] = _normalize_decision(payload_raw, allow_infer=False)
        data["payload"] = payload
        return data

    action_payload_raw = data.pop("action_payload", None)
    action_payload: Mapping[str, Any] = action_payload_raw if isinstance(action_payload_raw, Mapping) else {}
    dt = _normalize_decision(
        data.get("decision_type"),
        allow_infer=True,
        action_payload=action_payload,
        data=data,
    )

    if dt == "continue":
        payload = {
            "decision_type": "continue",
            "tool_name": action_payload.get("tool_name", data.pop("tool_name", "")),
            "tool_args": dict(action_payload.get("tool_args") or data.pop("tool_args", {}) or {}),
        }
        if action_payload.get("node_id") or data.get("node_id"):
            payload["node_id"] = action_payload.get("node_id") or data.get("node_id")
    elif dt == "intervene":
        payload = {
            "decision_type": "intervene",
            "gate_json": dict(action_payload.get("gate_json") or {}),
        }
    elif dt == "mutate":
        payload = {
            "decision_type": "mutate",
            "plan_nodes": list(action_payload.get("plan_nodes") or []),
            "patch_instructions": action_payload.get("patch_instructions"),
        }
    else:
        payload = {"decision_type": "terminate"}

    data["decision_type"] = dt
    data["payload"] = payload
    return data
