#!/usr/bin/env python3
"""
📁💼 PROJECT SCHEMAS - Pydantic models for Company, Project, ProjectMember
Created: 2025-10-15
Purpose: Request/response validation for project management API
"""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator  # type: ignore[import-untyped]

# ========================================
# 🏢 COMPANY SCHEMAS
# ========================================


class CompanyBase(BaseModel):
    """Base company schema with common fields"""

    name: str = Field(..., min_length=2, max_length=255, description="Название компании")
    slug: str = Field(..., min_length=2, max_length=255, description="URL-friendly идентификатор")
    industry: str | None = Field(None, max_length=100, description="Отрасль")
    size: str | None = Field(None, description="Размер компании (startup/solo, small, medium, large, enterprise)")
    country: str | None = Field(None, max_length=100, description="Страна")
    timezone: str | None = Field(None, max_length=100, description="Временная зона")
    website: str | None = Field(None, max_length=500, description="Веб-сайт")
    description: str | None = Field(None, description="Описание компании")

    @field_validator("size")
    @classmethod
    def validate_size(cls, v: str | None) -> str | None:
        allowed = ["startup", "solo", "small", "medium", "large", "enterprise"]
        if v is not None and v not in allowed:
            msg = "Размер должен быть: startup/solo, small, medium, large, enterprise"
            raise ValueError(msg)
        return v

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not v.replace("-", "").replace("_", "").isalnum():
            msg = "Slug должен содержать только буквы, цифры, дефисы и подчеркивания"
            raise ValueError(msg)
        return v


class CompanyCreate(CompanyBase):
    """Schema for creating a new company"""

    representative_user_id: UUID | None = Field(
        None,
        description="Заказчик: пользователь из друзей создающего (взаимная дружба); опционально",
    )
    logo_url: str | None = Field(None, max_length=500, description="URL логотипа")
    subscription_tier: str | None = Field(None, description="Уровень подписки")
    subscription_status: str | None = Field(None, description="Статус подписки")
    max_users: int | None = Field(None, description="Максимальное количество пользователей")
    max_projects: int | None = Field(None, description="Максимальное количество проектов")
    max_storage_gb: int | None = Field(None, description="Максимальный объем хранилища (GB)")
    settings: dict[str, Any] | None = Field(None, description="Настройки компании")
    meta_data: dict[str, Any] | None = Field(None, description="Метаданные компании")


class CompanyUpdate(BaseModel):
    """Schema for updating company (all fields optional)"""

    representative_user_id: UUID | None = Field(
        None,
        description="Заказчик; null чтобы снять назначение",
    )
    name: str | None = Field(None, min_length=2, max_length=255)
    industry: str | None = Field(None, max_length=100)
    size: str | None = None
    country: str | None = Field(None, max_length=100)
    timezone: str | None = Field(None, max_length=100)
    website: str | None = Field(None, max_length=500)
    description: str | None = None
    logo_url: str | None = Field(None, max_length=500)

    @field_validator("size")
    @classmethod
    def validate_size(cls, v: str | None) -> str | None:
        allowed = ["startup", "solo", "small", "medium", "large", "enterprise"]
        if v is not None and v not in allowed:
            msg = "Размер должен быть: startup/solo, small, medium, large, enterprise"
            raise ValueError(msg)
        return v


