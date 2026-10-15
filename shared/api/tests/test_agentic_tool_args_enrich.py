# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for agentic tool_args user_line enrichment before L3 validation.
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.agentic.kernel.engine import validate_think_v1
from api.ewa_platform.agentic.kernel.think_command_v1 import AgenticStructuredThinkOutput
from api.ewa_platform.agentic.kernel.tool_args_enrich import (
    enrich_tool_args,
    expert_research_text_from_session,
    goal_text_from_session,
    unified_content_id_from_session,
)
from api.ewa_platform.agentic.kernel.tool_args_validate import validate_tool_args_for_registry
from api.ewa_platform.agentic.kernel.types import AgenticContext


def test_enrich_tool_args_injects_session_goal() -> None:
    out = enrich_tool_args("catalog_list", {"mode": "search"}, user_line="Kora DVFU roadmap")
    assert out["user_line"] == "Kora DVFU roadmap"
    assert out["mode"] == "browse"


def test_enrich_catalog_list_keeps_search_when_query_present() -> None:
    out = enrich_tool_args(
        "catalog_list",
        {"mode": "search", "file_query": "contract"},
        user_line="find contract",
    )
    assert out["mode"] == "search"


def test_enrich_tool_args_prefers_node_instruction_when_goal_empty() -> None:
    out = enrich_tool_args(
        "llm_summarize",
        {},
        user_line="",
        node_instruction="Summarize market brief",
    )
    assert out["user_line"] == "Summarize market brief"


def test_enrich_file_create_prefers_instruction_over_goal() -> None:
    out = enrich_tool_args(
        "file_create",
        {"name": "rules.txt"},
        user_line="Long mission goal about many deliverables",
        node_instruction="Write detailed work rules for Zera and Tanya",
    )
    assert "Write detailed work rules" in out["user_line"]
    assert "Mission context:" in out["user_line"]


def test_enrich_file_create_preserves_request_before_expert_research() -> None:
    session = {
        "working_memory_json": {
            "last_expert_research_text": "## Findings\n- A\n- B\n" + ("x" * 100),
        }
    }
    out = enrich_tool_args(
        "file_create",
        {"name": "plan.md", "use_expert_research": True},
        user_line="Create presentation theses",
        node_instruction="Tezisy for EliteEW deck",
        session=session,
    )
    assert out["user_line"].startswith("Document request:")
    assert "Tezisy for EliteEW deck" in out["user_line"]
    assert "\n\nResearch context:\n## Findings" in out["user_line"]


def test_enrich_file_create_clips_research_after_preserving_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_DOC_CREATE_CONTEXT_MAX_CHARS", "12000")
    request = "Write the authoritative launch plan with all acceptance criteria."
    session = {
        "working_memory_json": {
            "last_expert_research_text": "RESEARCH_START\n" + ("x" * 24_000) + "\nRESEARCH_END",
        }
    }
    out = enrich_tool_args(
        "file_create",
        {"name": "launch.md", "use_expert_research": True},
        user_line=request,
        session=session,
    )
    assert out["user_line"].startswith(f"Document request:\n{request}")
    assert "RESEARCH_START" in out["user_line"]
    assert "RESEARCH_END" not in out["user_line"]
    assert len(out["user_line"]) == 12_000


def test_enrich_file_create_skips_research_without_flag() -> None:
    session = {
        "working_memory_json": {
            "last_expert_research_text": "## Findings\n- A\n- B\n" + ("x" * 100),
        }
    }
    out = enrich_tool_args(
        "file_create",
        {"name": "rules.md", "use_expert_research": False},
        user_line="Write work rules",
        node_instruction="Правила работы Зеры и Тани",
        session=session,
    )
    assert not out["user_line"].startswith("Research context:")
    assert "Правила работы" in out["user_line"]
    assert out.get("use_expert_research") is False


