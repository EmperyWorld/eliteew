# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# In-memory ``DesktopShellDriver`` for unit tests (records intents, returns empty dicts).
# Invariants:
# - Not thread-safe; do not use in production code paths.
# Related:
# - api/ewa_platform/drivers/desktop_shell.py
# - api/ewa_platform/core/orchestrator.py
# ---
"""Fake desktop shell driver."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


class FakeDesktopDriver:
    """Minimal stand-in matching ``DesktopShellDriver`` method names."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, Mapping[str, Any]]] = []

    @property
    def driver_id(self) -> str:
        return "fake_desktop"

    async def execute_intent(self, intent: Mapping[str, Any]) -> Mapping[str, Any]:
        self.calls.append(("execute_intent", intent))
        return {}

    async def read_shell_snapshot(self) -> Mapping[str, Any]:
        self.calls.append(("read_shell_snapshot", {}))
        return {"windows": []}
