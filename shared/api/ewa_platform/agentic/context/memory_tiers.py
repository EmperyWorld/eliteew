# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Hot tier working_memory_json.active_slice — ring buffer of recent act summaries for Think prompt.
# Invariants:
# - read_active_slice always returns ActiveSlice with required last_condense_seq (default 0).
# - Every ActSummaryEntry from read_active_slice has required tool/status/summary (safe normalize).
# - Goal and plan_summary live outside active_slice; ring capped by EWA_AGENTIC_HOT_MEMORY_RING_SIZE.
# Related:
# - api/ewa_platform/agentic/kernel/prompt_builder.py
# - api/ewa_platform/agentic/kernel/loop.py
# - api/ewa_platform/persistence_pg/agentic_asyncpg.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, NotRequired, TypedDict

from api.ewa_platform.agentic.config import agentic_hot_memory_ring_size
from api.ewa_platform.agentic.kernel.circuit_breaker import working_memory_from_session

WM_ACTIVE_SLICE = "active_slice"

_EMPTY_TOOL = "-"
_EMPTY_STATUS = "-"


class ActSummaryEntry(TypedDict):
    """Normalized act ring entry; tool/status/summary always present after normalize."""

    tool: str
    status: str
    summary: str
    node_id: NotRequired[str | None]


class ActiveSlice(TypedDict):
    """Normalized hot-tier slice; last_condense_seq is always present after read_active_slice."""

    last_condense_seq: int
    last_act_summaries: NotRequired[list[ActSummaryEntry]]
    active_node_id: NotRequired[str | None]
    active_instruction: NotRequired[str | None]


