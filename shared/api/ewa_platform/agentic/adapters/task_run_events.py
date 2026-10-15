# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Companion Operations SSE bridge for agentic sessions (run_id + canonical event names).
# Invariants:
# - Payloads match music/image task event shape; no agentic-only task_progress events.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - api/ewa_platform/agentic/jobs/executor.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.agentic.kernel.circuit_breaker import REASONING_LOOP_DETECTED, working_memory_from_session
from api.ewa_platform.companion.jobs.task_events import publish_task_event_sync

logger = logging.getLogger(__name__)

_AGENTIC_INTENT = "agentic_session"


def session_linked_run_id(session: Mapping[str, Any]) -> str:
    return str(session.get("linked_task_run_id") or "").strip()


def _base_payload(session: Mapping[str, Any]) -> dict[str, Any]:
    run_id = session_linked_run_id(session)
    payload: dict[str, Any] = {
        "run_id": run_id,
        "intent_kind": _AGENTIC_INTENT,
        "session_id": session.get("id"),
        "status": session.get("status"),
        "linked_task_run_id": run_id,
    }
    return payload


def publish_agentic_task_event_sync(
    session: Mapping[str, Any],
    event_name: str,
    extra: Mapping[str, Any] | None = None,
) -> None:
    run_id = session_linked_run_id(session)
    if not run_id:
        return
    pid = str(session.get("principal_id") or "").strip()
    if not pid:
        return
    payload = _base_payload(session)
    if extra:
        payload.update(dict(extra))
    publish_task_event_sync(principal_id=pid, event_name=event_name, payload=payload)


def publish_agentic_run_snapshot_sync(run: Mapping[str, Any], *, principal_id: str) -> None:
    pid = str(principal_id or run.get("principal_id") or "").strip()
    run_id = str(run.get("id") or "").strip()
    if not pid or not run_id:
        return
    publish_task_event_sync(
        principal_id=pid,
        event_name="run_snapshot",
        payload={"run": dict(run)},
    )


def publish_agentic_session_lifecycle_sync(
    session: Mapping[str, Any],
    *,
    extra: Mapping[str, Any] | None = None,
) -> None:
    """Emit terminal or gate SSE based on session status."""

    st = str(session.get("status") or "").strip().lower()
    wm = working_memory_from_session(session)
    terminate_reason = str(wm.get("terminate_reason") or "").strip()

    if st in {"failed", "abandoned"}:
        reason = terminate_reason or REASONING_LOOP_DETECTED
        publish_agentic_task_event_sync(
            session,
            "task_failed",
            {
                "status": "failed",
                "error_payload": {
                    "reason": reason,
                    "terminate_reason": terminate_reason or None,
                    **(dict(extra) if extra else {}),
                },
            },
        )
        return

    if st == "completed":
        publish_agentic_task_event_sync(
            session,
            "task_completed",
            {
                "status": "completed",
                "result_payload": {"session_status": st},
            },
        )
        return

    if st == "awaiting_human":
        gate = session.get("gate_json")
        gate_payload = dict(gate) if isinstance(gate, Mapping) else {}
        publish_agentic_task_event_sync(
            session,
            "task_awaiting_confirmation",
            {"status": "awaiting_confirmation", "gate": gate_payload},
        )
        return

    if extra:
        publish_agentic_task_event_sync(session, "run_snapshot", extra)


def publish_agentic_after_mirror_sync(
    session: Mapping[str, Any],
    run: Mapping[str, Any] | None,
) -> None:
    """After task_run mirror sync: terminal events or run_snapshot for in-progress."""

    if run is None:
        return
    pid = str(session.get("principal_id") or run.get("principal_id") or "").strip()
    st = str(session.get("status") or "").strip().lower()
    if st in {"failed", "abandoned", "completed", "awaiting_human"}:
        publish_agentic_session_lifecycle_sync(session)
        return
    publish_agentic_run_snapshot_sync(run, principal_id=pid)


async def sync_and_publish_task_run_from_session(
    pool: Any,
    *,
    session: Mapping[str, Any],
) -> dict[str, Any] | None:
    """Sync the Operations mirror and publish the resulting run in one boundary step."""

    from api.ewa_platform.agentic.adapters.task_run_mirror import sync_task_run_from_session
    from api.ewa_platform.companion.episodic.task_outcome_bridge import (
        record_task_outcome_from_run,
    )

    run = await sync_task_run_from_session(pool, session=session)
    publish_agentic_after_mirror_sync(session, run)
    if run is not None:
        st = str(session.get("status") or run.get("status") or "").strip().lower()
        if st in {"completed", "failed", "cancelled", "abandoned"}:
            # Await in-loop (Celery ``run_until_complete`` drains the coroutine).
            # Fire-and-forget ``create_task`` would often never run after the worker returns.
            try:
                await record_task_outcome_from_run(pool, run=run, source="agentic")
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "[STEP] agentic_task_outcome_hook_skip session=%s err=%s",
                    str(session.get("id") or "")[:36],
                    exc,
                )
    return run


__all__ = (
    "publish_agentic_after_mirror_sync",
    "publish_agentic_run_snapshot_sync",
    "publish_agentic_session_lifecycle_sync",
    "publish_agentic_task_event_sync",
    "session_linked_run_id",
    "sync_and_publish_task_run_from_session",
)
