# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP routes for desktop atomic conditional access (challenge, ticket, SPI decision).
# Invariants:
# - Public routes are JWT-exempt; internal SPI routes require binding SPI token.
# - Public denials use generic auth_policy_denied body.
# Related:
# - services/desktop_client/auth_binding.py
# - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
# ---

from __future__ import annotations

import hmac
import logging
import os

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from api.core.database_manager import get_asyncpg_pool
from api.schemas.desktop_client.auth_binding import (
    AuthChallengeRequest,
    AuthChallengeResponse,
    AuthCommitRequest,
    AuthCommitResponse,
    AuthPolicyErrorResponse,
    AuthPrecheckRequest,
    AuthPrecheckResponse,
    AuthRefreshDecisionRequest,
    AuthRefreshDecisionResponse,
    AuthTicketIssueRequest,
    AuthTicketIssueResponse,
)
from api.services.desktop_client import DesktopClientError
from api.services.desktop_client.auth_binding import DesktopClientAuthBindingService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Desktop Client Auth Binding"])


async def get_auth_binding_service(
    pool=Depends(get_asyncpg_pool),  # noqa: B008
) -> DesktopClientAuthBindingService:
    return DesktopClientAuthBindingService(pool)


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _require_binding_spi_token(header_value: str | None) -> None:
    expected = os.environ.get("DESKTOP_CLIENT_BINDING_SPI_TOKEN", "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="DESKTOP_CLIENT_BINDING_SPI_TOKEN not configured",
        )
    if not header_value or not hmac.compare_digest(header_value, expected):
        raise HTTPException(status_code=401, detail="Invalid binding SPI token")


def _http_error(exc: DesktopClientError) -> HTTPException:
    if exc.code == "rate_limited":
        return HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        )
    return HTTPException(
        status_code=exc.http_status,
        detail=AuthPolicyErrorResponse(code=exc.code, message=exc.message).model_dump(),
    )


@router.post("/auth/challenge", response_model=AuthChallengeResponse)
async def auth_challenge(
    body: AuthChallengeRequest,
    request: Request,
    service: DesktopClientAuthBindingService = Depends(get_auth_binding_service),  # noqa: B008
) -> AuthChallengeResponse:
    try:
        view = await service.issue_auth_challenge(
            device_pubkey=body.device_pubkey,
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise _http_error(exc) from exc
    return AuthChallengeResponse(nonce=view.nonce, expires_in_sec=view.expires_in_sec)


@router.post("/auth/ticket", response_model=AuthTicketIssueResponse)
async def auth_ticket_issue(
    body: AuthTicketIssueRequest,
    request: Request,
    service: DesktopClientAuthBindingService = Depends(get_auth_binding_service),  # noqa: B008
) -> AuthTicketIssueResponse:
    try:
        view = await service.issue_ticket(
            device_pubkey=body.device_pubkey,
            device_signature_hex=body.device_signature_hex,
            nonce=body.nonce,
            license_id=body.license_id,
            device_id=body.device_id,
            client_id=body.client_id,
            channel=body.channel,
            dpop_jkt=body.dpop_jkt,
            pkce_challenge=body.pkce_challenge,
            redirect_uri=body.redirect_uri,
            jti=body.jti,
            issued_at=body.issued_at,
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise _http_error(exc) from exc
    return AuthTicketIssueResponse(
        ticket=view.ticket,
        ticket_id=view.ticket_id,
        expires_at=view.expires_at,
    )


@router.post("/auth/internal/precheck", response_model=AuthPrecheckResponse)
async def auth_internal_precheck(
    body: AuthPrecheckRequest,
    request: Request,
    x_desktop_client_binding_spi_token: str | None = Header(default=None),
    service: DesktopClientAuthBindingService = Depends(get_auth_binding_service),  # noqa: B008
) -> AuthPrecheckResponse:
    _require_binding_spi_token(x_desktop_client_binding_spi_token)
    try:
        view = await service.precheck(
            ticket_plaintext=body.ticket,
            keycloak_auth_session_id=body.keycloak_auth_session_id,
            idempotency_key=body.idempotency_key,
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise _http_error(exc) from exc
    return AuthPrecheckResponse(
        allowed=view.allowed,
        ticket_id=view.ticket_id,
        binding_id=view.binding_id,
        authz_epoch=view.authz_epoch,
    )


@router.post("/auth/internal/commit", response_model=AuthCommitResponse)
async def auth_internal_commit(
    body: AuthCommitRequest,
    request: Request,
    x_desktop_client_binding_spi_token: str | None = Header(default=None),
    service: DesktopClientAuthBindingService = Depends(get_auth_binding_service),  # noqa: B008
) -> AuthCommitResponse:
    _require_binding_spi_token(x_desktop_client_binding_spi_token)
    try:
        view = await service.commit(
            ticket_plaintext=body.ticket,
            keycloak_sub=body.keycloak_sub,
            email=body.email,
            email_verified=body.email_verified,
            idempotency_key=body.idempotency_key,
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise _http_error(exc) from exc
    return AuthCommitResponse(
        allowed=view.allowed,
        binding_id=view.binding_id,
        authz_epoch=view.authz_epoch,
        keycloak_sub=view.keycloak_sub,
    )


@router.post("/auth/internal/refresh-decision", response_model=AuthRefreshDecisionResponse)
async def auth_internal_refresh_decision(
    body: AuthRefreshDecisionRequest,
    request: Request,
    x_desktop_client_binding_spi_token: str | None = Header(default=None),
    service: DesktopClientAuthBindingService = Depends(get_auth_binding_service),  # noqa: B008
) -> AuthRefreshDecisionResponse:
    _require_binding_spi_token(x_desktop_client_binding_spi_token)
    try:
        view = await service.refresh_decision(
            binding_id=body.binding_id,
            keycloak_sub=body.keycloak_sub,
            client_id=body.client_id,
            dpop_jkt=body.dpop_jkt,
            authz_epoch=body.authz_epoch,
            idempotency_key=body.idempotency_key,
            client_ip=_client_ip(request),
        )
    except DesktopClientError as exc:
        raise _http_error(exc) from exc
    return AuthRefreshDecisionResponse(
        allowed=view.allowed,
        binding_id=view.binding_id,
        authz_epoch=view.authz_epoch,
    )
