# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Idempotent survey completion rewards (UGS, EW, web search coins).
# Invariants:
# - Rewards granted once per survey response row.
# Related:
# - api/routers/product_desktop_feedback.py (peer pattern)
# ---

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.gaf_chat.system_notifications import notify_user_energy_credits_changed
from api.models.database_models import User
from api.models.surveys import SurveyResponse
from api.services.ugs.billing_service import BillingService
from api.services.web_search_quota_service import admin_patch_web_search_quota

logger = logging.getLogger(__name__)


def normalize_reward_spec(raw: dict[str, Any] | None) -> dict[str, int]:
    data = raw or {}
    return {
        "ugs_credits": max(0, int(data.get("ugs_credits") or 0)),
        "ew_balance": max(0, int(data.get("ew_balance") or 0)),
        "web_search_coins": max(0, int(data.get("web_search_coins") or 0)),
    }


async def grant_completion_rewards(
    db: AsyncSession,
    *,
    user_id: UUID,
    survey_id: UUID,
    response: SurveyResponse,
    reward_spec: dict[str, Any] | None,
    survey_title: str,
    db_pool: Any | None = None,
) -> dict[str, int]:
    """Grant configured rewards once; returns granted amounts."""
    if response.reward_granted_json is not None:
        return normalize_reward_spec(response.reward_granted_json)

    spec = normalize_reward_spec(reward_spec if isinstance(reward_spec, dict) else None)
    if spec["ugs_credits"] == 0 and spec["ew_balance"] == 0 and spec["web_search_coins"] == 0:
        response.reward_granted_json = spec  # type: ignore[assignment]
        await db.commit()
        return spec

    user = (await db.execute(select(User).where(User.id == user_id).with_for_update())).scalar_one_or_none()
    if user is None:
        msg = f"User {user_id} not found"
        raise ValueError(msg)

    granted = dict(spec)

    if spec["ugs_credits"] > 0:
        billing = BillingService(db)
        ok = await billing.add_credits(str(user_id), spec["ugs_credits"])
        if not ok:
            logger.warning("[SURVEY] ugs credit grant failed user=%s survey=%s", user_id, survey_id)
            granted["ugs_credits"] = 0
        elif db_pool is not None:
            new_bal = float(user.credits or 0)
            msg = (
                f"За опрос «{survey_title}» начислено {spec['ugs_credits']} кредитов UGS. "
                f"Текущий баланс: {new_bal:.0f}."
            )
            try:
                await notify_user_energy_credits_changed(
                    db_pool,
                    str(user_id),
                    new_balance=new_bal,
                    delta=float(spec["ugs_credits"]),
                    message_override=msg,
                )
            except Exception as exc:  # noqa: BLE001
                logger.debug("[STEP] survey_reward_gaf_skip user=%s err=%s", user_id, exc)

    if spec["ew_balance"] > 0:
        user_mut: Any = user
        user_mut.ew_balance = max(0, int(getattr(user, "ew_balance", 0) or 0) + spec["ew_balance"])

    if spec["web_search_coins"] > 0:
        await admin_patch_web_search_quota(
            db,
            user_id,
            web_search_coins_delta=spec["web_search_coins"],
        )

    response.reward_granted_json = granted  # type: ignore[assignment]
    await db.commit()
    logger.info(
        "[STEP] survey.reward_granted user=%s survey=%s spec=%s",
        user_id,
        survey_id,
        granted,
    )
    return granted
