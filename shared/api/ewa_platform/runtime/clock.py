# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Injectable clock for orchestration tests and deterministic replay.
# Invariants:
# - Implementations return timezone-aware UTC in production (document in real code).
# Related:
# - api/ewa_platform/runtime/session_scope.py
# ---
"""Clock protocol and default implementations."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol, runtime_checkable


@runtime_checkable
class Clock(Protocol):
    """Abstract time source."""

    def now(self) -> datetime: ...


class SystemClock:
    """Returns ``datetime.now(UTC)``."""

    def now(self) -> datetime:
        return datetime.now(UTC)


@dataclass(slots=True)
class FixedClock:
    """Deterministic clock for tests and replay."""

    instant: datetime

    def now(self) -> datetime:
        return self.instant
