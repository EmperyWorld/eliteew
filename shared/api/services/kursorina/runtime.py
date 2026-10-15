# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Runtime context for Курсорина tools (DB session + principal for Yandex web).
# Invariants:
# - web_search requires db+user_id; without them tools return honest denial.
# Related:
# - documentation/product/desktop/KURSORINA.md
# ---

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True, slots=True)
class ToolRuntime:
    """Per-request tool context. Not shared across ticks without refresh."""

    db: AsyncSession | None = None
    user_id: UUID | None = None
    web_enabled: bool = True


__all__ = ("ToolRuntime",)
