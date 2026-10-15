# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Plan-time tool_args validation — executable mutate nodes only.
# Related:
# - api/ewa_platform/agentic/kernel/plan_tool_args_prepare.py
# - api/ewa_platform/agentic/kernel/engine.py
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.agentic.kernel.engine import validate_think_v1
from api.ewa_platform.agentic.kernel.plan_tool_args_prepare import (
    PlanToolArgsError,
    infer_file_name_from_text,
    prepare_plan_node_tool_args,
)
from api.ewa_platform.agentic.kernel.think_command_v1 import AgenticStructuredThinkOutput
from api.ewa_platform.agentic.kernel.think_schema_v1 import ThinkSchemaError
from api.ewa_platform.agentic.kernel.types import AgenticContext


def test_infer_file_name_from_quoted_instruction() -> None:
    name = infer_file_name_from_text("Создать файл с названием 'Правила_работы_Талы_и_Артёма.txt' в папке")
    assert name == "Правила_работы_Талы_и_Артёма.txt"


def test_prepare_file_create_think_false_cannot_veto_research() -> None:
    args = prepare_plan_node_tool_args(
        "file_create",
        {
            "user_line": "Создать World Bible на основе методологии",
            "name": "World_Bible.md",
            "use_expert_research": False,
        },
        user_line="методологическая база и артефакты",
        instruction="Создать файл World_Bible.md на основе методологии и экспертных данных",
        title="Создание World Bible",
        session={"working_memory_json": {"last_expert_research_text": "## Фокус\nresearch blob"}},
    )
    assert args.get("use_expert_research") is True
    assert "Research context:" in str(args.get("user_line") or "") or "Document request:" in str(
        args.get("user_line") or ""
    )


def test_prepare_file_create_infers_name_from_instruction() -> None:
    args = prepare_plan_node_tool_args(
        "file_create",
        {"user_line": "Создать документ с правилами"},
        user_line="goal",
        instruction="Создать новый файл с названием 'Правила_работы.txt'",
        title="Создание документа правил",
    )
    assert args["name"] == "Правила_работы.md"
    assert args["user_line"] == "Создать документ с правилами"
    assert args.get("use_expert_research") is False


def test_prepare_file_create_slug_strips_process_prefix_to_md() -> None:
    args = prepare_plan_node_tool_args(
        "file_create",
        {"user_line": "Составить тезисный план презентации EliteEW"},
        user_line="Исследование и презентация EliteEW",
        instruction="Составить тезисный план презентации",
        title="Создание тезисного плана презентации",
    )
    assert args["name"] == "тезисного_плана_презентации.md"
    assert args.get("use_expert_research") is True


def test_prepare_call_expert_chat_forces_trio_on_research_goal() -> None:
    from api.ewa_platform.agentic.orchestration.expert_chat_bridge import DEFAULT_AGENTIC_EXPERT_HEROES

    args = prepare_plan_node_tool_args(
        "call_expert_chat",
        {"user_line": "Исследуй рынок ВУЗов", "expert_roles": ["akimbo"]},
        user_line="Исследование рынка ВУЗов и тезисный план презентации",
        instruction="Research brief",
        title="Эксперты",
        session={"goal_json": {"text": "Исследование рынка ВУЗов и тезисный план презентации"}},
    )
    assert args["expert_roles"] == list(DEFAULT_AGENTIC_EXPERT_HEROES)


def test_prepare_document_extractor_requires_content_id() -> None:
    with pytest.raises(PlanToolArgsError, match="unified_content_id"):
        prepare_plan_node_tool_args(
            "document_extractor",
            {"user_line": "Извлечь ключевые пункты"},
            user_line="goal",
            instruction="Открыть черновик",
            title="Извлечение",
        )


def test_prepare_llm_summarize_copies_runtime_text_from_instruction() -> None:
    args = prepare_plan_node_tool_args(
        "llm_summarize",
        {"user_line": "Суммаризируй документ"},
        user_line="goal",
        instruction="Сделай краткую сводку по документу",
        title="Сводка",
    )
    assert args["user_line"] == "Суммаризируй документ"
    assert args["text"] == "Суммаризируй документ"


def test_prepare_file_save_text_requires_body() -> None:
    with pytest.raises(PlanToolArgsError, match="file_save_text requires non-empty body"):
        prepare_plan_node_tool_args(
            "file_save_text",
            {"user_line": "Сохранить текст", "name": "notes.md"},
            user_line="goal",
            instruction="Записать в файл",
            title="Сохранение",
        )


