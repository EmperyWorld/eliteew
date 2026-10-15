# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Typed read-only snapshots and risk tiers for EWA domain drivers before any mutating actions are exposed.
# Invariants:
# - Snapshot helpers return JSON-safe mappings aligned with ``domain_hints_v1``.
# - Only ``READ_ONLY`` is wired by default; mutating tiers require an ADR and policy implementation.
# Related:
# - api/ewa_platform/drivers/documents_workspace.py
# - api/ewa_platform/drivers/content_manager.py
# - api/ewa_platform/docs/DRIVERS-ROADMAP.md
# ---
"""Domain driver snapshot contracts for EWA orchestration."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class DomainActionRiskTier(StrEnum):
    """Coarse risk tiers used before domain drivers get mutating actions."""

    READ_ONLY = "read_only"
    LOW_RISK_MUTATION = "low_risk_mutation"
    HIGH_RISK_MUTATION = "high_risk_mutation"


@dataclass(frozen=True, slots=True)
class DocumentWorkspaceItemV1:
    """One document/editor item visible to the EWA documents driver."""

    doc_id: str | None = None
    window_id: str | None = None
    title: str | None = None
    app_component: str | None = None

    def to_hint_item(self) -> dict[str, Any]:
        """Return a compact JSON-safe hint item, omitting empty fields."""

        out: dict[str, Any] = {}
        for key, value in (
            ("doc_id", self.doc_id),
            ("window_id", self.window_id),
            ("title", self.title),
            ("app_component", self.app_component),
        ):
            if isinstance(value, str) and value.strip():
                out[key] = value.strip()
        return out


@dataclass(frozen=True, slots=True)
class DocumentsWorkspaceSnapshotV1:
    """Read-only snapshot for the documents workspace domain."""

    items: Sequence[DocumentWorkspaceItemV1] = field(default_factory=tuple)
    source: str = "snapshot"

    def to_hint_wire(self) -> dict[str, Any]:
        """Convert snapshot to ``documents`` domain hint wire."""

        hint_items = [item.to_hint_item() for item in self.items]
        return {
            "open_document_count": len(hint_items),
            "items": hint_items,
            "source": self.source.strip() or "snapshot",
        }


@dataclass(frozen=True, slots=True)
class ContentManagerRootsSnapshotV1:
    """Read-only snapshot for content-manager roots visible to EWA."""

    roots: Sequence[str] = field(default_factory=tuple)
    source: str = "snapshot"

    def to_hint_wire(self) -> dict[str, Any]:
        """Convert snapshot to ``content`` domain hint wire."""

        roots = [root.strip() for root in self.roots if isinstance(root, str) and root.strip()]
        return {"roots": roots, "source": self.source.strip() or "snapshot"}


def domain_action_risk_tier_allows_read_only(risk_tier: str | DomainActionRiskTier) -> bool:
    """Return True only for the currently wired EWA domain-driver action tier."""

    return str(risk_tier) == DomainActionRiskTier.READ_ONLY.value


def mapping_to_document_workspace_item(raw: Mapping[str, Any]) -> DocumentWorkspaceItemV1:
    """Normalize a loose mapping to ``DocumentWorkspaceItemV1`` for adapters/fakes."""

    return DocumentWorkspaceItemV1(
        doc_id=raw.get("doc_id") if isinstance(raw.get("doc_id"), str) else None,
        window_id=raw.get("window_id") if isinstance(raw.get("window_id"), str) else None,
        title=raw.get("title") if isinstance(raw.get("title"), str) else None,
        app_component=raw.get("app_component") if isinstance(raw.get("app_component"), str) else None,
    )
