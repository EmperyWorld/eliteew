# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Merge canonical ensemble route heuristics with optional admin default extras.
# Invariants:
# - Canonical hints always apply; extras are additive only (no removals via config).
# Related:
# - api/services/desktop_chat_ensemble/route_heuristics_data.py
# - api/services/desktop_chat_ensemble/conversational_route.py
# ---

"""Resolve versioned ensemble routing heuristics from admin defaults."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from api.services.desktop_chat_ensemble.route_heuristics_data import (
    CANONICAL_BLUEPRINT_HINTS,
    CANONICAL_BRIEF_ACKNOWLEDGEMENTS,
    CANONICAL_JOINT_FOLLOWUP_EDIT_NEEDLES,
    CANONICAL_JOINT_FOLLOWUP_TOPIC_NEEDLES,
    CANONICAL_MANIFEST_STYLE_HINTS,
    ENSEMBLE_ROUTE_HEURISTICS_VERSION,
)


def _normalize_hint(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    folded = value.strip().casefold()
    return folded or None


def _merge_hint_tuple(base: tuple[str, ...], extra: object) -> frozenset[str]:
    out: set[str] = set(base)
    if isinstance(extra, list):
        for item in extra:
            norm = _normalize_hint(item)
            if norm:
                out.add(norm)
    return frozenset(out)


@dataclass(frozen=True, slots=True)
class EnsembleRouteHeuristics:
    version: int
    blueprint_hints: frozenset[str]
    manifest_style_hints: frozenset[str]
    brief_acknowledgements: frozenset[str]
    joint_followup_edit_needles: frozenset[str]
    joint_followup_topic_needles: frozenset[str]
    extras_applied: bool

    @property
    def all_blueprint_needles(self) -> frozenset[str]:
        return self.blueprint_hints | self.manifest_style_hints


def resolve_ensemble_route_heuristics(defaults: dict[str, Any] | None) -> EnsembleRouteHeuristics:
    cfg = defaults if isinstance(defaults, dict) else {}
    blueprint = _merge_hint_tuple(
        CANONICAL_BLUEPRINT_HINTS,
        cfg.get("ensemble_route_blueprint_hints_extra"),
    )
    manifest = _merge_hint_tuple(
        CANONICAL_MANIFEST_STYLE_HINTS,
        cfg.get("ensemble_route_manifest_hints_extra"),
    )
    brief_ack = _merge_hint_tuple(
        CANONICAL_BRIEF_ACKNOWLEDGEMENTS,
        cfg.get("ensemble_route_brief_ack_extra"),
    )
    edit_needles = _merge_hint_tuple(
        CANONICAL_JOINT_FOLLOWUP_EDIT_NEEDLES,
        cfg.get("ensemble_route_joint_followup_edit_extra"),
    )
    topic_needles = _merge_hint_tuple(
        CANONICAL_JOINT_FOLLOWUP_TOPIC_NEEDLES,
        cfg.get("ensemble_route_joint_followup_topic_extra"),
    )
    extras_applied = (
        len(blueprint) > len(set(CANONICAL_BLUEPRINT_HINTS))
        or len(manifest) > len(set(CANONICAL_MANIFEST_STYLE_HINTS))
        or len(brief_ack) > len(set(CANONICAL_BRIEF_ACKNOWLEDGEMENTS))
        or len(edit_needles) > len(set(CANONICAL_JOINT_FOLLOWUP_EDIT_NEEDLES))
        or len(topic_needles) > len(set(CANONICAL_JOINT_FOLLOWUP_TOPIC_NEEDLES))
    )
    version_raw = cfg.get("ensemble_route_heuristics_version")
    version = ENSEMBLE_ROUTE_HEURISTICS_VERSION
    if isinstance(version_raw, int):
        version = version_raw
    elif isinstance(version_raw, str) and version_raw.strip().isdigit():
        version = int(version_raw.strip())
    return EnsembleRouteHeuristics(
        version=version,
        blueprint_hints=blueprint,
        manifest_style_hints=manifest,
        brief_acknowledgements=brief_ack,
        joint_followup_edit_needles=edit_needles,
        joint_followup_topic_needles=topic_needles,
        extras_applied=extras_applied,
    )
