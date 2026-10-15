# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic request/response models for /api/v1/desktop-client (Wave 2 + seats #014 + preflight/heartbeat).
# Invariants:
# - No plaintext license keys in client-facing responses (redeem/prove).
# - Preflight/heartbeat responses never include email / Keycloak sub.
# - Ops/admin issue and seat responses may include plaintext key / pack once.
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LicenseRedeemRequest(BaseModel):
    license_key: str = Field(min_length=8, max_length=128)
    device_pubkey: str = Field(min_length=16, max_length=512)
    machine_fingerprint: str = Field(min_length=8, max_length=256)


class LicenseRedeemResponse(BaseModel):
    license_id: UUID
    device_id: UUID
    edition: str
    profile_id: str | None = None
    apps: list[Any] = Field(default_factory=list)
    expires_at: datetime | None = None
    status: str = "bound"
    allow_offline: bool = False
    allow_online: bool = True
    allow_fofline: bool = False
    allowed_email: str | None = None
    # Signed entitlement document {v, payload, sig} when DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY set.
    entitlement: dict[str, Any] | None = None


class DeviceChallengeRequest(BaseModel):
    device_pubkey: str = Field(min_length=16, max_length=512)


class DeviceChallengeResponse(BaseModel):
    challenge: str
    expires_in_sec: int = 300


class DeviceProveRequest(BaseModel):
    device_pubkey: str = Field(min_length=16, max_length=512)
    machine_fingerprint: str = Field(min_length=8, max_length=256)
    challenge: str = Field(min_length=8, max_length=128)
    challenge_proof: str = Field(min_length=32, max_length=128)


class DeviceProveResponse(BaseModel):
    license_id: UUID
    device_id: UUID
    edition: str
    profile_id: str | None = None
    apps: list[Any] = Field(default_factory=list)
    status: str = "proven"


class RevokeLicenseRequest(BaseModel):
    license_id: UUID
    reason: str | None = Field(default=None, max_length=500)


class RevokeDeviceRequest(BaseModel):
    device_id: UUID
    reason: str | None = Field(default=None, max_length=500)


class OpsAckResponse(BaseModel):
    ok: bool
    status: str


class LicenseIssueRequest(BaseModel):
    label: str | None = Field(default=None, max_length=200)
    edition: str = Field(default="connected", min_length=1, max_length=64)
    profile_id: str | None = Field(default=None, max_length=128)


class LicenseIssueResponse(BaseModel):
    license_id: UUID
    license_key: str
    edition: str
    profile_id: str | None = None
    label: str | None = None
    created_at: datetime


class PortalPeerCreateRequest(BaseModel):
    slug: str = Field(min_length=2, max_length=64)
    label: str | None = Field(default=None, max_length=200)
    license_id: UUID | None = None


class PortalPeerViewResponse(BaseModel):
    id: UUID
    slug: str
    wg_public_key: str
    assigned_ip: str
    status: str
    label: str | None = None
    license_id: UUID | None = None
    edge_sync_status: str
    edge_synced_at: datetime | None = None
    edge_sync_error: str | None = None
    created_at: datetime


class PortalPeerCreateResponse(BaseModel):
    peer: PortalPeerViewResponse
    private_key: str
    client_conf: str
    edge_sync_enqueued: bool


class PortalPeerListResponse(BaseModel):
    peers: list[PortalPeerViewResponse]


class PortalPeerRevokeRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class PortalPeerSyncResponse(BaseModel):
    ok: bool
    configured: bool
    skipped: bool
    message: str | None = None
    active_peer_count: int = 0
    added_or_updated: int = 0
    removed: int = 0


class PortalPeerManifestImportRequest(BaseModel):
    peers: list[dict[str, Any]] = Field(default_factory=list)


class PortalPeerManifestImportResponse(BaseModel):
    imported: int
    updated: int
    skipped: int
    errors: list[str] = Field(default_factory=list)
    edge_sync_enqueued: bool = False


class DeviceRequestV1(BaseModel):
    """Hand-to-hand signed device enrollment request (Wave 3)."""

    model_config = ConfigDict(extra="forbid")

    kind: str = Field(min_length=8, max_length=64)
    request_id: str = Field(min_length=8, max_length=128)
    product_id: str = Field(min_length=4, max_length=128)
    app_identifier: str = Field(min_length=4, max_length=128)
    device_signing_pubkey: str = Field(min_length=64, max_length=64)
    capsule_recipient_pubkey: str = Field(min_length=64, max_length=64)
    recipient_key_id: str = Field(min_length=4, max_length=128)
    machine_fingerprint_hash: str = Field(min_length=8, max_length=256)
    created_at: str = Field(min_length=10, max_length=64)
    nonce: str = Field(min_length=32, max_length=128)
    signature: str = Field(min_length=128, max_length=128)


