# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Typed maintenance-window contract shared by API routers, middleware, deploy scripts, and frontend clients.
# Invariants:
# - User-facing text must not expose internal container names or stack topology.
# - `Retry-After` is always derived from the active window, never guessed by clients.
# Related:
# - api/services/maintenance_service.py
# - documentation/platform/USER-SAFE-RESTARTS-AND-MAINTENANCE.md
# ---
"""Maintenance-window schemas for planned restart UX."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class MaintenancePhase(StrEnum):
    """Lifecycle phase for a user-visible maintenance window."""

    SCHEDULED = "scheduled"
    WARNING = "warning"
    DRAINING = "draining"
    ACTIVE = "active"
    RECOVERING = "recovering"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class MaintenanceKind(StrEnum):
    """Known maintenance families."""

    STACK0_RESTART = "stack0_restart"
    FRONTEND_DEPLOY = "frontend_deploy"
    API_RESTART = "api_restart"
    WORKERS_RESTART = "workers_restart"
    FULL_MAINTENANCE = "full_maintenance"
    EMERGENCY = "emergency"


MAINTENANCE_ACTIVE_PHASES: frozenset[MaintenancePhase] = frozenset(
    {
        MaintenancePhase.SCHEDULED,
        MaintenancePhase.WARNING,
        MaintenancePhase.DRAINING,
        MaintenancePhase.ACTIVE,
        MaintenancePhase.RECOVERING,
    }
)

MAINTENANCE_GATE_PHASES: frozenset[MaintenancePhase] = frozenset(
    {
        MaintenancePhase.DRAINING,
        MaintenancePhase.ACTIVE,
    }
)


class MaintenanceWindow(BaseModel):
    """Canonical maintenance window sent to browsers and deploy tooling."""

    id: str = Field(..., min_length=1, max_length=128)
    kind: MaintenanceKind = MaintenanceKind.STACK0_RESTART
    phase: MaintenancePhase = MaintenancePhase.SCHEDULED
    active: bool = True
    starts_at: datetime | None = None
    expected_ends_at: datetime | None = None
    notice_before_seconds: int = Field(default=300, ge=0, le=86_400)
    retry_after_seconds: int = Field(default=60, ge=1, le=86_400)
    title: str = Field(default="EliteEW обновляет среду", max_length=160)
    message: str = Field(
        default="Безраздельный мир временно на технической паузе. Данные, окна и раскладка сохранены.",
        max_length=600,
    )
    affected_services: list[str] = Field(default_factory=list)
    user_impact: str = Field(
        default="Страница вернётся после восстановления автоматически; ручная проверка доступна через минуту.",
        max_length=600,
    )
    suppress_error_toasts: bool = True
    block_new_long_jobs: bool = True
    allow_operator_bypass: bool = False
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    source: str | None = Field(default=None, max_length=64)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("title", "message", "user_impact")
    @classmethod
    def _strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("affected_services")
    @classmethod
    def _strip_services(cls, value: list[str]) -> list[str]:
        return [item.strip() for item in value if item.strip()]

    @property
    def is_effective(self) -> bool:
        """True when the window should still be shown to clients."""
        return self.active and self.phase in MAINTENANCE_ACTIVE_PHASES

    @property
    def gates_api(self) -> bool:
        """True when protected API calls should receive maintenance 503."""
        return self.active and self.phase in MAINTENANCE_GATE_PHASES


class MaintenanceStatus(BaseModel):
    """Public status response."""

    active: bool
    window: MaintenanceWindow | None = None


class MaintenanceWindowUpsert(BaseModel):
    """Admin request body for creating/updating a maintenance window."""

    id: str | None = Field(default=None, max_length=128)
    kind: MaintenanceKind = MaintenanceKind.STACK0_RESTART
    phase: MaintenancePhase = MaintenancePhase.SCHEDULED
    starts_at: datetime | None = None
    expected_ends_at: datetime | None = None
    notice_before_seconds: int = Field(default=300, ge=0, le=86_400)
    retry_after_seconds: int = Field(default=60, ge=1, le=86_400)
    title: str = Field(default="EliteEW обновляет среду", max_length=160)
    message: str = Field(
        default="Безраздельный мир временно на технической паузе. Данные, окна и раскладка сохранены.",
        max_length=600,
    )
    affected_services: list[str] = Field(default_factory=list)
    user_impact: str = Field(
        default="Страница вернётся после восстановления автоматически; ручная проверка доступна через минуту.",
        max_length=600,
    )
    suppress_error_toasts: bool = True
    block_new_long_jobs: bool = True
    allow_operator_bypass: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


_DEFAULT_MESSAGE_TEMPLATE = (
    "Через {notice_minutes} мин, с {starts_at_local} до {ends_at_local} "
    "(~{downtime_minutes} мин), Безраздельный мир будет на паузе. "
    "Данные и раскладка сохранены."
)
_DEFAULT_IMPACT_TEMPLATE = (
    "Оставьте вкладку открытой: с {starts_at_local} до {ends_at_local} "
    "сервис кратко недоступен, затем восстановится автоматически."
)


class MaintenanceDeployDefaults(BaseModel):
    """Admin-editable defaults for automatic stack0 release maintenance."""

    notice_before_seconds: int = Field(default=600, ge=0, le=86_400)
    expected_downtime_seconds: int = Field(default=120, ge=30, le=86_400)
    title: str = Field(default="EliteEW обновляет среду", max_length=160)
    message_template: str = Field(default=_DEFAULT_MESSAGE_TEMPLATE, max_length=800)
    user_impact_template: str = Field(default=_DEFAULT_IMPACT_TEMPLATE, max_length=800)
    updated_at: datetime | None = None
    updated_by: str | None = Field(default=None, max_length=128)

    @field_validator("title", "message_template", "user_impact_template")
    @classmethod
    def _strip_defaults_text(cls, value: str) -> str:
        return value.strip()


class MaintenanceDeployDefaultsUpdate(BaseModel):
    """Partial admin update for deploy maintenance defaults."""

    notice_before_seconds: int | None = Field(default=None, ge=0, le=86_400)
    expected_downtime_seconds: int | None = Field(default=None, ge=30, le=86_400)
    title: str | None = Field(default=None, max_length=160)
    message_template: str | None = Field(default=None, max_length=800)
    user_impact_template: str | None = Field(default=None, max_length=800)

    @field_validator("title", "message_template", "user_impact_template")
    @classmethod
    def _strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()
