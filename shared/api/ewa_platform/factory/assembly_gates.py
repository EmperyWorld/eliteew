# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave F7/G3 assembly gates — Gate T ∧ Gate C authoritative; Gate S semantic advisory.
# Invariants:
# - Authoritative machine pass = T ∧ C. Gate S cannot rescue T/C fail.
# - When T∧C PASSED and Gate S FAILED → overall evaluate verdict FAILED (semantic block).
# - No Babel/Nervas required — heuristic Gate S on pack stems + optional intent text.
# Related:
# - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md §8.6 / §8.9
# ---

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from api.services.desktop_app_manifests.pack_golden_law import (
    filter_active_pack_stems,
    is_pack_assembly_active,
    monorepo_root,
)
from api.services.desktop_app_manifests.scaffold_template_freeze import verify_template_freeze

logger = logging.getLogger(__name__)


def apply_authoritative_assembly_verdict(
    *,
    gate_t: str,
    gate_c: str,
    gate_s: str | None = None,
) -> str:
    """Enforce T∧C law; Gate S fail after T∧C pass still yields FAILED (genEW parity)."""

    if gate_t == "FAILED" or gate_c == "FAILED":
        return "FAILED"
    if gate_t == "PASSED" and gate_c == "PASSED" and gate_s == "FAILED":
        return "FAILED"
    if gate_t == "PASSED" and gate_c == "PASSED":
        return "PASSED"
    return "FAILED"


def verify_assembly_gate_s(
    pack_stems: list[str],
    *,
    intent: str = "",
    repo: Path | None = None,
) -> tuple[str, str, dict[str, Any]]:
    """Gate S — semantic pack/intent heuristic (no Nervas / no Blueprint required).

    SKIPPED when no packs to judge. FAILED when packs inactive or intent
    contradicts pack stems. PASSED on structural pack+intent alignment.
    """

    root = repo or monorepo_root()
    stems = [str(s).strip() for s in pack_stems if str(s).strip()]
    if not stems:
        return "SKIPPED", "Gate S: no pack_stems", {"match": None, "source": "heuristic"}

    inactive = [s for s in stems if not is_pack_assembly_active(s, repo=root)]
    active = [s for s in stems if s not in inactive]
    hay = (intent or "").lower()
    score = 0.0
    reasons: list[str] = []

    if inactive:
        reasons.append(f"inactive_packs={inactive}")
        return (
            "FAILED",
            f"Gate S: packs not assembly-active: {inactive}",
            {
                "match": False,
                "reason": "; ".join(reasons),
                "confidence": 0.0,
                "source": "heuristic",
                "active_packs": active,
                "inactive_packs": inactive,
            },
        )

    score += 0.4
    reasons.append(f"all packs assembly-active: {active}")

    if hay:
        stem_hits = sum(1 for s in stems if s.replace("_", " ") in hay or s in hay)
        token_hits = 0
        for s in stems:
            for tok in re.split(r"[_\-\s]+", s):
                if len(tok) >= 3 and tok.lower() in hay:
                    token_hits += 1
        if stem_hits or token_hits:
            score += 0.4
            reasons.append("intent mentions pack tokens")
        else:
            # Intent provided but no pack token overlap → semantic FAIL (cannot rescue T∧C).
            return (
                "FAILED",
                "Gate S: intent/pack semantic mismatch (heuristic)",
                {
                    "match": False,
                    "reason": "intent present but no pack token overlap",
                    "confidence": round(min(1.0, score), 2),
                    "source": "heuristic",
                    "active_packs": active,
                    "inactive_packs": inactive,
                },
            )
    else:
        score += 0.2
        reasons.append("no intent text; pack activity accepted")

    if len(stems) >= 1:
        score += 0.1

    match = score >= 0.5
    status = "PASSED" if match else "FAILED"
    detail = (
        f"Gate S OK (heuristic): {'; '.join(reasons)}"
        if match
        else f"Gate S mismatch (heuristic): {'; '.join(reasons)}"
    )
    return (
        status,
        detail,
        {
            "match": match,
            "reason": "; ".join(reasons),
            "confidence": round(min(1.0, score), 2),
            "source": "heuristic",
            "active_packs": active,
            "inactive_packs": inactive,
        },
    )


def evaluate_assembly_gates(
    pack_stems: list[str] | tuple[str, ...] | None = None,
    *,
    repo: Path | None = None,
    intent: str = "",
) -> dict[str, Any]:
    """Return Gate T∧C∧S evaluate payload.

    ``tc_passed`` is True only when T∧C pass (authoritative machine gates).
    ``passed`` / ``verdict`` apply Gate S semantic block after T∧C (genEW parity).
    """

    root = repo or monorepo_root()
    stems = [str(s).strip() for s in (pack_stems or []) if str(s).strip()]

    gate_t_status, gate_t_detail = verify_template_freeze(root)
    gate_t_ok = gate_t_status == "PASSED"

    inactive: list[str] = []
    active: list[str] = []
    if stems:
        for stem in stems:
            if is_pack_assembly_active(stem, repo=root):
                active.append(stem)
            else:
                inactive.append(stem)
        gate_c_ok = len(inactive) == 0
        gate_c_detail = f"active={active}" if gate_c_ok else f"inactive_packs={inactive} active={active}"
    else:
        gate_c_ok = True
        gate_c_detail = "no_pack_stems"
        active = filter_active_pack_stems([], repo=root)

    gate_c_status = "PASSED" if gate_c_ok else "FAILED"
    gate_s_status, gate_s_detail, gate_s_payload = verify_assembly_gate_s(
        stems,
        intent=intent,
        repo=root,
    )

    tc_passed = gate_t_ok and gate_c_ok
    verdict = apply_authoritative_assembly_verdict(
        gate_t=gate_t_status,
        gate_c=gate_c_status,
        gate_s=gate_s_status,
    )
    passed = verdict == "PASSED"

    logger.info(
        "[STEP] factory_assembly_gates verdict=%s t=%s c=%s s=%s packs=%s",
        verdict,
        gate_t_status,
        gate_c_status,
        gate_s_status,
        stems,
    )
    return {
        "schema_version": 1,
        "verdict": verdict,
        "passed": passed,
        "tc_passed": tc_passed,
        "gate_t": {"status": gate_t_status, "detail": gate_t_detail},
        "gate_c": {
            "status": gate_c_status,
            "detail": gate_c_detail,
            "active_packs": active,
            "inactive_packs": inactive,
        },
        "gate_s": {
            "status": gate_s_status,
            "detail": gate_s_detail,
            "payload": gate_s_payload,
            "advisory": True,
        },
        "pack_stems": stems,
        "intent": intent or None,
        "authoritative": True,
        "law": "verdict=apply(T,C,S); tc_passed=T∧C; S cannot rescue T/C fail",
    }
