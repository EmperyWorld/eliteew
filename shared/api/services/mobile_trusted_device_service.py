#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Service layer for MobileAndroid trusted-device pairing, public key registration, audit, revoke, and WireGuard key rotation.
# Invariants:
# - Device, WireGuard, and GAF private keys never enter this service.
# - Pairing codes are stored only as hashes; raw codes are returned only once to the web session.
# - Audit events must not include raw keys, signatures, bearer tokens, pairing codes, or plaintext messages.
# - Revoke deletes matching android rows in user_mobile_push_tokens (stable_device_id).
# Related:
# - api.routers.mobile_trusted_devices, documentation/product/mobile/MOBILE-TRUSTED-DEVICE-BINDING.md
# ---

from __future__ import annotations

import base64
import hashlib
import json
import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-not-found]
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import HTTPException, status  # type: ignore[import-untyped]

from api.core.unified_config import unified_settings
from api.schemas.mobile_trusted_devices import (
    MobileDeviceAuditEventItem,
    MobileDeviceTransferCompleteResponse,
    MobileDeviceTransferItem,
    MobileDeviceTransferOldConfirmRequest,
    MobileDeviceTransferStartRequest,
    MobileTrustedDeviceBindRequest,
    MobileTrustedDeviceBindResponse,
    MobileTrustedDeviceItem,
)
from api.services.mobile_private_tunnel_edge_sync import (
    edge_sync_audit_details,
    edge_sync_enqueue_ready,
    finalize_edge_sync_after_commit,
)
from api.services.mobile_trusted_device_email import MobileTrustedDeviceEmailNotifier

PAIRING_TTL_SECONDS = 5 * 60
PAIRING_CODE_DIGITS = 8
MAX_PAIRING_ATTEMPTS = 5
TRANSFER_TTL_SECONDS = 24 * 60 * 60
TRANSFER_EMAIL_TTL_SECONDS = 30 * 60

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _json_dumps(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


def _row_get(row: Any, key: str, default: Any = None) -> Any:
    if hasattr(row, "get"):
        return row.get(key, default)
    try:
        return row[key]
    except KeyError, TypeError, IndexError:
        return default


def _stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _fingerprint(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _b64decode(raw: str, *, field: str) -> bytes:
    normalized = raw.strip()
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field} is required")
    padded = normalized + "=" * (-len(normalized) % 4)
    try:
        return base64.b64decode(padded, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field} must be base64") from exc


def _validate_device_public_key(raw_key: str, algorithm: str) -> tuple[bytes, str]:
    key_bytes = _b64decode(raw_key, field="device_public_key")
    if algorithm == "ed25519":
        if len(key_bytes) != 32:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="device_public_key must be an Ed25519 32-byte public key",
            )
    elif algorithm == "p256-es256":
        try:
            public_key = serialization.load_der_public_key(key_bytes)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="device_public_key must be DER SubjectPublicKeyInfo for p256-es256",
            ) from exc
        if not isinstance(public_key, ec.EllipticCurvePublicKey) or not isinstance(public_key.curve, ec.SECP256R1):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="device_public_key must be a P-256 public key",
            )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported device key algorithm")
    return key_bytes, _fingerprint(key_bytes)


def _validate_signature(
    *,
    algorithm: str,
    public_key_bytes: bytes,
    signature_b64: str,
    message: str,
    signature_field: str = "signed_challenge",
) -> None:
    signature = _b64decode(signature_b64, field=signature_field)
    try:
        if algorithm == "ed25519":
            Ed25519PublicKey.from_public_bytes(public_key_bytes).verify(signature, message.encode("utf-8"))
        elif algorithm == "p256-es256":
            public_key = serialization.load_der_public_key(public_key_bytes)
            if not isinstance(public_key, ec.EllipticCurvePublicKey):
                raise InvalidSignature
            public_key.verify(signature, message.encode("utf-8"), ec.ECDSA(hashes.SHA256()))
        else:
            raise InvalidSignature
    except InvalidSignature as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device signature") from exc


def _validate_wireguard_public_key(raw_key: str) -> tuple[bytes, str]:
    key_bytes = _b64decode(raw_key, field="wg_public_key")
    if len(key_bytes) != 32:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="wg_public_key must be a 32-byte key")
    return key_bytes, _fingerprint(key_bytes)


def _optional_key_fingerprint(raw_key: str | None) -> str | None:
    if not raw_key:
        return None
    return _fingerprint(raw_key.strip().encode("utf-8"))


