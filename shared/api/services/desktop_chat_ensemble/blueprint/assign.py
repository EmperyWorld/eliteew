# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Assign blueprint steps to roster heroes by slot profiles; scale active steps by roster size (3–6).
# Invariants:
# - Steps with min_roster ≤ ENSEMBLE_MIN_ROSTER_HEROES (3) stay in the core plan; higher min_roster unlocks at 4–6.
# - Outline filtering drops sections whose step_ids are inactive.
# Related:
# - documentation/product/DESKTOP-ENSEMBLE-PLAN-AUTHORING.md
# - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
# ---
"""Assign template steps to roster heroes by slot profiles (exact + L1 fallback)."""

from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass

from api.services.desktop_chat_ensemble.blueprint.catalog import (
    DocumentOutlineSection,
    PlanStep,
)
from api.services.desktop_chat_ensemble.settings import (
    ENSEMBLE_MAX_ROSTER_HEROES,
    ENSEMBLE_MIN_ROSTER_HEROES,
)

logger = logging.getLogger(__name__)


def select_steps_for_roster(
    steps: Sequence[PlanStep],
    roster_len: int,
    *,
    core_roster_cap: int = ENSEMBLE_MIN_ROSTER_HEROES,
) -> list[PlanStep]:
    """Включить шаги по `min_roster`: ядро (≤3) всегда; расширение 4–6 при росте ростера.

    Порядок шаблона сохраняется. Если у шагов нет `min_roster` > 1 — поведение как раньше
    (все шаги активны при любом |ростер| ≥ 1).
    """
    n = max(1, min(int(roster_len), ENSEMBLE_MAX_ROSTER_HEROES))
    core_cap = max(1, min(int(core_roster_cap), ENSEMBLE_MAX_ROSTER_HEROES))
    selected: list[PlanStep] = []
    for step in steps:
        need = int(getattr(step, "min_roster", 1) or 1)
        need = max(1, min(need, ENSEMBLE_MAX_ROSTER_HEROES))
        if need <= core_cap:
            if n >= 1:
                selected.append(step)
            continue
        if need <= n:
            selected.append(step)
    if selected:
        return selected
    return list(steps)


def filter_outline_for_steps(
    outline: Sequence[DocumentOutlineSection],
    step_ids: set[str],
) -> list[DocumentOutlineSection]:
    """Оставить в outline только секции, ссылающиеся на активные step_id."""
    out: list[DocumentOutlineSection] = []
    for sec in outline:
        sids = [sid for sid in sec.step_ids if sid in step_ids]
        subs = [sub for sub in sec.subsections if sub.step_id in step_ids]
        if not sids and not subs:
            continue
        out.append(
            DocumentOutlineSection(
                heading=sec.heading,
                id=sec.id,
                step_ids=sids,
                subsections=subs,
            )
        )
    return out


@dataclass(frozen=True)
class StepAssignment:
    step: PlanStep
    hero_id: str
    fallback: bool
    slot_distance: int


def _hero_profile(
    hero_id: str,
    profiles: dict[str, dict[str, int]],
) -> dict[str, int]:
    return dict(profiles.get(hero_id, {}))


def _is_exact(profile: dict[str, int], req: dict[str, int]) -> bool:
    if not req:
        return True
    return all(profile.get(k) == v for k, v in req.items())


def _l1(profile: dict[str, int], req: dict[str, int]) -> int:
    if not req:
        return 0
    return sum(abs(int(profile.get(k, 0)) - int(v)) for k, v in req.items())


def _violates_streak(hero_id: str, last_hero: str | None, streak: int, max_steps: int) -> bool:
    if last_hero is None:
        return False
    if hero_id != last_hero:
        return False
    return streak >= max_steps


def _sort_key(
    hero_id: str,
    *,
    roster: list[str],
    exact: bool,
    dist: int,
    violates: bool,
) -> tuple[int, int, int, int]:
    ri = roster.index(hero_id) if hero_id in roster else 999
    return (0 if exact else 1, 0 if not violates else 1, dist, ri)


