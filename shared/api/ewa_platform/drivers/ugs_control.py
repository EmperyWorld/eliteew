# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Protocol for UGS-aligned read-only hints in EWA orchestration (mutations gated by future ADRs).
# Invariants:
# - No imports from UGS services or ``api.services.amka_core``; HTTP lives in ``adapters/`` when wired.
# Related:
# - api/ewa_platform/drivers/registry.py (UGS_CONTROL_DRIVER_ID)
# - api/ewa_platform/docs/DRIVERS-ROADMAP.md §2.2
# ---
"""UGS control driver protocol."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class UgsControlDriver(Protocol):
    """Future UGS integration surface (alignment hints today; mutation later per ADR)."""

    @property
    def driver_id(self) -> str:
        """Registry key (see ``UGS_CONTROL_DRIVER_ID``)."""

        ...

    async def ping(self) -> Mapping[str, Any]:
        """Cheap health probe for composition-root wiring tests."""

        ...

    async def read_configuration_hint(self) -> Mapping[str, Any]:
        """Placeholder for read-only shape discovery (no HTTP in this module)."""

        ...
