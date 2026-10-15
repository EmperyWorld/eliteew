# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Persist and load per-user EBrowser navigation policies.
# Invariants:
# - Missing row → default deny-all (allowlist + empty allow) for GET effective.
# - Save validates exclusive mode lists via nav_policy.validate_policy_for_save.
# Related:
# - documentation/product/desktop/DESKTOP-EBROWSER.md
# - api/routers/ebrowser.py
# ---

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.desktop import EBrowserUserPolicy
from api.services.ebrowser.nav_policy import (
    POLICY_TTL_SECONDS,
    PolicyMode,
    default_deny_all_policy,
    validate_policy_for_save,
)
from api.utils.datetime_helpers import utc_now_naive

logger = logging.getLogger(__name__)


class EBrowserPolicyValidationError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _as_str_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        s = str(item).strip()
        if s:
            out.append(s)
    return out


def _policy_payload(
    *,
    user_id: UUID,
    mode: str,
    allow: list[str],
    deny: list[str],
    fetched_at: datetime,
) -> dict[str, Any]:
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=UTC)
    expires = fetched_at.timestamp() + POLICY_TTL_SECONDS
    return {
        "user_id": str(user_id),
        "mode": mode,
        "allow": allow,
        "deny": deny,
        "ttl_seconds": POLICY_TTL_SECONDS,
        "fetched_at": fetched_at.astimezone(UTC).isoformat().replace("+00:00", "Z"),
        "expires_at": datetime.fromtimestamp(expires, tz=UTC).isoformat().replace("+00:00", "Z"),
        "is_default": False,
    }


async def get_effective_policy(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    row = await db.get(EBrowserUserPolicy, user_id)
    now = datetime.now(UTC)
    if row is None:
        synthetic = default_deny_all_policy(now=now)
        return {
            "user_id": str(user_id),
            "mode": synthetic.mode,
            "allow": list(synthetic.allow),
            "deny": list(synthetic.deny),
            "ttl_seconds": POLICY_TTL_SECONDS,
            "fetched_at": now.isoformat().replace("+00:00", "Z"),
            "expires_at": datetime.fromtimestamp(now.timestamp() + POLICY_TTL_SECONDS, tz=UTC)
            .isoformat()
            .replace("+00:00", "Z"),
            "is_default": True,
        }
    return _policy_payload(
        user_id=user_id,
        mode=str(row.mode),
        allow=_as_str_list(row.allow_json),
        deny=_as_str_list(row.deny_json),
        fetched_at=now,
    )


async def upsert_policy(
    db: AsyncSession,
    user_id: UUID,
    *,
    mode: PolicyMode,
    allow: list[str],
    deny: list[str],
) -> dict[str, Any]:
    err = validate_policy_for_save(mode, allow, deny)
    if err:
        raise EBrowserPolicyValidationError(err)

    allow_n = [x.strip() for x in allow if str(x).strip()]
    deny_n = [x.strip() for x in deny if str(x).strip()]

    row = await db.get(EBrowserUserPolicy, user_id)
    now = utc_now_naive()
    if row is None:
        row = EBrowserUserPolicy(
            user_id=user_id,
            mode=mode,
            allow_json=allow_n,
            deny_json=deny_n,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
    else:
        row.mode = mode
        row.allow_json = allow_n
        row.deny_json = deny_n
        row.updated_at = now

    await db.commit()
    await db.refresh(row)
    logger.info(
        "[STEP] ebrowser_policy_upsert user_id=%s mode=%s allow_n=%s deny_n=%s",
        user_id,
        mode,
        len(allow_n),
        len(deny_n),
    )
    return await get_effective_policy(db, user_id)


async def user_exists(db: AsyncSession, user_id: UUID) -> bool:
    from api.models.database_models import User as DBUser

    result = await db.execute(select(DBUser.id).where(DBUser.id == user_id).limit(1))
    return result.scalar_one_or_none() is not None
