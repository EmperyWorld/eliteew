# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Idempotent ensure of a per-task desktop folder nested under system **EwaFile**.
# Invariants:
# - Parent is always ``ewa_file``; child ``item_id`` is ``ewa-task-<key>``.
# - Safe to call from companion confirm / agentic Act (main Postgres session).
# Related:
# - api/utils/ewa_task_folder.py
# - api/utils/ewa_companion_folder.py
# - documentation/product/ewa/EWA-COMPANION-FILE-CATALOG.md
# ---

from __future__ import annotations

import logging
import re
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.desktop import DEFAULT_DESKTOP_WALLPAPER, DesktopConfig, DesktopItem, ItemType
from api.routers.desktop_bootstrap import ensure_system_folders
from api.utils.datetime_helpers import utc_now_naive
from api.utils.ewa_companion_folder import EWA_COMPANION_FOLDER_ITEM_ID
from api.utils.ewa_task_folder import (
    ewa_task_folder_item_id,
    format_ewa_task_folder_label,
    is_ewa_task_folder_item_id,
    sanitize_ewa_task_folder_label,
)

logger = logging.getLogger(__name__)

DEFAULT_TASK_FOLDER_POSITION = {"x": 0, "y": 0}
_STAMP_SUFFIX_RE = re.compile(r"_\d{4}-\d{2}-\d{2}_\d{4}$")


def _display_label_for_task_key(task_key: str, folder_label: str) -> str:
    """Named folders keep a stable human title; legacy keys keep UTC stamp labels."""

    key = (task_key or "").strip()
    if key.startswith("named-"):
        return sanitize_ewa_task_folder_label(folder_label, fallback="Folder")
    return format_ewa_task_folder_label(folder_label, fallback="Task")


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


async def ensure_ewa_task_folder(
    db: AsyncSession,
    *,
    user_id: UUID,
    task_key: str,
    folder_label: str,
) -> str:
    """Create ``EwaFile/<label>`` desktop folder when missing; return ``folder_item_id``."""

    folder_item_id = ewa_task_folder_item_id(task_key)
    label = _display_label_for_task_key(task_key, folder_label)

    config = await _get_or_create_desktop_config(db, user_id)
    await ensure_system_folders(db, config)

    parent = await db.execute(
        select(DesktopItem).where(
            DesktopItem.config_id == config.id,
            DesktopItem.item_id == EWA_COMPANION_FOLDER_ITEM_ID,
        )
    )
    parent_row = parent.scalar_one_or_none()
    if parent_row is None:
        raise RuntimeError("EwaFile system folder missing after ensure_system_folders")

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
            position=DEFAULT_TASK_FOLDER_POSITION,
            color=None,
            gradient=None,
            is_pinned=False,
            app_component=None,
            parent_id=parent_row.id,
            meta={"source": "ewa_companion_task_folder", "parent_item_id": EWA_COMPANION_FOLDER_ITEM_ID},
            created_at=ts,
            updated_at=ts,
        )
        .on_conflict_do_nothing(index_elements=[DesktopItem.config_id, DesktopItem.item_id])
    )
    await db.flush()
    logger.info(
        "[STEP] ewa_task_folder_ensure user=%s task_key=%s item_id=%s label=%s",
        user_id,
        task_key,
        folder_item_id,
        label,
    )
    return folder_item_id


async def ensure_ewa_task_folder_for_user(
    *,
    user_id: str,
    task_key: str,
    folder_label: str,
) -> str | None:
    """Open a main-DB session and ensure the task folder; ``None`` on soft failure."""

    uid_s = (user_id or "").strip()
    key = (task_key or "").strip()
    if not uid_s or not key:
        return None
    try:
        uid = UUID(uid_s)
    except ValueError:
        logger.warning("[STEP] ewa_task_folder_ensure_skip invalid_user_id=%s", uid_s[:36])
        return None

    try:
        from api.core.database_manager import DatabaseConnectionError, get_database_manager

        manager = await get_database_manager()
        async with manager.get_postgres_session() as db:
            return await ensure_ewa_task_folder(
                db,
                user_id=uid,
                task_key=key,
                folder_label=folder_label,
            )
    except DatabaseConnectionError as exc:
        logger.warning("[STEP] ewa_task_folder_ensure_skip db_unavailable err=%s", exc)
        return None
    except Exception as exc:  # noqa: BLE001 — create path must degrade to EwaFile root
        logger.warning(
            "[STEP] ewa_task_folder_ensure_failed task_key=%s err=%s",
            key[:64],
            exc,
        )
        return None


