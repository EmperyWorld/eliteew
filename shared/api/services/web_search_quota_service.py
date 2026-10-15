# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Per-user web search quota: monthly free allowance + admin coins (1 coin = 1 search).
# Invariants:
# - Consumption is atomic per user/month; coins spent only after monthly free is exhausted.
# Related:
# - api/core/pii_session.py
# - api/services/search_service.py
# - api/routers/desktop_admin.py
# ---

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.pii_session import ensure_encryption_pii_key
from api.models.database_models import User, WebSearchMonthlyUsage
from api.services.search_runtime_config_service import resolve_effective_search_runtime_config

logger = logging.getLogger(__name__)


class WebSearchQuotaExceededError(Exception):
    """Raised when user has no remaining monthly free quota or coins."""

    def __init__(self, status: WebSearchQuotaStatus) -> None:
        self.status = status
        super().__init__("Web search quota exceeded")


@dataclass(frozen=True)
class WebSearchQuotaStatus:
    user_id: str
    monthly_limit: int
    monthly_used: int
    monthly_remaining: int
    coins: int
    total_remaining: int
    period_month: date


def current_period_month(*, now: datetime | None = None) -> date:
    dt = now or datetime.now(UTC)
    return date(dt.year, dt.month, 1)


async def _monthly_limit_for_user(db: AsyncSession, user: User) -> int:
    runtime = await resolve_effective_search_runtime_config(db, surface=None)
    default_limit = int(runtime.monthly_free_default or 50)
    custom = getattr(user, "web_search_monthly_limit", None)
    if custom is not None:
        return max(0, int(custom))
    return max(0, default_limit)


async def get_web_search_quota_status(
    db: AsyncSession,
    user_id: UUID | str,
    *,
    for_update: bool = False,
) -> WebSearchQuotaStatus | None:
    await ensure_encryption_pii_key(db)
    uid = user_id if isinstance(user_id, UUID) else UUID(str(user_id))
    stmt = select(User).where(User.id == uid)
    if for_update:
        stmt = stmt.with_for_update()
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None:
        return None

    period = current_period_month()
    usage_stmt = select(WebSearchMonthlyUsage).where(
        WebSearchMonthlyUsage.user_id == uid,
        WebSearchMonthlyUsage.period_month == period,
    )
    if for_update:
        usage_stmt = usage_stmt.with_for_update()
    usage = (await db.execute(usage_stmt)).scalar_one_or_none()
    monthly_used = int(usage.used_count) if usage is not None else 0
    monthly_limit = await _monthly_limit_for_user(db, user)
    coins = max(0, int(getattr(user, "web_search_coins", 0) or 0))
    monthly_remaining = max(0, monthly_limit - monthly_used)
    total_remaining = monthly_remaining + coins
    return WebSearchQuotaStatus(
        user_id=str(uid),
        monthly_limit=monthly_limit,
        monthly_used=monthly_used,
        monthly_remaining=monthly_remaining,
        coins=coins,
        total_remaining=total_remaining,
        period_month=period,
    )


async def try_consume_web_search_quota(db: AsyncSession, user_id: UUID | str) -> WebSearchQuotaStatus:
    """
    Reserve one web search for the user in the current calendar month.
    Raises WebSearchQuotaExceededError when exhausted.
    """
    await ensure_encryption_pii_key(db)
    uid = user_id if isinstance(user_id, UUID) else UUID(str(user_id))
    user = (await db.execute(select(User).where(User.id == uid).with_for_update())).scalar_one_or_none()
    if user is None:
        msg = f"User {uid} not found"
        raise ValueError(msg)

    period = current_period_month()
    usage = (
        await db.execute(
            select(WebSearchMonthlyUsage)
            .where(
                WebSearchMonthlyUsage.user_id == uid,
                WebSearchMonthlyUsage.period_month == period,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if usage is None:
        usage = WebSearchMonthlyUsage(user_id=uid, period_month=period, used_count=0)
        db.add(usage)
        await db.flush()

    monthly_limit = await _monthly_limit_for_user(db, user)
    monthly_used = int(usage.used_count or 0)
    coins = max(0, int(getattr(user, "web_search_coins", 0) or 0))
    monthly_remaining = max(0, monthly_limit - monthly_used)

    if monthly_remaining <= 0 and coins <= 0:
        status = WebSearchQuotaStatus(
            user_id=str(uid),
            monthly_limit=monthly_limit,
            monthly_used=monthly_used,
            monthly_remaining=0,
            coins=0,
            total_remaining=0,
            period_month=period,
        )
        raise WebSearchQuotaExceededError(status)

    usage_mut: Any = usage
    if monthly_remaining > 0:
        usage_mut.used_count = monthly_used + 1
    else:
        user_mut: Any = user
        user_mut.web_search_coins = coins - 1

    usage_mut.updated_at = datetime.now(UTC)
    # Re-SET after possible prior commits on this AsyncSession (pooled connection drift).
    await ensure_encryption_pii_key(db)
    await db.commit()

    return WebSearchQuotaStatus(
        user_id=str(uid),
        monthly_limit=monthly_limit,
        monthly_used=int(usage.used_count or 0),
        monthly_remaining=max(0, monthly_limit - int(usage.used_count or 0)),
        coins=max(0, int(getattr(user, "web_search_coins", 0) or 0)),
        total_remaining=max(0, monthly_limit - int(usage.used_count or 0))
        + max(0, int(getattr(user, "web_search_coins", 0) or 0)),
        period_month=period,
    )


def format_quota_denied_user_message(status: WebSearchQuotaStatus) -> str:
    return (
        "Лимит веб-поиска исчерпан на этот месяц "
        f"({status.monthly_used}/{status.monthly_limit} бесплатных, монет: {status.coins}). "
        "Обратитесь к администратору для пополнения монет поиска."
    )


async def admin_patch_web_search_quota(
    db: AsyncSession,
    user_id: UUID,
    *,
    web_search_coins: int | None = None,
    web_search_coins_delta: int | None = None,
    web_search_monthly_limit: int | None = None,
    reset_monthly_limit: bool = False,
) -> WebSearchQuotaStatus:
    user = (await db.execute(select(User).where(User.id == user_id).with_for_update())).scalar_one_or_none()
    if user is None:
        msg = f"User {user_id} not found"
        raise ValueError(msg)

    user_mut: Any = user
    if web_search_coins is not None:
        user_mut.web_search_coins = max(0, int(web_search_coins))
    elif web_search_coins_delta is not None:
        current = max(0, int(getattr(user, "web_search_coins", 0) or 0))
        user_mut.web_search_coins = max(0, current + int(web_search_coins_delta))

    if reset_monthly_limit:
        user_mut.web_search_monthly_limit = None
    elif web_search_monthly_limit is not None:
        user_mut.web_search_monthly_limit = max(0, int(web_search_monthly_limit))

    await db.commit()
    status = await get_web_search_quota_status(db, user_id)
    if status is None:
        msg = f"User {user_id} not found after quota patch"
        raise ValueError(msg)
    logger.info(
        "[STEP] search.quota_admin_patch user=%s coins=%s monthly_limit=%s remaining=%s",
        user_id,
        status.coins,
        status.monthly_limit,
        status.total_remaining,
    )
    return status
