# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Rehydrate AgenticContext from Postgres on every HTTP tick and Celery iteration.
# Invariants:
# - Idempotent: same DB snapshot yields equivalent context fields for the loop.
# Related:
# - documentation/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md §1.2
# ---

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

import asyncpg

from api.ewa_platform.agentic.config import agentic_checkpoint_window
from api.ewa_platform.agentic.kernel.act_binding_policy import replanning_steering_when_scheduler_idle
from api.ewa_platform.agentic.kernel.tree_scheduler import select_next_runnable_node
from api.ewa_platform.agentic.kernel.types import AgenticContext
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

logger = logging.getLogger(__name__)

_ACTIVE_NODE_STATUSES = ("pending", "claimed", "running", "retry_wait", "awaiting_human")


def _tree_summary(nodes: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for node in nodes:
        st = str(node.get("status") or "unknown")
        counts[st] = counts.get(st, 0) + 1
    return counts


def _build_llm_messages(
    session: Mapping[str, Any],
    *,
    checkpoints: list[dict[str, Any]],
    inbound_messages: list[dict[str, Any]],
    active_nodes: list[dict[str, Any]],
    tree_summary: dict[str, int],
) -> list[dict[str, str]]:
    goal = session.get("goal_json")
    goal_text = ""
    if isinstance(goal, Mapping):
        goal_text = str(goal.get("text") or goal.get("user_message") or "").strip()
    plan_summary = str(session.get("plan_summary") or "").strip()

    system = (
        "You are the EWA agentic executor. Output JSON matching AgenticThinkOutput. "
        "Use action=plan|act|gate|complete|clarify. Never invent tools outside allowlist."
    )
    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    if goal_text:
        messages.append({"role": "user", "content": f"Goal: {goal_text}"})
    if plan_summary:
        messages.append({"role": "assistant", "content": f"Plan summary: {plan_summary}"})

    for cp in checkpoints[-10:]:
        kind = str(cp.get("kind") or "")
        payload = cp.get("payload_json")
        summary = ""
        if isinstance(payload, Mapping):
            summary = str(payload.get("summary") or payload.get("rationale") or payload)[:800]
        if summary:
            messages.append({"role": "assistant", "content": f"[{kind}] {summary}"})

    for msg in inbound_messages:
        body = msg.get("message_json")
        text = ""
        if isinstance(body, Mapping):
            text = str(body.get("text") or body.get("message") or body.get("decision") or "")
        if text:
            messages.append({"role": "user", "content": text})

    if active_nodes:
        lines = [f"- {n.get('title')}: {n.get('status')} ({n.get('node_kind')})" for n in active_nodes[:12]]
        messages.append({"role": "assistant", "content": "Active nodes:\n" + "\n".join(lines)})

    status = str(session.get("status") or "")
    if status == "replanning" and not active_nodes:
        messages.append(
            {
                "role": "system",
                "content": (
                    "Replanning with an empty task tree: emit action=plan with non-empty plan_nodes. "
                    "Do not use action=act until plan nodes exist."
                ),
            }
        )

    steering = replanning_steering_when_scheduler_idle(
        AgenticContext(
            session=session,
            active_nodes=active_nodes,
            tree_summary=tree_summary,
            checkpoints=checkpoints,
            inbound_messages=inbound_messages,
            llm_messages=[],
            scheduled_node=select_next_runnable_node(active_nodes),
        )
    )
    if steering:
        messages.append({"role": "system", "content": steering})

    return messages


def context_fingerprint(ctx: AgenticContext) -> str:
    blob = {
        "session_id": ctx.session.get("id"),
        "revision": ctx.session.get("session_revision"),
        "status": ctx.session.get("status"),
        "inbound": len(ctx.inbound_messages),
        "active": len(ctx.active_nodes),
    }
    raw = json.dumps(blob, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


async def rehydrate_agentic_context(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    worker_id: str | None = None,
    for_update: bool = False,
) -> AgenticContext:
    if for_update:
        session = await agentic_pg.agentic_session_fetch_for_update(
            pool,
            session_id=session_id,
            principal_id=principal_id,
        )
    else:
        session = await agentic_pg.agentic_session_fetch_for_principal(
            pool,
            session_id=session_id,
            principal_id=principal_id,
        )

    if session is None:
        return AgenticContext(
            session={},
            active_nodes=[],
            tree_summary={},
            checkpoints=[],
            inbound_messages=[],
            llm_messages=[],
            busy=True,
            busy_reason="session_not_found",
        )

    leased_until = session.get("leased_until")
    lease_holder = str(session.get("lease_holder") or "")
    if worker_id and leased_until and isinstance(leased_until, datetime):
        now = datetime.now(tz=UTC)
        lu = leased_until if leased_until.tzinfo else leased_until.replace(tzinfo=UTC)
        if lu > now and lease_holder and lease_holder != worker_id:
            return AgenticContext(
                session=session,
                active_nodes=[],
                tree_summary={},
                checkpoints=[],
                inbound_messages=[],
                llm_messages=[],
                worker_id=worker_id,
                busy=True,
                busy_reason="lease_held",
            )

    all_nodes = await agentic_pg.agentic_task_tree_list(pool, session_id=session_id)
    active_nodes = await agentic_pg.agentic_task_tree_list(
        pool,
        session_id=session_id,
        statuses=_ACTIVE_NODE_STATUSES,
    )
    checkpoints = await agentic_pg.agentic_checkpoint_list_recent(
        pool,
        session_id=session_id,
        limit=agentic_checkpoint_window(),
        kinds=("observe", "think", "plan", "act", "gate", "error", "condense"),
    )
    inbound_messages = await agentic_pg.agentic_inbound_list_unconsumed(pool, session_id=session_id)
    tree_summary = _tree_summary(all_nodes)
    llm_messages = _build_llm_messages(
        session,
        checkpoints=checkpoints,
        inbound_messages=inbound_messages,
        active_nodes=active_nodes,
        tree_summary=tree_summary,
    )

    scheduled = select_next_runnable_node(active_nodes)

    ctx = AgenticContext(
        session=session,
        active_nodes=active_nodes,
        tree_summary=tree_summary,
        checkpoints=checkpoints,
        inbound_messages=inbound_messages,
        llm_messages=llm_messages,
        worker_id=worker_id,
        scheduled_node=scheduled,
    )
    logger.info(
        "[STEP] agentic_rehydrate session_id=%s revision=%s fp=%s status=%s",
        session_id,
        session.get("session_revision"),
        context_fingerprint(ctx),
        session.get("status"),
    )
    return ctx
