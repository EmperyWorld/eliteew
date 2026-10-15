# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Soft-revoke denylist SoT (DB) + signed publish to OTA updates dir (Wave B / O4).
# Invariants:
# - Soft revoke ≠ hard license revoke; both channels may apply.
# - Publish requires DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY + writable updates out dir.
# Related:
# - api/services/desktop_client/denylist_sign.py
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
# ---

from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

import asyncpg

from api.services.desktop_client.denylist_sign import (
    build_denylist_payload,
    sign_denylist,
)
from api.services.desktop_client.license_service import DesktopClientError

logger = logging.getLogger(__name__)

ENV_UPDATES_OUT = "DESKTOP_CLIENT_UPDATES_OUT"


@dataclass
class SoftRevokeEntry:
    license_id: UUID
    reason: str | None
    created_at: datetime
    created_by: str | None
    license_label: str | None
    license_status: str | None


@dataclass
class DenylistPublishView:
    published_at: datetime | None
    note: str | None
    revoked_count: int
    payload_hash: str | None
    out_path: str | None
    pending_count: int
    updates_out_configured: bool
    signing_key_configured: bool


@dataclass
class DenylistPublishResult:
    published_at: datetime
    revoked_count: int
    payload_hash: str
    out_path: str
    note: str | None


def resolve_updates_out_dir() -> Path | None:
    raw = (os.environ.get(ENV_UPDATES_OUT) or "").strip()
    if not raw:
        return None
    return Path(raw)


def signing_key_configured() -> bool:
    from api.services.desktop_client.entitlement_sign import load_signing_key_seed

    return load_signing_key_seed() is not None


