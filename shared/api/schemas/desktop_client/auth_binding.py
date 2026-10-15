# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic models for desktop-client atomic auth binding routes (Wave 1).
# Invariants:
# - Public responses never include internal audit reasons.
# Related:
# - routers/desktop_client/auth_binding.py
# - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
# ---

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AuthChallengeRequest(BaseModel):
    device_pubkey: str = Field(min_length=16, max_length=512)


class AuthChallengeResponse(BaseModel):
    nonce: str
    expires_in_sec: int


class AuthTicketIssueRequest(BaseModel):
    device_pubkey: str = Field(min_length=16, max_length=512)
    device_signature_hex: str = Field(min_length=64, max_length=256)
    nonce: str = Field(min_length=8, max_length=128)
    license_id: UUID
    device_id: UUID | None = None
    client_id: str = Field(min_length=8, max_length=64)
    channel: str = Field(min_length=4, max_length=16)
    dpop_jkt: str = Field(min_length=8, max_length=256)
    pkce_challenge: str = Field(min_length=16, max_length=256)
    redirect_uri: str | None = Field(default=None, max_length=2048)
    jti: str = Field(min_length=8, max_length=128)
    issued_at: int = Field(ge=0)


class AuthTicketIssueResponse(BaseModel):
    ticket: str
    ticket_id: str
    expires_at: datetime


class AuthPrecheckRequest(BaseModel):
    ticket: str = Field(min_length=16, max_length=512)
    keycloak_auth_session_id: str = Field(min_length=8, max_length=256)
    idempotency_key: str | None = Field(default=None, max_length=128)


class AuthPrecheckResponse(BaseModel):
    allowed: bool
    ticket_id: str
    binding_id: str | None = None
    authz_epoch: int | None = None


class AuthCommitRequest(BaseModel):
    ticket: str = Field(min_length=16, max_length=512)
    keycloak_sub: str = Field(min_length=8, max_length=256)
    email: str | None = Field(default=None, max_length=320)
    email_verified: bool = False
    idempotency_key: str | None = Field(default=None, max_length=128)


class AuthCommitResponse(BaseModel):
    allowed: bool
    binding_id: str
    authz_epoch: int
    keycloak_sub: str


class AuthRefreshDecisionRequest(BaseModel):
    binding_id: str = Field(min_length=8, max_length=128)
    keycloak_sub: str = Field(min_length=8, max_length=256)
    client_id: str = Field(min_length=8, max_length=64)
    dpop_jkt: str = Field(min_length=8, max_length=256)
    authz_epoch: int = Field(ge=1)
    idempotency_key: str | None = Field(default=None, max_length=128)


class AuthRefreshDecisionResponse(BaseModel):
    allowed: bool
    binding_id: str
    authz_epoch: int


class AuthPolicyErrorResponse(BaseModel):
    code: str
    message: str
