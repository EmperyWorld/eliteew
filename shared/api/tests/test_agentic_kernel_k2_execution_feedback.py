# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# K2 integration: Execution Guard + Action Feedback full cycle
# Context → Think → Transition → Act → Feedback → Next Think.
# Related:
# - api/ewa_platform/agentic/kernel/loop_bridge.py
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K2
# ---

from __future__ import annotations

import ast
import json
from pathlib import Path
from typing import Any

import pytest

from api.ewa_platform.agentic.kernel.loop_bridge import (
    ACT_FEEDBACK_CHECKPOINT_KIND,
    assert_execution_guard,
    build_context_with_act_feedback,
    run_decision_to_action_cycle,
    run_think_transition_act_feedback_cycle,
)
from api.ewa_platform.agentic.kernel.types import AgenticContext, KernelCommand, KernelEvent

_KERNEL = Path(__file__).resolve().parents[1] / "ewa_platform" / "agentic" / "kernel"
_TOOLS = Path(__file__).resolve().parents[1] / "ewa_platform" / "agentic" / "tools"


def _ctx(*, status: str = "executing") -> AgenticContext:
    return AgenticContext(
        session={
            "id": "sess-k2-1",
            "principal_id": "p-k2",
            "status": status,
            "session_revision": 4,
            "goal_json": {"text": "Найти файлы"},
            "plan_summary": "",
            "policy_json": {},
        },
        active_nodes=[],
        tree_summary={"pending": 1, "completed": 0},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )


def _imported_modules(source: str) -> set[str]:
    tree = ast.parse(source)
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module)
        if isinstance(node, ast.Import):
            for alias in node.names:
                names.add(alias.name)
    return names


def test_act_modules_do_not_import_decision_engine() -> None:
    """Act must not call Decision directly — cycle only via loop_bridge."""

    bridge_src = (_TOOLS / "bridge.py").read_text(encoding="utf-8")
    mods = _imported_modules(bridge_src)
    blob = " ".join(sorted(mods))
    assert "decision_engine" not in blob
    assert "loop_bridge" not in blob
    assert "handle_think_request" not in bridge_src


def test_execution_guard_requires_transition_applied() -> None:
    assert (
        assert_execution_guard(transition_event=None, transition_name="act_authorized")
        == "execution_guard_no_transition_event"
    )
    rejected = KernelEvent(
        session_id="s",
        correlation_id="c",
        kind="transition_rejected",
        error_code="illegal",
    )
    assert (
        assert_execution_guard(transition_event=rejected, transition_name="act_authorized")
        == "execution_guard_transition_not_applied"
    )
    applied = KernelEvent(
        session_id="s",
        correlation_id="c",
        kind="transition_applied",
        payload={"to": "executing"},
    )
    assert assert_execution_guard(transition_event=applied, transition_name="act_authorized") is None
    assert (
        assert_execution_guard(transition_event=applied, transition_name="step_ok_done")
        == "execution_guard_transition_does_not_authorize_act"
    )


def test_build_context_with_act_feedback_success_and_error() -> None:
    base = _ctx()
    ok_ctx = build_context_with_act_feedback(
        base,
        session={"status": "executing", "session_revision": 5},
        act_tool_name="catalog_list",
        act_result={"status": "ok", "summary": "нашёл 3"},
    )
    assert ok_ctx.checkpoints[-1]["kind"] == "act"
    assert ok_ctx.checkpoints[-1]["payload_json"]["feedback_status"] == "success"
    assert ok_ctx.checkpoints[-1]["payload_json"]["source"] == ACT_FEEDBACK_CHECKPOINT_KIND
    assert "Action Feedback" in ok_ctx.llm_messages[-1]["content"]
    assert "Action Feedback" in str(ok_ctx.inbound_messages[-1].get("message_json"))

    err_ctx = build_context_with_act_feedback(
        base,
        session=None,
        act_tool_name="file_create",
        act_result={"status": "error", "summary": "denied"},
    )
    assert err_ctx.checkpoints[-1]["payload_json"]["feedback_status"] == "error"
    assert err_ctx.checkpoints[-1]["payload_json"]["status"] == "error"


