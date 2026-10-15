# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build a bounded list of PlannedAction from user text + optional rp1 draft body.
# Invariants:
# - Respects capability + budget diversity caps; never invents brand/numeric claims.
# Related:
# - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
# ---
"""Heuristic query planner for ensemble action packs."""

from __future__ import annotations

import re

from api.services.desktop_chat_ensemble.actions.budget import (
    MAX_ACTIONS_PER_PACK,
    MAX_KBSEW_ACTIONS,
    MAX_RAG_ACTIONS,
    MAX_WEB_ACTIONS,
)
from api.services.desktop_chat_ensemble.actions.types import (
    CapabilitySnapshot,
    PlannedAction,
)

_HYP_LINE_RE = re.compile(
    r"^\s*(?:[-*•]|\d+[.)])\s*(.{12,220})$|"
    r"^\s*(?:гипотез[аы]?|hypothesis|research\s+question|вопрос)\s*[:—–-]\s*(.{12,220})$",
    re.IGNORECASE | re.MULTILINE,
)


def _clean_query(raw: str) -> str:
    text = re.sub(r"\s+", " ", (raw or "").strip())
    text = re.sub(r"[`*_#>【】【】]+", "", text)
    return text[:200].strip()


def _extract_seed_queries(user_text: str, draft_body: str) -> list[str]:
    seeds: list[str] = []
    corpus = f"{draft_body or ''}\n{user_text or ''}"
    for match in _HYP_LINE_RE.finditer(corpus):
        chunk = match.group(1) or match.group(2) or ""
        cleaned = _clean_query(chunk)
        if len(cleaned) >= 12:
            seeds.append(cleaned)
    if not seeds:
        # Fallback: first meaningful sentence / clause from user.
        base = _clean_query(user_text)
        if base:
            seeds.append(base[:180])
    # Dedupe preserving order
    out: list[str] = []
    seen: set[str] = set()
    for s in seeds:
        key = s.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
        if len(out) >= MAX_ACTIONS_PER_PACK:
            break
    return out


def plan_actions(
    *,
    user_text: str,
    draft_body: str = "",
    capabilities: CapabilitySnapshot,
) -> list[PlannedAction]:
    """Heuristic planner: map seed queries onto allowed kinds with diversity caps."""
    if not capabilities.any_enabled:
        return []

    seeds = _extract_seed_queries(user_text, draft_body)
    if not seeds:
        return []

    planned: list[PlannedAction] = []
    web_n = rag_n = kb_n = 0
    seq = 0

    def _add(kind: str, query: str, rationale: str, barrel_id: str = "") -> None:
        nonlocal seq, web_n, rag_n, kb_n
        if len(planned) >= MAX_ACTIONS_PER_PACK:
            return
        if kind == "web":
            if not capabilities.web or web_n >= MAX_WEB_ACTIONS:
                return
            web_n += 1
        elif kind in {"chat_rag", "project_vault"}:
            if rag_n >= MAX_RAG_ACTIONS:
                return
            if kind == "chat_rag" and not capabilities.chat_rag:
                return
            if kind == "project_vault" and not capabilities.project_vault:
                return
            rag_n += 1
        elif kind == "kbsew":
            if not capabilities.kbsew or kb_n >= MAX_KBSEW_ACTIONS:
                return
            kb_n += 1
            if not barrel_id and capabilities.kbsew_barrels:
                barrel_id = capabilities.kbsew_barrels[0]
            if not barrel_id:
                return
        else:
            return
        seq += 1
        planned.append(
            PlannedAction(
                action_id=f"a{seq}",
                kind=kind,  # type: ignore[arg-type]
                query=query,
                rationale=rationale,
                barrel_id=barrel_id,
            )
        )

    # Round-robin kinds for diversity across seeds.
    kind_cycle: list[str] = []
    if capabilities.web:
        kind_cycle.append("web")
    if capabilities.project_vault:
        kind_cycle.append("project_vault")
    if capabilities.chat_rag:
        kind_cycle.append("chat_rag")
    if capabilities.kbsew and capabilities.kbsew_barrels:
        kind_cycle.append("kbsew")
    if not kind_cycle:
        return []

    for i, seed in enumerate(seeds):
        kind = kind_cycle[i % len(kind_cycle)]
        _add(kind, seed, rationale="hypothesis_or_question_probe")
        if len(planned) >= MAX_ACTIONS_PER_PACK:
            break

    # If we still have room and web is available, add one market-oriented web probe.
    if capabilities.web and web_n < MAX_WEB_ACTIONS and len(planned) < MAX_ACTIONS_PER_PACK:
        topic = seeds[0]
        _add(
            "web",
            f"{topic} рынок факты 2026",
            rationale="market_fact_probe",
        )

    return planned
