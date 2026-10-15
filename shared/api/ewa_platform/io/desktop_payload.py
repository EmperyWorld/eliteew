# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Serialize desktop intents/observations to wire dicts, optional strict validation (gateway entry).
# Invariants:
# - Output dicts are JSON-serializable; keys align with JSON Schema property names.
# Related:
# - api/ewa_platform/contracts/desktop_intent.py
# - api/ewa_platform/contracts/desktop_observation.py
# - api/ewa_platform/schemas/json/desktop_intent_v1.json
# ---
"""Desktop orchestration wire payloads (v1).

``desktop_intent_to_wire`` maps dataclass intents to the flat ``intent_kind`` shape.
``desktop_observation_to_wire`` maps observation dataclasses to ``observation_kind`` shape.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

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

DesktopIntentWire = dict[str, Any]
DesktopObservationWire = dict[str, Any]


def desktop_intent_to_wire(
    intent: OpenAppIntent | FocusWindowIntent | CloseWindowIntent | PatchShellStateIntent | NavigateDeepLinkIntent,
) -> DesktopIntentWire:
    """Serialize a typed intent to the v1 wire object (``intent_kind`` discriminator)."""

    if isinstance(intent, OpenAppIntent):
        return {
            "intent_kind": DesktopIntentKind.OPEN_APP.value,
            "app_component": intent.app_component,
            "payload": intent.payload,
        }
    if isinstance(intent, FocusWindowIntent):
        return {
            "intent_kind": DesktopIntentKind.FOCUS_WINDOW.value,
            "window_id": intent.window_id,
        }
    if isinstance(intent, CloseWindowIntent):
        return {
            "intent_kind": DesktopIntentKind.CLOSE_WINDOW.value,
            "window_id": intent.window_id,
        }
    if isinstance(intent, PatchShellStateIntent):
        return {
            "intent_kind": DesktopIntentKind.PATCH_SHELL_STATE.value,
            "patch": intent.patch,
        }
    if isinstance(intent, NavigateDeepLinkIntent):
        return {
            "intent_kind": DesktopIntentKind.NAVIGATE_DEEP_LINK.value,
            "deep_link_token": intent.deep_link_token,
            "payload": intent.payload,
        }
    msg = f"unsupported intent type: {type(intent)!r}"
    raise TypeError(msg)


def desktop_observation_to_wire(
    observation: WindowListSnapshot | ActiveAppChanged | IntentExecutionFailed | UserCancelledObservation,
) -> DesktopObservationWire:
    """Serialize a typed observation to the v1 wire object."""

    if isinstance(observation, WindowListSnapshot):
        return {
            "observation_kind": DesktopObservationKind.WINDOW_LIST_SNAPSHOT.value,
            "windows": observation.windows,
        }
    if isinstance(observation, ActiveAppChanged):
        return {
            "observation_kind": DesktopObservationKind.ACTIVE_APP_CHANGED.value,
            "app_component": observation.app_component,
            "window_id": observation.window_id,
        }
    if isinstance(observation, IntentExecutionFailed):
        out: DesktopObservationWire = {
            "observation_kind": DesktopObservationKind.INTENT_EXECUTION_FAILED.value,
            "intent_kind": observation.intent_kind,
            "reason": observation.reason,
        }
        if observation.detail is not None:
            out["detail"] = observation.detail
        return out
    if isinstance(observation, UserCancelledObservation):
        return {
            "observation_kind": DesktopObservationKind.USER_CANCELLED.value,
            "reason": observation.reason,
        }
    msg = f"unsupported observation type: {type(observation)!r}"
    raise TypeError(msg)


def orchestration_stub_payload(*, phase: str, session_id: str) -> dict[str, Any]:
    """Return a minimal JSON object for tests until full session envelope is wired."""

    return {"kind": "orchestration_stub", "phase": phase, "session_id": session_id}


def ensure_desktop_intent_wire_or_raise(intent: Mapping[str, Any]) -> dict[str, Any]:
    """Raise ``ValueError`` when intent does not satisfy minimal v1 wire shape."""

    if not desktop_intent_wire_wellformed(intent):
        msg = "desktop intent wire payload is not well-formed"
        raise ValueError(msg)
    return dict(intent)


def ensure_desktop_observation_wire_or_raise(data: Mapping[str, Any]) -> dict[str, Any]:
    """Raise ``ValueError`` when observation does not satisfy minimal v1 wire shape."""

    if not desktop_observation_wire_wellformed(data):
        msg = "desktop observation wire payload is not well-formed"
        raise ValueError(msg)
    return dict(data)