@pytest.mark.asyncio
async def test_full_cycle_context_think_transition_act_feedback_next_think(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    think_calls: list[list[dict[str, str]]] = []

    async def _mock_llm(messages: list[dict[str, str]], _model: str) -> str:
        think_calls.append(list(messages))
        # Second Think sees Action Feedback in llm_messages.
        blob = " ".join(str(m.get("content") or "") for m in messages)
        if "Action Feedback" in blob:
            return json.dumps(
                {
                    "reasoning_trace": "Учёл результат catalog_list — завершаю.",
                    "decision_type": "terminate",
                    "payload": {"decision_type": "terminate"},
                    "plan_update_summary": "Готово после feedback.",
                }
            )
        return json.dumps(
            {
                "reasoning_trace": "Нужен catalog_list.",
                "decision_type": "continue",
                "payload": {
                    "decision_type": "continue",
                    "tool_name": "catalog_list",
                    "tool_args": {"user_line": "квант", "mode": "search"},
                },
                "plan_update_summary": "Ищем.",
            }
        )

    acts: list[tuple[str, dict[str, Any], str | None]] = []

    async def _dispatch(tool: str, args: dict[str, Any], node_id: str | None) -> dict[str, Any]:
        acts.append((tool, args, node_id))
        return {"status": "ok", "summary": f"ran:{tool}"}

    applied: list[str] = []

    async def _apply(cmd: KernelCommand) -> KernelEvent:
        applied.append(str(cmd.payload.get("event")))
        return KernelEvent(
            session_id=cmd.session_id,
            correlation_id=cmd.correlation_id,
            kind="transition_applied",
            revision_after=5,
            payload={
                "event": cmd.payload.get("event"),
                "to": "executing",
                "session": {
                    "id": cmd.session_id,
                    "status": "executing",
                    "session_revision": 5,
                },
            },
        )

    result = await run_think_transition_act_feedback_cycle(
        context=_ctx(status="executing"),
        session_id="sess-k2-1",
        principal_id="p-k2",
        expected_revision=4,
        correlation_id="corr-k2-full",
        llm_complete=_mock_llm,
        apply_transition=_apply,
        dispatch_act=_dispatch,
    )

    assert result.think_event.kind == "think_succeeded"
    assert result.transition_name == "act_authorized"
    assert applied == ["act_authorized"]
    assert result.transition_event is not None
    assert result.transition_event.kind == "transition_applied"
    assert result.outcome == "act_done"
    assert result.act_called is True
    assert result.act_tool_name == "catalog_list"
    assert len(acts) == 1

    assert result.feedback_context is not None
    assert result.feedback_context.checkpoints[-1]["payload_json"]["feedback_status"] == "success"
    assert result.feedback_think_event is not None
    assert result.feedback_think_event.kind == "think_succeeded"
    assert result.feedback_think_event.payload.get("decision_type") == "terminate"
    assert "action_feedback_next_think" in result.notes
    assert len(think_calls) == 2
    feedback_blob = " ".join(str(m.get("content") or "") for m in think_calls[1])
    assert "Action Feedback" in feedback_blob or ("catalog_list" in feedback_blob and "status=ok" in feedback_blob)
    assert "catalog_list" in feedback_blob


@pytest.mark.asyncio
async def test_execution_guard_blocks_act_without_transition_applied(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If FSM rejects act_authorized, Act must not run."""

    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    async def _mock_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return json.dumps(
            {
                "reasoning_trace": "Act.",
                "decision_type": "continue",
                "payload": {
                    "decision_type": "continue",
                    "tool_name": "catalog_list",
                    "tool_args": {"user_line": "x", "mode": "search"},
                },
                "plan_update_summary": "",
            }
        )

    acts: list[str] = []

    async def _dispatch(tool: str, _args: dict[str, Any], _nid: str | None) -> dict[str, Any]:
        acts.append(tool)
        return {"status": "ok"}

    async def _apply(cmd: KernelCommand) -> KernelEvent:
        return KernelEvent(
            session_id=cmd.session_id,
            correlation_id=cmd.correlation_id,
            kind="transition_rejected",
            error_code="illegal_transition",
            payload={"event": cmd.payload.get("event")},
        )

    result = await run_decision_to_action_cycle(
        context=_ctx(status="executing"),
        session_id="sess-k2-1",
        principal_id="p-k2",
        expected_revision=4,
        correlation_id="corr-guard",
        llm_complete=_mock_llm,
        apply_transition=_apply,
        dispatch_act=_dispatch,
    )

    assert result.outcome == "transition_rejected"
    assert result.act_called is False
    assert acts == []


@pytest.mark.asyncio
async def test_act_error_feedback_reaches_next_think(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    think_n = {"n": 0}

    async def _mock_llm(messages: list[dict[str, str]], _model: str) -> str:
        think_n["n"] += 1
        if think_n["n"] == 1:
            return json.dumps(
                {
                    "reasoning_trace": "Пробуем tool.",
                    "decision_type": "continue",
                    "payload": {
                        "decision_type": "continue",
                        "tool_name": "catalog_list",
                        "tool_args": {"user_line": "x", "mode": "search"},
                    },
                    "plan_update_summary": "",
                }
            )
        blob = " ".join(str(m.get("content") or "") for m in messages)
        assert "status=error" in blob
        return json.dumps(
            {
                "reasoning_trace": "Ошибка tool — уточняю.",
                "decision_type": "intervene",
                "payload": {
                    "decision_type": "intervene",
                    "gate_json": {"kind": "freeform", "prompt": "Повторить поиск?"},
                },
                "plan_update_summary": "HITL после error feedback",
            }
        )

    async def _dispatch(_tool: str, _args: dict[str, Any], _nid: str | None) -> dict[str, Any]:
        return {"status": "error", "summary": "timeout"}

    async def _apply(cmd: KernelCommand) -> KernelEvent:
        return KernelEvent(
            session_id=cmd.session_id,
            correlation_id=cmd.correlation_id,
            kind="transition_applied",
            revision_after=5,
            payload={
                "event": cmd.payload.get("event"),
                "to": "executing",
                "session": {"status": "executing", "session_revision": 5},
            },
        )

    result = await run_think_transition_act_feedback_cycle(
        context=_ctx(status="executing"),
        session_id="sess-k2-1",
        principal_id="p-k2",
        expected_revision=4,
        correlation_id="corr-err-fb",
        llm_complete=_mock_llm,
        apply_transition=_apply,
        dispatch_act=_dispatch,
    )

    assert result.outcome == "act_done"
    assert result.feedback_context is not None
    assert result.feedback_context.checkpoints[-1]["payload_json"]["feedback_status"] == "error"
    assert result.feedback_think_event is not None
    assert result.feedback_think_event.kind == "think_needs_clarification"
