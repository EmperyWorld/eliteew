# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for research-first empty-tree Think contract and expert hero defaults.
# Related:
# - api/ewa_platform/agentic/kernel/research_plan_contract.py
# - api/ewa_platform/agentic/orchestration/expert_chat_bridge.py
# - api/ewa_platform/agentic/tools/profiles.py
# ---

from __future__ import annotations

from types import SimpleNamespace

from api.ewa_platform.agentic.kernel.research_plan_contract import (
    goal_looks_like_research,
    goal_looks_like_study_folder,
    research_empty_tree_requires_expert,
    study_folder_empty_tree_requires_extract,
)
from api.ewa_platform.agentic.orchestration.expert_chat_bridge import (
    DEFAULT_AGENTIC_EXPERT_HEROES,
    build_agentic_ensemble_user_prompt,
    sanitize_agentic_expert_roles,
)
from api.ewa_platform.agentic.tools.profiles import TOOL_PROFILES, resolve_tools_allowlist
from api.services.desktop_chat_ensemble.settings import ALLOWED_DESKTOP_HERO_IDS


def test_goal_looks_like_research_keywords() -> None:
    assert goal_looks_like_research("Проведи исследование рынка и анализ конкурентов")
    assert goal_looks_like_research("Create two documents after expert review")
    assert not goal_looks_like_research("создай короткий файл заметки")


def test_research_contract_rejects_file_create_only() -> None:
    nodes = [SimpleNamespace(tool_name="file_create", node_kind="tool")]
    err = research_empty_tree_requires_expert(
        goal_text="Исследование + два документа: правила и тезисный план",
        allowlist={"call_expert_chat", "file_create"},
        nodes=nodes,
    )
    assert err == "research_plan_requires_expert_chat_before_file_create"


def test_research_contract_ok_with_expert() -> None:
    nodes = [
        SimpleNamespace(tool_name="call_expert_chat", node_kind="expert_chat"),
        SimpleNamespace(tool_name="file_create", node_kind="tool"),
    ]
    assert (
        research_empty_tree_requires_expert(
            goal_text="Исследование с экспертами Desktop AI Chat",
            allowlist={"call_expert_chat", "file_create"},
            nodes=nodes,
        )
        is None
    )


def test_research_contract_rejects_expert_after_file_create() -> None:
    nodes = [
        SimpleNamespace(tool_name="file_create", node_kind="tool"),
        SimpleNamespace(tool_name="call_expert_chat", node_kind="expert_chat"),
    ]
    err = research_empty_tree_requires_expert(
        goal_text="Исследование + два документа: правила и тезисный план",
        allowlist={"call_expert_chat", "file_create"},
        nodes=nodes,
    )
    assert err == "research_plan_requires_expert_chat_before_file_create"


def test_research_contract_skipped_without_allowlist_tool() -> None:
    nodes = [SimpleNamespace(tool_name="file_create", node_kind="tool")]
    assert (
        research_empty_tree_requires_expert(
            goal_text="Исследование рынка",
            allowlist={"file_create"},
            nodes=nodes,
        )
        is None
    )


def test_sanitize_agentic_expert_roles_drops_aliases() -> None:
    roles = sanitize_agentic_expert_roles(["analyst", "strategist", "likiy_sorrento"])
    assert roles == ["likiy_sorrento"]
    assert all(r in ALLOWED_DESKTOP_HERO_IDS for r in sanitize_agentic_expert_roles([]))
    assert sanitize_agentic_expert_roles([]) == list(DEFAULT_AGENTIC_EXPERT_HEROES)


def test_build_agentic_ensemble_user_prompt_includes_goal() -> None:
    text = build_agentic_ensemble_user_prompt(
        user_prompt="Собери тезисы",
        goal_text="Два документа и исследование",
        plan_titles=["Эксперты", "Файл правил"],
    )
    assert "Mission goal:" in text
    assert "Research brief:" in text
    assert "Эксперты" in text


def test_research_and_orchestrator_profiles_include_expert_and_files() -> None:
    research = TOOL_PROFILES["research"]
    orch = TOOL_PROFILES["orchestrator"]
    assert "call_expert_chat" in research
    assert "file_create" in research
    assert "document_extractor" in research
    assert "call_expert_chat" in orch
    assert "file_create" in orch
    assert "document_extractor" in orch
    assert resolve_tools_allowlist({"tools_profile": "research"}) == research


def test_study_folder_contract_rejects_catalog_list_only() -> None:
    assert goal_looks_like_study_folder("Изучи в папке информацию про Платформа EliteEW")
    nodes = [SimpleNamespace(tool_name="catalog_list", node_kind="tool")]
    err = study_folder_empty_tree_requires_extract(
        goal_text="Изучи в папке информацию про Платформа EliteEW",
        allowlist={"catalog_list", "document_extractor", "file_create"},
        nodes=nodes,
    )
    assert err == "study_folder_requires_catalog_then_extract"


def test_study_folder_contract_ok_with_extract() -> None:
    nodes = [
        SimpleNamespace(tool_name="catalog_list", node_kind="tool"),
        SimpleNamespace(tool_name="document_extractor", node_kind="tool"),
    ]
    assert (
        study_folder_empty_tree_requires_extract(
            goal_text="Изучи в папке информацию про Платформа EliteEW",
            allowlist={"catalog_list", "document_extractor"},
            nodes=nodes,
        )
        is None
    )
