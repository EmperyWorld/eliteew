# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Atomically mint or redeliver one device-bound Capsule for an Air session.
# Invariants:
# - FoFline Air mint fail-closes without payload.ota_artifact_pk (verify PK only).
# - INSERT RETURNING with no row fail-closes as DesktopClientError.
# Related:
# - documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md
# ---

from __future__ import annotations

import base64
import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import asyncpg

from api.core.unified_config import unified_settings
from api.services.desktop_client.air_enroll_store import (
    AirEnrollStore,
    AirSession,
    session_from_row,
)
from api.services.desktop_client.capsule_seal import maybe_seal_for_issue
from api.services.desktop_client.crypto_util import generate_license_key, hash_license_key
from api.services.desktop_client.device_request import parse_and_verify_device_request
from api.services.desktop_client.enrollment_service import issue_body_hash
from api.services.desktop_client.entitlement_sign import (
    DEFAULT_CLIENT_OFFLINE_APPS,
    is_ota_artifact_pk,
    try_mint_entitlement,
)
from api.services.desktop_client.license_models import (
    DesktopClientError,
    IssuedLicenseView,
)
from api.services.desktop_client.license_modes import (
    edition_for_mode,
    flags_for_mode,
    normalize_seat_mode,
    profile_id_for_mode,
)
from api.services.desktop_client.portal_edge_sync import (
    edge_sync_configured,
)
from api.services.desktop_client.portal_peer_service import (
    PortalPeerCreateResult,
    PortalPeerView,
)
from api.services.desktop_client.portal_wg_keys import (
    allocate_next_ip,
    build_client_conf,
    generate_wg_keypair,
    validate_slug,
)
from api.services.desktop_client.seat_package import build_seat_package

logger = logging.getLogger(__name__)

_PORTAL_ALLOCATION_LOCK = 4_839_112_049_651_417_602
_MAX_CAPSULE_BYTES = 256 * 1024


def require_fofline_ota_artifact_pk(
    *,
    allow_fofline: bool,
    entitlement: dict[str, Any] | None,
) -> None:
    """FoFline Air seats must carry a signature-covered artifact verify PK."""
    if not allow_fofline or entitlement is None:
        return
    payload = entitlement.get("payload")
    pk = payload.get("ota_artifact_pk") if isinstance(payload, dict) else None
    if not is_ota_artifact_pk(pk):
        raise DesktopClientError(
            "ota_artifact_pk_missing",
            "FoFline Air entitlement is missing a valid OTA artifact verify PK",
            http_status=503,
        )


@dataclass(frozen=True)
class AirSealedCapsule:
    session: AirSession
    capsule: bytes
    sha256: str
    request_id: str
    license_id: UUID
    peer_id: UUID | None
    peer_sync_required: bool
    redelivery: bool


def _capsule_bytes(package: dict[str, Any]) -> bytes:
    if package.get("encoding") != "ecap_v3":
        raise DesktopClientError(
            "air_capsule_encoding",
            "Air enrollment requires Capsule v3",
            http_status=500,
        )
    encoded = package.get("package_b64")
    if not isinstance(encoded, str):
        raise DesktopClientError(
            "air_capsule_encoding",
            "Air Capsule payload is missing",
            http_status=500,
        )
    try:
        capsule = base64.b64decode(encoded, validate=True)
    except ValueError as exc:
        raise DesktopClientError(
            "air_capsule_encoding",
            "Air Capsule payload is invalid",
            http_status=500,
        ) from exc
    if not capsule or len(capsule) > _MAX_CAPSULE_BYTES:
        raise DesktopClientError(
            "air_capsule_size",
            "Air Capsule size is outside the allowed bound",
            http_status=500,
        )
    return capsule


def _request_expiry(verified: dict[str, str]) -> datetime:
    expires_at = datetime.fromisoformat(verified["expires_at"].replace("Z", "+00:00"))
    return expires_at.replace(tzinfo=UTC) if expires_at.tzinfo is None else expires_at.astimezone(UTC)