def _match_step_for_hero(
    hero_id: str,
    step: PlanStep,
    profiles: dict[str, dict[str, int]],
) -> tuple[bool, int]:
    prof = _hero_profile(hero_id, profiles)
    exact = _is_exact(prof, step.required_slots)
    dist = _l1(prof, step.required_slots)
    return exact, dist


def assign_steps_to_roster(
    steps: Sequence[PlanStep],
    roster: list[str],
    profiles: dict[str, dict[str, int]],
    *,
    max_steps_per_hero: int = 2,
) -> list[StepAssignment]:
    """Детерминированное назначение: точное совпадение слотов, иначе минимальное L1; учёт streak."""
    if not roster:
        return []

    last_hero: str | None = None
    streak = 0
    out: list[StepAssignment] = []

    for step in steps:
        req = step.required_slots
        candidates: list[tuple[str, bool, int, bool]] = []
        for hid in roster:
            prof = _hero_profile(hid, profiles)
            exact = _is_exact(prof, req)
            dist = _l1(prof, req)
            viol = _violates_streak(hid, last_hero, streak, max_steps_per_hero)
            candidates.append((hid, exact, dist, viol))

        def pick_from(pool: list[tuple[str, bool, int, bool]]) -> tuple[str, bool, int]:
            best = min(
                pool,
                key=lambda t: _sort_key(t[0], roster=roster, exact=t[1], dist=t[2], violates=t[3]),
            )
            hid, exact, dist, _viol = best
            fallback = not exact
            return hid, fallback, dist

        exact_nv = [c for c in candidates if c[1] and not c[3]]
        fallback_nv = [c for c in candidates if not c[1] and not c[3]]
        exact_v = [c for c in candidates if c[1] and c[3]]
        fallback_v = [c for c in candidates if not c[1] and c[3]]

        if exact_nv:
            hero_id, fallback, dist = pick_from(exact_nv)
        elif fallback_nv:
            hero_id, fallback, dist = pick_from(fallback_nv)
        elif exact_v:
            hero_id, fallback, dist = pick_from(exact_v)
        else:
            hero_id, fallback, dist = pick_from(fallback_v or candidates)

        logger.info(
            "[STEP] ensemble_plan_template step_assigned step_id=%s hero_id=%s fallback=%s distance=%s",
            step.step_id,
            hero_id,
            fallback,
            dist,
        )

        if hero_id == last_hero:
            streak += 1
        else:
            last_hero = hero_id
            streak = 1

        out.append(StepAssignment(step=step, hero_id=hero_id, fallback=fallback, slot_distance=dist))

    return out


def rebalance_assignments_for_coverage(
    assignments: Sequence[StepAssignment],
    roster: list[str],
    profiles: dict[str, dict[str, int]],
    *,
    required_heroes: Sequence[str],
    max_distance: int | None = None,
) -> list[StepAssignment]:
    """Подмешать недостающих героев в blueprint, если их явно попросили или подсветили cue-keywords."""
    out = list(assignments)
    if not out or not roster:
        return out

    counts = Counter(a.hero_id for a in out)
    required = [hid for hid in required_heroes if hid in roster]

    for target in required:
        if counts[target] > 0:
            continue

        donor_indices = [i for i, a in enumerate(out) if counts[a.hero_id] > 1]
        if not donor_indices:
            continue

        scored: list[tuple[int, int, int, int, int]] = []
        for i in donor_indices:
            current = out[i]
            exact, dist = _match_step_for_hero(target, current.step, profiles)
            if max_distance is not None and dist > max_distance:
                continue
            scored.append(
                (
                    dist,
                    0 if current.fallback else 1,
                    -counts[current.hero_id],
                    -i,
                    i,
                )
            )

        if not scored:
            continue

        _, _, _, _, picked_idx = min(scored)
        donor = out[picked_idx]
        exact, dist = _match_step_for_hero(target, donor.step, profiles)
        out[picked_idx] = StepAssignment(
            step=donor.step,
            hero_id=target,
            fallback=not exact,
            slot_distance=dist,
        )
        counts[donor.hero_id] -= 1
        counts[target] += 1
        logger.info(
            "[STEP] ensemble_plan_template rebalanced step_id=%s from=%s to=%s distance=%s",
            donor.step.step_id,
            donor.hero_id,
            target,
            dist,
        )

    return out
