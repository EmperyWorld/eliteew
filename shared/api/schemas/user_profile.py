#!/usr/bin/env python3
"""
User Profile Schemas
Pydantic models for user profile management
"""

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator  # type: ignore[import-untyped]

# ========================================
# ENUMS
# ========================================


class LanguageCode(StrEnum):
    """Supported languages"""

    RU = "ru"
    EN = "en"
    ES = "es"
    FR = "fr"
    DE = "de"
    ZH = "zh"


class ProfileVisibility(StrEnum):
    """Profile visibility options"""

    PUBLIC = "public"
    PRIVATE = "private"
    FRIENDS_ONLY = "friends_only"


class ThemePreference(StrEnum):
    """Theme preferences"""

    LIGHT = "light"
    DARK = "dark"
    AUTO = "auto"


class EmailFrequency(StrEnum):
    """Email notification frequency"""

    INSTANT = "instant"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    NEVER = "never"


class DesktopIconStyle(StrEnum):
    """Desktop icon chrome — window chrome keys plus icon-only extras."""

    GLASS = "glass"
    FRAMED = "framed"
    MINIMAL = "minimal"
    NOIR = "noir"
    NEON = "neon"
    PAPER = "paper"
    AURORA = "aurora"
    CHAMELEON = "chameleon"
    PREMIUM = "premium"
    PRISM = "prism"
    MERCURY = "mercury"
    VHS = "vhs"
    SLATE = "slate"
    CLAY = "clay"
    EMBER = "ember"


class DesktopSceneDepth(StrEnum):
    """Desktop background overlay depth"""

    SOFT = "soft"
    BALANCED = "balanced"
    IMMERSIVE = "immersive"


class DesktopShellMotionSpeed(StrEnum):
    """Desktop shell spring / minimize timing."""

    SLOW = "slow"
    NORMAL = "normal"
    FAST = "fast"


class DesktopMenuMode(StrEnum):
    """Multimodal Start Menu interface (orchestrator modes)."""

    LEGACY = "legacy"
    COMMAND_CONSOLE = "command_console"
    WORKSPACE_DASHBOARD = "workspace_dashboard"


class DesktopShellParallaxIntensity(StrEnum):
    """Multiplier on scene-depth wallpaper parallax."""

    SUBTLE = "subtle"
    NORMAL = "normal"
    STRONG = "strong"


class DesktopFontBody(StrEnum):
    """Desktop shell body typography"""

    MANROPE = "manrope"
    POPPINS = "poppins"
    RALEWAY = "raleway"
    MONTSERRAT = "montserrat"


class DesktopFontDisplay(StrEnum):
    """Desktop shell display/heading typography"""

    SYSTEM = "system"
    CINZEL = "cinzel"
    PLAYFAIR = "playfair"
    CORMORANT = "cormorant"
    RALEWAY = "raleway"


class DesktopTaskbarStyle(StrEnum):
    """Desktop taskbar surface style — same keys as window chrome."""

    GLASS = "glass"
    FRAMED = "framed"
    MINIMAL = "minimal"
    NOIR = "noir"
    NEON = "neon"
    PAPER = "paper"
    AURORA = "aurora"
    CHAMELEON = "chameleon"
    PREMIUM = "premium"


class DesktopWindowStyle(StrEnum):
    """Desktop window chrome style"""

    GLASS = "glass"
    FRAMED = "framed"
    MINIMAL = "minimal"
    NOIR = "noir"
    NEON = "neon"
    PAPER = "paper"
    AURORA = "aurora"
    CHAMELEON = "chameleon"
    PREMIUM = "premium"


class DesktopWidgetsStyle(StrEnum):
    """Desktop floating widget chrome — same keys as window style."""

    GLASS = "glass"
    FRAMED = "framed"
    MINIMAL = "minimal"
    NOIR = "noir"
    NEON = "neon"
    PAPER = "paper"
    AURORA = "aurora"
    CHAMELEON = "chameleon"
    PREMIUM = "premium"