class AirEnrollIssuer:
    def __init__(self, pool: asyncpg.Pool, store: AirEnrollStore) -> None:
        self._pool = pool
        self._store = store

    async def seal(
        self,
        *,
        session_id: UUID,
        device_request: dict[str, Any],
    ) -> AirSealedCapsule:
        verified = parse_and_verify_device_request(device_request)
        async with self._pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT *
                FROM desktop_client_air_enroll_sessions
                WHERE id = $1
                FOR UPDATE
                """,
                session_id,
            )
            if row is None:
                raise DesktopClientError(
                    "air_session_not_found",
                    "Air enrollment session not found",
                    http_status=404,
                )
            session = session_from_row(row)
            if session.lifecycle != "claimed" or session.attempt_count != 1:
                raise DesktopClientError(
                    "air_state_conflict",
                    "Air session is not claimed",
                    http_status=409,
                )
            if session.reissue_of is not None:
                result = await self._redeliver_locked(
                    conn,
                    session=session,
                    verified=verified,
                )
            else:
                result = await self._issue_locked(
                    conn,
                    session=session,
                    verified=verified,
                )

        return result

    async def _issue_locked(
        self,
        conn: asyncpg.Connection,
        *,
        session: AirSession,
        verified: dict[str, str],
    ) -> AirSealedCapsule:
        mode = normalize_seat_mode(session.mode)
        allow_offline, allow_online = flags_for_mode(mode)
        if (allow_online or session.allow_fofline) and not edge_sync_configured():
            raise DesktopClientError(
                "air_portal_sync_unconfigured",
                "Portal edge synchronization is required for this Air seat",
                http_status=503,
            )

        edition = edition_for_mode(mode)
        profile_id = profile_id_for_mode(mode)
        apps = list(DEFAULT_CLIENT_OFFLINE_APPS) if allow_offline else []
        license_id = uuid4()
        license_key = generate_license_key(groups=5)
        license_key_hash = hash_license_key(license_key)
        created_at = datetime.now(UTC)

        license_row = await conn.fetchrow(
            """
            INSERT INTO desktop_client_licenses (
                id, license_key_hash, status, edition, profile_id, label,
                apps_json, expires_at, allow_offline, allow_online, allow_fofline,
                allowed_email
            )
            VALUES (
                $1, $2, 'active', $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11
            )
            RETURNING created_at
            """,
            license_id,
            license_key_hash,
            edition,
            profile_id,
            session.label,
            json.dumps(apps),
            session.seat_expires_at,
            allow_offline,
            allow_online,
            session.allow_fofline,
            session.allowed_email,
        )
        if license_row is None:
            raise DesktopClientError(
                "air_license_insert_failed",
                "License insert did not return a row",
                http_status=500,
            )
        await conn.execute(
            """
            INSERT INTO desktop_client_audit (event, license_id, client_ip, detail)
            VALUES ('license_issued', $1, NULL, $2::jsonb)
            """,
            license_id,
            json.dumps(
                {
                    "source": "air_enroll",
                    "air_session_id": str(session.id),
                    "edition": edition,
                    "allow_offline": allow_offline,
                    "allow_online": allow_online,
                    "allow_fofline": session.allow_fofline,
                },
                separators=(",", ":"),
                sort_keys=True,
            ),
        )
        issued = IssuedLicenseView(
            license_id=license_id,
            license_key=license_key,
            edition=edition,
            profile_id=profile_id,
            label=session.label,
            created_at=license_row["created_at"] or created_at,
            allow_offline=allow_offline,
            allow_online=allow_online,
            allow_fofline=session.allow_fofline,
            allowed_email=session.allowed_email,
            expires_at=session.seat_expires_at,
        )
        entitlement = try_mint_entitlement(
            license_id=license_id,
            edition=edition,
            profile_id=profile_id,
            apps=apps,
            machine_fingerprint=None,
            device_id=None,
            expires_at=session.seat_expires_at,
            allow_fofline=session.allow_fofline,
            allow_online=allow_online,
        )
        if allow_offline and entitlement is None:
            raise DesktopClientError(
                "air_entitlement_unconfigured",
                "Offline entitlement signing is unavailable",
                http_status=503,
            )
        require_fofline_ota_artifact_pk(
            allow_fofline=session.allow_fofline,
            entitlement=entitlement,
        )

        peer_result = (
            await self._create_peer_locked(
                conn,
                session=session,
                license_id=license_id,
            )
            if allow_online or session.allow_fofline
            else None
        )
        seat = build_seat_package(
            mode=mode,
            issued=issued,
            entitlement=entitlement,
            peer_result=peer_result,
        )
        package, suffix, activation_token_hash = maybe_seal_for_issue(
            seat,
            recipient_public_key_hex=verified["capsule_recipient_pubkey"],
            verified_request=verified,
        )
        if suffix != ".ecap" or activation_token_hash is None:
            raise DesktopClientError(
                "air_capsule_unsealed",
                "Air enrollment cannot deliver a plaintext seat",
                http_status=500,
            )
        capsule = _capsule_bytes(package)
        capsule_hash = hashlib.sha256(capsule).hexdigest()
        filename = f"eliteew-capsule-air-{session.id.hex[:12]}.ecap"
        body_hash = issue_body_hash(
            mode=mode,
            label=session.label,
            slug=session.slug,
            allowed_email=session.allowed_email,
            allow_fofline=session.allow_fofline,
            request_id=verified["request_id"],
            expires_at=(
                session.seat_expires_at.astimezone(UTC).isoformat() if session.seat_expires_at is not None else None
            ),
        )
        peer_slug = peer_result.peer.slug if peer_result is not None else None
        enrollment_id = await conn.fetchval(
            """
            INSERT INTO desktop_client_enrollment_requests (
                request_id, product_id, app_identifier,
                device_signing_pubkey, capsule_recipient_pubkey, recipient_key_id,
                machine_fingerprint_hash, nonce, status, expires_at,
                license_id, issued_package_json, issue_body_hash,
                activation_token_hash, issued_peer_slug, air_session_id,
                ecap_sha256, ecap_size, issued_at, updated_at
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,'issued',$9,$10,$11::jsonb,$12,$13,
                $14,$15,$16,$17,NOW(),NOW()
            )
            RETURNING id
            """,
            verified["request_id"],
            verified["product_id"],
            verified["app_identifier"],
            verified["device_signing_pubkey"],
            verified["capsule_recipient_pubkey"],
            verified["recipient_key_id"],
            verified["machine_fingerprint_hash"],
            verified["nonce"],
            _request_expiry(verified),
            license_id,
            json.dumps(
                {"package": package, "filename": filename},
                separators=(",", ":"),
            ),
            body_hash,
            activation_token_hash,
            peer_slug,
            session.id,
            capsule_hash,
            len(capsule),
        )
        if enrollment_id is None:
            raise DesktopClientError(
                "air_enrollment_persist_failed",
                "Air enrollment request was not persisted",
                http_status=500,
            )
        updated = await conn.fetchrow(
            """
            UPDATE desktop_client_air_enroll_sessions
            SET lifecycle = 'capsule_sealed', request_id = $2,
                device_signing_pubkey = $3, capsule_recipient_pubkey = $4,
                recipient_key_id = $5, machine_fingerprint_hash = $6,
                license_id = $7, ecap_sha256 = $8, ecap_size = $9,
                sealed_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND lifecycle = 'claimed'
            RETURNING *
            """,
            session.id,
            verified["request_id"],
            verified["device_signing_pubkey"],
            verified["capsule_recipient_pubkey"],
            verified["recipient_key_id"],
            verified["machine_fingerprint_hash"],
            license_id,
            capsule_hash,
            len(capsule),
        )
        if updated is None:
            raise DesktopClientError(
                "air_state_conflict",
                "Air session changed during issuance",
                http_status=409,
            )
        await self._store.append_event(
            conn,
            session_id=session.id,
            event="capsule_sealed",
            lifecycle="capsule_sealed",
            cleanup_state=session.cleanup_state,
            detail={
                "ecap_sha256": capsule_hash,
                "ecap_size": len(capsule),
                "peer_sync_required": peer_result is not None,
            },
        )
        peer_id = peer_result.peer.id if peer_result is not None else None
        return AirSealedCapsule(
            session=session_from_row(updated),
            capsule=capsule,
            sha256=capsule_hash,
            request_id=verified["request_id"],
            license_id=license_id,
            peer_id=peer_id,
            peer_sync_required=peer_result is not None,
            redelivery=False,
        )

    async def _create_peer_locked(
        self,
        conn: asyncpg.Connection,
        *,
        session: AirSession,
        license_id: UUID,
    ) -> PortalPeerCreateResult:
        endpoint = (unified_settings.desktop_client_portal_endpoint or "").strip()
        edge_public_key = (unified_settings.desktop_client_portal_edge_public_key or "").strip()
        if not endpoint or not edge_public_key:
            raise DesktopClientError(
                "air_portal_unconfigured",
                "Portal endpoint or public key is unavailable",
                http_status=503,
            )
        await conn.execute("SELECT pg_advisory_xact_lock($1)", _PORTAL_ALLOCATION_LOCK)
        slug = validate_slug(session.slug or f"air-{session.id.hex}")
        existing = await conn.fetchval(
            """
            SELECT 1
            FROM desktop_client_portal_peers
            WHERE slug = $1 AND status = 'active'
            """,
            slug,
        )
        if existing:
            raise DesktopClientError(
                "air_peer_slug_conflict",
                "Air portal peer slug is already active",
                http_status=409,
            )
        used_rows = await conn.fetch(
            """
            SELECT host(assigned_ip) AS host
            FROM desktop_client_portal_peers
            WHERE status = 'active'
            """
        )
        used = {
            int(str(row["host"]).rsplit(".", 1)[-1])
            for row in used_rows
            if str(row["host"] or "").startswith("10.88.89.")
        }
        try:
            assigned_ip = allocate_next_ip(used)
        except RuntimeError as exc:
            raise DesktopClientError(
                "air_peer_ip_exhausted",
                "No portal peer address is available",
                http_status=503,
            ) from exc
        private_key, public_key = generate_wg_keypair()
        peer_id = uuid4()
        row = await conn.fetchrow(
            """
            INSERT INTO desktop_client_portal_peers (
                id, slug, wg_public_key, assigned_ip, status, label, license_id,
                edge_sync_status
            )
            VALUES ($1, $2, $3, $4::inet, 'active', $5, $6, 'pending')
            RETURNING id, slug, wg_public_key, host(assigned_ip) AS assigned_ip,
                      status, label, license_id, edge_sync_status, edge_synced_at,
                      edge_sync_error, created_at
            """,
            peer_id,
            slug,
            public_key,
            assigned_ip,
            session.label,
            license_id,
        )
        if row is None:
            raise DesktopClientError(
                "air_peer_insert_failed",
                "Portal peer insert did not return a row",
                http_status=500,
            )
        await conn.execute(
            """
            INSERT INTO desktop_client_audit (event, license_id, client_ip, detail)
            VALUES ('portal_peer_create', $1, NULL, $2::jsonb)
            """,
            license_id,
            json.dumps(
                {
                    "source": "air_enroll",
                    "air_session_id": str(session.id),
                    "peer_id": str(peer_id),
                    "slug": slug,
                    "assigned_ip": str(row["assigned_ip"]),
                    "wg_public_key": public_key,
                    "edge_sync_status": "pending",
                },
                separators=(",", ":"),
                sort_keys=True,
            ),
        )
        view = PortalPeerView(
            id=row["id"],
            slug=row["slug"],
            wg_public_key=row["wg_public_key"],
            assigned_ip=str(row["assigned_ip"]),
            status=row["status"],
            label=row["label"],
            license_id=row["license_id"],
            edge_sync_status=row["edge_sync_status"],
            edge_synced_at=row["edge_synced_at"],
            edge_sync_error=row["edge_sync_error"],
            created_at=row["created_at"],
        )
        return PortalPeerCreateResult(
            peer=view,
            private_key=private_key,
            client_conf=build_client_conf(
                private_key=private_key,
                assigned_ip=f"{view.assigned_ip}/32",
                endpoint=endpoint,
                edge_public_key=edge_public_key,
            ),
            edge_sync_enqueued=True,
        )

    async def _redeliver_locked(
        self,
        conn: asyncpg.Connection,
        *,
        session: AirSession,
        verified: dict[str, str],
    ) -> AirSealedCapsule:
        original = await conn.fetchrow(
            """
            SELECT original.*, enrollment.issued_package_json
            FROM desktop_client_air_enroll_sessions original
            JOIN desktop_client_enrollment_requests enrollment
              ON enrollment.air_session_id = original.id
            WHERE original.id = $1
            FOR UPDATE OF original, enrollment
            """,
            session.reissue_of,
        )
        if original is None:
            raise DesktopClientError(
                "air_redelivery_missing",
                "Original sealed Air Capsule is unavailable",
                http_status=409,
            )
        for field in (
            "device_signing_pubkey",
            "capsule_recipient_pubkey",
            "recipient_key_id",
            "machine_fingerprint_hash",
        ):
            if original[field] != verified[field]:
                raise DesktopClientError(
                    "air_redelivery_recipient_mismatch",
                    "Air redelivery recipient does not match",
                    http_status=403,
                )
        wrapper = original["issued_package_json"]
        if isinstance(wrapper, str):
            wrapper = json.loads(wrapper)
        if not isinstance(wrapper, dict) or not isinstance(
            wrapper.get("package"),
            dict,
        ):
            raise DesktopClientError(
                "air_redelivery_missing",
                "Original Air Capsule wrapper is invalid",
                http_status=500,
            )
        capsule = _capsule_bytes(wrapper["package"])
        capsule_hash = hashlib.sha256(capsule).hexdigest()
        if (
            capsule_hash != original["ecap_sha256"]
            or len(capsule) != original["ecap_size"]
            or original["license_id"] is None
            or original["request_id"] is None
        ):
            raise DesktopClientError(
                "air_redelivery_integrity",
                "Original Air Capsule integrity check failed",
                http_status=500,
            )
        peer_id = await conn.fetchval(
            """
            SELECT id
            FROM desktop_client_portal_peers
            WHERE license_id = $1 AND status = 'active'
            LIMIT 1
            """,
            original["license_id"],
        )
        updated = await conn.fetchrow(
            """
            UPDATE desktop_client_air_enroll_sessions
            SET lifecycle = 'capsule_sealed', request_id = $2,
                device_signing_pubkey = $3, capsule_recipient_pubkey = $4,
                recipient_key_id = $5, machine_fingerprint_hash = $6,
                license_id = $7, ecap_sha256 = $8, ecap_size = $9,
                sealed_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND lifecycle = 'claimed'
            RETURNING *
            """,
            session.id,
            original["request_id"],
            original["device_signing_pubkey"],
            original["capsule_recipient_pubkey"],
            original["recipient_key_id"],
            original["machine_fingerprint_hash"],
            original["license_id"],
            capsule_hash,
            len(capsule),
        )
        if updated is None:
            raise DesktopClientError(
                "air_state_conflict",
                "Air redelivery session changed",
                http_status=409,
            )
        await self._store.append_event(
            conn,
            session_id=session.id,
            event="capsule_redelivered",
            lifecycle="capsule_sealed",
            cleanup_state=session.cleanup_state,
            detail={
                "original_session_id": str(session.reissue_of),
                "ecap_sha256": capsule_hash,
                "ecap_size": len(capsule),
            },
        )
        return AirSealedCapsule(
            session=session_from_row(updated),
            capsule=capsule,
            sha256=capsule_hash,
            request_id=original["request_id"],
            license_id=original["license_id"],
            peer_id=peer_id,
            peer_sync_required=peer_id is not None,
            redelivery=True,
        )
