# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave F6 — factory atoms roundtrip + context pack injection on intention ticks.
# Invariants:
# - Memory stores only; no PG / ewa_atom principal FK.
# Related:
# - api.ewa_platform.factory.atoms
# ---

from __future__ import annotations

from api.ewa_platform.factory.atoms import (
    FactoryAtomKind,
    MemoryFactoryAtomStore,
    record_factory_atom,
)
from api.ewa_platform.factory.context_pack import build_context_pack
from api.ewa_platform.factory.models import FactoryStage
from api.ewa_platform.factory.service import FactoryIntentionService
from api.ewa_platform.factory.store import MemoryIntentionStore


def test_factory_atom_roundtrip() -> None:
    store = MemoryFactoryAtomStore()
    atom = record_factory_atom(
        store,
        kind=FactoryAtomKind.DECISION,
        intention_id="int-1",
        summary="plan packs=['notifications']",
        payload={"pack_stems": ["notifications"]},
        tags=["factory", "plan"],
    )
    assert atom.id
    assert atom.kind == FactoryAtomKind.DECISION
    listed = store.list_for_intention("int-1")
    assert len(listed) == 1
    assert listed[0].summary.startswith("plan packs")


def test_context_pack_prefers_decisions_on_plan() -> None:
    store = MemoryFactoryAtomStore()
    record_factory_atom(
        store,
        kind=FactoryAtomKind.VERIFY,
        intention_id="i",
        summary="old verify",
    )
    record_factory_atom(
        store,
        kind=FactoryAtomKind.DECISION,
        intention_id="i",
        summary="decision A",
    )
    pack = build_context_pack(store, intention_id="i", stage=FactoryStage.PLAN)
    assert "decision A" in pack
    assert "Factory context pack" in pack


def test_service_tick_records_atoms_and_context(monkeypatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_AUTONOMOUS", "0")
    atoms = MemoryFactoryAtomStore()
    svc = FactoryIntentionService(store=MemoryIntentionStore(), atom_store=atoms)
    item = svc.enqueue(title="atom-tick", pack_stems=["notifications"], run_ticks=3)
    assert item["status"] == "completed"
    cp = item.get("checkpoint") or {}
    assert "context_pack" in cp
    assert "Factory context pack" in str(cp["context_pack"])
    assert isinstance(cp.get("atoms"), list)
    assert len(atoms.list_for_intention(item["id"])) >= 1
