# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Stack0 smoke contract tests mapping master-plan §12 (workflow triggers + admin catalog).
# Related:
# - documentation/product/ewa/EWA-COMPANION-ADMIN-SMOKE-STACK0.md
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.orchestration.tool_catalog_v2 import export_tool_catalog
from api.ewa_platform.companion.workflows.action import triggers as action_triggers


@pytest.mark.unit
def test_smoke_music_generation_exposed_in_tool_catalog() -> None:
    """§12 step 5: music_generation visible with router_exposed for admin Tools tab."""

    names = {e["name"]: e for e in export_tool_catalog()}
    assert "music_generation" in names
    assert names["music_generation"]["router_exposed"] is True


@pytest.mark.unit
def test_smoke_full_cycle_trigger_phrase_when_gates_on(monkeypatch: pytest.MonkeyPatch) -> None:
    """§12 step 2: canonical operator phrase matches music_full_cycle_v1."""

    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_MUSIC_FULL_V1", "1")
    line = "Сгенерируй песню про закат и включи когда будет готово"
    wf = action_triggers.match_action_workflow(line)
    assert wf is not None
    assert wf.workflow_id == "music_full_cycle_v1"


@pytest.mark.unit
def test_smoke_full_cycle_falls_through_when_music_gate_off(monkeypatch: pytest.MonkeyPatch) -> None:
    """§12 step 7: disabling env gate → no workflow match (atomic router path)."""

    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_MUSIC_FULL_V1", "0")
    line = "Сгенерируй песню про закат и включи когда будет готово"
    assert action_triggers.match_action_workflow(line) is None
