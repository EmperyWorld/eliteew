# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioural tests for unified ``workflow_registry`` (Phase 4.1).
# Related:
# - api/ewa_platform/companion/orchestration/workflow_registry.py
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.orchestration import workflow_registry as wr


@pytest.mark.unit
def test_reflect_week_catalog_definition_tags() -> None:
    definition = wr.reflect_week_catalog_definition()
    assert definition.workflow_id == "reflect_week"
    assert wr.CHAT_LLM_TAG in definition.tags
    assert definition.steps[0].kind == "llm_compose"


@pytest.mark.unit
def test_match_chat_workflow_from_line_reflect_week() -> None:
    assert wr.match_chat_workflow_from_line("Подведи итоги недели") == "reflect_week"
    assert wr.match_chat_workflow_from_line("hello") is None


@pytest.mark.unit
def test_effective_workflow_enabled_reflect_week_env(monkeypatch: pytest.MonkeyPatch) -> None:
    definition = wr.reflect_week_catalog_definition()
    monkeypatch.delenv("EWA_COMPANION_WORKFLOW_REFLECT_WEEK_ENABLED", raising=False)
    assert wr.effective_workflow_enabled(definition) is False
    monkeypatch.setenv("EWA_COMPANION_WORKFLOW_REFLECT_WEEK_ENABLED", "1")
    assert wr.effective_workflow_enabled(definition) is True


@pytest.mark.unit
def test_workflow_runtime_kind_reflect_week() -> None:
    assert wr.workflow_runtime_kind("reflect_week") == wr.WorkflowRuntimeKind.CHAT_LLM
    assert wr.workflow_runtime_kind("music_full_cycle_v1") == wr.WorkflowRuntimeKind.ACTION
