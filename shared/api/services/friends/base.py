# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared state and serialize helpers for FriendsService mixin package (typed for basedpyright).
# Invariants:
# - Mixins inherit this base so `db_pool` and helpers are known without importing the facade.
# - Do not import api.services.friends.facade from this module.
# Related:
# - api/services/friends/facade.py
# ---

from __future__ import annotations

from datetime import datetime
from uuid import UUID

import asyncpg  # type: ignore[import-not-found,import-untyped]


class FriendsServiceBase:
    """Common attribute surface for Social Hub friends mixins."""

    db_pool: asyncpg.Pool

    @staticmethod
    def _parse_user_uuid(user_id: str) -> UUID | None:
        try:
            return UUID(str(user_id).strip())
        except (ValueError, TypeError):  # fmt: skip
            return None

    @staticmethod
    def _serialize_dt(value: datetime | None) -> str | None:
        return value.isoformat() if value is not None else None

    @staticmethod
    def _normalize_circle_name(name: str) -> str:
        normalized = (name or "").strip()
        if not normalized:
            raise ValueError("Название круга не может быть пустым")
        return normalized

    @staticmethod
    def _serialize_circle_row(row: asyncpg.Record | dict) -> dict:
        return {
            "id": str(row["id"]),
            "name": row["name"],
            "members_count": int(row.get("members_count", 0)),
            "sort_order": int(row.get("sort_order", 0)),
            "color": row.get("color"),
            "icon": row.get("icon"),
        }
