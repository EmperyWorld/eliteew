# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioral coverage for **HCM Module C1** — persona cognitive style descriptors and how they bias
# episodic memory ranking. Mela's Ascension PR-2.
# Invariants:
# - Pure unit tests; no Postgres / Qdrant / LLM I/O.
# Related:
# - api/ewa_platform/companion/affective/persona_style.py
# - api/ewa_platform/companion/memory/retrieval.py
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""Unit tests: persona cognitive style descriptors + episodic recall bias."""

from __future__ import annotations

from api.ewa_platform.companion.affective.persona_style import (
    PersonaStyle,
    get_persona_style,
    persona_style_prompt_directive,
    rank_episodic_hits,
)
from api.ewa_platform.persistence_vector.companion_qdrant import CompanionEpisodicHit


def _hit(body: str, score: float, *, valence: float, importance: float = 0.5) -> CompanionEpisodicHit:
    return CompanionEpisodicHit(
        episode_id=body[:8],
        body=body,
        kind="turn_user",
        source="chat_turn",
        persona="mela",
        importance=importance,
        valence=valence,
        score=score,
        created_at_iso="2026-05-10T00:00:00+00:00",
        turn_id=None,
    )


def test_get_persona_style_known_seeds_distinct() -> None:
    parent = get_persona_style("parent")
    arlika = get_persona_style("arlika")
    arlika_v2 = get_persona_style("arlika_v2")
    assert parent.seed_id == "parent"
    assert arlika.memory_weight.valence_bias < 0.0, "hostile Arlika prefers negative-valence episodes"
    assert arlika_v2.memory_weight.valence_bias > 0.0, "friendly Arlika v2 prefers warm episodes"
    assert arlika.playfulness > parent.playfulness


def test_get_persona_style_unknown_falls_back_to_parent() -> None:
    style = get_persona_style("ghost_persona_not_in_catalog")
    assert style.seed_id == "parent"


def test_persona_style_prompt_directive_short_and_mentions_seed() -> None:
    style = get_persona_style("kora")
    directive = persona_style_prompt_directive(style)
    assert "kora" in directive
    assert "Persona_decision_style" in directive
    # Single-paragraph contract: no double newlines.
    assert "\n\n" not in directive
    # Cheap budget: keep the directive well below ~280 chars.
    assert len(directive) < 320


def test_rank_episodic_hits_friendly_persona_promotes_warm_episode() -> None:
    warm = _hit("Тёплый эпизод про нашу беседу.", score=0.5, valence=0.92)
    cold = _hit("Эпизод‑слип — пользователь нагрубил.", score=0.55, valence=0.08)
    # Friendly Arlika v2 ⇒ positive valence_bias ⇒ should rank warm above cold despite lower base score.
    style = get_persona_style("arlika_v2")
    ordered = rank_episodic_hits([cold, warm], persona_style=style, top_k=2)
    assert ordered[0].body == warm.body


def test_rank_episodic_hits_hostile_arlika_promotes_slip() -> None:
    warm = _hit("Тёплый эпизод.", score=0.55, valence=0.92)
    slip = _hit("Пользователь раздражённо ругался.", score=0.5, valence=0.08)
    style = get_persona_style("arlika")
    ordered = rank_episodic_hits([warm, slip], persona_style=style, top_k=2)
    assert ordered[0].body == slip.body


def test_rank_episodic_hits_neutral_persona_keeps_score_order() -> None:
    # ``parent`` has valence_bias near 0 ⇒ base score should dominate when valences are close.
    a = _hit("A", score=0.8, valence=0.55, importance=0.5)
    b = _hit("B", score=0.4, valence=0.55, importance=0.5)
    style = get_persona_style("parent")
    ordered = rank_episodic_hits([b, a], persona_style=style, top_k=2)
    assert ordered[0].body == "A"


def test_rank_episodic_hits_top_k_caps_output() -> None:
    hits = [_hit(f"E{i}", score=0.5 + i * 0.01, valence=0.5) for i in range(8)]
    style = get_persona_style("mela")
    ordered = rank_episodic_hits(hits, persona_style=style, top_k=3)
    assert len(ordered) == 3


def test_rank_episodic_hits_empty_input() -> None:
    style = get_persona_style("mela")
    assert rank_episodic_hits([], persona_style=style, top_k=5) == []


def test_persona_style_dataclass_immutable() -> None:
    # ``frozen=True`` means trying to mutate raises. Lock down the invariant.
    style = get_persona_style("mela")
    try:
        style.directness = 0.99  # type: ignore[misc]
    except Exception:
        return
    raise AssertionError("PersonaStyle should be frozen / immutable")


def test_persona_style_has_action_propensity_table() -> None:
    style: PersonaStyle = get_persona_style("mela")
    assert "open_app" in style.action_propensity
    assert "ambient_adjust" in style.action_propensity  # reserved for PR-5
    for value in style.action_propensity.values():
        assert 0.0 <= value <= 1.0
