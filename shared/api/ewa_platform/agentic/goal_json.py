# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# goal_json v2 contract — immutable mission anchor persisted at session start.
# Invariants:
# - anchor block is written once at session creation; merge always preserves existing anchor.
# Related:
# - api/ewa_platform/agentic/mission_anchor.py
# - api/ewa_platform/agentic/starter.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.agentic.mission_anchor import MissionAnchor, extract_mission_anchor, strip_intake_goal_text

GOAL_JSON_SCHEMA_VERSION = 2


def build_goal_json_v2(
    user_line: str,
    *,
    source: str = "companion_chat",
) -> dict[str, Any]:
    """Build goal_json v2 with immutable anchor extracted from the intake prompt."""

    goal_text = strip_intake_goal_text(user_line)
    anchor = extract_mission_anchor(user_line)
    return {
        "schema_version": GOAL_JSON_SCHEMA_VERSION,
        "text": goal_text,
        "source": source,
        "anchor": anchor.to_dict(),
    }


def anchor_from_goal_json(goal_json: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(goal_json, Mapping):
        return None
    anchor = goal_json.get("anchor")
    if not isinstance(anchor, Mapping):
        return None
    if not anchor.get("immutable"):
        return None
    return dict(anchor)


def merge_goal_json_preserving_anchor(
    current: Mapping[str, Any] | None,
    incoming: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """Merge goal_json updates without mutating an existing immutable anchor."""

    base = dict(current or {})
    patch = dict(incoming or {})
    preserved = anchor_from_goal_json(base)
    merged = {**base, **patch}
    if preserved is not None:
        merged["anchor"] = preserved
        merged["schema_version"] = max(
            int(base.get("schema_version") or GOAL_JSON_SCHEMA_VERSION),
            GOAL_JSON_SCHEMA_VERSION,
        )
    return merged


def goal_text_from_goal_json(goal_json: Mapping[str, Any] | None) -> str:
    if not isinstance(goal_json, Mapping):
        return ""
    return str(goal_json.get("text") or goal_json.get("user_message") or "").strip()


def mission_anchor_from_goal_json(goal_json: Mapping[str, Any] | None) -> MissionAnchor | None:
    raw = anchor_from_goal_json(goal_json)
    if raw is None:
        return None
    objectives_raw = raw.get("objectives")
    constraints_raw = raw.get("constraints")
    objectives = (
        tuple(str(x).strip() for x in objectives_raw if str(x).strip())
        if isinstance(
            objectives_raw,
            list,
        )
        else ()
    )
    constraints = (
        tuple(str(x).strip() for x in constraints_raw if str(x).strip())
        if isinstance(
            constraints_raw,
            list,
        )
        else ()
    )
    return MissionAnchor(
        display_name=str(raw.get("display_name") or "").strip(),
        objectives=objectives,
        time_box=str(raw.get("time_box") or "").strip() or None,
        constraints=constraints,
    )


__all__ = (
    "GOAL_JSON_SCHEMA_VERSION",
    "anchor_from_goal_json",
    "build_goal_json_v2",
    "goal_text_from_goal_json",
    "merge_goal_json_preserving_anchor",
    "mission_anchor_from_goal_json",
)
