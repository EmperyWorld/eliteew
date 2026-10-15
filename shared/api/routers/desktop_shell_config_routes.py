# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop shell config REST: theme/wallpaper, visual presets, MRU helpers, GET/POST/PATCH/PUT /config.
# Invariants:
# - Mounted without extra prefix under parent ``/desktop`` router; OAuth2 on user-facing routes.
# - ``_get_desktop_user_id`` lazy-imports resolver from ``api.routers.desktop``.
# Related:
# - api/routers/desktop_shell_config.py (aggregator)
# - api/routers/desktop_shell_etag.py
# ---
"""Desktop shell config API routes."""

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.models.desktop import (
    DEFAULT_DESKTOP_WALLPAPER,
    DesktopConfig,
    IconSize,
    Theme,
)
from api.routers.desktop_shell_etag import (
    _if_none_match_matches,
    _weak_etag_for_pydantic_model,
)

router = APIRouter(tags=["desktop"])


async def _get_desktop_user_id(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> UUID:
    from api.routers.desktop import get_desktop_user_id

    return await get_desktop_user_id(current_user=current_user, db=db)


def validate_window_instance_policy(
    *,
    allow_multiple_windows: bool,
    max_window_instances: int,
) -> None:
    """Validate and normalize per-app window instance constraints."""
    if max_window_instances < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Максимум окон должен быть не меньше 1",
        )
    if not allow_multiple_windows and max_window_instances != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Для single-instance приложения максимум окон должен быть равен 1",
        )


class Position(BaseModel):
    """Icon position; accepts int or float from frontend, stored as int."""

    x: int
    y: int

    @model_validator(mode="before")
    @classmethod
    def coerce_numbers(cls, v: object) -> object:
        if isinstance(v, dict):
            x, y = v.get("x"), v.get("y")
            return {"x": int(x) if x is not None else 20, "y": int(y) if y is not None else 20}
        return v


MAX_WALLPAPER_HISTORY = 15


def _normalize_wallpaper_history(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value if isinstance(v, str)]
    return []


def _update_wallpaper_history(config: DesktopConfig, new_wallpaper: str) -> None:
    """Update wallpapers_history for config with new wallpaper (most recent first)."""
    cfg: Any = config
    history = _normalize_wallpaper_history(getattr(cfg, "wallpapers_history", []))
    current = getattr(cfg, "wallpaper", None)
    if isinstance(current, str) and current and current not in history:
        history.insert(0, current)
    if new_wallpaper in history:
        history.remove(new_wallpaper)
    history.insert(0, new_wallpaper)
    if len(history) > MAX_WALLPAPER_HISTORY:
        history = history[:MAX_WALLPAPER_HISTORY]
    cfg.wallpapers_history = history


def _disable_legacy_floating_widget(config: DesktopConfig) -> bool:
    """Keep the deprecated floating DesktopWidget disabled in DB-backed config."""
    cfg: Any = config
    if getattr(cfg, "show_widget", False) is False:
        return False
    cfg.show_widget = False
    return True


class DesktopConfigCreate(BaseModel):
    wallpaper: str = Field(default=DEFAULT_DESKTOP_WALLPAPER)
    icon_size: IconSize = IconSize.MEDIUM
    show_widget: bool = False
    widget_position: Position = Field(default_factory=lambda: Position(x=20, y=20))
    theme: Theme = Theme.DARK
    accent_color: str = "purple"
    live_wallpaper: bool = False
    snap_to_grid: bool = True
    grid_step: str = "medium"
    widgets_panel_position: str = "top-right"
    compact_widgets: bool = False
    show_widgets_panel: bool = False


class DesktopConfigUpdate(BaseModel):
    wallpaper: str | None = None
    icon_size: IconSize | None = None
    show_widget: bool | None = None
    widget_position: Position | None = None
    theme: Theme | None = None
    accent_color: str | None = None
    live_wallpaper: bool | None = None
    snap_to_grid: bool | None = None
    grid_step: str | None = None
    widgets_panel_position: str | None = None
    compact_widgets: bool | None = None
    show_widgets_panel: bool | None = None
    wallpapers_history: list[str] | None = None


