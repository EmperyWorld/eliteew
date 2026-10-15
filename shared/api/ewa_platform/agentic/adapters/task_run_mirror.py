# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Mirror agentic session state into ewa_companion_task_runs for Operations panel + SSE, using E5 atomic run/step sync.
# Invariants:
# - intent_kind=agentic_session; plan_payload.agentic_session_id links back.
# - E5/V-M4: sync_task_run_from_session performs one companion mirror persistence call, not per-step transactions.
# Related:
# - documentation/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md §3.3
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (E5)
# ---

from __future__ import annotations

import logging
import re
import time
from collections.abc import Mapping, Sequence
from typing import Any

import asyncpg
from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)

_GATE_DOC_NAME_RE = re.compile(r"«([^»]+)»")

_AGENTIC_STATUS_TO_RUN: dict[str, str] = {
    "init": "pending",
    "planning": "running",
    "executing": "running",
    "awaiting_human": "awaiting_confirmation",
    "paused": "running",
    "replanning": "running",
    "completed": "completed",
    "failed": "failed",
    "cancelled": "cancelled",
    "abandoned": "cancelled",
}


def _agentic_session_display_state(session_status: str) -> str:
    status = str(session_status or "").strip().lower()
    if status == "awaiting_human":
        return "awaiting_confirmation"
    if status in {
        "init",
        "planning",
        "executing",
        "paused",
        "replanning",
        "completed",
        "failed",
        "cancelled",
        "abandoned",
    }:
        return status
    return "running"


def _companion_step_status_from_node_status(node_status: str) -> str:
    status = str(node_status or "").strip().lower()
    if status == "completed":
        return "completed"
    if status == "failed":
        return "failed"
    if status == "cancelled":
        return "cancelled"
    if status == "awaiting_human":
        return "awaiting_confirmation"
    if status in {"claimed", "running", "retry_wait"}:
        return "running"
    if status == "awaiting_child":
        return "running"
    if status in {"planning", "executing", "replanning", "paused"}:
        return "running"
    return "pending"


