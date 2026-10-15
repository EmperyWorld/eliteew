# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# WF-3 doc_package_v1 trigger + confirm flow tests (semantic boundary B/C).
# Related:
# - api/ewa_platform/companion/workflows/action/confirm_flow.py
# - api/ewa_platform/companion/workflows/action/starter.py
# ---

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.orchestration import task_run_confirm
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.action import confirm_flow, registry, starter, triggers


@pytest.mark.unit
def test_doc_package_trigger_requires_and_open_phrase(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_DOC_PACKAGE_V1", "1")
    wf = triggers.match_action_workflow("Создай документ и открой с текстом: привет")
    assert wf is not None
    assert wf.workflow_id == "doc_package_v1"
    assert triggers.match_action_workflow("Создай документ с текстом: x") is None


@pytest.mark.unit
def test_doc_package_builtin_registered() -> None:
    wf = registry.get_builtin_workflow("doc_package_v1")
    assert wf is not None
    assert wf.steps[1].args_template["payload"]["unified_content_id"] == "{{steps.0.output.unified_content_id}}"


@pytest.mark.unit
def test_start_doc_package_creates_two_step_run(monkeypatch: pytest.MonkeyPatch) -> None:
    created_steps: list[dict[str, Any]] = []

    async def fake_run_create(_pool: Any, **kwargs: Any) -> dict[str, Any]:
        return {"id": "run-doc", **kwargs}

    async def fake_step_create(_pool: Any, **kwargs: Any) -> dict[str, Any]:
        created_steps.append(dict(kwargs))
        return {"id": f"step-{len(created_steps)}", **kwargs}

    monkeypatch.setattr(starter.companion_pg, "companion_task_run_create", fake_run_create)
    monkeypatch.setattr(starter.companion_pg, "companion_task_step_create", fake_step_create)

    wf = registry.get_builtin_workflow("doc_package_v1")
    assert wf is not None
    ctx = ToolContext(
        principal_id="p1",
        user_line="Создай документ и открой с текстом: hello",
        content_catalog_user_id="catalog-user-1",
        oauth2_sub_for_content_alternate=None,
        companion_pool=MagicMock(),
    )
    out = asyncio.run(
        starter._start_doc_package_v1(
            MagicMock(),
            user_line=ctx.user_line,
            tool_ctx=ctx,
            workflow=wf,
        ),
    )
    assert out is not None
    assert out.get("task_run", {}).get("id") == "run-doc"
    assert len(created_steps) == 2
    assert created_steps[0]["step_kind"] == "file_create"
    assert created_steps[1]["step_kind"] == "app_open"


@pytest.mark.unit
def test_resolve_doc_create_filename_without_parse_match() -> None:
    from api.ewa_platform.companion.orchestration.flows.doc_create import (
        default_doc_create_filename,
        resolve_doc_create_filename,
    )

    line = "hello world"
    assert resolve_doc_create_filename(line, {}) == default_doc_create_filename(line)
    assert resolve_doc_create_filename("x", {"name": "custom.txt"}) == "custom.txt"


@pytest.mark.unit
def test_start_doc_package_generative_body(monkeypatch: pytest.MonkeyPatch) -> None:
    created_steps: list[dict[str, Any]] = []

    async def fake_run_create(_pool: Any, **kwargs: Any) -> dict[str, Any]:
        return {"id": "run-gen-doc", **kwargs}

    async def fake_step_create(_pool: Any, **kwargs: Any) -> dict[str, Any]:
        created_steps.append(dict(kwargs))
        return {"id": f"step-{len(created_steps)}", **kwargs}

    async def fake_compose(**_kwargs: Any) -> str:
        return "# Thoughts\n\nAbout you and me."

    monkeypatch.setattr(starter.companion_pg, "companion_task_run_create", fake_run_create)
    monkeypatch.setattr(starter.companion_pg, "companion_task_step_create", fake_step_create)
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.doc_create.compose_generative_doc_body_markdown",
        fake_compose,
    )

    wf = registry.get_builtin_workflow("doc_package_v1")
    assert wf is not None
    line = "создай документ и напиши в нём всё что ты думаешь обо мне и о себе"
    ctx = ToolContext(
        principal_id="p1",
        user_line=line,
        content_catalog_user_id="catalog-user-1",
        oauth2_sub_for_content_alternate=None,
        companion_pool=MagicMock(),
    )
    out = asyncio.run(
        starter._start_doc_package_v1(
            MagicMock(),
            user_line=line,
            tool_ctx=ctx,
            workflow=wf,
        ),
    )
    assert out is not None
    assert out.get("task_run", {}).get("id") == "run-gen-doc"
    assert "Подтверди" in str(out.get("reply") or "")
    plan = out.get("task_run", {}).get("plan_payload") or {}
    assert plan.get("doc_create", {}).get("body", "").startswith("# Thoughts")
    assert len(created_steps) == 2


