# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 3.5a — behavioral tests for section-aware trim, type safety, and fail-closed loop paths.
# Related:
# - api/ewa_platform/agentic/kernel/context_budget.py
# - api/ewa_platform/agentic/kernel/prompt_builder.py
# - api/ewa_platform/agentic/kernel/loop.py
# ---

from __future__ import annotations

from typing import Any

import pytest

from api.ewa_platform.agentic.context.memory_tiers import (
    read_active_slice,
    read_active_slice_from_session,
)
from api.ewa_platform.agentic.kernel.context_budget import (
    TrimMessagesMeta,
    TrimSectionsMeta,
    estimate_messages_utf8,
    trim_formatted_prompt,
    trim_prompt_sections,
    trim_think_messages_to_budget,
)
from api.ewa_platform.agentic.kernel.engine import assemble_think_messages
from api.ewa_platform.agentic.kernel.loop import _process_think_output
from api.ewa_platform.agentic.kernel.prompt_builder import (
    MARKER_ACTIVE_TASK_TREE,
    MARKER_GOAL,
    ThinkPromptBuilder,
    ThinkPromptSections,
)
from api.ewa_platform.agentic.kernel.think_command_v1 import AgenticStructuredThinkOutput
from api.ewa_platform.agentic.kernel.types import AgenticContext, AgenticLoopError


def _utf8_len(text: str) -> int:
    return len(text.encode("utf-8"))


def _ctx(
    *,
    goal: str = "Find quantum computing papers",
    status: str = "executing",
    plan_summary: str = "",
    working_memory_json: dict[str, Any] | None = None,
    active_nodes: list[dict[str, Any]] | None = None,
    checkpoints: list[dict[str, Any]] | None = None,
) -> AgenticContext:
    session: dict[str, Any] = {
        "id": "sess-ctx-1",
        "principal_id": "p-1",
        "status": status,
        "session_revision": 1,
        "goal_json": {"text": goal},
        "plan_summary": plan_summary,
        "policy_json": {},
    }
    if working_memory_json is not None:
        session["working_memory_json"] = working_memory_json
    return AgenticContext(
        session=session,
        active_nodes=active_nodes or [],
        tree_summary={"pending": 1},
        checkpoints=checkpoints or [],
        inbound_messages=[],
        llm_messages=[],
    )


def _assert_preserved(meta: TrimSectionsMeta | TrimMessagesMeta) -> None:
    preserved = meta.get("preserved")
    assert isinstance(preserved, list)
    assert preserved == [
        "session_status",
        "mission_anchor",
        "goal",
        "companion_grounding",
        "hot_memory",
        "active_task_tree",
    ]


def test_trim_preserves_goal_and_active_task_under_pressure() -> None:
    """Boundary: huge cold/warm tiers drop first; Goal + pending node stay verbatim."""

    goal = "IMMUTABLE_GOAL_MARKER: research quantum entanglement"
    tree = "- id=node-1 kind=tool status=pending title=Search catalog tool=catalog_list"
    sections = ThinkPromptSections(
        session_status="executing",
        goal=goal,
        active_task_tree=tree,
        plan_summary="W" * 80_000,
        checkpoints="\n".join(f"[act] step={i}" for i in range(500)),
    )
    cap = 4000
    trimmed, meta = trim_prompt_sections(sections, max_user_utf8=cap)

    blob = trimmed.to_user_blob()
    assert goal in blob
    assert tree in blob
    assert MARKER_GOAL in blob
    assert MARKER_ACTIVE_TASK_TREE in blob
    assert meta["truncated"] is True
    _assert_preserved(meta)
    assert meta["sections_trimmed"]
    assert _utf8_len(blob) <= cap or meta["protected_only"] is True


def test_boundary_violation_10x_over_budget() -> None:
    """Input ~10× budget: output must fit cap; protected sections survive."""

    cap = 8000
    goal = "BOUNDARY_GOAL_KEEP"
    tree = "- id=boundary-1 kind=tool status=pending title=Run tool=catalog_list"
    huge = "x" * (cap * 10)
    messages = [
        {"role": "system", "content": "sys" * 2000},
        {
            "role": "user",
            "content": (
                f"Session status: executing\n\nGoal: {goal}\n\n"
                f"Active task tree:\n{tree}\n\nPlan summary: {huge}\n\n"
                f"Recent checkpoints:\n" + "\n".join(f"[act] line={i}" for i in range(2000))
            ),
        },
    ]
    original = estimate_messages_utf8(messages)
    assert original > cap * 5

    trimmed, meta = trim_think_messages_to_budget(messages, max_utf8=cap)
    final = int(meta["final_utf8"])
    user = trimmed[-1]["content"]

    assert meta["truncated"] is True
    assert final <= cap
    assert goal in user
    assert tree in user
    _assert_preserved(meta)


def test_type_mismatch_tool_args_raises_value_error_at_l3() -> None:
    """L3 validate_tool_args rejects wrong types with ValueError — not AttributeError."""

    cmd = AgenticStructuredThinkOutput.model_validate(
        {
            "reasoning_trace": "bad types",
            "decision_type": "continue",
            "payload": {
                "decision_type": "continue",
                "tool_name": "catalog_list",
                "tool_args": {"user_line": 12345, "mode": "search"},
            },
            "plan_update_summary": "",
        }
    )
    with pytest.raises(ValueError, match="user_line") as exc:
        cmd.validate_tool_args()
    assert "AttributeError" not in str(exc.value)


