# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Authoritative task-tree scheduler: pick next runnable node for Think/Act binding.
# Invariants:
# - running nodes take precedence; pending nodes ordered by sort_order then path.
# Related:
# - api/ewa_platform/agentic/kernel/rehydrate.py
# - api/ewa_platform/agentic/kernel/loop.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

_RUNNABLE_STATUSES = ("pending", "claimed", "running", "retry_wait")


def select_next_runnable_node(nodes: list[Mapping[str, Any]]) -> dict[str, Any] | None:
    """Pick the node the loop should bind for the next act step."""

    runnable = [n for n in nodes if str(n.get("status") or "") in _RUNNABLE_STATUSES]
    if not runnable:
        return None

    running = [n for n in runnable if str(n.get("status") or "") in {"claimed", "running"}]
    if running:
        return dict(running[0])

    pending = sorted(
        [n for n in runnable if str(n.get("status") or "") in {"pending", "retry_wait"}],
        key=lambda n: (
            -int(n.get("priority") or 0),
            int(n.get("sort_order") or 0),
            str(n.get("materialized_path") or ""),
            str(n.get("id") or ""),
        ),
    )
    return dict(pending[0]) if pending else None


def scheduler_hint_line(node: Mapping[str, Any] | None) -> str:
    if node is None:
        return "No scheduled node — LLM may plan or act freely."
    return (
        f"Scheduled next node: id={node.get('id')} status={node.get('status')} "
        f"title={node.get('title')} tool={node.get('tool_name') or '-'}"
    )


async def mark_node_running(
    pool: Any,
    *,
    session_id: str,
    node_id: str,
) -> dict[str, Any] | None:
    return await agentic_pg.agentic_task_tree_update(
        pool,
        node_id=node_id,
        session_id=session_id,
        status="running",
        mark_started=True,
    )


def resolve_act_binding(
    think_node_id: str | None,
    think_tool_name: str | None,
    think_tool_args: dict[str, Any] | None,
    scheduled_node: Mapping[str, Any] | None,
) -> tuple[str | None, str, dict[str, Any]]:
    """Merge Think output with scheduler authoritative node when act_node_id omitted."""

    args = dict(think_tool_args or {})
    tool_name = str(think_tool_name or "").strip()
    node_id = think_node_id

    if node_id is None and scheduled_node is not None:
        node_id = str(scheduled_node.get("id") or "") or None
        if not tool_name:
            tool_name = str(scheduled_node.get("tool_name") or "").strip()
        node_args = scheduled_node.get("tool_args_json")
        if isinstance(node_args, Mapping):
            for key, val in node_args.items():
                args.setdefault(str(key), val)

    return node_id, tool_name, args
