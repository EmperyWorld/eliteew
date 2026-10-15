# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build structured Think prompt sections from AgenticContext — decoupled from budget trim.
# Invariants:
# - Goal, Hot memory, and Active task tree sections are always emitted when building from context.
# - Companion grounding (compact HCM/anchor) is optional and never a full memory-window dump.
# Related:
# - api/ewa_platform/agentic/kernel/context_budget.py
# - api/ewa_platform/agentic/kernel/engine.py
# - api/ewa_platform/agentic/companion_grounding.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from api.ewa_platform.agentic.companion_grounding import WM_COMPANION_GROUNDING_KEY
from api.ewa_platform.agentic.config import agentic_checkpoint_window
from api.ewa_platform.agentic.context.condense_sidecar import format_checkpoints_for_condense
from api.ewa_platform.agentic.context.memory_tiers import (
    format_hot_memory_section,
    read_active_slice,
    sync_active_instruction_from_nodes,
)
from api.ewa_platform.agentic.goal_json import goal_text_from_goal_json, mission_anchor_from_goal_json
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.act_binding_policy import replanning_steering_when_scheduler_idle
from api.ewa_platform.agentic.kernel.circuit_breaker import working_memory_from_session
from api.ewa_platform.agentic.kernel.inbound_sanitize import wrap_untrusted_steering
from api.ewa_platform.agentic.kernel.tree_scheduler import scheduler_hint_line
from api.ewa_platform.agentic.kernel.types import AgenticContext
from api.ewa_platform.agentic.mission_anchor import format_mission_anchor_for_think

MARKER_SESSION_STATUS = "Session status:"
MARKER_MISSION_ANCHOR = "Mission anchor (immutable):"
MARKER_GOAL = "Goal:"
MARKER_COMPANION_GROUNDING = "Companion grounding:"
MARKER_PLAN_SUMMARY = "Plan summary:"
MARKER_HOT_MEMORY = "Hot memory (recent actions):"
MARKER_ACTIVE_TASK_TREE = "Active task tree:"
MARKER_SCHEDULED_NODE = "Scheduler:"
MARKER_CHECKPOINTS = "Recent checkpoints:"
MARKER_EMPTY_TREE_CONTRACT = "Empty-tree planning contract:"
LEGACY_ACTIVE_TASK_TREE = "Task tree (active):"

EMPTY_TREE_PLANNING_CONTRACT_LINE = (
    "First mutate MUST include ≥1 allowlisted tool_name node with valid tool_args; "
    "subtask-only plans are rejected while the tree is empty. "
    "For research / multi-document goals when call_expert_chat is allowlisted: "
    "include call_expert_chat (expert_chat) with full expert_roles trio "
    "likiy_sorrento, arlyqueen, akimbo before final file_create nodes. "
    "file_create names must be deliverable titles ending in .md (not .txt / Создание_). "
    "Study-in-folder goals require catalog_list then document_extractor or file_open."
)


@dataclass(frozen=True)
class ThinkPromptSections:
    """Named user-blob sections for section-aware context trimming (Phase 3.5a/3.5b)."""

    session_status: str
    goal: str
    active_task_tree: str
    mission_anchor: str | None = None
    companion_grounding: str | None = None
    plan_summary: str | None = None
    hot_memory: str | None = None
    scheduled_node: str | None = None
    checkpoints: str | None = None
    empty_tree_contract: str | None = None
    steering_blocks: list[str] = field(default_factory=list)

    def to_user_blob(self) -> str:
        parts = [
            f"{MARKER_SESSION_STATUS} {self.session_status}",
        ]
        if self.mission_anchor:
            parts.append(self.mission_anchor)
        parts.append(f"{MARKER_GOAL} {self.goal or '(none)'}")
        if self.companion_grounding:
            parts.append(f"{MARKER_COMPANION_GROUNDING}\n{self.companion_grounding}")
        if self.plan_summary:
            parts.append(f"{MARKER_PLAN_SUMMARY} {self.plan_summary}")
        if self.hot_memory:
            parts.append(f"{MARKER_HOT_MEMORY}\n{self.hot_memory}")
        parts.append(f"{MARKER_ACTIVE_TASK_TREE}\n{self.active_task_tree}")
        if self.empty_tree_contract:
            parts.append(f"{MARKER_EMPTY_TREE_CONTRACT} {self.empty_tree_contract}")
        if self.scheduled_node:
            parts.append(f"{MARKER_SCHEDULED_NODE} {self.scheduled_node}")
        if self.checkpoints:
            parts.append(f"{MARKER_CHECKPOINTS}\n{self.checkpoints}")
        parts.extend(self.steering_blocks)
        return "\n\n".join(parts)


