#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stale queue/request reconciliation mixin for UGS QueueManagerService: cleanup of
# orphaned queue rows and abandoned pending/processing generation_requests.
# Invariants:
# - Default stale horizons remain 30m / 6h / 12h unless overridden via UGS_STALE_* env (see
#   documentation/platform/docker-re_doc/UGS-QUEUE-OPERATOR-ENV.md).
# - Processing stale uses GREATEST(global default, category override, estimated_time * multiplier).
# - Stale marking SQL must stay consistent with GenerationRequest/GenerationQueue schema.
# - ``count_stale_candidates`` is read-only preview for operator snapshots (same WHERE as cleanup).
# - Module-level ``_list_stale_cleanup_last_monotonic`` throttles hot-path list cleanup.
# Related:
# - api/services/ugs/queue_manager_service.py (QueueManagerService inherits this mixin)
# - api/services/ugs/ugs_stale_horizons.py (UGS_STALE_* → timedelta)
# - api/tasks/ugs_stale_request_reaper.py
# - documentation/platform/docker-re_doc/UGS-QUEUE-OPERATOR-ENV.md
# ---
"""UGS queue stale reconciliation (mixin for QueueManagerService)."""

from __future__ import annotations

import logging
import time
from datetime import datetime

from sqlalchemy import delete, select, text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.models.database_models import GenerationQueue, GenerationRequest
from api.services.queue_features import utcnow_naive
from api.services.ugs.ugs_stale_horizons import (
    PROCESSING_STALE_WHERE_SQL,
    processing_stale_interval_params,
    stale_pending_in_queue_after,
    stale_pending_orphan_after,
    ugs_list_stale_cleanup_interval_seconds,
)

logger = logging.getLogger(__name__)

_list_stale_cleanup_last_monotonic: float = 0.0


