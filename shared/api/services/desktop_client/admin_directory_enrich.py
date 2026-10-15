# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Batch enrich admin Users directory with desktop-client license, portal peer, and
# runtime heartbeat fields keyed by bound_keycloak_sub / presence.keycloak_sub.
# Invariants:
# - One license row per sub (latest updated_at wins); peer is active-by-license only.
# - Missing heartbeat → null WG/version fields (honest «нет данных»).
# Related:
# - api/routers/desktop_admin.py
# - documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
# ---

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from api.core.database_manager import get_asyncpg_pool
from api.services.desktop_client.license_modes import mode_from_flags

logger = logging.getLogger(__name__)


def _dt_to_iso_z(value: datetime | None) -> str | None:
    if value is None:
        return None
    value = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return value.isoformat().replace("+00:00", "Z")


def _empty_enrich() -> dict[str, Any]:
    return {
        "desktop_license_id": None,
        "desktop_license_label": None,
        "desktop_license_mode": None,
        "desktop_license_status": None,
        "desktop_peer_slug": None,
        "desktop_peer_status": None,
        "desktop_peer_assigned_ip": None,
        "desktop_app_version": None,
        "desktop_wg_up": None,
        "desktop_build_channel": None,
        "desktop_updater_pubkey_baked": None,
        "desktop_report_ip": None,
        "desktop_reported_at": None,
    }


async def batch_desktop_client_enrich_for_user_ids(
    user_ids: list[str],
) -> dict[str, dict[str, Any]]:
    """Return desktop license/peer/heartbeat enrich keyed by user id (keycloak_sub)."""

    cleaned = [str(x).strip() for x in user_ids if str(x).strip()]
    out: dict[str, dict[str, Any]] = {uid: _empty_enrich() for uid in cleaned}
    if not cleaned:
        return out

    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        try:
            lic_rows = await conn.fetch(
                """
                SELECT DISTINCT ON (l.bound_keycloak_sub)
                       l.id, l.label, l.status, l.allow_offline, l.allow_online,
                       l.bound_keycloak_sub, l.updated_at,
                       p.slug AS peer_slug, p.status AS peer_status,
                       host(p.assigned_ip) AS peer_ip
                FROM desktop_client_licenses l
                LEFT JOIN desktop_client_portal_peers p
                  ON p.license_id = l.id AND p.status = 'active'
                WHERE l.bound_keycloak_sub = ANY($1::text[])
                ORDER BY l.bound_keycloak_sub, l.updated_at DESC NULLS LAST
                """,
                cleaned,
            )
        except Exception as exc:  # noqa: BLE001 — degrade when licenses table missing in old env
            logger.debug("[STEP] desktop_directory_enrich_licenses_skip err=%s", exc)
            lic_rows = []

        try:
            presence_rows = await conn.fetch(
                """
                SELECT keycloak_sub, app_version, wg_up, peer_slug, build_channel,
                       updater_pubkey_baked, report_ip, reported_at
                FROM desktop_client_runtime_presence
                WHERE keycloak_sub = ANY($1::text[])
                """,
                cleaned,
            )
        except Exception as exc:  # noqa: BLE001 — degrade until migration applied
            logger.debug("[STEP] desktop_directory_enrich_presence_skip err=%s", exc)
            presence_rows = []

    for row in lic_rows:
        sub = str(row["bound_keycloak_sub"] or "").strip()
        if not sub or sub not in out:
            continue
        bucket = out[sub]
        lid = row["id"]
        bucket["desktop_license_id"] = str(lid) if lid is not None else None
        bucket["desktop_license_label"] = row["label"]
        bucket["desktop_license_status"] = row["status"]
        bucket["desktop_license_mode"] = mode_from_flags(
            allow_offline=bool(row["allow_offline"]),
            allow_online=bool(row["allow_online"]),
        )
        bucket["desktop_peer_slug"] = row["peer_slug"]
        bucket["desktop_peer_status"] = row["peer_status"]
        bucket["desktop_peer_assigned_ip"] = row["peer_ip"]

    for row in presence_rows:
        sub = str(row["keycloak_sub"] or "").strip()
        if not sub or sub not in out:
            continue
        bucket = out[sub]
        bucket["desktop_app_version"] = row["app_version"]
        bucket["desktop_wg_up"] = row["wg_up"]
        if row["peer_slug"] and not bucket.get("desktop_peer_slug"):
            bucket["desktop_peer_slug"] = row["peer_slug"]
        bucket["desktop_build_channel"] = row["build_channel"]
        bucket["desktop_updater_pubkey_baked"] = bool(row["updater_pubkey_baked"])
        bucket["desktop_report_ip"] = row["report_ip"]
        bucket["desktop_reported_at"] = _dt_to_iso_z(row["reported_at"])

    return out