@dataclass(frozen=True)
class FormattedThinkPrompt:
    """System + structured user sections — input/output for PromptBuilder and budget trim."""

    system: str
    sections: ThinkPromptSections

    def to_messages(self) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": self.system},
            {"role": "user", "content": self.sections.to_user_blob()},
        ]

    def user_utf8_len(self) -> int:
        return len(self.sections.to_user_blob().encode("utf-8"))

    def total_utf8_len(self) -> int:
        return len(self.system.encode("utf-8")) + self.user_utf8_len()


def _condense_checkpoints(
    checkpoints: list[dict[str, Any]],
    *,
    after_seq: int = 0,
) -> str:
    cold: list[dict[str, Any]] = []
    for cp in checkpoints:
        seq_raw = cp.get("seq")
        if seq_raw is None or int(seq_raw) > after_seq:
            cold.append(cp)
    if not cold:
        return ""
    window = cold[-agentic_checkpoint_window() :]
    text = format_checkpoints_for_condense(window)
    lines = text.split("\n") if text else []
    return "\n".join(lines[-16:])


def _task_tree_lines(ctx: AgenticContext) -> str:
    if not ctx.active_nodes:
        counts = ", ".join(f"{k}={v}" for k, v in sorted(ctx.tree_summary.items()))
        return f"No active nodes. Tree counts: {counts or 'empty'}"
    lines: list[str] = []
    for node in ctx.active_nodes[:16]:
        lines.append(
            f"- id={node.get('id')} kind={node.get('node_kind')} status={node.get('status')} "
            f"title={node.get('title')} tool={node.get('tool_name') or '-'}"
        )
    return "\n".join(lines)


def _goal_text(session: Mapping[str, Any]) -> str:
    goal = session.get("goal_json")
    if isinstance(goal, Mapping):
        return goal_text_from_goal_json(goal)
    return ""


def _mission_anchor_text(session: Mapping[str, Any]) -> str | None:
    goal = session.get("goal_json")
    if not isinstance(goal, Mapping):
        return None
    anchor = mission_anchor_from_goal_json(goal)
    if anchor is None:
        return None
    return format_mission_anchor_for_think(anchor)


def _steering_blocks(ctx: AgenticContext) -> list[str]:
    blocks: list[str] = []
    for msg in ctx.inbound_messages:
        body = msg.get("message_json")
        text = ""
        if isinstance(body, Mapping):
            text = str(body.get("text") or body.get("message") or body.get("decision") or "")
        wrapped = wrap_untrusted_steering(text)
        if wrapped:
            blocks.append(wrapped)
    return blocks