def _node_input_payload(node: Mapping[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "node_id": node.get("id"),
        "node_kind": node.get("node_kind"),
    }
    tool_name = str(node.get("tool_name") or "").strip()
    if tool_name:
        payload["tool_name"] = tool_name
    return payload


def _document_name_from_gate_summary(summary: str) -> str:
    match = _GATE_DOC_NAME_RE.search(str(summary or ""))
    if not match:
        return ""
    return str(match.group(1) or "").strip()


def _compact_text(value: Any, *, limit: int) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    return text[:limit].rstrip()


_DOC_RESULT_TOOLS = frozenset({"file_create", "file_save_text", "document_insert"})


def _mission_answer_text(value: Any, *, limit: int) -> str:
    """Keep line breaks so center Markdown can render; still bound length."""

    from api.ewa_platform.agentic.kernel.visible_text import sanitize_agentic_visible_text

    text = sanitize_agentic_visible_text(str(value or ""))
    if not text:
        return ""
    if len(text) > limit:
        return text[: limit - 1].rstrip() + "…"
    return text


def _primary_result_from_answer(answer: str) -> str:
    from api.ewa_platform.agentic.kernel.visible_text import looks_like_research_plan_scaffold

    text = (answer or "").strip()
    if not text:
        return ""
    for line in text.splitlines():
        raw = line.strip()
        if not raw:
            continue
        low = raw.lower()
        if "создала документ" in low or "создан документ" in low or low.startswith("готова:"):
            return _compact_text(raw, limit=360)
    if looks_like_research_plan_scaffold(text):
        return ""
    for line in text.splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#"):
            continue
        if looks_like_research_plan_scaffold(raw):
            continue
        plain = re.sub(r"[*_`#]+", "", raw).strip()
        if plain:
            return plain[:360]
    return _compact_text(text, limit=360)


def _result_summary_from_nodes(nodes: Sequence[Mapping[str, Any]] | None) -> str:
    if not nodes:
        return ""
    from api.ewa_platform.agentic.kernel.visible_text import looks_like_research_plan_scaffold

    completed: list[Mapping[str, Any]] = [
        node for node in reversed(list(nodes)) if str(node.get("status") or "").strip().lower() == "completed"
    ]
    for node in completed:
        tool = str(node.get("tool_name") or "").strip().lower()
        summary = _mission_answer_text(node.get("result_summary"), limit=1600)
        if tool in _DOC_RESULT_TOOLS and summary:
            return summary
    for node in completed:
        summary = _mission_answer_text(node.get("result_summary"), limit=1600)
        if summary and not looks_like_research_plan_scaffold(summary):
            return summary
    # Never promote research_plan scaffolds into «Главный ответ».
    return ""


def mission_answer_payload_from_session(
    session: Mapping[str, Any],
    *,
    nodes: Sequence[Mapping[str, Any]] | None = None,
) -> dict[str, str]:
    """Derive durable user-facing mission outcome fields from agentic session state."""

    status = str(session.get("status") or "").strip().lower()
    result_summary = _mission_answer_text(session.get("result_summary"), limit=1600) or _result_summary_from_nodes(
        nodes
    )
    plan_summary = _compact_text(session.get("plan_summary"), limit=900)
    if result_summary:
        answer = result_summary
    elif status == "completed" and plan_summary:
        answer = plan_summary
    else:
        answer = ""

    primary_result = _primary_result_from_answer(answer)
    if not primary_result and status == "completed":
        primary_result = "Миссия завершена."

    if status == "awaiting_human":
        next_action = "Подтвердите решение, чтобы Кора продолжила миссию."
    elif status in {"planning", "executing", "replanning", "paused", "init"}:
        next_action = "Кора продолжает миссию; ход и результат остаются в центре."
    elif status == "completed":
        next_action = "Проверьте результат и откройте созданные материалы."
    elif status == "failed":
        next_action = "Проверьте ошибку и перезапустите миссию при необходимости."
    elif status in {"cancelled", "abandoned"}:
        next_action = "Миссия остановлена; можно начать новую задачу."
    else:
        next_action = "Проверьте текущий статус миссии."

    payload: dict[str, str] = {
        "primary_result": primary_result,
        "recommended_next_action": next_action,
    }
    if answer:
        payload["mission_answer_summary"] = answer
    return payload


def _node_brief(node: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "node_id": node.get("id"),
        "title": str(node.get("title") or "")[:240],
        "tool_name": str(node.get("tool_name") or "").strip() or None,
        "result_ref": str(node.get("result_ref") or "").strip() or None,
        "result_summary": _compact_text(node.get("result_summary"), limit=1200),
        "last_error": _compact_text(node.get("last_error"), limit=1200),
    }


def _latest_node_by_status(
    nodes: Sequence[Mapping[str, Any]],
    statuses: set[str],
) -> dict[str, Any] | None:
    wanted = {status.strip().lower() for status in statuses}
    for node in reversed(list(nodes)):
        if str(node.get("status") or "").strip().lower() in wanted:
            return _node_brief(node)
    return None


def _node_output_payload(node: Mapping[str, Any]) -> dict[str, Any] | None:
    status = str(node.get("status") or "").strip().lower()
    if status != "completed":
        return None
    brief = _node_brief(node)
    if not brief["result_summary"] and not brief["result_ref"]:
        return None
    return {key: value for key, value in brief.items() if value not in {"", None}}


def _node_error_payload(node: Mapping[str, Any]) -> dict[str, Any] | None:
    status = str(node.get("status") or "").strip().lower()
    if status not in {"failed", "cancelled"}:
        return None
    brief = _node_brief(node)
    reason = brief.get("last_error") or brief.get("result_summary") or status
    payload = {key: value for key, value in brief.items() if value not in {"", None}}
    payload["reason"] = reason
    return payload


def _run_result_payload_from_session(
    session: Mapping[str, Any],
    *,
    nodes: Sequence[Mapping[str, Any]],
    created_documents: Sequence[Mapping[str, Any]],
    answer_payload: Mapping[str, str],
) -> dict[str, Any] | None:
    status = str(session.get("status") or "").strip().lower()
    if status not in {"completed", "cancelled"}:
        return None
    payload: dict[str, Any] = {
        "agentic_session_id": session.get("id"),
        "session_status": status,
    }
    primary_result = str(answer_payload.get("primary_result") or "").strip()
    answer_summary = str(answer_payload.get("mission_answer_summary") or "").strip()
    if primary_result:
        payload["primary_result"] = primary_result
    if answer_summary:
        payload["mission_answer_summary"] = answer_summary
    if created_documents:
        payload["created_documents"] = [dict(doc) for doc in created_documents]
    latest_completed = _latest_node_by_status(nodes, {"completed"})
    if latest_completed:
        payload["latest_completed_node"] = latest_completed
    return payload


def _run_error_payload_from_session(
    session: Mapping[str, Any],
    *,
    nodes: Sequence[Mapping[str, Any]],
) -> dict[str, Any] | None:
    status = str(session.get("status") or "").strip().lower()
    if status not in {"failed", "abandoned"}:
        return None
    wm = session.get("working_memory_json")
    working_memory = dict(wm) if isinstance(wm, Mapping) else {}
    latest_failed = _latest_node_by_status(nodes, {"failed", "cancelled"})
    reason = (
        _compact_text(working_memory.get("terminate_reason"), limit=1200)
        or str((latest_failed or {}).get("reason") or "").strip()
        or str((latest_failed or {}).get("last_error") or "").strip()
        or status
    )
    payload: dict[str, Any] = {
        "agentic_session_id": session.get("id"),
        "session_status": status,
        "reason": reason,
    }
    terminate_reason = _compact_text(working_memory.get("terminate_reason"), limit=1200)
    if terminate_reason:
        payload["terminate_reason"] = terminate_reason
    if latest_failed:
        payload["latest_failed_node"] = latest_failed
    return payload


def created_documents_from_gate_checkpoints(
    checkpoints: Sequence[Mapping[str, Any]],
) -> list[dict[str, str]]:
    """Collect unique created documents for Operations panel artifact links.

    Sources: HITL gate finalize events and successful file_create/file_save_text act rows
    (including auto-accept creates that never emit a gate).
    """

    ordered: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    for row in checkpoints:
        kind = str(row.get("kind") or "").strip()
        payload = row.get("payload_json")
        if not isinstance(payload, Mapping):
            continue
        content_id = ""
        name = ""
        if kind == "gate":
            if str(payload.get("event") or "") != "hitl_companion_finalize":
                continue
            if str(payload.get("decision") or "") != "confirm":
                continue
            content_id = str(payload.get("created_unified_content_id") or "").strip()
            name = _document_name_from_gate_summary(str(payload.get("summary") or ""))
        elif kind == "act":
            tool = str(payload.get("tool") or payload.get("tool_name") or "").strip()
            if tool not in {"file_create", "file_save_text"}:
                continue
            status = str(payload.get("status") or "").strip().lower()
            if status not in {"ok", "memory_append"}:
                continue
            content_id = str(
                payload.get("created_unified_content_id") or payload.get("unified_content_id") or ""
            ).strip()
            name = str(payload.get("document_name") or "").strip() or _document_name_from_gate_summary(
                str(payload.get("summary") or "")
            )
        else:
            continue
        if not content_id or content_id in seen_ids:
            continue
        seen_ids.add(content_id)
        ordered.append(
            {
                "unified_content_id": content_id,
                "name": name or content_id,
            }
        )
    return ordered


async def _mirror_created_documents(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
) -> list[dict[str, str]]:
    session_id = str(session.get("id") or "").strip()
    if not session_id:
        return []
    checkpoints = await agentic_pg.agentic_checkpoint_list_recent(
        pool,
        session_id=session_id,
        limit=100,
        kinds=["gate", "act"],
    )
    docs = created_documents_from_gate_checkpoints(checkpoints)
    if docs:
        return docs
    policy = session.get("policy_json")
    if isinstance(policy, Mapping):
        fallback_id = str(policy.get("unified_content_id") or "").strip()
        if fallback_id:
            return [{"unified_content_id": fallback_id, "name": fallback_id}]
    return []


async def create_task_run_mirror(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    session: Mapping[str, Any],
    user_message: str,
) -> dict[str, Any]:
    goal = session.get("goal_json")
    plan_payload: dict[str, Any] = {
        "agentic_session_id": session.get("id"),
        "kind": "agentic_session_v1",
    }
    if isinstance(goal, Mapping):
        plan_payload["goal"] = dict(goal)

    run = await companion_pg.companion_task_run_create(
        pool,
        principal_id=principal_id,
        intent_kind="agentic_session",
        user_message=user_message[:12000],
        plan_payload=plan_payload,
        status=_AGENTIC_STATUS_TO_RUN.get(str(session.get("status") or ""), "pending"),
        execution_mode="async",
    )
    session_id = str(session.get("id") or "")
    await agentic_pg.agentic_session_update(
        pool,
        session_id=session_id,
        principal_id=principal_id,
        linked_task_run_id=str(run["id"]),
        expect_revision=int(session.get("session_revision") or 1),
    )
    return run


async def sync_task_run_from_session(
    pool: asyncpg.Pool,
    *,
    session: Mapping[str, Any],
) -> dict[str, Any] | None:
    started = time.perf_counter()
    run_id = str(session.get("linked_task_run_id") or "").strip()
    if not run_id:
        return None
    principal_id = str(session.get("principal_id") or "")
    status = _AGENTIC_STATUS_TO_RUN.get(str(session.get("status") or ""), "running")
    confirmation_state: dict[str, Any] = {}
    if status == "awaiting_confirmation":
        gate = session.get("gate_json")
        if isinstance(gate, Mapping):
            confirmation_state = {"state": "confirming", "gate": dict(gate)}

    nodes = await agentic_pg.agentic_task_tree_list(pool, session_id=str(session.get("id") or ""))
    created_documents = await _mirror_created_documents(pool, session=session)
    answer_payload = mission_answer_payload_from_session(session, nodes=nodes)
    plan_payload: dict[str, Any] = {
        "agentic_session_id": session.get("id"),
        "kind": "agentic_session_v1",
        "session_status": session.get("status"),
        "mission_display_state": _agentic_session_display_state(str(session.get("status") or "")),
        "plan_summary": session.get("plan_summary"),
        **answer_payload,
    }
    if len(nodes) > 50:
        plan_payload["step_mirror_truncated_count"] = len(nodes) - 50
    if created_documents:
        plan_payload["created_documents"] = created_documents

    result_payload = _run_result_payload_from_session(
        session,
        nodes=nodes,
        created_documents=created_documents,
        answer_payload=answer_payload,
    )
    error_payload = _run_error_payload_from_session(session, nodes=nodes)

    step_mirrors: list[dict[str, Any]] = []
    for idx, node in enumerate(nodes[:50]):
        node_id = str(node.get("id") or "").strip()
        step_mirrors.append(
            {
                "node_id": node_id,
                "step_index": idx,
                "title": str(node.get("title") or f"Step {idx + 1}"),
                "status": _companion_step_status_from_node_status(str(node.get("status") or "")),
                "input_payload": _node_input_payload(node),
                "output_payload": _node_output_payload(node),
                "error_payload": _node_error_payload(node),
            }
        )

    updated = await companion_pg.companion_task_run_mirror_sync(
        pool,
        run_id=run_id,
        principal_id=principal_id,
        status=status,
        confirmation_state=confirmation_state,
        plan_payload=plan_payload,
        result_payload=result_payload,
        error_payload=error_payload,
        step_mirrors=step_mirrors,
    )
    if updated is None:
        return None
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    logger.info(
        "[STEP] agentic_mirror_sync run_id=%s session_id=%s elapsed_ms=%s nodes=%s",
        run_id,
        session.get("id"),
        elapsed_ms,
        len(nodes),
    )
    return updated
