# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for WF-0: tool catalog v2 metadata sync with ``REGISTRY`` and Tool Router allowlists;
# workflow Pydantic schema roundtrip and tool reference validation.
# Related:
# - api/ewa_platform/companion/orchestration/tool_catalog_v2.py
# - api/ewa_platform/schemas/pydantic/companion_workflow.py
# ---

from __future__ import annotations

import json
from pathlib import Path

import pytest

from api.ewa_platform.companion.orchestration import tool_registry as reg
from api.ewa_platform.companion.orchestration.tool_catalog_v2 import (
    export_tool_catalog,
    router_allowlist_contract_errors,
    tool_descriptor_v2,
)
from api.ewa_platform.schemas.pydantic.companion_tool_router import ROUTER_FULL_TOOLS, ROUTER_PARTIAL_TOOLS
from api.ewa_platform.schemas.pydantic.companion_workflow import (
    CompanionWorkflowDefinitionV1,
    extract_workflow_tool_names,
    validate_workflow_tools_registered,
)

_JSON_SCHEMA_PATH = (
    Path(__file__).resolve().parents[1] / "ewa_platform" / "schemas" / "json" / "companion_workflow_v1.json"
)


@pytest.mark.unit
def test_tool_v2_meta_covers_registry() -> None:
    errors = router_allowlist_contract_errors()
    assert errors == [], f"catalog contract errors: {errors}"


@pytest.mark.unit
def test_router_allowlists_subset_of_registry() -> None:
    names = set(reg.known_tool_names())
    for tool in ROUTER_PARTIAL_TOOLS:
        assert tool in names, f"ROUTER_PARTIAL_TOOLS tool {tool!r} missing from REGISTRY"


@pytest.mark.unit
def test_intent_planner_dispatch_tools_subset_of_registry_and_shell_guards() -> None:
    from api.ewa_platform.schemas.pydantic.companion_intent import INTENT_PLANNER_DISPATCH_TOOLS

    names = set(reg.known_tool_names())
    shell_only = frozenset({"chat_only", "doc_edit_requires_open_editor"})
    for tool in INTENT_PLANNER_DISPATCH_TOOLS:
        assert tool in names or tool in shell_only, (
            f"INTENT_PLANNER_DISPATCH_TOOLS tool {tool!r} missing from REGISTRY and shell guards"
        )


@pytest.mark.unit
def test_router_full_tools_subset_of_registry() -> None:
    names = set(reg.known_tool_names())
    for tool in ROUTER_FULL_TOOLS:
        assert tool in names, f"ROUTER_FULL_TOOLS tool {tool!r} missing from REGISTRY"


@pytest.mark.unit
def test_export_tool_catalog_sorted_and_complete() -> None:
    catalog = export_tool_catalog()
    names = [e["name"] for e in catalog]
    assert names == sorted(names)
    assert set(names) == set(reg.known_tool_names())
    music = next(e for e in catalog if e["name"] == "music_generation")
    assert music["capability"] == "music"
    assert music["execution_mode"] == "async"
    assert music["router_exposed"] is True
    assert music["router_partial"] is True
    assert "music_generation_pipeline_v2" in music["step_kinds"]
    image = next(e for e in catalog if e["name"] == "image_generation")
    assert image["capability"] == "image"
    assert image["router_exposed"] is True
    assert image["router_partial"] is False
    presentation = next(e for e in catalog if e["name"] == "presentation_generation")
    assert presentation["capability"] == "presentation"
    assert presentation["router_exposed"] is True
    assert presentation["router_partial"] is False
    operations_status = next(e for e in catalog if e["name"] == "operations_status")
    assert operations_status["capability"] == "operations"
    assert operations_status["router_exposed"] is True
    operation_cancel = next(e for e in catalog if e["name"] == "operation_cancel")
    assert operation_cancel["capability"] == "operations"
    assert operation_cancel["router_exposed"] is True


@pytest.mark.unit
def test_tool_descriptor_v2_handler_flags() -> None:
    desc = tool_descriptor_v2("music_generation")
    assert desc is not None
    assert desc.handler_registered is True
    assert desc.router_exposed is True


@pytest.mark.unit
def test_workflow_definition_pilot_json_roundtrip() -> None:
    raw = {
        "workflow_id": "music_full_cycle_v1",
        "version": 1,
        "title_ru": "Полный цикл музыки",
        "title_en": "Music full cycle",
        "enabled": False,
        "execution_mode": "async",
        "env_gate": "EWA_COMPANION_WF_MUSIC_FULL_V1",
        "triggers": [{"type": "regex", "pattern": "(?i)сгенерируй.*и\\s+включи"}],
        "steps": [
            {
                "step_key": "generate",
                "kind": "tool",
                "tool_name": "music_generation",
                "title_ru": "Генерация",
            },
            {
                "step_key": "confirm_play",
                "kind": "confirm_gate",
                "title_ru": "Подтверждение воспроизведения",
            },
        ],
    }
    model = CompanionWorkflowDefinitionV1.model_validate(raw)
    assert model.workflow_id == "music_full_cycle_v1"
    assert extract_workflow_tool_names(model) == ("music_generation",)
    tool_errors = validate_workflow_tools_registered(model, registered_tools=frozenset(reg.known_tool_names()))
    assert tool_errors == []


@pytest.mark.unit
def test_workflow_rejects_unknown_tool() -> None:
    raw = {
        "workflow_id": "bad_wf_v1",
        "version": 1,
        "title_ru": "x",
        "title_en": "x",
        "triggers": [{"type": "manual_admin"}],
        "steps": [{"step_key": "a", "kind": "tool", "tool_name": "nonexistent_tool_xyz"}],
    }
    model = CompanionWorkflowDefinitionV1.model_validate(raw)
    errors = validate_workflow_tools_registered(model, registered_tools=frozenset(reg.known_tool_names()))
    assert any("nonexistent_tool_xyz" in e for e in errors)


@pytest.mark.unit
def test_workflow_json_schema_file_matches_pydantic() -> None:
    assert _JSON_SCHEMA_PATH.is_file(), f"missing {_JSON_SCHEMA_PATH}"
    on_disk = json.loads(_JSON_SCHEMA_PATH.read_text(encoding="utf-8"))
    generated = CompanionWorkflowDefinitionV1.model_json_schema()
    assert on_disk.get("title") == generated.get("title") or "$defs" in on_disk
    assert "workflow_id" in json.dumps(on_disk)
