# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Import portalctl peers.manifest.json rows into desktop_client_portal_peers (Wave 3b.1).
# Invariants:
# - Requires non-empty public_key; does not invent private keys.
# - Allows historical IPs in .101–.149 (portalctl pool); create API still uses .150–.254.
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import asyncpg

from api.services.desktop_client.license_service import DesktopClientError
from api.services.desktop_client.portal_edge_sync import (
    edge_sync_configured,
    schedule_desktop_portal_edge_reconcile,
)
from api.services.desktop_client.portal_wg_keys import validate_slug

logger = logging.getLogger(__name__)


@dataclass
class ManifestImportResult:
    imported: int
    updated: int
    skipped: int
    errors: list[str]
    edge_sync_enqueued: bool


def load_manifest_peers(path: Path) -> list[dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    peers = raw.get("peers") if isinstance(raw, dict) else None
    if not isinstance(peers, list):
        raise DesktopClientError("bad_manifest", "peers[] missing", http_status=400)
    return [p for p in peers if isinstance(p, dict)]


async def import_manifest_peers(
    pool: asyncpg.Pool,
    *,
    peers: list[dict[str, Any]],
    client_ip: str | None = None,
) -> ManifestImportResult:
    imported = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    async with pool.acquire() as conn:
        for peer in peers:
            slug_raw = str(peer.get("slug") or "").strip()
            try:
                slug = validate_slug(slug_raw)
            except ValueError:
                errors.append(f"invalid_slug:{slug_raw or '?'}")
                skipped += 1
                continue
            pubkey = str(peer.get("public_key") or "").strip()
            if not pubkey:
                errors.append(f"missing_pubkey:{slug}")
                skipped += 1
                continue
            status = str(peer.get("status") or "active").strip().lower()
            if status not in {"active", "revoked"}:
                status = "active"
            ip_raw = str(peer.get("assigned_ip") or "").strip()
            if not ip_raw:
                errors.append(f"missing_ip:{slug}")
                skipped += 1
                continue
            if "/" not in ip_raw:
                ip_raw = f"{ip_raw}/32"
            label = str(peer.get("label") or peer.get("notes") or "").strip() or None
            sync_status = "pending" if edge_sync_configured() else "skipped"

            existing = await conn.fetchrow(
                """
                SELECT id, status FROM public.desktop_client_portal_peers
                WHERE slug = $1
                ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC
                LIMIT 1
                """,
                slug,
            )
            if existing and existing["status"] == "active":
                await conn.execute(
                    """
                    UPDATE public.desktop_client_portal_peers
                    SET wg_public_key = $2,
                        assigned_ip = $3::inet,
                        label = COALESCE($4, label),
                        edge_sync_status = $5,
                        updated_at = now()
                    WHERE id = $1::uuid
                    """,
                    existing["id"],
                    pubkey,
                    ip_raw,
                    label,
                    sync_status,
                )
                updated += 1
            else:
                try:
                    await conn.execute(
                        """
                        INSERT INTO public.desktop_client_portal_peers (
                            slug, wg_public_key, assigned_ip, status, label, edge_sync_status
                        ) VALUES ($1, $2, $3::inet, $4, $5, $6)
                        """,
                        slug,
                        pubkey,
                        ip_raw,
                        status,
                        label,
                        sync_status if status == "active" else "skipped",
                    )
                    imported += 1
                except asyncpg.UniqueViolationError as exc:
                    errors.append(f"conflict:{slug}:{exc}")
                    skipped += 1
                    continue

        await conn.execute(
            """
            INSERT INTO public.desktop_client_audit (event, client_ip, detail)
            VALUES ('portal_peer_manifest_import', $1, $2::jsonb)
            """,
            client_ip,
            json.dumps(
                {
                    "imported": imported,
                    "updated": updated,
                    "skipped": skipped,
                    "errors": errors[:20],
                },
                ensure_ascii=False,
            ),
        )

    enqueued = False
    if imported or updated:
        enqueued = schedule_desktop_portal_edge_reconcile(trigger="manifest_import")
    logger.info(
        "[STEP] desktop_portal_manifest_import imported=%s updated=%s skipped=%s enqueued=%s",
        imported,
        updated,
        skipped,
        enqueued,
    )
    return ManifestImportResult(
        imported=imported,
        updated=updated,
        skipped=skipped,
        errors=errors,
        edge_sync_enqueued=enqueued,
    )
