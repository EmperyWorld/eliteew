# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Typed Admin and WebSocket contracts for desktop-client Air enrollment.
# ---

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from api.schemas.desktop_client.models import DeviceRequestV1
from pydantic import BaseModel, ConfigDict, Field


class AirEnrollCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    idempotency_key: str = Field(min_length=8, max_length=128)
    mode: Literal["offline", "cloud", "both"] = "offline"
    label: str | None = Field(default=None, max_length=200)
    slug: str | None = Field(default=None, min_length=2, max_length=64)
    allowed_email: str | None = Field(default=None, max_length=320)
    expires_at: datetime | None = None
    allow_fofline: bool = False


class AirEnrollEventResponse(BaseModel):
    sequence: int
    event: str
    lifecycle: str
    cleanup_state: str
    reason: str | None = None
    detail: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class AirEnrollSessionResponse(BaseModel):
    id: UUID
    mode: str
    label: str | None = None
    slug: str | None = None
    allowed_email: str | None = None
    allow_fofline: bool = False
    seat_expires_at: datetime | None = None
    created_by: str
    port: int
    lifecycle: str
    cleanup_state: str
    attempt_count: int
    license_id: UUID | None = None
    request_id: str | None = None
    ecap_sha256: str | None = None
    ecap_size: int | None = None
    reissue_of: UUID | None = None
    delivery_generation: int
    provision_expires_at: datetime
    code_expires_at: datetime | None = None
    ready_at: datetime | None = None
    revealed_at: datetime | None = None
    claimed_at: datetime | None = None
    sealed_at: datetime | None = None
    activation_acked_at: datetime | None = None
    terminal_at: datetime | None = None
    local_closed_at: datetime | None = None
    sg_closed_at: datetime | None = None
    last_error_code: str | None = None
    created_at: datetime
    updated_at: datetime
    events: list[AirEnrollEventResponse] = Field(default_factory=list)


class AirEnrollSessionListResponse(BaseModel):
    sessions: list[AirEnrollSessionResponse] = Field(default_factory=list)
    total: int
    limit: int
    offset: int


class AirEnrollRevealResponse(BaseModel):
    session: AirEnrollSessionResponse
    access_code: str = Field(
        min_length=56,
        max_length=64,
        description="Show-once grouped Air code; never returned by later GET.",
    )


class AirEnrollReissueRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    idempotency_key: str = Field(min_length=8, max_length=128)


class AirEnrollAuthRequestFrame(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["auth_and_request"]
    selector: str = Field(min_length=16, max_length=16)
    secret: str = Field(min_length=26, max_length=26)
    device_request: DeviceRequestV1


class AirEnrollActivationAckFrame(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["activation_ack"]
    request_id: str = Field(min_length=8, max_length=128)
    activation_token: str = Field(min_length=16, max_length=256)
    device_signing_pubkey: str = Field(min_length=64, max_length=64)
    proof_nonce: str = Field(min_length=16, max_length=128)
    proof_signature: str = Field(min_length=128, max_length=128)


class AirEnrollImportNackFrame(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["import_nack"]
    code: str = Field(
        min_length=3,
        max_length=64,
        pattern=r"^[a-z0-9_]+$",
    )