# ========================================
# SUB-MODELS (Preferences)
# ========================================

_MIN_PASSWORD_LENGTH = 8


class UgsNotificationBlockSettings(BaseModel):
    """UGS tray/hub: enable event and choose in-app vs OS browser notification."""

    enabled: bool = True
    in_app: bool = True
    browser: bool = False


class UgsNotificationPreferences(BaseModel):
    """Granular UGS task lifecycle notifications (stored under notifications.ugs)."""

    task_completed: UgsNotificationBlockSettings = Field(default_factory=UgsNotificationBlockSettings)
    task_queued: UgsNotificationBlockSettings = Field(default_factory=UgsNotificationBlockSettings)
    task_started: UgsNotificationBlockSettings = Field(default_factory=UgsNotificationBlockSettings)


class GafNotificationPreferences(BaseModel):
    """GAF Chat incoming message notifications (stored under notifications.gaf)."""

    incoming_message: UgsNotificationBlockSettings = Field(default_factory=UgsNotificationBlockSettings)


class NotificationPreferences(BaseModel):
    """Notification preferences"""

    email: bool = True
    push: bool = False
    in_app: bool = True
    desktop: bool = False
    email_frequency: EmailFrequency = EmailFrequency.INSTANT
    categories: dict[str, bool] = Field(default_factory=lambda: {"security": True, "updates": True, "marketing": False})
    # Desktop-specific notification settings
    desktop_sound_enabled: bool = True
    desktop_sound_theme: str = "chime"
    # Per-source sound overrides (e.g. {"gaf_chat": "pulse", "ugs": "digital"}).
    desktop_sound_theme_by_source: dict[str, str] = Field(default_factory=dict)
    # Per-source sound enable flags (e.g. {"gaf_chat": False}).
    desktop_sound_enabled_by_source: dict[str, bool] = Field(default_factory=dict)
    desktop_do_not_disturb: bool = False
    # When True, every socket `notification` event is added to the tray center (not only persistent/high/urgent).
    desktop_notification_center_all_socket_events: bool = False
    ugs: UgsNotificationPreferences = Field(default_factory=UgsNotificationPreferences)
    gaf: GafNotificationPreferences = Field(default_factory=GafNotificationPreferences)


class PrivacySettings(BaseModel):
    """Privacy settings"""

    profile_visibility: ProfileVisibility = ProfileVisibility.PUBLIC
    show_email: bool = False
    show_activity: bool = True
    show_stats: bool = True
    allow_messaging: bool = True


