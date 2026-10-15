# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression locks for empty-tree Think structural repair and heuristic executable bootstrap.
# Related:
# - api/ewa_platform/agentic/kernel/engine.py
# - api/ewa_platform/agentic/kernel/prompt_builder.py
# ---

from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.agentic.kernel.engine import (
    EMPTY_TREE_EXECUTABLE_MUTATE_HINT,
    assemble_think_messages,
    invoke_think_llm,
)
from api.ewa_platform.agentic.kernel.prompt_builder import (
    EMPTY_TREE_PLANNING_CONTRACT_LINE,
    ThinkPromptBuilder,
)
from api.ewa_platform.agentic.kernel.think_schema_v1 import ThinkSchemaError
from api.ewa_platform.agentic.kernel.types import AgenticContext


def _empty_planning_ctx(*, policy: dict | None = None) -> AgenticContext:
    return AgenticContext(
        session={
            "id": "sess-think",
            "status": "planning",
            "session_revision": 1,
            "goal_json": {"text": "Составь два документа: правила и дорожную карту"},
            "policy_json": policy
            or {
                "tools_allowlist": ["file_create", "catalog_list", "llm_summarize"],
            },
        },
        active_nodes=[],
        tree_summary={},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )


def _subtask_only_mutate_json() -> str:
    return json.dumps(
        {
            "reasoning_trace": "decompose",
            "decision_type": "mutate",
            "payload": {
                "decision_type": "mutate",
                "plan_nodes": [
                    {
                        "node_kind": "subtask",
                        "title": "Анализ",
                        "instruction": "подумать",
                        "tool_name": None,
                        "tool_args": {},
                    }
                ],
            },
            "plan_update_summary": "план",
        },
        ensure_ascii=False,
    )


def _executable_mutate_json() -> str:
    return json.dumps(
        {
            "reasoning_trace": "create first doc",
            "decision_type": "mutate",
            "payload": {
                "decision_type": "mutate",
                "plan_nodes": [
                    {
                        "node_kind": "tool",
                        "title": "Правила работы",
                        "instruction": "создать документ правил",
                        "tool_name": "file_create",
                        "tool_args": {"name": "правила.md", "user_line": "правила"},
                    }
                ],
            },
            "plan_update_summary": "создаю документ",
        },
        ensure_ascii=False,
    )


def test_assemble_think_messages_includes_empty_tree_contract() -> None:
    msgs = assemble_think_messages(_empty_planning_ctx())
    system = msgs[0]["content"]
    user = msgs[1]["content"]
    assert EMPTY_TREE_EXECUTABLE_MUTATE_HINT in system
    assert EMPTY_TREE_PLANNING_CONTRACT_LINE in user


def test_prompt_builder_emits_empty_tree_contract_section() -> None:
    formatted = ThinkPromptBuilder.build(_empty_planning_ctx(), system_content="sys")
    assert formatted.sections.empty_tree_contract == EMPTY_TREE_PLANNING_CONTRACT_LINE
    assert EMPTY_TREE_PLANNING_CONTRACT_LINE in formatted.sections.to_user_blob()


@pytest.mark.asyncio
async def test_invoke_think_llm_structural_repair_once(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.agentic.kernel import engine as engine_mod

    ctx = _empty_planning_ctx()
    monkeypatch.setattr(engine_mod, "agentic_think_llm_enabled", lambda: True)

    complete = AsyncMock(side_effect=[_subtask_only_mutate_json(), _executable_mutate_json()])
    v1, loop_out = await invoke_think_llm(ctx, llm_complete=complete)
    assert complete.await_count == 2
    assert v1.decision_type == "mutate"
    assert loop_out.action == "plan"
    assert any(
        str(getattr(n, "tool_name", None) or (n.get("tool_name") if isinstance(n, dict) else "")).strip()
        for n in loop_out.plan_nodes
    )


@pytest.mark.asyncio
async def test_invoke_think_llm_structural_repair_exhausted(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.agentic.kernel import engine as engine_mod

    ctx = _empty_planning_ctx()
    monkeypatch.setattr(engine_mod, "agentic_think_llm_enabled", lambda: True)

    complete = AsyncMock(side_effect=[_subtask_only_mutate_json(), _subtask_only_mutate_json()])
    with pytest.raises(ThinkSchemaError, match="empty_plan_mutate_requires_executable_nodes"):
        await invoke_think_llm(ctx, llm_complete=complete)
    assert complete.await_count == 2


@pytest.mark.asyncio
async def test_heuristic_empty_tree_emits_executable_tool(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.agentic.kernel import engine as engine_mod

    ctx = _empty_planning_ctx()
    monkeypatch.setattr(engine_mod, "agentic_think_llm_enabled", lambda: False)

    v1, loop_out = await invoke_think_llm(ctx)
    assert v1.decision_type == "mutate"
    assert loop_out.action == "plan"
    tools = [
        str(getattr(n, "tool_name", None) or (n.get("tool_name") if isinstance(n, dict) else "")).strip()
        for n in loop_out.plan_nodes
    ]
    assert any(tools)
    assert "file_create" in tools
