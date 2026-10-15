# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Normalize and dispatch validated companion intent plans (v1/v2) exclusively through ``tool_registry`` handlers.
# Invariants:
# - ``doc_edit_requires_open_editor`` is a shell guard pseudo-tool (not in registry).
# - File/doc tools require ``content_catalog_user_id``; invalid slot shapes return ``None`` (fall through).
# Related:
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - documentation/product/ewa/EWA-COMPANION-BACKGROUND-ORCHESTRATION-MASTER-PLAN.md §Phase 4
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol

from api.ewa_platform.companion.contracts import (
    CompanionIntentPlan,
    CompanionIntentPlanV1,
)
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.storage.doceditor_translate_body import resolve_doc_editor_unified_id_for_shell
from api.ewa_platform.schemas.pydantic.companion_intent import intent_planner_tool_requires_catalog


class RunToolBranch(Protocol):
    async def __call__(
        self,
        name: str,
        args: Mapping[str, Any],
        ctx: ToolContext,
        *,
        user_line: str,
    ) -> dict[str, Any] | None: ...


def intent_plan_registry_tool_name(intent: str) -> str | None:
    """Return registry tool key for a legacy v1 planner intent, or ``None`` if not registry-routed."""

    plan = CompanionIntentPlan.from_v1(CompanionIntentPlanV1.model_validate({"intent": intent, "confidence": 0.0}))
    if plan.tool in ("chat_only", "doc_edit_requires_open_editor"):
        return None
    return plan.tool


def intent_plan_to_tool_args(
    intent_plan: CompanionIntentPlanV1,
    *,
    user_line: str,
) -> dict[str, Any] | None:
    """Build ``dispatch_tool_by_name`` args from a validated legacy v1 planner blob."""

    return intent_plan_tool_args(CompanionIntentPlan.from_v1(intent_plan), user_line=user_line)


def intent_plan_tool_args(
    plan: CompanionIntentPlan,
    *,
    user_line: str,
) -> dict[str, Any] | None:
    """Validate slot requirements and build handler args for a normalized plan."""

    tool = str(plan.tool or "chat_only").strip()
    if tool == "chat_only":
        return None

    base: dict[str, Any] = {"user_line": user_line, "_intent_planner_bypass_line_match": True}
    base.update(dict(plan.args))

    if tool == "file_create":
        name = str(base.get("doc_file_name") or base.get("name") or "").strip()
        if name:
            base["doc_file_name"] = name
            base["name"] = name
        body = base.get("doc_body_text") or base.get("body")
        if body is not None:
            base["doc_body_text"] = body
            base["body"] = body
        return base

    if tool == "doc_insert":
        phrase = str(base.get("insert_source_file_query") or base.get("phrase") or "").strip()
        if len(phrase) < 2:
            return None
        base["insert_source_file_query"] = phrase
        base["phrase"] = phrase
        return base

    if tool == "file_rename":
        old_q = str(base.get("rename_old_query") or base.get("old_query") or "").strip()
        new_n = str(base.get("rename_new_name") or base.get("new_name") or "").strip()
        if len(old_q) < 1 or len(new_n) < 1:
            return None
        base["rename_old_query"] = old_q
        base["rename_new_name"] = new_n
        base["old_query"] = old_q
        base["new_name"] = new_n
        return base

    if tool == "file_delete":
        dq = str(base.get("delete_file_query") or base.get("phrase") or "").strip()
        if len(dq) < 2:
            return None
        base["delete_file_query"] = dq
        base["phrase"] = dq
        return base

    if tool == "recall_memory":
        return base

    return base


def _doc_edit_requires_open_editor_reply(
    *, user_line: str, shell_norm: Mapping[str, Any] | None
) -> dict[str, Any] | None:
    if resolve_doc_editor_unified_id_for_shell(shell_norm or {}):
        return None
    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    return {
        "reply": (
            "Чтобы отредактировать файл, сначала открой документ в DocEditor. Сейчас я не вижу `uc` открытого "
            "документа и не буду делать вид, что изменила файл."
            if ru
            else "To edit a file, open it in DocEditor first. I cannot see the open document `uc`, so I will "
            "not pretend I changed it."
        ),
        "actions": [],
        "task_run": None,
    }


async def dispatch_intent_plan(
    plan: CompanionIntentPlan,
    *,
    tool_ctx: ToolContext,
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
    run_tool_branch: RunToolBranch,
) -> dict[str, Any] | None:
    """Execute a normalized planner decision through registry tools only."""

    tool = str(plan.tool or "chat_only").strip()
    if tool == "chat_only":
        return None

    if tool == "doc_edit_requires_open_editor":
        blocked = _doc_edit_requires_open_editor_reply(user_line=user_line, shell_norm=shell_norm)
        return blocked

    if intent_planner_tool_requires_catalog(tool) and not (tool_ctx.content_catalog_user_id or "").strip():
        return None

    args = intent_plan_tool_args(plan, user_line=user_line)
    if args is None:
        return None

    return await run_tool_branch(tool, args, tool_ctx, user_line=user_line)


async def dispatch_intent_plan_via_registry(
    intent_plan: CompanionIntentPlanV1,
    *,
    tool_ctx: ToolContext,
    user_line: str,
    run_tool_branch: RunToolBranch,
    shell_norm: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Legacy entry: v1 planner blob → normalize → registry dispatch."""

    return await dispatch_intent_plan(
        CompanionIntentPlan.from_v1(intent_plan),
        tool_ctx=tool_ctx,
        user_line=user_line,
        shell_norm=shell_norm,
        run_tool_branch=run_tool_branch,
    )


__all__ = (
    "RunToolBranch",
    "dispatch_intent_plan",
    "dispatch_intent_plan_via_registry",
    "intent_plan_registry_tool_name",
    "intent_plan_to_tool_args",
    "intent_plan_tool_args",
)
