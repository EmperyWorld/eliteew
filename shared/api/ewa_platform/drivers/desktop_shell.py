# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Protocol for executing desktop intents and reading shell snapshots (abstract shell).
# Invariants:
# - Implementations live in adapters/ (HTTP) or testing/ (fakes); core depends only on this Protocol.
# Related:
# - api/ewa_platform/adapters/eliteew_desktop_http.py
# - api/ewa_platform/contracts/desktop_intent.py
# ---
"""Desktop automation boundary; concrete drivers in ``adapters/eliteew_desktop_http`` and ``testing fake_desktop_driver``."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class DesktopShellDriver(Protocol):
    """Executable boundary for desktop-level automation."""

    @property
    def driver_id(self) -> str:
        """Registry key, e.g. ``eliteew_desktop``."""

        ...

    async def execute_intent(self, intent: Mapping[str, Any]) -> Mapping[str, Any]:
        """Apply one intent dict (serialized from contracts); return result metadata."""

        ...

    async def read_shell_snapshot(self) -> Mapping[str, Any]:
        """Optional windows/shell projection for compose-only tests; shape follows ``OBSERVATION-CATALOG`` drafts."""

        ...