def test_enrich_file_create_classify_sot_overrides_think_false_on_research() -> None:
    """Continue/act path: Think false must not skip inject for research deliverables."""

    session = {
        "working_memory_json": {
            "last_expert_research_text": "## World bible draft\n- Regions\n- Factions\n",
        }
    }
    out = enrich_tool_args(
        "file_create",
        {"name": "World_Bible.md", "use_expert_research": False},
        user_line="mission goal",
        node_instruction="Собери world bible и character sheets по исследованию экспертов",
        session=session,
    )
    assert out.get("use_expert_research") is True
    assert "Research context:" in out["user_line"] or "Document request:" in out["user_line"]
    assert "World bible draft" in out["user_line"]


def test_enrich_document_extractor_inherits_from_catalog_hits() -> None:
    session = {
        "working_memory_json": {
            "last_catalog_hits": [
                {"unified_content_id": "uid-hit-1", "name": "EliteEW.md"},
                {"unified_content_id": "uid-hit-2", "name": "other.md"},
            ]
        }
    }
    out = enrich_tool_args(
        "document_extractor",
        {"user_line": "extract"},
        user_line="extract",
        session=session,
    )
    assert out["unified_content_id"] == "uid-hit-1"


def test_expert_research_text_from_session() -> None:
    assert expert_research_text_from_session({"working_memory_json": {"last_expert_research_text": "abc"}}) == "abc"


def test_validate_tool_args_for_registry_accepts_missing_user_line_with_goal() -> None:
    normalized = validate_tool_args_for_registry(
        "catalog_list",
        {"mode": "search"},
        user_line="quantum computing",
    )
    assert normalized["user_line"] == "quantum computing"
    assert normalized["mode"] == "browse"


def test_validate_think_v1_enriches_continue_without_user_line() -> None:
    v1 = AgenticStructuredThinkOutput.model_validate(
        {
            "reasoning_trace": "search catalogs",
            "decision_type": "continue",
            "payload": {
                "decision_type": "continue",
                "tool_name": "catalog_list",
                "tool_args": {"mode": "search"},
            },
            "plan_update_summary": "searching",
        }
    )
    ctx = AgenticContext(
        session={
            "id": "sess-1",
            "goal_json": {"text": "Study DVFU AI programs"},
            "policy_json": {},
        },
        active_nodes=[],
        tree_summary={},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )
    validate_think_v1(v1, ctx)
    assert v1.payload.tool_args["user_line"] == "Study DVFU AI programs"  # type: ignore[union-attr]


def test_goal_text_from_session_reads_user_message_fallback() -> None:
    assert goal_text_from_session({"goal_json": {"user_message": "hello"}}) == "hello"


def test_enrich_document_extractor_inherits_unified_content_id_from_policy() -> None:
    session = {"policy_json": {"unified_content_id": "uid-abc-123"}}
    out = enrich_tool_args(
        "document_extractor",
        {"user_line": "extract"},
        user_line="extract",
        session=session,
    )
    assert out["unified_content_id"] == "uid-abc-123"


def test_unified_content_id_from_driver_snapshot() -> None:
    session = {
        "working_memory_json": {
            "driver_snapshot": {"unified_content_id": "uid-from-driver"},
        }
    }
    assert unified_content_id_from_session(session) == "uid-from-driver"


def test_enrich_call_expert_chat_inherits_unified_content_id_from_policy() -> None:
    session = {"policy_json": {"unified_content_id": "uid-after-create"}}
    out = enrich_tool_args(
        "call_expert_chat",
        {"user_line": "уточни бренд в документе", "expert_roles": ["akimbo"]},
        user_line="уточни бренд",
        session=session,
    )
    assert out["unified_content_id"] == "uid-after-create"


@pytest.mark.parametrize("tool_name", ["check_task_status", "operations_status"])
def test_enrich_skips_optional_user_line_tools(tool_name: str) -> None:
    out = enrich_tool_args(tool_name, {}, user_line="ignored")
    assert out.get("user_line") in (None, "", "ignored") or "user_line" not in out
