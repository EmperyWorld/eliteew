# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for **EWA Atom v1**: classifier v0 heuristics and pure graph edge generation (no DB).
# Invariants:
# - Tests stay offline (no ``EWA_DATABASE_URL``); no marketing AMKA imports.
# Related:
# - documentation/product/ewa/EWA-ATOM-LAYER.md
# ---
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from api.ewa_platform.atoms.classifier import classify_raw_text_v0
from api.ewa_platform.atoms.graph import build_atom_graph_edges
from api.ewa_platform.contracts.atoms_v1 import (
    CometAtomV1,
    NebulaAtomV1,
    StarAtomV1,
    parse_any_atom_v1,
)


def test_classifier_remember_ru_is_star() -> None:
    atom = classify_raw_text_v0("запомни: я люблю кофе", importance_hint=0.5, valence_episode_0_1=0.5)
    assert isinstance(atom, StarAtomV1)
    assert "кофе" in str(atom.payload)


def test_classifier_default_comet() -> None:
    atom = classify_raw_text_v0("просто короткая реплика", importance_hint=0.4, valence_episode_0_1=0.5)
    assert isinstance(atom, CometAtomV1)


def test_graph_temporal_comet_chain() -> None:
    t0 = datetime(2026, 5, 11, 12, 0, 0, tzinfo=UTC)
    c1 = CometAtomV1(timestamp=t0, payload="first", tags=["t"])
    c2 = CometAtomV1(timestamp=t0 + timedelta(seconds=2), payload="second", tags=["t"])
    edges = build_atom_graph_edges([c2, c1])  # unsorted input
    temporal = [e for e in edges if e["link_kind"] == "temporal"]
    assert len(temporal) == 1
    assert temporal[0]["from_atom_id"] == str(c1.id)
    assert temporal[0]["to_atom_id"] == str(c2.id)


def test_graph_semantic_star_pair() -> None:
    s1 = StarAtomV1(payload="a", tags=["domain:x", "kind:test"], veracity_score=0.5)
    s2 = StarAtomV1(payload="b", tags=["domain:x", "other"], veracity_score=0.5)
    edges = build_atom_graph_edges([s1, s2])
    sem = [e for e in edges if e["link_kind"] == "semantic"]
    assert len(sem) == 1
    ids = {sem[0]["from_atom_id"], sem[0]["to_atom_id"]}
    assert ids == {str(s1.id), str(s2.id)}


def test_graph_affective_nebula_to_star() -> None:
    t0 = datetime(2026, 5, 11, 12, 0, 0, tzinfo=UTC)
    neb = NebulaAtomV1(timestamp=t0, payload="радостно!", tags=[], valence=0.6, arousal=0.8, color_hex="#2ECC71")
    star = StarAtomV1(timestamp=t0 + timedelta(seconds=10), payload="fact", tags=[], veracity_score=0.9)
    edges = build_atom_graph_edges([neb, star], affective_window_seconds=120.0)
    aff = [e for e in edges if e["link_kind"] == "affective"]
    assert len(aff) == 1
    assert aff[0]["from_atom_id"] == str(neb.id)
    assert aff[0]["to_atom_id"] == str(star.id)


def test_parse_roundtrip_dump() -> None:
    raw = {
        "id": str(uuid4()),
        "timestamp": datetime.now(UTC).isoformat(),
        "particle_kind": "comet",
        "importance": 0.7,
        "tags": ["a", "b"],
        "payload": "hello",
        "duration_iso": "PT30S",
        "impact_magnitude": 0.4,
        "trajectory_vector": [0.0, 1.0, 0.0],
    }
    atom = parse_any_atom_v1(raw)
    assert isinstance(atom, CometAtomV1)
    assert atom.trajectory_vector == (0.0, 1.0, 0.0)