def test_trim_order_checkpoints_before_plan_summary() -> None:
    sections = ThinkPromptSections(
        session_status="executing",
        goal="g",
        active_task_tree="- id=1 kind=subtask status=pending title=x tool=-",
        plan_summary="PLAN_" + ("p" * 4000),
        checkpoints="[act] old\n[act] newer\n[act] newest",
    )
    trimmed, meta = trim_prompt_sections(sections, max_user_utf8=800)
    assert meta["truncated"] is True
    assert "checkpoints" in meta["sections_trimmed"]
    blob = trimmed.to_user_blob()
    assert "Goal: g" in blob
    assert "- id=1" in blob


def test_prompt_builder_emits_canonical_section_markers() -> None:
    ctx = _ctx(
        goal="Analyze sales",
        plan_summary="Step 1 done",
        active_nodes=[
            {
                "id": "n-1",
                "node_kind": "tool",
                "status": "pending",
                "title": "Fetch data",
                "tool_name": "catalog_list",
            }
        ],
    )
    formatted = ThinkPromptBuilder.build(ctx, system_content="system rules")
    blob = formatted.sections.to_user_blob()
    assert "Session status: executing" in blob
    assert "Goal: Analyze sales" in blob
    assert "Active task tree:" in blob
    assert "id=n-1" in blob
    assert "Plan summary: Step 1 done" in blob


def test_assemble_think_messages_trims_without_dropping_goal(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_AGENTIC_THINK_CONTEXT_MAX_UTF8", "48000")
    ctx = _ctx(
        goal="PROTECTED_GOAL_XYZ",
        plan_summary="x" * 50_000,
        active_nodes=[
            {
                "id": "active-node-99",
                "node_kind": "tool",
                "status": "pending",
                "title": "Run query",
                "tool_name": "catalog_list",
            }
        ],
        checkpoints=[
            {
                "kind": "act",
                "payload_json": {"tool": "catalog_list", "status": "ok", "summary": "y" * 200},
            }
            for _ in range(40)
        ],
    )
    messages = assemble_think_messages(ctx)
    user = messages[-1]["content"]
    assert "PROTECTED_GOAL_XYZ" in user
    assert "active-node-99" in user
    assert estimate_messages_utf8(messages) <= 48_000 + 512


@pytest.mark.asyncio
async def test_process_think_output_rejects_non_agentic_think_output() -> None:
    """Invalid think object must raise AgenticLoopError — never AttributeError on .action."""

    session = {
        "id": "sess-1",
        "principal_id": "p-1",
        "status": "executing",
        "session_revision": 1,
    }
    with pytest.raises(AgenticLoopError, match="think_output_invalid_type"):
        await _process_think_output(
            pool=object(),  # type: ignore[arg-type]
            think_out=object(),  # type: ignore[arg-type]
            session=session,
            session_id="sess-1",
            principal_id="p-1",
            tool_ctx=None,
            iterations=1,
        )


@pytest.mark.asyncio
async def test_process_think_gate_action_requires_payload() -> None:
    from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput

    session = {
        "id": "sess-1",
        "principal_id": "p-1",
        "status": "executing",
        "session_revision": 1,
    }
    with pytest.raises(AgenticLoopError, match="gate_action_missing_payload"):
        await _process_think_output(
            pool=object(),  # type: ignore[arg-type]
            think_out=AgenticThinkOutput(action="gate", rationale="need human", gate=None),
            session=session,
            session_id="sess-1",
            principal_id="p-1",
            tool_ctx=None,
            iterations=1,
        )


def test_trim_formatted_prompt_meta_is_typed() -> None:
    ctx = _ctx(goal="goal-a", plan_summary="z" * 20_000)
    formatted = ThinkPromptBuilder.build(ctx, system_content="s" * 5000)
    _trimmed, meta = trim_formatted_prompt(formatted, max_utf8=6000)
    assert meta["truncated"] is True
    _assert_preserved(meta)
    assert isinstance(meta["final_utf8"], int)
    assert meta["final_utf8"] <= 6000


def test_read_active_slice_missing_last_condense_seq_defaults_to_zero() -> None:
    """Corrupt/partial WM must not KeyError — last_condense_seq normalized to 0."""

    assert read_active_slice(None)["last_condense_seq"] == 0
    assert read_active_slice({})["last_condense_seq"] == 0
    assert read_active_slice({"active_slice": {}})["last_condense_seq"] == 0
    assert read_active_slice({"active_slice": {"last_act_summaries": []}})["last_condense_seq"] == 0


def test_read_active_slice_invalid_last_condense_seq_coerced() -> None:
    wm = {"active_slice": {"last_condense_seq": "bad-type", "last_act_summaries": []}}
    assert read_active_slice(wm)["last_condense_seq"] == 0

    wm_neg = {"active_slice": {"last_condense_seq": -3}}
    assert read_active_slice(wm_neg)["last_condense_seq"] == 0


def test_prompt_builder_survives_missing_last_condense_seq_in_session() -> None:
    """Think prompt assembly must not crash when WM lacks last_condense_seq."""

    ctx = _ctx(
        goal="DURABLE_GOAL_MARKER",
        working_memory_json={"active_slice": {"last_act_summaries": []}},
        active_nodes=[
            {
                "id": "n-missing-seq",
                "node_kind": "tool",
                "status": "pending",
                "title": "Continue work",
                "tool_name": "catalog_list",
            }
        ],
    )
    formatted = ThinkPromptBuilder.build(ctx, system_content="system")
    blob = formatted.sections.to_user_blob()
    assert "DURABLE_GOAL_MARKER" in blob
    assert "n-missing-seq" in blob
    assert read_active_slice_from_session(ctx.session)["last_condense_seq"] == 0
