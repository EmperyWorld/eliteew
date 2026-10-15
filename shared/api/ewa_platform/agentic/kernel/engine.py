# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# LLM-driven Think engine: context assembly, structured JSON call, validation, loop mapping.
# Invariants:
# - Tools must exist in REGISTRY; plan nodes capped by EWA_AGENTIC_MAX_TREE_NODES.
# - No FSM apply_session_transition / tool Act dispatch (status constants via session_status).
# Related:
# - api/ewa_platform/agentic/kernel/think_schema_v1.py
# - api/ewa_platform/agentic/kernel/decision_engine.py
# - api/utils/llm_openai_compat_http.py
# ---

from __future__ import annotations

import json
import logging
import os
from collections.abc import Awaitable, Callable, Mapping
from typing import Any

import httpx

from api.ewa_platform.agentic.config import (
    agentic_think_context_max_utf8,
    agentic_think_http_runtime,
    agentic_think_llm_enabled,
    agentic_think_num_predict,
    agentic_think_timeout_sec,
)
from api.ewa_platform.agentic.kernel.context_budget import trim_formatted_prompt
from api.ewa_platform.agentic.kernel.inbound_sanitize import STEERING_DATA_ONLY_RULE
from api.ewa_platform.agentic.kernel.plan_tool_args_prepare import (
    PlanToolArgsError,
    plan_nodes_have_preceding_catalog_list,
    prepare_plan_node_tool_args,
)
from api.ewa_platform.agentic.kernel.prompt_builder import ThinkPromptBuilder
from api.ewa_platform.agentic.kernel.research_plan_contract import (
    RESEARCH_THINK_RULE,
    research_empty_tree_requires_expert,
    study_folder_empty_tree_requires_extract,
)
from api.ewa_platform.agentic.kernel.session_status import (
    STATUS_EXECUTING,
    STATUS_INIT,
    STATUS_PLANNING,
    STATUS_REPLANNING,
)
from api.ewa_platform.agentic.kernel.think_command_v1 import ContinuePayload, MutatePayload
from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput
from api.ewa_platform.agentic.kernel.think_schema_v1 import (
    AgenticThinkOutputV1,
    ThinkSchemaError,
    parse_think_v1_from_text,
)
from api.ewa_platform.agentic.kernel.tool_args_enrich import enrich_tool_args, goal_text_from_session
from api.ewa_platform.agentic.kernel.types import AgenticContext
from api.ewa_platform.agentic.tools.bridge import effective_session_tool_allowlist
from api.ewa_platform.companion.orchestration.tools.registry_core import known_tool_names
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)

LlmCompleteFn = Callable[[list[dict[str, str]], str], Awaitable[str]]