class SeatIssueRequest(BaseModel):
    """Ops/admin: issue one seat package for desktop-client handout."""

    mode: str = Field(
        default="offline",
        description="Product seat mode: offline|cloud|both (default offline)",
        max_length=32,
    )
    label: str | None = Field(default=None, max_length=200)
    slug: str | None = Field(
        default=None,
        max_length=64,
        description="Portal peer slug for cloud/both mode (auto if omitted)",
    )
    allowed_email: str | None = Field(
        default=None,
        max_length=320,
        description="Optional pre-bind email for online login gate (2C)",
    )
    expires_at: datetime | None = Field(
        default=None,
        description="Optional seat expiry; minted into local entitlement exp and enforced by session/assert",
    )
    allow_fofline: bool = Field(
        default=False,
        description="Additive FoFline entitlement (empery-fofline); default deny",
    )
    device_request: DeviceRequestV1 | None = Field(
        default=None,
        description="Required for sealed issue (Wave 3). Omit only when plaintext test flag is set.",
    )


class SeatIssueResponse(BaseModel):
    filename: str
    package: dict[str, Any]


class CapsuleActivationConsumeRequest(BaseModel):
    """Wave 4: one-time activation after Capsule v2 import."""

    model_config = ConfigDict(extra="forbid")

    request_id: str = Field(min_length=8, max_length=128)
    activation_token: str = Field(min_length=16, max_length=256)
    device_signing_pubkey: str = Field(min_length=64, max_length=64)
    proof_nonce: str = Field(min_length=16, max_length=128)
    proof_signature: str = Field(min_length=128, max_length=128)


class CapsuleActivationConsumeResponse(BaseModel):
    ok: bool
    license_id: UUID
    status: str


class LicenseCapabilitiesPatchRequest(BaseModel):
    """Ops/admin: change license composition without rotating the key."""

    allow_offline: bool | None = None
    allow_online: bool | None = None
    allow_fofline: bool | None = None
    apps: list[Any] | None = None
    expires_at: datetime | None = None
    clear_expires: bool = False
    allowed_email: str | None = None
    clear_allowed_email: bool = False
    clear_account_bind: bool = False
    label: str | None = None


class LicenseCapabilitiesResponse(BaseModel):
    license_id: UUID
    status: str
    edition: str
    profile_id: str | None = None
    apps: list[Any] = Field(default_factory=list)
    expires_at: datetime | None = None
    label: str | None = None
    allow_offline: bool
    allow_online: bool
    allow_fofline: bool = False
    allowed_email: str | None = None
    bound_keycloak_sub: str | None = None
    email_bound_at: datetime | None = None
    mode: str
    entitlement: dict[str, Any] | None = Field(
        default=None,
        description="Reminted signed entitlement after capabilities PATCH (import on seat to refresh local exp)",
    )


class AdminRevokeReasonRequest(BaseModel):
    """Path-scoped revoke (license or device) — reason only."""

    reason: str | None = Field(default=None, max_length=500)


class LicenseInventoryItemResponse(BaseModel):
    license_id: UUID
    status: str
    edition: str
    profile_id: str | None = None
    label: str | None = None
    allow_offline: bool
    allow_online: bool
    allow_fofline: bool = False
    allowed_email: str | None = None
    bound_keycloak_sub: str | None = None
    expires_at: datetime | None = None
    created_at: datetime
    revoked_at: datetime | None = None
    device_count_active: int = 0
    mode: str


class LicenseListResponse(BaseModel):
    licenses: list[LicenseInventoryItemResponse]
    total: int
    limit: int
    offset: int


class LicenseDeviceItemResponse(BaseModel):
    device_id: UUID
    license_id: UUID
    status: str
    machine_fingerprint: str
    device_pubkey: str
    last_seen_at: datetime | None = None
    created_at: datetime
    revoked_at: datetime | None = None


class LicenseDeviceListResponse(BaseModel):
    devices: list[LicenseDeviceItemResponse]


class SoftRevokeEntryResponse(BaseModel):
    license_id: UUID
    reason: str | None = None
    created_at: datetime
    created_by: str | None = None
    license_label: str | None = None
    license_status: str | None = None


class SoftRevokeAddRequest(BaseModel):
    license_id: UUID
    reason: str | None = Field(default=None, max_length=500)


class DenylistStatusResponse(BaseModel):
    published_at: datetime | None = None
    note: str | None = None
    revoked_count: int = 0
    payload_hash: str | None = None
    out_path: str | None = None
    pending_count: int = 0
    updates_out_configured: bool
    signing_key_configured: bool
    entries: list[SoftRevokeEntryResponse] = Field(default_factory=list)


