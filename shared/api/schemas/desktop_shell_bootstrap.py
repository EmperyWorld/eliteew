# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic envelope for GET /desktop/shell-bootstrap (import-safe for contract tests).
# Invariants:
# - No imports from desktop parent, gaf_chat.router, product_desktop_news, friends, or desktop_items.
# - schema_version 2+ includes shell_state (+ etags) and items (same shapes as dedicated GETs).
# Related:
# - api/routers/desktop_shell_bootstrap.py
# ---
"""Desktop shell-bootstrap response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from api.gaf_chat.schemas import ChatListItem, GafChatMeResponse
from api.routers.desktop_recents import DesktopRecentContentFeedResponse, DesktopRecentFileRow
from api.routers.desktop_shell_config import DesktopConfigResponse
from api.routers.desktop_shell_state_routes import DesktopShellStateOut
from api.schemas.notification_center import NotificationCenterGetResponse
from api.schemas.user_profile import UserPreferences, UserProfileResponse
from pydantic import BaseModel, ConfigDict, Field


class InstalledAppsSlice(BaseModel):
    """Same shape as GET /desktop/installed."""

    app_ids: list[str]


class DesktopShellBootstrapItemsSlice(BaseModel):
    """Same shape as GET /desktop/items — dict rows keep this schema import-safe."""

    model_config = ConfigDict(extra="forbid")

    items: list[dict[str, Any]] = Field(default_factory=list)


class DesktopShellBootstrapResponse(BaseModel):
    """Cold-path shell snapshot — FE seeds React Query / local desktop state from this once."""

    model_config = ConfigDict(extra="forbid")

    schema_version: int = 2
    fetched_at: datetime
    maintenance: dict[str, Any]
    profile: UserProfileResponse
    preferences: UserPreferences
    notification_center: NotificationCenterGetResponse
    desktop_config: DesktopConfigResponse
    installed: InstalledAppsSlice
    shell_state: DesktopShellStateOut
    shell_state_etag: str
    shell_state_field_etags: dict[str, str] = Field(default_factory=dict)
    items: DesktopShellBootstrapItemsSlice
    recent_files: list[DesktopRecentFileRow] = Field(default_factory=list)
    recent_content_feed: DesktopRecentContentFeedResponse
    gaf_me: GafChatMeResponse
    gaf_chats: list[ChatListItem] | None = None
    # dict: FriendsOverviewResponse lives on friends router (heavy import).
    friends_overview: dict[str, Any] | None = None
    ewdesk_news_counts: dict[str, Any] | None = None
    ewdesk_news_my_state: dict[str, Any] | None = None
    ugs_tray_summary: dict[str, Any] | None = None
