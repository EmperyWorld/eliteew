# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Queue-worker alignment for EWRP jobs: mark `ewrp_jobs` failed and refund credits when the pipeline
# never completes (handler crash, exhausted RabbitMQ retries / DLQ).
# Invariants:
# - Helpers never raise into the queue consumer; failures are logged only.
# - Refund runs only for non-terminal jobs without a completed PDF (`status != completed`).
# Related:
# - api/routers/ewrp.py (`_run_ewrp_pipeline`)
# - api/workers/queue_worker.py
# - documentation/worklog/session-summaries/2026-05-24-1200-ewrp-pipeline-141-investigation.md
# ---

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select, update  # type: ignore[import-not-found]

from api.core.database_manager import get_database_manager
from api.models.database_models import GenerationType
from api.models.ewrp import EwrpJob
from api.services.ewrp_billing import (
    EWRP_BILLING_TYPE_KEY,
    ewrp_presentation_credit_cost,
)
from api.services.ewrp_queue_utils import truncate_ewrp_queue_error_message
from api.services.ugs.billing_service import BillingService

logger = logging.getLogger(__name__)

_TERMINAL_STATUSES = frozenset({"completed", "failed"})


async def finalize_ewrp_job_queue_failure(
    job_id_str: str,
    user_id_str: str,
    error_message: str,
    *,
    refund: bool = True,
) -> None:
    """
    Mark an EWRP job failed and optionally refund the create charge.

    Safe to call from queue handlers and DLQ forensics; never raises.
    """
    err_msg = truncate_ewrp_queue_error_message(error_message)
    try:
        job_uuid = UUID(job_id_str)
    except ValueError:
        logger.warning("EWRP queue finalize: invalid job_id=%s", job_id_str)
        return

    try:
        manager = await get_database_manager()
        async with manager.get_postgres_session() as db:
            stmt = select(EwrpJob).where(EwrpJob.id == job_uuid)
            result = await db.execute(stmt)
            job = result.scalar_one_or_none()
            if job is None:
                logger.warning("EWRP queue finalize: job missing job_id=%s", job_id_str)
                return

            status_norm = (job.status or "").lower().strip()
            if status_norm in _TERMINAL_STATUSES:
                logger.debug(
                    "EWRP queue finalize: job already terminal status=%s job_id=%s",
                    status_norm,
                    job_id_str,
                )
                return

            await db.execute(
                update(EwrpJob).where(EwrpJob.id == job_uuid).values(status="failed", progress=0, error_message=err_msg)
            )
            await db.commit()

            if not refund or status_norm == "completed":
                return

            gt_stmt = select(GenerationType).where(
                GenerationType.type_key == EWRP_BILLING_TYPE_KEY,
                GenerationType.is_active.is_(True),
            )
            gt_result = await db.execute(gt_stmt)
            gen_type = gt_result.scalar_one_or_none()
            if not gen_type:
                logger.error(
                    "EWRP queue finalize: generation type %s missing, cannot refund job %s",
                    EWRP_BILLING_TYPE_KEY,
                    job_id_str,
                )
                return

            num = int(job.num_slides or 0)
            _per, credit_cost = ewrp_presentation_credit_cost(num, gen_type)
            if credit_cost <= 0:
                return

            billing = BillingService(db)
            ok = await billing.refund_credits(user_id_str, gen_type, credit_amount=credit_cost)
            if not ok:
                logger.error(
                    "EWRP queue finalize: refund failed user=%s job=%s",
                    user_id_str,
                    job_id_str,
                )
            else:
                logger.info(
                    "EWRP queue finalize: refunded %s credits user=%s job=%s",
                    credit_cost,
                    user_id_str,
                    job_id_str,
                )
    except Exception as exc:
        logger.exception(
            "EWRP queue finalize failed job_id=%s user_id=%s: %s",
            job_id_str,
            user_id_str,
            exc,
        )


async def maybe_mark_ewrp_job_failed_from_dlq(payload: dict[str, Any]) -> None:
    """
    After an EWRP task is dead-lettered, mark the job failed if still non-terminal.

    Never raises (queue worker must ack the original message).
    """
    if str(payload.get("task_type") or "") != "ewrp_generate":
        return

    job_id = str(payload.get("job_id") or "").strip()
    user_id = str(payload.get("user_id") or "").strip()
    if not job_id or not user_id:
        logger.warning("DLQ EWRP payload missing job_id or user_id")
        return

    try:
        UUID(job_id)
        UUID(user_id)
    except ValueError:
        logger.warning("DLQ EWRP payload has invalid job_id=%s or user_id=%s", job_id, user_id)
        return

    attempts = int(payload.get("failed_attempts") or payload.get("attempt") or 0)
    last_err = str(payload.get("last_error") or "queue_worker_dlq")
    if len(last_err) > 4096:
        last_err = last_err[:4096]

    source_queue = str(payload.get("source_queue") or "").strip()
    if source_queue:
        last_err = f"{last_err} (source_queue={source_queue[:256]})"

    await finalize_ewrp_job_queue_failure(
        job_id,
        user_id,
        last_err,
        refund=True,
    )
    logger.info(
        "DLQ EWRP: finalized job failed job_id=%s attempts=%s",
        job_id,
        attempts,
    )
