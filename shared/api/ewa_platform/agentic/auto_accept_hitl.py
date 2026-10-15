# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User preference ``agentic_autonomy_v1.auto_accept_tasks`` → session ``policy_json.auto_accept_hitl``.
# When enabled, companion confirm tools create storage immediately (no HITL gate / Confirm UI).
# Invariants:
# - Default OFF; missing/malformed pref → False.
# - Mid-session: live profile re-read allows toggle while a task is running.
# - Prefer direct create in tool handlers; finalize path remains for residual needs_confirm.
# Related:
# - api/ewa_platform/agentic/starter.py
# - api/ewa_platform/companion/orchestration/tools/handlers_files.py
# - documentation/product/ewa/EWA-COMPANION-FILE-CATALOG.md
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import asyncpg

logger = logging.getLogger(__name__)

LEARNED_PREF_KEY = "agentic_autonomy_v1"
POLICY_KEY = "auto_accept_hitl"
ARGS_FLAG = "_auto_accept_hitl"


def read_auto_accept_tasks_pref(learned_preferences: Mapping[str, Any] | None) -> bool:
    """Read companion learned_preferences for auto-accept tumbler (default False)."""

    if not isinstance(learned_preferences, Mapping):
        return False
    blob = learned_preferences.get(LEARNED_PREF_KEY)
    if blob is True:
        return True
    if isinstance(blob, Mapping):
        raw = blob.get("auto_accept_tasks")
        if raw is True:
            return True
        if isinstance(raw, str):
            return raw.strip().lower() in {"1", "true", "yes", "on"}
    if isinstance(blob, str):
        return blob.strip().lower() in {"1", "true", "yes", "on"}
    return False


def policy_has_auto_accept_hitl(policy_json: Mapping[str, Any] | None) -> bool:
    if not isinstance(policy_json, Mapping):
        return False
    return policy_json.get(POLICY_KEY) is True


def merge_auto_accept_into_policy(
    policy_json: Mapping[str, Any] | None,
    *,
    auto_accept: bool,
) -> dict[str, Any]:
    out = dict(policy_json) if isinstance(policy_json, Mapping) else {}
    if auto_accept:
        out[POLICY_KEY] = True
    else:
        out.pop(POLICY_KEY, None)
    return out


def args_request_auto_accept(args: Mapping[str, Any] | None) -> bool:
    if not isinstance(args, Mapping):
        return False
    return args.get(ARGS_FLAG) is True


async def resolve_auto_accept_hitl(
    pool: asyncpg.Pool | Any,
    *,
    principal_id: str,
    policy_json: Mapping[str, Any] | None,
    profile: Mapping[str, Any] | None = None,
) -> bool:
    """True when session policy or live companion profile wants auto-accept HITL."""

    if policy_has_auto_accept_hitl(policy_json):
        return True

    learned: Any = None
    if isinstance(profile, Mapping):
        learned = profile.get("learned_preferences")
    else:
        try:
            from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

            fetched = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
        except Exception as exc:  # noqa: BLE001 — prefer fail closed (manual confirm)
            logger.info(
                "[STEP] agentic_auto_accept_profile_skip principal_id=%s err=%s",
                principal_id,
                exc,
            )
            return False
        if not isinstance(fetched, Mapping):
            logger.info(
                "[STEP] agentic_auto_accept_disabled principal_id=%s reason=no_profile",
                principal_id,
            )
            return False
        learned = fetched.get("learned_preferences")

    enabled = read_auto_accept_tasks_pref(learned if isinstance(learned, Mapping) else None)
    if not enabled:
        logger.info(
            "[STEP] agentic_auto_accept_disabled principal_id=%s reason=pref_off",
            principal_id,
        )
    return enabled


async def try_auto_finalize_needs_confirm(
    pool: asyncpg.Pool | Any,
    *,
    session: Mapping[str, Any],
    principal_id: str,
    gate_payload: Mapping[str, Any],
    act_node_id: str | None,
) -> dict[str, Any] | None:
    """Confirm companion pending run without UI when auto-accept is enabled.

    Residual path for tools that still emit ``needs_confirm``. Prefer direct create in handlers.
    Returns finalize outcome dict on success, or ``None`` to open HITL gate.
    """

    enabled = await resolve_auto_accept_hitl(
        pool,
        principal_id=principal_id,
        policy_json=session.get("policy_json") if isinstance(session.get("policy_json"), Mapping) else None,
    )
    if not enabled:
        return None

    session_id = str(session.get("id") or "")
    if not session_id:
        return None

    from api.ewa_platform.agentic.hitl_companion_finalize import finalize_hitl_companion_pending
    from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

    active_nodes = await agentic_pg.agentic_task_tree_list(
        pool,
        session_id=session_id,
        statuses=("pending", "claimed", "running", "retry_wait", "awaiting_human"),
    )
    if act_node_id and not any(str(n.get("id") or "") == act_node_id for n in active_nodes):
        active_nodes = list(active_nodes) + [{"id": act_node_id, "status": "running", "metadata_json": {}}]

    session_with_gate = dict(session)
    session_with_gate["gate_json"] = dict(gate_payload)
    finalize_out = await finalize_hitl_companion_pending(
        pool,
        session=session_with_gate,
        principal_id=principal_id,
        decision="confirm",
        active_nodes=active_nodes,
    )
    if not finalize_out.get("ok"):
        logger.warning(
            "[STEP] agentic_auto_accept_finalize_failed session_id=%s reason=%s",
            session_id,
            finalize_out.get("reason"),
        )
        return None
    if finalize_out.get("skipped"):
        logger.info(
            "[STEP] agentic_auto_accept_no_pending_run session_id=%s",
            session_id,
        )
    else:
        logger.info(
            "[STEP] agentic_auto_accept_confirm session_id=%s run_ok=1",
            session_id,
        )
    return finalize_out


__all__ = (
    "ARGS_FLAG",
    "LEARNED_PREF_KEY",
    "POLICY_KEY",
    "args_request_auto_accept",
    "merge_auto_accept_into_policy",
    "policy_has_auto_accept_hitl",
    "read_auto_accept_tasks_pref",
    "resolve_auto_accept_hitl",
    "try_auto_finalize_needs_confirm",
)
