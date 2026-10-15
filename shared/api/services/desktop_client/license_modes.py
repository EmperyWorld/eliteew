# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Product license-mode IA for desktop-client seats (#011/#015): offline / cloud / both.
# Invariants:
# - User-facing labels never expose raw profile_id (client-offline-ai).
# - Offline is the preferred default for seat issue.
# - Capabilities = allow_offline + allow_online flags (SoT after PATCH).
# Related:
# - documentation/platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md §3.4
# - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md §desktop-client-015
# ---

from __future__ import annotations

from typing import Literal

from api.services.desktop_client.license_service import DesktopClientError

SeatMode = Literal["offline", "cloud", "both"]

DEFAULT_SEAT_MODE: SeatMode = "offline"

# Internal pack id — never show in end-user UI copy.
OFFLINE_PROFILE_ID = "client-offline-ai"
OFFLINE_EDITION = "client"
CLOUD_EDITION = "connected"

MODE_LABEL_RU: dict[SeatMode, str] = {
    "offline": "Офлайн-режим",
    "cloud": "Облачный режим",
    "both": "Офлайн и облако",
}

MODE_HINT_RU: dict[SeatMode, str] = {
    "offline": "Приложения на устройстве без постоянного канала. Главный режим для холодного старта.",
    "cloud": "Защищённый канал + облачный рабочий стол EliteEW. Нужна выдача места с каналом.",
    "both": "Офлайн-приложения на устройстве и облачный стол под одной лицензией.",
}


def normalize_seat_mode(raw: str | None) -> SeatMode:
    m = (raw or DEFAULT_SEAT_MODE).strip().lower()
    if m in ("both", "offline+online", "offline_online", "hybrid"):
        return "both"
    if m in ("offline", "client", "client-offline", "client-offline-ai"):
        return "offline"
    if m in ("cloud", "connected", "online"):
        return "cloud"
    raise DesktopClientError(
        "invalid_mode",
        "mode must be offline|cloud|both",
        http_status=400,
    )


def flags_for_mode(mode: SeatMode) -> tuple[bool, bool]:
    """Return (allow_offline, allow_online)."""
    if mode == "offline":
        return True, False
    if mode == "cloud":
        return False, True
    return True, True


def mode_from_flags(*, allow_offline: bool, allow_online: bool) -> SeatMode:
    if allow_offline and allow_online:
        return "both"
    if allow_offline:
        return "offline"
    if allow_online:
        return "cloud"
    raise DesktopClientError(
        "invalid_mode",
        "license needs allow_offline and/or allow_online",
        http_status=400,
    )


def edition_for_mode(mode: SeatMode) -> str:
    if mode == "cloud":
        return CLOUD_EDITION
    return OFFLINE_EDITION


def profile_id_for_mode(mode: SeatMode) -> str | None:
    if mode == "cloud":
        return None
    return OFFLINE_PROFILE_ID


def seat_mode_from_edition(
    edition: str | None,
    profile_id: str | None = None,
    *,
    allow_offline: bool | None = None,
    allow_online: bool | None = None,
) -> SeatMode:
    if allow_offline is not None and allow_online is not None and (allow_offline or allow_online):
        return mode_from_flags(allow_offline=allow_offline, allow_online=allow_online)
    ed = (edition or "").strip()
    profile = (profile_id or "").strip()
    if ed == OFFLINE_EDITION or profile == OFFLINE_PROFILE_ID:
        return "offline"
    if ed == CLOUD_EDITION:
        return "cloud"
    return "offline"


def normalize_email(raw: str | None) -> str | None:
    e = (raw or "").strip().lower()
    if not e:
        return None
    if "@" not in e or len(e) > 320:
        raise DesktopClientError("invalid_email", "allowed_email must be a valid email", http_status=400)
    return e


def mode_label_ru(mode: SeatMode) -> str:
    return MODE_LABEL_RU[mode]


def mode_hint_ru(mode: SeatMode) -> str:
    return MODE_HINT_RU[mode]
