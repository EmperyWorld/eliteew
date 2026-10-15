# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract models (Pydantic) для API плавающих виджетов: конфиг иконки, данных, расположения и т.д.
# Invariants:
# - Контуры валидации — через Pydantic v2 (`Field`), не SQLAlchemy.
# Related:
# - Клиенты HTTP API floating widgets во фронтенде.
# ---

"""
Pydantic request/response-shaped models для Floating Widgets API.
"""

from datetime import datetime  # noqa: I001
from typing import Any

from pydantic import BaseModel, ConfigDict, Field  # type: ignore[import-untyped]


# ============================================================================
# ICON CONFIGURATION MODELS
# ============================================================================


class FloatingWidgetIconConfig(BaseModel):
    """Icon configuration for floating widget"""

    icon_type: str = Field(default="default", description="Type of icon: 'default', 'custom', 'emoji', 'image'")
    icon_name: str | None = Field(default=None, description="Icon name from lucide-react or custom identifier")
    icon_size: int = Field(default=24, ge=16, le=48, description="Icon size in pixels: 16, 20, 24, 32, or 48")
    icon_color: str | None = Field(default=None, description="Icon color (hex code or tailwind class)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"icon_type": "default", "icon_name": "Sparkles", "icon_size": 24, "icon_color": "#6366f1"}
        }
    )


# ============================================================================
# DATA CONFIGURATION MODELS
# ============================================================================


class FloatingWidgetDataConfig(BaseModel):
    """Data source configuration for floating widget"""

    data_type: str = Field(default="default", description="Type of data source: 'default', 'custom', 'api', 'static'")
    data_source: str | None = Field(default=None, description="URL for API endpoint or path to data")
    data_config: dict[str, Any] = Field(default_factory=dict, description="Additional data configuration")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "data_type": "api",
                "data_source": "https://api.example.com/data",
                "data_config": {"method": "GET", "refreshInterval": 60000},
            }
        }
    )


# ============================================================================
# DISPLAY CONFIGURATION MODELS
# ============================================================================


class FloatingWidgetDisplayConfig(BaseModel):
    """Display configuration for floating widget"""

    display_mode: str = Field(default="collapsed", description="Default display mode: 'collapsed', 'mini', 'expanded'")
    size_config: dict[str, Any] = Field(
        default_factory=dict, description="Size configuration for different display modes"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "display_mode": "collapsed",
                "size_config": {
                    "collapsed": {"width": 64, "height": 64},
                    "mini": {"width": 400, "height": 300},
                    "expanded": {"width": 600, "height": 500},
                },
            }
        }
    )


# ============================================================================
# WIDGET MODELS
# ============================================================================


class FloatingWidgetBase(BaseModel):
    """Base floating widget model"""

    widget_type: str = Field(..., description="Type of widget (from templates)")
    widget_key: str = Field(..., description="Unique key for widget instance")
    title: str | None = Field(None, description="Custom widget title")
    position_x: int | None = Field(None, ge=0, description="X position (null = default)")
    position_y: int | None = Field(None, ge=0, description="Y position (null = default)")
    is_collapsed: bool = Field(default=True, description="Is widget collapsed")
    is_visible: bool = Field(default=True, description="Is widget visible")
    icon_config: FloatingWidgetIconConfig = Field(
        default_factory=FloatingWidgetIconConfig, description="Icon configuration"
    )
    data_config: FloatingWidgetDataConfig = Field(
        default_factory=FloatingWidgetDataConfig, description="Data source configuration"
    )
    display_config: FloatingWidgetDisplayConfig = Field(
        default_factory=FloatingWidgetDisplayConfig, description="Display configuration"
    )
    settings: dict[str, Any] = Field(default_factory=dict, description="Widget-specific settings")


class FloatingWidgetCreate(FloatingWidgetBase):
    """Create floating widget request"""


class FloatingWidgetUpdate(BaseModel):
    """Update floating widget request (partial)"""

    title: str | None = None
    position_x: int | None = Field(None, ge=0)
    position_y: int | None = Field(None, ge=0)
    is_collapsed: bool | None = None
    is_visible: bool | None = None
    icon_config: FloatingWidgetIconConfig | None = None
    data_config: FloatingWidgetDataConfig | None = None
    display_config: FloatingWidgetDisplayConfig | None = None
    settings: dict[str, Any] | None = None


class FloatingWidgetResponse(FloatingWidgetBase):
    """Floating widget response model"""

    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# TEMPLATE MODELS
# ============================================================================


class FloatingWidgetTemplateResponse(BaseModel):
    """Widget template response model"""

    id: str
    widget_type: str
    name: str
    description: str | None
    category: str
    default_icon_type: str
    default_icon_name: str | None
    default_icon_size: int
    default_icon_color: str | None
    default_data_type: str
    default_data_source: str | None
    default_data_config: dict[str, Any]
    default_display_mode: str
    default_size_config: dict[str, Any]
    available_icon_types: list[str]
    available_icon_sizes: list[int]
    available_data_types: list[str]
    available_display_modes: list[str]
    is_system: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CreateWidgetFromTemplateRequest(BaseModel):
    """Request to create widget from template"""

    widget_type: str = Field(..., description="Template widget type")
    widget_key: str = Field(..., description="Unique key for widget instance")
    title: str | None = Field(None, description="Custom title")
    icon_config: FloatingWidgetIconConfig | None = Field(None, description="Override default icon config")
    data_config: FloatingWidgetDataConfig | None = Field(None, description="Override default data config")
    display_config: FloatingWidgetDisplayConfig | None = Field(None, description="Override default display config")
    settings: dict[str, Any] | None = Field(None, description="Additional widget settings")