class CompanyResponse(CompanyBase):
    """Schema for company response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID | None = Field(
        None,
        description="Владелец карточки компании (маркетолог); для проверки прав в UI",
    )
    representative_user_id: UUID | None = None
    logo_url: str | None = None
    subscription_tier: str
    subscription_status: str
    subscription_expires_at: datetime | None = None
    max_users: int
    max_projects: int
    max_storage_gb: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class CompanyStatsLimitsOut(BaseModel):
    """Nested subscription limits for company stats."""

    max_projects: int
    max_users: int
    max_storage_gb: int


class CompanyStatsUsageOut(BaseModel):
    """Nested usage counters for company stats."""

    projects: int = Field(ge=0)
    projects_percentage: float = Field(ge=0)


class CompanyStatsOut(BaseModel):
    """GET /companies/{company_id}/stats (Wave B8)."""

    company_id: str
    company_name: str
    subscription_tier: str
    subscription_status: str
    total_projects: int = Field(ge=0)
    active_projects: int = Field(ge=0)
    limits: CompanyStatsLimitsOut
    usage: CompanyStatsUsageOut


class CompanyDeleteOut(BaseModel):
    """DELETE /companies/{company_id} soft-delete ack (Wave B8)."""

    message: str
    company_id: str


# ========================================
# 📁 PROJECT SCHEMAS
# ========================================

# Type definitions for project ENUMs (match database types)
ProjectCategory = Literal[
    "market_research",
    "product_development",
    "business_transformation",
    "marketing_campaign",
    "competitive_analysis",
    "other",
]

ProjectStatus = Literal["active", "paused", "completed", "archived", "cancelled"]

ProjectPriority = Literal["low", "medium", "high", "urgent"]


class ProjectBase(BaseModel):
    """Base project schema with common fields"""

    name: str = Field(..., min_length=2, max_length=255, description="Название проекта")
    slug: str = Field(..., min_length=4, max_length=255, description="URL-friendly идентификатор (мин. 4 символа)")
    description: str | None = Field(None, description="Описание проекта (суть, сегмент, контекст)")
    goals: str | None = Field(
        None,
        description="Цели проекта: измеримые результаты и критерии успеха (хранятся в metadata.cabinet_goals)",
    )
    key_tasks: str | None = Field(
        None,
        description="Ключевые задачи и фокус работ (хранятся в metadata.cabinet_key_tasks)",
    )
    category: ProjectCategory | None = Field(None, description="Категория проекта")
    tags: list[str] | None = Field(default_factory=list, description="Теги")
    enabled_modules: list[str] = Field(
        default_factory=lambda: [
            "jtbd",
            "value_proposition",
            "swot",
            "competitors",
            "researches",
            "content_ai",
            "context_chat",
            "segments",
            "campaigns",
            "funnel",
            "tasks",
            "alerts",
            "ai_studio",
            "client_interaction",
        ],
        description="Включенные модули",
    )
    priority: ProjectPriority | None = Field(default="medium", description="Приоритет")

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not v.replace("-", "").replace("_", "").isalnum():
            msg = "Slug должен содержать только буквы, цифры, дефисы и подчеркивания"
            raise ValueError(msg)
        return v


class ProjectCreate(ProjectBase):
    """Schema for creating a new project"""

    company_id: UUID = Field(..., description="ID компании")


class ProjectUpdate(BaseModel):
    """Schema for updating project (all fields optional)"""

    name: str | None = Field(None, min_length=2, max_length=255)
    description: str | None = None
    goals: str | None = None
    key_tasks: str | None = None
    category: ProjectCategory | None = None
    tags: list[str] | None = None
    enabled_modules: list[str] | None = None
    priority: ProjectPriority | None = None
    status: ProjectStatus | None = None


class ProjectResponse(ProjectBase):
    """Schema for project response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    created_by: UUID | None = None  # Optional for OAuth2 users
    status: ProjectStatus
    start_date: datetime | None = None
    end_date: datetime | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    cabinet_modules: list[str] | None = Field(
        None,
        description="Модули маркетингового кабинета для текущего пользователя (если null — используйте enabled_modules)",
    )
    read_only_marketing: bool = Field(
        False,
        description="Только просмотр в маркетинговом кабинете (представитель заказчика без членства в команде проекта)",
    )


class TransferLeadRequest(BaseModel):
    """Передать роль руководителя проекта (создателя) активному участнику"""

    new_lead_user_id: UUID = Field(..., description="UUID нового руководителя (активный участник)")


# ========================================
# 👥 PROJECT MEMBER SCHEMAS
# ========================================


class ProjectMemberCreate(BaseModel):
    """Schema for adding a member to project"""

    user_id: UUID = Field(..., description="ID пользователя")
    role: str = Field(..., description="Роль в проекте")
    permissions: list[str] | None = Field(default_factory=list, description="Разрешения")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ["owner", "admin", "editor", "member", "viewer"]:
            msg = "Роль должна быть: owner, admin, editor, member, viewer"
            raise ValueError(msg)
        return v


class ProjectMemberUpdate(BaseModel):
    """Schema for updating project member"""

    role: str | None = None
    permissions: list[str] | None = None
    status: str | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str | None) -> str | None:
        if v is not None and v not in ["owner", "admin", "editor", "member", "viewer"]:
            msg = "Роль должна быть: owner, admin, editor, member, viewer"
            raise ValueError(msg)
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in ["invited", "active", "inactive", "removed"]:
            msg = "Статус должен быть: invited, active, inactive, removed"
            raise ValueError(msg)
        return v


class ProjectMemberResponse(BaseModel):
    """Schema for project member response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    user_id: UUID
    invited_by: UUID | None = None
    role: str
    permissions: list[str]
    status: str
    joined_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ProjectMembersListResponse(BaseModel):
    """Paginated project members list (Marketing Cabinet / team UI)."""

    items: list[ProjectMemberResponse]
    total: int = Field(..., ge=0)
