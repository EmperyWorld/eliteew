# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# License runtime mixin: preflight, heartbeat, session assert.
# Invariants:
# - Preflight/heartbeat return no email/PII; device_id optional (Capsule seats).
# Related:
# - license_service.py facade; license_mixin_host.py
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from api.services.desktop_client.license_mixin_host import LicenseMixinHost
from api.services.desktop_client.license_models import (
    DesktopClientError,
    LicensePreflightView,
    SessionAssertView,
)

logger = logging.getLogger(__name__)


class LicenseRuntimeMixin(LicenseMixinHost):
    async def preflight_license(
        self,
        *,
        license_id: UUID,
        device_id: UUID | None = None,
        machine_fingerprint: str | None = None,
        client_ip: str | None = None,
        purpose: str = "preflight",
    ) -> LicensePreflightView:
        """Fail-closed license gate before OIDC / Start (and shared heartbeat checks).

        Does not return email or Keycloak identifiers. Device is optional (Capsule seats).
        """
        purpose_n = (purpose or "preflight").strip().lower() or "preflight"
        if purpose_n not in ("preflight", "heartbeat"):
            purpose_n = "preflight"
        event_prefix = f"license_{purpose_n}"
        rate_key = f"{purpose_n}:{client_ip or 'unknown'}"
        if not self._rate.allow(rate_key):
            raise DesktopClientError(
                "rate_limited",
                f"Too many {purpose_n} attempts",
                http_status=429,
            )

        fp = (machine_fingerprint or "").strip() or None

        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, status, expires_at,
                       COALESCE(allow_offline, false) AS allow_offline,
                       COALESCE(allow_online, true) AS allow_online,
                       COALESCE(allow_fofline, false) AS allow_fofline
                FROM desktop_client_licenses
                WHERE id = $1
                """,
                license_id,
            )
            if row is None:
                await self._audit(
                    conn,
                    event=f"{event_prefix}_not_found",
                    license_id=license_id,
                    device_id=device_id,
                    client_ip=client_ip,
                    detail={},
                )
                logger.info("[STEP] %s_not_found license_id=%s", event_prefix, license_id)
                raise DesktopClientError("not_found", "License not found", http_status=404)
            if row["status"] != "active":
                await self._audit(
                    conn,
                    event=f"{event_prefix}_revoked",
                    license_id=license_id,
                    device_id=device_id,
                    client_ip=client_ip,
                    detail={"status": row["status"]},
                )
                logger.info("[STEP] %s_revoked license_id=%s", event_prefix, license_id)
                raise DesktopClientError("license_revoked", "License is revoked", http_status=403)
            expires_at = row["expires_at"]
            if expires_at is not None and expires_at <= datetime.now(UTC):
                await self._audit(
                    conn,
                    event=f"{event_prefix}_expired",
                    license_id=license_id,
                    device_id=device_id,
                    client_ip=client_ip,
                    detail={},
                )
                logger.info("[STEP] %s_expired license_id=%s", event_prefix, license_id)
                raise DesktopClientError("license_expired", "License expired", http_status=403)

            resolved_device_id: UUID | None = None
            effective_device_id = device_id
            if device_id is None and fp is not None:
                by_fp = await conn.fetchrow(
                    """
                    SELECT id, status, machine_fingerprint
                    FROM desktop_client_devices
                    WHERE license_id = $1 AND status = 'active' AND machine_fingerprint = $2
                    LIMIT 1
                    """,
                    license_id,
                    fp,
                )
                if by_fp is not None:
                    effective_device_id = by_fp["id"]
            if effective_device_id is None:
                active_device_count = await conn.fetchval(
                    """
                    SELECT COUNT(*)::int
                    FROM desktop_client_devices
                    WHERE license_id = $1 AND status = 'active'
                    """,
                    license_id,
                )
                if int(active_device_count or 0) > 0:
                    await self._audit(
                        conn,
                        event=f"{event_prefix}_device_required",
                        license_id=license_id,
                        device_id=None,
                        client_ip=client_ip,
                        detail={"active_device_count": int(active_device_count or 0)},
                    )
                    logger.info(
                        "[STEP] %s_device_required license_id=%s",
                        event_prefix,
                        license_id,
                    )
                    raise DesktopClientError(
                        "device_required",
                        "Device binding required for this license",
                        http_status=403,
                    )
            else:
                if fp is None:
                    await self._audit(
                        conn,
                        event=f"{event_prefix}_fingerprint_required",
                        license_id=license_id,
                        device_id=effective_device_id,
                        client_ip=client_ip,
                        detail={},
                    )
                    logger.info(
                        "[STEP] %s_fingerprint_required license_id=%s device_id=%s",
                        event_prefix,
                        license_id,
                        effective_device_id,
                    )
                    raise DesktopClientError(
                        "fingerprint_required",
                        "Device fingerprint required",
                        http_status=400,
                    )
                device_row = await conn.fetchrow(
                    """
                    SELECT id, status, machine_fingerprint
                    FROM desktop_client_devices
                    WHERE license_id = $1 AND id = $2
                    """,
                    license_id,
                    effective_device_id,
                )
                if device_row is None:
                    await self._audit(
                        conn,
                        event=f"{event_prefix}_device_not_found",
                        license_id=license_id,
                        device_id=effective_device_id,
                        client_ip=client_ip,
                        detail={},
                    )
                    logger.info(
                        "[STEP] %s_device_not_found license_id=%s device_id=%s",
                        event_prefix,
                        license_id,
                        device_id,
                    )
                    raise DesktopClientError(
                        "not_found",
                        "License/device binding not found",
                        http_status=404,
                    )
                if device_row["status"] != "active":
                    await self._audit(
                        conn,
                        event=f"{event_prefix}_device_revoked",
                        license_id=license_id,
                        device_id=effective_device_id,
                        client_ip=client_ip,
                        detail={"device_status": device_row["status"]},
                    )
                    logger.info(
                        "[STEP] %s_device_revoked license_id=%s device_id=%s",
                        event_prefix,
                        license_id,
                        device_id,
                    )
                    raise DesktopClientError(
                        "device_revoked",
                        "Device revoked",
                        http_status=403,
                    )
                if device_row["machine_fingerprint"] != fp:
                    await self._audit(
                        conn,
                        event=f"{event_prefix}_fingerprint_mismatch",
                        license_id=license_id,
                        device_id=effective_device_id,
                        client_ip=client_ip,
                        detail={},
                    )
                    logger.info(
                        "[STEP] %s_fingerprint_mismatch license_id=%s device_id=%s",
                        event_prefix,
                        license_id,
                        device_id,
                    )
                    raise DesktopClientError(
                        "device_conflict",
                        "Device fingerprint mismatch",
                        http_status=409,
                    )
                resolved_device_id = device_row["id"]
                if purpose_n == "heartbeat":
                    await conn.execute(
                        "UPDATE desktop_client_devices SET last_seen_at = NOW() WHERE id = $1",
                        resolved_device_id,
                    )

            await self._audit(
                conn,
                event=f"{event_prefix}_ok",
                license_id=license_id,
                device_id=resolved_device_id,
                client_ip=client_ip,
                detail={"device_optional": resolved_device_id is None},
            )
            logger.info(
                "[STEP] %s_ok license_id=%s device_id=%s",
                event_prefix,
                license_id,
                resolved_device_id,
            )

        return LicensePreflightView(
            ok=True,
            code="ok",
            expires_at=row["expires_at"],
            allow_online=bool(row["allow_online"]),
            allow_offline=bool(row["allow_offline"]),
            allow_fofline=bool(row["allow_fofline"]),
        )

    async def heartbeat_license(
        self,
        *,
        license_id: UUID,
        device_id: UUID | None = None,
        machine_fingerprint: str | None = None,
        client_ip: str | None = None,
    ) -> LicensePreflightView:
        """In-session kill-switch check — same gates as preflight; touches device last_seen."""
        return await self.preflight_license(
            license_id=license_id,
            device_id=device_id,
            machine_fingerprint=machine_fingerprint,
            client_ip=client_ip,
            purpose="heartbeat",
        )

    async def assert_session(
        self,
        *,
        license_id: UUID,
        device_id: UUID | None,
        keycloak_sub: str,
        email: str | None,
        client_ip: str | None,
        channel: str = "desktop",
    ) -> SessionAssertView:
        """Online gate: license active + email/sub bind; channel selects entitlement bit.

        Device row is optional: Capsule seats may lack `desktop_client_devices` until redeem;
        expiry and allowed_email still fail-closed on license alone.
        """
        from api.services.desktop_client.license_modes import normalize_email

        channel_n = (channel or "desktop").strip().lower() or "desktop"
        if channel_n not in ("desktop", "fofline"):
            raise DesktopClientError(
                "invalid_channel",
                "channel must be desktop|fofline",
                http_status=400,
            )

        sub = (keycloak_sub or "").strip()
        if not sub:
            raise DesktopClientError("invalid_token", "token sub required", http_status=401)
        email_n = normalize_email(email)
        if not email_n:
            raise DesktopClientError(
                "email_required",
                "account email required for licensed desktop login",
                http_status=403,
            )

        async with self._pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT l.id, l.status, l.expires_at,
                       COALESCE(l.allow_offline, false) AS allow_offline,
                       COALESCE(l.allow_online, true) AS allow_online,
                       COALESCE(l.allow_fofline, false) AS allow_fofline,
                       l.allowed_email, l.bound_keycloak_sub
                FROM desktop_client_licenses l
                WHERE l.id = $1
                FOR UPDATE OF l
                """,
                license_id,
            )
            if row is None:
                raise DesktopClientError(
                    "not_found",
                    "License not found",
                    http_status=404,
                )
            if row["status"] != "active":
                raise DesktopClientError("license_revoked", "License is revoked", http_status=403)
            expires_at = row["expires_at"]
            if expires_at is not None and expires_at <= datetime.now(UTC):
                raise DesktopClientError("license_expired", "License expired", http_status=403)
            if channel_n == "fofline":
                if not row["allow_fofline"]:
                    raise DesktopClientError(
                        "fofline_not_allowed",
                        "License does not include FoFline",
                        http_status=403,
                    )
            elif not row["allow_online"]:
                raise DesktopClientError(
                    "online_not_allowed",
                    "License does not include cloud desktop",
                    http_status=403,
                )

            resolved_device_id: UUID | None = device_id
            if device_id is not None:
                device_row = await conn.fetchrow(
                    """
                    SELECT id, status
                    FROM desktop_client_devices
                    WHERE license_id = $1 AND id = $2
                    """,
                    license_id,
                    device_id,
                )
                if device_row is None:
                    raise DesktopClientError(
                        "not_found",
                        "License/device binding not found",
                        http_status=404,
                    )
                if device_row["status"] != "active":
                    raise DesktopClientError("revoked", "Device revoked", http_status=403)

            allowed = row["allowed_email"]
            bound_sub = row["bound_keycloak_sub"]
            claimed = False

            if bound_sub and bound_sub != sub:
                await self._audit(
                    conn,
                    event="session_assert_sub_mismatch",
                    license_id=license_id,
                    device_id=resolved_device_id,
                    client_ip=client_ip,
                    detail={"channel": channel_n},
                )
                raise DesktopClientError(
                    "license_user_mismatch",
                    "License is bound to another account",
                    http_status=403,
                )
            if allowed and allowed != email_n:
                await self._audit(
                    conn,
                    event="session_assert_email_mismatch",
                    license_id=license_id,
                    device_id=resolved_device_id,
                    client_ip=client_ip,
                    detail={"channel": channel_n},
                )
                raise DesktopClientError(
                    "license_user_mismatch",
                    "License is bound to another account",
                    http_status=403,
                )

            if not allowed or not bound_sub:
                claimed = not bool(allowed) or not bool(bound_sub)
                await conn.execute(
                    """
                    UPDATE desktop_client_licenses
                    SET allowed_email = COALESCE(allowed_email, $2),
                        bound_keycloak_sub = COALESCE(bound_keycloak_sub, $3),
                        email_bound_at = COALESCE(email_bound_at, NOW()),
                        updated_at = NOW()
                    WHERE id = $1
                    """,
                    license_id,
                    email_n,
                    sub,
                )
                allowed = allowed or email_n
                bound_sub = bound_sub or sub

            if resolved_device_id is not None:
                await conn.execute(
                    "UPDATE desktop_client_devices SET last_seen_at = NOW() WHERE id = $1",
                    resolved_device_id,
                )
            await self._audit(
                conn,
                event="session_assert_ok",
                license_id=license_id,
                device_id=resolved_device_id,
                client_ip=client_ip,
                detail={
                    "claimed": claimed,
                    "channel": channel_n,
                    "device_optional": resolved_device_id is None,
                },
            )

        return SessionAssertView(
            license_id=license_id,
            allowed_email=allowed or email_n,
            bound_keycloak_sub=bound_sub or sub,
            claimed=claimed,
            allow_online=bool(row["allow_online"]),
            allow_offline=bool(row["allow_offline"]),
            allow_fofline=bool(row["allow_fofline"]),
            channel=channel_n,
        )
