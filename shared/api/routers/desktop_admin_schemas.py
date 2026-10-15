# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic schemas and catalog policy validators for desktop admin routes (desktop_admin.py).
# Invariants:
# - app_component validation uses KNOWN_DESKTOP_APP_COMPONENTS from desktop parent (lazy import).
# Related:
# - api/routers/desktop_admin.py
# - api/routers/desktop_store.py (DesktopAccessGroupRef)
# ---
"""Admin-only Pydantic models and catalog policy helpers for desktop App Store administration."""

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from api.routers.desktop_store import DesktopAccessGroupRef


def _validate_catalog_app_component(value: str | None) -> str | None:
    if value is None:
        return None
    from api.routers.desktop import KNOWN_DESKTOP_APP_COMPONENTS

    normalized = value.strip()
    if not normalized:
        raise ValueError("app_component must not be empty")
    if normalized not in KNOWN_DESKTOP_APP_COMPONENTS:
        raise ValueError("Unknown app_component")
    return normalized


def validate_factory_catalog_flags(
    *,
    is_factory: bool,
    is_system: bool,
    ew_monthly_price: int,
    trial_duration_days: int,
) -> None:
    """Factory (OEM) apps: not admin-only, free, no trial — auto-installed for eligible users."""
    if not is_factory:
        return
    if is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Заводское приложение не может быть админским — снимите флаг «Админское»",
        )
    if ew_monthly_price > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Заводское приложение должно быть бесплатным (EW/мес = 0)",
        )
    if trial_duration_days > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Заводское приложение не может иметь пробный период",
        )


def _admin_directory_dt_to_iso_z(dt: datetime | None) -> str | None:
    """Naive UTC из Postgres → ISO-8601 с Z, чтобы JS не принимал время за локальное."""
    if dt is None:
        return None
    aware = dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)
    return aware.isoformat().replace("+00:00", "Z")


# Admin: access groups
class AccessGroupResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AccessGroupCreate(BaseModel):
    name: str
    description: str | None = None


class AccessGroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


# Admin: catalog CRUD
class CatalogAppResponse(BaseModel):
    id: UUID
    app_id: str
    name: str
    description: str | None
    app_component: str
    category: str
    gradient: str | None
    color: str | None
    sort_order: int
    allow_multiple_windows: bool = False
    max_window_instances: int = 1
    is_system: bool
    is_factory: bool = False
    ew_monthly_price: int = 0
    trial_duration_days: int = 0
    is_featured_new: bool = False
    new_until: datetime | None = None
    maintenance_mode: bool = False
    maintenance_title: str | None = None
    maintenance_reason: str | None = None
    maintenance_expected_outcome: str | None = None
    maintenance_eta_note: str | None = None
    icon_url: str | None = None
    icon_url_2x: str | None = None
    preview_url: str | None = None
    preview_url_2x: str | None = None
    access_groups: list[DesktopAccessGroupRef] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CatalogAppCreate(BaseModel):
    app_id: str
    name: str
    description: str | None = None
    app_component: str
    category: str = "productivity"
    gradient: str | None = None
    color: str | None = None
    sort_order: int = 0
    allow_multiple_windows: bool = False
    max_window_instances: int = Field(default=1, ge=1)
    is_system: bool = False
    is_factory: bool = False
    ew_monthly_price: int = Field(default=0, ge=0)
    trial_duration_days: int = Field(default=0, ge=0)
    is_featured_new: bool = False
    new_until: datetime | None = None
    maintenance_mode: bool = False
    maintenance_title: str | None = None
    maintenance_reason: str | None = None
    maintenance_expected_outcome: str | None = None
    maintenance_eta_note: str | None = None
    icon_url: str | None = None
    icon_url_2x: str | None = None
    preview_url: str | None = None
    preview_url_2x: str | None = None
    access_group_ids: list[UUID] = Field(default_factory=list)

    @field_validator("icon_url", "icon_url_2x", "preview_url", "preview_url_2x", mode="before")
    @classmethod
    def strip_catalog_media_urls(cls, value: object) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            s = value.strip()
            return s or None
        return None

    @field_validator("app_component")
    @classmethod
    def validate_app_component(cls, value: str) -> str:
        validated = _validate_catalog_app_component(value)
        if validated is None:
            raise ValueError("app_component is required")
        return validated


class CatalogAppUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    app_component: str | None = None
    category: str | None = None
    gradient: str | None = None
    color: str | None = None
    sort_order: int | None = None
    allow_multiple_windows: bool | None = None
    max_window_instances: int | None = Field(default=None, ge=1)
    is_system: bool | None = None
    is_factory: bool | None = None
    ew_monthly_price: int | None = Field(default=None, ge=0)
    trial_duration_days: int | None = Field(default=None, ge=0)
    is_featured_new: bool | None = None
    new_until: datetime | None = None
    maintenance_mode: bool | None = None
    maintenance_title: str | None = None
    maintenance_reason: str | None = None
    maintenance_expected_outcome: str | None = None
    maintenance_eta_note: str | None = None
    icon_url: str | None = None
    icon_url_2x: str | None = None
    preview_url: str | None = None
    preview_url_2x: str | None = None
    access_group_ids: list[UUID] | None = None

    @field_validator("icon_url", "icon_url_2x", "preview_url", "preview_url_2x", mode="before")
    @classmethod
    def strip_catalog_media_urls_update(cls, value: object) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            s = value.strip()
            return s or None
        return None

    @field_validator("app_component")
    @classmethod
    def validate_app_component(cls, value: str | None) -> str | None:
        return _validate_catalog_app_component(value)


# Admin: users with access group
class UserAppAccessGroupResponse(BaseModel):
    id: UUID
    username: str
    email: str
    role: str
    #: UGS / generation credits (same field as в админке UGS)
    ugs_credits: float = 0.0
    ew_balance: int = 100
    app_access_group_id: UUID | None
    app_access_group_name: str | None

    model_config = ConfigDict(from_attributes=True)


class AdminSsoSessionSnapshot(BaseModel):
    """Текущая SSO-сессия Keycloak (browser / mobile / desktop) из реестра API."""

    client_class: Literal["browser", "mobile", "desktop", "fofline"]
    client_id: str
    session_id: str
    active: bool = False
    live: bool = False
    first_seen_at: str | None = None
    last_seen_at: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    replaced_at: str | None = None
    previous_session_id: str | None = None


class AdminUserDirectoryEntry(BaseModel):
    """Сводка по пользователю для админ-каталога (БД + presence + SSO registry)."""

    id: UUID
    username: str
    email: str
    role: str
    full_name: str | None = None
    avatar_url: str | None = None
    is_active: bool
    is_verified: bool
    is_trusted: bool
    created_at: datetime
    updated_at: datetime | None = None
    last_login_at: datetime | None = None
    login_count: int = 0
    ugs_credits: float = 0.0
    ew_balance: int = 100
    app_access_group_id: UUID | None = None
    app_access_group_name: str | None = None
    presence_online: bool = False
    presence_sessions: int = 0
    presence_sessions_web: int = 0
    presence_sessions_mobile: int = 0
    presence_connected_at: str | None = None
    presence_last_seen_at: str | None = None
    sso_browser_active: bool = False
    sso_mobile_active: bool = False
    sso_desktop_active: bool = False
    sso_fofline_active: bool = False
    sso_browser_live: bool = False
    sso_mobile_live: bool = False
    sso_desktop_live: bool = False
    sso_fofline_live: bool = False
    sso_browser_client_id: str | None = None
    sso_mobile_client_id: str | None = None
    sso_desktop_client_id: str | None = None
    sso_fofline_client_id: str | None = None
    sso_browser_last_seen_at: str | None = None
    sso_mobile_last_seen_at: str | None = None
    sso_desktop_last_seen_at: str | None = None
    sso_fofline_last_seen_at: str | None = None
    sso_browser_ip: str | None = None
    sso_mobile_ip: str | None = None
    sso_desktop_ip: str | None = None
    sso_fofline_ip: str | None = None
    sso_browser_user_agent: str | None = None
    sso_mobile_user_agent: str | None = None
    sso_desktop_user_agent: str | None = None
    sso_fofline_user_agent: str | None = None
    # Desktop Client ops enrich (license / portal peer / runtime heartbeat)
    desktop_license_id: str | None = None
    desktop_license_label: str | None = None
    desktop_license_mode: str | None = None
    desktop_license_status: str | None = None
    desktop_peer_slug: str | None = None
    desktop_peer_status: str | None = None
    desktop_peer_assigned_ip: str | None = None
    desktop_app_version: str | None = None
    desktop_wg_up: bool | None = None
    desktop_build_channel: str | None = None
    desktop_updater_pubkey_baked: bool | None = None
    desktop_report_ip: str | None = None
    desktop_reported_at: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", "updated_at", "last_login_at", when_used="json")
    def _serialize_directory_timestamps_utc_z(self, v: datetime | None) -> str | None:
        return _admin_directory_dt_to_iso_z(v)


