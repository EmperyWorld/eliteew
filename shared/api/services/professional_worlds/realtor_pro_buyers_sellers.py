# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Realtor Pro domain: buyers sellers.
# Invariants:
# - Every mutation checks ownership via user_id on the owning row.
# - Read helpers return [] when the parent row is not owned.
# Related:
# - api/services/professional_worlds/realtor_pro.py
# - api/services/professional_worlds/service_realtor_delegations.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.realtor_pro_common import _json, _rows


async def list_buyer_requirements(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT id, user_id, client_id, title, requirements, created_at, updated_at
            FROM realtor_buyer_requirements
            WHERE user_id = :uid
            ORDER BY updated_at DESC
            """
        ),
        {"uid": user_id},
    )
    return _rows(list(result.mappings().all()))


async def create_buyer_requirement(
    db: AsyncSession, user_id: UUID, *, title: str, client_id: UUID | None, requirements: dict[str, Any]
) -> dict[str, Any]:
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_buyer_requirements (user_id, client_id, title, requirements)
            VALUES (:uid, :cid, :title, CAST(:req AS jsonb))
            RETURNING id, user_id, client_id, title, requirements, created_at, updated_at
            """
        ),
        {"uid": user_id, "cid": client_id, "title": title, "req": _json(requirements)},
    )
    await db.commit()
    return dict(result.mappings().one())


async def update_buyer_requirement(
    db: AsyncSession, user_id: UUID, req_id: UUID, *, title: str | None, requirements: dict[str, Any] | None
) -> dict[str, Any] | None:
    cur = await db.execute(
        text(
            """
            SELECT id, title, requirements FROM realtor_buyer_requirements
            WHERE id = :rid AND user_id = :uid
            """
        ),
        {"rid": req_id, "uid": user_id},
    )
    row = cur.mappings().one_or_none()
    if row is None:
        return None
    data = dict(row)
    if title is not None:
        data["title"] = title
    if requirements is not None:
        data["requirements"] = requirements
    res = await db.execute(
        text(
            """
            UPDATE realtor_buyer_requirements
            SET title = :title, requirements = CAST(:req AS jsonb), updated_at = now()
            WHERE id = :rid AND user_id = :uid
            RETURNING id, user_id, client_id, title, requirements, created_at, updated_at
            """
        ),
        {"rid": req_id, "uid": user_id, "title": data["title"], "req": _json(data["requirements"])},
    )
    await db.commit()
    return dict(res.mappings().one())


# --- Seller profiles ---


async def list_seller_profiles(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT id, user_id, client_id, seller_context, created_at, updated_at
            FROM realtor_seller_profiles
            WHERE user_id = :uid
            ORDER BY updated_at DESC
            """
        ),
        {"uid": user_id},
    )
    return _rows(list(result.mappings().all()))


async def create_seller_profile(
    db: AsyncSession, user_id: UUID, *, client_id: UUID | None, seller_context: dict[str, Any]
) -> dict[str, Any]:
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_seller_profiles (user_id, client_id, seller_context)
            VALUES (:uid, :cid, CAST(:ctx AS jsonb))
            RETURNING id, user_id, client_id, seller_context, created_at, updated_at
            """
        ),
        {"uid": user_id, "cid": client_id, "ctx": _json(seller_context)},
    )
    await db.commit()
    return dict(result.mappings().one())


async def update_seller_profile(
    db: AsyncSession, user_id: UUID, profile_id: UUID, *, seller_context: dict[str, Any]
) -> dict[str, Any] | None:
    res = await db.execute(
        text(
            """
            UPDATE realtor_seller_profiles
            SET seller_context = CAST(:ctx AS jsonb), updated_at = now()
            WHERE id = :pid AND user_id = :uid
            RETURNING id, user_id, client_id, seller_context, created_at, updated_at
            """
        ),
        {"pid": profile_id, "uid": user_id, "ctx": _json(seller_context)},
    )
    await db.commit()
    row = res.mappings().one_or_none()
    return dict(row) if row else None


# --- Deal events ---
