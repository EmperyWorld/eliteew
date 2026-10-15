# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User-scoped Professional Worlds quota summary: PW credits usage and playbook cost hints.
# Invariants:
# - Credits sums are user-scoped; idempotency keys dedupe billed UGS rows in 24h window.
# - Playbook estimates are hint-only via playbook_service.estimate_playbook_execution_cost.
# Related:
# - api/routers/professional_worlds_realtor_crm.py
# - api/services/professional_worlds/playbook_service.py
# ---

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.playbook_service import ProfessionalWorldsPlaybookService
from api.services.professional_worlds.service import REALTOR_VERTICAL_SLUG

logger = logging.getLogger(__name__)

_PW_TYPE_PREFIX = "professional_worlds%"


async def load_user_credit_balance(db: AsyncSession, user_id: UUID) -> float | None:
    """Return current UGS credit balance for the user when available."""
    result = await db.execute(
        text(
            """
            SELECT credits
            FROM users
            WHERE id = :user_id
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    )
    row = result.mappings().one_or_none()
    if row is None:
        return None
    raw = row.get("credits")
    try:
        if raw is None:
            return None
        return float(raw)
    except TypeError, ValueError:
        return None


async def load_user_pw_credits_used_24h(db: AsyncSession, user_id: UUID) -> float:
    """Sum PW-related UGS credits for the user in the last 24 hours (deduped by idempotency_key)."""
    result = await db.execute(
        text(
            """
            SELECT COALESCE(
                SUM(charged.credits_used),
                0
            ) AS credits_used_24h
            FROM (
                SELECT DISTINCT ON (COALESCE(gr.request_metadata->>'idempotency_key', gr.id::text))
                    gr.credits_used
                FROM generation_requests gr
                INNER JOIN generation_types gt ON gt.id = gr.type_id
                WHERE gr.user_id = :user_id
                  AND gr.created_at >= now() - interval '24 hours'
                  AND gr.status IN ('success', 'completed')
                  AND (
                      gt.type_key LIKE :pw_prefix
                      OR EXISTS (
                          SELECT 1 FROM professional_artifacts pa
                          WHERE pa.ugs_request_id = gr.id AND pa.user_id = :user_id
                      )
                      OR EXISTS (
                          SELECT 1 FROM realtor_media_enhancement_jobs mj
                          WHERE mj.ugs_request_id = gr.id AND mj.user_id = :user_id
                      )
                  )
                ORDER BY COALESCE(gr.request_metadata->>'idempotency_key', gr.id::text), gr.created_at DESC
            ) charged
            """
        ),
        {"user_id": user_id, "pw_prefix": _PW_TYPE_PREFIX},
    )
    row = dict(result.mappings().one())
    return float(row.get("credits_used_24h") or 0)


async def build_playbook_estimate_helpers(
    db: AsyncSession,
    *,
    vertical_slug: str = REALTOR_VERTICAL_SLUG,
) -> list[dict[str, Any]]:
    """Attach hint-only cost estimates to each active playbook for a vertical."""
    pb_result = await db.execute(
        text(
            """
            SELECT playbook_key, display_name
            FROM professional_ai_playbooks
            WHERE vertical_slug = :vertical_slug AND is_active = true
            ORDER BY sort_order, playbook_key
            """
        ),
        {"vertical_slug": vertical_slug},
    )
    playbook_svc = ProfessionalWorldsPlaybookService(db)  # type: ignore[arg-type]
    out: list[dict[str, Any]] = []
    for row in pb_result.mappings().all():
        playbook_key = str(row["playbook_key"])
        estimate = await playbook_svc.estimate_playbook_execution_cost(vertical_slug, playbook_key)
        if estimate is None:
            out.append(
                {
                    "playbook_key": playbook_key,
                    "display_name": row.get("display_name"),
                    "total_estimated_units": 0.0,
                    "total_ugs_credits": None,
                }
            )
            continue
        out.append(
            {
                "playbook_key": playbook_key,
                "display_name": row.get("display_name") or estimate.get("playbook_key"),
                "total_estimated_units": float(estimate.get("total_estimated_units") or 0),
                "total_ugs_credits": estimate.get("total_ugs_credits"),
            }
        )
    return out


async def build_realtor_quota_summary(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    """Full realtor quota payload for the current user."""
    credits_used_24h, balance, playbook_estimates = await _gather_quota(db, user_id)
    return {
        "vertical_slug": REALTOR_VERTICAL_SLUG,
        "credits_used_24h": credits_used_24h,
        "credits_balance": balance,
        "playbook_estimates": playbook_estimates,
    }


async def _gather_quota(db: AsyncSession, user_id: UUID) -> tuple[float, float | None, list[dict[str, Any]]]:
    import asyncio

    credits_task = load_user_pw_credits_used_24h(db, user_id)
    balance_task = load_user_credit_balance(db, user_id)
    estimates_task = build_playbook_estimate_helpers(db)
    credits_used_24h, balance, playbook_estimates = await asyncio.gather(
        credits_task,
        balance_task,
        estimates_task,
    )
    return float(credits_used_24h), balance, list(playbook_estimates)
