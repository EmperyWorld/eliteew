#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Generation queue management for UGS: enqueue rows, prioritization, and queue metrics.
# Stale request reconciliation lives in QueueStaleReconciliationMixin.
# Invariants:
# - Public import path remains ``from api.services.ugs.queue_manager_service import QueueManagerService``.
# - Stale SQL semantics are owned by queue_stale_reconciliation (do not fork WHERE clauses here).
# Related:
# - api/services/ugs/queue_stale_reconciliation.py (QueueStaleReconciliationMixin)
# - api/services/ugs/ugs_stale_horizons.py (UGS_STALE_* → timedelta)
# - api/tasks/ugs_stale_request_reaper.py
# - documentation/platform/docker-re_doc/UGS-QUEUE-OPERATOR-ENV.md
# ---
"""UGS queue manager (Postgres generation_queue + stale reconciliation mixin)."""

from __future__ import annotations

import logging
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, delete, desc, func, select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.models.database_models import GenerationQueue, GenerationRequest
from api.monitoring.metrics import update_ugs_queue_alarm_states, update_ugs_queue_metrics
from api.services.queue_features import utcnow_naive
from api.services.ugs.queue_stale_reconciliation import QueueStaleReconciliationMixin

logger = logging.getLogger(__name__)


class QueueManagerService(QueueStaleReconciliationMixin):
    """
    🔥 SERVICE FOR GENERATION QUEUE MANAGEMENT 🔥
    Manages generation queue with prioritization and resource control
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def add_to_queue(self, request_id: str, priority: int = 5) -> GenerationQueue:
        """
        Add request to generation queue

        Args:
            request_id: Generation request ID
            priority: Priority (1-10, higher = more priority)

        Returns:
            GenerationQueue: Created queue entry
        """
        # Check that request exists
        stmt = select(GenerationRequest).where(GenerationRequest.id == request_id)
        result = await self.db.execute(stmt)
        request = result.scalar_one_or_none()
        if not request:
            msg = f"Generation request {request_id} not found"
            raise ValueError(msg)

        # Determine queue type based on priority
        queue_name = self._get_queue_name(priority)

        # Calculate estimated start time
        estimated_start_time = await self._calculate_estimated_start_time(priority)

        # Create queue entry
        queue_entry = GenerationQueue(
            request_id=request_id,
            priority=priority,
            queue_name=queue_name,
            estimated_start_time=estimated_start_time,
            resource_requirements=self._get_resource_requirements(request.generation_type),
            dependencies=self._get_dependencies(request),
            status="pending",
        )

        self.db.add(queue_entry)
        await self.db.commit()
        await self.db.refresh(queue_entry)

        logger.info(
            "Added request %s to queue '%s' with priority %s",
            request_id,
            queue_name,
            priority,
        )
        return queue_entry

    async def get_next_requests(self, limit: int = 10) -> list[GenerationRequest]:
        """
        Get next requests for processing

        Args:
            limit: Maximum number of requests

        Returns:
            list[GenerationRequest]: Requests ready for processing
        """
        # Lock generation_queue rows first (SKIP LOCKED for parallel workers), then lock
        # generation_requests in primary-key order to reduce deadlocks vs other updaters.
        stmt = (
            select(GenerationQueue)
            .join(GenerationRequest)
            .where(
                and_(
                    GenerationRequest.status == "pending",
                    GenerationQueue.status == "pending",  # Additional queue status check
                    GenerationQueue.estimated_start_time <= utcnow_naive(),
                )
            )
            .order_by(desc(GenerationQueue.priority), GenerationQueue.created_at)
            .limit(limit)
            .with_for_update(of=[GenerationQueue], skip_locked=True)
        )

        result = await self.db.execute(stmt)
        queue_entries = list(result.scalars().all())
        request_ids = [e.request_id for e in queue_entries]
        requests_by_id: dict[Any, GenerationRequest] = {}
        if request_ids:
            req_result = await self.db.execute(
                select(GenerationRequest)
                .where(GenerationRequest.id.in_(request_ids))
                .order_by(GenerationRequest.id)
                .with_for_update()
            )
            requests_by_id = {r.id: r for r in req_result.scalars().all()}

        ready_requests = []
        # 🔥 CRITICAL: Use naive datetime for TIMESTAMP WITHOUT TIME ZONE columns
        now = utcnow_naive()

        for entry in queue_entries:
            # Double status check to prevent race condition
            # type: ignore[comparison-overlap] - In runtime, entry.status is str, not Column
            if entry.status != "pending":  # type: ignore[comparison-overlap]
                continue

            entry.status = "processing"  # type: ignore[assignment]
            entry.updated_at = now  # type: ignore[assignment]

            req = requests_by_id.get(entry.request_id)
            if req and req.status == "pending":
                req.status = "processing"  # type: ignore[assignment]
                if req.started_at is None:
                    req.started_at = now  # type: ignore[assignment]
                ready_requests.append(req)
            else:
                # If request already processed, skip
                entry.status = "pending"  # type: ignore[assignment]  # Rollback change
                continue

        if queue_entries:
            await self.db.commit()

        return ready_requests

    async def update_queue_status(self, request_id: str, status: str) -> bool:
        """
        Update request status in queue

        Args:
            request_id: Request ID
            status: New status

        Returns:
            bool: True if successfully updated
        """
        stmt = select(GenerationQueue).where(GenerationQueue.request_id == request_id).with_for_update()
        result = await self.db.execute(stmt)
        queue_entry = result.scalar_one_or_none()

        if not queue_entry:
            return False

        # Update time
        queue_entry.status = status  # type: ignore[assignment]
        # Convert UTC datetime to naive datetime for TIMESTAMP WITHOUT TIME ZONE
        queue_entry.updated_at = utcnow_naive()  # type: ignore[assignment]

        # If status is terminal - remove from queue
        if status in ["completed", "failed", "cancelled"]:
            await self.db.delete(queue_entry)
            await self.db.flush()  # Reset changes before commit
        await self.db.commit()
        return True

    async def get_queue_stats(self) -> dict[str, Any]:
        """
        Get queue statistics

        Returns:
            dict[str, Any]: Statistics dictionary
        """
        await self.cleanup_stale_entries()

        # Total count currently waiting in queue
        stmt = (
            select(func.count())
            .select_from(GenerationQueue)
            .join(GenerationRequest)
            .where(
                and_(
                    GenerationQueue.status == "pending",
                    GenerationRequest.status == "pending",
                    GenerationRequest.deleted_at.is_(None),
                )
            )
        )
        result = await self.db.execute(stmt)
        total_queued = result.scalar() or 0

        # By priorities
        priority_stats = {}
        for priority in range(1, 11):
            stmt = (
                select(func.count())
                .select_from(GenerationQueue)
                .join(GenerationRequest)
                .where(
                    and_(
                        GenerationQueue.priority == priority,
                        GenerationQueue.status == "pending",
                        GenerationRequest.status == "pending",
                        GenerationRequest.deleted_at.is_(None),
                    )
                )
            )
            result = await self.db.execute(stmt)
            count = result.scalar() or 0
            if count > 0:
                priority_stats[priority] = count

        # By queue types
        queue_type_stats = {}
        queue_types = ["high_priority", "normal", "batch"]
        for qtype in queue_types:
            stmt = (
                select(func.count())
                .select_from(GenerationQueue)
                .join(GenerationRequest)
                .where(
                    and_(
                        GenerationQueue.queue_name == qtype,
                        GenerationQueue.status == "pending",
                        GenerationRequest.status == "pending",
                        GenerationRequest.deleted_at.is_(None),
                    )
                )
            )
            result = await self.db.execute(stmt)
            count = result.scalar() or 0
            queue_type_stats[qtype] = count

        # Pending processing
        stmt = (
            select(func.count())
            .select_from(GenerationQueue)
            .join(GenerationRequest)
            .where(
                and_(
                    GenerationQueue.status == "pending",
                    GenerationRequest.status == "pending",
                    GenerationRequest.deleted_at.is_(None),
                )
            )
        )
        result = await self.db.execute(stmt)
        pending_count = result.scalar() or 0

        processing_stmt = (
            select(func.count())
            .select_from(GenerationQueue)
            .join(GenerationRequest)
            .where(
                and_(
                    GenerationQueue.status == "processing",
                    GenerationRequest.status == "processing",
                    GenerationRequest.deleted_at.is_(None),
                )
            )
        )
        processing_result = await self.db.execute(processing_stmt)
        processing_count = processing_result.scalar() or 0

        oldest_stmt = (
            select(func.min(GenerationQueue.created_at))
            .select_from(GenerationQueue)
            .join(GenerationRequest)
            .where(
                and_(
                    GenerationQueue.status == "pending",
                    GenerationRequest.status == "pending",
                    GenerationRequest.deleted_at.is_(None),
                )
            )
        )
        oldest_result = await self.db.execute(oldest_stmt)
        oldest_created = oldest_result.scalar()
        pending_oldest_age_seconds: float | None = None
        if oldest_created is not None:
            pending_oldest_age_seconds = max(
                0.0,
                (utcnow_naive() - oldest_created).total_seconds(),
            )

        stats = {
            "total_queued": total_queued,
            "pending_processing": pending_count,
            "processing": processing_count,
            "priority_distribution": priority_stats,
            "queue_type_distribution": queue_type_stats,
            "pending_oldest_age_seconds": pending_oldest_age_seconds,
            "timestamp": datetime.now(UTC).isoformat(),
        }

        total_val: Any = stats.get("total_queued", 0)
        pending_val: Any = stats.get("pending_processing", 0)
        processing_val: Any = stats.get("processing")
        priority_val: Any = stats.get("priority_distribution")
        queue_val: Any = stats.get("queue_type_distribution")

        update_ugs_queue_metrics(
            total=int(total_val) if total_val is not None else 0,
            pending=int(pending_val) if pending_val is not None else 0,
            processing=int(processing_val) if processing_val is not None else None,
            per_priority=dict(priority_val) if priority_val is not None and isinstance(priority_val, dict) else None,
            per_queue=dict(queue_val) if queue_val is not None and isinstance(queue_val, dict) else None,
            pending_oldest_age_seconds=pending_oldest_age_seconds,
        )
        update_ugs_queue_alarm_states(
            total_queued=int(total_val) if total_val is not None else 0,
            pending_oldest_age_seconds=pending_oldest_age_seconds,
        )

        return stats

    async def remove_from_queue(self, request_id: str) -> bool:
        """Remove individual request from queue."""

        removed = await self.remove_many_from_queue([request_id])
        if removed:
            logger.info("Removed request %s from queue", request_id)
            return True

        logger.debug("No queue entry found for request %s", request_id)
        return False

    async def remove_many_from_queue(self, request_ids: Iterable[str]) -> int:
        """Remove multiple requests from queue with single query."""

        request_ids = [str(request_id) for request_id in request_ids if request_id]
        if not request_ids:
            return 0

        stmt = select(GenerationQueue.request_id).where(GenerationQueue.request_id.in_(request_ids))
        result = await self.db.execute(stmt)
        present_ids = [row[0] for row in result]

        if not present_ids:
            return 0

        await self.db.execute(delete(GenerationQueue).where(GenerationQueue.request_id.in_(present_ids)))
        await self.db.commit()

        logger.info(
            "Removed %s request(s) from queue: %s",
            len(present_ids),
            ", ".join(map(str, present_ids)),
        )
        return len(present_ids)

    async def count_waiting_requests(self) -> int:
        """Count only live requests still waiting in the queue."""
        await self.cleanup_stale_request_states()
        stmt = (
            select(func.count())
            .select_from(GenerationQueue)
            .join(GenerationRequest)
            .where(
                and_(
                    GenerationQueue.status == "pending",
                    GenerationRequest.status == "pending",
                    GenerationRequest.deleted_at.is_(None),
                )
            )
        )
        result = await self.db.execute(stmt)
        return int(result.scalar() or 0)

    async def reprioritize_request(self, request_id: str, new_priority: int) -> bool:
        """
        Change request priority

        Args:
            request_id: Request ID
            new_priority: New priority (1-10)

        Returns:
            bool: True if successfully changed
        """
        min_priority = 1
        max_priority = 10
        if not min_priority <= new_priority <= max_priority:
            msg = "Priority must be between 1 and 10"
            raise ValueError(msg)

        stmt = select(GenerationQueue).where(GenerationQueue.request_id == request_id)
        result = await self.db.execute(stmt)
        queue_entry = result.scalar_one_or_none()

        if not queue_entry:
            return False

        old_priority = queue_entry.priority
        queue_entry.priority = new_priority  # type: ignore[assignment]
        queue_entry.queue_name = self._get_queue_name(new_priority)  # type: ignore[assignment]
        queue_entry.estimated_start_time = await self._calculate_estimated_start_time(new_priority)  # type: ignore[assignment]
        # Convert UTC datetime to naive datetime for TIMESTAMP WITHOUT TIME ZONE
        queue_entry.updated_at = utcnow_naive()  # type: ignore[assignment]

        await self.db.commit()

        logger.info(
            "Changed priority for request %s: %s -> %s",
            request_id,
            old_priority,
            new_priority,
        )
        return True

    # ===== PRIVATE METHODS =====

    def _get_queue_name(self, priority: int) -> str:
        """Determine queue type by priority"""
        high_priority_threshold = 8
        normal_priority_threshold = 4
        if priority >= high_priority_threshold:
            return "high_priority"
        if priority >= normal_priority_threshold:
            return "normal"
        return "batch"

    async def _calculate_estimated_start_time(self, priority: int) -> datetime:
        """
        Calculate estimated start time based on priority and load
        """
        base_delay = {
            10: timedelta(minutes=1),  # high_priority
            5: timedelta(minutes=5),  # normal
            1: timedelta(hours=1),  # batch
        }.get(priority, timedelta(minutes=10))

        # Add delay based on current load
        load_factor = await self._get_current_load_factor()
        adjusted_delay = base_delay * load_factor

        return utcnow_naive() + adjusted_delay

    async def _get_current_load_factor(self) -> float:
        """
        Get load factor (1.0 = normal load)
        """
        # Simple logic: more in queue = higher factor
        stmt = select(func.count()).select_from(GenerationQueue)
        result = await self.db.execute(stmt)
        total_queued = result.scalar() or 0

        low_load_threshold = 10
        medium_load_threshold = 50
        high_load_threshold = 100
        if total_queued < low_load_threshold:
            return 1.0
        if total_queued < medium_load_threshold:
            return 1.5
        if total_queued < high_load_threshold:
            return 2.0
        return 3.0

    def _get_resource_requirements(self, generation_type: Any) -> dict[str, Any]:  # noqa: ANN401
        """
        Get resource requirements for generation type
        """
        # Base requirements by content type
        base_requirements = {
            "text": {"cpu": 1, "memory_gb": 2, "gpu": False},
            "image": {"cpu": 2, "memory_gb": 4, "gpu": True},
            "audio": {"cpu": 2, "memory_gb": 4, "gpu": False},
            "video": {"cpu": 4, "memory_gb": 8, "gpu": True},
            "document": {"cpu": 1, "memory_gb": 2, "gpu": False},
            "composite": {"cpu": 4, "memory_gb": 8, "gpu": True},
        }

        requirements = base_requirements.get(generation_type.category, base_requirements["text"])

        # Consider complexity
        complexity_multiplier = {"low": 1.0, "medium": 1.5, "high": 2.0}.get(generation_type.complexity, 1.0)

        requirements["cpu"] = int(requirements["cpu"] * complexity_multiplier)
        requirements["memory_gb"] = int(requirements["memory_gb"] * complexity_multiplier)

        return requirements

    def _get_dependencies(self, request: Any) -> dict[str, Any]:  # noqa: ANN401
        """
        Get dependencies for request
        """
        # For simplicity return empty dependencies
        # In future can add logic for composite generations
        _ = request  # Unused argument - reserved for future use
        return {}
