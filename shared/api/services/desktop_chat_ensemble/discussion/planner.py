# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Next-actor planner for Discussion (dynamic order, rebuttal, monopolization cap).
# Invariants:
# - Recommended hero must be on the roster; otherwise fall back to least-recent speaker.
# - Same hero cannot exceed preset.max_consecutive_same_hero without forced rotation.
# - After a user turn, interview-like presets (no rebuttal) ask a follow-up instead of debating.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
"""Discussion next-actor selection."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from api.services.desktop_chat_ensemble.discussion.contracts import DiscussionRelation
from api.services.desktop_chat_ensemble.discussion.presets.base import DiscussionPreset
from api.services.desktop_chat_ensemble.heroes import HERO_SLOT_PROFILE, hero_ids_cued_by_text


@dataclass(frozen=True, slots=True)
class TurnPlan:
    hero_id: str
    relation: DiscussionRelation
    reply_to_ordinal: int | None = None
    rationale: str = ""


def _normalize_roster(roster: list[Any]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in roster or []:
        hero = str(raw or "").strip()
        if not hero or hero in seen:
            continue
        seen.add(hero)
        out.append(hero)
    return out


def _hero_axis_score(hero_id: str, weights: dict[str, float]) -> float:
    profile = HERO_SLOT_PROFILE.get(hero_id) or {}
    score = 0.0
    for axis, weight in weights.items():
        try:
            score += float(profile.get(axis, 0) or 0) * float(weight)
        except TypeError, ValueError:
            continue
    return score


def _consecutive_tail(hero_ids: list[str]) -> int:
    if not hero_ids:
        return 0
    last = hero_ids[-1]
    count = 0
    for hero in reversed(hero_ids):
        if hero != last:
            break
        count += 1
    return count


def _pick_relation(
    *,
    preset: DiscussionPreset,
    ai_turn_index: int,
    last_relation: DiscussionRelation | None,
    user_just_spoke: bool,
) -> DiscussionRelation:
    allowed = list(preset.allowed_relations) or [DiscussionRelation.OPENING]
    if ai_turn_index <= 0:
        return DiscussionRelation.OPENING if DiscussionRelation.OPENING in allowed else allowed[0]
    if user_just_spoke:
        if DiscussionRelation.REBUTTAL in allowed:
            return DiscussionRelation.REBUTTAL
        if DiscussionRelation.CHALLENGE in allowed:
            return DiscussionRelation.CHALLENGE
        if DiscussionRelation.OPENING in allowed:
            return DiscussionRelation.OPENING
    if last_relation == DiscussionRelation.CHALLENGE and DiscussionRelation.REBUTTAL in allowed:
        return DiscussionRelation.REBUTTAL
    if ai_turn_index % 3 == 2 and DiscussionRelation.CHALLENGE in allowed:
        return DiscussionRelation.CHALLENGE
    if ai_turn_index % 4 == 3 and DiscussionRelation.SYNTHESIS in allowed:
        return DiscussionRelation.SYNTHESIS
    if DiscussionRelation.SUPPORT in allowed:
        return DiscussionRelation.SUPPORT
    return allowed[0]


def plan_next_ai_turn(
    *,
    preset: DiscussionPreset,
    roster: list[Any],
    prior_ai_hero_ids: list[str],
    topic: str,
    goal: str,
    last_user_text: str | None,
    last_relation: DiscussionRelation | None = None,
    recommended_hero_id: str | None = None,
) -> TurnPlan | None:
    """Choose next AI speaker and interaction relation."""
    heroes = _normalize_roster(roster)
    if not heroes:
        return None

    ai_turn_index = len(prior_ai_hero_ids)
    user_just_spoke = bool(str(last_user_text or "").strip())
    relation = _pick_relation(
        preset=preset,
        ai_turn_index=ai_turn_index,
        last_relation=last_relation,
        user_just_spoke=user_just_spoke,
    )

    cue_pool = " ".join(filter(None, [topic, goal, last_user_text or ""]))
    cued = hero_ids_cued_by_text(cue_pool, heroes)

    candidates = list(heroes)
    consecutive = _consecutive_tail(prior_ai_hero_ids)
    last_hero = prior_ai_hero_ids[-1] if prior_ai_hero_ids else None
    if last_hero and consecutive >= max(1, int(preset.max_consecutive_same_hero)):
        candidates = [h for h in candidates if h != last_hero] or candidates

    preferred = str(recommended_hero_id or "").strip()
    if preferred and preferred in candidates:
        chosen = preferred
        rationale = "model_or_client_recommend"
    elif cued:
        chosen = next((h for h in cued if h in candidates), candidates[0])
        rationale = "topic_cue"
    else:
        spoken_counts = {h: 0 for h in candidates}
        for h in prior_ai_hero_ids:
            if h in spoken_counts:
                spoken_counts[h] += 1
        ranked = sorted(
            candidates,
            key=lambda h: (
                spoken_counts.get(h, 0),
                -_hero_axis_score(h, preset.role_weights),
                heroes.index(h),
            ),
        )
        chosen = ranked[0]
        rationale = "least_recent_weighted"

    reply_to: int | None = None
    if relation in {DiscussionRelation.REBUTTAL, DiscussionRelation.CHALLENGE} and prior_ai_hero_ids:
        reply_to = len(prior_ai_hero_ids)  # 1-based ordinal of previous AI turn approx; engine maps

    return TurnPlan(
        hero_id=chosen,
        relation=relation,
        reply_to_ordinal=reply_to,
        rationale=rationale,
    )
