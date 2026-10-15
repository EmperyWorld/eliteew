# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# K0 locks: Decision Engine isolation + ThinkRequest→ThinkSucceeded + FSM preview mapping.
# Related:
# - api/ewa_platform/agentic/kernel/decision_engine.py
# - api/ewa_platform/agentic/kernel/fsm_port.py
# - documentation/product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md §K0
# ---

from __future__ import annotations

import ast
import json
from pathlib import Path

import pytest

from api.ewa_platform.agentic.kernel.decision_engine import (
    build_think_request,
    handle_think_request,
)
from api.ewa_platform.agentic.kernel.fsm_port import (
    build_apply_transition,
    preview_apply_transition,
    think_to_transition_event,
)
from api.ewa_platform.agentic.kernel.types import AgenticContext, KernelCommand, KernelEvent

_KERNEL_DIR = Path(__file__).resolve().parents[1] / "ewa_platform" / "agentic" / "kernel"


def _decision_engine_source() -> str:
    return (_KERNEL_DIR / "decision_engine.py").read_text(encoding="utf-8")


def _imported_module_names(source: str) -> set[str]:
    tree = ast.parse(source)
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                names.add(alias.name.split(".")[0])
                names.add(alias.name)
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            names.add(mod)
            for alias in node.names:
                names.add(f"{mod}.{alias.name}" if mod else alias.name)
    return names


def _ctx(
    *,
    status: str = "executing",
    tree_summary: dict[str, int] | None = None,
) -> AgenticContext:
    return AgenticContext(
        session={
            "id": "sess-k0-1",
            "principal_id": "p-k0",
            "status": status,
            "session_revision": 2,
            "goal_json": {"text": "Найти файлы по квантовым вычислениям"},
            "plan_summary": "",
            "policy_json": {},
        },
        active_nodes=[],
        tree_summary=tree_summary or {"pending": 0, "completed": 1},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )


def test_decision_engine_module_has_no_fsm_or_act_imports() -> None:
    """Isolation lock: Decision Engine must not reach FSM apply or tool Act."""

    src = _decision_engine_source()
    imports = _imported_module_names(src)
    forbidden_substrings = (
        "state_machine",
        "fsm_port",
        "agentic.kernel.loop",
        "agentic_dispatch_tool",
        "dispatch_tool_by_name",
    )
    joined = " ".join(sorted(imports))
    for needle in forbidden_substrings:
        assert needle not in joined, f"forbidden import residue: {needle} in {joined}"

    tree = ast.parse(src)
    call_names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Name):
                call_names.add(func.id)
            elif isinstance(func, ast.Attribute):
                call_names.add(func.attr)
    assert "apply_session_transition" not in call_names
    assert "agentic_dispatch_tool" not in call_names
    assert "dispatch_tool_by_name" not in call_names


def test_kernel_command_event_envelope_shape() -> None:
    cmd = KernelCommand(
        session_id="s1",
        principal_id="p1",
        expected_revision=1,
        correlation_id="corr-1",
        kind="think_request",
        payload={"context": _ctx()},
    )
    assert cmd.kind == "think_request"
    ev = KernelEvent(
        session_id="s1",
        correlation_id="corr-1",
        kind="think_succeeded",
        payload={"decision_type": "continue"},
        revision_after=None,
    )
    assert ev.error_code is None
    assert ev.revision_after is None


@pytest.mark.asyncio
async def test_handle_think_request_succeeds_isolated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    async def _mock_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return json.dumps(
            {
                "reasoning_trace": "Нужен поиск в каталоге.",
                "decision_type": "continue",
                "payload": {
                    "decision_type": "continue",
                    "tool_name": "catalog_list",
                    "tool_args": {"user_line": "quantum", "mode": "search"},
                },
                "plan_update_summary": "Ищем в каталоге.",
            }
        )

    cmd = build_think_request(
        session_id="sess-k0-1",
        principal_id="p-k0",
        expected_revision=2,
        correlation_id="tick-1",
        context=_ctx(status="executing"),
    )
    event = await handle_think_request(cmd, llm_complete=_mock_llm)

    assert event.kind == "think_succeeded"
    assert event.error_code is None
    assert event.revision_after is None  # Decision never bumps revision
    assert event.payload["decision_type"] == "continue"
    assert event.payload["loop_action"] == "act"
    assert event.payload["loop_output"]["act_tool_name"] == "catalog_list"
    assert event.payload["plan_mutation_proposal"] is None


@pytest.mark.asyncio
async def test_handle_think_request_parse_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    async def _bad_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return "not-json-at-all"

    cmd = build_think_request(
        session_id="sess-k0-1",
        principal_id="p-k0",
        expected_revision=2,
        correlation_id="tick-bad",
        context=_ctx(),
    )
    event = await handle_think_request(cmd, llm_complete=_bad_llm)
    assert event.kind == "think_parse_failed"
    assert event.error_code
    assert event.revision_after is None


