# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shared JSON shape for AmkaCoreEngine alignment responses reused by marketing and non-marketing drivers.
# Invariants:
# - No domain imports beyond core contracts and projection/trace helpers.
# - Shape must stay compatible with `AmkaCoreAlignmentOut` on HTTP facades.
# Related:
# - shared/api/services/amka_core/marketing_core_bridge.py
# - shared/api/services/amka_core/ugs_amka_bridge.py
# - shared/api/schemas/marketing_cabinet/amka.py
# ---
from __future__ import annotations

from typing import Any

from api.services.amka_core.contracts import AmkaRunResult
from api.services.amka_core.projection import build_amka_core_run_projection
from api.services.amka_core.trace_serialization import serialize_amka_trace_events


def serialize_amka_core_alignment_payload(result: AmkaRunResult) -> dict[str, Any]:
    """JSON-serializable alignment payload for API responses (any driver profile)."""

    pulse = result.pulse
    pulse_out: dict[str, Any] = {}
    if pulse is not None:
        pulse_out = {
            "summary": pulse.summary,
            "changed": list(pulse.changed),
            "preserved": list(pulse.preserved),
            "doubts": list(pulse.doubts),
            "agreements": list(pulse.agreements),
            "no_change_reason": pulse.no_change_reason,
            "next_safe_step": pulse.next_safe_step,
            "recommends_no_change": pulse.recommends_no_change,
        }
    pol = result.policy
    policy_out: dict[str, Any] = {}
    if pol is not None:
        policy_out = {
            "allowed": pol.allowed,
            "mode": pol.mode,
            "reason": pol.reason,
            "denied_operation_keys": list(pol.denied_operation_keys),
        }
    return {
        "status": result.status.value,
        "pulse": pulse_out,
        "policy": policy_out,
        "projection": build_amka_core_run_projection(result),
        "traces": serialize_amka_trace_events(result.traces),
        "observations": dict(result.observations),
        "task_preview": [
            {
                "task_key": t.task_key,
                "title": t.title,
                "risk": t.risk.value,
                "operations_count": len(t.operations),
            }
            for t in result.tasks[:24]
        ],
        "task_count": len(result.tasks),
    }
