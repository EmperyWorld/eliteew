# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pluggable Discussion preset contract and registry.
# Invariants:
# - Presets are explicit product scenarios; Discussion never auto-picks a preset from stream text.
# - Harassment/personal attacks are excluded regardless of intensity.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
"""Discussion preset base types and registry helpers."""

from __future__ import annotations

from dataclasses import dataclass, field

from api.services.desktop_chat_ensemble.discussion.contracts import (
    DEFAULT_CHECKPOINT_INTERVAL,
    DEFAULT_MAX_CONSECUTIVE_SAME_HERO,
    DEFAULT_MAX_TOTAL_AI_TURNS,
    DiscussionIntensity,
    DiscussionRelation,
)


@dataclass(frozen=True, slots=True)
class DiscussionPreset:
    id: str
    title_ru: str
    title_en: str
    description_ru: str
    description_en: str
    goal_rubric: str
    completion_rubric: str
    role_weights: dict[str, float] = field(default_factory=dict)
    allowed_relations: tuple[DiscussionRelation, ...] = (
        DiscussionRelation.OPENING,
        DiscussionRelation.SUPPORT,
        DiscussionRelation.CHALLENGE,
        DiscussionRelation.REBUTTAL,
        DiscussionRelation.SYNTHESIS,
    )
    default_intensity: DiscussionIntensity = DiscussionIntensity.PROFESSIONAL_CONFRONTATIONAL
    checkpoint_interval: int = DEFAULT_CHECKPOINT_INTERVAL
    max_total_ai_turns: int = DEFAULT_MAX_TOTAL_AI_TURNS
    max_consecutive_same_hero: int = DEFAULT_MAX_CONSECUTIVE_SAME_HERO
    moderator_policy: str = "light"
    min_roster: int = 2
    max_roster: int = 8
    catalog_order: int = 100
    relation_hints: dict[str, str] = field(default_factory=dict)


_REGISTRY: dict[str, DiscussionPreset] = {}


def register_preset(preset: DiscussionPreset) -> DiscussionPreset:
    _REGISTRY[preset.id] = preset
    return preset


def get_preset(preset_id: str) -> DiscussionPreset | None:
    return _REGISTRY.get(str(preset_id or "").strip())


def list_presets() -> list[DiscussionPreset]:
    return sorted(_REGISTRY.values(), key=lambda item: (item.catalog_order, item.id))


def require_preset(preset_id: str) -> DiscussionPreset:
    preset = get_preset(preset_id)
    if preset is None:
        raise KeyError(f"unknown_discussion_preset:{preset_id}")
    return preset
