"""Pydantic models for marketing overview interactive dashboard (layouts, widgets, presets)."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field  # type: ignore[import-untyped]


class DashboardLayoutType(StrEnum):
    preset = "preset"
    custom = "custom"


class GridPosition(BaseModel):
    """react-grid-layout position; extra keys allowed."""

    model_config = ConfigDict(extra="allow")

    x: int = 0
    y: int = 0
    w: int = 1
    h: int = 1
    minW: int | None = None
    minH: int | None = None
    maxW: int | None = None
    maxH: int | None = None
    i: str | None = None


class DashboardLayoutCreate(BaseModel):
    project_id: UUID | None = None
    name: str = Field(..., min_length=1)
    type: DashboardLayoutType = DashboardLayoutType.custom
    description: str | None = None
    layout_config: dict[str, Any] = Field(default_factory=dict)
    settings: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = False

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"name": "Custom board", "type": "custom", "is_active": True},
                {
                    "name": "Blank",
                    "layout_config": {"cols": 12},
                    "settings": {"theme": "default"},
                },
            ]
        }
    )


class DashboardLayoutUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    description: str | None = None
    layout_config: dict[str, Any] | None = None
    #: Если True и ``layout_config`` задан — поверхностное слияние с текущим JSON в БД (I.93).
    layout_config_merge: bool = False
    settings: dict[str, Any] | None = None
    is_active: bool | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"name": "Q2 overview"},
                {
                    "layout_config": {"compactMode": True},
                    "layout_config_merge": True,
                },
            ]
        }
    )


class WidgetCreate(BaseModel):
    layout_id: UUID
    widget_key: str = Field(..., min_length=1)
    widget_title: str = Field(..., min_length=1)
    widget_config: dict[str, Any] = Field(default_factory=dict)
    grid_position: GridPosition = Field(default_factory=GridPosition)
    is_visible: bool = True
    is_locked: bool = False
    display_order: int = 0

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "layout_id": "00000000-0000-4000-8000-000000000001",
                    "widget_key": "tasks",
                    "widget_title": "Задачи",
                    "widget_config": {"maxItems": 8, "density": "compact"},
                    "grid_position": {"x": 0, "y": 0, "w": 4, "h": 5, "minW": 3, "minH": 3},
                }
            ]
        }
    )


class WidgetUpdate(BaseModel):
    widget_title: str | None = Field(default=None, min_length=1)
    widget_config: dict[str, Any] | None = None
    grid_position: GridPosition | None = None
    is_visible: bool | None = None
    is_locked: bool | None = None
    display_order: int | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"is_locked": True},
                {
                    "widget_config": {"maxItems": 12},
                    "grid_position": {"x": 2, "y": 0, "w": 4, "h": 5},
                },
            ]
        }
    )


class WidgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    layout_id: UUID
    widget_key: str
    widget_title: str
    widget_config: dict[str, Any]
    grid_position: GridPosition
    is_visible: bool
    is_locked: bool
    display_order: int
    created_at: datetime
    updated_at: datetime


class DashboardLayoutResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    project_id: UUID | None
    name: str
    type: str
    description: str | None
    layout_config: dict[str, Any]
    settings: dict[str, Any]
    is_active: bool
    is_default: bool
    created_at: datetime
    updated_at: datetime
    last_accessed_at: datetime | None
    widgets: list[WidgetResponse] = Field(default_factory=list)


class DashboardLayoutListResponse(BaseModel):
    success: bool = True
    data: list[DashboardLayoutResponse]
    total: int
    page: int
    per_page: int


class DashboardActivateResponse(BaseModel):
    success: bool = True
    message: str
    layout_id: UUID
    previous_active_id: UUID | None = None


class DashboardCloneResponse(BaseModel):
    success: bool = True
    message: str
    new_layout_id: UUID
    widget_count: int


class DashboardCleanupDuplicatesResponse(BaseModel):
    success: bool = True
    deleted_count: int
    message: str


class DashboardUsageStats(BaseModel):
    total_layouts: int = 0
    preset_layouts: int = 0
    custom_layouts: int = 0
    total_widgets: int = 0
    visible_widgets: int = 0
    unique_widget_types: int = 0
    last_dashboard_access: datetime | None = None
    # MARKETING_DASHBOARD_MAX_WIDGETS_PER_LAYOUT — echoed for dashboard UI (add-widget cap).
    max_widgets_per_layout: int = 60
    #: MARKETING_DASHBOARD_DISABLED_WIDGET_KEYS — скрыть ключи в селекторе «Добавить виджет».
    disabled_widget_keys: list[str] = Field(default_factory=list)


class MarketingDashboardPresetOut(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: UUID
    name: str
    display_name: str
    description: str | None = None
    category: str
    template_config: dict[str, Any] = Field(default_factory=dict)
    usage_count: int = 0
    version: int = 1
    created_at: datetime
    updated_at: datetime


class MarketingDashboardPresetListResponse(BaseModel):
    items: list[MarketingDashboardPresetOut]


class CreateLayoutFromPresetBody(BaseModel):
    preset_name: str = Field(..., min_length=1)
    custom_name: str | None = Field(default=None, min_length=1)
    #: If True and a preset-derived layout with the same resolved name already exists, replace its
    #: widgets and layout metadata from the current preset template in DB (B.18).
    rebuild_existing: bool = False

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"preset_name": "minimal"},
                {"preset_name": "all_widgets_showcase", "rebuild_existing": True},
            ]
        }
    )


class DashboardLayoutImportEnvelope(BaseModel):
    """Same JSON shape as the frontend export (OverviewInteractiveDashboard)."""

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "examples": [
                {
                    "_exportSchemaVersion": 1,
                    "layout": {
                        "name": "Imported",
                        "type": "custom",
                        "layout_config": {"widgets": []},
                        "widgets": [],
                    },
                }
            ]
        },
    )

    export_schema_version: int = Field(alias="_exportSchemaVersion")
    layout: dict[str, Any]
    exported_at: str | None = Field(default=None, alias="exportedAt")


class CloneDashboardLayoutBody(BaseModel):
    new_name: str = Field(..., min_length=1)

    model_config = ConfigDict(json_schema_extra={"examples": [{"new_name": "Q2 copy"}]})


class SaveDashboardLayoutTemplateBody(BaseModel):
    """Save the project's active dashboard layout as a user-scoped template (``project_id`` NULL)."""

    name: str = Field(..., min_length=1)
    description: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"name": "My GTM board", "description": "Saved from project X"},
            ]
        }
    )


class ApplyDashboardLayoutTemplateBody(BaseModel):
    """Apply a user template to the project in the URL path (new active custom layout)."""

    template_layout_id: UUID

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"template_layout_id": "00000000-0000-4000-8000-0000000000ab"},
            ]
        }
    )
