# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/ugs/queue_worker_resilience.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Optional Redis-based single-flight lease for UGS queue workers (avoid duplicate execute on redelivery),
# Postgres advisory-lock fallback on the worker DB session when Redis is down, TTL refresh during long
# provider runs (`touch_ugs_worker_lease`), and best-effort Postgres finalization when a message lands in
# RabbitMQ DLQ after retries are exhausted.
# Invariants:
# - Postgres advisory locks are session-scoped: acquire/release must use the same AsyncSession as the worker.
# - If Redis is unavailable and Postgres lock cannot be taken, duplicate delivery is skipped (held by peer).
# - If both Redis and Postgres lock paths fail unexpectedly, execution is allowed with a warning (last resort).
# - DLQ Postgres update must not raise into the queue consumer; failures are logged only.
# - When the DLQ payload includes `source_queue` (from `queue_worker`), persist it as `queue_worker_source_queue`
#   in `request_metadata` for operator forensics.
# - Optional best-effort credit refund when DLQ finalizes a request that already recorded `credits_used`.
# Related:
# - api/workers/queue_worker.py
# - api/services/ugs/unified_generation_service.py (process_queued_request)
# ---
"""UGS queue worker: processing lease + DLQ alignment with generation_requests."""

from __future__ import annotations

import hashlib
import logging
import os
import secrets
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import select, text  # type: ignore[import-not-found]
from sqlalchemy.orm import selectinload  # type: ignore[import-not-found]

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.database_manager import (
    DatabaseConnectionError,
    get_database_manager,
    get_redis_client,
)

logger = logging.getLogger(__name__)

_LEASE_KEY_PREFIX = "eliteew:ugs:worker_lease:"
_PG_LEASE_TOKEN_PREFIX = "pg:"


def _advisory_lock_keys(request_id: str) -> tuple[int, int]:
    digest = hashlib.sha256(str(request_id).encode("utf-8")).digest()
    k1 = int.from_bytes(digest[0:4], byteorder="big", signed=True)
    k2 = int.from_bytes(digest[4:8], byteorder="big", signed=True)
    return k1, k2


def _parse_pg_lease_token(token: str | None) -> tuple[int, int] | None:
    if not token or not token.startswith(_PG_LEASE_TOKEN_PREFIX):
        return None
    parts = token.split(":", 2)
    if len(parts) != 3:
        return None
    try:
        return int(parts[1]), int(parts[2])
    except ValueError:
        return None


def is_pg_worker_lease_token(token: str | None) -> bool:
    return _parse_pg_lease_token(token) is not None


async def _try_pg_advisory_lock(db: AsyncSession, request_id: str) -> tuple[bool, str | None]:
    k1, k2 = _advisory_lock_keys(request_id)
    result = await db.execute(
        text("SELECT pg_try_advisory_lock(:k1, :k2)"),
        {"k1": k1, "k2": k2},
    )
    acquired = bool(result.scalar())
    if acquired:
        return True, f"{_PG_LEASE_TOKEN_PREFIX}{k1}:{k2}"
    logger.info(
        "UGS worker Postgres advisory lock not acquired (held by another session); skip request_id=%s",
        request_id,
    )
    return False, None


def _lease_ttl_seconds() -> int:
    raw = (os.environ.get("UGS_WORKER_LEASE_SECONDS") or "7200").strip()
    try:
        value = int(raw)
    except ValueError:
        return 7200
    return max(60, min(value, 86_400))


def _lease_touch_interval_seconds() -> int:
    """Minimum seconds between Redis EXPIRE refreshes during provider progress (rate-limit)."""
    raw = (os.environ.get("UGS_WORKER_LEASE_TOUCH_INTERVAL_SEC") or "120").strip()
    try:
        value = int(raw)
    except ValueError:
        return 120
    return max(30, min(value, 3600))


def _lease_key(request_id: str) -> str:
    return f"{_LEASE_KEY_PREFIX}{request_id}"


