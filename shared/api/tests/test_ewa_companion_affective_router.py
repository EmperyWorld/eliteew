# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioral coverage for **Module C4 — Affective Router** (project «Mela's Ascension»).
# Verifies that heuristic + optional classifier inputs translate into stable ``AffectiveRouting``
# suggestions for downstream chat / anticipation / ambient code paths.
# Invariants:
# - Pure unit tests; no I/O.
# - Router is suggestion-only — tests assert returned shape; they do **not** check any side effects.
# Related:
# - api/ewa_platform/companion/affective/affective_router.py
# ---
"""Behavioral tests for the EWA companion affective router (Module C4)."""

from __future__ import annotations

from api.ewa_platform.companion.affective.affective_router import affective_route


def test_affective_route_warm_text_for_mela_keeps_persona() -> None:
    routing = affective_route(
        user_text="Спасибо, родная. Ты лучшая",
        persona_seed_id="mela",
    )
    assert routing.mood == "warm"
    assert routing.suggested_persona == "mela"
    assert routing.suggested_ambient == "ambient_warm_soft"


def test_affective_route_hostile_text_pushes_arlika_v2() -> None:
    routing = affective_route(
        user_text="ты меня бесишь, прекрати это",
        persona_seed_id="mela",
    )
    assert routing.mood == "tense"
    assert routing.suggested_persona == "arlika_v2"
    assert routing.suggested_ambient == "ambient_cool_low"


def test_affective_route_abuse_at_peak_overrides_to_hostile_arlika() -> None:
    routing = affective_route(
        user_text="ну допустим",
        persona_seed_id="arlika_v2",
        trust_delta=0,
        abuse_at_peak=True,
    )
    assert routing.mood == "tense"
    assert routing.suggested_persona == "arlika"
    assert routing.confidence >= 0.9


def test_affective_route_grief_routes_to_mela() -> None:
    routing = affective_route(
        user_text="я очень устала и грустно",
        persona_seed_id="parent",
    )
    assert routing.mood == "grief"
    assert routing.suggested_persona == "mela"


def test_affective_route_neutral_text_defaults_persona() -> None:
    routing = affective_route(
        user_text="посчитай 2+2",
        persona_seed_id="parent",
    )
    assert routing.mood == "neutral"
    assert routing.suggested_persona == "parent"
    assert routing.suggested_ambient is None


def test_affective_route_trust_delta_boosts_warm_when_text_is_short() -> None:
    routing = affective_route(
        user_text="ага",
        persona_seed_id="mela",
        trust_delta=2,
    )
    assert routing.mood == "warm"
    assert routing.rationale == "trust_delta_warm_boost"