@pytest.mark.asyncio
async def test_handle_think_intervene_emits_needs_clarification(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    async def _mock_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return json.dumps(
            {
                "reasoning_trace": "Нужно уточнение у человека.",
                "decision_type": "intervene",
                "payload": {
                    "decision_type": "intervene",
                    "gate_json": {
                        "kind": "freeform",
                        "prompt": "Уточните цель документа",
                    },
                },
                "plan_update_summary": "Ждём HITL.",
            }
        )

    cmd = build_think_request(
        session_id="sess-k0-1",
        principal_id="p-k0",
        expected_revision=2,
        correlation_id="tick-hitl",
        context=_ctx(status="planning", tree_summary={"pending": 0}),
    )
    event = await handle_think_request(cmd, llm_complete=_mock_llm)
    assert event.kind == "think_needs_clarification"
    assert event.payload["decision_type"] == "intervene"


def test_think_to_transition_event_mapping() -> None:
    assert (
        think_to_transition_event(
            current_status="planning",
            decision_type="mutate",
            loop_action="plan",
            has_plan_nodes=True,
        )
        == "plan_ready"
    )
    assert (
        think_to_transition_event(
            current_status="planning",
            decision_type="intervene",
            loop_action="gate",
        )
        == "needs_clarification"
    )
    assert (
        think_to_transition_event(
            current_status="executing",
            decision_type="intervene",
            loop_action="clarify",
        )
        == "gate_required"
    )
    assert (
        think_to_transition_event(
            current_status="executing",
            decision_type="terminate",
            loop_action="complete",
        )
        == "step_ok_done"
    )
    assert (
        think_to_transition_event(
            current_status="executing",
            decision_type="continue",
            loop_action="act",
        )
        == "act_authorized"
    )
    assert (
        think_to_transition_event(
            current_status="awaiting_human",
            decision_type="continue",
            loop_action="act",
        )
        is None
    )


def test_preview_apply_transition_accepts_and_rejects() -> None:
    ok = preview_apply_transition(
        session_id="s1",
        correlation_id="c1",
        current_status="planning",
        event="plan_ready",
    )
    assert ok.kind == "transition_applied"
    assert ok.payload["to"] == "executing"
    assert ok.payload.get("preview") is True

    bad = preview_apply_transition(
        session_id="s1",
        correlation_id="c1",
        current_status="completed",
        event="start",
    )
    assert bad.kind == "transition_rejected"
    assert bad.error_code and "illegal_transition" in bad.error_code


def test_build_apply_transition_envelope() -> None:
    cmd = build_apply_transition(
        session_id="s1",
        principal_id="p1",
        expected_revision=3,
        correlation_id="c2",
        event="plan_ready",
        plan_summary="Готово",
    )
    assert cmd.kind == "apply_transition"
    assert cmd.payload["event"] == "plan_ready"
    assert cmd.expected_revision == 3


@pytest.mark.asyncio
async def test_think_then_fsm_preview_pipeline(monkeypatch: pytest.MonkeyPatch) -> None:
    """Coordinator-shaped pipeline without touching loop.py or DB."""

    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setenv("EWA_AGENTIC_THINK_LLM_ENABLED", "1")

    async def _mock_llm(_messages: list[dict[str, str]], _model: str) -> str:
        return json.dumps(
            {
                "reasoning_trace": "Пустое дерево — нужен executable mutate.",
                "decision_type": "mutate",
                "payload": {
                    "decision_type": "mutate",
                    "plan_nodes": [
                        {
                            "node_kind": "tool",
                            "title": "Создать документ",
                            "instruction": "Черновик",
                            "tool_name": "file_create",
                            "tool_args": {"name": "doc.md", "user_line": "Черновик"},
                        }
                    ],
                },
                "plan_update_summary": "План с file_create.",
            }
        )

    ctx = _ctx(status="planning", tree_summary={"pending": 0, "completed": 0, "running": 0})
    think_cmd = build_think_request(
        session_id="sess-k0-1",
        principal_id="p-k0",
        expected_revision=2,
        correlation_id="tick-pipe",
        context=ctx,
    )
    thought = await handle_think_request(think_cmd, llm_complete=_mock_llm)
    assert thought.kind == "think_succeeded"
    assert thought.payload["decision_type"] == "mutate"

    event_name = think_to_transition_event(
        current_status="planning",
        decision_type=str(thought.payload["decision_type"]),
        loop_action=str(thought.payload["loop_action"]),
        has_plan_nodes=bool(thought.payload.get("plan_mutation_proposal")),
    )
    assert event_name == "plan_ready"

    preview = preview_apply_transition(
        session_id=thought.session_id,
        correlation_id=thought.correlation_id,
        current_status="planning",
        event=event_name,
    )
    assert preview.kind == "transition_applied"
    assert preview.payload["to"] == "executing"