AGENTIC_THINK_SYSTEM_PROMPT = (
    """You are the EWA Agentic Brain — the controller for a durable multi-step agent session.

Your job each tick: analyze mission state and emit ONE JSON object matching AgenticThinkOutputV1 exactly:

{
  "reasoning_trace": "<chain-of-thought: why this decision now>",
  "decision_type": "continue | intervene | mutate | terminate",
  "payload": { "decision_type": "<same as root>", ... see decision_type ... },
  "plan_update_summary": "<condensed mission status after this decision>"
}

decision_type rules (payload must repeat decision_type):
- continue: run one registered tool now.
  payload: {"decision_type":"continue","tool_name":"<registry name>","tool_args":{...},"node_id":"<optional>"}
- intervene: pause for human input (budget, ambiguity, destructive confirm).
  payload: {"decision_type":"intervene","gate_json":{"kind":"confirm|choose|freeform","prompt":"...","options":[{"id":"a","label":"..."}],"expires_at":"ISO8601 optional"}}
- terminate: mission complete or impossible — no further tool steps.
  payload: {"decision_type":"terminate"}
- mutate: add or reshape task tree nodes before execution.
  payload: {"decision_type":"mutate","plan_nodes":[{"node_kind":"subtask|tool|llm|gate|expert_chat|block_append","title":"...","instruction":"...","tool_name":null,"tool_args":{}}],"patch_instructions":"optional"}

Rules of engagement:
1. Use ONLY tool names from the allowlist below — never invent tools.
2. Prefer small incremental steps; one tool per CONTINUE_EXECUTION.
3. Ask for human help when budget/scope/destructive action is unclear.
4. Keep plan_update_summary under 500 chars — it persists across ticks.
5. When user steering messages appear in context, incorporate them in reasoning_trace and plan.
6. Do not claim actions already completed unless checkpoints show success.
7. For continue and mutate plan_nodes with tool_name: tool_args MUST include user_line (short step goal); if omitted, the runtime fills it from session goal.
8. Language: plan_update_summary, plan_nodes (title, instruction), and intervene gate prompts MUST be in Russian (русский). JSON field names stay English; user-visible text — Russian only.
9. Tool choice (critical):
   - catalog_list — list or search files in EwaFile (folder browse, «какие документы», «найди файлы»). Use FIRST before opening a file.
   - file_open — ONLY when a specific file name, file_query, or unified_content_id is known. Never use file_open to «explore» or «list» a folder.
   - document_extractor — extract text ONLY with unified_content_id from catalog_list/file_open. Never call without unified_content_id.
10. Required tool_args at plan time (invalid mutate nodes are rejected):
   - file_create / file_delete: tool_args.name (filename with extension); empty body is OK — runtime composes content.
   - file_save_text: tool_args.name AND non-empty body/text (explicit user-provided text only). Never plan file_save_text without body.
   - document_extractor: tool_args.unified_content_id from a prior catalog_list/file_open step.
   - catalog_list / llm_summarize: user_line is enough; catalog_list defaults to browse when no query is set.
11. file_create vs file_save_text (critical):
   - file_create — new document with LLM-composed content + HITL confirm. One step per new file.
   - file_save_text — only when the user already supplied exact text to store. Never plan file_save_text after file_create for the same filename.
11b. Folders (critical):
   - Default: write into EwaFile root. Do NOT invent create_folder / folder_name / task_key.
   - create_folder=true + folder_name — only when the user explicitly asks to create a new folder.
   - reuse_folder / folder_name / folder_item_id — only when the user asks to use an existing folder.
12. Task tree binding (critical):
   - file_create and file_save_text MUST run only on a plan node (node_id from mutate plan_nodes or scheduler).
   - CONTINUE without node_id executes the scheduler's next node tool — never substitute a different tool_name.
   - When all plan nodes are completed and scheduler shows no runnable node: use mutate for remaining objectives or terminate — never continue with file tools without node_id.
   - document_extractor at act time may use unified_content_id already stored in session policy/driver snapshot after a prior file step.
13. Empty task tree (planning / replanning, no active nodes) — IMMUTABLE:
   - First mutate MUST include at least ONE plan_nodes entry with a non-null tool_name from the allowlist and valid tool_args.
   - Structural subtask-only plans are REJECTED when the tree is empty (they may accompany executable tool nodes, never replace them).
   - For document / roadmap goals prefer file_create (and catalog_list when browsing) when those tools are allowlisted.

"""
    + RESEARCH_THINK_RULE
    + STEERING_DATA_ONLY_RULE
    + """

Registered tools (allowlist for this session):
"""
)

EMPTY_TREE_EXECUTABLE_MUTATE_HINT = (
    "EMPTY TREE CONTRACT: session is planning/replanning with zero task-tree nodes. "
    "Your next mutate.plan_nodes MUST contain ≥1 executable tool node "
    "(non-empty tool_name from the allowlist + valid tool_args). "
    "Subtask-only plans are invalid until at least one tool node exists."
)

STRUCTURAL_REPAIR_USER_TEMPLATE = (
    "Your previous Think JSON was rejected: {reason}.\n"
    "Session status={status}; task tree is EMPTY.\n"
    "Emit ONE corrected JSON object. mutate.plan_nodes MUST include at least one "
    "allowlisted tool_name with valid tool_args. Structural subtasks alone are not enough.\n"
    "Allowlist sample: {allowlist_sample}\n"
    "Prefer file_create for new documents when that tool is allowlisted. "
    "If the rejection mentions research/expert: put call_expert_chat first "
    "(expert_roles: likiy_sorrento, arlyqueen, akimbo), then file_create nodes."
)


def _allowed_tool_names(ctx: AgenticContext) -> tuple[str, ...]:
    allowlist = effective_session_tool_allowlist(ctx.session)
    all_names = known_tool_names()
    if allowlist is None:
        return all_names
    return tuple(n for n in all_names if n in allowlist)


