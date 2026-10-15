# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for workflow bypass args on plan_v1, file_rewrite, plan complete, and status tools.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext, dispatch_tool_by_name


@pytest.mark.asyncio
async def test_plan_v1_workflow_bypass_uses_plan_focus(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, str] = {}

    async def fake_build(pool: object, *, principal_id: str, user_line: str) -> dict[str, object]:
        captured["user_line"] = user_line
        captured["principal_id"] = principal_id
        return {"plan": {"id": "plan-1"}, "goals": [], "tasks": []}

    monkeypatch.setattr(
        "api.ewa_platform.companion.plans.config.companion_plan_enabled",
        lambda: True,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.plans.service.build_plan_from_user_line",
        fake_build,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_plans_asyncpg.format_plan_markdown_reply",
        lambda bundle, *, ru: "plan ok",
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.plans.meta_schedule.schedule_companion_meta_from_plan",
        lambda **_: None,
    )

    ctx = ToolContext(
        principal_id="p1",
        user_line="мой триггер",
        content_catalog_user_id="u1",
        oauth2_sub_for_content_alternate=None,
        companion_pool=MagicMock(),
    )
    result = await dispatch_tool_by_name(
        "plan_v1",
        {
            "user_line": "мой триггер",
            "_tool_router_bypass_line_match": True,
            "plan_focus": "запуск companion plans за две недели",
            "horizon": "2 недели",
        },
        ctx,
    )
    assert result is not None
    assert result.get("status") == "ok"
    assert "Составь план на 2 недели" in captured["user_line"]
    assert "companion plans" in captured["user_line"]


@pytest.mark.asyncio
async def test_file_rewrite_workflow_bypass_builds_server_first_line(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, str] = {}

    async def fake_sf(
        pool: object,
        *,
        principal_id: str,
        user_line: str,
        content_catalog_user_id: str | None,
        oauth2_sub_for_content_alternate: str | None,
    ) -> dict[str, object]:
        captured["user_line"] = user_line
        return {"reply": "ok", "data": {}}

    monkeypatch.setattr(
        "api.ewa_platform.companion.server_first.v2.server_first_v2_env_enabled",
        lambda: True,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.server_first.v2.companion_user_intent_server_first_v2_full_replace",
        lambda _line: True,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.server_first.v2.maybe_handle_server_first_v2_turn",
        fake_sf,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.tool_registry._resolve_main_pool",
        AsyncMock(return_value=MagicMock()),
    )

    ctx = ToolContext(
        principal_id="p1",
        user_line="trigger",
        content_catalog_user_id="u1",
        oauth2_sub_for_content_alternate=None,
        companion_pool=MagicMock(),
    )
    result = await dispatch_tool_by_name(
        "file_rewrite",
        {
            "user_line": "trigger",
            "_tool_router_bypass_line_match": True,
            "file_query": "notes.md",
            "rewrite_brief": "краткое резюме",
        },
        ctx,
    )
    assert result is not None
    assert result.get("status") == "ok"
    assert "notes.md" in captured["user_line"]
    assert "Полностью перепиши" in captured["user_line"]


@pytest.mark.asyncio
async def test_plan_task_complete_workflow_bypass_uses_task_hint(monkeypatch: pytest.MonkeyPatch) -> None:
    completed: dict[str, str] = {}

    async def fake_complete(pool: object, *, principal_id: str, task_id: str) -> dict[str, object]:
        completed["task_id"] = task_id
        completed["principal_id"] = principal_id
        return {"plan": {"id": "plan-1"}, "tasks": []}

    monkeypatch.setattr(
        "api.ewa_platform.companion.plans.config.companion_plan_enabled",
        lambda: True,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_plans_asyncpg.plan_get_active",
        AsyncMock(
            return_value={
                "tasks": [
                    {"id": "task-1", "title": "Deploy companion plans", "status": "pending"},
                ]
            }
        ),
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_plans_asyncpg.plan_task_complete",
        fake_complete,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_plans_asyncpg.format_plan_markdown_reply",
        lambda bundle, *, ru: "done",
    )

    ctx = ToolContext(
        principal_id="p1",
        user_line="trigger",
        content_catalog_user_id="u1",
        oauth2_sub_for_content_alternate=None,
        companion_pool=MagicMock(),
    )
    result = await dispatch_tool_by_name(
        "plan_task_complete_v1",
        {
            "user_line": "trigger",
            "_tool_router_bypass_line_match": True,
            "task_hint": "Deploy companion",
        },
        ctx,
    )
    assert result is not None
    assert result.get("status") == "ok"
    assert completed["task_id"] == "task-1"


@pytest.mark.asyncio
async def test_check_task_status_workflow_bypass_with_run_id(monkeypatch: pytest.MonkeyPatch) -> None:
    run_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

    async def fake_answer(
        pool: object,
        *,
        principal_id: str,
        user_line: str,
        args: dict[str, object],
    ) -> dict[str, object]:
        assert run_id in user_line or args.get("run_id") == run_id
        return {
            "reply": "running",
            "check_task_status": {"normalized_status": "RUNNING", "task_id": run_id},
            "task_run": {"id": run_id, "status": "running"},
        }

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.check_task_status.answer_check_task_status",
        fake_answer,
    )

    ctx = ToolContext(
        principal_id="p1",
        user_line="trigger",
        content_catalog_user_id="u1",
        oauth2_sub_for_content_alternate=None,
        companion_pool=MagicMock(),
    )
    result = await dispatch_tool_by_name(
        "check_task_status",
        {
            "user_line": "trigger",
            "_tool_router_bypass_line_match": True,
            "run_id": run_id,
        },
        ctx,
    )
    assert result is not None
    assert result.get("status") == "ok"
    assert result.get("reply") == "running"


@pytest.mark.asyncio
async def test_file_save_text_workflow_bypass_starts_doc_create_flow(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, str] = {}

    async def fake_begin(
        pool: object,
        *,
        principal_id: str,
        user_line: str,
        content_catalog_user_id: str,
        name: str,
        body: str,
    ) -> dict[str, object]:
        captured["name"] = name
        captured["body"] = body
        captured["principal_id"] = principal_id
        return {"reply": "confirm?", "task_run": {"id": "run-1", "status": "awaiting_confirmation"}}

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.doc_create.begin_doc_create_flow",
        fake_begin,
    )

    ctx = ToolContext(
        principal_id="p1",
        user_line="trigger",
        content_catalog_user_id="u1",
        oauth2_sub_for_content_alternate=None,
        companion_pool=MagicMock(),
    )
    result = await dispatch_tool_by_name(
        "file_save_text",
        {
            "user_line": "trigger",
            "_tool_router_bypass_line_match": True,
            "name": "summary",
            "body": "Step output text",
        },
        ctx,
    )
    assert result is not None
    assert result.get("status") == "needs_confirm"
    assert captured["name"] == "summary.md"
    assert captured["body"] == "Step output text"
    assert captured["principal_id"] == "p1"