class UIPreferences(BaseModel):
    """UI preferences"""

    compact_mode: bool = False
    animations_enabled: bool = True
    sidebar_collapsed: bool = True
    default_view: str = "dashboard"
    desktop_open_apps_maximized: bool = True
    desktop_floating_widget_visible: bool = True
    desktop_icon_style: DesktopIconStyle = DesktopIconStyle.GLASS
    desktop_scene_depth: DesktopSceneDepth = DesktopSceneDepth.BALANCED
    desktop_font_body: DesktopFontBody = DesktopFontBody.MANROPE
    desktop_font_display: DesktopFontDisplay = DesktopFontDisplay.SYSTEM
    desktop_wallpaper_crossfade_enabled: bool = True
    desktop_styled_tooltips: bool = True
    desktop_shell_reduce_motion: bool = False
    desktop_shell_parallax_enabled: bool = True
    desktop_shell_parallax_intensity: DesktopShellParallaxIntensity = DesktopShellParallaxIntensity.NORMAL
    desktop_shell_window_morph_enabled: bool = True
    desktop_shell_motion_speed: DesktopShellMotionSpeed = DesktopShellMotionSpeed.NORMAL
    desktop_menu_mode: DesktopMenuMode = DesktopMenuMode.LEGACY
    desktop_taskbar_style: DesktopTaskbarStyle = DesktopTaskbarStyle.GLASS
    desktop_window_style: DesktopWindowStyle = DesktopWindowStyle.GLASS
    desktop_accent_follows_window_style: bool = False
    desktop_widgets_style: DesktopWidgetsStyle = DesktopWidgetsStyle.GLASS
    desktop_panel_opacity: float = Field(default=1.0, ge=0.35, le=1.0)
    desktop_ui_scale: float = Field(
        default=1.0,
        ge=0.5,
        le=1.5,
        description="Desktop work area zoom (DPI-like); 1.0 = 100%.",
    )
    desktop_reduce_backdrop_blur: bool = Field(
        default=False,
        description=("EliteEW desktop: reduce/disable backdrop-blur stacking on the desktop shell (lighter GPU load)."),
    )
    desktop_gaf_chat_sidebar_collapsed: bool = Field(
        default=True,
        description="GAF Chat: collapsed sidebar shows avatars only; expanded shows full thread list.",
    )

    @field_validator("desktop_taskbar_style", mode="before")
    @classmethod
    def _normalize_legacy_desktop_taskbar_style(cls, v: Any) -> Any:
        """Legacy UI stored clear/solid; map to the window-style vocabulary."""
        if v == "clear":
            return "glass"
        if v == "solid":
            return "framed"
        return v

    @field_validator("desktop_widgets_style", mode="before")
    @classmethod
    def _normalize_legacy_desktop_widgets_style(cls, v: Any) -> Any:
        """Legacy UI stored board/compact."""
        if v == "board":
            return "framed"
        if v == "compact":
            return "minimal"
        return v

    @field_validator("desktop_icon_style", mode="before")
    @classmethod
    def _normalize_legacy_desktop_icon_style(cls, v: Any) -> Any:
        """Legacy UI stored accent/graphite."""
        if v == "accent":
            return "aurora"
        if v == "graphite":
            return "noir"
        return v

    @field_validator("desktop_font_body", mode="before")
    @classmethod
    def _normalize_desktop_font_body(cls, v: Any) -> Any:
        if v is None or v == "":
            return "manrope"
        return v

    @field_validator("desktop_font_display", mode="before")
    @classmethod
    def _normalize_desktop_font_display(cls, v: Any) -> Any:
        if v is None or v == "":
            return "system"
        return v

    @field_validator("desktop_scene_depth", mode="before")
    @classmethod
    def _normalize_desktop_scene_depth(cls, v: Any) -> Any:
        if v is None or v == "":
            return "balanced"
        return v


class AccessibilitySettings(BaseModel):
    """Accessibility settings"""

    high_contrast: bool = False
    large_text: bool = False
    reduce_motion: bool = False
    screen_reader: bool = False


class VideoCallsPreferences(BaseModel):
    """Where to ring incoming internal video calls (web Связи → Телефон and mobile Profile)."""

    call_target: Literal["both", "desktop_only", "mobile_only"] = "both"


class UserPreferences(BaseModel):
    """Complete user preferences schema"""

    language: LanguageCode = LanguageCode.RU
    theme: ThemePreference = ThemePreference.DARK
    timezone: str = "UTC"
    notifications: NotificationPreferences = Field(default_factory=NotificationPreferences)
    privacy: PrivacySettings = Field(default_factory=PrivacySettings)
    ui: UIPreferences = Field(default_factory=UIPreferences)
    accessibility: AccessibilitySettings = Field(default_factory=AccessibilitySettings)
    video_calls: VideoCallsPreferences = Field(default_factory=VideoCallsPreferences)


class UserPreferencesUpdate(BaseModel):
    """Partial preferences update (all fields optional)"""

    language: LanguageCode | None = None
    theme: ThemePreference | None = None
    timezone: str | None = None
    notifications: NotificationPreferences | None = None
    privacy: PrivacySettings | None = None
    ui: UIPreferences | None = None
    accessibility: AccessibilitySettings | None = None
    video_calls: VideoCallsPreferences | None = None


# ========================================
# PROFILE MODELS
# ========================================


