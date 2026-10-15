# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# K1 integration: Context → Think (Decision) → Transition (FSM) → Act (dispatcher).
# Related:
# - api/ewa_platform/agentic/kernel/loop_bridge.py
# - api/ewa_platform/agentic/kernel/loop.py
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K1
# ---

from __future__ import annotations

import ast
import json
from pathlib import Path
from typing import Any

import pytest

from api.ewa_platform.agentic.kernel.decision_engine import handle_think_request
from api.ewa_platform.agentic.kernel.loop import run_decision_to_action_bridge
from api.ewa_platform.agentic.kernel.loop_bridge import run_decision_to_action_cycle
from api.ewa_platform.agentic.kernel.types import AgenticContext, KernelCommand, KernelEvent

_KERNEL = Path(__file__).resolve().parents[1] / "ewa_platform" / "agentic" / "kernel"


def _ctx(
    *,
    status: str = "executing",
    tree_summary: dict[str, int] | None = None,
) -> AgenticContext:
    return AgenticContext(
        session={
            "id": "sess-k1-1",
            "principal_id": "p-k1",
            "status": status,
            "session_revision": 4,
            "goal_json": {"text": "Найти файлы"},
            "plan_summary": "",
            "policy_json": {},
        },
        active_nodes=[],
        tree_summary=tree_summary or {"pending": 1, "completed": 0},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )


def test_decision_engine_still_isolated_from_act_and_fsm() -> None:
    src = (_KERNEL / "decision_engine.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module)
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported.add(alias.name)
    blob = " ".join(sorted(imported))
    assert "state_machine" not in blob
    assert "fsm_port" not in blob
    assert "loop_bridge" not in blob
    assert "agentic.kernel.loop" not in blob
    assert "agentic_dispatch_tool" not in src or "Never calls" in src


@pytest.mark.asyncio
async def test_full_cycle_think_transition_act_continue(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    async def _mock_llm(_messages: list[dict[str, str]], _model: str) -> str:
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

    result = await run_decision_to_action_bridge(
        context=_ctx(status="executing"),
        session_id="sess-k1-1",
        principal_id="p-k1",
        expected_revision=4,
        correlation_id="corr-act",
        llm_complete=_mock_llm,
        dispatch_act=_dispatch,
    )

    assert result.think_event.kind == "think_succeeded"
    assert result.transition_name == "act_authorized"
    assert result.transition_event is not None
    assert result.transition_event.kind == "transition_applied"
    assert result.outcome == "act_done"
    assert result.act_called is True
    assert result.act_tool_name == "catalog_list"
    assert len(acts) == 1
    assert acts[0][0] == "catalog_list"


@pytest.mark.asyncio
async def test_full_cycle_plan_ready_then_optional_act(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    async def _mock_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return json.dumps(
            {
                "reasoning_trace": "Пустое дерево — mutate с file_create.",
                "decision_type": "mutate",
                "payload": {
                    "decision_type": "mutate",
                    "plan_nodes": [
                        {
                            "node_kind": "tool",
                            "title": "Создать документ",
                            "instruction": "Черновик",
                            "tool_name": "file_create",
                            "tool_args": {"name": "a.md", "user_line": "Черновик"},
                        }
                    ],
                },
                "plan_update_summary": "План готов.",
            }
        )

    persisted: list[list[dict[str, Any]]] = []

    async def _persist(nodes: list[dict[str, Any]]) -> None:
        persisted.append(nodes)

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

    result = await run_decision_to_action_cycle(
        context=_ctx(status="planning", tree_summary={"pending": 0, "completed": 0}),
        session_id="sess-k1-1",
        principal_id="p-k1",
        expected_revision=4,
        correlation_id="corr-plan",
        llm_complete=_mock_llm,
        apply_transition=_apply,
        persist_plan=_persist,
        dispatch_act=None,
    )

    assert result.think_event.kind == "think_succeeded"
    assert result.transition_name == "plan_ready"
    assert applied == ["plan_ready"]
    assert len(persisted) == 1
    assert result.outcome == "plan_ready"
    assert result.act_called is False
    assert result.session is not None
    assert result.session.get("status") == "executing"


@pytest.mark.asyncio
async def test_full_cycle_hitl_no_act(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    async def _mock_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return json.dumps(
            {
                "reasoning_trace": "Нужно уточнение.",
                "decision_type": "intervene",
                "payload": {
                    "decision_type": "intervene",
                    "gate_json": {"kind": "freeform", "prompt": "Уточните цель"},
                },
                "plan_update_summary": "HITL",
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
            kind="transition_applied",
            revision_after=5,
            payload={
                "event": cmd.payload.get("event"),
                "to": "awaiting_human",
                "session": {"status": "awaiting_human", "session_revision": 5},
            },
        )

    result = await run_decision_to_action_bridge(
        context=_ctx(status="planning"),
        session_id="sess-k1-1",
        principal_id="p-k1",
        expected_revision=4,
        correlation_id="corr-hitl",
        llm_complete=_mock_llm,
        apply_transition=_apply,
        dispatch_act=_dispatch,
    )

    assert result.think_event.kind == "think_needs_clarification"
    assert result.transition_name == "needs_clarification"
    assert result.outcome == "hitl"
    assert result.act_called is False
    assert acts == []


@pytest.mark.asyncio
async def test_handle_think_request_export_still_pure() -> None:
    """Smoke: Decision Engine entry remains importable without Act side effects."""

    assert callable(handle_think_request)