class DesktopConfigResponse(BaseModel):
    id: UUID
    user_id: UUID
    wallpaper: str
    icon_size: IconSize
    show_widget: bool
    widget_position: dict
    theme: Theme
    accent_color: str = "purple"
    live_wallpaper: bool = False
    snap_to_grid: bool = True
    grid_step: str = "medium"
    widgets_panel_position: str = "top-right"
    compact_widgets: bool = False
    show_widgets_panel: bool = False
    wallpapers_history: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


async def load_desktop_config_response(db: AsyncSession, user_id: UUID) -> DesktopConfigResponse:
    """Create/normalize desktop config + system folders/App Store icon.

    Shared by ``GET /desktop/config`` and ``GET /desktop/shell-bootstrap``.
    """
    result = await db.execute(select(DesktopConfig).where(DesktopConfig.user_id == user_id))
    config = result.scalar_one_or_none()

    if not config:
        default_wallpaper = DEFAULT_DESKTOP_WALLPAPER
        config = DesktopConfig(
            user_id=user_id,
            wallpaper=default_wallpaper,
            icon_size=IconSize.MEDIUM,
            show_widget=False,
            widget_position={"x": 20, "y": 20},
            theme=Theme.DARK,
            widgets_panel_position="top-right",
            compact_widgets=False,
            show_widgets_panel=False,
            wallpapers_history=[default_wallpaper],
        )
        db.add(config)
        try:
            await db.commit()
            await db.refresh(config)
        except IntegrityError:
            await db.rollback()
            result = await db.execute(select(DesktopConfig).where(DesktopConfig.user_id == user_id))
            config = result.scalar_one_or_none()
            if not config:
                raise
    else:
        config_changed = _disable_legacy_floating_widget(config)
        history = _normalize_wallpaper_history(getattr(config, "wallpapers_history", []))
        if not history:
            current = getattr(config, "wallpaper", None)
            if isinstance(current, str) and current:
                history = [current]
        else:
            current = getattr(config, "wallpaper", None)
            if isinstance(current, str) and current and current not in history:
                history.insert(0, current)
        if history != getattr(config, "wallpapers_history", None):
            cfg_hist: Any = config
            cfg_hist.wallpapers_history = history
            config_changed = True
        if config_changed:
            await db.commit()
            await db.refresh(config)

    from api.routers.desktop import (
        ensure_app_store_icon,
        ensure_system_folders,
        reconcile_desktop_app_item_names_from_catalog,
    )

    await ensure_system_folders(db, config)
    await ensure_app_store_icon(db, config)
    await reconcile_desktop_app_item_names_from_catalog(db, config)
    await db.commit()
    await db.refresh(config)
    return DesktopConfigResponse.model_validate(config)