def _tree_is_empty(ctx: AgenticContext) -> bool:
    return sum(int(v) for v in ctx.tree_summary.values()) == 0


def _needs_empty_tree_executable_contract(ctx: AgenticContext) -> bool:
    status = str(ctx.session.get("status") or "")
    return status in {STATUS_PLANNING, STATUS_REPLANNING} and _tree_is_empty(ctx)


def assemble_think_messages(ctx: AgenticContext) -> list[dict[str, str]]:
    tools = _allowed_tool_names(ctx)
    tool_block = ", ".join(tools[:80])
    if len(tools) > 80:
        tool_block += f", … (+{len(tools) - 80} more)"

    system = AGENTIC_THINK_SYSTEM_PROMPT + tool_block
    if _needs_empty_tree_executable_contract(ctx):
        system = system + "\n\n" + EMPTY_TREE_EXECUTABLE_MUTATE_HINT
    formatted = ThinkPromptBuilder.build(ctx, system_content=system)
    trimmed, _meta = trim_formatted_prompt(formatted, max_utf8=agentic_think_context_max_utf8())
    return trimmed.to_messages()


def _structural_repair_user_message(ctx: AgenticContext, *, reason: str) -> str:
    tools = _allowed_tool_names(ctx)
    sample = ", ".join(tools[:24]) if tools else "(none)"
    return STRUCTURAL_REPAIR_USER_TEMPLATE.format(
        reason=reason,
        status=str(ctx.session.get("status") or ""),
        allowlist_sample=sample,
    )


def _parse_and_validate_think_raw(raw: str, ctx: AgenticContext) -> AgenticThinkOutputV1:
    if not raw.strip():
        raise ThinkSchemaError("empty_llm_response")
    v1 = parse_think_v1_from_text(raw)
    try:
        return validate_think_v1(v1, ctx)
    except ValueError as exc:
        raise ThinkSchemaError(str(exc)) from exc


def validate_think_v1(v1: AgenticThinkOutputV1, ctx: AgenticContext) -> AgenticThinkOutputV1:
    allowlist = effective_session_tool_allowlist(ctx.session)
    v1.validate_registry_tool(allowlist=allowlist)
    goal = goal_text_from_session(ctx.session)
    if v1.decision_type == "continue" and isinstance(v1.payload, ContinuePayload):
        v1.payload.tool_args = enrich_tool_args(
            v1.payload.tool_name,
            v1.payload.tool_args,
            user_line=goal,
            session=ctx.session,
        )
        v1.validate_tool_args()
    if v1.decision_type == "mutate":
        if isinstance(v1.payload, MutatePayload):
            validated_nodes: list[Any] = []
            plan_nodes = list(v1.payload.plan_nodes)
            for idx, node in enumerate(plan_nodes):
                tool = str(node.tool_name or "").strip()
                if not tool:
                    validated_nodes.append(node)
                    continue
                try:
                    node.tool_args = prepare_plan_node_tool_args(
                        tool,
                        node.tool_args,
                        user_line=goal,
                        instruction=node.instruction,
                        title=node.title,
                        session=ctx.session,
                        plan_has_preceding_catalog_list=plan_nodes_have_preceding_catalog_list(
                            plan_nodes,
                            current_index=idx,
                        ),
                    )
                except (PlanToolArgsError, ValueError) as exc:
                    raise ThinkSchemaError(f"plan_tool_args_invalid:{tool}:{exc}") from exc
                validated_nodes.append(node)
            v1.payload.plan_nodes = validated_nodes
        nodes, _truncated = v1.truncate_plan_nodes(ctx)
        status = str(ctx.session.get("status") or "")
        tree_empty = sum(int(v) for v in ctx.tree_summary.values()) == 0
        if status in {STATUS_PLANNING, STATUS_REPLANNING} and tree_empty:
            executable = [n for n in nodes if str(n.tool_name or "").strip()]
            if not executable:
                raise ThinkSchemaError("empty_plan_mutate_requires_executable_nodes")
            research_err = research_empty_tree_requires_expert(
                goal_text=goal,
                allowlist=allowlist,
                nodes=executable,
            )
            if research_err:
                raise ThinkSchemaError(research_err)
            study_err = study_folder_empty_tree_requires_extract(
                goal_text=goal,
                allowlist=allowlist,
                nodes=executable,
            )
            if study_err:
                raise ThinkSchemaError(study_err)
    return v1


