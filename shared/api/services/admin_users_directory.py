# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Helpers for admin users directory: SQL filter application and Redis subset counts.
# Invariants:
#   - Summary counts apply SQL filters first, then intersect Redis presence/anomaly id sets.
#   - SSO active window matches sso_session_registry (30 minutes UTC).
# Related:
#   - api/routers/desktop_admin.py
# ---

from __future__ import annotations

import contextlib
from typing import Literal
from uuid import UUID

from sqlalchemy import exists, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.core.admin_directory_filters import directory_order_clause, directory_role_sql_filter
from api.core.admin_user_channel_mismatch import directory_entry_has_channel_mismatch
from api.models.database_models import User as DBUser

# Cap SQL-filtered ids scanned for channel mismatch (admin-only; avoids unbounded batch).
MAX_CHANNEL_MISMATCH_SCAN_IDS = 5000
_CHANNEL_MISMATCH_CHUNK = 400


def directory_uuid_list_from_strings(raw: set[str]) -> list[UUID]:
    out: list[UUID] = []
    for x in raw:
        with contextlib.suppress(ValueError):
            out.append(UUID(str(x).strip()))
    return out


def apply_directory_sql_filters(
    *,
    search: str | None,
    role: str | None,
    app_access_group_id: str | None,
    is_active: bool | None,
    is_trusted: bool | None,
    is_verified: bool | None,
):
    """Build base select + count query with SQL-side directory filters (no Redis)."""
    base = select(DBUser).options(selectinload(DBUser.app_access_group))
    count_q = select(func.count()).select_from(DBUser)

    if search and search.strip():
        s = search.strip()
        pattern = f"%{s}%"
        filt = or_(
            DBUser.username.ilike(pattern),
            DBUser.email.ilike(pattern),
            DBUser.full_name.ilike(pattern),
        )
        with contextlib.suppress(ValueError):
            filt = or_(filt, DBUser.id == UUID(s))
        base = base.where(filt)
        count_q = count_q.where(filt)
    if role and role.strip():
        role_filt = directory_role_sql_filter(role)
        base = base.where(role_filt)
        count_q = count_q.where(role_filt)
    if app_access_group_id and app_access_group_id.strip():
        ag = app_access_group_id.strip()
        if ag == "__none__":
            ag_filt = DBUser.app_access_group_id.is_(None)
        else:
            try:
                ag_filt = DBUser.app_access_group_id == UUID(ag)
            except ValueError as exc:
                raise ValueError("Invalid app_access_group_id") from exc
        base = base.where(ag_filt)
        count_q = count_q.where(ag_filt)
    if is_active is not None:
        base = base.where(DBUser.is_active == is_active)
        count_q = count_q.where(DBUser.is_active == is_active)
    if is_trusted is not None:
        base = base.where(DBUser.is_trusted == is_trusted)
        count_q = count_q.where(DBUser.is_trusted == is_trusted)
    if is_verified is not None:
        base = base.where(DBUser.is_verified == is_verified)
        count_q = count_q.where(DBUser.is_verified == is_verified)

    return base, count_q


async def count_directory_subset(
    db: AsyncSession,
    count_q,
    user_ids: list[UUID],
) -> int:
    if not user_ids:
        return 0
    return int((await db.execute(count_q.where(DBUser.id.in_(user_ids)))).scalar() or 0)


def directory_sso_active_exists(client_class: Literal["browser", "mobile", "desktop", "fofline"]):
    """EXISTS: active SSO registry row for user (same 30m window as registry)."""
    if client_class not in ("browser", "mobile", "desktop", "fofline"):
        raise ValueError(f"invalid client_class: {client_class}")
    return exists(
        select(1)
        .select_from(text("public.sso_user_sessions AS s"))
        .where(
            text("s.keycloak_sub = CAST(users.id AS VARCHAR)"),
            text(f"s.client_class = '{client_class}'"),
            text("s.last_seen_at >= (NOW() AT TIME ZONE 'UTC') - interval '30 minutes'"),
        )
    )


async def directory_channel_mismatch_matching_ids(
    db: AsyncSession,
    count_q,
) -> tuple[bool, set[str]]:
    """
    User ids (str) among SQL-filtered directory rows with SSO/Socket.IO channel mismatch.

    Returns (redis_available, ids). When Redis is unavailable, ``redis_available`` is False.
    """
    from api.services.presence_service import batch_presence_for_user_ids
    from api.services.sso_session_registry import batch_sso_sessions_for_user_ids

    id_q = select(DBUser.id)
    if count_q.whereclause is not None:
        id_q = id_q.where(count_q.whereclause)
    rows = (await db.execute(id_q.limit(MAX_CHANNEL_MISMATCH_SCAN_IDS + 1))).scalars().all()
    ids = [str(r) for r in rows[:MAX_CHANNEL_MISMATCH_SCAN_IDS]]
    if not ids:
        return True, set()

    mismatch: set[str] = set()
    for i in range(0, len(ids), _CHANNEL_MISMATCH_CHUNK):
        chunk = ids[i : i + _CHANNEL_MISMATCH_CHUNK]
        redis_ok, presence_map = await batch_presence_for_user_ids(chunk)
        if not redis_ok:
            return False, set()
        sso_map = await batch_sso_sessions_for_user_ids(chunk)
        for uid in chunk:
            pr = presence_map.get(uid, {})
            sso = sso_map.get(uid, {})
            browser = sso.get("browser") or {}
            if directory_entry_has_channel_mismatch(
                presence_online=bool(pr.get("online")),
                presence_sessions_web=int(pr.get("sessions_web") or 0),
                presence_sessions_mobile=int(pr.get("sessions_mobile") or 0),
                sso_browser_active=bool(browser.get("active")),
            ):
                mismatch.add(uid)
    return True, mismatch


async def count_directory_sso_active_matching(
    db: AsyncSession,
    count_q,
    client_class: Literal["browser", "mobile", "desktop", "fofline"],
) -> int:
    stmt = select(func.count(func.distinct(DBUser.id))).select_from(DBUser)
    if count_q.whereclause is not None:
        stmt = stmt.where(count_q.whereclause)
    stmt = stmt.where(directory_sso_active_exists(client_class))
    return int((await db.execute(stmt)).scalar() or 0)


def directory_order_by(sort_by: str | None, sort_dir: str | None):
    return directory_order_clause(sort_by, sort_dir)
