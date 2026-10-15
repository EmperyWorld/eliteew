# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   UGS Admin user management routes (list, badges, credits, limits).
# Invariants:
#   - All routes require ``require_ugs_admin_user``; system accounts are protected from badge/trusted edits.
# Related:
#   - api/services/ugs/billing_service.py
#   - api/gaf_chat/system_notifications.py
# ---

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status  # type: ignore[import-untyped]
from sqlalchemy import select  # type: ignore[import-untyped]

from api.core.database_manager import get_asyncpg_pool, get_postgres_session
from api.gaf_chat.system_notifications import notify_user_energy_credits_changed
from api.models.database_models import User as UserModel
from api.routers.ugs_admin._helpers import user_to_admin_response
from api.schemas.ugs_admin import (
    AdminUserResponse,
    UserAdminBadgeSetRequest,
    UserCreditTopUpRequest,
    UserLimitsUpdateRequest,
    UserTrustedSetRequest,
)
from api.services.ugs.admin_access import require_ugs_admin_user
from api.services.ugs.billing_service import BillingService

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

    from api.core.auth import User as AuthUser

logger = logging.getLogger(__name__)


def register_users_routes(router: APIRouter) -> None:
    @router.get("/users", response_model=list[AdminUserResponse])
    async def list_admin_users(
        current_admin: AuthUser = Depends(require_ugs_admin_user),  # noqa: ARG001, B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> list[AdminUserResponse]:
        result = await db.execute(select(UserModel).order_by(UserModel.created_at.desc()))
        users = result.scalars().all()
        return [user_to_admin_response(user) for user in users]

    @router.get("/users/{user_id}", response_model=AdminUserResponse)
    async def get_admin_user(
        user_id: UUID,
        current_admin: AuthUser = Depends(require_ugs_admin_user),  # noqa: ARG001, B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> AdminUserResponse:
        """Один пользователь для админ-панели (карточка, синхронизация после PATCH)."""
        result = await db.execute(select(UserModel).where(UserModel.id == user_id))
        user_obj = result.scalar_one_or_none()
        if not user_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден.")
        return user_to_admin_response(user_obj)

    @router.patch("/users/{user_id}/trusted", response_model=AdminUserResponse)
    async def set_user_trusted(
        user_id: UUID,
        payload: UserTrustedSetRequest,
        current_admin: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> AdminUserResponse:
        result = await db.execute(select(UserModel).where(UserModel.id == user_id))
        user_obj = result.scalar_one_or_none()
        if not user_obj:
            msg = "Пользователь не найден."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        if getattr(user_obj, "is_system_account", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя менять метку для системного пользователя"
            )
        user_obj.is_trusted = payload.is_trusted  # type: ignore[assignment]
        await db.commit()
        await db.refresh(user_obj)
        logger.info(
            "UGS admin %s set is_trusted=%s for user %s",
            current_admin.email,
            payload.is_trusted,
            user_obj.email,
        )
        return user_to_admin_response(user_obj)

    @router.patch("/users/{user_id}/admin-badge", response_model=AdminUserResponse)
    async def set_user_admin_badge(
        user_id: UUID,
        payload: UserAdminBadgeSetRequest,
        current_admin: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> AdminUserResponse:
        """Админ: произвольный значок (короткий текст + подсказка). Пустой label снимает значок."""
        result = await db.execute(select(UserModel).where(UserModel.id == user_id))
        user_obj = result.scalar_one_or_none()
        if not user_obj:
            msg = "Пользователь не найден."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        if getattr(user_obj, "is_system_account", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя задавать значок для системного пользователя",
            )
        label_raw = payload.label
        hint_raw = payload.hint
        if not label_raw:
            user_obj.admin_badge_label = None  # type: ignore[assignment]
            user_obj.admin_badge_hint = None  # type: ignore[assignment]
        else:
            user_obj.admin_badge_label = label_raw  # type: ignore[assignment]
            user_obj.admin_badge_hint = hint_raw if hint_raw else None  # type: ignore[assignment]
        await db.commit()
        await db.refresh(user_obj)
        logger.info(
            "UGS admin %s set admin_badge for user %s (label_set=%s)",
            current_admin.email,
            user_obj.email,
            bool(label_raw),
        )
        return user_to_admin_response(user_obj)

    @router.post("/users/{user_id}/credits", response_model=AdminUserResponse)
    async def top_up_user_credits(
        user_id: UUID,
        payload: UserCreditTopUpRequest,
        current_admin: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
        db_pool: Any = Depends(get_asyncpg_pool),  # noqa: B008
    ) -> AdminUserResponse:
        result = await db.execute(select(UserModel).where(UserModel.id == user_id))
        user_obj = result.scalar_one_or_none()
        if not user_obj:
            msg = "Пользователь не найден."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

        billing_service = BillingService(db)
        success = await billing_service.add_credits(str(user_obj.id), int(payload.amount))
        if not success:
            msg = "Не удалось пополнить баланс пользователя."
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

        await db.refresh(user_obj)

        logger.info(
            "UGS admin %s added %s credits to user %s (reason=%s)",
            current_admin.email,
            payload.amount,
            user_obj.email,
            payload.reason or "—",
        )

        new_bal = float(user_obj.credits) if user_obj.credits is not None else 0.0
        await notify_user_energy_credits_changed(
            db_pool,
            str(user_obj.id),
            new_balance=new_bal,
            delta=float(payload.amount),
        )

        return user_to_admin_response(user_obj)

    @router.put("/users/{user_id}/limits", response_model=AdminUserResponse)
    async def update_user_limits(
        user_id: UUID,
        payload: UserLimitsUpdateRequest,
        current_admin: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> AdminUserResponse:
        result = await db.execute(select(UserModel).where(UserModel.id == user_id))
        user_obj = result.scalar_one_or_none()
        if not user_obj:
            msg = "Пользователь не найден."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

        user_mut: Any = user_obj
        user_mut.daily_credit_limit = payload.daily_credit_limit
        user_mut.monthly_credit_limit = payload.monthly_credit_limit
        user_mut.concurrent_requests_limit = payload.concurrent_requests_limit
        await db.commit()
        await db.refresh(user_obj)

        logger.info(
            "UGS admin %s updated limits for user %s: daily=%s monthly=%s concurrent=%s",
            current_admin.email,
            user_obj.email,
            payload.daily_credit_limit,
            payload.monthly_credit_limit,
            payload.concurrent_requests_limit,
        )

        return user_to_admin_response(user_obj)