def _folder_name_match_score(name: str, query: str) -> int:
    """Higher is better: exact > unstamped exact > contains."""

    n = (name or "").strip()
    q = (query or "").strip()
    if not n or not q:
        return 0
    ncf = n.casefold()
    qcf = q.casefold()
    if ncf == qcf:
        return 300
    unstamped = _STAMP_SUFFIX_RE.sub("", n).strip()
    if unstamped.casefold() == qcf:
        return 200
    if qcf in ncf or qcf in unstamped.casefold():
        return 100
    return 0


async def find_ewa_task_folder_by_label(
    db: AsyncSession,
    *,
    user_id: UUID,
    query: str,
) -> str | None:
    """Return ``item_id`` of an EwaFile child folder matching ``query`` (name or item_id)."""

    q = (query or "").strip()
    if not q:
        return None
    if is_ewa_task_folder_item_id(q):
        config = await _get_or_create_desktop_config(db, user_id)
        hit = await db.execute(
            select(DesktopItem.item_id).where(
                DesktopItem.config_id == config.id,
                DesktopItem.item_id == q,
                DesktopItem.item_type == ItemType.FOLDER,
            )
        )
        found = hit.scalar_one_or_none()
        return str(found) if found else None

    config = await _get_or_create_desktop_config(db, user_id)
    await ensure_system_folders(db, config)
    parent = await db.execute(
        select(DesktopItem).where(
            DesktopItem.config_id == config.id,
            DesktopItem.item_id == EWA_COMPANION_FOLDER_ITEM_ID,
        )
    )
    parent_row = parent.scalar_one_or_none()
    if parent_row is None:
        return None

    rows = await db.execute(
        select(DesktopItem).where(
            DesktopItem.config_id == config.id,
            DesktopItem.parent_id == parent_row.id,
            DesktopItem.item_type == ItemType.FOLDER,
        )
    )
    best_id: str | None = None
    best_score = 0
    for row in rows.scalars().all():
        score = _folder_name_match_score(str(row.name or ""), q)
        if score > best_score:
            best_score = score
            best_id = str(row.item_id or "")
    return best_id if best_score > 0 else None


async def find_ewa_task_folder_by_label_for_user(*, user_id: str, query: str) -> str | None:
    """Main-DB lookup of a nested EwaFile folder by label; soft-fail to ``None``."""

    uid_s = (user_id or "").strip()
    q = (query or "").strip()
    if not uid_s or not q:
        return None
    try:
        uid = UUID(uid_s)
    except ValueError:
        logger.warning("[STEP] ewa_task_folder_find_skip invalid_user_id=%s", uid_s[:36])
        return None
    try:
        from api.core.database_manager import DatabaseConnectionError, get_database_manager

        manager = await get_database_manager()
        async with manager.get_postgres_session() as db:
            return await find_ewa_task_folder_by_label(db, user_id=uid, query=q)
    except DatabaseConnectionError as exc:
        logger.warning("[STEP] ewa_task_folder_find_skip db_unavailable err=%s", exc)
        return None
    except Exception as exc:  # noqa: BLE001 — reuse path degrades to create/root
        logger.warning("[STEP] ewa_task_folder_find_failed query=%s err=%s", q[:64], exc)
        return None


__all__ = (
    "ensure_ewa_task_folder",
    "ensure_ewa_task_folder_for_user",
    "find_ewa_task_folder_by_label",
    "find_ewa_task_folder_by_label_for_user",
)