async def acquire_ugs_worker_lease(
    request_id: str,
    *,
    db: AsyncSession | None = None,
) -> tuple[bool, str | None]:
    """
    Attempt to take an exclusive lease for executing this request in a worker.

    Returns:
        (True, token) when the lease was acquired (caller must release in ``finally``).
        (False, None) when another worker holds the lease — skip execution and ack the message.
        (True, None) last-resort degraded mode when Redis and Postgres lock paths fail unexpectedly.
    """
    token = secrets.token_hex(16)
    try:
        redis = await get_redis_client()
        ok = await redis.set(_lease_key(request_id), token, nx=True, ex=_lease_ttl_seconds())
        if ok:
            return True, token
        logger.info(
            "UGS worker lease not acquired (another worker holds the lease); skip request_id=%s",
            request_id,
        )
        return False, None
    except DatabaseConnectionError as exc:
        logger.warning(
            "UGS worker Redis lease unavailable; trying Postgres advisory lock request_id=%s: %s",
            request_id,
            exc,
        )
        if db is not None:
            try:
                return await _try_pg_advisory_lock(db, request_id)
            except Exception as pg_exc:
                logger.warning(
                    "UGS worker Postgres advisory lock error request_id=%s: %s",
                    request_id,
                    pg_exc,
                )
        else:
            logger.warning(
                "UGS worker Postgres advisory lock skipped (no db session) request_id=%s",
                request_id,
            )
        return True, None
    except Exception as exc:
        logger.warning(
            "UGS worker Redis lease error request_id=%s: %s",
            request_id,
            exc,
        )
        if db is not None:
            try:
                return await _try_pg_advisory_lock(db, request_id)
            except Exception as pg_exc:
                logger.warning(
                    "UGS worker Postgres advisory lock fallback failed request_id=%s: %s",
                    request_id,
                    pg_exc,
                )
        return True, None


async def release_ugs_worker_lease(
    request_id: str,
    token: str | None,
    *,
    db: AsyncSession | None = None,
) -> None:
    """Release lease if we hold token-based lease (noop when degraded mode token is None)."""
    if not token:
        return

    pg_keys = _parse_pg_lease_token(token)
    if pg_keys is not None:
        if db is None:
            logger.debug(
                "UGS worker Postgres advisory unlock skipped (no db session) request_id=%s",
                request_id,
            )
            return
        k1, k2 = pg_keys
        try:
            await db.execute(
                text("SELECT pg_advisory_unlock(:k1, :k2)"),
                {"k1": k1, "k2": k2},
            )
        except Exception as exc:
            logger.debug(
                "UGS worker Postgres advisory unlock failed request_id=%s: %s",
                request_id,
                exc,
            )
        return

    try:
        redis = await get_redis_client()
        key = _lease_key(request_id)
        current = await redis.get(key)
        if current is None:
            return
        cur_s = current.decode("utf-8", errors="replace") if isinstance(current, bytes) else str(current)
        if cur_s == token:
            await redis.delete(key)
    except Exception as exc:
        logger.debug("UGS worker lease release best-effort failed request_id=%s: %s", request_id, exc)


async def touch_ugs_worker_lease(request_id: str, token: str | None) -> None:
    """
    Refresh Redis TTL for an active worker lease (long-running generations).

    Verifies token before extending to avoid refreshing someone else's key.
    """
    if not token or is_pg_worker_lease_token(token):
        return
    try:
        redis = await get_redis_client()
        key = _lease_key(request_id)
        current = await redis.get(key)
        if current is None:
            return
        cur_s = current.decode("utf-8", errors="replace") if isinstance(current, bytes) else str(current)
        if cur_s != token:
            return
        await redis.expire(key, _lease_ttl_seconds())
    except Exception as exc:
        logger.debug("UGS worker lease touch failed request_id=%s: %s", request_id, exc)


def get_ugs_worker_lease_touch_interval_seconds() -> int:
    """Throttle for progress callbacks refreshing the Redis worker lease."""
    return _lease_touch_interval_seconds()


