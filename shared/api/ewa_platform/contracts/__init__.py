# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Re-exports pure contract types for the **platform EWA** (artifacts, orchestration intents/observations).
# Invariants:
# - Types here stay free of asyncio, SQL, and FastAPI dependencies.
# Related:
# - api/ewa_platform/io/envelope.py
# - api/ewa_platform/docs/DESKTOP-ORCHESTRATION.md
# ---
from __future__ import annotations

from api.ewa_platform.contracts.artifacts import ArtifactDescriptor, ArtifactKind
from api.ewa_platform.contracts.capability_catalog import DesktopAppCapability
from api.ewa_platform.contracts.desktop_intent import (
    CloseWindowIntent,
    DesktopIntentKind,
    FocusWindowIntent,
    NavigateDeepLinkIntent,
    OpenAppIntent,
    PatchShellStateIntent,
    desktop_intent_wire_wellformed,
)
from api.ewa_platform.contracts.desktop_observation import (
    ActiveAppChanged,
    DesktopObservationKind,
    IntentExecutionFailed,
    UserCancelledObservation,
    WindowListSnapshot,
    desktop_observation_wire_wellformed,
)
from api.ewa_platform.contracts.errors import AmkaPlatformErrorCode
from api.ewa_platform.contracts.orchestration import (
    OrchestrationPhase,
    OrchestrationSessionBranch,
    OrchestrationSessionRef,
    OrchestrationSessionSnapshotKey,
    UserGoal,
)
from api.ewa_platform.contracts.policy_context import PolicyContext

__all__ = [
    "ActiveAppChanged",
    "AmkaPlatformErrorCode",
    "ArtifactDescriptor",
    "ArtifactKind",
    "CloseWindowIntent",
    "DesktopAppCapability",
    "DesktopIntentKind",
    "DesktopObservationKind",
    "FocusWindowIntent",
    "IntentExecutionFailed",
    "NavigateDeepLinkIntent",
    "OpenAppIntent",
    "OrchestrationPhase",
    "OrchestrationSessionBranch",
    "OrchestrationSessionRef",
    "OrchestrationSessionSnapshotKey",
    "PatchShellStateIntent",
    "PolicyContext",
    "UserCancelledObservation",
    "UserGoal",
    "WindowListSnapshot",
    "desktop_intent_wire_wellformed",
    "desktop_observation_wire_wellformed",
]
