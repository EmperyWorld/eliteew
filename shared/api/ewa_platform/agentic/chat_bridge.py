# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Route companion chat messages to active agentic sessions (inbox + resume).
# Invariants:
# - When session is awaiting_human, chat does not invoke main LLM — returns ack only.
# Related:
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# ---

from __future__ import annotations

import logging
from typing import Any

import asyncpg

from api.ewa_platform.agentic.adapters.task_run_events import sync_and_publish_task_run_from_session
from api.ewa_platform.agentic.budget import session_budget_exceeded
from api.ewa_platform.agentic.config import agentic_inbox_max_pending, agentic_substrate_enabled
from api.ewa_platform.agentic.jobs.enqueue import enqueue_agentic_loop_tick
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.state_machine import apply_session_transition
from api.ewa_platform.agentic.respond import apply_agentic_human_response
from api.ewa_platform.agentic.starter import (
    start_agentic_session,
    user_line_requests_agentic_start,
    user_line_requests_agentic_work_session,
)
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

logger = logging.getLogger(__name__)

_CHAT_CONFIRM_WORDS: frozenset[str] = frozenset(
    {
        "confirm",
        "approve",
        "yes",
        "ok",
        "да",
        "подтверждаю",
        "подтвердить",
        "согласен",
        "согласна",
        "продолжай",
        "можно",
    }
)
_CHAT_CANCEL_WORDS: frozenset[str] = frozenset(
    {
        "cancel",
        "decline",
        "reject",
        "no",
        "stop",
        "нет",
        "отмена",
        "отменить",
        "не надо",
        "стоп",
        "останови",
        "отклонить",
    }
)


def _agentic_inbound_reply_error(resp: dict[str, Any]) -> str:
    reason = str(resp.get("reason") or "").strip()
    if reason == "revision_conflict":
        return "Задача уже обновилась. Обновите панель операций и повторите ответ."
    if reason == "gate_expired":
        return "Время ожидания ответа истекло. Обновите панель операций или отмените задачу."
    if reason == "bound_node_drift":
        return "Шаг задачи уже изменился. Обновите панель операций и повторите, если нужно."
    if reason:
        return reason
    return "Не удалось обработать ответ."


def _chat_hitl_decision_from_text(user_line: str) -> str | None:
    """Return an explicit HITL decision from chat text, never guessing intent."""

    text = " ".join(str(user_line or "").strip().lower().split())
    if not text:
        return None
    if text in _CHAT_CANCEL_WORDS:
        return "cancel"
    if text in _CHAT_CONFIRM_WORDS:
        return "confirm"
    return None


async def maybe_handle_agentic_companion_turn(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    client_turn_id: str | None = None,
    content_catalog_user_id: str | None = None,
    oauth2_sub: str | None = None,
) -> dict[str, Any] | None:
    if not agentic_substrate_enabled():
        if user_line_requests_agentic_start(user_line):
            return {
                "reply": (
                    "Agentic substrate выключен (EWA_AGENTIC_SUBSTRATE_ENABLED=0 "
                    "в настройках платформы EWA — админка «EWA — спутник» → «Настройки»)."
                ),
                "orchestration_branch": "agentic_session",
                "orchestrated": True,
            }
        return None

    if user_line_requests_agentic_start(user_line):
        outcome = await start_agentic_session(
            pool,
            principal_id=principal_id,
            user_line=user_line,
            content_catalog_user_id=content_catalog_user_id,
            oauth2_sub=oauth2_sub,
        )
        if not outcome.get("ok"):
            reason = str(outcome.get("reason") or "")
            if reason == "active_session_exists":
                sess = outcome.get("session")
                if isinstance(sess, dict):
                    return await _route_to_active_session(
                        pool,
                        session=sess,
                        principal_id=principal_id,
                        user_line=user_line,
                        client_turn_id=client_turn_id,
                    )
            return {
                "reply": str(outcome.get("reply") or "Не удалось запустить agentic session."),
                "orchestration_branch": "agentic_session",
                "orchestrated": True,
                "task_run": outcome.get("task_run"),
            }
        return {
            "reply": str(outcome.get("reply") or ""),
            "orchestration_branch": "agentic_session",
            "orchestrated": True,
            "task_run": outcome.get("task_run"),
        }

    active = await agentic_pg.agentic_session_fetch_active_for_principal(pool, principal_id=principal_id)
    if active is not None:
        active = await _release_budget_exhausted_session(pool, session=active, principal_id=principal_id)
    if active is None:
        if user_line_requests_agentic_work_session(user_line):
            outcome = await start_agentic_session(
                pool,
                principal_id=principal_id,
                user_line=user_line,
                content_catalog_user_id=content_catalog_user_id,
                oauth2_sub=oauth2_sub,
            )
            if not outcome.get("ok"):
                reason = str(outcome.get("reason") or "")
                if reason == "active_session_exists":
                    sess = outcome.get("session")
                    if isinstance(sess, dict):
                        return await _route_to_active_session(
                            pool,
                            session=sess,
                            principal_id=principal_id,
                            user_line=user_line,
                            client_turn_id=client_turn_id,
                        )
                return None
            return {
                "reply": str(outcome.get("reply") or ""),
                "orchestration_branch": "agentic_session",
                "orchestrated": True,
                "task_run": outcome.get("task_run"),
                "agentic_status": "auto_started_work_session",
            }
        return None

    return await _route_to_active_session(
        pool,
        session=active,
        principal_id=principal_id,
        user_line=user_line,
        client_turn_id=client_turn_id,
    )


