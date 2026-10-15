# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Ops service: create/list/revoke desktop-client portal peers (Wave 3b).
# Invariants:
# - Private key never persisted; returned once on create.
# - IP pool .150–.254 only; enqueue edge sync after commit.
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import asyncpg

from api.core.unified_config import unified_settings
from api.services.desktop_client.license_service import DesktopClientError
from api.services.desktop_client.portal_edge_sync import (
    edge_sync_configured,
    schedule_desktop_portal_edge_reconcile,
)
from api.services.desktop_client.portal_wg_keys import (
    allocate_next_ip,
    build_client_conf,
    generate_wg_keypair,
    validate_slug,
)

logger = logging.getLogger(__name__)


@dataclass
class PortalPeerView:
    id: UUID
    slug: str
    wg_public_key: str
    assigned_ip: str
    status: str
    label: str | None
    license_id: UUID | None
    edge_sync_status: str
    edge_synced_at: datetime | None
    edge_sync_error: str | None
    created_at: datetime


@dataclass
class PortalPeerCreateResult:
    peer: PortalPeerView
    private_key: str
    client_conf: str
    edge_sync_enqueued: bool


class DesktopClientPortalPeerService:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def list_peers(self) -> list[PortalPeerView]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, slug, wg_public_key, host(assigned_ip) AS assigned_ip,
                       status, label, license_id, edge_sync_status, edge_synced_at,
                       edge_sync_error, created_at
                FROM public.desktop_client_portal_peers
                ORDER BY created_at DESC
                """
            )
        return [_row_to_view(r) for r in rows]

    async def create_peer(
        self,
        *,
        slug: str,
        label: str | None = None,
        license_id: UUID | None = None,
        client_ip: str | None = None,
    ) -> PortalPeerCreateResult:
        try:
            slug_n = validate_slug(slug)
        except ValueError as exc:
            raise DesktopClientError("invalid_slug", "slug must be kebab-case", http_status=400) from exc

        endpoint = (unified_settings.desktop_client_portal_endpoint or "").strip()
        edge_pub = (unified_settings.desktop_client_portal_edge_public_key or "").strip()
        if not endpoint or not edge_pub:
            raise DesktopClientError(
                "portal_endpoint_unconfigured",
                "DESKTOP_CLIENT_PORTAL_ENDPOINT and DESKTOP_CLIENT_PORTAL_EDGE_PUBLIC_KEY required",
                http_status=503,
            )

        private_key, public_key = generate_wg_keypair()

        async with self._pool.acquire() as conn, conn.transaction():
            existing = await conn.fetchrow(
                """
                    SELECT id, status FROM public.desktop_client_portal_peers
                    WHERE slug = $1
                    """,
                slug_n,
            )
            if existing and existing["status"] == "active":
                raise DesktopClientError(
                    "slug_conflict",
                    f"active peer slug already exists: {slug_n}",
                    http_status=409,
                )

            used_rows = await conn.fetch(
                """
                    SELECT host(assigned_ip) AS host
                    FROM public.desktop_client_portal_peers
                    WHERE status = 'active'
                    """
            )
            used: set[int] = set()
            for r in used_rows:
                host = str(r["host"] or "").strip()
                if host.startswith("10.88.89."):
                    try:
                        used.add(int(host.rsplit(".", 1)[-1]))
                    except ValueError:
                        continue
            try:
                assigned = allocate_next_ip(used)
            except RuntimeError as exc:
                raise DesktopClientError(
                    "ip_exhausted",
                    "no free portal DB IP in .150–.254",
                    http_status=503,
                ) from exc

            sync_status = "pending" if edge_sync_configured() else "skipped"
            row = await conn.fetchrow(
                """
                    INSERT INTO public.desktop_client_portal_peers (
                        slug, wg_public_key, assigned_ip, status, label, license_id,
                        edge_sync_status
                    ) VALUES (
                        $1, $2, $3::inet, 'active', $4, $5, $6
                    )
                    RETURNING id, slug, wg_public_key, host(assigned_ip) AS assigned_ip,
                              status, label, license_id, edge_sync_status, edge_synced_at,
                              edge_sync_error, created_at
                    """,
                slug_n,
                public_key,
                assigned,
                (label or "").strip() or None,
                license_id,
                sync_status,
            )
            await conn.execute(
                """
                    INSERT INTO public.desktop_client_audit (event, license_id, client_ip, detail)
                    VALUES ('portal_peer_create', $1, $2, $3::jsonb)
                    """,
                license_id,
                client_ip,
                _json(
                    {
                        "peer_id": str(row["id"]),
                        "slug": slug_n,
                        "assigned_ip": str(row["assigned_ip"]),
                        "wg_public_key": public_key,
                        "edge_sync_status": sync_status,
                    }
                ),
            )

        view = _row_to_view(row)
        client_conf = build_client_conf(
            private_key=private_key,
            assigned_ip=f"{view.assigned_ip}/32",
            endpoint=endpoint,
            edge_public_key=edge_pub,
        )
        enqueued = schedule_desktop_portal_edge_reconcile(trigger="portal_peer_create")
        if not enqueued and sync_status == "pending":
            await self._mark_skipped_or_pending(view.id, configured=edge_sync_configured())

        return PortalPeerCreateResult(
            peer=view,
            private_key=private_key,
            client_conf=client_conf,
            edge_sync_enqueued=enqueued,
        )

    async def revoke_peer(
        self,
        *,
        peer_id: UUID,
        reason: str | None = None,
        client_ip: str | None = None,
    ) -> PortalPeerView:
        async with self._pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                    UPDATE public.desktop_client_portal_peers
                    SET status = 'revoked',
                        revoked_at = now(),
                        updated_at = now(),
                        edge_sync_status = CASE
                            WHEN $2 THEN 'pending'
                            ELSE 'skipped'
                        END
                    WHERE id = $1::uuid AND status = 'active'
                    RETURNING id, slug, wg_public_key, host(assigned_ip) AS assigned_ip,
                              status, label, license_id, edge_sync_status, edge_synced_at,
                              edge_sync_error, created_at
                    """,
                peer_id,
                edge_sync_configured(),
            )
            if row is None:
                raise DesktopClientError(
                    "peer_not_found",
                    "active portal peer not found",
                    http_status=404,
                )
            await conn.execute(
                """
                    INSERT INTO public.desktop_client_audit (event, license_id, client_ip, detail)
                    VALUES ('portal_peer_revoke', $1, $2, $3::jsonb)
                    """,
                row["license_id"],
                client_ip,
                _json(
                    {
                        "peer_id": str(row["id"]),
                        "slug": row["slug"],
                        "reason": (reason or "").strip() or None,
                    }
                ),
            )
        view = _row_to_view(row)
        schedule_desktop_portal_edge_reconcile(trigger="portal_peer_revoke")
        return view

    async def _mark_skipped_or_pending(self, peer_id: UUID, *, configured: bool) -> None:
        status = "pending" if configured else "skipped"
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE public.desktop_client_portal_peers
                SET edge_sync_status = $2, updated_at = now()
                WHERE id = $1::uuid
                """,
                peer_id,
                status,
            )


def _row_to_view(row: asyncpg.Record) -> PortalPeerView:
    return PortalPeerView(
        id=row["id"],
        slug=str(row["slug"]),
        wg_public_key=str(row["wg_public_key"]),
        assigned_ip=str(row["assigned_ip"]),
        status=str(row["status"]),
        label=row["label"],
        license_id=row["license_id"],
        edge_sync_status=str(row["edge_sync_status"]),
        edge_synced_at=row["edge_synced_at"],
        edge_sync_error=row["edge_sync_error"],
        created_at=row["created_at"] or datetime.now(UTC),
    )


def _json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False)
