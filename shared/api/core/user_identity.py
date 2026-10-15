# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Map authenticated OAuth2 User (JWT/Keycloak) to canonical PostgreSQL users.id for routers.
# Invariants:
#   - Prefer UUID match (DB id or Keycloak sub when synced); email fallback is case-insensitive.
# Related:
#   - api.core.oauth2_auth (SSO sync); dependencies using get_asyncpg_pool / AsyncSession.
# ---
from __future__ import annotations

from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import HTTPException, status  # type: ignore[import-untyped]
from sqlalchemy import func, select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User as AuthUser
from api.models.database_models import User as DatabaseUser


def _extract_oauth_identity(current_user: AuthUser) -> tuple[UUID | None, str]:
    raw_user_id = str(getattr(current_user, "id", "") or "").strip()
    email = str(getattr(current_user, "email", "") or "").strip()

    oauth_uuid: UUID | None = None
    try:
        oauth_uuid = UUID(raw_user_id)
    except (TypeError, ValueError):  # fmt: skip
        oauth_uuid = None

    return oauth_uuid, email


def _raise_identity_error(detail: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
    raise HTTPException(status_code=status_code, detail=detail)


async def resolve_db_user_uuid_with_session(current_user: AuthUser, db: AsyncSession) -> UUID:
    """Resolve current OAuth2 user to database `users.id` using UUID-first, email-fallback logic."""
    oauth_uuid, email = _extract_oauth_identity(current_user)

    if oauth_uuid is None and not email:
        _raise_identity_error("User email or UUID is required")

    row: UUID | None = None
    if oauth_uuid is not None:
        result = await db.execute(select(DatabaseUser.id).where(DatabaseUser.id == oauth_uuid))
        row = result.scalar_one_or_none()

    if row is None and email:
        el = email.strip().lower()
        result = await db.execute(
            select(DatabaseUser.id).where(func.lower(DatabaseUser.email) == el),
        )
        row = result.scalar_one_or_none()

    if row is None:
        _raise_identity_error("User not found in database", status.HTTP_404_NOT_FOUND)

    return row if isinstance(row, UUID) else UUID(str(row))


async def resolve_db_user_uuid_with_pool(current_user: AuthUser, db_pool: asyncpg.Pool) -> UUID:
    """Resolve current OAuth2 user to database `users.id` for raw SQL/asyncpg routers."""
    oauth_uuid, email = _extract_oauth_identity(current_user)

    if oauth_uuid is None and not email:
        _raise_identity_error("User email or UUID is required")

    async with db_pool.acquire() as conn:
        row = None
        if oauth_uuid is not None:
            row = await conn.fetchval("SELECT id FROM users WHERE id = $1", oauth_uuid)

        if row is None and email:
            el = email.strip().lower()
            row = await conn.fetchval(
                "SELECT id FROM users WHERE lower(btrim(email::text)) = $1",
                el,
            )

    if row is None:
        _raise_identity_error("User not found in database", status.HTTP_404_NOT_FOUND)

    return row if isinstance(row, UUID) else UUID(str(row))
