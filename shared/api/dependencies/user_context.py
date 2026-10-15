# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   FastAPI dependencies resolving OAuth2 User to canonical PostgreSQL users.id (string UUID).
# Invariants:
#   - Same resolution rules as api.core.user_identity (UUID first, case-insensitive email).
# Related:
#   - api.core.oauth2_auth.require_oauth2_user; api.core.user_identity.resolve_db_user_uuid_with_pool
# ---
"""Shared user resolution dependencies for cross-domain API modules."""

from __future__ import annotations

import asyncpg  # type: ignore[import-not-found]
from fastapi import Depends

from api.core.auth import User
from api.core.database_manager import get_asyncpg_pool
from api.core.oauth2_auth import require_oauth2_user, require_oauth2_user_short_session
from api.core.user_identity import resolve_db_user_uuid_with_pool


async def get_current_user_db_id(
    current_user: User = Depends(require_oauth2_user),
    pool: asyncpg.Pool = Depends(get_asyncpg_pool),
) -> str:
    """Resolve current OAuth2 user to the application's users.id UUID."""
    uid = await resolve_db_user_uuid_with_pool(current_user, pool)
    return str(uid)


async def get_current_user_db_id_short_session(
    current_user: User = Depends(require_oauth2_user_short_session),
    pool: asyncpg.Pool = Depends(get_asyncpg_pool),
) -> str:
    """Same as get_current_user_db_id but pairs with short-lived auth SA (blob streams)."""
    uid = await resolve_db_user_uuid_with_pool(current_user, pool)
    return str(uid)
