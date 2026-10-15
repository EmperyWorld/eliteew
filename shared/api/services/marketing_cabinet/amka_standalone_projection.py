# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Projects persisted Marketing Cabinet AMKA runs into the standalone AMKA component shape.
# This gives API, export, and UI a stable view of driver, subject, stages, and trace without changing execution.
# Invariants:
# - Projection is read-only and derived from already persisted run/step rows.
# - Marketing remains the first driver; projection must not pretend to be a universal data model.
# Related:
# - shared/api/services/amka_core/contracts.py
# - documentation/product/amka-seed-album/AMKA-STANDALONE-LAYER-MAP.md
# ---
from __future__ import annotations

from collections import Counter
from typing import Any

_STAGE_KIND_TO_CORE_STAGE = {
    "section_audit": "audit",
    "master_plan": "plan",
    "execute_section": "execute",
    "final_assessment": "final",
}


def _safe_str(raw: Any) -> str:  # noqa: ANN401
    return str(raw or "").strip()


def _short(raw: Any, *, limit: int = 140) -> str:  # noqa: ANN401
    text = _safe_str(raw)
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _event_for_step(step: dict[str, Any]) -> str:
    stage_kind = _safe_str(step.get("stage_kind"))
    status = _safe_str(step.get("status")) or "unknown"
    return f"{stage_kind or 'step'}.{status}"


def _trace_payload_for_step(step: dict[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "step_id": _safe_str(step.get("id")),
        "ordinal": step.get("ordinal"),
        "stage_kind": _safe_str(step.get("stage_kind")),
        "section_key": _safe_str(step.get("section_key")) or None,
        "status": _safe_str(step.get("status")),
    }
    applied_entities = step.get("applied_entities")
    if isinstance(applied_entities, list):
        payload["applied_entities_count"] = len(applied_entities)
    operation_trail = step.get("operation_trail")
    if isinstance(operation_trail, list):
        payload["operation_trail_count"] = len(operation_trail)
    return payload


def build_marketing_amka_standalone_projection(
    run: dict[str, Any],
    steps: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return the current run as a standalone AMKA component projection."""

    status_counts = Counter(_safe_str(step.get("status")) or "unknown" for step in steps)
    stage_counts = Counter(
        _STAGE_KIND_TO_CORE_STAGE.get(_safe_str(step.get("stage_kind")), "unknown") for step in steps
    )
    trace_events: list[dict[str, Any]] = [
        {
            "stage": "snapshot",
            "event": "run.persisted",
            "message": _short(run.get("progress_message")) or "AMKA run persisted.",
            "payload": {
                "run_id": _safe_str(run.get("id")),
                "status": _safe_str(run.get("status")),
                "current_stage": _safe_str(run.get("current_stage")) or None,
                "plan_source": _safe_str(run.get("plan_source")) or None,
            },
        }
    ]
    if run.get("approved_at"):
        trace_events.append(
            {
                "stage": "approval",
                "event": "approval.completed",
                "message": "AMKA plan was approved before execution.",
                "payload": {"approved_at": _safe_str(run.get("approved_at"))},
            }
        )
    elif _safe_str(run.get("status")) == "awaiting_approval":
        trace_events.append(
            {
                "stage": "approval",
                "event": "approval.waiting",
                "message": "AMKA is waiting for operator approval.",
                "payload": {},
            }
        )

    for step in steps:
        stage_kind = _safe_str(step.get("stage_kind"))
        trace_events.append(
            {
                "stage": _STAGE_KIND_TO_CORE_STAGE.get(stage_kind, "unknown"),
                "event": _event_for_step(step),
                "message": _short(step.get("title")) or stage_kind,
                "payload": _trace_payload_for_step(step),
            }
        )

    return {
        "driver_key": "marketing_cabinet",
        "domain_profile": "marketing",
        "subject": {
            "run_id": _safe_str(run.get("id")),
            "project_id": _safe_str(run.get("project_id")),
            "company_id": _safe_str(run.get("company_id")),
            "display_name": "Marketing AMKA run",
        },
        "status": _safe_str(run.get("status")),
        "current_stage": _safe_str(run.get("current_stage")) or None,
        "stage_counts": dict(stage_counts),
        "step_status_counts": dict(status_counts),
        "trace_events": trace_events,
        "contract": {
            "read": True,
            "plan": bool(run.get("master_plan")),
            "act": any(_safe_str(step.get("stage_kind")) == "execute_section" for step in steps),
            "observe": True,
            "policy": True,
            "pulse": True,
        },
    }


def render_marketing_amka_projection_markdown(projection: dict[str, Any]) -> str:
    """Render the standalone projection for operator exports."""

    raw_subject = projection.get("subject")
    subject: dict[str, Any] = raw_subject if isinstance(raw_subject, dict) else {}
    lines = [
        "## Standalone projection",
        "",
        f"- Driver: `{projection.get('driver_key') or '—'}`",
        f"- Domain profile: `{projection.get('domain_profile') or '—'}`",
        f"- Run: `{subject.get('run_id') or '—'}`",
        f"- Status: `{projection.get('status') or '—'}`",
        f"- Current stage: `{projection.get('current_stage') or '—'}`",
        "",
    ]
    stage_counts = projection.get("stage_counts")
    if isinstance(stage_counts, dict) and stage_counts:
        lines.extend(["### Stage counts", ""])
        lines.extend(f"- `{key}`: {value}" for key, value in sorted(stage_counts.items()))
        lines.append("")
    trace_events = projection.get("trace_events")
    if isinstance(trace_events, list) and trace_events:
        lines.extend(["### Trace preview", ""])
        for event in trace_events[:12]:
            if not isinstance(event, dict):
                continue
            lines.append(
                f"- `{event.get('stage') or 'unknown'}` / `{event.get('event') or 'event'}` — {event.get('message') or '—'}"
            )
    return "\n".join(lines).strip()
