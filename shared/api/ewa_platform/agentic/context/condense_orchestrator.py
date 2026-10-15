# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Orchestrate condense sidecar + atomic PG persist (Phase 3.5c Stage B/C).
# Invariants:
# - Fail-closed on persist conflict; LLM failures degrade without aborting the loop tick.
# - last_condense_seq advances to max checkpoint seq in the condensed window.
# Related:
# - api/ewa_platform/agentic/context/condense_sidecar.py
# - api/ewa_platform/persistence_pg/agentic_asyncpg.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.agentic.config import agentic_condense_checkpoint_input_limit, agentic_condense_http_runtime
from api.ewa_platform.agentic.context.condense_contracts import CONDENSE_KIND, CondenseSidecarInput
from api.ewa_platform.agentic.context.condense_sidecar import (
    CondenseLlmFn,
    CondenseSidecarError,
    invoke_condense_sidecar,
)
from api.ewa_platform.agentic.context.memory_tiers import (
    patch_last_condense_seq,
    read_active_slice_from_session,
)
from api.ewa_platform.agentic.kernel.circuit_breaker import working_memory_from_session
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

logger = logging.getLogger(__name__)


def _goal_text(session: Mapping[str, Any]) -> str:
    goal = session.get("goal_json")
    if isinstance(goal, Mapping):
        return str(goal.get("text") or goal.get("user_message") or "").strip()
    return ""


def _checkpoint_to_seq(checkpoints: list[dict[str, Any]]) -> int:
    seqs = [int(cp["seq"]) for cp in checkpoints if cp.get("seq") is not None]
    return max(seqs) if seqs else 0


async def maybe_run_condense(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
    session_id: str,
    principal_id: str,
    trigger: str = "iteration",
    llm_complete: CondenseLlmFn | None = None,
) -> Mapping[str, Any]:
    """Run condense when called; returns session row (updated or unchanged). Best-effort degrade."""

    session_id = str(session_id or session.get("id") or "").strip()
    if not session_id:
        logger.warning("[STEP] agentic_condense_skip reason=missing_session_id")
        return session

    wm = working_memory_from_session(session)
    active = read_active_slice_from_session(session)
    from_seq = active["last_condense_seq"]

    checkpoints = await agentic_pg.agentic_checkpoint_list_since_seq(
        pool,
        session_id=session_id,
        after_seq=from_seq,
        limit=agentic_condense_checkpoint_input_limit(),
    )
    # Exclude prior condense markers from LLM input — boundary is from_seq itself.
    input_rows = [cp for cp in checkpoints if str(cp.get("kind") or "") != CONDENSE_KIND]
    if not input_rows:
        logger.debug(
            "[STEP] agentic_condense_skip session_id=%s reason=no_new_checkpoints from_seq=%s",
            session_id,
            from_seq,
        )
        return session

    to_seq = _checkpoint_to_seq(input_rows)
    if to_seq <= from_seq:
        logger.debug(
            "[STEP] agentic_condense_skip session_id=%s reason=seq_not_advanced from=%s to=%s",
            session_id,
            from_seq,
            to_seq,
        )
        return session

    sidecar_input = CondenseSidecarInput(
        goal_text=_goal_text(session),
        current_plan_summary=str(session.get("plan_summary") or "").strip(),
        checkpoints=tuple(input_rows),
        from_seq=from_seq,
        to_seq=to_seq,
    )

    try:
        output = await invoke_condense_sidecar(sidecar_input, llm_complete=llm_complete)
    except CondenseSidecarError as exc:
        logger.warning(
            "[STEP] agentic_condense_llm_failed session_id=%s reason=%s",
            session_id,
            exc.reason,
        )
        return session

    expect_revision = int(session.get("session_revision") or 0)
    wm_patched = patch_last_condense_seq(wm, to_seq)
    _, model = agentic_condense_http_runtime()

    session_out, checkpoint, err = await agentic_pg.agentic_persist_condense_atomic(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        expect_revision=expect_revision,
        plan_summary=output.plan_summary,
        last_condense_seq=to_seq,
        working_memory_json=wm_patched,
        condense_payload={
            "from_seq": from_seq,
            "to_seq": to_seq,
            "trigger": trigger[:32],
            "previous_plan_summary_len": len(str(session.get("plan_summary") or "")),
            "plan_summary_chars": len(output.plan_summary),
            "checkpoint_count": len(input_rows),
        },
        llm_model=model,
    )

    if err is not None:
        logger.warning(
            "[STEP] agentic_condense_persist_failed session_id=%s reason=%s expect_revision=%s",
            session_id,
            err,
            expect_revision,
        )
        return session

    if session_out is None:
        return session

    logger.info(
        "[STEP] agentic_condense_ok session_id=%s from_seq=%s to_seq=%s cp_id=%s",
        session_id,
        from_seq,
        to_seq,
        checkpoint.get("id") if checkpoint else None,
    )
    return session_out