@pytest.mark.unit
def test_start_doc_package_generative_compose_failure_returns_reply(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_compose(**_kwargs: Any) -> None:
        return None

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.doc_create.compose_generative_doc_body_markdown",
        fake_compose,
    )

    wf = registry.get_builtin_workflow("doc_package_v1")
    assert wf is not None
    line = "создай документ и напиши в нём всё что ты думаешь обо мне и о себе"
    ctx = ToolContext(
        principal_id="p1",
        user_line=line,
        content_catalog_user_id="catalog-user-1",
        oauth2_sub_for_content_alternate=None,
        companion_pool=MagicMock(),
    )
    out = asyncio.run(
        starter._start_doc_package_v1(
            MagicMock(),
            user_line=line,
            tool_ctx=ctx,
            workflow=wf,
        ),
    )
    assert out is not None
    assert out.get("task_run") is None
    assert "сгенерировать" in str(out.get("reply") or "").lower()


@pytest.mark.unit
def test_confirm_doc_package_opens_editor_with_template_uc(monkeypatch: pytest.MonkeyPatch) -> None:
    run = {
        "id": "run-doc",
        "principal_id": "p1",
        "user_message": "Создай документ и открой с текстом: hi",
        "workflow_id": "doc_package_v1",
        "plan_payload": {
            "kind": "action_workflow",
            "workflow_id": "doc_package_v1",
            "doc_create": {
                "name": "note.md",
                "body": "hello",
                "content_user_id": "catalog-user-1",
            },
        },
    }
    steps = [
        {
            "id": "s1",
            "step_index": 1,
            "input_payload": {"step_key": "create"},
            "output_payload": {},
        },
        {
            "id": "s2",
            "step_index": 2,
            "input_payload": {"step_key": "open_editor"},
            "output_payload": {},
        },
    ]

    async def fake_create_document(*_args: Any, **_kwargs: Any) -> SimpleNamespace:
        return SimpleNamespace(id="uc-created-1")

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.task_orchestrator._create_document",
        fake_create_document,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.task_orchestrator._storage_service_or_none",
        AsyncMock(return_value=object()),
    )
    monkeypatch.setattr(confirm_flow.companion_pg, "companion_task_steps_list", AsyncMock(return_value=steps))
    monkeypatch.setattr(confirm_flow.companion_pg, "companion_task_step_update", AsyncMock())
    monkeypatch.setattr(
        confirm_flow.companion_pg,
        "companion_task_run_update",
        AsyncMock(return_value={**run, "status": "completed"}),
    )

    out = asyncio.run(
        task_run_confirm.apply_companion_task_run_confirmation(
            MagicMock(),
            run=run,
            principal_id="p1",
            decision="confirm",
            ru=True,
        ),
    )
    assert out is not None
    assert out["actions"][0]["type"] == "open_app"
    assert out["actions"][0]["unified_content_id"] == "uc-created-1"
    assert out["actions"][0]["app_component"] == "DocEditor"
    assert out["actions"][0]["companion_surface_only"] is True