@router.get(
    "/config",
    response_model=DesktopConfigResponse,
    responses={304: {"description": "Not Modified — If-None-Match matched ETag."}},
)
async def get_config(
    request: Request,
    response: Response,
    current_user: AuthUser = Depends(require_oauth2_user),
    user_id: UUID = Depends(_get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Get user's desktop configuration (creates default if not exists)"""
    payload = await load_desktop_config_response(db, user_id)
    etag = _weak_etag_for_pydantic_model(payload)
    response.headers["ETag"] = etag
    if _if_none_match_matches(request.headers.get("if-none-match"), etag):
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": etag})
    return payload


@router.post("/config", response_model=DesktopConfigResponse)
async def create_config(
    data: DesktopConfigCreate,
    current_user: AuthUser = Depends(require_oauth2_user),
    user_id: UUID = Depends(_get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Create user's desktop configuration"""
    # Check if config already exists
    result = await db.execute(select(DesktopConfig).where(DesktopConfig.user_id == user_id))
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Desktop config already exists")

    config = DesktopConfig(
        user_id=user_id,
        wallpaper=data.wallpaper,
        icon_size=data.icon_size,
        show_widget=False,
        widget_position=data.widget_position.model_dump(),
        theme=data.theme,
        accent_color=data.accent_color,
        live_wallpaper=data.live_wallpaper,
        snap_to_grid=data.snap_to_grid,
        grid_step=data.grid_step,
        widgets_panel_position=data.widgets_panel_position,
        compact_widgets=data.compact_widgets,
        show_widgets_panel=data.show_widgets_panel,
    )
    _update_wallpaper_history(config, data.wallpaper)
    db.add(config)
    await db.commit()
    await db.refresh(config)

    return config


@router.patch("/config", response_model=DesktopConfigResponse)
async def update_config(
    data: DesktopConfigUpdate,
    current_user: AuthUser = Depends(require_oauth2_user),
    user_id: UUID = Depends(_get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Update user's desktop configuration"""
    result = await db.execute(select(DesktopConfig).where(DesktopConfig.user_id == user_id))
    config = result.scalar_one_or_none()

    if not config:
        # Create if not exists
        config = DesktopConfig(user_id=user_id)
        db.add(config)

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    new_wallpaper = update_data.get("wallpaper")
    has_explicit_history = "wallpapers_history" in update_data
    for field, value in update_data.items():
        if value is not None:
            if field == "wallpapers_history":
                continue
            if field == "widget_position" and isinstance(value, Position):
                setattr(config, field, value.model_dump())
            else:
                setattr(config, field, value)

    _disable_legacy_floating_widget(config)

    if has_explicit_history:
        raw_hist = update_data.get("wallpapers_history")
        hist = _normalize_wallpaper_history(raw_hist if isinstance(raw_hist, list) else [])
        if len(hist) > MAX_WALLPAPER_HISTORY:
            hist = hist[:MAX_WALLPAPER_HISTORY]
        cfg_patch: Any = config
        cfg_patch.wallpapers_history = hist
        flag_modified(config, "wallpapers_history")
    elif isinstance(new_wallpaper, str):
        _update_wallpaper_history(config, new_wallpaper)
        flag_modified(config, "wallpapers_history")

    await db.commit()
    await db.refresh(config)

    return config


@router.put("/config", response_model=DesktopConfigResponse)
async def replace_config(
    data: DesktopConfigCreate,
    current_user: AuthUser = Depends(require_oauth2_user),
    user_id: UUID = Depends(_get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Replace user's desktop configuration"""
    result = await db.execute(select(DesktopConfig).where(DesktopConfig.user_id == user_id))
    config = result.scalar_one_or_none()

    if not config:
        config = DesktopConfig(user_id=user_id)
        db.add(config)

    cfg_replace: Any = config
    cfg_replace.wallpaper = data.wallpaper
    cfg_replace.icon_size = data.icon_size
    cfg_replace.show_widget = False
    cfg_replace.widget_position = data.widget_position.model_dump()
    cfg_replace.theme = data.theme
    cfg_replace.accent_color = data.accent_color
    cfg_replace.live_wallpaper = data.live_wallpaper
    cfg_replace.snap_to_grid = data.snap_to_grid
    cfg_replace.grid_step = data.grid_step
    cfg_replace.widgets_panel_position = data.widgets_panel_position
    cfg_replace.compact_widgets = data.compact_widgets
    cfg_replace.show_widgets_panel = data.show_widgets_panel
    _update_wallpaper_history(config, data.wallpaper)

    await db.commit()
    await db.refresh(config)

    return config


async def _get_or_create_desktop_config_row(db: AsyncSession, user_id: UUID) -> DesktopConfig:
    result = await db.execute(select(DesktopConfig).where(DesktopConfig.user_id == user_id))
    config = result.scalar_one_or_none()
    if not config:
        default_wallpaper = DEFAULT_DESKTOP_WALLPAPER
        config = DesktopConfig(
            user_id=user_id,
            wallpaper=default_wallpaper,
            wallpapers_history=[default_wallpaper],
        )
        db.add(config)
        try:
            await db.commit()
            await db.refresh(config)
        except IntegrityError:
            await db.rollback()
            result = await db.execute(select(DesktopConfig).where(DesktopConfig.user_id == user_id))
            config = result.scalar_one_or_none()
            if not config:
                raise
    return config