async def upsert_runtime_presence(
    *,
    keycloak_sub: str | None,
    license_id: UUID | None,
    device_id: UUID | None,
    app_version: str | None,
    wg_up: bool | None,
    peer_slug: str | None,
    build_channel: str | None,
    updater_pubkey_baked: bool,
    report_ip: str | None,
) -> dict[str, Any]:
    """Upsert one runtime presence row (prefer keycloak_sub, else device_id)."""

    sub = (keycloak_sub or "").strip() or None
    if not sub and device_id is None:
        raise ValueError("keycloak_sub or device_id required")

    channel = (build_channel or "").strip().lower() or None
    if channel and channel not in ("rpm", "nsis", "unknown"):
        channel = "unknown"

    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        if sub:
            row = await conn.fetchrow(
                """
                INSERT INTO desktop_client_runtime_presence (
                    keycloak_sub, license_id, device_id, app_version, wg_up,
                    peer_slug, build_channel, updater_pubkey_baked, report_ip,
                    reported_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
                )
                ON CONFLICT (keycloak_sub) WHERE keycloak_sub IS NOT NULL
                DO UPDATE SET
                    license_id = COALESCE(EXCLUDED.license_id, desktop_client_runtime_presence.license_id),
                    device_id = COALESCE(EXCLUDED.device_id, desktop_client_runtime_presence.device_id),
                    app_version = COALESCE(EXCLUDED.app_version, desktop_client_runtime_presence.app_version),
                    wg_up = COALESCE(EXCLUDED.wg_up, desktop_client_runtime_presence.wg_up),
                    peer_slug = COALESCE(EXCLUDED.peer_slug, desktop_client_runtime_presence.peer_slug),
                    build_channel = COALESCE(EXCLUDED.build_channel, desktop_client_runtime_presence.build_channel),
                    updater_pubkey_baked = EXCLUDED.updater_pubkey_baked,
                    report_ip = COALESCE(EXCLUDED.report_ip, desktop_client_runtime_presence.report_ip),
                    reported_at = NOW(),
                    updated_at = NOW()
                RETURNING keycloak_sub, license_id, device_id, app_version, wg_up,
                          peer_slug, build_channel, updater_pubkey_baked, report_ip, reported_at
                """,
                sub,
                license_id,
                device_id,
                app_version,
                wg_up,
                peer_slug,
                channel,
                updater_pubkey_baked,
                report_ip,
            )
        else:
            row = await conn.fetchrow(
                """
                INSERT INTO desktop_client_runtime_presence (
                    keycloak_sub, license_id, device_id, app_version, wg_up,
                    peer_slug, build_channel, updater_pubkey_baked, report_ip,
                    reported_at, updated_at
                ) VALUES (
                    NULL, $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
                )
                ON CONFLICT (device_id) WHERE device_id IS NOT NULL
                DO UPDATE SET
                    license_id = COALESCE(EXCLUDED.license_id, desktop_client_runtime_presence.license_id),
                    app_version = COALESCE(EXCLUDED.app_version, desktop_client_runtime_presence.app_version),
                    wg_up = COALESCE(EXCLUDED.wg_up, desktop_client_runtime_presence.wg_up),
                    peer_slug = COALESCE(EXCLUDED.peer_slug, desktop_client_runtime_presence.peer_slug),
                    build_channel = COALESCE(EXCLUDED.build_channel, desktop_client_runtime_presence.build_channel),
                    updater_pubkey_baked = EXCLUDED.updater_pubkey_baked,
                    report_ip = COALESCE(EXCLUDED.report_ip, desktop_client_runtime_presence.report_ip),
                    reported_at = NOW(),
                    updated_at = NOW()
                RETURNING keycloak_sub, license_id, device_id, app_version, wg_up,
                          peer_slug, build_channel, updater_pubkey_baked, report_ip, reported_at
                """,
                license_id,
                device_id,
                app_version,
                wg_up,
                peer_slug,
                channel,
                updater_pubkey_baked,
                report_ip,
            )

    logger.debug(
        "[STEP] desktop_runtime_presence_upsert sub=%s device=%s wg_up=%s version=%s",
        sub,
        device_id,
        wg_up,
        app_version,
    )
    return {
        "keycloak_sub": row["keycloak_sub"],
        "license_id": str(row["license_id"]) if row["license_id"] else None,
        "device_id": str(row["device_id"]) if row["device_id"] else None,
        "app_version": row["app_version"],
        "wg_up": row["wg_up"],
        "peer_slug": row["peer_slug"],
        "build_channel": row["build_channel"],
        "updater_pubkey_baked": bool(row["updater_pubkey_baked"]),
        "report_ip": row["report_ip"],
        "reported_at": _dt_to_iso_z(row["reported_at"]),
    }
