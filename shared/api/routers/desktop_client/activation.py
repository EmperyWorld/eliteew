# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Consume Capsule v2 one-time activation token with Ed25519 device proof (Wave 4).
# Invariants:
# - Token compared as SHA-256 hash only; identical valid replay is idempotent.
# - Proof message: activate_v1|{request_id}|{token_sha256}|{nonce}
# - After successful consume: fleet peer revoke + migration completed (Wave 9).
# Related:
# - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §4 / §12g
# ---

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from api.core.database_manager import get_asyncpg_pool
from api.schemas.desktop_client.models import (
    CapsuleActivationConsumeRequest,
    CapsuleActivationConsumeResponse,
)
from api.services.desktop_client.enrollment_service import (
    EnrollmentService,
    activation_proof_message,
)
from api.services.desktop_client.fleet_migration_service import FleetMigrationService
from api.services.desktop_client.license_service import DesktopClientError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Desktop Client Activation"])


@router.post("/activation/consume", response_model=CapsuleActivationConsumeResponse)
async def consume_activation(
    body: CapsuleActivationConsumeRequest,
    request: Request,
) -> CapsuleActivationConsumeResponse:
    """One-time Capsule v2 activation after device-bound import."""
    import hashlib

    token_hash = hashlib.sha256(body.activation_token.encode("utf-8")).hexdigest()
    proof_msg = activation_proof_message(
        request_id=body.request_id,
        token_sha256=token_hash,
        nonce=body.proof_nonce,
    )
    pool = await get_asyncpg_pool()
    enrollment = EnrollmentService(pool)
    try:
        activation = await enrollment.consume_activation_token(
            request_id=body.request_id,
            activation_token=body.activation_token,
            device_signing_pubkey=body.device_signing_pubkey,
            proof_message=proof_msg,
            proof_signature_hex=body.proof_signature,
        )
    except DesktopClientError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": str(exc)},
        ) from exc

    client_ip = request.client.host if request.client else None
    try:
        fleet = FleetMigrationService(pool)
        await fleet.complete_migration_after_activation(
            activation.license_id,
            client_ip=client_ip,
        )
    except Exception:
        logger.exception(
            "[STEP] fleet_migration_after_activation_skip license_id=%s",
            activation.license_id,
        )

    logger.info(
        "[STEP] activation_consume_ok request_id=%s license_id=%s ip=%s",
        body.request_id,
        activation.license_id,
        client_ip,
    )
    return CapsuleActivationConsumeResponse(
        ok=True,
        license_id=activation.license_id,
        status=activation.status,
    )