def _coerce_nonneg_int(value: object, *, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return max(0, int(value))
    except TypeError, ValueError:
        return default


def _coerce_optional_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_act_summary_entry(raw: object) -> ActSummaryEntry | None:
    """Parse one ring entry from JSONB; missing keys become safe defaults — never KeyError."""

    if not isinstance(raw, Mapping):
        return None

    tool = str(raw.get("tool") or _EMPTY_TOOL).strip() or _EMPTY_TOOL
    status = str(raw.get("status") or _EMPTY_STATUS).strip() or _EMPTY_STATUS
    summary = str(raw.get("summary") or "")[:4000]

    entry: ActSummaryEntry = {
        "tool": tool,
        "status": status,
        "summary": summary,
    }
    node_id = _coerce_optional_str(raw.get("node_id"))
    if node_id is not None:
        entry["node_id"] = node_id
    return entry


def _new_act_summary_entry(
    *,
    tool_name: str,
    status: str,
    summary: str,
    node_id: str | None,
) -> ActSummaryEntry:
    tool = tool_name.strip() or _EMPTY_TOOL
    st = status.strip() or _EMPTY_STATUS
    entry: ActSummaryEntry = {
        "tool": tool,
        "status": st,
        "summary": summary[:4000],
    }
    if node_id is not None:
        cleaned = node_id.strip()
        if cleaned:
            entry["node_id"] = cleaned
    return entry


def _act_summary_entry_to_storage(entry: ActSummaryEntry) -> dict[str, Any]:
    stored: dict[str, Any] = {
        "tool": entry["tool"],
        "status": entry["status"],
        "summary": entry["summary"],
    }
    if "node_id" in entry and entry["node_id"] is not None:
        stored["node_id"] = entry["node_id"]
    return stored


def _empty_active_slice() -> ActiveSlice:
    return ActiveSlice(
        last_condense_seq=0,
        last_act_summaries=[],
        active_node_id=None,
        active_instruction=None,
    )


def _copy_active_slice_fields(*, source: ActiveSlice, target: ActiveSlice) -> None:
    if "last_act_summaries" in source:
        target["last_act_summaries"] = list(source["last_act_summaries"])
    if "active_node_id" in source:
        target["active_node_id"] = source["active_node_id"]
    if "active_instruction" in source:
        target["active_instruction"] = source["active_instruction"]


def read_active_slice(working_memory: Mapping[str, Any] | None) -> ActiveSlice:
    """Parse active_slice from working_memory_json; never omits last_condense_seq."""

    if not isinstance(working_memory, Mapping):
        return _empty_active_slice()

    raw = working_memory.get(WM_ACTIVE_SLICE)
    if not isinstance(raw, Mapping):
        return _empty_active_slice()

    summaries_raw = raw.get("last_act_summaries")
    summaries: list[ActSummaryEntry] = []
    if isinstance(summaries_raw, list):
        for item in summaries_raw:
            normalized = _normalize_act_summary_entry(item)
            if normalized is not None:
                summaries.append(normalized)

    cap = agentic_hot_memory_ring_size()
    return ActiveSlice(
        last_condense_seq=_coerce_nonneg_int(raw.get("last_condense_seq"), default=0),
        last_act_summaries=summaries[-cap:],
        active_node_id=_coerce_optional_str(raw.get("active_node_id")),
        active_instruction=_coerce_optional_str(raw.get("active_instruction")),
    )


def read_active_slice_from_session(session: Mapping[str, Any]) -> ActiveSlice:
    return read_active_slice(working_memory_from_session(session))


def active_slice_to_storage(active_slice: ActiveSlice) -> dict[str, Any]:
    """Serialize ActiveSlice for working_memory_json.active_slice JSONB."""

    stored: dict[str, Any] = {"last_condense_seq": active_slice["last_condense_seq"]}
    if "last_act_summaries" in active_slice:
        stored["last_act_summaries"] = [
            _act_summary_entry_to_storage(entry) for entry in active_slice["last_act_summaries"]
        ]
    if "active_node_id" in active_slice:
        stored["active_node_id"] = active_slice["active_node_id"]
    if "active_instruction" in active_slice:
        stored["active_instruction"] = active_slice["active_instruction"]
    return stored


def format_hot_memory_section(active_slice: ActiveSlice) -> str | None:
    """Render hot tier for Think user blob; None when empty."""

    lines: list[str] = []
    for entry in active_slice.get("last_act_summaries") or []:
        tool = entry["tool"]
        status = entry["status"]
        summary = entry["summary"][:300]
        node_id = entry.get("node_id")
        suffix = f" node={node_id}" if node_id else ""
        lines.append(f"- tool={tool} status={status}{suffix}: {summary}")

    instruction = active_slice.get("active_instruction")
    if instruction:
        lines.append(f"Active instruction: {instruction[:500]}")

    node_id = active_slice.get("active_node_id")
    if node_id and not instruction:
        lines.append(f"Active node id: {node_id}")

    if not lines:
        return None
    return "\n".join(lines)


def push_act_summary(
    working_memory: Mapping[str, Any],
    *,
    tool_name: str,
    status: str,
    summary: str,
    node_id: str | None,
    ring_size: int | None = None,
) -> dict[str, Any]:
    """Append act outcome to hot-tier ring; returns full working_memory_json dict."""

    cap = ring_size if ring_size is not None else agentic_hot_memory_ring_size()
    wm = dict(working_memory)
    normalized = read_active_slice(wm)
    summaries = list(normalized.get("last_act_summaries") or [])
    summaries.append(
        _new_act_summary_entry(
            tool_name=tool_name,
            status=status,
            summary=summary,
            node_id=node_id,
        )
    )
    updated: ActiveSlice = ActiveSlice(
        last_condense_seq=normalized["last_condense_seq"],
        last_act_summaries=summaries[-cap:],
    )
    if node_id is not None and node_id.strip():
        updated["active_node_id"] = node_id.strip()
    instruction = normalized.get("active_instruction")
    if instruction:
        updated["active_instruction"] = instruction
    wm[WM_ACTIVE_SLICE] = active_slice_to_storage(updated)
    return wm


def sync_active_instruction_from_nodes(
    working_memory: Mapping[str, Any],
    active_nodes: list[Mapping[str, Any]],
) -> dict[str, Any]:
    """Refresh active_node_id/instruction from the first pending task-tree node."""

    wm = dict(working_memory)
    normalized = read_active_slice(wm)
    updated: ActiveSlice = ActiveSlice(
        last_condense_seq=normalized["last_condense_seq"],
    )
    _copy_active_slice_fields(source=normalized, target=updated)

    pending = [n for n in active_nodes if str(n.get("status") or "") == "pending"]
    if pending:
        node = pending[0]
        node_id = node.get("id")
        updated["active_node_id"] = str(node_id) if node_id is not None else None
        instruction = str(node.get("instruction") or node.get("title") or "").strip()
        updated["active_instruction"] = instruction[:8000] if instruction else None

    wm[WM_ACTIVE_SLICE] = active_slice_to_storage(updated)
    return wm


def patch_last_condense_seq(working_memory: Mapping[str, Any], seq: int) -> dict[str, Any]:
    """Set active_slice.last_condense_seq; returns full working_memory_json dict."""

    wm = dict(working_memory)
    normalized = read_active_slice(wm)
    updated: ActiveSlice = ActiveSlice(
        last_condense_seq=max(0, int(seq)),
    )
    _copy_active_slice_fields(source=normalized, target=updated)
    wm[WM_ACTIVE_SLICE] = active_slice_to_storage(updated)
    return wm
