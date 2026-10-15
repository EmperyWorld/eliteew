# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Execute agentic_mandatory / agentic_active_steering intake lanes at chat turn entry.
# Invariants:
# - Never returns None for agentic_mandatory — always a terminal orchestration payload.
# Related:
# - api/ewa_platform/agentic/chat_bridge.py
# ---

from __future__ import annotations

import logging
from typing import Any

import asyncpg

from api.ewa_platform.agentic.chat_bridge import maybe_handle_agentic_companion_turn
from api.ewa_platform.agentic.config import agentic_substrate_enabled
from api.ewa_platform.agentic.intake.gate import IntakeVerdict
from api.ewa_platform.agentic.starter import start_agentic_session
from api.ewa_platform.companion.orchestration.response import tag_orchestration_branch

logger = logging.getLogger(__name__)


async def resolve_agentic_intake_turn(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    verdict: IntakeVerdict,
    client_turn_id: str | None = None,
    content_catalog_user_id: str | None = None,
    oauth2_sub: str | None = None,
) -> dict[str, Any]:
    """Return a terminal orchestration response for agentic intake lanes."""

    if verdict.lane == "agentic_active_steering":
        out = await maybe_handle_agentic_companion_turn(
            pool,
            principal_id=principal_id,
            user_line=user_line,
            client_turn_id=client_turn_id,
            content_catalog_user_id=content_catalog_user_id,
            oauth2_sub=oauth2_sub,
        )
        if out is not None:
            return _tag_agentic_route(out, verdict)
        return _tag_agentic_route(
            {
                "reply": "Сообщение принято в очередь автономной задачи.",
                "orchestration_branch": "agentic_session",
                "orchestrated": True,
            },
            verdict,
        )

    # agentic_mandatory — never fall through silently
    out = await maybe_handle_agentic_companion_turn(
        pool,
        principal_id=principal_id,
        user_line=user_line,
        client_turn_id=client_turn_id,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub=oauth2_sub,
    )
    if out is not None:
        return _tag_agentic_route(out, verdict)

    if not agentic_substrate_enabled():
        return _tag_agentic_route(
            {
                "reply": (
                    "Автономный режим агента выключен (EWA_AGENTIC_SUBSTRATE_ENABLED=0 "
                    "в настройках платформы EWA — админка «EWA — спутник» → «Настройки»)."
                ),
                "orchestration_branch": "agentic_session",
                "orchestrated": True,
            },
            verdict,
        )

    outcome = await start_agentic_session(
        pool,
        principal_id=principal_id,
        user_line=user_line,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub=oauth2_sub,
    )
    if outcome.get("ok"):
        return _tag_agentic_route(
            {
                "reply": str(outcome.get("reply") or ""),
                "orchestration_branch": "agentic_session",
                "orchestrated": True,
                "task_run": outcome.get("task_run"),
                "agentic_status": "intake_mandatory_start",
            },
            verdict,
        )
    reason = str(outcome.get("reason") or "")
    sess = outcome.get("session")
    if reason == "active_session_exists" and isinstance(sess, dict):
        steer = await maybe_handle_agentic_companion_turn(
            pool,
            principal_id=principal_id,
            user_line=user_line,
            client_turn_id=client_turn_id,
            content_catalog_user_id=content_catalog_user_id,
            oauth2_sub=oauth2_sub,
        )
        if steer is not None:
            return _tag_agentic_route(steer, verdict)

    logger.error(
        "[STEP] agentic_intake_mandatory_failed principal_id=%s reason=%s",
        principal_id,
        reason or "no_handler",
    )
    return _tag_agentic_route(
        {
            "reply": "Не удалось запустить автономную сессию для этой задачи. Повторите или уточните запрос.",
            "orchestration_branch": "agentic_session",
            "orchestrated": True,
        },
        verdict,
    )


def _tag_agentic_route(response: dict[str, Any], verdict: IntakeVerdict) -> dict[str, Any]:
    out = dict(response)
    branch = str(out.get("orchestration_branch") or "agentic_session").strip() or "agentic_session"
    out = tag_orchestration_branch(out, branch)
    out["intake_verdict"] = {
        "lane": verdict.lane,
        "reason": verdict.reason,
        "strategic_intent": verdict.strategic_intent,
    }
    out["routing_debug"] = {
        "route": "agentic_intake",
        "intent": verdict.lane,
        "llm_called": False,
        "surface": "none",
    }
    logger.info(
        "[STEP] companion_route_decision route=agentic_intake intent=%s llm_called=false task_run=%s",
        verdict.lane,
        "yes" if out.get("task_run") else "no",
    )
    return out
