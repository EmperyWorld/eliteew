# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Attach execution reports, orchestration outcome, and optional proactive suggestion to companion chat final payloads.
# Invariants:
# - Idempotent when protocol flags are OFF; never raises.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/orchestration/execution_ledger.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.ewa_platform.companion.orchestration.execution_ledger import (
    attach_reports_to_response,
    record_fell_through,
)
from api.ewa_platform.companion.proactive.review_engine import (
    PROACTIVE_STATE_KEY,
    build_proactive_suggestion,
    bump_turn_counter,
    load_proactive_state,
    profile_from_learned,
)
from api.ewa_platform.companion.protocol.config import companion_proactive_review_enabled
from api.ewa_platform.schemas.pydantic.companion_execution_report import CompanionExecutionReportV1

logger = logging.getLogger(__name__)


def enrich_turn_protocol_payload(
    payload: dict[str, Any],
    *,
    execution_reports: list[CompanionExecutionReportV1],
    orchestrated: Mapping[str, Any] | None,
    learned_preferences: Mapping[str, Any] | None,
    shell_norm: Mapping[str, Any] | None,
    user_line: str,
) -> dict[str, Any]:
    """Merge protocol fields into an outgoing chat payload."""

    reports = list(execution_reports)
    if orchestrated is None:
        fell = record_fell_through()
        if fell is not None:
            reports.append(fell)
    elif isinstance(orchestrated.get("execution_reports"), list):
        for row in orchestrated["execution_reports"]:
            if isinstance(row, Mapping):
                try:
                    reports.append(CompanionExecutionReportV1.model_validate(dict(row)))
                except Exception as exc:  # noqa: BLE001
                    companion_degrade_debug(
                        logger,
                        "execution_report_row_validate",
                        "skip invalid orchestrated execution report row",
                        exc=exc,
                    )
                    continue

    attach_reports_to_response(payload, reports, orchestrated=orchestrated)

    if companion_proactive_review_enabled():
        state = bump_turn_counter(load_proactive_state(learned_preferences))
        profile = profile_from_learned(learned_preferences)
        if isinstance(learned_preferences, Mapping):
            profile = {"learned_preferences": {**dict(learned_preferences), PROACTIVE_STATE_KEY: state}}
        suggestion = build_proactive_suggestion(
            profile=profile,
            shell_context=shell_norm,
            trigger="turn",
        )
        if suggestion is not None:
            payload["proactive_suggestion"] = suggestion.model_dump(mode="json")

    return payload


__all__ = ("enrich_turn_protocol_payload",)
