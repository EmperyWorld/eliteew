# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave 9 fleet Capsule v2 migration: grace rows, exceptions, peer revoke after activation.
# Invariants:
# - No secrets in summarize() output.
# - After activation: keep newest (or keep_peer_slug) active portal peer; revoke others.
# Related:
# - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §12g
# - api/services/desktop_client/portal_peer_service.py
# ---

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from api.services.desktop_client.license_service import DesktopClientError
from api.services.desktop_client.portal_peer_service import DesktopClientPortalPeerService

logger = logging.getLogger(__name__)

DEFAULT_DEADLINE_DAYS = 14
VALID_STATUSES = frozenset({"pending", "grace", "completed", "quarantined", "exception"})


def deadline_at(*, days: int = DEFAULT_DEADLINE_DAYS, now: datetime | None = None) -> datetime:
    """Pure helper: migration deadline from now + days (UTC)."""
    base = now or datetime.now(UTC)
    if base.tzinfo is None:
        base = base.replace(tzinfo=UTC)
    return base + timedelta(days=max(1, int(days)))


class FleetMigrationService:
    def __init__(self, pool: Any) -> None:
        self._pool = pool
        self._peers = DesktopClientPortalPeerService(pool)

    async def ensure_grace(self, license_id: UUID, *, deadline_days: int = DEFAULT_DEADLINE_DAYS) -> dict[str, Any]:
        deadline = deadline_at(days=deadline_days)
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO desktop_client_fleet_migration (
                    license_id, migration_deadline, status, updated_at
                ) VALUES ($1, $2, 'grace', NOW())
                ON CONFLICT (license_id) DO UPDATE SET
                    migration_deadline = EXCLUDED.migration_deadline,
                    status = CASE
                        WHEN desktop_client_fleet_migration.status IN ('completed', 'quarantined')
                            THEN desktop_client_fleet_migration.status
                        ELSE 'grace'
                    END,
                    updated_at = NOW()
                RETURNING license_id, migration_deadline, status, exception_owner,
                          exception_until, old_peer_count, notes, created_at, updated_at
                """,
                license_id,
                deadline,
            )
        logger.info(
            "[STEP] fleet_migration_grace license_id=%s deadline=%s status=%s",
            license_id,
            deadline.isoformat(),
            row["status"],
        )
        return _row_dict(row)

    async def mark_completed(self, license_id: UUID) -> dict[str, Any]:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO desktop_client_fleet_migration (
                    license_id, migration_deadline, status, updated_at
                ) VALUES ($1, NOW(), 'completed', NOW())
                ON CONFLICT (license_id) DO UPDATE SET
                    status = 'completed',
                    updated_at = NOW()
                RETURNING license_id, migration_deadline, status, exception_owner,
                          exception_until, old_peer_count, notes, created_at, updated_at
                """,
                license_id,
            )
        logger.info("[STEP] fleet_migration_completed license_id=%s", license_id)
        return _row_dict(row)

    async def set_exception(
        self,
        license_id: UUID,
        *,
        owner: str,
        until: datetime,
        notes: str | None = None,
    ) -> dict[str, Any]:
        owner_n = (owner or "").strip()
        if not owner_n:
            raise DesktopClientError("fleet_exception_owner", "exception owner required", http_status=400)
        until_n = until
        if until_n.tzinfo is None:
            until_n = until_n.replace(tzinfo=UTC)
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO desktop_client_fleet_migration (
                    license_id, migration_deadline, status,
                    exception_owner, exception_until, notes, updated_at
                ) VALUES ($1, $2, 'exception', $3, $2, $4, NOW())
                ON CONFLICT (license_id) DO UPDATE SET
                    status = 'exception',
                    exception_owner = EXCLUDED.exception_owner,
                    exception_until = EXCLUDED.exception_until,
                    notes = COALESCE(EXCLUDED.notes, desktop_client_fleet_migration.notes),
                    migration_deadline = GREATEST(
                        desktop_client_fleet_migration.migration_deadline,
                        EXCLUDED.exception_until
                    ),
                    updated_at = NOW()
                RETURNING license_id, migration_deadline, status, exception_owner,
                          exception_until, old_peer_count, notes, created_at, updated_at
                """,
                license_id,
                until_n,
                owner_n,
                (notes or "").strip() or None,
            )
        logger.info(
            "[STEP] fleet_migration_exception license_id=%s owner=%s until=%s",
            license_id,
            owner_n,
            until_n.isoformat(),
        )
        return _row_dict(row)

    async def complete_migration_after_activation(
        self,
        license_id: UUID,
        *,
        keep_peer_slug: str | None = None,
        client_ip: str | None = None,
    ) -> dict[str, Any]:
        """Revoke other active portal peers for license; mark migration completed."""
        keep = (keep_peer_slug or "").strip() or None
        if keep is None:
            async with self._pool.acquire() as conn:
                issued = await conn.fetchval(
                    """
                    SELECT issued_peer_slug
                    FROM desktop_client_enrollment_requests
                    WHERE license_id = $1 AND issued_peer_slug IS NOT NULL
                    ORDER BY issued_at DESC NULLS LAST, updated_at DESC
                    LIMIT 1
                    """,
                    license_id,
                )
                keep = (str(issued).strip() if issued else None) or None

        async with self._pool.acquire() as conn:
            peers = await conn.fetch(
                """
                SELECT id, slug, created_at
                FROM public.desktop_client_portal_peers
                WHERE license_id = $1 AND status = 'active'
                ORDER BY created_at DESC NULLS LAST
                """,
                license_id,
            )

        keep_id: UUID | None = None
        if keep:
            for p in peers:
                if str(p["slug"]) == keep:
                    keep_id = p["id"]
                    break
        if keep_id is None and peers:
            keep_id = peers[0]["id"]

        revoked = 0
        for p in peers:
            if keep_id is not None and p["id"] == keep_id:
                continue
            try:
                await self._peers.revoke_peer(
                    peer_id=p["id"],
                    reason="fleet_migration_activation",
                    client_ip=client_ip,
                )
                revoked += 1
            except DesktopClientError as exc:
                logger.warning(
                    "[STEP] fleet_migration_peer_revoke_skip peer_id=%s code=%s",
                    p["id"],
                    exc.code,
                )

        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO desktop_client_fleet_migration (
                    license_id, migration_deadline, status, old_peer_count, updated_at
                ) VALUES ($1, NOW(), 'completed', $2, NOW())
                ON CONFLICT (license_id) DO UPDATE SET
                    status = 'completed',
                    old_peer_count = GREATEST(
                        desktop_client_fleet_migration.old_peer_count,
                        EXCLUDED.old_peer_count
                    ),
                    updated_at = NOW()
                """,
                license_id,
                len(peers),
            )

        logger.info(
            "[STEP] fleet_migration_after_activation license_id=%s keep_peer=%s revoked=%s",
            license_id,
            keep,
            revoked,
        )
        return {
            "license_id": str(license_id),
            "keep_peer_slug": keep,
            "active_before": len(peers),
            "revoked": revoked,
            "status": "completed",
        }

    async def summarize(self) -> dict[str, Any]:
        """Operator rollup — counts only, no secrets."""
        async with self._pool.acquire() as conn:
            by_status_rows = await conn.fetch(
                """
                SELECT status, COUNT(*)::int AS n
                FROM desktop_client_fleet_migration
                GROUP BY status
                """
            )
            presence_rows = await conn.fetch(
                """
                SELECT COALESCE(NULLIF(trim(app_version), ''), '(unknown)') AS app_version,
                       COUNT(*)::int AS n
                FROM desktop_client_runtime_presence
                GROUP BY 1
                ORDER BY n DESC
                LIMIT 50
                """
            )
            enrollment_rows = await conn.fetch(
                """
                SELECT status, COUNT(*)::int AS n
                FROM desktop_client_enrollment_requests
                GROUP BY status
                """
            )
            activation_row = await conn.fetchrow(
                """
                SELECT
                    COUNT(*) FILTER (WHERE status = 'issued')::int AS issued,
                    COUNT(*) FILTER (
                        WHERE activation_consumed_at IS NOT NULL
                    )::int AS activated,
                    COUNT(*) FILTER (
                        WHERE status = 'issued' AND activation_consumed_at IS NULL
                          AND activation_token_hash IS NOT NULL
                    )::int AS pending_activation
                FROM desktop_client_enrollment_requests
                """
            )
            multi_peer_rows = await conn.fetch(
                """
                SELECT p.license_id::text AS license_id, COUNT(*)::int AS active_peers
                FROM public.desktop_client_portal_peers p
                WHERE p.status = 'active' AND p.license_id IS NOT NULL
                GROUP BY p.license_id
                HAVING COUNT(*) > 1
                ORDER BY active_peers DESC
                LIMIT 100
                """
            )
            stale_peer_rows = await conn.fetch(
                """
                SELECT p.license_id::text AS license_id, COUNT(*)::int AS active_peers
                FROM public.desktop_client_portal_peers p
                INNER JOIN desktop_client_enrollment_requests e
                    ON e.license_id = p.license_id AND e.activation_consumed_at IS NOT NULL
                LEFT JOIN desktop_client_fleet_migration m ON m.license_id = p.license_id
                WHERE p.status = 'active' AND p.license_id IS NOT NULL
                  AND COALESCE(m.status, 'pending') <> 'completed'
                GROUP BY p.license_id
                ORDER BY active_peers DESC
                LIMIT 100
                """
            )
            totals = await conn.fetchrow(
                """
                SELECT COUNT(*)::int AS migration_rows
                FROM desktop_client_fleet_migration
                """
            )

        by_status = {str(r["status"]): int(r["n"]) for r in by_status_rows}
        return {
            "schema_version": 1,
            "totals": {
                "migration_rows": int(totals["migration_rows"] if totals else 0),
                "by_status": by_status,
            },
            "by_status": by_status,
            "presence_versions": [{"app_version": str(r["app_version"]), "count": int(r["n"])} for r in presence_rows],
            "enrollment": {
                "by_status": {str(r["status"]): int(r["n"]) for r in enrollment_rows},
                "issued": int(activation_row["issued"] if activation_row else 0),
                "activated": int(activation_row["activated"] if activation_row else 0),
                "pending_activation": int(activation_row["pending_activation"] if activation_row else 0),
            },
            "licenses_with_multi_active_peers": [
                {
                    "license_id": str(r["license_id"]),
                    "active_peers": int(r["active_peers"]),
                }
                for r in multi_peer_rows
            ],
            "licenses_activated_migration_pending": [
                {
                    "license_id": str(r["license_id"]),
                    "active_peers": int(r["active_peers"]),
                }
                for r in stale_peer_rows
            ],
        }


def _row_dict(row: Any) -> dict[str, Any]:
    return {
        "license_id": str(row["license_id"]),
        "migration_deadline": row["migration_deadline"].isoformat() if row["migration_deadline"] else None,
        "status": str(row["status"]),
        "exception_owner": row["exception_owner"],
        "exception_until": row["exception_until"].isoformat() if row["exception_until"] else None,
        "old_peer_count": int(row["old_peer_count"] or 0),
        "notes": row["notes"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }
