# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Protocol boundary for content-manager domain (read-only roots now; mutating workflows later).
# Invariants:
# - No marketing cabinet imports; persistence via dedicated ports when added.
# - Default action tier is read-only until ADR + policy unlock mutating operations.
# Related:
# - api/ewa_platform/drivers/registry.py (CONTENT_MANAGER_DRIVER_ID)
# - api/ewa_platform/docs/DRIVERS-ROADMAP.md §2.4
# - api/ewa_platform/contracts/domain_hints_wire.py (wire shape for ``list_entity_roots_hint``)
# - api/ewa_platform/contracts/domain_driver_snapshots.py
# ---
"""Content manager driver protocol."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol, runtime_checkable

from api.ewa_platform.contracts.domain_driver_snapshots import DomainActionRiskTier


@runtime_checkable
class ContentManagerDriver(Protocol):
    """Content-manager integration for EWA orchestration."""

    @property
    def driver_id(self) -> str:
        """Registry key (see ``CONTENT_MANAGER_DRIVER_ID``)."""

        ...

    @property
    def max_supported_risk_tier(self) -> DomainActionRiskTier:
        """Highest domain action tier exposed by this driver instance."""

        ...

    async def ping(self) -> Mapping[str, Any]:
        """Cheap health probe for composition-root wiring tests."""

        ...

    async def list_entity_roots_hint(self) -> Mapping[str, Any]:
        """Placeholder until contracts define entity roots for the driver."""

        ...