class QueueStaleReconciliationMixin:
    """
    Stale queue entry cleanup and abandoned request marking for UGS.

    Expects ``self.db: AsyncSession`` on the concrete service.
    """

    db: AsyncSession

    async def cleanup_stale_entries(self) -> int:
        """
        Remove queue entries that no longer represent live queue work.

        Stale entries are rows still present in `generation_queue` while their
        linked request is already deleted or in a terminal status.
        """
        stale_request_ids_stmt = (
            select(GenerationQueue.request_id)
            .join(GenerationRequest)
            .where(
                (GenerationRequest.deleted_at.is_not(None))
                | (GenerationRequest.status.in_(["completed", "failed", "cancelled"]))
            )
        )
        stale_result = await self.db.execute(stale_request_ids_stmt)
        stale_request_ids = [row[0] for row in stale_result]
        if not stale_request_ids:
            return 0

        await self.db.execute(delete(GenerationQueue).where(GenerationQueue.request_id.in_(stale_request_ids)))
        await self.db.commit()
        logger.info("Cleaned up %s stale queue entrie(s)", len(stale_request_ids))
        return len(stale_request_ids)

    async def cleanup_stale_request_states(self) -> int:
        """
        Mark abandoned pending/processing requests as failed.

        This protects the UGS UI from showing permanently active requests when
        the queue row disappeared or a worker/runtime never finalized the job.
        """
        await self.cleanup_stale_entries()
        now = utcnow_naive()

        orphan_after = stale_pending_orphan_after()
        in_queue_after = stale_pending_in_queue_after()

        updated_requests = 0
        updated_requests += await self._mark_stale_requests_failed(
            condition_sql="""
                status = 'pending'
                AND NOT EXISTS (
                    SELECT 1
                    FROM generation_queue gq
                    WHERE gq.request_id = generation_requests.id
                    AND gq.status IN ('pending', 'processing')
                )
                AND COALESCE(NULLIF(request_metadata->>'queued_at', '')::timestamp, created_at) <= :cutoff
            """,
            cleanup_reason="stale_pending_orphaned",
            cutoff=now - orphan_after,
            now=now,
        )
        updated_requests += await self._mark_stale_requests_failed(
            condition_sql="""
                status = 'pending'
                AND EXISTS (
                    SELECT 1
                    FROM generation_queue gq
                    WHERE gq.request_id = generation_requests.id
                    AND gq.status IN ('pending', 'processing')
                )
                AND COALESCE(NULLIF(request_metadata->>'queued_at', '')::timestamp, created_at) <= :cutoff
            """,
            cleanup_reason="stale_pending_queue_timeout",
            cutoff=now - in_queue_after,
            now=now,
        )
        updated_requests += await self._mark_stale_processing_requests(now=now)

        if updated_requests:
            await self.db.commit()
            await self.cleanup_stale_entries()
            logger.warning(
                "Marked %s stale generation request(s) as failed",
                updated_requests,
            )

        return updated_requests

    async def maybe_cleanup_stale_request_states(self, *, force: bool = False) -> int:
        """
        Throttled wrapper for hot list endpoints (GET /tasks, tray).

        When interval is 0, always runs full cleanup (tests / explicit force).
        """
        global _list_stale_cleanup_last_monotonic  # noqa: PLW0603

        interval_sec = ugs_list_stale_cleanup_interval_seconds()
        if not force and interval_sec > 0:
            now = time.monotonic()
            if (now - _list_stale_cleanup_last_monotonic) < interval_sec:
                return 0
            _list_stale_cleanup_last_monotonic = now
        return await self.cleanup_stale_request_states()

    async def count_stale_candidates(self) -> dict[str, int]:
        """
        Count generation_requests that would be marked failed by ``cleanup_stale_request_states``.

        Read-only preview for operator snapshots; does not mutate rows.
        """
        now = utcnow_naive()
        orphan_after = stale_pending_orphan_after()
        in_queue_after = stale_pending_in_queue_after()

        return {
            "stale_pending_orphaned": await self._count_stale_candidates(
                condition_sql="""
                status = 'pending'
                AND NOT EXISTS (
                    SELECT 1
                    FROM generation_queue gq
                    WHERE gq.request_id = generation_requests.id
                    AND gq.status IN ('pending', 'processing')
                )
                AND COALESCE(NULLIF(request_metadata->>'queued_at', '')::timestamp, created_at) <= :cutoff
            """,
                cutoff=now - orphan_after,
            ),
            "stale_pending_queue_timeout": await self._count_stale_candidates(
                condition_sql="""
                status = 'pending'
                AND EXISTS (
                    SELECT 1
                    FROM generation_queue gq
                    WHERE gq.request_id = generation_requests.id
                    AND gq.status IN ('pending', 'processing')
                )
                AND COALESCE(NULLIF(request_metadata->>'queued_at', '')::timestamp, created_at) <= :cutoff
            """,
                cutoff=now - in_queue_after,
            ),
            "stale_processing_timeout": await self._count_stale_processing_candidates(now=now),
        }

    async def _count_stale_processing_candidates(self, *, now: datetime) -> int:
        stmt = text(
            f"""
            SELECT COUNT(*)::int
            FROM generation_requests gr
            JOIN generation_types gt ON gt.id = gr.type_id
            WHERE {PROCESSING_STALE_WHERE_SQL}
            """
        )
        params = {"now": now, **processing_stale_interval_params()}
        result = await self.db.execute(stmt, params)
        return int(result.scalar() or 0)

    async def _mark_stale_processing_requests(self, *, now: datetime) -> int:
        error_message = "Запрос был автоматически завершён как зависший. Повторите генерацию из UGS Hub."
        stmt = text(
            f"""
            UPDATE generation_requests gr
            SET status = 'failed',
                completed_at = :now,
                updated_at = :now,
                error_message = COALESCE(gr.error_message, :error_message),
                request_metadata = COALESCE(gr.request_metadata, '{{}}'::jsonb) || jsonb_build_object(
                    'queue_status', 'failed',
                    'stage', 'failed',
                    'progress', 100,
                    'progress_message', CAST(:error_message AS text),
                    'error_type', 'stale_request_timeout',
                    'stale_cleanup_reason', 'stale_processing_timeout',
                    'stale_cleanup_at', CAST(:now_iso AS text),
                    'last_heartbeat_at', CAST(:now_iso AS text),
                    'processing_completed_at', CAST(:now_iso AS text)
                )
            FROM generation_types gt
            WHERE gr.type_id = gt.id
            AND {PROCESSING_STALE_WHERE_SQL}
            """
        )
        params = {
            "now": now,
            "now_iso": now.isoformat(),
            "error_message": error_message,
            **processing_stale_interval_params(),
        }
        result = await self.db.execute(stmt, params)
        return int(getattr(result, "rowcount", None) or 0)

    async def _count_stale_candidates(self, *, condition_sql: str, cutoff: datetime) -> int:
        stmt = text(
            f"""
            SELECT COUNT(*)::int
            FROM generation_requests
            WHERE deleted_at IS NULL
            AND {condition_sql}
            """
        )
        result = await self.db.execute(stmt, {"cutoff": cutoff})
        return int(result.scalar() or 0)

    async def _mark_stale_requests_failed(
        self,
        *,
        condition_sql: str,
        cleanup_reason: str,
        cutoff: datetime,
        now: datetime,
    ) -> int:
        error_message = "Запрос был автоматически завершён как зависший. Повторите генерацию из UGS Hub."
        stmt = text(
            f"""
            UPDATE generation_requests
            SET status = 'failed',
                completed_at = :now,
                updated_at = :now,
                error_message = COALESCE(error_message, :error_message),
                request_metadata = COALESCE(request_metadata, '{{}}'::jsonb) || jsonb_build_object(
                    'queue_status', 'failed',
                    'stage', 'failed',
                    'progress', 100,
                    'progress_message', CAST(:error_message AS text),
                    'error_type', 'stale_request_timeout',
                    'stale_cleanup_reason', CAST(:cleanup_reason AS text),
                    'stale_cleanup_at', CAST(:now_iso AS text),
                    'last_heartbeat_at', CAST(:now_iso AS text),
                    'processing_completed_at', CAST(:now_iso AS text)
                )
            WHERE deleted_at IS NULL
            AND {condition_sql}
            """
        )
        result = await self.db.execute(
            stmt,
            {
                "cutoff": cutoff,
                "now": now,
                "now_iso": now.isoformat(),
                "cleanup_reason": cleanup_reason,
                "error_message": error_message,
            },
        )
        return int(getattr(result, "rowcount", None) or 0)