class DenylistPublishRequest(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class DenylistPublishResponse(BaseModel):
    published_at: datetime
    revoked_count: int
    payload_hash: str
    out_path: str
    note: str | None = None


class LicensePreflightRequest(BaseModel):
    """Pre-OIDC license gate (Start) and in-session heartbeat body — no PII."""

    license_id: UUID
    device_id: UUID | None = Field(
        default=None,
        description="Optional device row; Capsule seats may omit until redeem",
    )
    machine_fingerprint: str | None = Field(default=None, max_length=256)


class LicensePreflightResponse(BaseModel):
    """Server license gate result — never includes email / Keycloak sub."""

    ok: bool
    code: str
    expires_at: datetime | None = None
    allow_online: bool | None = None
    allow_fofline: bool | None = None
    allow_offline: bool | None = None


# Heartbeat reuses the same request/response wire shape.
LicenseHeartbeatRequest = LicensePreflightRequest
LicenseHeartbeatResponse = LicensePreflightResponse


class SessionAssertRequest(BaseModel):
    license_id: UUID
    device_id: UUID | None = Field(
        default=None,
        description="Optional device row; when omitted, license expiry/email/flags still enforce (capsule seats without redeem device)",
    )
    channel: str = Field(
        default="desktop",
        description="Assert channel: desktop (allow_online) | fofline (allow_fofline)",
        max_length=16,
    )


class SessionAssertResponse(BaseModel):
    ok: bool = True
    license_id: UUID
    allowed_email: str
    bound_keycloak_sub: str
    claimed: bool = False
    allow_online: bool = True
    allow_offline: bool = False
    allow_fofline: bool = False
    channel: str = "desktop"


class RuntimePresenceIntegrity(BaseModel):
    """Honest integrity flags — Authenticode stays false until Windows code-sign ships."""

    updater_pubkey_baked: bool = False
    authenticode: bool = False


class RuntimePresenceReportRequest(BaseModel):
    license_id: UUID | None = None
    device_id: UUID | None = None
    app_version: str | None = Field(default=None, max_length=64)
    wg_up: bool | None = None
    peer_slug: str | None = Field(default=None, max_length=64)
    build_channel: str | None = Field(
        default=None,
        max_length=16,
        description="rpm | nsis | unknown | fofline",
    )
    client_channel: str | None = Field(
        default=None,
        max_length=16,
        description="desktop | fofline — FoFline W5 presence heartbeat",
    )
    integrity: RuntimePresenceIntegrity | None = None


class RuntimePresenceReportResponse(BaseModel):
    ok: bool = True
    keycloak_sub: str | None = None
    license_id: str | None = None
    device_id: str | None = None
    app_version: str | None = None
    wg_up: bool | None = None
    peer_slug: str | None = None
    build_channel: str | None = None
    updater_pubkey_baked: bool = False
    report_ip: str | None = None
    reported_at: str | None = None


class FleetMigrationExceptionRequest(BaseModel):
    """Admin: mark a license as migration exception."""

    model_config = ConfigDict(extra="forbid")

    owner: str = Field(min_length=1, max_length=200)
    until: datetime
    notes: str | None = Field(default=None, max_length=2000)


class FleetMigrationStartGraceRequest(BaseModel):
    """Admin: start/refresh grace window for a license."""

    model_config = ConfigDict(extra="forbid")

    deadline_days: int = Field(default=14, ge=1, le=365)


class AuthBindingRecoveryActionRequest(BaseModel):
    """Admin recovery action for one identity binding. Never changes license status."""

    model_config = ConfigDict(extra="forbid")

    action: str = Field(min_length=3, max_length=64)
    reason: str = Field(min_length=8, max_length=2000)
    idempotency_key: str = Field(min_length=8, max_length=128)
    confirm: bool = False


class AuthRiskEventItemResponse(BaseModel):
    kind: str
    created_at: str | None = None
    corroborated: bool = False
    resulting_state: str | None = None
    tickets_revoked: int = 0


class AuthBindingRecoveryItemResponse(BaseModel):
    binding_id: str
    license_id: UUID
    device_id: UUID | None = None
    client_id: str
    channel: str
    state: str
    authz_epoch: int
    keycloak_sub: str | None = None
    rebind_allowed_until: datetime | None = None
    last_risk_at: datetime | None = None
    updated_at: datetime
    events: list[AuthRiskEventItemResponse] = Field(default_factory=list)


class AuthBindingRecoveryListResponse(BaseModel):
    bindings: list[AuthBindingRecoveryItemResponse] = Field(default_factory=list)


class AuthBindingRecoveryActionResponse(BaseModel):
    ok: bool = True
    action: str
    binding_id: str
    state: str
    authz_epoch: int
    replayed: bool = False
    keycloak_touched: bool = False
    license_status_unchanged: bool = True


class AtomicBindingFleetInventoryResponse(BaseModel):
    """Wave 6: counts only — no email/sub/PII."""

    model_config = ConfigDict(extra="forbid")

    active_licenses: int = 0
    active_allow_online: int = 0
    active_allow_fofline: int = 0
    active_with_bound_sub: int = 0
    active_devices: int = 0
    devices_with_pubkey: int = 0
    identity_bindings: int = 0
    identity_bindings_active: int = 0
    identity_bindings_restricted: int = 0
    identity_bindings_pending_pop: int = 0
    slots_needing_create: int = 0
    slots_already_migrated: int = 0
    slots_conflict: int = 0
    slots_skip_no_bound_sub: int = 0
    slots_skip_channel_disabled: int = 0


class AtomicBindingFleetMigrateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dry_run: bool = True
    confirm: bool = False


class AtomicBindingFleetMigrateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dry_run: bool
    created: int = 0
    already_migrated: int = 0
    conflict: int = 0
    skip_no_bound_sub: int = 0
    skip_channel_disabled: int = 0
    kc_attrs_synced: int = 0
    kc_attrs_failed: int = 0
    license_status_unchanged: bool = True
