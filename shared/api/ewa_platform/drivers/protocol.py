# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Minimal ``Protocol`` boundary for catalogue-registered domain drivers (see ``drivers/registry.py``).
# Invariants:
# - Keep surface minimal until legacy behaviors are ported intentionally.
# Related:
# - documentation/product/amka-seed-album/RFC-001-amka-driver-contract.md
# - api/services/amka_core/contracts.py (reference only; do not import)
# ---
from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class AmkaDriver(Protocol):
    """Minimal driver profile contract (``driver_id``, ``ping``) for diagnostics and catalogue wiring."""

    @property
    def driver_id(self) -> str:
        """Stable key for catalog/registry entries."""

        ...

    async def ping(self) -> Mapping[str, Any]:
        """Cheap health probe for gateway wiring tests."""

        ...
