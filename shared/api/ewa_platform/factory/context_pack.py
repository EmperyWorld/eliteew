# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stage-aware context pack from factory atoms for plan/verify (Wave F6 · F lite).
# Invariants:
# - Read-only over atom store; never invents product trees.
# Related:
# - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md §8.5
# ---

from __future__ import annotations

from api.ewa_platform.factory.atoms import FactoryAtom, FactoryAtomKind, FactoryAtomStore
from api.ewa_platform.factory.models import FactoryStage


def build_context_pack(
    store: FactoryAtomStore,
    *,
    intention_id: str,
    stage: FactoryStage | str,
    max_atoms: int = 12,
    max_chars: int = 4000,
) -> str:
    """Return a compact text pack of recent atoms for the current factory stage."""

    stage_s = str(stage)
    atoms = store.list_for_intention(intention_id)
    # Prefer decisions for plan; verifies for verify/fix; all for implement/done.
    if stage_s in {FactoryStage.PLAN.value, FactoryStage.QUEUED.value}:
        preferred = [a for a in atoms if a.kind == FactoryAtomKind.DECISION]
    elif stage_s in {FactoryStage.VERIFY.value, FactoryStage.FIX.value}:
        preferred = [a for a in atoms if a.kind in {FactoryAtomKind.VERIFY, FactoryAtomKind.DECISION}]
    else:
        preferred = list(atoms)
    if not preferred:
        preferred = list(atoms)
    # Newest last in store order — take last N
    selected = preferred[-max_atoms:]
    lines = [
        f"# Factory context pack (stage={stage_s} intention={intention_id})",
        "",
    ]
    for atom in selected:
        lines.append(f"- [{atom.kind}] {atom.summary}")
        if atom.payload:
            # Keep payload compact
            keys = sorted(atom.payload.keys())[:6]
            bits = ", ".join(f"{k}={atom.payload.get(k)!r}" for k in keys)
            if bits:
                lines.append(f"  payload: {bits[:240]}")
    text = "\n".join(lines)
    return text[:max_chars]


def summarize_atoms_for_checkpoint(atoms: list[FactoryAtom]) -> list[dict[str, str]]:
    return [
        {
            "id": a.id,
            "kind": str(a.kind),
            "summary": a.summary[:200],
        }
        for a in atoms[-8:]
    ]
