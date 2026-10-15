# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 3.5b — hot tier active_slice ring buffer and Think prompt injection.
# Related:
# - api/ewa_platform/agentic/context/memory_tiers.py
# - api/ewa_platform/agentic/kernel/prompt_builder.py
# ---

from __future__ import annotations

from typing import Any

from api.ewa_platform.agentic.context.memory_tiers import (
    WM_ACTIVE_SLICE,
    format_hot_memory_section,
    push_act_summary,
    read_active_slice,
    sync_active_instruction_from_nodes,
)
from api.ewa_platform.agentic.kernel.context_budget import trim_prompt_sections
from api.ewa_platform.agentic.kernel.prompt_builder import (
    MARKER_CHECKPOINTS,
    MARKER_HOT_MEMORY,
    ThinkPromptBuilder,
)
from api.ewa_platform.agentic.kernel.types import AgenticContext


def _ctx_with_wm(
    *,
    wm: dict[str, Any] | None = None,
    checkpoints: list[dict[str, Any]] | None = None,
    active_nodes: list[dict[str, Any]] | None = None,
) -> AgenticContext:
    return AgenticContext(
        session={
            "id": "sess-hot-1",
            "principal_id": "p-1",
            "status": "executing",
            "session_revision": 3,
            "goal_json": {"text": "Summarize latest research"},
            "plan_summary": "Search then summarize",
            "working_memory_json": wm or {},
            "policy_json": {},
        },
        active_nodes=active_nodes
        or [
            {
                "id": "node-pending-1",
                "node_kind": "tool",
                "status": "pending",
                "title": "Fetch papers",
                "instruction": "Use catalog search for quantum papers",
                "tool_name": "catalog_list",
            }
        ],
        tree_summary={"pending": 1},
        checkpoints=checkpoints or [],
        inbound_messages=[],
        llm_messages=[],
    )


def test_read_active_slice_missing_key_returns_required_last_condense_seq() -> None:
    wm = {"replanning_count": 2, "active_slice": {"last_act_summaries": []}}
    active = read_active_slice(wm)
    assert active["last_condense_seq"] == 0
    assert wm["replanning_count"] == 2


def test_read_active_slice_normalizes_partial_act_entries_without_keyerror() -> None:
    """Corrupt ring entries must normalize — never KeyError on missing tool/status/summary."""

    wm = {
        "active_slice": {
            "last_condense_seq": 2,
            "last_act_summaries": [
                {"tool": "search"},
                "not-a-mapping",
                {"status": "ok"},
                {"tool": "catalog_list", "status": "ok", "summary": "found 5 items"},
                None,
            ],
        }
    }
    active = read_active_slice(wm)
    summaries = active.get("last_act_summaries") or []
    assert len(summaries) == 3
    assert summaries[0]["tool"] == "search"
    assert summaries[0]["status"] == "-"
    assert summaries[0]["summary"] == ""
    assert summaries[1]["tool"] == "-"
    assert summaries[1]["status"] == "ok"
    assert summaries[2]["summary"] == "found 5 items"


def test_format_hot_memory_survives_corrupt_act_entries() -> None:
    wm = {
        "active_slice": {
            "last_condense_seq": 0,
            "last_act_summaries": [{"status": "error"}, {"tool": "rerank"}],
        }
    }
    blob = format_hot_memory_section(read_active_slice(wm))
    assert blob is not None
    assert "tool=-" in blob
    assert "status=error" in blob
    assert "tool=rerank" in blob


def test_push_act_summary_after_corrupt_history_preserves_condense_seq() -> None:
    wm = {"active_slice": {"last_condense_seq": 9, "last_act_summaries": [{}]}}
    updated = push_act_summary(
        wm,
        tool_name="fresh_tool",
        status="ok",
        summary="recovered",
        node_id="node-z",
    )
    active = read_active_slice(updated)
    assert active["last_condense_seq"] == 9
    summaries = active.get("last_act_summaries") or []
    assert summaries[-1]["tool"] == "fresh_tool"
    assert summaries[-1]["summary"] == "recovered"


