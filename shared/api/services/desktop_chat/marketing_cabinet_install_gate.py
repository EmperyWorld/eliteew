"""Gate: групповой чат (ensemble) в Desktop AI Chat требует установленного приложения «Маркетинговый кабинет»."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.desktop import DesktopAppCatalog, UserInstalledApp

MARKETING_CABINET_APP_COMPONENT = "MarketingCabinet"


async def user_has_marketing_cabinet_installed(db: AsyncSession, user_id: UUID) -> bool:
    """Пользователь установил приложение каталога с `app_component == MarketingCabinet`."""
    r = await db.execute(
        select(UserInstalledApp.app_id)
        .join(DesktopAppCatalog, DesktopAppCatalog.app_id == UserInstalledApp.app_id)
        .where(
            UserInstalledApp.user_id == user_id,
            DesktopAppCatalog.app_component == MARKETING_CABINET_APP_COMPONENT,
        )
        .limit(1)
    )
    return r.scalar_one_or_none() is not None


async def assert_marketing_cabinet_for_ensemble_chat(db: AsyncSession, user_id: UUID) -> None:
    """400, если для включения группового чата (ensemble) нет установленного маркетингового кабинета."""
    if await user_has_marketing_cabinet_installed(db, user_id):
        return
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="marketing_cabinet_required_for_group_chat",
    )
