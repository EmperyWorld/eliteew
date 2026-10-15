# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# View/error types for desktop-client license service (atomized from license_service.py).
# Invariants:
# - Plaintext keys never live on view types except IssuedLicenseView (ops once).
# - Preflight/heartbeat views carry no email/PII.
# Related:
# - api.services.desktop_client.license_service
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID


class DesktopClientError(Exception):
    def __init__(self, code: str, message: str, *, http_status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status


@dataclass
class BoundLicenseView:
    license_id: UUID
    device_id: UUID
    edition: str
    profile_id: str | None
    apps: list[Any]
    expires_at: datetime | None
    status: str
    allow_offline: bool = False
    allow_online: bool = True
    allow_fofline: bool = False
    allowed_email: str | None = None


@dataclass
class IssuedLicenseView:
    """Ops-only: plaintext key returned once at issue time."""

    license_id: UUID
    license_key: str
    edition: str
    profile_id: str | None
    label: str | None
    created_at: datetime
    allow_offline: bool = False
    allow_online: bool = True
    allow_fofline: bool = False
    allowed_email: str | None = None
    expires_at: datetime | None = None


@dataclass
class LicenseCapabilitiesView:
    license_id: UUID
    status: str
    edition: str
    profile_id: str | None
    apps: list[Any]
    expires_at: datetime | None
    label: str | None
    allow_offline: bool
    allow_online: bool
    allow_fofline: bool
    allowed_email: str | None
    bound_keycloak_sub: str | None
    email_bound_at: datetime | None


@dataclass
class LicenseInventoryItem:
    """Admin inventory row — no plaintext key."""

    license_id: UUID
    status: str
    edition: str
    profile_id: str | None
    label: str | None
    allow_offline: bool
    allow_online: bool
    allow_fofline: bool
    allowed_email: str | None
    bound_keycloak_sub: str | None
    expires_at: datetime | None
    created_at: datetime
    revoked_at: datetime | None
    device_count_active: int


@dataclass
class LicenseDeviceItem:
    device_id: UUID
    license_id: UUID
    status: str
    machine_fingerprint: str
    device_pubkey: str
    last_seen_at: datetime | None
    created_at: datetime
    revoked_at: datetime | None


@dataclass
class SessionAssertView:
    license_id: UUID
    allowed_email: str
    bound_keycloak_sub: str
    claimed: bool
    allow_online: bool
    allow_offline: bool
    allow_fofline: bool = False
    channel: str = "desktop"


@dataclass
class LicensePreflightView:
    """Pre-OIDC / heartbeat gate — no email or Keycloak identifiers."""

    ok: bool
    code: str
    expires_at: datetime | None = None
    allow_online: bool | None = None
    allow_offline: bool | None = None
    allow_fofline: bool | None = None
