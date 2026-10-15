# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests: intent planner file/doc intents route through ``tool_registry`` (Phase 4).
# Invariants:
# - ``dispatch_intent_plan_via_registry`` must call ``run_tool_branch`` with mapped tool names/args.
# Related:
# - api/ewa_platform/companion/orchestration/intent_plan_registry_dispatch.py
# ---

from __future__ import annotations

from typing import Any

import pytest

from api.ewa_platform.companion.contracts import CompanionIntentPlanV1
from api.ewa_platform.companion.orchestration.intent_plan_registry_dispatch import (
    dispatch_intent_plan_via_registry,
    intent_plan_registry_tool_name,
    intent_plan_to_tool_args,
)
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext


def test_intent_plan_registry_tool_name_mapping() -> None:
    assert intent_plan_registry_tool_name("doc_create") == "file_create"
    assert intent_plan_registry_tool_name("doc_insert_into_open_editor") == "doc_insert"
    assert intent_plan_registry_tool_name("file_rename") == "file_rename"
    assert intent_plan_registry_tool_name("recall_memory") == "recall_memory"


def test_intent_plan_to_tool_args_file_rename() -> None:
    plan = CompanionIntentPlanV1(
        intent="file_rename",
        confidence=0.9,
        rename_old_query="draft.md",
        rename_new_name="final.md",
    )
    args = intent_plan_to_tool_args(plan, user_line="переименуй draft.md в final.md")
    assert args is not None
    assert args["old_query"] == "draft.md"
    assert args["new_name"] == "final.md"


def test_intent_plan_to_tool_args_delete_requires_query() -> None:
    plan = CompanionIntentPlanV1(intent="file_delete", confidence=0.8, delete_file_query="x")
    assert intent_plan_to_tool_args(plan, user_line="удали x") is None


@pytest.mark.asyncio
async def test_dispatch_intent_plan_via_registry_calls_run_tool_branch() -> None:
    calls: list[tuple[str, dict[str, Any]]] = []

    async def fake_run_tool_branch(
        name: str,
        args: Any,
        ctx: ToolContext,
        *,
        user_line: str,
    ) -> dict[str, Any] | None:
        calls.append((name, dict(args)))
        return {"reply": "ok", "actions": [], "task_run": None, "orchestration_branch": name}

    plan = CompanionIntentPlanV1(
        intent="doc_create",
        confidence=0.85,
        doc_file_name="notes.md",
        doc_body_text="# Hello",
    )
    ctx = ToolContext(
        principal_id="p1",
        user_line="создай notes.md",
        content_catalog_user_id="catalog-user",
        oauth2_sub_for_content_alternate=None,
    )
    out = await dispatch_intent_plan_via_registry(
        plan,
        tool_ctx=ctx,
        user_line="создай notes.md",
        run_tool_branch=fake_run_tool_branch,
    )
    assert out is not None
    assert out["orchestration_branch"] == "file_create"
    assert len(calls) == 1
    assert calls[0][0] == "file_create"
    assert calls[0][1]["doc_file_name"] == "notes.md"
    assert calls[0][1]["body"] == "# Hello"