def _validate_transfer_public_key(raw_key: str, algorithm: str) -> tuple[str, str]:
    normalized = raw_key.strip()
    key_bytes = _b64decode(normalized, field="transfer_public_key")
    if algorithm == "x25519" and len(key_bytes) != 32:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="transfer_public_key must be a 32-byte X25519 public key",
        )
    if algorithm == "p256-ecdh":
        try:
            public_key = serialization.load_der_public_key(key_bytes)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="transfer_public_key must be DER SubjectPublicKeyInfo for p256-ecdh",
            ) from exc
        if not isinstance(public_key, ec.EllipticCurvePublicKey) or not isinstance(public_key.curve, ec.SECP256R1):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="transfer_public_key must be a P-256 public key",
            )
    if algorithm not in {"x25519", "p256-ecdh"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported transfer key algorithm")
    return normalized, _fingerprint(key_bytes)


class MobileTrustedDeviceService:
    def __init__(
        self,
        db_pool: asyncpg.Pool,
        *,
        email_notifier: MobileTrustedDeviceEmailNotifier | None = None,
    ) -> None:
        self.db_pool = db_pool
        self.email_notifier = email_notifier or MobileTrustedDeviceEmailNotifier()

    async def create_pairing_challenge(
        self,
        *,
        user_id: UUID,
        ip_address: str | None,
        user_agent: str | None,
        device_label_hint: str | None = None,
        prepare_gaf_e2ee: bool = False,
    ) -> dict[str, Any]:
        async with self.db_pool.acquire() as conn:
            await self._require_trusted_user(conn, user_id)
            challenge_id = uuid4()
            pairing_code = f"{secrets.randbelow(10**PAIRING_CODE_DIGITS):0{PAIRING_CODE_DIGITS}d}"
            challenge_nonce = secrets.token_urlsafe(32)
            expires_at = _now() + timedelta(seconds=PAIRING_TTL_SECONDS)
            metadata = {
                "device_label_hint": (device_label_hint or "").strip()[:128] or None,
                "prepare_gaf_e2ee": bool(prepare_gaf_e2ee),
                "fresh_auth_enforcement": "required_by_router",
            }
            await conn.execute(
                """
                INSERT INTO public.mobile_device_pairing_challenges (
                    id, user_id, code_hash, challenge_nonce, expires_at, max_attempts,
                    created_ip, created_user_agent, metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
                """,
                challenge_id,
                user_id,
                self._hash_pairing_code(challenge_id, pairing_code),
                challenge_nonce,
                expires_at,
                MAX_PAIRING_ATTEMPTS,
                ip_address,
                user_agent,
                _json_dumps(metadata),
            )
            await self._audit(
                conn,
                user_id=user_id,
                actor_user_id=user_id,
                event_type="pairing_challenge_created",
                result="ok",
                pairing_challenge_id=challenge_id,
                ip_address=ip_address,
                user_agent=user_agent,
                details={
                    "expires_at": expires_at.isoformat(),
                    "prepare_gaf_e2ee": bool(prepare_gaf_e2ee),
                },
            )
            return {
                "challenge_id": challenge_id,
                "pairing_code": pairing_code,
                "challenge_nonce": challenge_nonce,
                "expires_at": expires_at,
                "qr_payload": {
                    "v": 1,
                    "type": "eliteew_mobile_device_pairing",
                    "challenge_id": str(challenge_id),
                    "pairing_code": pairing_code,
                    "challenge_nonce": challenge_nonce,
                    "expires_at": expires_at.isoformat(),
                },
            }

    async def resolve_pairing_challenge(
        self,
        *,
        user_id: UUID,
        pairing_code: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> dict[str, Any]:
        normalized_code = pairing_code.strip()
        async with self.db_pool.acquire() as conn, conn.transaction():
            await self._require_trusted_user(conn, user_id)
            rows = await conn.fetch(
                """
                SELECT id, user_id, code_hash, challenge_nonce, status, attempts, max_attempts,
                       expires_at, metadata
                FROM public.mobile_device_pairing_challenges
                WHERE user_id = $1
                  AND status = 'pending'
                  AND expires_at > now()
                  AND attempts < max_attempts
                ORDER BY created_at DESC
                LIMIT 5
                FOR UPDATE
                """,
                user_id,
            )
            for row in rows:
                actual_hash = self._hash_pairing_code(row["id"], normalized_code)
                if secrets.compare_digest(str(row["code_hash"]), actual_hash):
                    await self._audit(
                        conn,
                        user_id=user_id,
                        actor_user_id=user_id,
                        pairing_challenge_id=row["id"],
                        event_type="pairing_challenge_resolved",
                        result="ok",
                        ip_address=ip_address,
                        user_agent=user_agent,
                    )
                    metadata = self._parse_metadata(row["metadata"])
                    return {
                        "challenge_id": row["id"],
                        "pairing_code": normalized_code,
                        "challenge_nonce": row["challenge_nonce"],
                        "expires_at": row["expires_at"],
                        "prepare_gaf_e2ee": bool(metadata.get("prepare_gaf_e2ee")),
                    }
            if rows:
                latest = rows[0]
                await conn.execute(
                    """
                    UPDATE public.mobile_device_pairing_challenges
                    SET attempts = attempts + 1
                    WHERE id = $1
                    """,
                    latest["id"],
                )
                await self._audit(
                    conn,
                    user_id=user_id,
                    actor_user_id=user_id,
                    pairing_challenge_id=latest["id"],
                    event_type="pairing_challenge_resolve_failed",
                    result="denied",
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details={"reason": "invalid_pairing_code"},
                )
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid pairing code")
            await self._audit(
                conn,
                user_id=user_id,
                actor_user_id=user_id,
                event_type="pairing_challenge_resolve_failed",
                result="denied",
                ip_address=ip_address,
                user_agent=user_agent,
                details={"reason": "challenge_not_found_or_expired"},
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pairing challenge not found")

    async def bind_device(
        self,
        *,
        user_id: UUID,
        body: MobileTrustedDeviceBindRequest,
        ip_address: str | None,
        user_agent: str | None,
    ) -> MobileTrustedDeviceBindResponse:
        device_key_bytes, device_key_fingerprint = _validate_device_public_key(
            body.device_public_key,
            body.device_public_key_algorithm,
        )
        _validate_signature(
            algorithm=body.device_public_key_algorithm,
            public_key_bytes=device_key_bytes,
            signature_b64=body.signed_challenge,
            message=await self._challenge_nonce_for_signature(body.challenge_id),
        )
        _, wg_fingerprint = _validate_wireguard_public_key(body.wg_public_key)
        gaf_fingerprint = _optional_key_fingerprint(body.gaf_public_key)

        async with self.db_pool.acquire() as conn, conn.transaction():
            await self._require_trusted_user(conn, user_id)
            challenge = await conn.fetchrow(
                """
                    SELECT id, user_id, code_hash, challenge_nonce, status, attempts, max_attempts, expires_at
                    FROM public.mobile_device_pairing_challenges
                    WHERE id = $1
                    FOR UPDATE
                    """,
                body.challenge_id,
            )
            if not challenge or str(challenge["user_id"]) != str(user_id):
                await self._audit(
                    conn,
                    user_id=user_id,
                    actor_user_id=user_id,
                    event_type="device_bind_failed",
                    result="denied",
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details={"reason": "challenge_not_found"},
                )
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pairing challenge not found")
            await self._validate_challenge_for_bind(conn, user_id, body, challenge, ip_address, user_agent)
            wg_config = self._trusted_device_wg_config()
            wg_assigned_ip = await self._next_wg_assigned_ip(conn)
            device = await conn.fetchrow(
                """
                    INSERT INTO public.mobile_trusted_devices (
                        user_id, stable_device_id, device_label, platform, status,
                        device_public_key_algorithm, device_public_key, device_public_key_fingerprint,
                        wg_public_key, wg_public_key_fingerprint,
                        wg_assigned_ip, wg_allowed_ips, wg_dns, wg_endpoint, wg_server_public_key,
                        gaf_public_key_algorithm, gaf_public_key, gaf_public_key_fingerprint,
                        capabilities, metadata, approved_at, last_seen_at
                    )
                    VALUES (
                        $1, $2, $3, 'android', 'active',
                        $4, $5, $6,
                        $7, $8,
                        $9::inet, $10, $11, $12, $13,
                        $14, $15, $16,
                        $17::jsonb, $18::jsonb, now(), now()
                    )
                    ON CONFLICT (user_id, stable_device_id) DO UPDATE SET
                        device_label = EXCLUDED.device_label,
                        status = 'active',
                        device_public_key_algorithm = EXCLUDED.device_public_key_algorithm,
                        device_public_key = EXCLUDED.device_public_key,
                        device_public_key_fingerprint = EXCLUDED.device_public_key_fingerprint,
                        wg_public_key = EXCLUDED.wg_public_key,
                        wg_public_key_fingerprint = EXCLUDED.wg_public_key_fingerprint,
                        wg_assigned_ip = COALESCE(public.mobile_trusted_devices.wg_assigned_ip, EXCLUDED.wg_assigned_ip),
                        wg_allowed_ips = EXCLUDED.wg_allowed_ips,
                        wg_dns = EXCLUDED.wg_dns,
                        wg_endpoint = EXCLUDED.wg_endpoint,
                        wg_server_public_key = EXCLUDED.wg_server_public_key,
                        gaf_public_key_algorithm = EXCLUDED.gaf_public_key_algorithm,
                        gaf_public_key = EXCLUDED.gaf_public_key,
                        gaf_public_key_fingerprint = EXCLUDED.gaf_public_key_fingerprint,
                        capabilities = EXCLUDED.capabilities,
                        metadata = EXCLUDED.metadata,
                        approved_at = COALESCE(public.mobile_trusted_devices.approved_at, now()),
                        revoked_at = NULL,
                        revoked_by = NULL,
                        revoke_reason = NULL,
                        last_seen_at = now(),
                        updated_at = now()
                    RETURNING *
                    """,
                user_id,
                body.stable_device_id.strip()[:256],
                body.device_label.strip()[:128],
                body.device_public_key_algorithm,
                body.device_public_key.strip(),
                device_key_fingerprint,
                body.wg_public_key.strip(),
                wg_fingerprint,
                wg_assigned_ip,
                wg_config["allowed_ips"],
                wg_config["dns"],
                wg_config["endpoint"],
                wg_config["server_public_key"],
                body.gaf_public_key_algorithm,
                body.gaf_public_key.strip() if body.gaf_public_key else None,
                gaf_fingerprint,
                _json_dumps(body.capabilities),
                _json_dumps(self._safe_metadata(body.metadata)),
            )
            await conn.execute(
                """
                    UPDATE public.mobile_device_pairing_challenges
                    SET status = 'consumed', consumed_at = now(), consumed_ip = $2, consumed_user_agent = $3
                    WHERE id = $1
                    """,
                body.challenge_id,
                ip_address,
                user_agent,
            )
            bind_audit_details: dict[str, Any] = {
                "stable_device_id": body.stable_device_id.strip()[:256],
                "has_gaf_key": bool(body.gaf_public_key),
                "wg_public_key_fingerprint": wg_fingerprint,
                "wg_assigned_ip": str(wg_assigned_ip),
            }
            bind_audit_details.update(
                edge_sync_audit_details(
                    trigger="device_bound",
                    device_id=str(device["id"]),
                )
            )
            await self._audit(
                conn,
                user_id=user_id,
                actor_user_id=user_id,
                device_id=device["id"],
                pairing_challenge_id=body.challenge_id,
                event_type="device_bound",
                result="ok",
                ip_address=ip_address,
                user_agent=user_agent,
                details=bind_audit_details,
            )
            bound_device = device
            sync_audit = bind_audit_details
        # Enqueue only after commit — Celery must see the new active peer row.
        sync_audit = await self._apply_edge_sync_after_commit(
            device_id=bound_device["id"],
            event_type="device_bound",
            trigger="device_bound",
            prior_details=sync_audit,
        )
        item = self._row_to_item(bound_device)
        if sync_audit.get("edge_peer_sync_scheduled"):
            item = item.model_copy(update={"wg_edge_sync_status": "pending"})
        elif sync_audit.get("edge_peer_deploy_required") or sync_audit.get("edge_peer_removal_required"):
            status_name = "failed" if sync_audit.get("edge_peer_sync_enqueue_failed") else "manual_required"
            item = item.model_copy(update={"wg_edge_sync_status": status_name})
        return MobileTrustedDeviceBindResponse(
            device=item,
            tunnel=self._build_tunnel_response(item),
            gaf_e2ee_ready=bool(item.gaf_public_key_fingerprint),
        )

    async def list_devices(self, *, user_id: UUID, include_inactive: bool = False) -> list[MobileTrustedDeviceItem]:
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT *
                FROM public.mobile_trusted_devices
                WHERE user_id = $1
                  AND ($2::boolean OR status = 'active')
                ORDER BY created_at DESC
                """,
                user_id,
                include_inactive,
            )
        return [self._row_to_item(row) for row in rows]

    async def get_active_tunnel_metadata(self, *, user_id: UUID) -> tuple[MobileTrustedDeviceItem, dict[str, Any]]:
        """Return live tunnel metadata for the user's active device; heal stale DB WG fields."""
        live_wg = self._trusted_device_wg_config()
        async with self.db_pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT *
                FROM public.mobile_trusted_devices
                WHERE user_id = $1 AND status = 'active'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                user_id,
            )
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active trusted device not found")
            live_fields = (
                live_wg["endpoint"],
                live_wg["server_public_key"],
                live_wg["dns"],
                live_wg["allowed_ips"],
            )
            stored_fields = (
                str(row["wg_endpoint"] or "").strip(),
                str(row["wg_server_public_key"] or "").strip(),
                str(row["wg_dns"] or "").strip(),
                str(row["wg_allowed_ips"] or "").strip(),
            )
            if stored_fields != live_fields:
                row = await conn.fetchrow(
                    """
                    UPDATE public.mobile_trusted_devices
                    SET wg_endpoint = $2,
                        wg_server_public_key = $3,
                        wg_dns = $4,
                        wg_allowed_ips = $5,
                        updated_at = now()
                    WHERE id = $1
                    RETURNING *
                    """,
                    row["id"],
                    live_wg["endpoint"],
                    live_wg["server_public_key"],
                    live_wg["dns"],
                    live_wg["allowed_ips"],
                )
                logger.info(
                    "[STEP] mobile_trusted_device_wg_metadata_healed device_id=%s server_pub=%s",
                    row["id"],
                    live_wg["server_public_key"][:16],
                )
        item = self._row_to_item(row)
        return item, self._build_tunnel_response(item)

    async def list_audit_events(
        self,
        *,
        user_id: UUID,
        limit: int = 80,
    ) -> list[MobileDeviceAuditEventItem]:
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT *
                FROM public.mobile_device_audit_events
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                user_id,
                max(1, min(limit, 200)),
            )
        return [self._audit_row_to_item(row) for row in rows]

    async def revoke_device(
        self,
        *,
        user_id: UUID,
        device_id: UUID,
        actor_user_id: UUID,
        reason: str | None,
        ip_address: str | None,
        user_agent: str | None,
    ) -> MobileTrustedDeviceItem:
        async with self.db_pool.acquire() as conn, conn.transaction():
            existing = await conn.fetchrow(
                """
                SELECT *
                FROM public.mobile_trusted_devices
                WHERE id = $1 AND user_id = $2
                """,
                device_id,
                user_id,
            )
            if not existing:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trusted device not found")
            if str(existing["status"]) == "revoked":
                # Idempotent: SPA / mobile may retry after a partial success or local-only clear.
                return self._row_to_item(existing)
            row = await conn.fetchrow(
                """
                    UPDATE public.mobile_trusted_devices
                    SET status = 'revoked',
                        revoked_by = $3,
                        revoked_at = now(),
                        revoke_reason = NULLIF(BTRIM($4), ''),
                        updated_at = now()
                    WHERE id = $1 AND user_id = $2 AND status = 'active'
                    RETURNING *
                    """,
                device_id,
                user_id,
                actor_user_id,
                reason or "",
            )
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trusted device not found")
            # Drop FCM rows keyed by this install id so push does not fan-out to a dead token.
            revoked_stable_id = str(row["stable_device_id"] or "").strip()
            if revoked_stable_id:
                await conn.execute(
                    """
                    DELETE FROM public.user_mobile_push_tokens
                    WHERE user_id = $1
                      AND platform = 'android'
                      AND device_id = $2
                    """,
                    user_id,
                    revoked_stable_id[:256],
                )
            revoke_details: dict[str, Any] = {"reason": reason or None}
            revoke_details.update(
                edge_sync_audit_details(
                    trigger="device_revoked",
                    device_id=str(device_id),
                    removal=True,
                )
            )
            await self._audit(
                conn,
                user_id=user_id,
                actor_user_id=actor_user_id,
                device_id=device_id,
                event_type="device_revoked",
                result="ok",
                ip_address=ip_address,
                user_agent=user_agent,
                details=revoke_details,
            )
        # Enqueue peer removal only after commit (same race as bind).
        revoke_details = await self._apply_edge_sync_after_commit(
            device_id=device_id,
            event_type="device_revoked",
            trigger="device_revoked",
            removal=True,
            prior_details=revoke_details,
        )
        if revoke_details.get("edge_peer_sync_scheduled") or revoke_details.get("edge_peer_removal_required"):
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT * FROM public.mobile_trusted_devices WHERE id = $1
                    """,
                    device_id,
                )
        return self._row_to_item(row)

    async def rotate_wg_key(
        self,
        *,
        user_id: UUID,
        device_id: UUID,
        wg_public_key: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> MobileTrustedDeviceItem:
        _, wg_fingerprint = _validate_wireguard_public_key(wg_public_key)
        async with self.db_pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                    UPDATE public.mobile_trusted_devices
                    SET wg_public_key = $3,
                        wg_public_key_fingerprint = $4,
                        updated_at = now()
                    WHERE id = $1 AND user_id = $2 AND status = 'active'
                    RETURNING *
                    """,
                device_id,
                user_id,
                wg_public_key.strip(),
                wg_fingerprint,
            )
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active trusted device not found")
            rotate_details: dict[str, Any] = {"wg_public_key_fingerprint": wg_fingerprint}
            rotate_details.update(
                edge_sync_audit_details(
                    trigger="wg_key_rotated",
                    device_id=str(device_id),
                )
            )
            await self._audit(
                conn,
                user_id=user_id,
                actor_user_id=user_id,
                device_id=device_id,
                event_type="wg_key_rotated",
                result="ok",
                ip_address=ip_address,
                user_agent=user_agent,
                details=rotate_details,
            )
        rotate_details = await self._apply_edge_sync_after_commit(
            device_id=device_id,
            event_type="wg_key_rotated",
            trigger="wg_key_rotated",
            prior_details=rotate_details,
        )
        item = self._row_to_item(row)
        if rotate_details.get("edge_peer_sync_scheduled"):
            item = item.model_copy(update={"wg_edge_sync_status": "pending"})
        elif rotate_details.get("edge_peer_deploy_required"):
            status_name = "failed" if rotate_details.get("edge_peer_sync_enqueue_failed") else "manual_required"
            item = item.model_copy(update={"wg_edge_sync_status": status_name})
        return item

    async def list_transfer_requests(
        self,
        *,
        user_id: UUID | None = None,
        status_filter: str | None = None,
        limit: int = 80,
    ) -> list[MobileDeviceTransferItem]:
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT *
                FROM public.mobile_device_transfer_requests
                WHERE ($1::uuid IS NULL OR user_id = $1)
                  AND ($2::text IS NULL OR status = $2)
                ORDER BY created_at DESC
                LIMIT $3
                """,
                user_id,
                status_filter.strip() if status_filter else None,
                max(1, min(limit, 200)),
            )
        return [self._transfer_row_to_item(row) for row in rows]

    async def start_transfer(
        self,
        *,
        user_id: UUID,
        body: MobileDeviceTransferStartRequest,
        ip_address: str | None,
        user_agent: str | None,
    ) -> MobileDeviceTransferItem:
        if body.old_device_id == body.new_device_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Old and new devices must differ")
        transfer_public_key, transfer_key_fingerprint = _validate_transfer_public_key(
            body.transfer_public_key,
            body.transfer_public_key_algorithm,
        )
        transfer_id = uuid4()
        transfer_nonce = secrets.token_urlsafe(32)
        expires_at = _now() + timedelta(seconds=TRANSFER_TTL_SECONDS)
        async with self.db_pool.acquire() as conn, conn.transaction():
            await self._require_trusted_user(conn, user_id)
            await self._require_active_device(conn, user_id, body.old_device_id)
            await self._require_active_device(conn, user_id, body.new_device_id)
            row = await conn.fetchrow(
                """
                INSERT INTO public.mobile_device_transfer_requests (
                    id, user_id, old_device_id, new_device_id, status,
                    transfer_public_key, transfer_public_key_algorithm, transfer_public_key_fingerprint,
                    transfer_nonce, encrypted_transfer_blob_metadata, expires_at
                )
                VALUES ($1, $2, $3, $4, 'pending_old_device', $5, $6, $7, $8, $9::jsonb, $10)
                RETURNING *
                """,
                transfer_id,
                user_id,
                body.old_device_id,
                body.new_device_id,
                transfer_public_key,
                body.transfer_public_key_algorithm.strip()[:64],
                transfer_key_fingerprint,
                transfer_nonce,
                _json_dumps(self._safe_metadata(body.metadata)),
                expires_at,
            )
            await self._audit(
                conn,
                user_id=user_id,
                actor_user_id=user_id,
                device_id=body.new_device_id,
                transfer_request_id=transfer_id,
                event_type="transfer_started",
                result="ok",
                ip_address=ip_address,
                user_agent=user_agent,
                details={
                    "old_device_id": str(body.old_device_id),
                    "new_device_id": str(body.new_device_id),
                    "transfer_public_key_fingerprint": transfer_key_fingerprint,
                },
            )
        return self._transfer_row_to_item(row)

    async def confirm_transfer_old_device(
        self,
        *,
        user_id: UUID,
        transfer_id: UUID,
        body: MobileDeviceTransferOldConfirmRequest,
        ip_address: str | None,
        user_agent: str | None,
    ) -> MobileDeviceTransferItem:
        async with self.db_pool.acquire() as conn, conn.transaction():
            transfer = await self._transfer_for_update(conn, user_id, transfer_id)
            self._require_transfer_status(transfer, "pending_old_device")
            if transfer["expires_at"] <= _now():
                await self._expire_transfer(conn, transfer_id, user_id, ip_address, user_agent)
            old_device = await self._device_public_key_row(conn, user_id, transfer["old_device_id"])
            message = self._transfer_signature_message(transfer)
            _validate_signature(
                algorithm=str(old_device["device_public_key_algorithm"]),
                public_key_bytes=_b64decode(str(old_device["device_public_key"]), field="device_public_key"),
                signature_b64=body.signed_transfer_nonce,
                message=message,
                signature_field="signed_transfer_nonce",
            )
            row = await conn.fetchrow(
                """
                UPDATE public.mobile_device_transfer_requests
                SET status = 'pending_admin',
                    encrypted_transfer_blob = $2,
                    encrypted_transfer_blob_metadata = $3::jsonb,
                    old_device_signature = $4,
                    old_device_confirmed_at = now(),
                    updated_at = now()
                WHERE id = $1
                RETURNING *
                """,
                transfer_id,
                body.encrypted_transfer_blob.strip(),
                _json_dumps(self._safe_metadata(body.encrypted_transfer_blob_metadata)),
                body.signed_transfer_nonce.strip(),
            )
            await self._audit(
                conn,
                user_id=user_id,
                actor_user_id=user_id,
                device_id=transfer["old_device_id"],
                transfer_request_id=transfer_id,
                event_type="transfer_old_device_confirmed",
                result="ok",
                ip_address=ip_address,
                user_agent=user_agent,
                details={"encrypted_blob": "present"},
            )
        return self._transfer_row_to_item(row)

    async def admin_approve_transfer(
        self,
        *,
        transfer_id: UUID,
        admin_user_id: UUID,
        ip_address: str | None,
        user_agent: str | None,
    ) -> MobileDeviceTransferItem:
        confirmation_token = secrets.token_urlsafe(32)
        token_hash = self._hash_email_confirmation_token(transfer_id, confirmation_token)
        email_expires_at = _now() + timedelta(seconds=TRANSFER_EMAIL_TTL_SECONDS)
        async with self.db_pool.acquire() as conn, conn.transaction():
            transfer = await self._transfer_for_update(conn, None, transfer_id)
            self._require_transfer_status(transfer, "pending_admin")
            if transfer["expires_at"] <= _now():
                await self._expire_transfer(conn, transfer_id, transfer["user_id"], ip_address, user_agent)
            user_email = await conn.fetchval("SELECT email FROM public.users WHERE id = $1", transfer["user_id"])
            if not str(user_email or "").strip():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User email is not available")
            row = await conn.fetchrow(
                """
                UPDATE public.mobile_device_transfer_requests
                SET status = 'pending_user_email',
                    admin_approved_by = $2,
                    admin_approved_at = now(),
                    email_confirmation_token_hash = $3,
                    email_confirmation_sent_at = now(),
                    email_confirmation_expires_at = $4,
                    email_confirmation_to = $5,
                    updated_at = now()
                WHERE id = $1
                RETURNING *
                """,
                transfer_id,
                admin_user_id,
                token_hash,
                email_expires_at,
                str(user_email).strip(),
            )
            await self.email_notifier.send_transfer_confirmation(
                to_email=str(user_email).strip(),
                transfer_id=transfer_id,
                confirmation_token=confirmation_token,
                expires_at=email_expires_at,
            )
            await self._audit(
                conn,
                user_id=transfer["user_id"],
                actor_user_id=admin_user_id,
                transfer_request_id=transfer_id,
                event_type="transfer_admin_approved",
                result="ok",
                ip_address=ip_address,
                user_agent=user_agent,
                details={"email_to": self._redact_email(str(user_email))},
            )
        return self._transfer_row_to_item(row)

    async def admin_reject_transfer(
        self,
        *,
        transfer_id: UUID,
        admin_user_id: UUID,
        reason: str | None,
        ip_address: str | None,
        user_agent: str | None,
    ) -> MobileDeviceTransferItem:
        async with self.db_pool.acquire() as conn, conn.transaction():
            transfer = await self._transfer_for_update(conn, None, transfer_id)
            if transfer["status"] in {"completed", "rejected", "expired", "cancelled"}:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Transfer is already finalized")
            row = await conn.fetchrow(
                """
                UPDATE public.mobile_device_transfer_requests
                SET status = 'rejected',
                    admin_rejected_by = $2,
                    admin_rejected_at = now(),
                    admin_reject_reason = NULLIF(BTRIM($3), ''),
                    updated_at = now()
                WHERE id = $1
                RETURNING *
                """,
                transfer_id,
                admin_user_id,
                reason or "",
            )
            await self._audit(
                conn,
                user_id=transfer["user_id"],
                actor_user_id=admin_user_id,
                transfer_request_id=transfer_id,
                event_type="transfer_admin_rejected",
                result="ok",
                ip_address=ip_address,
                user_agent=user_agent,
                details={"reason": reason or None},
            )
        return self._transfer_row_to_item(row)

    async def confirm_transfer_email(
        self,
        *,
        user_id: UUID,
        transfer_id: UUID,
        confirmation_token: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> MobileDeviceTransferItem:
        async with self.db_pool.acquire() as conn, conn.transaction():
            transfer = await self._transfer_for_update(conn, user_id, transfer_id)
            self._require_transfer_status(transfer, "pending_user_email")
            if transfer["email_confirmation_expires_at"] <= _now() or transfer["expires_at"] <= _now():
                await self._expire_transfer(conn, transfer_id, user_id, ip_address, user_agent)
            expected = str(transfer["email_confirmation_token_hash"] or "")
            actual = self._hash_email_confirmation_token(transfer_id, confirmation_token)
            if not secrets.compare_digest(expected, actual):
                await self._audit(
                    conn,
                    user_id=user_id,
                    actor_user_id=user_id,
                    transfer_request_id=transfer_id,
                    event_type="transfer_email_confirm_failed",
                    result="denied",
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details={"reason": "invalid_token"},
                )
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email confirmation token")
            row = await conn.fetchrow(
                """
                UPDATE public.mobile_device_transfer_requests
                SET status = 'ready_for_new_device',
                    email_confirmed_at = now(),
                    updated_at = now()
                WHERE id = $1
                RETURNING *
                """,
                transfer_id,
            )
            await self._audit(
                conn,
                user_id=user_id,
                actor_user_id=user_id,
                transfer_request_id=transfer_id,
                event_type="transfer_email_confirmed",
                result="ok",
                ip_address=ip_address,
                user_agent=user_agent,
            )
        return self._transfer_row_to_item(row)

    async def complete_transfer(
        self,
        *,
        user_id: UUID,
        transfer_id: UUID,
        new_device_id: UUID,
        ip_address: str | None,
        user_agent: str | None,
    ) -> MobileDeviceTransferCompleteResponse:
        async with self.db_pool.acquire() as conn, conn.transaction():
            transfer = await self._transfer_for_update(conn, user_id, transfer_id)
            self._require_transfer_status(transfer, "ready_for_new_device")
            if str(transfer["new_device_id"]) != str(new_device_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Transfer belongs to another new device"
                )
            await self._require_active_device(conn, user_id, new_device_id)
            encrypted_blob = str(transfer["encrypted_transfer_blob"] or "")
            if not encrypted_blob:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Encrypted transfer blob is missing")
            row = await conn.fetchrow(
                """
                UPDATE public.mobile_device_transfer_requests
                SET status = 'completed',
                    completed_at = now(),
                    updated_at = now()
                WHERE id = $1
                RETURNING *
                """,
                transfer_id,
            )
            await self._audit(
                conn,
                user_id=user_id,
                actor_user_id=user_id,
                device_id=new_device_id,
                transfer_request_id=transfer_id,
                event_type="transfer_completed",
                result="ok",
                ip_address=ip_address,
                user_agent=user_agent,
            )
        item = self._transfer_row_to_item(row)
        return MobileDeviceTransferCompleteResponse(
            transfer=item,
            encrypted_transfer_blob=encrypted_blob,
            encrypted_transfer_blob_metadata=item.encrypted_transfer_blob_metadata,
        )

    async def _next_wg_assigned_ip(self, conn: asyncpg.Connection) -> str:
        prefix = unified_settings.mobile_trusted_device_wg_peer_ip_prefix.strip()
        if not prefix.endswith("."):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Trusted-device WireGuard IP prefix is misconfigured",
            )
        start = int(unified_settings.mobile_trusted_device_wg_peer_ip_start)
        # Serialize allocation across concurrent binds in this transaction.
        await conn.execute("SELECT pg_advisory_xact_lock(hashtext('eliteew_mobile_wg_ip_alloc'))")
        next_octet = await conn.fetchval(
            """
            WITH used AS (
                SELECT (split_part(host(wg_assigned_ip), '.', 4))::int AS octet
                FROM public.mobile_trusted_devices
                WHERE status = 'active'
                  AND wg_assigned_ip IS NOT NULL
            ),
            candidates AS (
                SELECT generate_series($1::int, 254) AS octet
            )
            SELECT c.octet
            FROM candidates c
            LEFT JOIN used u ON u.octet = c.octet
            WHERE u.octet IS NULL
            ORDER BY c.octet
            LIMIT 1
            """,
            start,
        )
        if next_octet is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Trusted-device WireGuard peer pool is exhausted",
            )
        return f"{prefix}{int(next_octet)}"

    async def _require_active_device(self, conn: asyncpg.Connection, user_id: UUID, device_id: UUID) -> None:
        exists = await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT 1
                FROM public.mobile_trusted_devices
                WHERE id = $1 AND user_id = $2 AND status = 'active'
            )
            """,
            device_id,
            user_id,
        )
        if not bool(exists):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active trusted device not found")

    async def _transfer_for_update(
        self,
        conn: asyncpg.Connection,
        user_id: UUID | None,
        transfer_id: UUID,
    ) -> asyncpg.Record:
        row = await conn.fetchrow(
            """
            SELECT *
            FROM public.mobile_device_transfer_requests
            WHERE id = $1 AND ($2::uuid IS NULL OR user_id = $2)
            FOR UPDATE
            """,
            transfer_id,
            user_id,
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer request not found")
        return row

    async def _device_public_key_row(
        self,
        conn: asyncpg.Connection,
        user_id: UUID,
        device_id: UUID,
    ) -> asyncpg.Record:
        row = await conn.fetchrow(
            """
            SELECT id, device_public_key_algorithm, device_public_key
            FROM public.mobile_trusted_devices
            WHERE id = $1 AND user_id = $2 AND status = 'active'
            """,
            device_id,
            user_id,
        )
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active trusted device not found")
        return row

    def _require_transfer_status(self, row: Any, expected_status: str) -> None:
        if row["status"] != expected_status:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Transfer must be in {expected_status} state",
            )

    async def _expire_transfer(
        self,
        conn: asyncpg.Connection,
        transfer_id: UUID,
        user_id: UUID,
        ip_address: str | None,
        user_agent: str | None,
    ) -> None:
        await conn.execute(
            """
            UPDATE public.mobile_device_transfer_requests
            SET status = 'expired', updated_at = now()
            WHERE id = $1 AND status NOT IN ('completed', 'rejected', 'expired', 'cancelled')
            """,
            transfer_id,
        )
        await self._audit(
            conn,
            user_id=user_id,
            actor_user_id=user_id,
            transfer_request_id=transfer_id,
            event_type="transfer_expired",
            result="denied",
            ip_address=ip_address,
            user_agent=user_agent,
        )
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Transfer request expired")

    def _transfer_signature_message(self, row: Any) -> str:
        return ":".join(
            [
                "eliteew-mobile-transfer",
                "v1",
                str(row["id"]),
                str(row["transfer_nonce"]),
                str(row["new_device_id"]),
                str(row["transfer_public_key_fingerprint"]),
            ]
        )

    def _hash_email_confirmation_token(self, transfer_id: UUID, confirmation_token: str) -> str:
        return _stable_hash(f"mobile-transfer-email:v1:{transfer_id}:{confirmation_token.strip()}")

    def _redact_email(self, email: str) -> str:
        local, _, domain = email.partition("@")
        if not domain:
            return "***"
        prefix = local[:2] if len(local) > 2 else local[:1]
        return f"{prefix}***@{domain}"

    async def _challenge_nonce_for_signature(self, challenge_id: UUID) -> str:
        async with self.db_pool.acquire() as conn:
            nonce = await conn.fetchval(
                "SELECT challenge_nonce FROM public.mobile_device_pairing_challenges WHERE id = $1",
                challenge_id,
            )
        if not nonce:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pairing challenge not found")
        return str(nonce)

    async def _require_trusted_user(self, conn: asyncpg.Connection, user_id: UUID) -> None:
        trusted = await conn.fetchval(
            "SELECT COALESCE(is_trusted, false) FROM public.users WHERE id = $1",
            user_id,
        )
        if trusted is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if not bool(trusted):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Trusted user status is required")

    async def _validate_challenge_for_bind(
        self,
        conn: asyncpg.Connection,
        user_id: UUID,
        body: MobileTrustedDeviceBindRequest,
        challenge: asyncpg.Record,
        ip_address: str | None,
        user_agent: str | None,
    ) -> None:
        now = _now()
        if challenge["status"] != "pending" or challenge["expires_at"] <= now:
            await conn.execute(
                "UPDATE public.mobile_device_pairing_challenges SET status = 'expired' WHERE id = $1 AND status = 'pending'",
                body.challenge_id,
            )
            await self._audit(
                conn,
                user_id=user_id,
                actor_user_id=user_id,
                pairing_challenge_id=body.challenge_id,
                event_type="device_bind_failed",
                result="denied",
                ip_address=ip_address,
                user_agent=user_agent,
                details={"reason": "challenge_expired_or_not_pending"},
            )
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Pairing challenge expired")
        if int(challenge["attempts"]) >= int(challenge["max_attempts"]):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Pairing attempts exceeded")
        expected_hash = challenge["code_hash"]
        actual_hash = self._hash_pairing_code(body.challenge_id, body.pairing_code)
        if not secrets.compare_digest(str(expected_hash), actual_hash):
            await conn.execute(
                """
                UPDATE public.mobile_device_pairing_challenges
                SET attempts = attempts + 1
                WHERE id = $1
                """,
                body.challenge_id,
            )
            await self._audit(
                conn,
                user_id=user_id,
                actor_user_id=user_id,
                pairing_challenge_id=body.challenge_id,
                event_type="device_bind_failed",
                result="denied",
                ip_address=ip_address,
                user_agent=user_agent,
                details={"reason": "invalid_pairing_code"},
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid pairing code")

    def _hash_pairing_code(self, challenge_id: UUID, pairing_code: str) -> str:
        return _stable_hash(f"mobile-pairing:v1:{challenge_id}:{pairing_code.strip()}")

    def _safe_metadata(self, metadata: dict[str, Any]) -> dict[str, Any]:
        blocked = {"token", "access_token", "refresh_token", "private_key", "signature", "pairing_code"}
        return {k: v for k, v in metadata.items() if k.lower() not in blocked}

    def _parse_metadata(self, metadata: Any) -> dict[str, Any]:
        if isinstance(metadata, dict):
            return metadata
        if isinstance(metadata, str):
            try:
                parsed = json.loads(metadata)
            except json.JSONDecodeError:
                return {}
            return parsed if isinstance(parsed, dict) else {}
        return {}

    def _trusted_device_wg_config(self) -> dict[str, str]:
        endpoint = (unified_settings.mobile_trusted_device_wg_endpoint or "").strip()
        server_public_key = (unified_settings.mobile_trusted_device_wg_server_public_key or "").strip()
        dns = unified_settings.mobile_trusted_device_wg_dns.strip()
        allowed_ips = unified_settings.mobile_trusted_device_wg_allowed_ips.strip()
        missing = [
            name
            for name, value in (
                ("MOBILE_TRUSTED_DEVICE_WG_ENDPOINT", endpoint),
                ("MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY", server_public_key),
                ("MOBILE_TRUSTED_DEVICE_WG_DNS", dns),
                ("MOBILE_TRUSTED_DEVICE_WG_ALLOWED_IPS", allowed_ips),
            )
            if not value
        ]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Trusted-device WireGuard config is incomplete: {', '.join(missing)}",
            )
        return {
            "endpoint": endpoint,
            "server_public_key": server_public_key,
            "dns": dns,
            "allowed_ips": allowed_ips,
        }

    def _build_tunnel_response(self, item: MobileTrustedDeviceItem) -> dict[str, Any]:
        ready = bool(item.wg_endpoint and item.wg_server_public_key and item.wg_assigned_ip)
        mtu = int(unified_settings.mobile_trusted_device_wg_mtu)
        edge_sync_status = (item.wg_edge_sync_status or "").strip() or None
        if edge_sync_status is None:
            if not edge_sync_enqueue_ready():
                edge_sync_status = "manual_required"
            elif ready:
                edge_sync_status = "pending"
            else:
                edge_sync_status = "unknown"
        return {
            "status": "ready" if ready else "pending_edge_provisioning",
            "edge_sync_status": edge_sync_status,
            "interface_address": f"{item.wg_assigned_ip}/32" if item.wg_assigned_ip else None,
            "dns": item.wg_dns,
            "allowed_ips": item.wg_allowed_ips,
            "endpoint": item.wg_endpoint,
            "server_public_key": item.wg_server_public_key,
            "persistent_keepalive": 25,
            "mtu": mtu,
            "wg_public_key_fingerprint": item.wg_public_key_fingerprint,
        }

    async def _apply_edge_sync_after_commit(
        self,
        *,
        device_id: UUID,
        event_type: str,
        trigger: str,
        prior_details: dict[str, Any],
        removal: bool = False,
    ) -> dict[str, Any]:
        """Enqueue Celery edge reconcile after TX commit; stamp device + audit honestly."""
        details = finalize_edge_sync_after_commit(
            trigger=trigger,
            device_id=str(device_id),
            removal=removal,
            prior_details=prior_details,
        )
        status_name: str | None = None
        if details.get("edge_peer_sync_scheduled"):
            status_name = "pending"
        elif details.get("edge_peer_deploy_required") or details.get("edge_peer_removal_required"):
            status_name = "failed" if details.get("edge_peer_sync_enqueue_failed") else "manual_required"
        async with self.db_pool.acquire() as conn:
            if status_name is not None:
                await conn.execute(
                    """
                    UPDATE public.mobile_trusted_devices
                    SET wg_edge_sync_status = $2,
                        updated_at = now()
                    WHERE id = $1
                    """,
                    device_id,
                    status_name,
                )
            if prior_details.get("edge_peer_sync_deferred"):
                await conn.execute(
                    """
                    UPDATE public.mobile_device_audit_events
                    SET details = $3::jsonb
                    WHERE id = (
                        SELECT id
                        FROM public.mobile_device_audit_events
                        WHERE device_id = $1
                          AND event_type = $2
                        ORDER BY created_at DESC
                        LIMIT 1
                    )
                    """,
                    device_id,
                    event_type,
                    _json_dumps(details),
                )
        return details

    async def _audit(
        self,
        conn: asyncpg.Connection,
        *,
        event_type: str,
        result: str,
        user_id: UUID | None = None,
        actor_user_id: UUID | None = None,
        device_id: UUID | None = None,
        pairing_challenge_id: UUID | None = None,
        transfer_request_id: UUID | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        await conn.execute(
            """
            INSERT INTO public.mobile_device_audit_events (
                user_id, actor_user_id, device_id, pairing_challenge_id, transfer_request_id,
                event_type, result, ip_address, user_agent, details
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
            """,
            user_id,
            actor_user_id,
            device_id,
            pairing_challenge_id,
            transfer_request_id,
            event_type,
            result,
            ip_address,
            user_agent,
            _json_dumps(details or {}),
        )

    def _row_to_item(self, row: Any) -> MobileTrustedDeviceItem:
        capabilities = row.get("capabilities") if hasattr(row, "get") else row["capabilities"]
        metadata = row.get("metadata") if hasattr(row, "get") else row["metadata"]
        if isinstance(capabilities, str):
            capabilities = json.loads(capabilities)
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        return MobileTrustedDeviceItem(
            id=row["id"],
            stable_device_id=str(row["stable_device_id"]),
            device_label=str(row["device_label"]),
            platform=str(row["platform"]),
            status=str(row["status"]),
            device_public_key_fingerprint=str(row["device_public_key_fingerprint"]),
            wg_public_key_fingerprint=str(row["wg_public_key_fingerprint"]),
            wg_assigned_ip=str(row["wg_assigned_ip"]) if row["wg_assigned_ip"] else None,
            wg_allowed_ips=row["wg_allowed_ips"],
            wg_dns=row["wg_dns"],
            wg_endpoint=row["wg_endpoint"],
            wg_server_public_key=row["wg_server_public_key"],
            gaf_public_key_fingerprint=row["gaf_public_key_fingerprint"],
            capabilities=capabilities or {},
            metadata=metadata or {},
            approved_at=row["approved_at"],
            revoked_at=row["revoked_at"],
            last_seen_at=row["last_seen_at"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            wg_edge_sync_status=_row_get(row, "wg_edge_sync_status"),
            wg_edge_synced_at=_row_get(row, "wg_edge_synced_at"),
        )

    def _audit_row_to_item(self, row: Any) -> MobileDeviceAuditEventItem:
        details = row["details"]
        if isinstance(details, str):
            details = json.loads(details)
        return MobileDeviceAuditEventItem(
            id=int(row["id"]),
            user_id=row["user_id"],
            actor_user_id=row["actor_user_id"],
            device_id=row["device_id"],
            pairing_challenge_id=row["pairing_challenge_id"],
            transfer_request_id=row["transfer_request_id"],
            event_type=str(row["event_type"]),
            result=str(row["result"]),
            ip_address=row["ip_address"],
            user_agent=row["user_agent"],
            details=details or {},
            created_at=row["created_at"],
        )

    def _transfer_row_to_item(self, row: Any) -> MobileDeviceTransferItem:
        metadata = row["encrypted_transfer_blob_metadata"]
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        return MobileDeviceTransferItem(
            id=row["id"],
            user_id=row["user_id"],
            old_device_id=row["old_device_id"],
            new_device_id=row["new_device_id"],
            status=str(row["status"]),
            transfer_public_key_fingerprint=str(row["transfer_public_key_fingerprint"]),
            transfer_public_key_algorithm=str(row["transfer_public_key_algorithm"]),
            has_encrypted_transfer_blob=bool(row["encrypted_transfer_blob"]),
            encrypted_transfer_blob_metadata=metadata or {},
            old_device_confirmed_at=row["old_device_confirmed_at"],
            admin_approved_by=row["admin_approved_by"],
            admin_approved_at=row["admin_approved_at"],
            email_confirmed_at=row["email_confirmed_at"],
            completed_at=row["completed_at"],
            expires_at=row["expires_at"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
