# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for durable EWA companion task orchestration: confirmation resume, cancellation, truthful memory answers,
# server-first v2 wiring to **main** asyncpg pool.
# Invariants:
# - No Postgres or LLM I/O; persistence helpers are monkeypatched at module boundary.
# - Confirmed tasks must emit the saved allowlisted action instead of asking the LLM to remember it.
# Related:
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# ---
"""Tests: EWA companion task orchestration."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any
from unittest.mock import AsyncMock

from api.ewa_platform.companion.contracts import CompanionIntentPlanV1
from api.ewa_platform.companion.orchestration import task_orchestrator


def _patch_pre_tool_workflows_no_match(monkeypatch) -> None:
    """Pre-tool phase may query workflow catalogs; unit tests use a bare pool sentinel."""

    async def _no_action_workflow(*_args: Any, **_kwargs: Any) -> None:
        return None

    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.action.starter.try_start_action_workflow",
        _no_action_workflow,
    )


def test_pending_confirmation_yes_emits_saved_action(monkeypatch) -> None:
    action = {
        "type": "doc_editor_set_body",
        "app_component": "DocEditor",
        "body_html": "<p>ok</p>",
        "unified_content_id": "11111111-1111-1111-1111-111111111111",
    }
    run = {
        "id": "run-1",
        "status": "awaiting_confirmation",
        "plan_payload": {"action": action},
    }

    async def fake_find(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return run

    async def fake_steps(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
        return [{"id": "step-1"}]

    async def fake_step_update(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {}

    async def fake_run_update(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {**run, "status": "completed"}

    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_find_latest_active", fake_find)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_steps_list", fake_steps)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_step_update", fake_step_update)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_run_update", fake_run_update)

    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line="да, согласен",
            shell_norm=None,
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
        )
    )
    assert out is not None
    assert out["actions"] == [action]
    assert "Готова" in out["reply"]


def test_pending_confirmation_cancel_does_not_emit_action(monkeypatch) -> None:
    run = {"id": "run-1", "status": "awaiting_confirmation", "plan_payload": {"action": {"type": "open_app"}}}

    async def fake_find(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return run

    async def fake_run_update(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {**run, "status": "cancelled"}

    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_find_latest_active", fake_find)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_run_update", fake_run_update)

    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line="отмени",
            shell_norm=None,
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
        )
    )
    assert out is not None
    assert out["actions"] == []
    assert "Отменила" in out["reply"]


def test_orchestration_skips_planner_dispatch_when_intent_plan_none(monkeypatch) -> None:
    """Regression: ``intent_plan=None`` must not invoke planner dispatch (legacy-regex path only)."""

    async def bad_dispatch(*_a: Any, **_k: Any) -> dict[str, Any]:
        raise AssertionError("_dispatch_companion_intent_plan should not run when intent_plan is None")

    async def none_ret(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(task_orchestrator, "_resume_pending_task", none_ret)
    monkeypatch.setattr(task_orchestrator, "_dispatch_companion_intent_plan", bad_dispatch)
    monkeypatch.setattr(task_orchestrator, "_answer_memory_question", none_ret)
    _patch_pre_tool_workflows_no_match(monkeypatch)

    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line="hello",
            shell_norm=None,
            content_catalog_user_id=None,
            oauth2_sub_for_content_alternate=None,
            intent_plan=None,
            server_first_v2_enabled=False,
        )
    )
    assert out is None


def test_memory_question_answers_from_profile(monkeypatch) -> None:
    async def fake_find(*_args: Any, **_kwargs: Any) -> None:
        return None

    async def fake_profile(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {
            "learned_preferences": {
                "companion_memory_v1": [
                    {
                        "type": "preference",
                        "content": "Пользователь предпочитает короткие ответы.",
                        "importance": 0.9,
                    }
                ]
            }
        }

    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_find_latest_active", fake_find)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_profile_fetch", fake_profile)
    _patch_pre_tool_workflows_no_match(monkeypatch)

    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line="что у тебя есть в базе?",
            shell_norm=None,
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
        )
    )
    assert out is not None
    assert "Пользователь предпочитает короткие ответы" in out["reply"]
    assert "Runtime Gateway" in out["reply"]


def test_intent_plan_recall_memory_prepends_summary(monkeypatch) -> None:
    monkeypatch.setattr(task_orchestrator, "companion_intent_planner_min_confidence", lambda: 0.0)

    async def fake_find(*_args: Any, **_kwargs: Any) -> None:
        return None

    async def fake_profile(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {
            "learned_preferences": {
                "companion_memory_v1": [
                    {
                        "type": "preference",
                        "content": "User likes short answers.",
                        "importance": 0.8,
                    }
                ]
            }
        }

    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_find_latest_active", fake_find)
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_profile_fetch",
        fake_profile,
    )
    _patch_pre_tool_workflows_no_match(monkeypatch)

    plan = CompanionIntentPlanV1(
        intent="recall_memory",
        confidence=0.95,
        understood_summary_en="You asked what I remember.",
        understood_summary_ru="",
    )
    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line="what do you remember?",
            shell_norm=None,
            content_catalog_user_id=None,
            oauth2_sub_for_content_alternate=None,
            intent_plan=plan,
        )
    )
    assert out is not None
    assert out["reply"].startswith("You asked what I remember.")
    assert "User likes short answers" in out["reply"]


def test_create_document_flow_requires_confirmation_then_creates(monkeypatch) -> None:
    created_runs: list[dict[str, Any]] = []

    async def fake_find(*_args: Any, **_kwargs: Any) -> None:
        return None

    async def fake_run_create(*_args: Any, **kwargs: Any) -> dict[str, Any]:
        run = {
            "id": "run-create",
            "status": kwargs["status"],
            "plan_payload": dict(kwargs["plan_payload"]),
        }
        created_runs.append(run)
        return run

    async def fake_step_create(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {"id": "step-create"}

    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_find_latest_active", fake_find)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_run_create", fake_run_create)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_step_create", fake_step_create)
    _patch_pre_tool_workflows_no_match(monkeypatch)

    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line="создай файл test.md с текстом: привет",
            shell_norm=None,
            content_catalog_user_id="content-user",
            oauth2_sub_for_content_alternate=None,
        )
    )
    assert out is not None
    assert "Подтверди" in out["reply"]
    assert created_runs[0]["plan_payload"]["kind"] == "doc_create"
    assert created_runs[0]["plan_payload"]["name"] == "test.md"


def test_edit_without_open_uc_returns_honest_blocker(monkeypatch) -> None:
    async def fake_find(*_args: Any, **_kwargs: Any) -> None:
        return None

    async def fake_profile(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {"learned_preferences": {}}

    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_find_latest_active", fake_find)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_profile_fetch", fake_profile)
    _patch_pre_tool_workflows_no_match(monkeypatch)

    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line="отредактируй документ",
            shell_norm={"windows": []},
            content_catalog_user_id="content-user",
            oauth2_sub_for_content_alternate=None,
        )
    )
    assert out is not None
    assert out["actions"] == []
    assert "не буду делать вид" in out["reply"]


def test_confirm_create_document_executes_storage(monkeypatch) -> None:
    class Created:
        id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        name = "test.md"
        content_type = "document"
        mime_type = "text/markdown"
        user_id = "content-user"

    class Storage:
        async def create_content(self, **kwargs: Any) -> Created:
            assert kwargs["content_data"].name == "test.md"
            assert kwargs["file_data"] == b"hello"
            return Created()

    run = {
        "id": "run-create",
        "status": "awaiting_confirmation",
        "plan_payload": {
            "kind": "doc_create",
            "name": "test.md",
            "body": "hello",
            "content_user_id": "content-user",
        },
    }

    async def fake_find(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return run

    async def fake_steps(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
        return [{"id": "step-create"}]

    async def fake_step_update(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {}

    async def fake_run_update(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {**run, "status": "completed"}

    async def fake_storage() -> Storage:
        return Storage()

    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_find_latest_active", fake_find)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_steps_list", fake_steps)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_step_update", fake_step_update)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_run_update", fake_run_update)
    monkeypatch.setattr(task_orchestrator, "_storage_service_or_none", fake_storage)

    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line="да",
            shell_norm=None,
            content_catalog_user_id="content-user",
            oauth2_sub_for_content_alternate=None,
        )
    )
    assert out is not None
    assert out["actions"]
    first = out["actions"][0]
    assert first["type"] == "open_app"
    assert first["app_component"] == "DocEditor"
    assert first["unified_content_id"] == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    assert "создала документ" in out["reply"]


def test_file_rename_confirm_updates_storage(monkeypatch) -> None:
    run = {
        "id": "run-rn",
        "status": "awaiting_confirmation",
        "plan_payload": {
            "kind": "file_rename",
            "unified_content_id": "22222222-2222-2222-2222-222222222222",
            "old_label": "old.md",
            "new_name": "fresh.md",
            "content_user_id": "content-user",
        },
    }
    calls: list[tuple[str, str, str | None]] = []

    async def fake_find(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return run

    async def fake_steps(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
        return [{"id": "step-rn"}]

    async def fake_step_update(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {}

    async def fake_run_update(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {**run, "status": "completed"}

    class Storage:
        async def update_content(self, cid: Any, uid: str, updates: Any) -> None:
            calls.append((str(cid), str(uid), getattr(updates, "name", None)))

    async def fake_storage() -> Storage:
        return Storage()

    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_find_latest_active", fake_find)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_steps_list", fake_steps)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_step_update", fake_step_update)
    monkeypatch.setattr(task_orchestrator.companion_pg, "companion_task_run_update", fake_run_update)
    monkeypatch.setattr(task_orchestrator, "_storage_service_or_none", fake_storage)

    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line="да, подтверждаю",
            shell_norm=None,
            content_catalog_user_id="content-user",
            oauth2_sub_for_content_alternate=None,
        )
    )
    assert out is not None
    assert calls and calls[0][2] == "fresh.md"
    assert out["actions"] and out["actions"][0]["app_component"] == "ContentManagerPro"
    assert "переименовала" in out["reply"]


def test_server_first_v2_uses_main_asyncpg_pool_not_ewa(monkeypatch) -> None:
    """Regression: companion chat passes EWA DB pool; unified_content lives on DATABASE_URL.

    Updated for Phase B (server-only migration): ``file_rewrite`` is dispatched via
    ``orchestration.tool_registry``, so we patch the underlying ``server_first.v2`` entry-point and verify the
    registry passes the main asyncpg pool (not the EWA pool) down to it.
    """

    captured: dict[str, Any] = {}

    async def fake_resume(*_a: Any, **_k: Any) -> None:
        return None

    async def fake_v2(pool: Any, **_k: Any) -> dict[str, Any]:
        captured["pool"] = pool
        return {"reply": "v2", "actions": [], "task_run": None}

    async def fake_main_pool() -> str:
        return "main-pool-sentinel"

    monkeypatch.setattr(task_orchestrator, "_resume_pending_task", fake_resume)
    monkeypatch.setattr(
        "api.ewa_platform.companion.server_first.v2.maybe_handle_server_first_v2_turn",
        fake_v2,
    )
    monkeypatch.setattr("api.core.database_manager.get_asyncpg_pool", fake_main_pool)
    _patch_pre_tool_workflows_no_match(monkeypatch)

    ewa_pool = object()
    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            ewa_pool,
            principal_id="p1",
            user_line="Полностью перепиши notes.md как тест",
            shell_norm=None,
            content_catalog_user_id="11111111-1111-1111-1111-111111111111",
            oauth2_sub_for_content_alternate=None,
            server_first_v2_enabled=True,
        ),
    )
    assert out is not None
    assert captured.get("pool") == "main-pool-sentinel"
    assert captured.get("pool") is not ewa_pool


# -- Phase D.1: _run_tool_branch helper + short-circuit semantics -------------


def _branch_ctx() -> Any:
    """Build a minimal ToolContext sentinel for helper-level tests (no dispatch dependencies needed)."""

    from api.ewa_platform.companion.orchestration.tool_registry import ToolContext

    return ToolContext(
        principal_id="tester",
        user_line="test",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
    )


def test_terminal_statuses_constant_matches_canon() -> None:
    """Phase D.1 + Phase 1.10: terminal statuses stop dispatch (incl. ``accepted``)."""

    assert task_orchestrator._TERMINAL_TOOL_STATUSES == frozenset(
        {"ok", "error", "needs_confirm", "unavailable", "needs_open_editor", "accepted"},
    )


def test_orchestrator_has_no_inline_start_helpers() -> None:
    """Phase 1.4: file/doc flows must not use legacy ``_start_*`` inline helpers."""

    import inspect

    src = inspect.getsource(task_orchestrator)
    assert "_start_doc_create_task" not in src
    assert "_start_file_rename_task" not in src
    assert "_start_file_delete_task" not in src
    assert "_start_doc_insert_task" not in src


def test_run_tool_branch_short_circuits_on_accepted(monkeypatch) -> None:
    async def fake_dispatch(*_a: Any, **_k: Any) -> dict[str, Any]:
        return {
            "tool": "music_generation",
            "status": "accepted",
            "reply": "queued",
            "actions": [],
            "task_run": {"id": "run-1"},
        }

    monkeypatch.setattr(task_orchestrator, "dispatch_tool_by_name", fake_dispatch)
    out = asyncio.run(
        task_orchestrator._run_tool_branch("music_generation", {}, _branch_ctx(), user_line="x"),
    )
    assert out is not None
    assert out["reply"] == "queued"


def test_run_tool_branch_short_circuits_on_each_terminal_status(monkeypatch) -> None:
    """Phase D.1: every terminal status must cause ``_run_tool_branch`` to return a response (no fall-through)."""

    for status in sorted(task_orchestrator._TERMINAL_TOOL_STATUSES):

        async def fake_dispatch(_name: str, _args: Any, _ctx: Any, *, _status: str = status) -> dict[str, Any]:
            return {
                "tool": "fake",
                "status": _status,
                "reply": f"reply for {_status}",
                "actions": [{"type": "open_app", "app_component": "DocEditor"}],
                "task_run": None,
            }

        monkeypatch.setattr(task_orchestrator, "dispatch_tool_by_name", fake_dispatch)
        out = asyncio.run(
            task_orchestrator._run_tool_branch(
                "fake",
                {"user_line": "x"},
                _branch_ctx(),
                user_line="x",
            ),
        )
        assert out is not None, f"status={status!r} must short-circuit"
        assert out["reply"] == f"reply for {status}"
        assert out["actions"][0]["type"] == "open_app"


def test_run_tool_branch_falls_through_on_skipped_or_none(monkeypatch) -> None:
    """Phase D.1: ``status='skipped'`` and ``None`` must NOT short-circuit — caller runs next branch."""

    async def fake_dispatch_none(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(task_orchestrator, "dispatch_tool_by_name", fake_dispatch_none)
    out = asyncio.run(
        task_orchestrator._run_tool_branch("fake", {}, _branch_ctx(), user_line="x"),
    )
    assert out is None

    async def fake_dispatch_skipped(*_a: Any, **_k: Any) -> dict[str, Any]:
        return {"tool": "fake", "status": "skipped", "reply": "", "actions": [], "task_run": None}

    monkeypatch.setattr(task_orchestrator, "dispatch_tool_by_name", fake_dispatch_skipped)
    out2 = asyncio.run(
        task_orchestrator._run_tool_branch("fake", {}, _branch_ctx(), user_line="x"),
    )
    assert out2 is None


def test_run_tool_branch_defer_llm_on_memory_append(monkeypatch) -> None:
    """Phase 1.3: ``memory_append`` must return ``continue_main_llm`` without a terminal user reply."""

    async def fake_dispatch(*_a: Any, **_k: Any) -> dict[str, Any]:
        return {
            "tool": "catalog_discuss",
            "status": "memory_append",
            "reply": "",
            "actions": [],
            "data": {
                "memory_section_append": "## CRITICAL\n\nBody",
                "orchestration_branch": "catalog_discuss",
            },
            "task_run": None,
        }

    monkeypatch.setattr(task_orchestrator, "dispatch_tool_by_name", fake_dispatch)
    out = asyncio.run(
        task_orchestrator._run_tool_branch("catalog_discuss", {}, _branch_ctx(), user_line="обсуди notes.md"),
    )
    assert out is not None
    assert out.get("continue_main_llm") is True
    assert "Body" in out.get("memory_section_append", "")
    assert out.get("orchestration_branch") == "catalog_discuss"
    assert out.get("reply") == ""


def test_run_tool_branch_memory_append_empty_falls_through(monkeypatch) -> None:
    async def fake_dispatch(*_a: Any, **_k: Any) -> dict[str, Any]:
        return {
            "tool": "catalog_discuss",
            "status": "memory_append",
            "reply": "",
            "actions": [],
            "data": {"memory_section_append": "  "},
            "task_run": None,
        }

    monkeypatch.setattr(task_orchestrator, "dispatch_tool_by_name", fake_dispatch)
    out = asyncio.run(
        task_orchestrator._run_tool_branch("catalog_discuss", {}, _branch_ctx(), user_line="x"),
    )
    assert out is None


def test_run_tool_branch_substitutes_fallback_when_error_reply_empty(monkeypatch) -> None:
    """Phase D.1: when a tool returns ``status='error'`` with an empty reply, the user must still see a message."""

    async def fake_dispatch(*_a: Any, **_k: Any) -> dict[str, Any]:
        return {"tool": "fake", "status": "error", "reply": "", "actions": [], "task_run": None}

    monkeypatch.setattr(task_orchestrator, "dispatch_tool_by_name", fake_dispatch)
    out_ru = asyncio.run(
        task_orchestrator._run_tool_branch("fake", {}, _branch_ctx(), user_line="привет, спутник"),
    )
    assert out_ru is not None
    assert out_ru["reply"].strip(), "RU error fallback must not be empty"
    assert "Не получилось" in out_ru["reply"]

    out_en = asyncio.run(
        task_orchestrator._run_tool_branch("fake", {}, _branch_ctx(), user_line="hello there"),
    )
    assert out_en is not None
    assert out_en["reply"].strip(), "EN error fallback must not be empty"
    assert "could not complete" in out_en["reply"].lower()


def test_run_tool_branch_preserves_non_empty_reply_on_error(monkeypatch) -> None:
    """Phase D.1: when an error reply is already populated, the orchestrator must NOT replace it with the fallback."""

    async def fake_dispatch(*_a: Any, **_k: Any) -> dict[str, Any]:
        return {
            "tool": "fake",
            "status": "error",
            "reply": "Очень конкретное объяснение ошибки",
            "actions": [],
            "task_run": None,
        }

    monkeypatch.setattr(task_orchestrator, "dispatch_tool_by_name", fake_dispatch)
    out = asyncio.run(task_orchestrator._run_tool_branch("fake", {}, _branch_ctx(), user_line="x"))
    assert out is not None
    assert out["reply"] == "Очень конкретное объяснение ошибки"


def test_run_tool_branch_emits_structured_decision_log(monkeypatch, caplog) -> None:
    """Phase D.1: every dispatch (terminal **or** fall-through) must emit one structured decision log line."""

    async def fake_dispatch(*_a: Any, **_k: Any) -> dict[str, Any]:
        return {"tool": "fake", "status": "ok", "reply": "hi", "actions": [], "task_run": None}

    monkeypatch.setattr(task_orchestrator, "dispatch_tool_by_name", fake_dispatch)
    with caplog.at_level("INFO", logger=task_orchestrator.logger.name):
        asyncio.run(task_orchestrator._run_tool_branch("fake", {}, _branch_ctx(), user_line="x"))
    msgs = [r.message for r in caplog.records]
    assert any(
        "[STEP] companion_orchestration_decision" in m and "branch=fake" in m and "status=ok" in m for m in msgs
    ), f"missing decision log; got: {msgs}"
    assert any("short_circuit=true" in m for m in msgs), "ok status must log short_circuit=true"


def test_run_tool_branch_logs_short_circuit_false_for_none(monkeypatch, caplog) -> None:
    """Phase D.1: ``None`` dispatch must still log a decision entry with ``status=none short_circuit=false``."""

    async def fake_dispatch(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(task_orchestrator, "dispatch_tool_by_name", fake_dispatch)
    with caplog.at_level("INFO", logger=task_orchestrator.logger.name):
        asyncio.run(task_orchestrator._run_tool_branch("fake", {}, _branch_ctx(), user_line="x"))
    msgs = [r.message for r in caplog.records]
    assert any("branch=fake" in m and "status=none" in m and "short_circuit=false" in m for m in msgs), (
        f"missing fall-through decision log; got: {msgs}"
    )


def test_orchestrator_blocks_doc_create_on_plan_regex_when_plan_v1_unavailable(monkeypatch) -> None:
    """Plan-regex line + high-confidence ``doc_create`` must not dispatch planner; fall back to plan_v1_unavailable."""

    async def none_ret(*_args: Any, **_kwargs: Any) -> None:
        return None

    async def bad_dispatch(*_a: Any, **_k: Any) -> dict[str, Any]:
        raise AssertionError("_dispatch_companion_intent_plan must not run when plan regex blocks doc_create")

    monkeypatch.delenv("EWA_COMPANION_PLAN_ENABLED", raising=False)
    monkeypatch.setattr(task_orchestrator, "companion_intent_planner_min_confidence", lambda: 0.0)
    monkeypatch.setattr(task_orchestrator, "_resume_pending_task", none_ret)
    monkeypatch.setattr(task_orchestrator, "_resume_latest_completed_music_generation", none_ret)
    monkeypatch.setattr(task_orchestrator, "_run_turn_plan_resume_if_any", none_ret)
    monkeypatch.setattr(task_orchestrator, "_run_tool_branch", none_ret)
    monkeypatch.setattr(task_orchestrator, "_dispatch_companion_intent_plan", bad_dispatch)
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.check_task_status.answer_check_task_status",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.active_task_runs_prompt.answer_active_operations_status",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.action.starter.try_start_action_workflow",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.runner.try_workflow_orchestration_reply",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.compound_file_chain.maybe_handle_compound_file_chain",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.file_study_compose.maybe_handle_file_study_compose_turn",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.turn_context_guards.maybe_orchestrate_file_focus_chat_turn",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.tool_router_dispatch.maybe_dispatch_companion_tool_router",
        none_ret,
    )

    plan = CompanionIntentPlanV1(
        intent="doc_create",
        confidence=0.95,
        understood_summary_ru="создать документ с планом",
        doc_file_name="plan.md",
    )
    user_line = "Составь план на 2 недели: запуск companion plans в production"
    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line=user_line,
            shell_norm=None,
            content_catalog_user_id="11111111-1111-1111-1111-111111111111",
            oauth2_sub_for_content_alternate=None,
            intent_plan=plan,
        )
    )
    assert out is not None
    assert out.get("orchestration_branch") == "plan_v1_unavailable"
    assert out.get("actions") == []
    assert "EWA_COMPANION_PLAN_ENABLED" in out.get("reply", "")


def test_orchestrator_plan_line_dispatches_plan_v1_when_enabled(monkeypatch) -> None:
    """Plan-regex line must call plan_v1 when companion plans are enabled."""

    async def none_ret(*_args: Any, **_kwargs: Any) -> None:
        return None

    plan_result = {
        "reply": "План сохранён.",
        "actions": [],
        "task_run": None,
        "orchestration_branch": "plan_v1",
    }

    async def fake_plan_branch(
        name: str,
        _args: Any,
        _ctx: Any,
        *,
        user_line: str,
        turn_reports: Any = None,
    ) -> dict[str, Any] | None:
        if name != "plan_v1":
            return None
        assert "план" in user_line.lower()
        return plan_result

    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    monkeypatch.setattr(task_orchestrator, "companion_intent_planner_min_confidence", lambda: 0.0)
    monkeypatch.setattr(task_orchestrator, "_resume_pending_task", none_ret)
    monkeypatch.setattr(task_orchestrator, "_resume_latest_completed_music_generation", none_ret)
    monkeypatch.setattr(task_orchestrator, "_run_turn_plan_resume_if_any", none_ret)
    monkeypatch.setattr(task_orchestrator, "_run_tool_branch", fake_plan_branch)
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.check_task_status.answer_check_task_status",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.active_task_runs_prompt.answer_active_operations_status",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.action.starter.try_start_action_workflow",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.runner.try_workflow_orchestration_reply",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.compound_file_chain.maybe_handle_compound_file_chain",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.file_study_compose.maybe_handle_file_study_compose_turn",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.turn_context_guards.maybe_orchestrate_file_focus_chat_turn",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.tool_router_dispatch.maybe_dispatch_companion_tool_router",
        none_ret,
    )

    user_line = "Сделай план с указанием дат на две недели: запуск продукта"
    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line=user_line,
            shell_norm=None,
            content_catalog_user_id="11111111-1111-1111-1111-111111111111",
            oauth2_sub_for_content_alternate=None,
            intent_plan=None,
        )
    )
    assert out is not None
    assert out.get("orchestration_branch") == "plan_v1"
    assert out.get("reply") == "План сохранён."


def test_check_task_status_phase_uses_run_tool_branch(monkeypatch) -> None:
    async def none_ret(*_args: Any, **_kwargs: Any) -> None:
        return None

    calls: list[str] = []

    async def fake_run_tool_branch(
        name: str,
        _args: Any,
        _ctx: Any,
        *,
        user_line: str,
        turn_reports: Any = None,
    ) -> dict[str, Any] | None:
        calls.append(name)
        if name == "check_task_status":
            return {
                "reply": "Текущий статус: выполняется.",
                "actions": [],
                "orchestration_branch": "check_task_status",
            }
        return None

    monkeypatch.setattr(task_orchestrator, "_resume_pending_task", none_ret)
    monkeypatch.setattr(task_orchestrator, "_resume_latest_completed_music_generation", none_ret)
    monkeypatch.setattr(task_orchestrator, "_run_turn_plan_resume_if_any", none_ret)
    monkeypatch.setattr(task_orchestrator, "_run_tool_branch", fake_run_tool_branch)
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.check_task_status.answer_check_task_status",
        AsyncMock(side_effect=AssertionError("direct check_task_status call must not be used")),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.action.starter.try_start_action_workflow",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.runner.try_workflow_orchestration_reply",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.compound_file_chain.maybe_handle_compound_file_chain",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.file_study_compose.maybe_handle_file_study_compose_turn",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.turn_context_guards.maybe_orchestrate_file_focus_chat_turn",
        none_ret,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.tool_router_dispatch.maybe_dispatch_companion_tool_router",
        none_ret,
    )

    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line="покажи статус run_id 9f5202fd-644f-4f4d-9398-c6ed8de9f74a",
            shell_norm=None,
            content_catalog_user_id="11111111-1111-1111-1111-111111111111",
            oauth2_sub_for_content_alternate=None,
            intent_plan=None,
        )
    )
    assert out is not None
    assert out.get("orchestration_branch") == "check_task_status"
    assert "check_task_status" in calls


def test_quick_intent_route_hint_forces_catalog_list_bypass_probe(monkeypatch) -> None:
    async def none_ret(*_args: Any, **_kwargs: Any) -> None:
        return None

    calls: list[tuple[str, dict[str, Any]]] = []

    async def fake_run_tool_branch(
        name: str,
        args: Mapping[str, Any],
        _ctx: Any,
        *,
        user_line: str,
        turn_reports: Any = None,
    ) -> dict[str, Any] | None:
        calls.append((name, dict(args)))
        if name == "catalog_list":
            assert args.get("_tool_router_bypass_line_match") is True
            assert args.get("quick_intent_id") == "documentList"
            return {
                "reply": "Открыла каталог.",
                "actions": [{"type": "open_app", "app_component": "EwaFileManager"}],
                "task_run": None,
                "orchestration_branch": "catalog_list",
            }
        return None

    monkeypatch.setattr(task_orchestrator, "_resume_pending_task", none_ret)
    monkeypatch.setattr(task_orchestrator, "_resume_latest_completed_music_generation", none_ret)
    monkeypatch.setattr(task_orchestrator, "_run_turn_plan_resume_if_any", none_ret)
    monkeypatch.setattr(task_orchestrator, "_run_tool_branch", fake_run_tool_branch)

    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line="Покажи список моих документов из каталога прямо в EWA и предложи, какой открыть первым.",
            shell_norm=None,
            content_catalog_user_id="11111111-1111-1111-1111-111111111111",
            oauth2_sub_for_content_alternate=None,
            intent_plan=None,
        )
    )

    assert out is not None
    assert out.get("orchestration_branch") == "catalog_list"
    assert out.get("reply") == "Открыла каталог."
    assert any(name == "catalog_list" for name, _ in calls)


def test_quick_intent_workflow_reflect_week_probe(monkeypatch) -> None:
    async def none_ret(*_args: Any, **_kwargs: Any) -> None:
        return None

    async def fake_workflow_reply(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        return {
            "reply": "Итоги недели готовы.",
            "actions": [],
            "task_run": None,
            "orchestration_branch": "workflow_reflect_week",
        }

    monkeypatch.setattr(task_orchestrator, "_resume_pending_task", none_ret)
    monkeypatch.setattr(task_orchestrator, "_resume_latest_completed_music_generation", none_ret)
    monkeypatch.setattr(task_orchestrator, "_run_turn_plan_resume_if_any", none_ret)
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.chat.runner.try_workflow_orchestration_reply",
        fake_workflow_reply,
    )

    out = asyncio.run(
        task_orchestrator.maybe_handle_companion_task_orchestration(
            object(),
            principal_id="p1",
            user_line="Подведи итоги недели",
            shell_norm=None,
            content_catalog_user_id="11111111-1111-1111-1111-111111111111",
            oauth2_sub_for_content_alternate=None,
            intent_plan=None,
        )
    )

    assert out is not None
    assert out.get("orchestration_branch") == "workflow_reflect_week"
    assert out.get("reply") == "Итоги недели готовы."
