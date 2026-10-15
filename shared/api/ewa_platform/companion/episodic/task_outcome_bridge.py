# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Best-effort bridge: terminal companion/agentic task runs → HCM episodic ``task_outcome``.
# Invariants:
# - Never raises into mirror/orchestrator callers.
# - Idempotent via ``extra.dedupe_key``.
# - Agentic source vs companion_task/chat_tool by intent_kind.
# Related:
# - api/ewa_platform/companion/episodic/writer.py
# - api/ewa_platform/agentic/adapters/task_run_events.py
# ---

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.companion.episodic.task_outcome import (
    TASK_OUTCOME_SOURCE_AGENTIC,
    TASK_OUTCOME_SOURCE_CHAT_TOOL,
    TASK_OUTCOME_SOURCE_COMPANION_TASK,
    artifacts_from_task_run,
    build_task_outcome_body,
    goal_from_task_run,
    outcome_from_task_run,
)
from api.ewa_platform.companion.episodic.writer import record_task_outcome

logger = logging.getLogger(__name__)

_TERMINAL = frozenset({"completed", "failed", "cancelled", "abandoned"})


def _source_for_run(run: Mapping[str, Any]) -> str:
    intent = str(run.get("intent_kind") or "").strip().lower()
    if intent == "agentic_session" or intent.startswith("agentic"):
        return TASK_OUTCOME_SOURCE_AGENTIC
    plan = run.get("plan_payload")
    if isinstance(plan, Mapping) and str(plan.get("kind") or "").strip() == "agentic_session_v1":
        return TASK_OUTCOME_SOURCE_AGENTIC
    if intent.endswith("_tool") or intent in {"file_create", "doc_create", "llm_summarize"}:
        return TASK_OUTCOME_SOURCE_CHAT_TOOL
    return TASK_OUTCOME_SOURCE_COMPANION_TASK


def _session_id_from_run(run: Mapping[str, Any]) -> str | None:
    plan = run.get("plan_payload")
    if isinstance(plan, Mapping):
        sid = str(plan.get("agentic_session_id") or plan.get("session_id") or "").strip()
        if sid:
            return sid[:128]
    return None


async def record_task_outcome_from_run(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    source: str | None = None,
    persona: str = "parent",
) -> dict[str, Any] | None:
    """Write one task_outcome episode from a companion task_run row. Best-effort."""

    status = str(run.get("status") or "").strip().lower()
    if status not in _TERMINAL:
        return None
    mem_status = "failed" if status == "abandoned" else status
    run_id = str(run.get("id") or "").strip()
    principal_id = str(run.get("principal_id") or "").strip()
    if not run_id or not principal_id:
        return None
    src = source or _source_for_run(run)
    mode = str(run.get("intent_kind") or "").strip()[:128]
    body = build_task_outcome_body(
        goal=goal_from_task_run(run),
        status=mem_status,
        outcome=outcome_from_task_run(run),
        artifacts=artifacts_from_task_run(run),
        mode=mode,
    )
    try:
        return await record_task_outcome(
            pool,
            principal_id=principal_id,
            body=body,
            source=src,
            run_id=run_id,
            status=mem_status,
            persona=persona,
            session_id=_session_id_from_run(run),
            mode=mode or None,
            extra={"intent_kind": mode} if mode else None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] companion_task_outcome_bridge_failed run_id=%s err=%s",
            run_id,
            exc,
        )
        return None


def schedule_record_task_outcome_from_run(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    source: str | None = None,
    persona: str = "parent",
) -> None:
    """Schedule write when caller cannot await (e.g. sync publish after HTTP).

    Prefer ``await record_task_outcome_from_run`` from async Celery/API paths so the
    coroutine completes before ``run_until_complete`` returns.
    """

    status = str(run.get("status") or "").strip().lower()
    if status not in _TERMINAL:
        return
    run_id = str(run.get("id") or "").strip()
    if not run_id:
        return

    async def _runner() -> None:
        await record_task_outcome_from_run(pool, run=run, source=source, persona=persona)

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.debug(
            "[STEP] companion_task_outcome_schedule_skip run_id=%s reason=no_running_loop",
            run_id,
        )
        return

    def _done(task: asyncio.Task[Any]) -> None:
        with contextlib.suppress(asyncio.CancelledError, Exception):
            exc = task.exception()
            if exc is not None:
                logger.warning(
                    "[STEP] companion_task_outcome_schedule_err run_id=%s err=%s",
                    run_id,
                    exc,
                )

    task = loop.create_task(_runner(), name=f"ewa_task_outcome:{run_id[:12]}")
    task.add_done_callback(_done)


__all__ = (
    "record_task_outcome_from_run",
    "schedule_record_task_outcome_from_run",
)