class AdminUserDirectorySummary(BaseModel):
    """Сводка по текущим SQL-фильтрам каталога (Redis subset counts)."""

    online_matching_total: int | None = Field(
        None,
        description="Пользователей по фильтрам с живым Socket.IO (Redis)",
    )
    presence_anomaly_matching_total: int | None = Field(
        None,
        description="Пользователей по фильтрам с >1 browser Socket.IO (Redis)",
    )
    sso_browser_active_matching_total: int | None = Field(
        None,
        description="Пользователей по фильтрам с активной SSO browser-сессией (Postgres)",
    )
    sso_mobile_active_matching_total: int | None = Field(
        None,
        description="Пользователей по фильтрам с активной SSO mobile-сессией (Postgres)",
    )
    sso_desktop_active_matching_total: int | None = Field(
        None,
        description="Пользователей по фильтрам с активной SSO desktop-сессией (Postgres)",
    )
    sso_fofline_active_matching_total: int | None = Field(
        None,
        description="Пользователей по фильтрам с активной SSO FoFline-сессией (Postgres)",
    )
    channel_mismatch_matching_total: int | None = Field(
        None,
        description="Пользователей по фильтрам с рассинхроном SSO веб / Socket.IO (heuristic)",
    )


class AdminUserDirectoryPage(BaseModel):
    redis_available: bool
    total: int
    page: int
    per_page: int
    users: list[AdminUserDirectoryEntry]
    summary: AdminUserDirectorySummary | None = None


class AdminSsoLoginHistoryEntry(BaseModel):
    """Событие SSO из sso_session_audit_events (без токенов)."""

    event_type: str
    client_class: str | None = None
    client_id: str | None = None
    session_id: str | None = None
    replaced_session_id: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None


class AdminUserSsoOverview(BaseModel):
    """SSO-сессии и история входов пользователя для админки."""

    user_id: UUID
    sessions: list[AdminSsoSessionSnapshot] = Field(default_factory=list)
    history: list[AdminSsoLoginHistoryEntry] = Field(default_factory=list)


class UserAppAccessGroupUpdate(BaseModel):
    app_access_group_id: UUID | None = None


class UserEwBalanceSetBody(BaseModel):
    ew_balance: int = Field(ge=0)


class UserUgsCreditsSetBody(BaseModel):
    ugs_credits: float = Field(ge=0, le=99_999_999.99)


class WebSearchQuotaStatusResponse(BaseModel):
    user_id: UUID
    monthly_limit: int
    monthly_used: int
    monthly_remaining: int
    coins: int
    total_remaining: int
    period_month: str


class UserWebSearchQuotaPatch(BaseModel):
    web_search_coins: int | None = Field(default=None, ge=0, le=1_000_000)
    web_search_coins_delta: int | None = Field(default=None, ge=-1_000_000, le=1_000_000)
    web_search_monthly_limit: int | None = Field(default=None, ge=0, le=10_000)
    reset_monthly_limit: bool = False
