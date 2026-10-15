# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared helpers to attach proactive-protocol fields to companion chat final payloads (sync + SSE).
# Invariants:
# - Optional fields omitted when empty; respects ``companion_execution_report_enabled()``.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-PROACTIVE-PROTOCOL.md
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.ewa_platform.companion.orchestration.execution_ledger import (
    attach_reports_to_response,
    record_fell_through,
    reports_to_dicts,
)
from api.ewa_platform.companion.protocol.config import companion_execution_report_enabled
from api.ewa_platform.schemas.pydantic.companion_execution_report import (
    CompanionExecutionReportV1,
    ProactiveSuggestionV1,
)

logger = logging.getLogger(__name__)


def extend_deterministic_final_payload(
    out: dict[str, Any],
    response: Mapping[str, Any],
    *,
    companion_revision: int,
) -> dict[str, Any]:
    """Merge orchestrator/deterministic response fields into chat ``final`` payload."""

    base: dict[str, Any] = {
        "reply": str(response.get("reply") or "").strip(),
        "companion_revision": companion_revision,
        "actions": [dict(a) for a in (response.get("actions") or []) if isinstance(a, Mapping)],
        "task_run": response.get("task_run"),
        "desktop_config_patch_applied": False,
        "transformed_this_turn": False,
        "transform_event_kind": None,
    }
    for key in (
        "turn_plan_hint",
        "turn_plan_next_tool",
        "turn_plan_source",
        "output_surface",
        "surface_blocks",
        "deterministic_route",
        "execution_reports",
        "orchestration_outcome",
        "proactive_suggestion",
    ):
        value = response.get(key)
        if value is not None and value != "" and value != []:
            base[key] = value
    base.update({k: v for k, v in out.items() if k not in base})
    return base


def apply_fell_through_reports(
    payload: dict[str, Any],
    *,
    orchestrated: Mapping[str, Any] | None,
) -> dict[str, Any]:
    if orchestrated is not None or not companion_execution_report_enabled():
        if orchestrated is not None and companion_execution_report_enabled():
            reports_raw = payload.get("execution_reports")
            reports: list[CompanionExecutionReportV1] = []
            if isinstance(reports_raw, list):
                for item in reports_raw:
                    if isinstance(item, Mapping):
                        try:
                            reports.append(CompanionExecutionReportV1.model_validate(dict(item)))
                        except Exception as exc:  # noqa: BLE001
                            companion_degrade_debug(
                                logger,
                                "execution_report_row_validate",
                                "skip invalid execution report row in protocol payload",
                                exc=exc,
                            )
                            continue
            return attach_reports_to_response(payload, reports, orchestrated=orchestrated)
        return payload

    fell = record_fell_through()
    reports = [fell] if fell is not None else []
    payload["execution_reports"] = reports_to_dicts(reports)
    payload["orchestration_outcome"] = "fell_through"
    return payload


def attach_proactive_suggestion(
    payload: dict[str, Any],
    suggestion: ProactiveSuggestionV1 | None,
) -> dict[str, Any]:
    if suggestion is None:
        return payload
    payload["proactive_suggestion"] = suggestion.model_dump(mode="json")
    return payload


__all__ = (
    "apply_fell_through_reports",
    "attach_proactive_suggestion",
    "extend_deterministic_final_payload",
)
