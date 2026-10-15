# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Ownership guards for Realtor Pro mutations.
# Invariants:
# - Every mutation checks ownership via user_id on the owning row.
# - Read helpers return [] when the parent row is not owned.
# Related:
# - api/services/professional_worlds/realtor_pro.py
# ---
# pyright: reportUnusedFunction=false

from __future__ import annotations

from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]


async def _property_owned(db: AsyncSession, user_id: UUID, property_id: UUID) -> bool:
    res = await db.execute(
        text("SELECT 1 FROM realtor_properties WHERE id = :pid AND user_id = :uid LIMIT 1"),
        {"pid": property_id, "uid": user_id},
    )
    return res.scalar() is not None


async def _deal_owned(db: AsyncSession, user_id: UUID, deal_id: UUID) -> bool:
    res = await db.execute(
        text("SELECT 1 FROM professional_deals WHERE id = :did AND user_id = :uid LIMIT 1"),
        {"did": deal_id, "uid": user_id},
    )
    return res.scalar() is not None


async def _client_owned(db: AsyncSession, user_id: UUID, client_id: UUID) -> bool:
    res = await db.execute(
        text("SELECT 1 FROM professional_clients WHERE id = :cid AND user_id = :uid LIMIT 1"),
        {"cid": client_id, "uid": user_id},
    )
    return res.scalar() is not None


async def _showing_owned(db: AsyncSession, user_id: UUID, showing_id: UUID) -> bool:
    res = await db.execute(
        text("SELECT 1 FROM realtor_property_showings WHERE id = :sid AND user_id = :uid LIMIT 1"),
        {"sid": showing_id, "uid": user_id},
    )
    return res.scalar() is not None
