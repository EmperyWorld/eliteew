# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Centralize UGS Admin access checks for legacy and v2 admin endpoints.
# Invariants:
# - SPA Unified Admin visibility is role-only (`ugsAdminAccess.ts` / `require_admin_user`).
# - `UGS_ADMIN_EMAILS` is API break-glass for `require_ugs_admin_user` only — never mirrored in FE.
# - Email whitelist is not a broad Keycloak admin-role grant.
# Related:
# - shared/web/frontend/src/utils/ugsAdminAccess.ts
# - shared/api/routers/admin_auth.py
# ---

from __future__ import annotations

import os
from typing import TYPE_CHECKING

from fastapi import Depends, HTTPException, status  # type: ignore[import-untyped]

from api.core.oauth2_auth import require_oauth2_user

if TYPE_CHECKING:
    from api.core.auth import User as AuthUser

UGS_ADMIN_ROLES = {"admin", "emperyworld_admin"}


def _ugs_admin_emails() -> set[str]:
    raw = os.getenv("UGS_ADMIN_EMAILS", "")
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


def has_ugs_admin_access(*, role: str | None, email: str | None) -> bool:
    normalized_role = (role or "").strip().lower()
    normalized_email = (email or "").strip().lower()
    return normalized_role in UGS_ADMIN_ROLES or normalized_email in _ugs_admin_emails()


def ensure_ugs_admin_access(user: AuthUser) -> None:
    if has_ugs_admin_access(role=getattr(user, "role", None), email=getattr(user, "email", None)):
        return

    if not getattr(user, "email", None):
        msg = "Недостаточно прав для выполнения операции."
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)

    msg = "Доступ разрешён только администраторам UGS."
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)


async def require_ugs_admin_user(
    user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
) -> AuthUser:
    ensure_ugs_admin_access(user)
    return user
