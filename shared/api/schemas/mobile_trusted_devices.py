#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic contracts for MobileAndroid trusted-device binding, WireGuard public key registration, and transfer foundations.
# Invariants:
# - Schemas never include device, WireGuard, or GAF private keys.
# - Pairing codes are response-only and short-lived; persisted storage uses hashes.
# Related:
# - api.routers.mobile_trusted_devices, api.services.mobile_trusted_device_service
# ---

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class MobileDevicePairingChallengeCreate(BaseModel):
    device_label_hint: str | None = Field(default=None, max_length=128)
    prepare_gaf_e2ee: bool = False


class MobileDevicePairingChallengeResponse(BaseModel):
    challenge_id: UUID
    pairing_code: str
    challenge_nonce: str
    expires_at: datetime
    qr_payload: dict[str, Any]


class MobileDevicePairingChallengeResolveRequest(BaseModel):
    pairing_code: str = Field(min_length=6, max_length=32)


class MobileDevicePairingChallengeResolveResponse(BaseModel):
    challenge_id: UUID
    pairing_code: str
    challenge_nonce: str
    expires_at: datetime
    prepare_gaf_e2ee: bool = False


class MobileTrustedDeviceBindRequest(BaseModel):
    challenge_id: UUID
    pairing_code: str = Field(min_length=6, max_length=32)
    stable_device_id: str = Field(min_length=8, max_length=256)
    device_label: str = Field(default="Android device", min_length=1, max_length=128)
    device_public_key: str = Field(min_length=32, max_length=4096)
    device_public_key_algorithm: Literal["ed25519", "p256-es256"] = "p256-es256"
    signed_challenge: str = Field(min_length=32, max_length=4096)
    wg_public_key: str = Field(min_length=32, max_length=128)
    gaf_public_key: str | None = Field(default=None, max_length=8192)
    gaf_public_key_algorithm: str | None = Field(default=None, max_length=64)
    capabilities: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class MobileTrustedDeviceItem(BaseModel):
    id: UUID
    stable_device_id: str
    device_label: str
    platform: str
    status: str
    device_public_key_fingerprint: str
    wg_public_key_fingerprint: str
    wg_assigned_ip: str | None = None
    wg_allowed_ips: str | None = None
    wg_dns: str | None = None
    wg_endpoint: str | None = None
    wg_server_public_key: str | None = None
    gaf_public_key_fingerprint: str | None = None
    capabilities: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    approved_at: datetime | None = None
    revoked_at: datetime | None = None
    last_seen_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    wg_edge_sync_status: str | None = None
    wg_edge_synced_at: datetime | None = None


class MobileTrustedDeviceBindResponse(BaseModel):
    device: MobileTrustedDeviceItem
    tunnel: dict[str, Any] = Field(default_factory=dict)
    gaf_e2ee_ready: bool = False


class MobileTrustedDeviceListResponse(BaseModel):
    items: list[MobileTrustedDeviceItem]


class MobileActiveTunnelMetadataResponse(BaseModel):
    device_id: UUID
    tunnel: dict[str, Any] = Field(default_factory=dict)


class MobileDeviceAuditEventItem(BaseModel):
    id: int
    user_id: UUID | None = None
    actor_user_id: UUID | None = None
    device_id: UUID | None = None
    pairing_challenge_id: UUID | None = None
    transfer_request_id: UUID | None = None
    event_type: str
    result: str
    ip_address: str | None = None
    user_agent: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class MobileDeviceAuditEventListResponse(BaseModel):
    items: list[MobileDeviceAuditEventItem]


class MobileTrustedDeviceRevokeRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=256)


class MobileTrustedDeviceRotateWgRequest(BaseModel):
    wg_public_key: str = Field(min_length=32, max_length=128)


class MobileTrustedDeviceRotateWgResponse(BaseModel):
    device: MobileTrustedDeviceItem


class MobileDeviceTransferStartRequest(BaseModel):
    old_device_id: UUID
    new_device_id: UUID
    transfer_public_key: str = Field(min_length=32, max_length=8192)
    transfer_public_key_algorithm: str = Field(default="x25519", max_length=64)
    metadata: dict[str, Any] = Field(default_factory=dict)


class MobileDeviceTransferOldConfirmRequest(BaseModel):
    signed_transfer_nonce: str = Field(min_length=32, max_length=4096)
    encrypted_transfer_blob: str = Field(min_length=32, max_length=262_144)
    encrypted_transfer_blob_metadata: dict[str, Any] = Field(default_factory=dict)


class MobileDeviceTransferAdminDecisionRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=256)


class MobileDeviceTransferEmailConfirmRequest(BaseModel):
    confirmation_token: str = Field(min_length=24, max_length=256)


class MobileDeviceTransferCompleteRequest(BaseModel):
    new_device_id: UUID


class MobileDeviceTransferItem(BaseModel):
    id: UUID
    user_id: UUID
    old_device_id: UUID | None = None
    new_device_id: UUID | None = None
    status: str
    transfer_public_key_fingerprint: str
    transfer_public_key_algorithm: str
    has_encrypted_transfer_blob: bool
    encrypted_transfer_blob_metadata: dict[str, Any] = Field(default_factory=dict)
    old_device_confirmed_at: datetime | None = None
    admin_approved_by: UUID | None = None
    admin_approved_at: datetime | None = None
    email_confirmed_at: datetime | None = None
    completed_at: datetime | None = None
    expires_at: datetime
    created_at: datetime
    updated_at: datetime


class MobileDeviceTransferListResponse(BaseModel):
    items: list[MobileDeviceTransferItem]


class MobileDeviceTransferResponse(BaseModel):
    transfer: MobileDeviceTransferItem


class MobileDeviceTransferCompleteResponse(BaseModel):
    transfer: MobileDeviceTransferItem
    encrypted_transfer_blob: str
    encrypted_transfer_blob_metadata: dict[str, Any] = Field(default_factory=dict)