class UserProfileResponse(BaseModel):
    """User profile response"""

    id: str
    username: str
    email: str
    full_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    role: str
    is_active: bool
    is_verified: bool
    is_trusted: bool = False
    admin_badge_label: str | None = None
    admin_badge_hint: str | None = None
    preferences: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    last_login_at: datetime | None = None
    login_count: int = 0


class UserProfileUpdate(BaseModel):
    """User profile update request"""

    full_name: str | None = Field(None, min_length=1, max_length=24)
    bio: str | None = Field(None, max_length=1000)

    @field_validator("full_name", "bio")
    @classmethod
    def sanitize_text(cls, v: str | None) -> str | None:
        """Trim whitespace. Do not HTML-escape stored text: ``&``, ``π``, etc. must round-trip;
        React escapes plain text on render (XSS-safe for normal JSX text nodes)."""
        if v is None:
            return None
        return v.strip()


class ProfileDiscoverability(StrEnum):
    """Who can find this user in username/full-name search (non-friends)."""

    PUBLIC = "public"
    HIDDEN = "hidden"


class ProfileFieldVisibility(StrEnum):
    """Visibility of a profile field for viewers (search results, friend profile card)."""

    EVERYONE = "everyone"
    FRIENDS_ONLY = "friends_only"
    NONE = "none"
    CIRCLE = "circle"


class ProfilePrivacyResponse(BaseModel):
    """Server-side profile privacy (authoritative for search and friend profile redaction)."""

    discoverability: ProfileDiscoverability
    avatar_visibility: ProfileFieldVisibility
    avatar_circle_id: str | None = None
    full_name_visibility: ProfileFieldVisibility
    full_name_circle_id: str | None = None
    bio_visibility: ProfileFieldVisibility
    bio_circle_id: str | None = None
    updated_at: datetime


class ProfilePrivacyUpdate(BaseModel):
    """Partial update of profile privacy."""

    discoverability: ProfileDiscoverability | None = None
    avatar_visibility: ProfileFieldVisibility | None = None
    avatar_circle_id: str | None = None
    full_name_visibility: ProfileFieldVisibility | None = None
    full_name_circle_id: str | None = None
    bio_visibility: ProfileFieldVisibility | None = None
    bio_circle_id: str | None = None


# ========================================
# AVATAR MODELS
# ========================================


class AvatarUploadResponse(BaseModel):
    """Avatar upload response"""

    avatar_url: str
    thumbnail_256_url: str | None = None
    thumbnail_64_url: str | None = None
    content_id: str | None = None
    file_size: int
    mime_type: str
    created_at: datetime


class AvatarHistoryItem(BaseModel):
    """Avatar history item"""

    id: str
    avatar_url: str
    thumbnail_256_url: str | None = None
    thumbnail_64_url: str | None = None
    is_active: bool
    file_size: int | None = None
    mime_type: str | None = None
    created_at: datetime


# ========================================
# SECURITY MODELS
# ========================================