class ThinkPromptBuilder:
    """Assemble RawContext (AgenticContext) into a FormattedThinkPrompt."""

    @staticmethod
    def build(ctx: AgenticContext, *, system_content: str) -> FormattedThinkPrompt:
        session = ctx.session
        wm_view = sync_active_instruction_from_nodes(working_memory_from_session(session), ctx.active_nodes)
        last_condense_seq = read_active_slice(wm_view)["last_condense_seq"]
        checkpoint_blob = _condense_checkpoints(ctx.checkpoints, after_seq=last_condense_seq)
        hot_blob = format_hot_memory_section(read_active_slice(wm_view))
        status = str(session.get("status") or "")
        tree_empty = sum(int(v) for v in ctx.tree_summary.values()) == 0
        empty_contract = (
            EMPTY_TREE_PLANNING_CONTRACT_LINE
            if status in {fsm.STATUS_PLANNING, fsm.STATUS_REPLANNING} and tree_empty
            else None
        )
        grounding_raw = wm_view.get(WM_COMPANION_GROUNDING_KEY)
        grounding = str(grounding_raw).strip() if grounding_raw else ""
        sections = ThinkPromptSections(
            session_status=status,
            goal=_goal_text(session) or "(none)",
            mission_anchor=_mission_anchor_text(session),
            companion_grounding=grounding or None,
            active_task_tree=_task_tree_lines(ctx),
            plan_summary=str(session.get("plan_summary") or "").strip() or None,
            hot_memory=hot_blob,
            scheduled_node=scheduler_hint_line(ctx.scheduled_node),
            checkpoints=checkpoint_blob or None,
            empty_tree_contract=empty_contract,
            steering_blocks=[
                *_steering_blocks(ctx),
                *([steering] if (steering := replanning_steering_when_scheduler_idle(ctx)) else []),
            ],
        )
        return FormattedThinkPrompt(system=system_content, sections=sections)


def parse_user_blob_sections(user_blob: str) -> ThinkPromptSections | None:
    """Parse a structured user blob back into sections; None if markers are absent."""

    text = (user_blob or "").strip()
    if MARKER_GOAL not in text:
        return None

    session_status = ""
    goal = ""
    mission_anchor: str | None = None
    companion_grounding: str | None = None
    plan_summary: str | None = None
    hot_memory: str | None = None
    active_task_tree = ""
    checkpoints: str | None = None
    steering_blocks: list[str] = []

    blocks = text.split("\n\n")
    i = 0
    while i < len(blocks):
        block = blocks[i]
        if block.startswith(MARKER_SESSION_STATUS):
            session_status = block[len(MARKER_SESSION_STATUS) :].strip()
        elif block.startswith(MARKER_MISSION_ANCHOR):
            mission_anchor = block
        elif block.startswith(MARKER_GOAL):
            goal = block[len(MARKER_GOAL) :].strip()
        elif block.startswith(MARKER_COMPANION_GROUNDING):
            companion_grounding = block[len(MARKER_COMPANION_GROUNDING) + 1 :].strip()
        elif block.startswith(MARKER_PLAN_SUMMARY):
            plan_summary = block[len(MARKER_PLAN_SUMMARY) :].strip()
        elif block.startswith(MARKER_HOT_MEMORY):
            hot_memory = block[len(MARKER_HOT_MEMORY) + 1 :].strip()
        elif block.startswith(MARKER_ACTIVE_TASK_TREE):
            active_task_tree = block[len(MARKER_ACTIVE_TASK_TREE) + 1 :].strip()
        elif block.startswith(LEGACY_ACTIVE_TASK_TREE):
            active_task_tree = block[len(LEGACY_ACTIVE_TASK_TREE) + 1 :].strip()
        elif block.startswith(MARKER_CHECKPOINTS):
            checkpoints = block[len(MARKER_CHECKPOINTS) + 1 :].strip()
        elif block.startswith("<<<UNTRUSTED_USER_STEERING_DATA>>>"):
            steering_blocks.append(block)
        i += 1

    if not goal and not active_task_tree:
        return None

    return ThinkPromptSections(
        session_status=session_status,
        goal=goal,
        mission_anchor=mission_anchor,
        companion_grounding=companion_grounding,
        active_task_tree=active_task_tree,
        plan_summary=plan_summary,
        hot_memory=hot_memory,
        checkpoints=checkpoints,
        steering_blocks=steering_blocks,
    )
