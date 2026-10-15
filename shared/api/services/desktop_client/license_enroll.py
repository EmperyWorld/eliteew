# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# License enroll mixin: redeem, challenge, prove.
# Invariants:
# - One active device fingerprint per license (deny second machine by default).
# Related:
# - license_service.py facade; license_mixin_host.py
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

import json
from datetime import UTC, datetime

from api.services.desktop_client.crypto_util import (
    hash_license_key,
    is_plausible_license_key,
    new_challenge_nonce,
    normalize_license_key,
    verify_challenge_proof,
)
from api.services.desktop_client.license_mixin_host import LicenseMixinHost
from api.services.desktop_client.license_models import BoundLicenseView, DesktopClientError


class LicenseEnrollMixin(LicenseMixinHost):
    async def redeem(
        self,
        *,
        license_key: str,
        device_pubkey: str,
        machine_fingerprint: str,
        client_ip: str | None,
    ) -> BoundLicenseView:
        if not self._rate.allow(f"redeem:{client_ip or 'unknown'}"):
            raise DesktopClientError("rate_limited", "Too many redeem attempts", http_status=429)

        key = normalize_license_key(license_key)
        if not is_plausible_license_key(key):
            raise DesktopClientError("invalid_key_format", "License key format rejected", http_status=400)

        pubkey = device_pubkey.strip()
        fingerprint = machine_fingerprint.strip()
        if not pubkey or not fingerprint:
            raise DesktopClientError("invalid_device", "device_pubkey and machine_fingerprint required")

        key_hash = hash_license_key(key)
        async with self._pool.acquire() as conn, conn.transaction():
            lic = await conn.fetchrow(
                """
                    SELECT id, status, edition, profile_id, apps_json, expires_at,
                           COALESCE(allow_offline, false) AS allow_offline,
                           COALESCE(allow_online, true) AS allow_online,
                           COALESCE(allow_fofline, false) AS allow_fofline,
                           allowed_email
                    FROM desktop_client_licenses
                    WHERE license_key_hash = $1
                    """,
                key_hash,
            )
            if lic is None:
                await self._audit(
                    conn,
                    event="redeem_unknown_key",
                    license_id=None,
                    device_id=None,
                    client_ip=client_ip,
                    detail={},
                )
                raise DesktopClientError("unknown_license", "License not found", http_status=404)

            if lic["status"] != "active":
                raise DesktopClientError("license_revoked", "License is revoked", http_status=403)

            expires_at = lic["expires_at"]
            if expires_at is not None and expires_at <= datetime.now(UTC):
                raise DesktopClientError("license_expired", "License expired", http_status=403)

            existing = await conn.fetchrow(
                """
                    SELECT id, device_pubkey, machine_fingerprint, status
                    FROM desktop_client_devices
                    WHERE license_id = $1 AND status = 'active'
                    LIMIT 1
                    """,
                lic["id"],
            )
            if existing is not None:
                same = existing["device_pubkey"] == pubkey and existing["machine_fingerprint"] == fingerprint
                if not same:
                    await self._audit(
                        conn,
                        event="redeem_device_conflict",
                        license_id=lic["id"],
                        device_id=existing["id"],
                        client_ip=client_ip,
                        detail={"reason": "second_machine_denied"},
                    )
                    raise DesktopClientError(
                        "device_conflict",
                        "License already bound to another device",
                        http_status=409,
                    )
                await conn.execute(
                    """
                        UPDATE desktop_client_devices
                        SET last_seen_at = NOW()
                        WHERE id = $1
                        """,
                    existing["id"],
                )
                device_id = existing["id"]
                status = "already_bound"
            else:
                device_id = await conn.fetchval(
                    """
                        INSERT INTO desktop_client_devices (
                            license_id, device_pubkey, machine_fingerprint, status, last_seen_at
                        )
                        VALUES ($1, $2, $3, 'active', NOW())
                        RETURNING id
                        """,
                    lic["id"],
                    pubkey,
                    fingerprint,
                )
                status = "bound"

            await self._audit(
                conn,
                event="redeem_ok",
                license_id=lic["id"],
                device_id=device_id,
                client_ip=client_ip,
                detail={"status": status},
            )

        apps = lic["apps_json"]
        if isinstance(apps, str):
            apps = json.loads(apps)
        return BoundLicenseView(
            license_id=lic["id"],
            device_id=device_id,
            edition=lic["edition"],
            profile_id=lic["profile_id"],
            apps=list(apps or []),
            expires_at=lic["expires_at"],
            status=status,
            allow_offline=bool(lic["allow_offline"]),
            allow_online=bool(lic["allow_online"]),
            allow_fofline=bool(lic["allow_fofline"]),
            allowed_email=lic["allowed_email"],
        )

    def issue_challenge(self, *, device_pubkey: str) -> tuple[str, int]:
        pubkey = device_pubkey.strip()
        if len(pubkey) < 16:
            raise DesktopClientError("invalid_device", "device_pubkey too short")
        nonce = new_challenge_nonce()
        self._challenges.put(device_pubkey=pubkey, nonce=nonce)
        return nonce, 300

    async def prove(
        self,
        *,
        device_pubkey: str,
        machine_fingerprint: str,
        challenge: str,
        proof: str,
        client_ip: str | None,
    ) -> BoundLicenseView:
        if not self._rate.allow(f"prove:{client_ip or 'unknown'}"):
            raise DesktopClientError("rate_limited", "Too many prove attempts", http_status=429)

        pubkey = device_pubkey.strip()
        fingerprint = machine_fingerprint.strip()
        if not self._challenges.pop_valid(device_pubkey=pubkey, nonce=challenge):
            raise DesktopClientError("challenge_invalid", "Challenge missing or expired", http_status=401)

        if not verify_challenge_proof(
            challenge=challenge,
            device_pubkey=pubkey,
            machine_fingerprint=fingerprint,
            proof=proof,
        ):
            raise DesktopClientError("proof_invalid", "Challenge proof rejected", http_status=401)

        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT d.id AS device_id, d.status AS device_status,
                       l.id AS license_id, l.status AS license_status,
                       l.edition, l.profile_id, l.apps_json, l.expires_at,
                       COALESCE(l.allow_offline, false) AS allow_offline,
                       COALESCE(l.allow_online, true) AS allow_online,
                       COALESCE(l.allow_fofline, false) AS allow_fofline,
                       l.allowed_email
                FROM desktop_client_devices d
                JOIN desktop_client_licenses l ON l.id = d.license_id
                WHERE d.device_pubkey = $1 AND d.machine_fingerprint = $2
                ORDER BY d.created_at DESC
                LIMIT 1
                """,
                pubkey,
                fingerprint,
            )
            if row is None:
                raise DesktopClientError("device_unknown", "Device not registered", http_status=404)
            if row["device_status"] != "active" or row["license_status"] != "active":
                raise DesktopClientError("revoked", "License or device revoked", http_status=403)
            expires_at = row["expires_at"]
            if expires_at is not None and expires_at <= datetime.now(UTC):
                raise DesktopClientError("license_expired", "License expired", http_status=403)

            await conn.execute(
                "UPDATE desktop_client_devices SET last_seen_at = NOW() WHERE id = $1",
                row["device_id"],
            )
            await self._audit(
                conn,
                event="prove_ok",
                license_id=row["license_id"],
                device_id=row["device_id"],
                client_ip=client_ip,
                detail={},
            )

        apps = row["apps_json"]
        if isinstance(apps, str):
            apps = json.loads(apps)
        return BoundLicenseView(
            license_id=row["license_id"],
            device_id=row["device_id"],
            edition=row["edition"],
            profile_id=row["profile_id"],
            apps=list(apps or []),
            expires_at=row["expires_at"],
            status="proven",
            allow_offline=bool(row["allow_offline"]),
            allow_online=bool(row["allow_online"]),
            allow_fofline=bool(row["allow_fofline"]),
            allowed_email=row["allowed_email"],
        )