class ChangePasswordRequest(BaseModel):
    """Password change request"""

    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate password strength"""
        if len(v) < _MIN_PASSWORD_LENGTH:
            msg = f"Password must be at least {_MIN_PASSWORD_LENGTH} characters long"
            raise ValueError(msg)

        if not any(c.isupper() for c in v):
            msg = "Password must contain at least one uppercase letter"
            raise ValueError(msg)

        if not any(c.islower() for c in v):
            msg = "Password must contain at least one lowercase letter"
            raise ValueError(msg)

        if not any(c.isdigit() for c in v):
            msg = "Password must contain at least one number"
            raise ValueError(msg)

        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if not any(c in special_chars for c in v):
            msg = "Password must contain at least one special character"
            raise ValueError(msg)

        return v


class SecuritySettings(BaseModel):
    """Security settings response"""

    two_factor_enabled: bool = False
    last_password_change: datetime | None = None
    active_sessions_count: int = 0
    failed_login_attempts: int = 0
    locked_until: datetime | None = None


class UserSessionInfo(BaseModel):
    """User session information"""

    id: str
    ip_address: str | None = None
    user_agent: str | None = None
    device_info: dict[str, Any] = Field(default_factory=dict)
    last_used_at: datetime
    created_at: datetime
    is_current: bool = False


# ========================================
# STATISTICS MODELS
# ========================================


class UserStatistics(BaseModel):
    """User statistics"""

    account_age_days: int
    total_logins: int
    last_login: datetime | None = None

    # Chat statistics
    total_chat_sessions: int = 0
    active_chat_sessions: int = 0
    total_chat_messages: int = 0
    total_chat_tokens: int = 0

    # AI generation statistics
    total_ai_generations: int = 0
    completed_ai_generations: int = 0
    failed_ai_generations: int = 0
    ai_success_rate: float = 0.0

    # Content statistics
    total_content_items: int = 0
    storage_used_bytes: int = 0
    storage_used_mb: float = 0.0
    storage_quota_mb: float = 10240.0  # 10GB default


class ActivityLogEntry(BaseModel):
    """Activity log entry"""

    id: str
    action: str
    description: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


# ========================================
# PUBLIC PROFILE
# ========================================


class PublicUserProfile(BaseModel):
    """Public user profile (respects privacy settings)"""

    username: str
    full_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    created_at: datetime | None = None
    # Stats are shown only if privacy.show_stats = true
    total_chat_sessions: int | None = None
    total_content_items: int | None = None


# ========================================
# REQUEST/RESPONSE MODELS
# ========================================


class LanguageUpdateRequest(BaseModel):
    """Quick language update"""

    language: LanguageCode


class RevokeSessionRequest(BaseModel):
    """Revoke session request"""

    session_id: str

    @field_validator("session_id")
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        """Validate UUID format"""
        try:
            UUID(v)
        except ValueError:
            msg = "Invalid session ID format"
            raise ValueError(msg) from ValueError
        else:
            return v


class ActivityLogResponse(BaseModel):
    """Paginated activity log response"""

    activities: list[ActivityLogEntry]
    total: int
    page: int
    per_page: int
    total_pages: int


class DataExportResponse(BaseModel):
    """Data export job/item for profile export history (matches frontend DataExportResponse)"""

    export_id: str
    status: str  # "pending" | "processing" | "completed" | "failed"
    download_url: str | None = None
    created_at: str
    expires_at: str
    file_size: int | None = None


# ========================================
# EXPORTS
# ========================================


class MobilePushTokenBody(BaseModel):
    """FCM (or other) device token for push; persisted in user_mobile_push_tokens."""

    token: str = Field(..., min_length=8, max_length=8192)
    platform: str = Field(default="android", max_length=32)
    device_id: str | None = Field(
        default=None,
        max_length=256,
        description="Optional stable device id from the client; omit for single-device upsert per platform.",
    )


__all__ = [
    "AccessibilitySettings",
    "ActivityLogEntry",
    "ActivityLogResponse",
    "DataExportResponse",
    "AvatarHistoryItem",
    # Avatar
    "AvatarUploadResponse",
    # Security
    "ChangePasswordRequest",
    "DesktopIconStyle",
    "DesktopFontBody",
    "DesktopFontDisplay",
    "DesktopSceneDepth",
    "DesktopShellMotionSpeed",
    "DesktopShellParallaxIntensity",
    "DesktopTaskbarStyle",
    "DesktopWindowStyle",
    "DesktopWidgetsStyle",
    "EmailFrequency",
    # Enums
    "LanguageCode",
    # Requests
    "LanguageUpdateRequest",
    "MobilePushTokenBody",
    # Preferences
    "NotificationPreferences",
    "PrivacySettings",
    "ProfileVisibility",
    # Public
    "PublicUserProfile",
    "RevokeSessionRequest",
    "SecuritySettings",
    "ThemePreference",
    "UIPreferences",
    "UserPreferences",
    "UserPreferencesUpdate",
    "VideoCallsPreferences",
    # Profile
    "UserProfileResponse",
    "UserProfileUpdate",
    "UserSessionInfo",
    # Statistics
    "UserStatistics",
]
