# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin **re-export** surface for companion-facing Pydantic/typing contracts that live under ``api/schemas/`` today, so
# orchestration and turn code can depend on ``api.ewa_platform.companion.contracts`` without growing a second definition.
# Invariants:
# - No new types here — only imports from canonical schema modules; keep in sync with ``api/ewa_platform/schemas/pydantic/companion_intent.py``.
# Related:
# - api/ewa_platform/schemas/pydantic/companion_intent.py
# - api/ewa_platform/schemas/pydantic/companion_execution_report.py
# - api/ewa_platform/docs/EWA-COMPANION-PACKAGE-MIGRATION.md
# ---
"""Re-export companion intent planner contracts from ``api/schemas`` (single source of truth)."""

from __future__ import annotations

from api.ewa_platform.schemas.pydantic.companion_execution_report import (
    CompanionExecutionReportV1,
    CompanionOrchestrationOutcome,
    ProactiveSuggestionV1,
)
from api.ewa_platform.schemas.pydantic.companion_intent import (
    CompanionIntentPlan,
    CompanionIntentPlanV1,
    CompanionIntentPlanV2,
    CompanionPlannerIntent,
)
from api.ewa_platform.schemas.pydantic.companion_tool_router import (
    CompanionToolRouterResultV1,
)

__all__ = (
    "CompanionExecutionReportV1",
    "CompanionIntentPlan",
    "CompanionIntentPlanV1",
    "CompanionIntentPlanV2",
    "CompanionOrchestrationOutcome",
    "CompanionPlannerIntent",
    "CompanionToolRouterResultV1",
    "ProactiveSuggestionV1",
)
