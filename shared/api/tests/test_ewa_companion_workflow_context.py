# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for WorkflowRunContext template resolver (WF-3.3).
# Related:
# - api/ewa_platform/companion/workflows/action/context.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.workflows.action.context import (
    WorkflowRunContext,
    build_declarative_tool_dispatch_args,
    resolve_args_template,
    resolve_template_string,
)


def test_resolve_turn_user_line() -> None:
    ctx = WorkflowRunContext(user_line="hello world", principal_id="p1")
    assert resolve_template_string("{{turn.user_line}}", ctx) == "hello world"
    assert resolve_template_string("prefix {{turn.user_line}} suffix", ctx) == "prefix hello world suffix"


def test_resolve_steps_index_output_field() -> None:
    ctx = WorkflowRunContext(
        user_line="x",
        steps=(
            {
                "step_index": 1,
                "input_payload": {"step_key": "create"},
                "output_payload": {"unified_content_id": "uc-99", "name": "doc.md"},
            },
        ),
    )
    assert resolve_template_string("{{steps.0.output.unified_content_id}}", ctx) == "uc-99"
    tpl = resolve_args_template(
        {
            "app_component": "DocEditor",
            "payload": {"unified_content_id": "{{steps.0.output.unified_content_id}}"},
        },
        ctx,
    )
    assert tpl["payload"]["unified_content_id"] == "uc-99"


def test_resolve_steps_by_key_output() -> None:
    ctx = WorkflowRunContext(
        steps=(
            {
                "step_index": 1,
                "input_payload": {"step_key": "create"},
                "output_payload": {"track_id": "t-1"},
            },
        ),
    )
    assert resolve_template_string("{{steps.by_key.create.output.track_id}}", ctx) == "t-1"


def test_unknown_placeholder_becomes_empty() -> None:
    ctx = WorkflowRunContext()
    assert resolve_template_string("{{steps.9.output.missing}}", ctx) == ""


def test_build_declarative_tool_dispatch_args_resolves_prior_step_reply() -> None:
    steps = (
        {
            "step_index": 1,
            "input_payload": {"step_key": "discuss"},
            "output_payload": {
                "reply": "Разбор файла для поста.",
                "status": "memory_append",
            },
        },
    )
    args = build_declarative_tool_dispatch_args(
        user_line="триггер",
        principal_id="p1",
        args_template={"brief": "{{steps.0.output.reply}}", "channel": "telegram"},
        steps=steps,
    )
    assert args["brief"] == "Разбор файла для поста."
    assert args["channel"] == "telegram"
    assert args["user_line"] == "триггер"
    assert args["_tool_router_bypass_line_match"] is True
