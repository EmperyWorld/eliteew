# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# In-process fakes for ``UgsControlDriver``, ``DocumentsWorkspaceDriver``, and ``ContentManagerDriver`` (unit tests only).
# Invariants:
# - Returns JSON-safe mappings; no HTTP, SQL, or imports from ``api.services.amka_core``.
# Related:
# - api/ewa_platform/drivers/content_manager.py
# - api/ewa_platform/drivers/documents_workspace.py
# - api/ewa_platform/drivers/registry.py
# - api/ewa_platform/drivers/ugs_control.py
# - api/ewa_platform/docs/DRIVERS-ROADMAP.md §3
# ---
"""Fake domain drivers for EWA platform tests."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.contracts.domain_driver_snapshots import (
    ContentManagerRootsSnapshotV1,
    DocumentsWorkspaceSnapshotV1,
    DomainActionRiskTier,
    mapping_to_document_workspace_item,
)
from api.ewa_platform.drivers.registry import (
    CONTENT_MANAGER_DRIVER_ID,
    DOCUMENTS_WORKSPACE_DRIVER_ID,
    UGS_CONTROL_DRIVER_ID,
)


class FakeUgsControlDriver:
    """Deterministic stand-in for ``UgsControlDriver``."""

    def __init__(self, *, hint: Mapping[str, Any] | None = None) -> None:
        self._hint = dict(hint or {"stub": True, "domain": "ugs"})

    @property
    def driver_id(self) -> str:
        return UGS_CONTROL_DRIVER_ID

    async def ping(self) -> Mapping[str, Any]:
        return {"ok": True, "driver_id": self.driver_id}

    async def read_configuration_hint(self) -> Mapping[str, Any]:
        return dict(self._hint)


class FakeDocumentsWorkspaceDriver:
    """Deterministic stand-in for ``DocumentsWorkspaceDriver``."""

    def __init__(self, *, documents: list[Mapping[str, Any]] | None = None) -> None:
        self._snapshot = DocumentsWorkspaceSnapshotV1(
            items=tuple(mapping_to_document_workspace_item(d) for d in documents or ()),
            source="fake_in_memory",
        )

    @property
    def driver_id(self) -> str:
        return DOCUMENTS_WORKSPACE_DRIVER_ID

    @property
    def max_supported_risk_tier(self) -> DomainActionRiskTier:
        return DomainActionRiskTier.READ_ONLY

    async def ping(self) -> Mapping[str, Any]:
        return {"ok": True, "driver_id": self.driver_id}

    async def describe_open_documents_snapshot(self) -> DocumentsWorkspaceSnapshotV1:
        return self._snapshot

    async def describe_open_documents_hint(self) -> Mapping[str, Any]:
        return (await self.describe_open_documents_snapshot()).to_hint_wire()


class FakeContentManagerDriver:
    """Deterministic stand-in for ``ContentManagerDriver``."""

    def __init__(self, *, roots: list[str] | None = None) -> None:
        self._snapshot = ContentManagerRootsSnapshotV1(roots=tuple(roots or ()), source="fake_in_memory")

    @property
    def driver_id(self) -> str:
        return CONTENT_MANAGER_DRIVER_ID

    @property
    def max_supported_risk_tier(self) -> DomainActionRiskTier:
        return DomainActionRiskTier.READ_ONLY

    async def ping(self) -> Mapping[str, Any]:
        return {"ok": True, "driver_id": self.driver_id}

    async def list_entity_roots_snapshot(self) -> ContentManagerRootsSnapshotV1:
        return self._snapshot

    async def list_entity_roots_hint(self) -> Mapping[str, Any]:
        return (await self.list_entity_roots_snapshot()).to_hint_wire()
