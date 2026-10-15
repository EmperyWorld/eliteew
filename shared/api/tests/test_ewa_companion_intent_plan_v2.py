# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for intent planner schema v2 and unified registry dispatch (Phase 4).
# Related:
# - api/ewa_platform/schemas/pydantic/companion_intent.py
# - api/ewa_platform/companion/orchestration/intent_plan_registry_dispatch.py
# ---

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from api.ewa_platform.companion.contracts import CompanionIntentPlan, CompanionIntentPlanV1, CompanionIntentPlanV2
from api.ewa_platform.companion.orchestration import task_orchestrator
from api.ewa_platform.companion.orchestration.intent_plan_registry_dispatch import (
    dispatch_intent_plan,
    intent_plan_tool_args,
)
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.sidecar.intent_planner import parse_intent_planner_model_text


def test_companion_intent_plan_from_v2_blob() -> None:
    plan = CompanionIntentPlan.from_blob(
        {
            "tool": "file_create",
            "confidence": 0.91,
            "args": {},
            "doc_file_name": "notes.md",
            "doc_body_text": "# Hi",
        }
    )
    assert plan is not None
    assert plan.tool == "file_create"
    assert plan.args["doc_file_name"] == "notes.md"
    assert plan.intent == "doc_create"


def test_companion_intent_plan_from_v1_blob_backward_compat() -> None:
    plan = CompanionIntentPlan.from_blob(
        {
            "intent": "file_rename",
            "confidence": 0.8,
            "rename_old_query": "a.md",
            "rename_new_name": "b.md",
        }
    )
    assert plan is not None
    assert plan.tool == "file_rename"
    assert plan.args["old_query"] == "a.md"


def test_parse_intent_planner_model_text_v2_markdown() -> None:
    raw = """
- tool: file_create
- confidence: 0.87
- doc_file_name: draft.md
- understood_summary_ru: Создать файл draft.md
"""
    blob = parse_intent_planner_model_text(raw)
    assert blob is not None
    plan = CompanionIntentPlan.from_blob(blob)
    assert plan is not None
    assert plan.tool == "file_create"
    assert plan.args.get("doc_file_name") == "draft.md"


def test_intent_plan_tool_args_v2_direct() -> None:
    plan = CompanionIntentPlan.from_v2(
        CompanionIntentPlanV2(
            tool="file_delete",
            confidence=0.9,
            args={"delete_file_query": "obsolete.md"},
        )
    )
    args = intent_plan_tool_args(plan, user_line="удали obsolete.md")
    assert args is not None
    assert args["phrase"] == "obsolete.md"


@pytest.mark.asyncio
async def test_dispatch_intent_plan_doc_create_calls_file_create() -> None:
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

    plan = CompanionIntentPlan.from_v1(
        CompanionIntentPlanV1(
            intent="doc_create",
            confidence=0.85,
            doc_file_name="notes.md",
            doc_body_text="# Hello",
        )
    )
    ctx = ToolContext(
        principal_id="p1",
        user_line="создай notes.md",
        content_catalog_user_id="catalog-user",
        oauth2_sub_for_content_alternate=None,
    )
    out = await dispatch_intent_plan(
        plan,
        tool_ctx=ctx,
        user_line="создай notes.md",
        shell_norm=None,
        run_tool_branch=fake_run_tool_branch,
    )
    assert out is not None
    assert calls[0][0] == "file_create"
    assert calls[0][1]["_intent_planner_bypass_line_match"] is True


def test_dispatch_companion_intent_plan_wires_registry() -> None:
    calls: list[str] = []

    async def fake_run_tool_branch(
        name: str,
        _args: Any,
        _ctx: ToolContext,
        *,
        user_line: str,
    ) -> dict[str, Any] | None:
        calls.append(name)
        return {"reply": "created", "actions": [], "task_run": None, "orchestration_branch": name}

    plan = CompanionIntentPlanV1(
        intent="doc_create",
        confidence=0.9,
        doc_file_name="roadmap.md",
        doc_body_text="# Roadmap",
    )
    ctx = ToolContext(
        principal_id="p1",
        user_line="создай roadmap.md",
        content_catalog_user_id="catalog-user",
        oauth2_sub_for_content_alternate=None,
    )
    out = asyncio.run(
        task_orchestrator._dispatch_companion_intent_plan(
            intent_plan=plan,
            tool_ctx=ctx,
            user_line="создай roadmap.md",
            shell_norm=None,
            run_tool_branch=fake_run_tool_branch,
        )
    )
    assert out is not None
    assert calls == ["file_create"]