class DesktopClientDenylistService:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def list_entries(self) -> list[SoftRevokeEntry]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT s.license_id, s.reason, s.created_at, s.created_by,
                       l.label AS license_label, l.status AS license_status
                FROM desktop_client_soft_revokes s
                LEFT JOIN desktop_client_licenses l ON l.id = s.license_id
                ORDER BY s.created_at DESC
                """
            )
        return [
            SoftRevokeEntry(
                license_id=row["license_id"],
                reason=row["reason"],
                created_at=row["created_at"],
                created_by=row["created_by"],
                license_label=row["license_label"],
                license_status=row["license_status"],
            )
            for row in rows
        ]

    async def add_entry(
        self,
        *,
        license_id: UUID,
        reason: str | None,
        created_by: str | None,
    ) -> SoftRevokeEntry:
        reason_n = (reason or "").strip() or None
        if reason_n and len(reason_n) > 500:
            raise DesktopClientError("invalid_reason", "reason too long", http_status=400)
        created_by_n = (created_by or "").strip() or None
        async with self._pool.acquire() as conn:
            exists = await conn.fetchval(
                "SELECT 1 FROM desktop_client_licenses WHERE id = $1",
                license_id,
            )
            if exists is None:
                raise DesktopClientError("not_found", "License not found", http_status=404)
            row = await conn.fetchrow(
                """
                INSERT INTO desktop_client_soft_revokes (license_id, reason, created_by)
                VALUES ($1, $2, $3)
                ON CONFLICT (license_id) DO UPDATE
                SET reason = EXCLUDED.reason,
                    created_by = COALESCE(EXCLUDED.created_by, desktop_client_soft_revokes.created_by),
                    created_at = NOW()
                RETURNING license_id, reason, created_at, created_by
                """,
                license_id,
                reason_n,
                created_by_n,
            )
            label_status = await conn.fetchrow(
                "SELECT label, status FROM desktop_client_licenses WHERE id = $1",
                license_id,
            )
        logger.info(
            "[STEP] denylist_soft_revoke_add license_id=%s by=%s",
            license_id,
            created_by_n,
        )
        return SoftRevokeEntry(
            license_id=row["license_id"],
            reason=row["reason"],
            created_at=row["created_at"],
            created_by=row["created_by"],
            license_label=label_status["label"] if label_status else None,
            license_status=label_status["status"] if label_status else None,
        )

    async def remove_entry(self, *, license_id: UUID) -> None:
        async with self._pool.acquire() as conn:
            deleted = await conn.fetchval(
                """
                DELETE FROM desktop_client_soft_revokes
                WHERE license_id = $1
                RETURNING license_id
                """,
                license_id,
            )
        if deleted is None:
            raise DesktopClientError("not_found", "Soft-revoke entry not found", http_status=404)
        logger.info("[STEP] denylist_soft_revoke_remove license_id=%s", license_id)

    async def status(self) -> DenylistPublishView:
        async with self._pool.acquire() as conn:
            pending = int(await conn.fetchval("SELECT COUNT(*)::int FROM desktop_client_soft_revokes") or 0)
            pub = await conn.fetchrow(
                """
                SELECT published_at, note, revoked_count, payload_hash, out_path
                FROM desktop_client_denylist_publish
                WHERE id = 1
                """
            )
        out = resolve_updates_out_dir()
        return DenylistPublishView(
            published_at=pub["published_at"] if pub else None,
            note=pub["note"] if pub else None,
            revoked_count=int(pub["revoked_count"] or 0) if pub else 0,
            payload_hash=pub["payload_hash"] if pub else None,
            out_path=pub["out_path"] if pub else None,
            pending_count=pending,
            updates_out_configured=out is not None,
            signing_key_configured=signing_key_configured(),
        )

    async def publish(self, *, note: str | None = None) -> DenylistPublishResult:
        if not signing_key_configured():
            raise DesktopClientError(
                "signing_key_missing",
                "DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY is not configured",
                http_status=503,
            )
        out_dir = resolve_updates_out_dir()
        if out_dir is None:
            raise DesktopClientError(
                "updates_out_missing",
                f"{ENV_UPDATES_OUT} is not set; cannot write denylist.json",
                http_status=503,
            )

        async with self._pool.acquire() as conn:
            ids = [
                str(r["license_id"])
                for r in await conn.fetch("SELECT license_id FROM desktop_client_soft_revokes ORDER BY license_id")
            ]

        note_n = (note or "").strip() or None
        payload = build_denylist_payload(revoked_license_ids=ids, note=note_n)
        try:
            doc = sign_denylist(payload)
        except RuntimeError as exc:
            raise DesktopClientError(
                "signing_key_missing",
                "entitlement signing key missing",
                http_status=503,
            ) from exc

        out_path = out_dir / "denylist.json"
        try:
            out_dir.mkdir(parents=True, exist_ok=True)
            raw = json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
            out_path.write_text(raw, encoding="utf-8")
        except OSError as exc:
            logger.error(
                "[STEP] denylist_publish_write_fail path=%s err=%s",
                out_path,
                exc,
            )
            raise DesktopClientError(
                "updates_out_unwritable",
                f"cannot write denylist.json under {out_dir}: {exc}",
                http_status=503,
            ) from exc

        payload_hash = hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        published_at = datetime.now(UTC)
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO desktop_client_denylist_publish
                    (id, published_at, note, revoked_count, payload_hash, out_path, updated_at)
                VALUES (1, $1, $2, $3, $4, $5, NOW())
                ON CONFLICT (id) DO UPDATE
                SET published_at = EXCLUDED.published_at,
                    note = EXCLUDED.note,
                    revoked_count = EXCLUDED.revoked_count,
                    payload_hash = EXCLUDED.payload_hash,
                    out_path = EXCLUDED.out_path,
                    updated_at = NOW()
                """,
                published_at,
                note_n,
                len(ids),
                payload_hash,
                str(out_path),
            )
        logger.info(
            "[STEP] denylist_publish_ok path=%s revoked_count=%s hash=%s",
            out_path,
            len(ids),
            payload_hash[:12],
        )
        return DenylistPublishResult(
            published_at=published_at,
            revoked_count=len(ids),
            payload_hash=payload_hash,
            out_path=str(out_path),
            note=note_n,
        )


__all__ = [
    "ENV_UPDATES_OUT",
    "DenylistPublishResult",
    "DenylistPublishView",
    "DesktopClientDenylistService",
    "SoftRevokeEntry",
    "resolve_updates_out_dir",
    "signing_key_configured",
]
