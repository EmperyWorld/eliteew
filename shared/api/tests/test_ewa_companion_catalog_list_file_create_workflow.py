# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioural tests for Phase 4.3 dev workflow catalog_list → file_create.
# Related:
# - api/ewa_platform/companion/workflows/action/registry.py
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.workflows.action import registry as action_registry
from api.ewa_platform.companion.workflows.action import triggers as action_triggers


@pytest.mark.unit
def test_catalog_list_file_create_dev_registered() -> None:
    wf = action_registry.get_builtin_workflow("catalog_list_file_create_dev_v1")
    assert wf is not None
    assert wf.workflow_id == "catalog_list_file_create_dev_v1"
    assert wf.env_gate == "EWA_COMPANION_WF_CATALOG_LIST_FILE_CREATE_DEV"
    assert len(wf.steps) == 2
    assert wf.steps[0].tool_name == "catalog_list"
    assert wf.steps[1].tool_name == "file_create"
    assert wf.steps[1].requires_confirm is True


@pytest.mark.unit
def test_match_catalog_list_file_create_dev_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_CATALOG_LIST_FILE_CREATE_DEV", "1")
    wf = action_triggers.match_action_workflow("Покажи файлы и создай заметку про неделю")
    assert wf is not None
    assert wf.workflow_id == "catalog_list_file_create_dev_v1"


@pytest.mark.unit
def test_match_catalog_list_file_create_dev_off_without_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_WF_ENGINE_ENABLED", raising=False)
    monkeypatch.delenv("EWA_COMPANION_WF_CATALOG_LIST_FILE_CREATE_DEV", raising=False)
    assert action_triggers.match_action_workflow("Покажи файлы и создай заметку") is None
