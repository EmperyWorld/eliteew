# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Owner-facing storage quarantine: mark broken, list, recheck, permanent hard-purge.
# Invariants:
# - broken_quarantined keeps deleted_at NULL; library lists exclude it.
# - Permanent delete is immediate (PG + Seaweed + best-effort indexes).
# - Reason codes never include storage paths/fids.
# Related:
# - documentation/product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md
# - api/services/unified_content/storage_integrity.py
# ---

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from api.schemas.unified_content import AuditAction
from api.services.unified_content.storage_backends.minio_storage import (
    SeaweedFileCorruptedError,
    SeaweedFileNotFoundError,
    SeaweedStorageUnavailableError,
)
from api.services.unified_content.storage_integrity import (
    NEGATIVE_CACHE_KEY_PREFIX,
    NEGATIVE_CACHE_TTL_SECONDS,
    REASON_RECHECK_FAILED,
    REASON_SEAWEED_NEEDLE_MISSING,
    STORAGE_INTEGRITY_BROKEN_QUARANTINED,
    StorageBlobKnownBrokenError,
    reason_from_storage_error,
)

logger = logging.getLogger(__name__)


class ContentStorageIntegrityOpsMixin:
    """Mixin methods for user storage quarantine (broken files)."""

    async def _set_storage_broken_negative_cache(self, content_id: UUID) -> None:
        try:
            from api.core.database_manager import get_redis_client  # noqa: PLC0415

            redis = await get_redis_client()
            if redis is None:
                return
            await redis.setex(
                f"{NEGATIVE_CACHE_KEY_PREFIX}{content_id}",
                NEGATIVE_CACHE_TTL_SECONDS,
                "1",
            )
        except Exception:
            logger.debug(
                "[STEP] content_storage_quarantine_neg_cache_skip content_id=%s",
                content_id,
                exc_info=True,
            )

    async def _clear_storage_broken_negative_cache(self, content_id: UUID) -> None:
        try:
            from api.core.database_manager import get_redis_client  # noqa: PLC0415

            redis = await get_redis_client()
            if redis is None:
                return
            await redis.delete(f"{NEGATIVE_CACHE_KEY_PREFIX}{content_id}")
        except Exception:
            logger.debug(
                "[STEP] content_storage_quarantine_neg_cache_clear_skip content_id=%s",
                content_id,
                exc_info=True,
            )

    async def is_storage_broken_negatively_cached(self, content_id: UUID) -> bool:
        try:
            from api.core.database_manager import get_redis_client  # noqa: PLC0415

            redis = await get_redis_client()
            if redis is None:
                return False
            return bool(await redis.exists(f"{NEGATIVE_CACHE_KEY_PREFIX}{content_id}"))
        except Exception:
            return False

    async def ensure_storage_blob_readable(self, content_id: UUID) -> None:
        """
        Fail closed before Seaweed I/O when the row is already quarantined
        or Redis negative-cache says broken. Raises StorageBlobKnownBrokenError.
        """
        if await self.is_storage_broken_negatively_cached(content_id):
            raise StorageBlobKnownBrokenError(f"content_id={content_id} negative-cached broken")
        status: str | None = None
        try:
            async with self.db_pool.acquire() as conn:  # type: ignore[attr-defined]
                status = await conn.fetchval(
                    """
                    SELECT storage_integrity_status
                    FROM unified_content
                    WHERE id = $1 AND deleted_at IS NULL
                    """,
                    content_id,
                )
        except Exception:
            logger.debug(
                "[STEP] content_storage_broken_status_skip content_id=%s",
                content_id,
                exc_info=True,
            )
            return
        if status == STORAGE_INTEGRITY_BROKEN_QUARANTINED:
            raise StorageBlobKnownBrokenError(f"content_id={content_id} broken_quarantined")

    async def quarantine_storage_broken(
        self,
        content_id: UUID,
        *,
        reason: str,
        actor_user_id: str | None = None,
    ) -> bool:
        """
        Idempotent user quarantine: set broken_quarantined without soft-delete.
        Returns True if row was updated or already quarantined.
        """
        async with self.db_pool.acquire() as conn:  # type: ignore[attr-defined]
            row = await conn.fetchrow(
                """
                SELECT user_id, storage_integrity_status
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                content_id,
            )
            if not row:
                return False
            owner_id = str(row["user_id"]) if row["user_id"] is not None else None
            if row["storage_integrity_status"] == STORAGE_INTEGRITY_BROKEN_QUARANTINED:
                await self._set_storage_broken_negative_cache(content_id)
                return True
            await conn.execute(
                """
                UPDATE unified_content SET
                    storage_integrity_status = $2,
                    storage_broken_at = COALESCE(storage_broken_at, NOW()),
                    storage_broken_reason = $3,
                    storage_last_checked_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND deleted_at IS NULL
                """,
                content_id,
                STORAGE_INTEGRITY_BROKEN_QUARANTINED,
                reason[:64],
            )

        audit_user = actor_user_id or owner_id or "system"
        try:
            await self.audit_logger.log(  # type: ignore[attr-defined]
                content_id=content_id,
                user_id=audit_user,
                action=AuditAction.STORAGE_QUARANTINE_BROKEN,
                details={"reason": reason, "owner_user_id": owner_id},
            )
        except Exception:
            logger.exception(
                "[STEP] content_storage_quarantine_audit_fail content_id=%s",
                content_id,
            )

        await self._set_storage_broken_negative_cache(content_id)
        if getattr(self, "search_service", None):
            try:
                await self.search_service.delete_from_index(content_id)  # type: ignore[attr-defined]
            except Exception:
                logger.exception(
                    "[STEP] content_storage_quarantine_es_skip content_id=%s",
                    content_id,
                )
        logger.warning(
            "[STEP] content_storage_quarantine content_id=%s reason=%s",
            content_id,
            reason,
        )
        try:
            from api.monitoring.metrics import observe_content_storage_integrity  # noqa: PLC0415

            observe_content_storage_integrity(event="quarantine", outcome="ok")
        except Exception:
            logger.debug("[STEP] content_storage_metric_skip", exc_info=True)
        return True

    async def quarantine_from_storage_error(
        self,
        content_id: UUID,
        exc: BaseException,
        *,
        actor_user_id: str | None = None,
    ) -> None:
        reason = reason_from_storage_error(exc)
        await self.quarantine_storage_broken(
            content_id,
            reason=reason,
            actor_user_id=actor_user_id,
        )

    async def list_broken_content(
        self,
        user_id: str,
        *,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        cap = max(1, min(int(limit), 500))
        off = max(0, int(offset))
        async with self.db_pool.acquire() as conn:  # type: ignore[attr-defined]
            total = await conn.fetchval(
                """
                SELECT COUNT(*)::bigint
                FROM unified_content
                WHERE (user_id)::text = $1
                  AND deleted_at IS NULL
                  AND storage_integrity_status = $2
                """,
                user_id,
                STORAGE_INTEGRITY_BROKEN_QUARANTINED,
            )
            rows = await conn.fetch(
                """
                SELECT
                    id, name, title, original_filename, content_type, mime_type,
                    file_size, storage_broken_at, storage_broken_reason,
                    storage_last_checked_at, created_at, updated_at
                FROM unified_content
                WHERE (user_id)::text = $1
                  AND deleted_at IS NULL
                  AND storage_integrity_status = $2
                ORDER BY storage_broken_at DESC NULLS LAST, updated_at DESC
                LIMIT $3 OFFSET $4
                """,
                user_id,
                STORAGE_INTEGRITY_BROKEN_QUARANTINED,
                cap,
                off,
            )

        items = []
        for row in rows:
            items.append(
                {
                    "id": str(row["id"]),
                    "name": row["name"],
                    "title": row["title"],
                    "original_filename": row.get("original_filename"),
                    "content_type": row["content_type"],
                    "mime_type": row["mime_type"],
                    "file_size": row["file_size"],
                    "storage_broken_at": row["storage_broken_at"].isoformat() if row["storage_broken_at"] else None,
                    "storage_broken_reason": row["storage_broken_reason"],
                    "storage_last_checked_at": row["storage_last_checked_at"].isoformat()
                    if row["storage_last_checked_at"]
                    else None,
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                }
            )
        return {"total": int(total or 0), "items": items, "limit": cap, "offset": off}

    async def storage_recheck(
        self,
        content_id: UUID,
        user_id: str,
    ) -> dict[str, Any]:
        """Owner fail-fast probe: clear quarantine on success, keep on 404-class."""
        async with self.db_pool.acquire() as conn:  # type: ignore[attr-defined]
            row = await conn.fetchrow(
                """
                SELECT id, user_id, file_path, storage_backend::text AS sb,
                       storage_integrity_status, thumbnail_path
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                content_id,
            )
        if not row:
            raise ValueError("Content not found")
        if str(row["user_id"]) != str(user_id):
            raise PermissionError("Only the owner can recheck storage")

        file_path = (row["file_path"] or "").strip()
        sb = (row["sb"] or "").strip().lower()
        if not file_path or sb not in {"seaweedfs", "minio"}:
            raise ValueError("Storage backend does not support recheck")

        backend = self.storage_factory.get_backend_by_name("seaweedfs")  # type: ignore[attr-defined]
        try:
            data = await backend.retrieve(file_path, content_id, fail_fast=True)
            if not data:
                raise SeaweedFileCorruptedError("empty object")
        except SeaweedStorageUnavailableError:
            raise
        except (SeaweedFileNotFoundError, SeaweedFileCorruptedError) as exc:
            await self.quarantine_storage_broken(
                content_id,
                reason=reason_from_storage_error(exc) or REASON_RECHECK_FAILED,
                actor_user_id=user_id,
            )
            await self.audit_logger.log(  # type: ignore[attr-defined]
                content_id=content_id,
                user_id=user_id,
                action=AuditAction.STORAGE_RECHECK,
                details={"result": "still_broken"},
            )
            try:
                from api.monitoring.metrics import observe_content_storage_integrity  # noqa: PLC0415

                observe_content_storage_integrity(event="recheck", outcome="still_broken")
            except Exception:
                logger.debug("[STEP] content_storage_metric_skip", exc_info=True)
            return {
                "content_id": str(content_id),
                "ok": False,
                "storage_integrity_status": STORAGE_INTEGRITY_BROKEN_QUARANTINED,
            }

        async with self.db_pool.acquire() as conn:  # type: ignore[attr-defined]
            await conn.execute(
                """
                UPDATE unified_content SET
                    storage_integrity_status = 'ok',
                    storage_broken_at = NULL,
                    storage_broken_reason = NULL,
                    storage_last_checked_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND (user_id)::text = $2
                """,
                content_id,
                user_id,
            )
        await self._clear_storage_broken_negative_cache(content_id)
        await self.audit_logger.log(  # type: ignore[attr-defined]
            content_id=content_id,
            user_id=user_id,
            action=AuditAction.STORAGE_RECHECK,
            details={"result": "ok"},
        )
        try:
            from api.monitoring.metrics import observe_content_storage_integrity  # noqa: PLC0415

            observe_content_storage_integrity(event="recheck", outcome="ok")
        except Exception:
            logger.debug("[STEP] content_storage_metric_skip", exc_info=True)
        return {
            "content_id": str(content_id),
            "ok": True,
            "storage_integrity_status": "ok",
        }

    async def permanent_delete_broken(
        self,
        content_id: UUID,
        user_id: str,
    ) -> dict[str, Any]:
        """Owner immediate hard-purge for broken (or any owned) content — PG + Seaweed."""
        async with self.db_pool.acquire() as conn:  # type: ignore[attr-defined]
            row = await conn.fetchrow(
                """
                SELECT id, user_id, file_path, thumbnail_path,
                       storage_backend::text AS sb, storage_integrity_status
                FROM unified_content
                WHERE id = $1 AND deleted_at IS NULL
                """,
                content_id,
            )
        if not row:
            raise ValueError("Content not found")
        if str(row["user_id"]) != str(user_id):
            raise PermissionError("Only the owner can permanently delete this content")

        sb = (row["sb"] or "").strip().lower()
        paths = [p for p in [(row["file_path"] or "").strip(), (row["thumbnail_path"] or "").strip()] if p]
        if sb in {"seaweedfs", "minio"} and paths:
            try:
                backend = self.storage_factory.get_backend_by_name("seaweedfs")  # type: ignore[attr-defined]
                for path in paths:
                    try:
                        await backend.delete(path, content_id)
                    except Exception:
                        logger.debug(
                            "[STEP] permanent_delete_s3_skip content_id=%s",
                            content_id,
                            exc_info=True,
                        )
            except Exception:
                logger.exception(
                    "[STEP] permanent_delete_s3_backend_fail content_id=%s",
                    content_id,
                )

        if getattr(self, "search_service", None):
            try:
                await self.search_service.delete_from_index(content_id)  # type: ignore[attr-defined]
            except Exception:
                logger.exception(
                    "[STEP] permanent_delete_es_skip content_id=%s",
                    content_id,
                )

        try:
            from api.services.unified_content.unified_content_qdrant_service import (  # noqa: PLC0415
                delete_qdrant_chunks_for_content,
            )

            await delete_qdrant_chunks_for_content(content_id)
        except Exception:
            logger.debug(
                "[STEP] permanent_delete_qdrant_skip content_id=%s",
                content_id,
                exc_info=True,
            )

        async with self.db_pool.acquire() as conn:  # type: ignore[attr-defined]
            async with conn.transaction():
                await conn.execute(
                    "UPDATE unified_content SET parent_id = NULL WHERE parent_id = $1",
                    content_id,
                )
                status = await conn.execute(
                    """
                    DELETE FROM unified_content
                    WHERE id = $1 AND (user_id)::text = $2
                    """,
                    content_id,
                    user_id,
                )
            if status != "DELETE 1":
                raise RuntimeError(f"Permanent delete affected 0 rows for {content_id}")

        await self._clear_storage_broken_negative_cache(content_id)
        await self.audit_logger.log(  # type: ignore[attr-defined]
            content_id=content_id,
            user_id=user_id,
            action=AuditAction.STORAGE_PERMANENT_DELETE,
            details={
                "was_broken": row["storage_integrity_status"] == STORAGE_INTEGRITY_BROKEN_QUARANTINED,
                "at": datetime.now(UTC).isoformat(),
            },
        )
        logger.warning(
            "[STEP] content_storage_permanent_delete content_id=%s user_id=%s",
            content_id,
            user_id,
        )
        try:
            from api.monitoring.metrics import observe_content_storage_integrity  # noqa: PLC0415

            observe_content_storage_integrity(event="permanent_delete", outcome="ok")
        except Exception:
            logger.debug("[STEP] content_storage_metric_skip", exc_info=True)
        return {"content_id": str(content_id), "deleted": True}

    async def owner_scan_storage_orphans(
        self,
        user_id: str,
        *,
        dry_run: bool = True,
        limit: int = 200,
    ) -> dict[str, Any]:
        """
        Owner one-shot scan: mark unreadable Seaweed objects as broken_quarantined
        (user «Битые файлы», not admin soft-delete blob_missing).
        """
        cap = max(1, min(int(limit), 2_000))
        async with self.db_pool.acquire() as conn:  # type: ignore[attr-defined]
            rows = await conn.fetch(
                """
                SELECT id, file_path, storage_backend::text AS sb
                FROM unified_content
                WHERE (user_id)::text = $1
                  AND deleted_at IS NULL
                  AND storage_backend::text IN ('seaweedfs', 'minio')
                  AND file_path IS NOT NULL
                  AND trim(file_path) <> ''
                  AND coalesce(storage_integrity_status, '') <> $2
                ORDER BY updated_at DESC
                LIMIT $3
                """,
                user_id,
                STORAGE_INTEGRITY_BROKEN_QUARANTINED,
                cap,
            )

        scanned = 0
        missing_ids: list[str] = []
        quarantined_ids: list[str] = []
        for row in rows:
            scanned += 1
            cid: UUID = row["id"]
            path: str = row["file_path"]
            try:
                backend = self.storage_factory.get_backend_by_name("seaweedfs")  # type: ignore[attr-defined]
                ok_exists = await backend.exists(path, cid)
                ok = ok_exists
                verify = getattr(backend, "verify_object_readable", None)
                if ok_exists and verify is not None:
                    ok = await verify(path, cid)
            except Exception:
                logger.debug(
                    "[STEP] owner_scan_storage_orphan_probe_fail content_id=%s",
                    cid,
                    exc_info=True,
                )
                ok = False
            if ok:
                continue
            missing_ids.append(str(cid))
            if dry_run:
                continue
            await self.quarantine_storage_broken(
                cid,
                reason=REASON_SEAWEED_NEEDLE_MISSING,
                actor_user_id=user_id,
            )
            quarantined_ids.append(str(cid))

        try:
            from api.monitoring.metrics import observe_content_storage_integrity  # noqa: PLC0415

            observe_content_storage_integrity(
                event="owner_scan",
                outcome="ok" if not dry_run else "dry_run",
            )
        except Exception:
            logger.debug("[STEP] content_storage_metric_skip", exc_info=True)

        return {
            "dry_run": dry_run,
            "scanned": scanned,
            "missing_count": len(missing_ids),
            "missing_ids": missing_ids,
            "quarantined_ids": quarantined_ids,
        }