def test_ring_buffer_keeps_last_three_acts() -> None:
    wm: dict[str, Any] = {"replanning_count": 1}
    for idx in range(5):
        wm = push_act_summary(
            wm,
            tool_name=f"tool_{idx}",
            status="ok",
            summary=f"result-{idx}",
            node_id=f"node-{idx}",
            ring_size=3,
        )

    active = read_active_slice(wm)
    summaries = active.get("last_act_summaries") or []
    assert len(summaries) == 3
    assert [s["tool"] for s in summaries] == ["tool_2", "tool_3", "tool_4"]
    assert wm["replanning_count"] == 1
    assert active["last_condense_seq"] == 0


def test_push_act_summary_preserves_last_condense_seq() -> None:
    wm = {"active_slice": {"last_condense_seq": 7, "last_act_summaries": []}}
    updated = push_act_summary(
        wm,
        tool_name="search",
        status="ok",
        summary="done",
        node_id="n1",
    )
    assert read_active_slice(updated)["last_condense_seq"] == 7
    assert WM_ACTIVE_SLICE in updated
    assert updated[WM_ACTIVE_SLICE]["last_condense_seq"] == 7


def test_format_hot_memory_includes_instruction_and_acts() -> None:
    wm = push_act_summary(
        {},
        tool_name="catalog_list",
        status="ok",
        summary="Found 12 items",
        node_id="node-1",
    )
    wm = sync_active_instruction_from_nodes(
        wm,
        [{"id": "node-2", "status": "pending", "instruction": "Summarize top 3"}],
    )
    blob = format_hot_memory_section(read_active_slice(wm))
    assert blob is not None
    assert "tool=catalog_list status=ok" in blob
    assert "Active instruction: Summarize top 3" in blob


def test_prompt_injects_hot_memory_before_cold_checkpoints() -> None:
    wm = push_act_summary(
        {},
        tool_name="search",
        status="ok",
        summary="HOT_TIER_MARKER: cached act outcome",
        node_id="n1",
    )
    cold = [{"kind": "act", "payload_json": {"tool": "old", "status": "ok", "summary": "COLD_ONLY"}}]
    ctx = _ctx_with_wm(wm=wm, checkpoints=cold)
    prompt = ThinkPromptBuilder.build(ctx, system_content="sys")
    user_blob = prompt.sections.to_user_blob()

    hot_pos = user_blob.index(MARKER_HOT_MEMORY)
    cold_pos = user_blob.index(MARKER_CHECKPOINTS)
    assert hot_pos < cold_pos
    assert "HOT_TIER_MARKER" in user_blob
    assert "COLD_ONLY" in user_blob


def test_rehydrate_hot_memory_without_checkpoint_replay() -> None:
    """Hot tier from working_memory_json surfaces even when checkpoint window is empty."""

    wm = {
        WM_ACTIVE_SLICE: {
            "last_act_summaries": [
                {"tool": "rerank", "status": "ok", "summary": "ranked 5 docs", "node_id": "n9"},
            ],
            "active_instruction": "Write executive summary",
        }
    }
    ctx = _ctx_with_wm(wm=wm, checkpoints=[])
    prompt = ThinkPromptBuilder.build(ctx, system_content="sys")
    user_blob = prompt.sections.to_user_blob()

    assert MARKER_HOT_MEMORY in user_blob
    assert "ranked 5 docs" in user_blob
    assert MARKER_CHECKPOINTS not in user_blob


def test_trim_preserves_hot_memory_under_pressure() -> None:
    goal = "KEEP_GOAL"
    hot = "- tool=t status=ok: recent\nActive instruction: do next step"
    tree = "- id=n1 status=pending title=Step"
    huge_cold = "\n".join(f"[act] line={i} " + ("x" * 200) for i in range(80))

    sections = ThinkPromptBuilder.build(
        _ctx_with_wm(
            wm=push_act_summary({}, tool_name="t", status="ok", summary="recent", node_id="n1"),
            checkpoints=[{"kind": "act", "payload_json": {"summary": huge_cold}}],
        ),
        system_content="sys",
    ).sections
    sections = sections.__class__(
        session_status=sections.session_status,
        goal=goal,
        active_task_tree=tree,
        plan_summary="warm " * 500,
        hot_memory=hot,
        checkpoints=huge_cold,
        steering_blocks=[],
    )

    trimmed, meta = trim_prompt_sections(sections, max_user_utf8=2048)
    blob = trimmed.to_user_blob()
    assert goal in blob
    assert hot.splitlines()[0] in blob
    assert tree in blob
    assert "hot_memory" in meta["preserved"]