async def _release_budget_exhausted_session(
    pool: asyncpg.Pool,
    *,
    session: dict[str, Any],
    principal_id: str,
) -> dict[str, Any] | None:
    """Cancel active session when wall-clock budget is already exhausted (queue-wait zombie)."""

    exceeded, reason = session_budget_exceeded(session)
    if not exceeded:
        return session

    session_id = str(session.get("id") or "")
    tr = await apply_session_transition(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        event="cancel",
        expect_revision=int(session.get("session_revision") or 0),
        clear_lease=True,
    )
    if not tr.ok or tr.session is None:
        logger.warning(
            "[STEP] agentic_budget_zombie_cancel_failed session_id=%s reason=%s",
            session_id,
            tr.reason,
        )
        return session

    await sync_and_publish_task_run_from_session(pool, session=tr.session)
    logger.info(
        "[STEP] agentic_budget_zombie_cancelled session_id=%s budget_reason=%s",
        session_id,
        reason,
    )
    return None


async def _route_to_active_session(
    pool: asyncpg.Pool,
    *,
    session: dict[str, Any],
    principal_id: str,
    user_line: str,
    client_turn_id: str | None,
) -> dict[str, Any]:
    session_id = str(session.get("id") or "")
    status = str(session.get("status") or "")

    pending = await agentic_pg.agentic_inbound_count_unconsumed(pool, session_id=session_id)
    if pending >= agentic_inbox_max_pending():
        return {
            "reply": "Очередь сообщений для текущей задачи переполнена. Дождитесь шага или отмените задачу.",
            "orchestration_branch": "agentic_session",
            "orchestrated": True,
        }

    if status == fsm.STATUS_AWAITING_HUMAN:
        decision = _chat_hitl_decision_from_text(user_line)
        if decision is None:
            return {
                "reply": (
                    "Нужен явный выбор: нажмите «Подтвердить» или «Отмена» "
                    "в центре миссии. Сообщение не будет принято как подтверждение."
                ),
                "orchestration_branch": "agentic_session",
                "orchestrated": True,
                "agentic_status": "awaiting_explicit_decision",
            }
        resp = await apply_agentic_human_response(
            pool,
            session_id=session_id,
            principal_id=principal_id,
            decision=decision,
            message_text=user_line,
            client_turn_id=client_turn_id,
            source="chat",
        )
        reply = "Принял, продолжаю…" if resp.get("ok") else _agentic_inbound_reply_error(resp)
        return {
            "reply": reply,
            "orchestration_branch": "agentic_session",
            "orchestrated": True,
            "task_run": resp.get("task_run"),
        }

    await agentic_pg.agentic_inbound_insert(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        source="chat",
        message_json={"text": user_line},
        client_turn_id=client_turn_id,
    )
    enqueue_agentic_loop_tick(
        session_id=session_id,
        principal_id=principal_id,
        expected_revision=int(session.get("session_revision") or 0),
    )
    await sync_and_publish_task_run_from_session(pool, session=session)
    logger.info("[STEP] agentic_inbound_queued session_id=%s status=%s", session_id, status)
    return {
        "reply": "Сообщение принято в очередь автономной задачи.",
        "orchestration_branch": "agentic_session",
        "orchestrated": True,
        "agentic_status": "queued_steering",
    }
