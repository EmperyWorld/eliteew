#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   🎨🔥 THEMES API ROUTER 🔥🎨
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
🎨🔥 THEMES API ROUTER 🔥🎨
User theme customization endpoints with full CRUD operations
"""

import json
import logging
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status  # type: ignore[import-untyped]
from pydantic import BaseModel, Field, JsonValue, field_validator  # type: ignore[import-untyped]
from sqlalchemy import select, update  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user as get_current_user
from api.models.database_models import User
from api.models.user_theme import UserTheme

logger = logging.getLogger(__name__)

# ==================== PYDANTIC SCHEMAS ====================


class ThemeColors(BaseModel):
    """Theme color palette"""

    primary: str = Field(..., description="Primary color (hex)")
    secondary: str = Field(..., description="Secondary color (hex)")
    accent: str = Field(..., description="Accent color (hex)")
    background: str = Field(..., description="Background color or gradient")
    surface: str = Field(..., description="Surface color (hex)")
    text: str = Field(..., description="Text color (hex)")
    textSecondary: str = Field(..., description="Secondary text color (hex)")
    border: str = Field(..., description="Border color (rgba)")
    success: str = Field(default="#22c55e", description="Success color")
    warning: str = Field(default="#f59e0b", description="Warning color")
    error: str = Field(default="#ef4444", description="Error color")
    info: str | None = Field(default="#3b82f6", description="Info color")


class ThemeGradients(BaseModel):
    """Theme gradients (Tailwind classes)"""

    primary: str = Field(..., description="Primary gradient")
    secondary: str = Field(..., description="Secondary gradient")
    background: str = Field(..., description="Background gradient")
    button: str = Field(..., description="Button gradient")
    card: str = Field(..., description="Card gradient")
    accent: str | None = Field(default="from-green-500 to-emerald-600")
    glow: str | None = Field(default=None)


class ThemeEffects(BaseModel):
    """Theme visual effects"""

    blur: int = Field(default=12, ge=0, le=24, description="Backdrop blur in px")
    shadows: bool = Field(default=True, description="Enable shadows")
    shadowIntensity: float = Field(default=0.5, ge=0, le=1, description="Shadow intensity")
    glow: bool = Field(default=True, description="Enable glow effects")
    glowIntensity: float = Field(default=0.5, ge=0, le=1, description="Glow intensity")
    borderOpacity: float = Field(default=0.2, ge=0, le=1, description="Border opacity")
    surfaceOpacity: float = Field(default=0.4, ge=0, le=1, description="Surface opacity")
    glassmorphism: bool | None = Field(default=True)
    particles: bool | None = Field(default=False)


class ThemeTypography(BaseModel):
    """Theme typography settings"""

    fontFamily: str = Field(default="Inter, system-ui, -apple-system, sans-serif")
    fontSize: int = Field(default=16, ge=12, le=24, description="Base font size in px")
    fontWeight: int = Field(default=400, ge=100, le=900, description="Font weight")
    lineHeight: float = Field(default=1.5, ge=1.0, le=2.0, description="Line height")
    headingWeight: int | None = Field(default=700, ge=100, le=900)


class ThemeSpacing(BaseModel):
    """Theme spacing scale"""

    scale: float = Field(default=1.0, ge=0.5, le=2.0, description="Spacing scale multiplier")
    cardPadding: int = Field(default=24, ge=8, le=48, description="Card padding in px")
    buttonPadding: int = Field(default=16, ge=8, le=32, description="Button padding in px")
    sectionGap: int | None = Field(default=32, ge=8, le=64)
    elementGap: int | None = Field(default=16, ge=4, le=32)


class ThemeBorders(BaseModel):
    """Theme border styles"""

    radius: int = Field(default=12, ge=0, le=24, description="Border radius in px")
    width: int = Field(default=1, ge=0, le=4, description="Border width in px")
    style: str = Field(default="solid", description="Border style")
    cardRadius: int | None = Field(default=16, ge=0, le=32)
    buttonRadius: int | None = Field(default=10, ge=0, le=24)
    inputRadius: int | None = Field(default=8, ge=0, le=16)

    @field_validator("style")
    @classmethod
    def validate_style(cls, v: str) -> str:
        allowed = ["solid", "dashed", "dotted", "none"]
        if v not in allowed:
            msg = f"Border style must be one of: {allowed}"
            raise ValueError(msg)
        return v


class ThemeAnimation(BaseModel):
    """Theme animation settings"""

    duration: int = Field(default=200, ge=0, le=1000, description="Animation duration in ms")
    easing: str = Field(default="ease-in-out", description="Animation easing function")
    hoverScale: float | None = Field(default=1.02, ge=1.0, le=1.1)
    activeScale: float | None = Field(default=0.98, ge=0.9, le=1.0)

    @field_validator("easing")
    @classmethod
    def validate_easing(cls, v: str) -> str:
        allowed = ["ease", "ease-in", "ease-out", "ease-in-out", "linear"]
        if v not in allowed:
            msg = f"Easing must be one of: {allowed}"
            raise ValueError(msg)
        return v


class ThemeMetadata(BaseModel):
    """Theme metadata"""

    author: str | None = Field(default="User")
    version: str | None = Field(default="1.0.0")
    category: str | None = Field(default="Custom")
    tags: list[str] | None = Field(default_factory=list)


class ThemeData(BaseModel):
    """Complete theme data structure"""

    id: str = Field(..., description="Theme ID")
    name: str = Field(..., min_length=1, max_length=100, description="Theme name")
    type: str = Field(..., description="Theme type: preset or custom")
    description: str | None = Field(default="", max_length=500)
    colors: ThemeColors
    gradients: ThemeGradients
    effects: ThemeEffects
    typography: ThemeTypography
    spacing: ThemeSpacing
    borders: ThemeBorders
    animation: ThemeAnimation
    metadata: ThemeMetadata | None = Field(default_factory=ThemeMetadata)

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ["preset", "custom"]:
            msg = "Theme type must be 'preset' or 'custom'"
            raise ValueError(msg)
        return v


class ThemeCreateRequest(BaseModel):
    """Request body for creating a custom theme"""

    theme_data: ThemeData


class ThemeUpdateRequest(BaseModel):
    """Request body for updating a theme"""

    theme_data: ThemeData


class ApplyPresetRequest(BaseModel):
    """Request body for applying a preset theme"""

    preset_id: str = Field(..., description="Preset theme ID (preset-rich or preset-minimalist)")


class ThemeResponse(BaseModel):
    """Response schema for single theme"""

    id: str
    user_id: str | None = None
    theme_data: dict[str, Any]
    is_active: bool
    created_at: str | None = None
    updated_at: str | None = None


class ThemesListResponse(BaseModel):
    """Response schema for list of themes"""

    themes: list[dict[str, Any]]
    active_theme: dict[str, Any] | None = None


class ThemePresetsOut(BaseModel):
    """GET /presets — public preset catalogue."""

    presets: list[ThemeDataMap] = Field(default_factory=list)
    count: int = Field(ge=0)


class ThemeActiveOut(BaseModel):
    """GET /active — active theme or default preset."""

    theme: ThemeDataMap = Field(default_factory=dict)
    is_default: bool = False


class ThemeCreateOut(BaseModel):
    """POST /create — custom theme created."""

    success: bool = True
    theme: ThemeDataMap = Field(default_factory=dict)
    id: str
    message: str


class ThemeMutationOut(BaseModel):
    """Activate / update / apply-preset success shell."""

    success: bool = True
    theme: ThemeDataMap = Field(default_factory=dict)
    message: str


class ThemeDeleteOut(BaseModel):
    """DELETE /{theme_id}."""

    success: bool = True
    message: str


class ThemeStatsOut(BaseModel):
    """GET /stats — per-user theme counters."""

    total_themes: int = Field(ge=0)
    custom_themes: int = Field(ge=0)
    active_theme_name: str | None = None
    available_presets: int = Field(ge=0)
    preset_names: list[str] = Field(default_factory=list)


# ==================== ROUTER ====================

router = APIRouter(prefix="/api/v1/themes", tags=["themes"])

# Load preset themes
PRESET_THEMES_PATH = Path(__file__).parent.parent / "data" / "preset_themes.json"


def load_preset_themes() -> list[dict[str, Any]]:
    """Load preset themes from JSON file"""
    try:
        if not PRESET_THEMES_PATH.exists():
            logger.warning("Preset themes file not found: %s - using empty list", PRESET_THEMES_PATH)
            return []
        with open(PRESET_THEMES_PATH, encoding="utf-8") as f:
            data = json.load(f)
            return data.get("presets", [])
    except FileNotFoundError:
        logger.warning("Preset themes file not found: %s - using empty list", PRESET_THEMES_PATH)
        return []
    except (json.JSONDecodeError, ValueError) as e:
        logger.exception("Failed to parse preset themes JSON: %s", e)
        return []
    except Exception as e:
        logger.exception("Failed to load preset themes: %s", e)
        return []


PRESET_THEMES = load_preset_themes()

ThemeDataMap = dict[str, JsonValue]


# ==================== ENDPOINTS ====================


@router.get("/presets", response_model=ThemePresetsOut)
async def get_preset_themes() -> ThemePresetsOut:
    """
    Get all preset themes (Rich + Minimalist)
    No authentication required - public endpoint
    """
    return ThemePresetsOut.model_validate({"presets": PRESET_THEMES, "count": len(PRESET_THEMES)})


@router.get("/my", response_model=ThemesListResponse)
async def get_my_themes(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_postgres_session)
) -> ThemesListResponse:
    """
    Get all themes for the current user
    Returns list of themes and the currently active theme
    """
    try:
        # Query all user themes
        stmt = select(UserTheme).where(UserTheme.user_id == current_user.id).order_by(UserTheme.created_at.desc())
        result = await db.execute(stmt)
        themes = result.scalars().all()

        # Find active theme
        # SQLAlchemy: t.is_active is bool value at runtime, not Column[bool]
        active_theme = next((t.theme_data for t in themes if bool(t.is_active)), None)  # type: ignore[arg-type]

        return ThemesListResponse.model_validate(
            {"themes": [t.theme_data for t in themes], "active_theme": active_theme}
        )

    except Exception as e:
        logger.exception("Failed to get user themes")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve themes: {e!s}",
        ) from e


@router.get("/active", response_model=ThemeActiveOut)
async def get_active_theme(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_postgres_session)
) -> ThemeActiveOut:
    """
    Get the currently active theme for the user
    If no active theme, returns default Rich preset
    """
    try:
        # Safety check for current_user
        # SQLAlchemy: current_user.id is UUID value at runtime, not Column[UUID]
        if not current_user or not hasattr(current_user, "id") or current_user.id is None:  # type: ignore[comparison-overlap]
            # Return default theme if user not authenticated properly
            default_theme = next(
                (t for t in PRESET_THEMES if t["id"] == "preset-rich"),
                PRESET_THEMES[0] if PRESET_THEMES else {},
            )
            return ThemeActiveOut.model_validate({"theme": default_theme, "is_default": True})

        stmt = select(UserTheme).where(UserTheme.user_id == current_user.id, UserTheme.is_active)
        result = await db.execute(stmt)
        theme = result.scalar_one_or_none()

        if not theme:
            # Return default Rich theme
            default_theme = next(
                (t for t in PRESET_THEMES if t["id"] == "preset-rich"),
                PRESET_THEMES[0] if PRESET_THEMES else {},
            )
            return ThemeActiveOut.model_validate({"theme": default_theme, "is_default": True})

        return ThemeActiveOut.model_validate({"theme": theme.theme_data, "is_default": False})

    except Exception as e:
        logger.exception("Failed to get active theme")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve active theme: {e!s}",
        ) from e


@router.post("/create", response_model=ThemeCreateOut, status_code=status.HTTP_201_CREATED)
async def create_custom_theme(
    request: ThemeCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ThemeCreateOut:
    """
    Create a new custom theme for the user
    Theme is created as inactive by default
    """
    try:
        # Convert Pydantic model to dict
        theme_dict = request.theme_data.model_dump()

        # Ensure type is custom
        theme_dict["type"] = "custom"

        # Create new theme
        new_theme = UserTheme(user_id=current_user.id, theme_data=theme_dict, is_active=False)

        db.add(new_theme)
        await db.commit()
        await db.refresh(new_theme)

        logger.info("User %s created custom theme: %s", current_user.id, theme_dict.get("name"))

        return ThemeCreateOut.model_validate(
            {
                "success": True,
                "theme": new_theme.theme_data,
                "id": str(new_theme.id),
                "message": "Custom theme created successfully",
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid theme data: {e!s}") from e
    except Exception as e:
        logger.exception("Failed to create theme")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create theme: {e!s}",
        ) from e


@router.put("/{theme_id}/activate", response_model=ThemeMutationOut)
async def activate_theme(
    theme_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ThemeMutationOut:
    """
    Activate a theme for the user
    Deactivates all other themes automatically
    """
    try:
        # Deactivate all user themes
        stmt = update(UserTheme).where(UserTheme.user_id == current_user.id).values(is_active=False)
        await db.execute(stmt)

        # Activate selected theme
        stmt = select(UserTheme).where(UserTheme.id == theme_id, UserTheme.user_id == current_user.id)
        result = await db.execute(stmt)
        theme = result.scalar_one_or_none()

        if not theme:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Theme not found or does not belong to user",
            )

        # SQLAlchemy: присваивание bool к Column[bool] работает в runtime
        theme.is_active = True  # type: ignore[assignment]
        await db.commit()
        await db.refresh(theme)

        logger.info("User %s activated theme: %s", current_user.id, theme.theme_data.get("name"))

        return ThemeMutationOut.model_validate(
            {
                "success": True,
                "theme": theme.theme_data,
                "message": "Theme activated successfully",
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to activate theme")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to activate theme: {e!s}",
        ) from e


@router.put("/{theme_id}", response_model=ThemeMutationOut)
async def update_theme(
    theme_id: UUID,
    request: ThemeUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ThemeMutationOut:
    """
    Update an existing custom theme
    Cannot update preset themes
    """
    try:
        stmt = select(UserTheme).where(UserTheme.id == theme_id, UserTheme.user_id == current_user.id)
        result = await db.execute(stmt)
        theme = result.scalar_one_or_none()

        if not theme:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Theme not found or does not belong to user",
            )

        # Prevent updating preset themes
        if theme.theme_data.get("type") == "preset":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot update preset themes. Create a custom theme instead.",
            )

        # Update theme data
        theme_dict = request.theme_data.model_dump()
        # SQLAlchemy: присваивание dict к Column[Any] работает в runtime
        theme.theme_data = theme_dict  # type: ignore[assignment]

        await db.commit()
        await db.refresh(theme)

        logger.info("User %s updated theme: %s", current_user.id, theme_dict.get("name"))

        return ThemeMutationOut.model_validate(
            {"success": True, "theme": theme.theme_data, "message": "Theme updated successfully"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update theme")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update theme: {e!s}",
        ) from e


@router.delete("/{theme_id}", response_model=ThemeDeleteOut)
async def delete_theme(
    theme_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ThemeDeleteOut:
    """
    Delete a custom theme
    Cannot delete preset themes or active themes
    """
    try:
        stmt = select(UserTheme).where(UserTheme.id == theme_id, UserTheme.user_id == current_user.id)
        result = await db.execute(stmt)
        theme = result.scalar_one_or_none()

        if not theme:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Theme not found or does not belong to user",
            )

        # Prevent deleting active theme
        # SQLAlchemy: theme.is_active is bool value at runtime, not Column[bool]
        if bool(theme.is_active):  # type: ignore[arg-type]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete active theme. Activate another theme first.",
            )

        # Prevent deleting preset themes
        if theme.theme_data.get("type") == "preset":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete preset themes")

        theme_name = theme.theme_data.get("name", "Unknown")
        await db.delete(theme)
        await db.commit()

        logger.info("User %s deleted theme: %s", current_user.id, theme_name)

        return ThemeDeleteOut.model_validate({"success": True, "message": f"Theme '{theme_name}' deleted successfully"})

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete theme")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete theme: {e!s}",
        ) from e


@router.post("/apply-preset", response_model=ThemeMutationOut)
async def apply_preset_theme(
    request: ApplyPresetRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ThemeMutationOut:
    """
    Apply a preset theme to user account
    Creates a copy of the preset as a custom theme and activates it
    """
    try:
        # Find preset
        preset = next((t for t in PRESET_THEMES if t["id"] == request.preset_id), None)

        if not preset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Preset theme '{request.preset_id}' not found",
            )

        # Deactivate all user themes
        stmt = update(UserTheme).where(UserTheme.user_id == current_user.id).values(is_active=False)
        await db.execute(stmt)

        # Create copy of preset as custom theme
        new_theme = UserTheme(user_id=current_user.id, theme_data=preset, is_active=True)

        db.add(new_theme)
        await db.commit()
        await db.refresh(new_theme)

        logger.info("User %s applied preset theme: %s", current_user.id, preset["name"])

        return ThemeMutationOut.model_validate(
            {
                "success": True,
                "theme": preset,
                "message": f"Preset theme '{preset['name']}' applied successfully",
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to apply preset")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply preset theme: {e!s}",
        ) from e


@router.get("/stats", response_model=ThemeStatsOut)
async def get_theme_stats(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_postgres_session)
) -> ThemeStatsOut:
    """
    Get theme statistics for the current user
    """
    try:
        stmt = select(UserTheme).where(UserTheme.user_id == current_user.id)
        result = await db.execute(stmt)
        themes = result.scalars().all()

        # SQLAlchemy: t.is_active is bool value at runtime, not Column[bool]
        active_theme = next((t for t in themes if bool(t.is_active)), None)  # type: ignore[arg-type]

        return ThemeStatsOut.model_validate(
            {
                "total_themes": len(themes),
                "custom_themes": sum(1 for t in themes if t.theme_data.get("type") == "custom"),
                "active_theme_name": active_theme.theme_data.get("name") if active_theme else None,
                "available_presets": len(PRESET_THEMES),
                "preset_names": [p["name"] for p in PRESET_THEMES],
            }
        )

    except Exception as e:
        logger.exception("Failed to get theme stats")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve theme statistics: {e!s}",
        ) from e