async def maybe_mark_ugs_request_failed_from_dlq(payload: dict[str, Any]) -> None:
    """
    After a UGS task is dead-lettered, mark the generation_requests row failed if still non-terminal.

    Never raises (queue worker must ack the original message).
    """
    if str(payload.get("task_type") or "") != "ugs_generation":
        return
    raw_id = payload.get("request_id")
    if not raw_id:
        return
    request_id = str(raw_id).strip()
    try:
        UUID(request_id)
    except ValueError:
        logger.warning("DLQ UGS payload has invalid request_id=%s", request_id)
        return

    attempts = int(payload.get("failed_attempts") or payload.get("attempt") or 0)
    last_err = str(payload.get("last_error") or "queue_worker_dlq")
    if len(last_err) > 4096:
        last_err = last_err[:4096]

    raw_source_q = payload.get("source_queue")
    source_queue_meta: str | None = None
    if raw_source_q is not None:
        sq = str(raw_source_q).strip()
        if sq:
            source_queue_meta = sq[:256]

    try:
        from api.models.database_models import GenerationRequest
        from api.services.ugs.billing_service import BillingService
        from api.services.ugs.metrics_service import UGSMetricsService
        from api.services.ugs.queue_manager_service import QueueManagerService

        manager = await get_database_manager()
        async with manager.get_postgres_session() as db:
            stmt = (
                select(GenerationRequest)
                .options(selectinload(GenerationRequest.generation_type))
                .where(GenerationRequest.id == UUID(request_id))
            )
            result = await db.execute(stmt)
            request = result.scalar_one_or_none()
            if request is None:
                logger.warning("DLQ UGS: generation_requests row missing for request_id=%s", request_id)
                return

            normalized = (str(request.status) if request.status is not None else "").lower().strip()
            if normalized in {"completed", "failed", "cancelled"}:
                logger.debug(
                    "DLQ UGS: request_id=%s already terminal status=%s; skip DB update",
                    request_id,
                    normalized,
                )
                return

            now = datetime.now(UTC).replace(tzinfo=None)
            request.status = "failed"  # type: ignore[assignment]
            request.error_message = last_err  # type: ignore[assignment]
            request.completed_at = now  # type: ignore[assignment]
            request.updated_at = now  # type: ignore[assignment]

            prev_meta = request.request_metadata if isinstance(request.request_metadata, dict) else {}
            merged_meta: dict[str, Any] = {
                **prev_meta,
                "queue_worker_dlq": True,
                "queue_worker_failed_attempts": attempts,
                "queue_worker_dlq_at": now.isoformat(),
                "queue_last_error": last_err[:2000],
            }
            if source_queue_meta:
                merged_meta["queue_worker_source_queue"] = source_queue_meta
            request.request_metadata = merged_meta  # type: ignore[assignment]

            refund_credits_amount: int | None = None
            user_id_for_refund = str(request.user_id) if request.user_id is not None else ""
            generation_type_for_refund = request.generation_type
            try:
                raw_credits = request.credits_used
                if raw_credits is not None and float(raw_credits) > 0:
                    refund_credits_amount = max(0, int(round(float(raw_credits))))
            except (AttributeError, TypeError, ValueError):  # fmt: skip
                refund_credits_amount = None

            await db.commit()

            try:
                qm = QueueManagerService(db)
                await qm.update_queue_status(request_id, "failed")
            except Exception as queue_err:
                logger.warning("DLQ UGS: queue status update failed request_id=%s: %s", request_id, queue_err)

            try:
                metrics = UGSMetricsService(db)
                await metrics.record_generation_complete(
                    request_id,
                    success=False,
                    duration_ms=0,
                    error_message=last_err,
                    error_type="queue_worker_dlq",
                )
            except Exception as metrics_err:
                logger.debug("DLQ UGS: metrics skip request_id=%s: %s", request_id, metrics_err)

            if (
                refund_credits_amount
                and refund_credits_amount > 0
                and user_id_for_refund
                and generation_type_for_refund is not None
                and os.environ.get("UGS_DLQ_REFUND_CREDITS", "1").strip().lower() not in {"0", "false", "no"}
            ):
                try:
                    billing = BillingService(db)
                    await billing.refund_credits(
                        user_id_for_refund,
                        generation_type_for_refund,
                        credit_amount=refund_credits_amount,
                    )
                    logger.info(
                        "DLQ UGS: refunded %s credits for request_id=%s after queue failure",
                        refund_credits_amount,
                        request_id,
                    )
                except Exception as refund_err:
                    logger.warning(
                        "DLQ UGS: credit refund failed request_id=%s: %s",
                        request_id,
                        refund_err,
                    )

        logger.info(
            "DLQ UGS: marked generation_requests failed request_id=%s attempts=%s",
            request_id,
            attempts,
        )
    except Exception as exc:
        logger.exception("DLQ UGS: failed to mark request_id=%s in Postgres: %s", request_id, exc)
