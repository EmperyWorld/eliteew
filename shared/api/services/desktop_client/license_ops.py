# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# License ops mixin: issue, revoke, inventory, capabilities, device revoke.
# Invariants:
# - Plaintext keys never persisted; issue returns key once.
# Related:
# - license_service.py facade; license_mixin_host.py
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import UUID

from api.services.desktop_client.crypto_util import generate_license_key, hash_license_key
from api.services.desktop_client.license_mixin_host import LicenseMixinHost
from api.services.desktop_client.license_models import (
    DesktopClientError,
    IssuedLicenseView,
    LicenseCapabilitiesView,
    LicenseDeviceItem,
    LicenseInventoryItem,
)


class LicenseOpsMixin(LicenseMixinHost):
    async def revoke_license(
        self,
        *,
        license_id: UUID,
        reason: str | None,
        client_ip: str | None,
    ) -> None:
        async with self._pool.acquire() as conn, conn.transaction():
            updated = await conn.fetchval(
                """
                    UPDATE desktop_client_licenses
                    SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
                    WHERE id = $1 AND status = 'active'
                    RETURNING id
                    """,
                license_id,
            )
            if updated is None:
                raise DesktopClientError("not_found", "Active license not found", http_status=404)
            await conn.execute(
                """
                    UPDATE desktop_client_devices
                    SET status = 'revoked', revoked_at = NOW()
                    WHERE license_id = $1 AND status = 'active'
                    """,
                license_id,
            )
            await self._audit(
                conn,
                event="license_revoked",
                license_id=license_id,
                device_id=None,
                client_ip=client_ip,
                detail={"reason": reason},
            )

    async def issue(
        self,
        *,
        label: str | None = None,
        edition: str = "connected",
        profile_id: str | None = None,
        client_ip: str | None = None,
        allow_offline: bool | None = None,
        allow_online: bool | None = None,
        allow_fofline: bool = False,
        allowed_email: str | None = None,
        apps: list[Any] | None = None,
        expires_at: datetime | None = None,
    ) -> IssuedLicenseView:
        """Ops: create license row; return plaintext key once (never persisted)."""
        from api.services.desktop_client.license_modes import (
            normalize_email,
            seat_mode_from_edition,
        )

        ed = (edition or "connected").strip() or "connected"
        if len(ed) > 64:
            raise DesktopClientError("invalid_edition", "edition too long", http_status=400)
        label_n = (label or "").strip() or None
        profile_n = (profile_id or "").strip() or None
        email_n = normalize_email(allowed_email)
        fofline = bool(allow_fofline)

        if allow_offline is None or allow_online is None:
            mode = seat_mode_from_edition(ed, profile_n)
            from api.services.desktop_client.license_modes import flags_for_mode

            off, on = flags_for_mode(mode)
            allow_offline = off if allow_offline is None else allow_offline
            allow_online = on if allow_online is None else allow_online
        if not allow_offline and not allow_online and not fofline:
            raise DesktopClientError(
                "invalid_mode",
                "license needs allow_offline and/or allow_online (or allow_fofline)",
                http_status=400,
            )
        # mode_chk still requires offline OR online; FoFline-only seats must keep one base mode.
        if not allow_offline and not allow_online:
            allow_online = True

        apps_list = list(apps or [])
        plaintext = generate_license_key(groups=5)
        key_hash = hash_license_key(plaintext)

        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO desktop_client_licenses (
                    license_key_hash, status, edition, profile_id, label,
                    apps_json, expires_at, allow_offline, allow_online, allow_fofline,
                    allowed_email
                )
                VALUES ($1, 'active', $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
                RETURNING id, edition, profile_id, label, created_at, expires_at,
                          allow_offline, allow_online, allow_fofline, allowed_email
                """,
                key_hash,
                ed,
                profile_n,
                label_n,
                json.dumps(apps_list),
                expires_at,
                allow_offline,
                allow_online,
                fofline,
                email_n,
            )
            await self._audit(
                conn,
                event="license_issued",
                license_id=row["id"],
                device_id=None,
                client_ip=client_ip,
                detail={
                    "edition": ed,
                    "label": label_n,
                    "allow_offline": allow_offline,
                    "allow_online": allow_online,
                    "allow_fofline": fofline,
                },
            )
        return IssuedLicenseView(
            license_id=row["id"],
            license_key=plaintext,
            edition=row["edition"],
            profile_id=row["profile_id"],
            label=row["label"],
            created_at=row["created_at"],
            allow_offline=bool(row["allow_offline"]),
            allow_online=bool(row["allow_online"]),
            allow_fofline=bool(row["allow_fofline"]),
            allowed_email=row["allowed_email"],
            expires_at=row["expires_at"],
        )

    async def list_licenses(
        self,
        *,
        status: str | None = None,
        mode: str | None = None,
        q: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[LicenseInventoryItem], int]:
        """Admin inventory — never returns plaintext keys."""
        from api.services.desktop_client.license_modes import (
            flags_for_mode,
            normalize_seat_mode,
        )

        lim = max(1, min(int(limit), 200))
        off = max(0, int(offset))
        status_n = (status or "").strip().lower() or None
        if status_n is not None and status_n not in ("active", "revoked"):
            raise DesktopClientError(
                "invalid_status",
                "status must be active|revoked",
                http_status=400,
            )
        mode_n = (mode or "").strip().lower() or None
        allow_offline_f: bool | None = None
        allow_online_f: bool | None = None
        if mode_n is not None:
            allow_offline_f, allow_online_f = flags_for_mode(normalize_seat_mode(mode_n))
        q_n = (q or "").strip() or None
        if q_n is not None and len(q_n) > 200:
            raise DesktopClientError("invalid_query", "q too long", http_status=400)

        clauses: list[str] = []
        args: list[Any] = []

        def _add(clause: str, value: Any) -> None:
            args.append(value)
            clauses.append(clause.replace("?", f"${len(args)}"))

        if status_n is not None:
            _add("l.status = ?", status_n)
        if allow_offline_f is not None and allow_online_f is not None:
            _add("COALESCE(l.allow_offline, false) = ?", allow_offline_f)
            _add("COALESCE(l.allow_online, true) = ?", allow_online_f)
        if q_n is not None:
            args.append(f"%{q_n}%")
            idx = len(args)
            clauses.append(
                f"(COALESCE(l.label, '') ILIKE ${idx} OR COALESCE(l.allowed_email, '') ILIKE ${idx}"
                f" OR CAST(l.id AS text) ILIKE ${idx})"
            )

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        args_count = list(args)
        args_page = list(args)
        args_page.append(lim)
        lim_i = len(args_page)
        args_page.append(off)
        off_i = len(args_page)

        async with self._pool.acquire() as conn:
            total = int(
                await conn.fetchval(
                    f"""
                    SELECT COUNT(*)::int
                    FROM desktop_client_licenses l
                    {where_sql}
                    """,
                    *args_count,
                )
                or 0
            )
            rows = await conn.fetch(
                f"""
                SELECT l.id, l.status, l.edition, l.profile_id, l.label,
                       COALESCE(l.allow_offline, false) AS allow_offline,
                       COALESCE(l.allow_online, true) AS allow_online,
                       COALESCE(l.allow_fofline, false) AS allow_fofline,
                       l.allowed_email, l.bound_keycloak_sub, l.expires_at,
                       l.created_at, l.revoked_at,
                       (
                         SELECT COUNT(*)::int
                         FROM desktop_client_devices d
                         WHERE d.license_id = l.id AND d.status = 'active'
                       ) AS device_count_active
                FROM desktop_client_licenses l
                {where_sql}
                ORDER BY l.created_at DESC
                LIMIT ${lim_i} OFFSET ${off_i}
                """,
                *args_page,
            )

        items = [
            LicenseInventoryItem(
                license_id=row["id"],
                status=row["status"],
                edition=row["edition"],
                profile_id=row["profile_id"],
                label=row["label"],
                allow_offline=bool(row["allow_offline"]),
                allow_online=bool(row["allow_online"]),
                allow_fofline=bool(row["allow_fofline"]),
                allowed_email=row["allowed_email"],
                bound_keycloak_sub=row["bound_keycloak_sub"],
                expires_at=row["expires_at"],
                created_at=row["created_at"],
                revoked_at=row["revoked_at"],
                device_count_active=int(row["device_count_active"] or 0),
            )
            for row in rows
        ]
        return items, total

    async def list_devices(self, *, license_id: UUID) -> list[LicenseDeviceItem]:
        async with self._pool.acquire() as conn:
            exists = await conn.fetchval(
                "SELECT 1 FROM desktop_client_licenses WHERE id = $1",
                license_id,
            )
            if exists is None:
                raise DesktopClientError("not_found", "License not found", http_status=404)
            rows = await conn.fetch(
                """
                SELECT id, license_id, status, machine_fingerprint, device_pubkey,
                       last_seen_at, created_at, revoked_at
                FROM desktop_client_devices
                WHERE license_id = $1
                ORDER BY created_at DESC
                """,
                license_id,
            )
        return [
            LicenseDeviceItem(
                device_id=row["id"],
                license_id=row["license_id"],
                status=row["status"],
                machine_fingerprint=row["machine_fingerprint"],
                device_pubkey=row["device_pubkey"],
                last_seen_at=row["last_seen_at"],
                created_at=row["created_at"],
                revoked_at=row["revoked_at"],
            )
            for row in rows
        ]

    async def get_capabilities(self, *, license_id: UUID) -> LicenseCapabilitiesView:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, status, edition, profile_id, apps_json, expires_at, label,
                       COALESCE(allow_offline, false) AS allow_offline,
                       COALESCE(allow_online, true) AS allow_online,
                       COALESCE(allow_fofline, false) AS allow_fofline,
                       allowed_email, bound_keycloak_sub, email_bound_at
                FROM desktop_client_licenses
                WHERE id = $1
                """,
                license_id,
            )
        if row is None:
            raise DesktopClientError("not_found", "License not found", http_status=404)
        apps = row["apps_json"]
        if isinstance(apps, str):
            apps = json.loads(apps)
        return LicenseCapabilitiesView(
            license_id=row["id"],
            status=row["status"],
            edition=row["edition"],
            profile_id=row["profile_id"],
            apps=list(apps or []),
            expires_at=row["expires_at"],
            label=row["label"],
            allow_offline=bool(row["allow_offline"]),
            allow_online=bool(row["allow_online"]),
            allow_fofline=bool(row["allow_fofline"]),
            allowed_email=row["allowed_email"],
            bound_keycloak_sub=row["bound_keycloak_sub"],
            email_bound_at=row["email_bound_at"],
        )

    async def update_capabilities(
        self,
        *,
        license_id: UUID,
        client_ip: str | None,
        allow_offline: bool | None = None,
        allow_online: bool | None = None,
        allow_fofline: bool | None = None,
        apps: list[Any] | None = None,
        expires_at: datetime | None = None,
        set_expires: bool = False,
        clear_expires: bool = False,
        allowed_email: str | None = None,
        set_allowed_email: bool = False,
        clear_allowed_email: bool = False,
        clear_account_bind: bool = False,
        label: str | None = None,
        set_label: bool = False,
    ) -> LicenseCapabilitiesView:
        """Patch license composition without rotating the key (1C)."""
        from api.services.desktop_client.license_modes import (
            edition_for_mode,
            mode_from_flags,
            normalize_email,
            profile_id_for_mode,
        )

        async with self._pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT id, status, edition, profile_id, apps_json, expires_at, label,
                       COALESCE(allow_offline, false) AS allow_offline,
                       COALESCE(allow_online, true) AS allow_online,
                       COALESCE(allow_fofline, false) AS allow_fofline,
                       allowed_email, bound_keycloak_sub, email_bound_at
                FROM desktop_client_licenses
                WHERE id = $1
                FOR UPDATE
                """,
                license_id,
            )
            if row is None:
                raise DesktopClientError("not_found", "License not found", http_status=404)

            off = row["allow_offline"] if allow_offline is None else bool(allow_offline)
            on = row["allow_online"] if allow_online is None else bool(allow_online)
            fofline = bool(row["allow_fofline"])
            if allow_fofline is not None:
                fofline = bool(allow_fofline)
            if not off and not on:
                raise DesktopClientError(
                    "invalid_mode",
                    "license needs allow_offline and/or allow_online",
                    http_status=400,
                )

            existing_apps = row["apps_json"]
            if apps is not None:
                apps_payload = json.dumps(list(apps))
            else:
                apps_payload = existing_apps if isinstance(existing_apps, str) else json.dumps(existing_apps or [])

            if clear_expires:
                exp: datetime | None = None
            elif set_expires:
                exp = expires_at
            else:
                exp = row["expires_at"]

            lab = ((label or "").strip() or None) if set_label else row["label"]

            email = row["allowed_email"]
            bound_sub = row["bound_keycloak_sub"]
            email_bound_at = row["email_bound_at"]
            if clear_account_bind or clear_allowed_email:
                email = None
                bound_sub = None
                email_bound_at = None
            elif set_allowed_email:
                email = normalize_email(allowed_email)
                if email != row["allowed_email"]:
                    bound_sub = None
                    email_bound_at = None

            ed = row["edition"]
            prof = row["profile_id"]
            if allow_offline is not None or allow_online is not None:
                mode = mode_from_flags(allow_offline=off, allow_online=on)
                ed = edition_for_mode(mode)
                prof = profile_id_for_mode(mode)

            updated = await conn.fetchrow(
                """
                UPDATE desktop_client_licenses
                SET allow_offline = $2,
                    allow_online = $3,
                    allow_fofline = $4,
                    apps_json = $5::jsonb,
                    expires_at = $6,
                    allowed_email = $7,
                    bound_keycloak_sub = $8,
                    email_bound_at = $9,
                    label = $10,
                    edition = $11,
                    profile_id = $12,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, status, edition, profile_id, apps_json, expires_at, label,
                          allow_offline, allow_online, allow_fofline, allowed_email,
                          bound_keycloak_sub, email_bound_at
                """,
                license_id,
                off,
                on,
                fofline,
                apps_payload,
                exp,
                email,
                bound_sub,
                email_bound_at,
                lab,
                ed,
                prof,
            )
            await self._audit(
                conn,
                event="license_capabilities_updated",
                license_id=license_id,
                device_id=None,
                client_ip=client_ip,
                detail={
                    "allow_offline": off,
                    "allow_online": on,
                    "clear_account_bind": clear_account_bind,
                },
            )

        apps_out = updated["apps_json"]
        if isinstance(apps_out, str):
            apps_out = json.loads(apps_out)
        return LicenseCapabilitiesView(
            license_id=updated["id"],
            status=updated["status"],
            edition=updated["edition"],
            profile_id=updated["profile_id"],
            apps=list(apps_out or []),
            expires_at=updated["expires_at"],
            label=updated["label"],
            allow_offline=bool(updated["allow_offline"]),
            allow_online=bool(updated["allow_online"]),
            allow_fofline=bool(updated["allow_fofline"]),
            allowed_email=updated["allowed_email"],
            bound_keycloak_sub=updated["bound_keycloak_sub"],
            email_bound_at=updated["email_bound_at"],
        )

    async def revoke_device(
        self,
        *,
        device_id: UUID,
        reason: str | None,
        client_ip: str | None,
    ) -> None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE desktop_client_devices
                SET status = 'revoked', revoked_at = NOW()
                WHERE id = $1 AND status = 'active'
                RETURNING id, license_id
                """,
                device_id,
            )
            if row is None:
                raise DesktopClientError("not_found", "Active device not found", http_status=404)
            await self._audit(
                conn,
                event="device_revoked",
                license_id=row["license_id"],
                device_id=device_id,
                client_ip=client_ip,
                detail={"reason": reason},
            )
