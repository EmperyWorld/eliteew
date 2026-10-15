#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Request/response models for authenticated mobile APK distribution, SSO visibility, support reports, and mobile profile sync.
# Invariants:
# - No secrets or raw tokens in API payloads.
# Related:
# - api.routers.mobile_app
# ---

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class MobileAppSsoSnapshot(BaseModel):
    active: bool = False
    live: bool = False
    client_id: str | None = None
    last_seen_at: str | None = None
    first_seen_at: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None


class MobileAppLoginHistoryItem(BaseModel):
    event_type: str
    created_at: str
    ip_address: str | None = None
    user_agent: str | None = None
    client_id: str | None = None


class MobileAppDownloadTicketResponse(BaseModel):
    download_url: str = Field(
        description="Relative short-lived URL for direct APK file download (with strict server-side replay limits)."
    )
    expires_in_seconds: int = Field(description="Ticket TTL in seconds.")


class MobileAppRealtimeStateUpdate(BaseModel):
    foreground: bool = Field(description="True when the native Android shell is visible to the user.")


class MobileAppRealtimeStateResponse(BaseModel):
    accepted: bool = True
    foreground: bool


class MobileSupportReportCreateBody(BaseModel):
    bundle_text: str = Field(min_length=1, max_length=120_000)
    category: str = Field(default="general", max_length=32)
    app_version_name: str | None = Field(default=None, max_length=64)
    app_version_code: int | None = Field(default=None, ge=1, le=1_000_000)
    device_model: str | None = Field(default=None, max_length=128)


class MobileSupportReportResponse(BaseModel):
    report_id: str = Field(description="Opaque report id for operator tickets.")
    category: str
    message: str = Field(default="Support report received.")


class MobileNotificationProfile(BaseModel):
    chat_enabled: bool = True
    friends_enabled: bool = True
    ugs_enabled: bool = True
    system_enabled: bool = True
    quiet_hours_enabled: bool = False
    quiet_hours_start_minute: int = Field(default=22 * 60, ge=0, le=1439)
    quiet_hours_end_minute: int = Field(default=8 * 60, ge=0, le=1439)


class MobileProfileResponse(BaseModel):
    """Mobile-only appearance and notification prefs (stored under users.preferences.mobile)."""

    ui_style: str = Field(default="system", max_length=32)
    color_mode: str = Field(default="system", max_length=16)
    ui_scale: str = Field(default="compact", max_length=16)
    notifications_enabled: bool = True
    reduce_motion: bool = False
    high_contrast_hint: bool = False
    stream_cache_wifi_only: bool = False
    background_content_id: str | None = Field(default=None, max_length=64)
    updated_at: str | None = None
    notifications: MobileNotificationProfile = Field(default_factory=MobileNotificationProfile)
    # Read-only mirror of users.preferences.video_calls.call_target (edited in Связи → Телефон).
    call_target: Literal["both", "desktop_only", "mobile_only"] = "both"


class MobileProfileUpdate(BaseModel):
    ui_style: str | None = Field(default=None, max_length=32)
    color_mode: str | None = Field(default=None, max_length=16)
    ui_scale: str | None = Field(default=None, max_length=16)
    notifications_enabled: bool | None = None
    reduce_motion: bool | None = None
    high_contrast_hint: bool | None = None
    stream_cache_wifi_only: bool | None = None
    background_content_id: str | None = Field(default=None, max_length=64)
    notifications: MobileNotificationProfile | None = None


class MobileReleaseNotesHistoryItem(BaseModel):
    version_code: int = Field(ge=1, le=1_000_000)
    version_name: str = Field(min_length=1, max_length=64)
    release_notes: str = Field(min_length=1, max_length=4000)


class MobileAppOverviewResponse(BaseModel):
    download_page_url: str = Field(
        description="Fixed SPA URL (Keycloak login, then download).",
    )
    download_api_path: str = Field(
        default="/api/v1/mobile-app/download",
        description="Relative API path; use with Bearer token.",
    )
    apk_available: bool = False
    apk_size_bytes: int | None = None
    version_code: int | None = Field(
        default=None,
        description="versionCode of the published APK (from publish sidecar metadata).",
    )
    version_name: str | None = Field(
        default=None,
        description="versionName of the published APK (from publish sidecar metadata).",
    )
    apk_sha256: str | None = Field(
        default=None,
        description="Lowercase SHA-256 hex digest of the published APK bytes.",
    )
    published_at: str | None = Field(
        default=None,
        description="ISO timestamp from the OTA publish sidecar/manifest.",
    )
    release_notes: str | None = Field(
        default=None,
        description="Operator-authored mobile release notes for the published APK.",
    )
    release_notes_history: list[MobileReleaseNotesHistoryItem] = Field(
        default_factory=list,
        description="Per-version release notes for skipped OTA steps (newest publish included).",
    )
    min_supported_version_code: int | None = Field(
        default=None,
        description="Oldest versionCode allowed/recommended by the current mobile release policy.",
    )
    last_login_at: str | None = None
    login_count: int | None = None
    mobile_session: MobileAppSsoSnapshot | None = None
    login_history: list[MobileAppLoginHistoryItem] = Field(default_factory=list)