def test_prepare_file_save_text_accepts_explicit_body() -> None:
    args = prepare_plan_node_tool_args(
        "file_save_text",
        {"user_line": "Сохранить", "name": "notes.md", "body": "hello"},
        user_line="goal",
        instruction="Записать",
        title="Сохранение",
    )
    assert args["body"] == "hello"
    assert args["name"] == "notes.md"


def test_prepare_file_create_multi_doc_opts_into_mission_folder() -> None:
    args = prepare_plan_node_tool_args(
        "file_create",
        {"user_line": "Создать инструкцию", "name": "Инструкция.md"},
        user_line="Два документа: инструкция и лонгрид EliteEW",
        instruction="Инструкция регистрации на платформе",
        title="Инструкция",
        mission_folder_role="create",
    )
    assert args.get("create_folder") is True
    assert str(args.get("folder_name") or "").strip()
    assert args.get("use_expert_research") is True


def test_prepare_file_create_single_doc_stays_root() -> None:
    args = prepare_plan_node_tool_args(
        "file_create",
        {"user_line": "Создать один файл", "name": "notes.md"},
        user_line="Один файл",
        instruction="Заметка",
        title="Заметка",
    )
    assert args.get("create_folder") is not True
    assert not str(args.get("folder_name") or "").strip()


def test_validate_think_v1_rejects_mutate_with_invalid_extractor() -> None:
    v1 = AgenticStructuredThinkOutput.model_validate(
        {
            "reasoning_trace": "plan",
            "decision_type": "mutate",
            "payload": {
                "decision_type": "mutate",
                "plan_nodes": [
                    {
                        "node_kind": "tool",
                        "title": "Extract draft",
                        "instruction": "extract",
                        "tool_name": "document_extractor",
                        "tool_args": {"user_line": "extract"},
                    }
                ],
            },
            "plan_update_summary": "план",
        }
    )
    ctx = AgenticContext(
        session={"id": "s1", "goal_json": {"text": "work session"}, "policy_json": {}},
        active_nodes=[],
        tree_summary={},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )
    with pytest.raises(ThinkSchemaError, match="plan_tool_args_invalid:document_extractor"):
        validate_think_v1(v1, ctx)


def test_validate_think_v1_accepts_executable_file_create_plan() -> None:
    v1 = AgenticStructuredThinkOutput.model_validate(
        {
            "reasoning_trace": "plan",
            "decision_type": "mutate",
            "payload": {
                "decision_type": "mutate",
                "plan_nodes": [
                    {
                        "node_kind": "tool",
                        "title": "Создание документа правил",
                        "instruction": "Создать файл 'Правила_работы.txt'",
                        "tool_name": "file_create",
                        "tool_args": {"user_line": "Создать документ"},
                    },
                    {
                        "node_kind": "tool",
                        "title": "Поиск DVFU",
                        "instruction": "catalog browse",
                        "tool_name": "catalog_list",
                        "tool_args": {"user_line": "Найти DVFU"},
                    },
                ],
            },
            "plan_update_summary": "план",
        }
    )
    ctx = AgenticContext(
        session={"id": "s1", "goal_json": {"text": "work session"}, "policy_json": {}},
        active_nodes=[],
        tree_summary={},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )
    validate_think_v1(v1, ctx)
    nodes = v1.payload.plan_nodes  # type: ignore[union-attr]
    assert nodes[0].tool_args["name"] == "Правила_работы.md"
    assert nodes[1].tool_args["mode"] == "browse"


def test_validate_think_v1_enriches_llm_summarize_with_runtime_text() -> None:
    v1 = AgenticStructuredThinkOutput.model_validate(
        {
            "reasoning_trace": "plan",
            "decision_type": "mutate",
            "payload": {
                "decision_type": "mutate",
                "plan_nodes": [
                    {
                        "node_kind": "llm",
                        "title": "Сводка",
                        "instruction": "Сделай сводку по найденным файлам",
                        "tool_name": "llm_summarize",
                        "tool_args": {"user_line": "Суммаризируй найденные документы"},
                    }
                ],
            },
            "plan_update_summary": "план",
        }
    )
    ctx = AgenticContext(
        session={"id": "s1", "goal_json": {"text": "work session"}, "policy_json": {}},
        active_nodes=[{"id": "n1", "status": "completed", "tool_name": "file_open"}],
        tree_summary={"completed": 1},
        checkpoints=[],
        inbound_messages=[],
        llm_messages=[],
    )
    validate_think_v1(v1, ctx)
    node = v1.payload.plan_nodes[0]  # type: ignore[union-attr]
    assert node.tool_args["text"] == "Суммаризируй найденные документы"
