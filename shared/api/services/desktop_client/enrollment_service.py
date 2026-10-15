# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Persist device_request enrollment rows and idempotent sealed issue replay.
# Invariants:
# - Unique request_id; conflicting issue_body_hash → 409.
# - Concurrent issue for one request_id is serialized via pg_advisory_lock.
# - mark_issued rejects silent ON CONFLICT no-ops (hash conflict → 409).
# - Activation consume retries succeed only after the same token/key/proof verifies.
# - Stores sealed package JSON only (no plaintext license keys beyond package).
# Related:
# - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-03
# ---

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from api.services.desktop_client.license_service import DesktopClientError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ActivationConsumeResult:
    license_id: UUID
    status: str


def activation_proof_message(
    *,
    request_id: str,
    token_sha256: str,
    nonce: str,
) -> bytes:
    return f"activate_v1|{request_id}|{token_sha256}|{nonce}".encode()


def request_advisory_lock_key(request_id: str) -> int:
    """Stable signed 63-bit key for pg_advisory_lock (one issuer at a time per request_id)."""
    digest = hashlib.sha256(f"eliteew-enrollment-issue:{request_id}".encode()).digest()
    return int.from_bytes(digest[:8], "big") & 0x7FFFFFFFFFFFFFFF


def issue_body_hash(
    *,
    mode: str,
    label: str | None,
    slug: str | None,
    allowed_email: str | None,
    allow_fofline: bool,
    request_id: str,
    expires_at: str | None = None,
) -> str:
    payload = {
        "mode": mode,
        "label": label or "",
        "slug": slug or "",
        "allowed_email": allowed_email or "",
        "allow_fofline": bool(allow_fofline),
        "request_id": request_id,
        "expires_at": expires_at or "",
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


class EnrollmentService:
    def __init__(self, pool: Any) -> None:
        self._pool = pool

    @asynccontextmanager
    async def issue_serialization_lock(self, request_id: str) -> AsyncIterator[None]:
        """Hold a session advisory lock for the full sealed-issue critical section."""
        key = request_advisory_lock_key(request_id)
        async with self._pool.acquire() as conn:
            await conn.execute("SELECT pg_advisory_lock($1)", key)
            try:
                logger.debug("[STEP] enrollment_issue_lock_acquired request_id=%s", request_id)
                yield
            finally:
                await conn.execute("SELECT pg_advisory_unlock($1)", key)
                logger.debug("[STEP] enrollment_issue_lock_released request_id=%s", request_id)

    async def get_idempotent_package(self, *, request_id: str, body_hash: str) -> dict[str, Any] | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT status, issue_body_hash, issued_package_json
                FROM desktop_client_enrollment_requests
                WHERE request_id = $1
                """,
                request_id,
            )
        if row is None:
            return None
        if row["status"] != "issued" or not row["issued_package_json"]:
            if row["issue_body_hash"] and row["issue_body_hash"] != body_hash:
                raise DesktopClientError(
                    "device_request_conflict",
                    "device request already used with different issue parameters",
                    http_status=409,
                )
            return None
        if row["issue_body_hash"] != body_hash:
            raise DesktopClientError(
                "device_request_conflict",
                "device request already used with different issue parameters",
                http_status=409,
            )
        pkg = row["issued_package_json"]
        if isinstance(pkg, str):
            pkg = json.loads(pkg)
        if not isinstance(pkg, dict) or "package" not in pkg:
            return None
        logger.info("[STEP] enrollment_idempotent_hit request_id=%s", request_id)
        return pkg

    async def mark_issued(
        self,
        *,
        verified: dict[str, str],
        license_id: UUID,
        package: dict[str, Any],
        filename: str,
        body_hash: str,
        activation_token_hash: str | None = None,
        issued_peer_slug: str | None = None,
    ) -> None:
        expires_at = datetime.fromisoformat(verified["expires_at"].replace("Z", "+00:00"))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        payload = {"package": package, "filename": filename}
        peer_slug = (issued_peer_slug or "").strip() or None
        async with self._pool.acquire() as conn:
            status = await conn.execute(
                """
                INSERT INTO desktop_client_enrollment_requests (
                    request_id, product_id, app_identifier,
                    device_signing_pubkey, capsule_recipient_pubkey, recipient_key_id,
                    machine_fingerprint_hash, nonce, status, expires_at,
                    license_id, issued_package_json, issue_body_hash,
                    activation_token_hash, issued_peer_slug, issued_at, updated_at
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,'issued',$9,$10,$11::jsonb,$12,$13,$14,NOW(),NOW()
                )
                ON CONFLICT (request_id) DO UPDATE SET
                    status = 'issued',
                    license_id = EXCLUDED.license_id,
                    issued_package_json = EXCLUDED.issued_package_json,
                    issue_body_hash = EXCLUDED.issue_body_hash,
                    activation_token_hash = COALESCE(
                        EXCLUDED.activation_token_hash,
                        desktop_client_enrollment_requests.activation_token_hash
                    ),
                    issued_peer_slug = COALESCE(
                        EXCLUDED.issued_peer_slug,
                        desktop_client_enrollment_requests.issued_peer_slug
                    ),
                    issued_at = NOW(),
                    updated_at = NOW()
                WHERE desktop_client_enrollment_requests.issue_body_hash IS NULL
                   OR desktop_client_enrollment_requests.issue_body_hash = EXCLUDED.issue_body_hash
                """,
                verified["request_id"],
                verified["product_id"],
                verified["app_identifier"],
                verified["device_signing_pubkey"],
                verified["capsule_recipient_pubkey"],
                verified["recipient_key_id"],
                verified["machine_fingerprint_hash"],
                verified["nonce"],
                expires_at,
                license_id,
                json.dumps(payload),
                body_hash,
                activation_token_hash,
                peer_slug,
            )
            # asyncpg: "INSERT 0 1" | "UPDATE 1" | "UPDATE 0" (WHERE filtered conflict)
            if str(status).endswith(" 0"):
                raise DesktopClientError(
                    "device_request_conflict",
                    "device request already used with different issue parameters",
                    http_status=409,
                )
        logger.info(
            "[STEP] enrollment_marked_issued request_id=%s license_id=%s",
            verified["request_id"],
            license_id,
        )

    async def consume_activation_token(
        self,
        *,
        request_id: str,
        activation_token: str,
        device_signing_pubkey: str,
        proof_message: bytes,
        proof_signature_hex: str,
    ) -> ActivationConsumeResult:
        """Consume once; identical valid retry returns already_consumed."""
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

        token_hash = hashlib.sha256(activation_token.encode("utf-8")).hexdigest()
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT license_id, activation_token_hash, activation_consumed_at,
                       device_signing_pubkey, status
                FROM desktop_client_enrollment_requests
                WHERE request_id = $1
                """,
                request_id,
            )
            if row is None:
                raise DesktopClientError(
                    "activation_unknown_request",
                    "activation request not found",
                    http_status=404,
                )
            if row["status"] != "issued":
                raise DesktopClientError(
                    "activation_not_issued",
                    "enrollment is not issued",
                    http_status=409,
                )
            stored = row["activation_token_hash"]
            if not stored or stored != token_hash:
                raise DesktopClientError(
                    "activation_token_invalid",
                    "activation token invalid",
                    http_status=400,
                )
            expected_pk = (row["device_signing_pubkey"] or "").strip().lower()
            if expected_pk != device_signing_pubkey.strip().lower():
                raise DesktopClientError(
                    "activation_device_mismatch",
                    "device signing key mismatch",
                    http_status=403,
                )
            try:
                Ed25519PublicKey.from_public_bytes(bytes.fromhex(expected_pk)).verify(
                    bytes.fromhex(proof_signature_hex),
                    proof_message,
                )
            except Exception as exc:
                raise DesktopClientError(
                    "activation_bad_proof",
                    "activation proof invalid",
                    http_status=400,
                ) from exc
            license_id = row["license_id"]
            if license_id is None:
                raise DesktopClientError(
                    "activation_no_license",
                    "enrollment has no license",
                    http_status=500,
                )
            if row["activation_consumed_at"] is not None:
                logger.info(
                    "[STEP] activation_idempotent_replay request_id=%s license_id=%s",
                    request_id,
                    license_id,
                )
                return ActivationConsumeResult(
                    license_id=license_id,
                    status="already_consumed",
                )
            updated = await conn.fetchrow(
                """
                UPDATE desktop_client_enrollment_requests
                SET activation_consumed_at = NOW(), updated_at = NOW()
                WHERE request_id = $1 AND activation_consumed_at IS NULL
                RETURNING license_id
                """,
                request_id,
            )
            if updated is None:
                return ActivationConsumeResult(
                    license_id=license_id,
                    status="already_consumed",
                )
            logger.info(
                "[STEP] activation_consumed request_id=%s license_id=%s",
                request_id,
                license_id,
            )
            return ActivationConsumeResult(
                license_id=license_id,
                status="activated",
            )
