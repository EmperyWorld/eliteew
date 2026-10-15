# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Idempotent ensure of eliteew-proj-* desktop folder when a marketing project is created.
# Invariants:
# - Folder lives on desktop root (parent_id NULL); item_id is stable per project UUID.
# Related:
# - api/routers/projects.py
# - api/utils/project_desktop_folder.py
# ---

from __future__ import annotations

import logging
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.desktop import DEFAULT_DESKTOP_WALLPAPER, DesktopConfig, DesktopItem, ItemType
from api.utils.datetime_helpers import utc_now_naive
from api.utils.project_desktop_folder import project_desktop_folder_item_id

logger = logging.getLogger(__name__)

DEFAULT_PROJECT_FOLDER_POSITION = {"x": 120, "y": 280}


async def _get_or_create_desktop_config(db: AsyncSession, user_id: UUID) -> DesktopConfig:
    result = await db.execute(select(DesktopConfig).where(DesktopConfig.user_id == user_id))
    config = result.scalar_one_or_none()
    if config is not None:
        return config

    config = DesktopConfig(
        user_id=user_id,
        wallpaper=DEFAULT_DESKTOP_WALLPAPER,
        wallpapers_history=[DEFAULT_DESKTOP_WALLPAPER],
    )
    db.add(config)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        result = await db.execute(select(DesktopConfig).where(DesktopConfig.user_id == user_id))
        config = result.scalar_one_or_none()
        if config is None:
            raise
    return config


async def ensure_project_desktop_folder(
    db: AsyncSession,
    *,
    user_id: UUID,
    project_id: UUID,
    project_name: str,
) -> str:
    """Create user's desktop folder for a project when missing; return stable item_id."""
    folder_item_id = project_desktop_folder_item_id(project_id)
    label = (project_name or "").strip() or "Project"

    config = await _get_or_create_desktop_config(db, user_id)

    existing = await db.execute(
        select(DesktopItem.id).where(
            DesktopItem.config_id == config.id,
            DesktopItem.item_id == folder_item_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return folder_item_id

    ts = utc_now_naive()
    await db.execute(
        pg_insert(DesktopItem)
        .values(
            id=uuid4(),
            config_id=config.id,
            item_id=folder_item_id,
            item_type=ItemType.FOLDER,
            name=label,
            is_system=False,
            system_key=None,
            position=DEFAULT_PROJECT_FOLDER_POSITION,
            color=None,
            gradient=None,
            is_pinned=False,
            app_component=None,
            parent_id=None,
            meta={},
            created_at=ts,
            updated_at=ts,
        )
        .on_conflict_do_nothing(index_elements=[DesktopItem.config_id, DesktopItem.item_id])
    )
    await db.flush()
    logger.info(
        "[STEP] project_desktop_folder_ensure user=%s project=%s item_id=%s",
        user_id,
        project_id,
        folder_item_id,
    )
    return folder_item_id
