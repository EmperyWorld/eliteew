# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared types for ensemble mid-turn action packs (research / analysis probes).
# Invariants:
# - Action kinds are read-only probes; no write/side-effect tools in Wave 1.
# - ``capabilities_without_empty_chat_rag`` disables chat_rag after zero prefetch hits.
# Related:
# - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
# ---
"""Types for Desktop AI Chat ensemble action execution."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any, Literal
from uuid import UUID

ActionKind = Literal["web", "chat_rag", "project_vault", "kbsew"]
# Wave 2: after_caa2 = after inventory step; after_rp1 kept for research_plan.
ActionMode = Literal["after_rp1", "after_caa2", "pre_step", "skip"]
ActionStatus = Literal["ok", "empty", "error", "skipped"]


@dataclass(frozen=True, slots=True)
class CapabilitySnapshot:
    """What this turn is allowed to probe."""

    web: bool = False
    chat_rag: bool = False
    project_vault: bool = False
    kbsew: bool = False
    kbsew_barrels: tuple[str, ...] = ()
    project_id: UUID | None = None
    chat_id: UUID | None = None

    @property
    def any_enabled(self) -> bool:
        return bool(self.web or self.chat_rag or self.project_vault or self.kbsew)


def capabilities_without_empty_chat_rag(
    capabilities: CapabilitySnapshot,
    *,
    chat_rag_chunks: int | None,
) -> CapabilitySnapshot:
    """Disable chat_rag when turn prefetch already searched and found zero chunks.

    Avoids after_rp1 re-probing the same empty index (false ``ensemble_actions_ungrounded``).
    ``None`` means prefetch did not report a count — leave capability unchanged.
    """
    if chat_rag_chunks is None or chat_rag_chunks > 0 or not capabilities.chat_rag:
        return capabilities
    return replace(capabilities, chat_rag=False)


@dataclass(frozen=True, slots=True)
class PlannedAction:
    """One bounded probe derived from hypotheses / research questions."""

    action_id: str
    kind: ActionKind
    query: str
    rationale: str = ""
    barrel_id: str = ""


@dataclass(slots=True)
class ActionResult:
    action_id: str
    kind: ActionKind
    query: str
    status: ActionStatus
    summary: str = ""
    detail: str = ""
    context_sources: list[dict[str, Any]] = field(default_factory=list)
    error: str = ""


@dataclass(slots=True)
class ActionPackResult:
    ran: bool
    mode: ActionMode
    skipped_reason: str | None = None
    results: list[ActionResult] = field(default_factory=list)
    findings_markdown: str = ""
    context_sources: list[dict[str, Any]] = field(default_factory=list)

    def metadata_payload(self) -> dict[str, Any]:
        citation_ids: list[str] = []
        for src in self.context_sources:
            cid = str(src.get("citation_id") or "").strip()
            if cid and cid not in citation_ids:
                citation_ids.append(cid)
        ok_n = sum(1 for r in self.results if r.status == "ok")
        empty_n = sum(1 for r in self.results if r.status == "empty")
        error_n = sum(1 for r in self.results if r.status == "error")
        ungrounded = bool(self.ran and ok_n == 0 and (empty_n + error_n) > 0)
        return {
            "ran": self.ran,
            "mode": self.mode,
            "skipped_reason": self.skipped_reason,
            "ok_count": ok_n,
            "empty_count": empty_n,
            "error_count": error_n,
            "ungrounded": ungrounded,
            "results_summary": [
                {
                    "action_id": r.action_id,
                    "kind": r.kind,
                    "status": r.status,
                    "query": r.query[:160],
                    "summary": r.summary[:240],
                }
                for r in self.results
            ],
            "citation_ids": citation_ids,
        }
