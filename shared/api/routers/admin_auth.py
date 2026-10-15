# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared RBAC dependencies for admin-only API routes.
# Invariants:
# - `admin` or `emperyworld_admin` is required for generic admin endpoints.
# - `emperyworld_admin` is required for privileged operator endpoints.
# Related:
# - api/routers/desktop_admin.py
# - api/routers/desktop_admin_search_config.py
# ---

from __future__ import annotations

from fastapi import Depends, HTTPException, status

from api.core.auth import User as AuthUser
from api.core.oauth2_auth import require_oauth2_user


async def require_admin_user(user: AuthUser = Depends(require_oauth2_user)) -> AuthUser:  # noqa: B008
    if user.role not in ("admin", "emperyworld_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required",
        )
    return user


async def require_emperyworld_admin(user: AuthUser = Depends(require_oauth2_user)) -> AuthUser:  # noqa: B008
    if user.role != "emperyworld_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Empery World administrator privileges required for this operation",
        )
    return user
