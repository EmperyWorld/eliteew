# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Short-lived private cache for expensive Marketing Cabinet dashboard/report reads.
# Keeps cache keys scoped by viewer and query shape so tenant data cannot leak between users.
# Invariants:
# - Cache keys must include user_id and project_id for every user-visible payload.
# - TTL is intentionally short; writes still rely on query invalidation/refetch for freshness.
# Related:
# - documentation/product/marketing/MARKETING-CABINET-PERFORMANCE.md
# ---
from __future__ import annotations

import copy
import os
import time
from dataclasses import dataclass
from typing import Any
from uuid import UUID


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


DEFAULT_MARKETING_DASHBOARD_CACHE_TTL_SECONDS = max(
    0,
    min(300, _env_int("MARKETING_PROJECT_DASHBOARD_CACHE_TTL_SEC", 15)),
)


@dataclass(frozen=True)
class MarketingDashboardCacheKey:
    """Stable private cache identity for one dashboard/report request."""

    user_id: UUID
    project_id: UUID
    namespace: str
    parts: tuple[tuple[str, str], ...]

    def as_string(self) -> str:
        """Return a compact deterministic key safe for in-memory/Redis-like stores."""
        suffix = ":".join(f"{name}={value}" for name, value in self.parts)
        return f"marketing:{self.namespace}:user={self.user_id}:project={self.project_id}:{suffix}"


class MarketingDashboardInMemoryCache:
    """Small per-process fallback cache used when no distributed cache is wired for this report."""

    def __init__(self, *, ttl_seconds: int = DEFAULT_MARKETING_DASHBOARD_CACHE_TTL_SECONDS) -> None:
        self.ttl_seconds = max(0, ttl_seconds)
        self._items: dict[str, tuple[float, Any]] = {}

    async def get(self, key: MarketingDashboardCacheKey) -> Any | None:  # noqa: ANN401
        """Read a cached payload, returning a copy so callers cannot mutate cached state."""
        if self.ttl_seconds <= 0:
            return None
        now = time.monotonic()
        raw_key = key.as_string()
        item = self._items.get(raw_key)
        if item is None:
            return None
        expires_at, value = item
        if expires_at <= now:
            self._items.pop(raw_key, None)
            return None
        return copy.deepcopy(value)

    async def set(self, key: MarketingDashboardCacheKey, value: Any) -> None:  # noqa: ANN401
        """Store a defensive copy of the payload for the configured TTL."""
        if self.ttl_seconds <= 0:
            return
        self._items[key.as_string()] = (time.monotonic() + self.ttl_seconds, copy.deepcopy(value))

    async def invalidate_project_namespace(self, *, project_id: UUID, namespace: str) -> int:
        """Drop all cached payloads for one project/report namespace across viewers."""
        prefix = f"marketing:{namespace}:"
        project_marker = f":project={project_id}:"
        keys = [key for key in self._items if key.startswith(prefix) and project_marker in key]
        for key in keys:
            self._items.pop(key, None)
        return len(keys)


marketing_dashboard_cache = MarketingDashboardInMemoryCache()
