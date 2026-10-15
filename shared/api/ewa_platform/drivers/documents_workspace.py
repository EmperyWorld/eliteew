# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Protocol boundary for document editor / workspace driver (read-only snapshots now; normalized edits later).
# Invariants:
# - No document DB or FastAPI imports here; adapters perform HTTP when implemented.
# - Default action tier is read-only until ADR + policy unlock mutating operations.
# Related:
# - api/ewa_platform/drivers/registry.py (DOCUMENTS_WORKSPACE_DRIVER_ID)
# - api/ewa_platform/docs/DRIVERS-ROADMAP.md §2.3
# - api/ewa_platform/contracts/domain_hints_wire.py (wire shape for ``describe_open_documents_hint``)
# - api/ewa_platform/contracts/domain_driver_snapshots.py
# ---
"""Documents workspace driver protocol."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol, runtime_checkable

from api.ewa_platform.contracts.domain_driver_snapshots import DomainActionRiskTier


@runtime_checkable
class DocumentsWorkspaceDriver(Protocol):
    """Documents/editor integration for EWA orchestration."""

    @property
    def driver_id(self) -> str:
        """Registry key (see ``DOCUMENTS_WORKSPACE_DRIVER_ID``)."""

        ...

    @property
    def max_supported_risk_tier(self) -> DomainActionRiskTier:
        """Highest domain action tier exposed by this driver instance."""

        ...

    async def ping(self) -> Mapping[str, Any]:
        """Cheap health probe for composition-root wiring tests."""

        ...

    async def describe_open_documents_hint(self) -> Mapping[str, Any]:
        """Placeholder until contracts + adapters define snapshot shape."""

        ...
