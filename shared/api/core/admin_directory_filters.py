# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   SQLAlchemy filters for the admin users directory (role aliases, shared by router and tests).
# Invariants:
#   - UI filter emperyworld_member must match brotherhood_member rows in Postgres.
# Related:
#   - api/routers/desktop_admin.py
# ---

from __future__ import annotations

from typing import Literal

from sqlalchemy import asc, desc

from api.models.database_models import User as DBUser

DirectorySortBy = Literal["created_at", "last_login_at", "username", "email", "ew_balance"]
DirectorySortDir = Literal["asc", "desc"]

_DIRECTORY_SORT_COLUMNS: dict[str, object] = {
    "created_at": DBUser.created_at,
    "last_login_at": DBUser.last_login_at,
    "username": DBUser.username,
    "email": DBUser.email,
    "ew_balance": DBUser.ew_balance,
}


def directory_role_sql_filter(role: str):
    """Match directory role filter; UI «Участник» uses emperyworld_member but DB may store brotherhood_member."""
    r = role.strip()
    if r == "emperyworld_member":
        return DBUser.role.in_(("emperyworld_member", "brotherhood_member"))
    return DBUser.role == r


def directory_order_clause(
    sort_by: str | None,
    sort_dir: str | None,
):
    """SQL ORDER BY for admin users directory; unknown keys fall back to created_at desc."""
    key = (sort_by or "created_at").strip()
    col = _DIRECTORY_SORT_COLUMNS.get(key, DBUser.created_at)
    direction = (sort_dir or "desc").strip().lower()
    if direction == "asc":
        return asc(col)
    return desc(col)
