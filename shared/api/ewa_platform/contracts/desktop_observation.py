# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Events emitted by the desktop client after executing intents or on user/system changes.
# Invariants:
# - Observations are JSON-friendly; large snapshots should use refs in future, not huge blobs.
# Related:
# - api/ewa_platform/schemas/json/desktop_observation_v1.json
# - api/ewa_platform/io/desktop_payload.py
# ---
"""Observation kinds plus dataclass carriers aligned with ``desktop_observation_v1`` JSON Schema."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class DesktopObservationKind(StrEnum):
    """Wire ``observation_kind`` values aligned with ``schemas/desktop_observation_v1.json``."""

    WINDOW_LIST_SNAPSHOT = "window_list_snapshot"
    ACTIVE_APP_CHANGED = "active_app_changed"
    INTENT_EXECUTION_FAILED = "intent_execution_failed"
    USER_CANCELLED = "user_cancelled"


@dataclass(slots=True)
class WindowListSnapshot:
    """Subset of open windows the client chose to report (ids, titles, app_component)."""

    windows: list[dict[str, Any]]


@dataclass(slots=True)
class ActiveAppChanged:
    """Focus moved to another app or window."""

    app_component: str | None
    window_id: str | None


@dataclass(slots=True)
class IntentExecutionFailed:
    """Client could not apply the last intent."""

    intent_kind: str
    reason: str
    detail: dict[str, Any] | None = None


@dataclass(slots=True)
class UserCancelledObservation:
    """User aborted the orchestration flow from UI."""

    reason: str | None = None


def desktop_observation_wire_wellformed(data: Mapping[str, Any]) -> bool:
    """Return True if ``data`` satisfies minimal v1 observation wire shape."""

    kind = data.get("observation_kind")
    if not isinstance(kind, str) or not kind:
        return False
    if kind == DesktopObservationKind.ACTIVE_APP_CHANGED.value:
        ac = data.get("app_component")
        wid = data.get("window_id")
        return isinstance(ac, str) and bool(ac.strip()) and isinstance(wid, str) and bool(wid.strip())
    if kind == DesktopObservationKind.USER_CANCELLED.value:
        r = data.get("reason")
        return isinstance(r, str) and bool(r.strip())
    if kind == DesktopObservationKind.WINDOW_LIST_SNAPSHOT.value:
        w = data.get("windows")
        return isinstance(w, list)
    if kind == DesktopObservationKind.INTENT_EXECUTION_FAILED.value:
        ik = data.get("intent_kind")
        rs = data.get("reason")
        return isinstance(ik, str) and bool(ik.strip()) and isinstance(rs, str) and bool(rs.strip())
    return False