async def _default_llm_complete(messages: list[dict[str, str]], model: str) -> str:
    base, resolved_model = agentic_think_http_runtime()
    use_model = model or resolved_model
    timeout = httpx.Timeout(agentic_think_timeout_sec())
    response_format: dict[str, Any] = {"type": "json_object"}
    options: dict[str, Any] = {
        "temperature": 0.2,
        "num_predict": agentic_think_num_predict(),
        "openai_sidecar_merge_reasoning": True,
    }
    disable_thinking = os.getenv("EWA_AGENTIC_THINK_DISABLE_THINKING", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    template_kw = {"enable_thinking": False} if disable_thinking else None

    async with httpx.AsyncClient(timeout=timeout) as client:
        out = await httpx_compat_chat_completion_json(
            client,
            base,
            model=use_model,
            messages=messages,
            options=options,
            timeout=timeout,
            response_format=response_format,
            chat_template_kwargs=template_kw,
        )
    return str(out.get("response", "") or "").strip()


def _heuristic_first_executable_tool(ctx: AgenticContext, *, goal_text: str = "") -> str | None:
    """Pick a deterministic allowlisted tool for empty-tree heuristic planning (no invented tools)."""

    from api.ewa_platform.agentic.kernel.research_plan_contract import goal_looks_like_research
    from api.services.desktop_chat_ensemble.intent_signals import goal_requires_internet

    tools = set(_allowed_tool_names(ctx))
    preferred = ("file_create", "catalog_list", "llm_summarize", "recall_memory")
    if (goal_looks_like_research(goal_text) or goal_requires_internet(goal_text)) and "call_expert_chat" in tools:
        preferred = ("call_expert_chat", "file_create", "catalog_list", "llm_summarize", "recall_memory")
    for candidate in preferred:
        if candidate in tools:
            return candidate
    ordered = sorted(tools)
    return ordered[0] if ordered else None


async def _heuristic_think(ctx: AgenticContext) -> AgenticThinkOutput:
    """Fallback when LLM disabled — must satisfy the same empty-tree executable contract as LLM Think."""

    status = str(ctx.session.get("status") or "")
    if status == STATUS_INIT:
        return AgenticThinkOutput(action="plan", rationale="bootstrap", plan_nodes=[])
    if status in {STATUS_PLANNING, STATUS_REPLANNING} and _tree_is_empty(ctx):
        goal = ctx.session.get("goal_json")
        text = str(goal.get("text") or "") if isinstance(goal, Mapping) else ""
        tool = _heuristic_first_executable_tool(ctx, goal_text=text)
        if not tool:
            raise ThinkSchemaError("empty_plan_mutate_requires_executable_nodes")
        title = "Создать документ" if tool == "file_create" else f"Шаг: {tool}"
        if tool == "call_expert_chat":
            title = "Исследование с экспертами"
        node: dict[str, Any] = {
            "node_kind": "expert_chat" if tool == "call_expert_chat" else "tool",
            "title": title[:120],
            "instruction": (text[:2000] or title),
            "tool_name": tool,
            "tool_args": {"user_line": text[:2000] or title},
        }
        if tool == "file_create":
            node["tool_args"] = {
                "user_line": text[:2000] or title,
                "name": "документ.md",
            }
        if tool == "call_expert_chat":
            from api.ewa_platform.agentic.kernel.research_plan_contract import (
                resolve_agentic_expert_blueprint_id,
            )
            from api.services.desktop_chat_ensemble.intent_signals import goal_requires_internet

            expert_args: dict[str, Any] = {
                "user_line": text[:2000] or title,
                "expert_roles": ["likiy_sorrento", "arlyqueen", "akimbo"],
            }
            bp = resolve_agentic_expert_blueprint_id(text)
            if bp:
                expert_args["blueprint_template_id"] = bp
            if goal_requires_internet(text):
                expert_args["use_web_search"] = True
            node["tool_args"] = expert_args
        return AgenticThinkOutput(
            action="plan",
            rationale="heuristic executable bootstrap",
            plan_nodes=[node],
            plan_summary_patch=text[:500],
        )
    pending = [n for n in ctx.active_nodes if str(n.get("status")) == "pending"]
    if pending:
        node = pending[0]
        if node.get("tool_name"):
            return AgenticThinkOutput(
                action="act",
                rationale="heuristic tool node",
                act_node_id=str(node["id"]),
                act_tool_name=str(node["tool_name"]),
                act_tool_args=dict(node.get("tool_args_json") or {}),
            )
    if status == STATUS_EXECUTING:
        return AgenticThinkOutput(action="complete", rationale="heuristic no pending work")
    return AgenticThinkOutput(action="clarify", rationale="heuristic clarify", user_message="Need clarification")


def _heuristic_to_v1(out: AgenticThinkOutput) -> AgenticThinkOutputV1:
    if out.action == "act":
        return AgenticThinkOutputV1.model_validate(
            {
                "reasoning_trace": out.rationale or "heuristic act",
                "decision_type": "continue",
                "payload": {
                    "decision_type": "continue",
                    "tool_name": out.act_tool_name,
                    "tool_args": out.act_tool_args or {},
                    "node_id": out.act_node_id,
                },
                "plan_update_summary": out.plan_summary_patch or "",
            }
        )
    if out.action == "plan":
        return AgenticThinkOutputV1.model_validate(
            {
                "reasoning_trace": out.rationale or "heuristic",
                "decision_type": "mutate",
                "payload": {
                    "decision_type": "mutate",
                    "plan_nodes": [n.model_dump() if hasattr(n, "model_dump") else n for n in out.plan_nodes],
                },
                "plan_update_summary": out.plan_summary_patch or "",
            }
        )
    return AgenticThinkOutputV1.model_validate(
        {
            "reasoning_trace": out.rationale or "heuristic",
            "decision_type": "terminate",
            "payload": {"decision_type": "terminate"},
            "plan_update_summary": out.plan_summary_patch or "",
        }
    )


async def invoke_think_llm(
    ctx: AgenticContext,
    *,
    llm_complete: LlmCompleteFn | None = None,
) -> tuple[AgenticThinkOutputV1, AgenticThinkOutput]:
    if not agentic_think_llm_enabled():
        out = await _heuristic_think(ctx)
        v1 = _heuristic_to_v1(out)
        if out.action == "plan":
            v1 = validate_think_v1(v1, ctx)
        return v1, out

    messages = assemble_think_messages(ctx)
    _, model = agentic_think_http_runtime()
    complete = llm_complete or _default_llm_complete
    raw = await complete(messages, model)
    try:
        v1 = _parse_and_validate_think_raw(raw, ctx)
    except ThinkSchemaError as first_exc:
        reason = str(first_exc)
        repairable = {
            "empty_plan_mutate_requires_executable_nodes",
            "research_plan_requires_expert_chat_before_file_create",
        }
        if reason in repairable and _needs_empty_tree_executable_contract(ctx):
            logger.warning(
                "[STEP] agentic_think_structural_repair session_id=%s reason=%s",
                ctx.session.get("id"),
                reason,
            )
            repair_messages = [
                *messages,
                {"role": "assistant", "content": raw[:8000]},
                {"role": "user", "content": _structural_repair_user_message(ctx, reason=reason)},
            ]
            raw2 = await complete(repair_messages, model)
            v1 = _parse_and_validate_think_raw(raw2, ctx)
        else:
            raise

    loop_out = v1.to_loop_output(ctx)
    logger.info(
        "[STEP] agentic_think_ok session_id=%s decision=%s action=%s",
        ctx.session.get("id"),
        v1.decision_type,
        loop_out.action,
    )
    return v1, loop_out


async def run_agentic_think(
    ctx: AgenticContext,
    *,
    llm_complete: LlmCompleteFn | None = None,
) -> AgenticThinkOutput:
    """Primary Think entry for loop.py — returns legacy AgenticThinkOutput."""

    _v1, loop_out = await invoke_think_llm(ctx, llm_complete=llm_complete)
    return loop_out


def think_v1_json_schema_hint() -> str:
    """Compact schema hint for logs/tests."""

    return json.dumps(
        {
            "reasoning_trace": "string",
            "decision_type": "continue|intervene|mutate|terminate",
            "payload": "discriminated object on decision_type",
            "plan_update_summary": "string",
        },
        ensure_ascii=False,
    )
