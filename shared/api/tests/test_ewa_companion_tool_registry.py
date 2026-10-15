# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioural tests for the canonical EWA companion **server-only tool registry**
# (``api.ewa_platform.companion.orchestration.tool_registry``) introduced as Phase B of the server-only migration
# and extended through Phase D (``theme_set``, ``music_generation`` wizard v2 XL Turbo, ``music_studio_open``, ``app_open``).
# Verifies the registry surface (declared names, requires) is stable and that ``dispatch_tool_by_name`` routes
# to the right handler / falls through for unknown / inapplicable inputs.
# Invariants:
# - ``REGISTRY`` exposes the canonical tool names declared in
#   ``documentation/platform/EWA-COMPANION-SERVER-ONLY-MIGRATION.md``.
# - ``dispatch_tool_by_name("unknown", …)`` returns ``None`` (no crash, caller falls through).
# - ``dispatch_tool_by_name("file_rewrite", …)`` proxies to ``server_first.v2.maybe_handle_server_first_v2_turn``
#   and wraps the result in the ``ToolResult`` envelope.
# - When the underlying handler returns ``None`` (intent did not match), the registry returns ``None``.
# - Exceptions inside a handler are captured and surfaced as ``status="error"`` (orchestrator must not crash).
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/server_first/v2.py
# - documentation/platform/EWA-COMPANION-SERVER-ONLY-MIGRATION.md
# ---
"""Phase-B tests for the canonical server-only tool registry."""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.orchestration import tool_registry as reg


def _actions(result: reg.ToolResult) -> list[dict[str, Any]]:
    actions = result.get("actions")
    assert isinstance(actions, list)
    return actions


def _data(result: reg.ToolResult) -> dict[str, Any]:
    data = result.get("data")
    assert isinstance(data, dict)
    return data


def _awaited(mock: Any) -> Any:
    call = mock.await_args
    assert call is not None
    return call


def _task_run(result: reg.ToolResult) -> dict[str, Any] | None:
    task_run = result.get("task_run")
    if task_run is None:
        return None
    assert isinstance(task_run, dict)
    return task_run


def _require_task_run(result: reg.ToolResult) -> dict[str, Any]:
    task_run = _task_run(result)
    assert task_run is not None
    return task_run


def _surface(result: reg.ToolResult) -> dict[str, Any]:
    surface = result.get("output_surface")
    assert isinstance(surface, dict)
    return surface


def _make_ctx(**overrides: Any) -> reg.ToolContext:
    # NOTE: default user_line must satisfy ``companion_user_intent_server_first_v2_full_replace`` so that the
    # registry-level pre-gate in ``_handle_file_rewrite`` (added Phase D.1 to avoid pool acquire on chat turns) does
    # not short-circuit before the underlying handler runs.
    defaults: dict[str, Any] = {
        "principal_id": "tester",
        "user_line": "полностью перепиши 888.md на одно «Привет»",
        "content_catalog_user_id": "user-1",
        "oauth2_sub_for_content_alternate": None,
        "main_pool": MagicMock(name="main_pool"),
        "companion_pool": MagicMock(name="companion_pool"),
        "shell_norm": None,
        "intent_plan": None,
    }
    defaults.update(overrides)
    return reg.ToolContext(**defaults)


def _stub_background_music_task_spawn(
    monkeypatch: pytest.MonkeyPatch,
) -> dict[str, int]:
    """Prevent detached background jobs from touching DB mocks during unit tests."""

    spawned: dict[str, int] = {"count": 0}

    def _fake_create_task(coro: Any) -> asyncio.Future[Any]:
        spawned["count"] += 1
        # We only validate dispatch semantics here; background execution is covered separately.
        coro.close()
        fut: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
        fut.set_result(None)
        return fut

    monkeypatch.setattr(reg.asyncio, "create_task", _fake_create_task)
    return spawned


@pytest.mark.unit
def test_registry_exposes_canonical_tool_names() -> None:
    """Phase-B contract: the canonical tool names must exist in the registry."""

    names = set(reg.known_tool_names())
    expected = {
        "plan_v1",
        "file_rewrite",
        "operations_status",
        "operation_cancel",
        "catalog_list",
        "catalog_discuss",
        "file_create",
        "file_rename",
        "file_delete",
        "file_open",
        "doc_insert",
        "theme_set",
        "music_generation",
        "music_xl_base_interactive",
        "music_generation_xl_base",
        "image_generation",
        "image_tool",
        "presentation_generation",
        "music_studio_open",
        "app_open",
    }
    missing = expected - names
    assert not missing, f"Registry missing canonical tools: {sorted(missing)}"
    for name in expected:
        d = reg.tool_descriptor(name)
        assert d is not None, f"tool_descriptor({name!r}) returned None"
        assert d.server_only is True, f"Tool {name} must be flagged server_only"
        assert d.summary, f"Tool {name} must have a non-empty summary"


@pytest.mark.unit
def test_unknown_tool_returns_none() -> None:
    """Unknown names must return None (orchestrator falls through; never raises)."""

    ctx = _make_ctx()
    out = asyncio.run(reg.dispatch_tool_by_name("nonexistent", {}, ctx))
    assert out is None


@pytest.mark.unit
def test_file_rewrite_returns_none_when_no_catalog_user(monkeypatch: pytest.MonkeyPatch) -> None:
    """``file_rewrite`` must short-circuit to None when the user has no catalog content owner."""

    ctx = _make_ctx(content_catalog_user_id="")
    out = asyncio.run(reg.dispatch_tool_by_name("file_rewrite", {"user_line": "rewrite test.md"}, ctx))
    assert out is None


@pytest.mark.unit
def test_file_rewrite_proxies_to_server_first_v2_and_wraps_result(monkeypatch: pytest.MonkeyPatch) -> None:
    """When ``server_first.v2.maybe_handle_server_first_v2_turn`` returns a payload, the registry wraps it."""

    async def fake_turn(
        pool: Any,
        *,
        principal_id: str,
        user_line: str,
        content_catalog_user_id: str | None,
        oauth2_sub_for_content_alternate: str | None,
        write_mode: str = "replace",
    ) -> dict[str, Any]:
        assert principal_id == "tester"
        assert "перепиши" in user_line
        assert content_catalog_user_id == "user-1"
        assert write_mode == "replace"
        return {
            "reply": "Готово, переписала 888.md",
            "actions": [{"type": "open_app", "app_component": "DocEditor"}],
            "task_run": None,
        }

    monkeypatch.setattr(
        "api.ewa_platform.companion.server_first.v2.maybe_handle_server_first_v2_turn",
        fake_turn,
    )
    ctx = _make_ctx()
    out = asyncio.run(reg.dispatch_tool_by_name("file_rewrite", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["tool"] == "file_rewrite"
    assert out["status"] == "ok"
    assert "Готово" in out["reply"]
    assert _actions(out) and _actions(out)[0]["type"] == "open_app"


@pytest.mark.unit
def test_handler_exception_becomes_error_status(monkeypatch: pytest.MonkeyPatch) -> None:
    """If the underlying handler raises, the registry must surface a structured error, not crash the caller."""

    async def boom(*args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("storage on fire")

    monkeypatch.setattr(
        "api.ewa_platform.companion.server_first.v2.maybe_handle_server_first_v2_turn",
        boom,
    )
    ctx = _make_ctx()
    out = asyncio.run(reg.dispatch_tool_by_name("file_rewrite", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["status"] == "error"
    assert _data(out)["exception"] == "RuntimeError"
    assert "storage on fire" in _data(out)["message"]


@pytest.mark.unit
def test_unimplemented_tools_return_none_for_now() -> None:
    """Tools declared in the registry but not yet wired must return None (caller falls through)."""

    ctx = _make_ctx(user_line="hello there")
    # No unimplemented tools in the active registry path as of Phase 1.3.
    assert asyncio.run(reg.dispatch_tool_by_name("nonexistent_tool_xyz", {}, ctx)) is None


@pytest.mark.unit
def test_operations_status_returns_none_for_unrelated_line() -> None:
    ctx = _make_ctx(user_line="привет")
    out = asyncio.run(reg.dispatch_tool_by_name("operations_status", {"user_line": ctx.user_line}, ctx))
    assert out is None


@pytest.mark.unit
def test_operations_status_router_bypass_reads_active_runs(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_runs(*_a: Any, **_k: Any) -> list[dict[str, Any]]:
        return [{"id": "run-ops-1", "status": "running", "intent_kind": "music_generation_background", "steps": []}]

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.active_task_runs_prompt.load_active_task_runs_with_steps",
        fake_runs,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.active_task_runs_prompt.format_active_operations_status_reply",
        lambda runs, *, user_line: f"active={len(runs)}",
    )
    ctx = _make_ctx(user_line="what is running now?")
    out = asyncio.run(
        reg.dispatch_tool_by_name(
            "operations_status",
            {"user_line": ctx.user_line, "_tool_router_bypass_line_match": True},
            ctx,
        )
    )
    assert out is not None
    assert out["status"] == "ok"
    assert out["reply"] == "active=1"
    assert _task_run(out) is not None


@pytest.mark.unit
def test_operation_cancel_returns_none_without_cancel_intent() -> None:
    ctx = _make_ctx(user_line="hello there")
    out = asyncio.run(reg.dispatch_tool_by_name("operation_cancel", {"user_line": ctx.user_line}, ctx))
    assert out is None


@pytest.mark.unit
def test_operation_cancel_reports_no_active_runs(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(reg.companion_pg, "companion_task_runs_list", AsyncMock(return_value=[]))
    ctx = _make_ctx(user_line="отмени текущую операцию")
    out = asyncio.run(reg.dispatch_tool_by_name("operation_cancel", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["status"] == "ok"
    assert _data(out)["reason"] == "no_active_run"


# -- Phase 1.3: catalog_discuss tool --------------------------------------------


@pytest.mark.unit
def test_catalog_discuss_returns_none_for_unrelated_line() -> None:
    ctx = _make_ctx(user_line="hello there", content_catalog_user_id="uc-1")
    out = asyncio.run(reg.dispatch_tool_by_name("catalog_discuss", {"user_line": ctx.user_line}, ctx))
    assert out is None


@pytest.mark.unit
def test_catalog_discuss_returns_none_without_catalog_user() -> None:
    ctx = _make_ctx(
        user_line="обсуди файл notes.md",
        content_catalog_user_id="",
    )
    out = asyncio.run(reg.dispatch_tool_by_name("catalog_discuss", {"user_line": ctx.user_line}, ctx))
    assert out is None


@pytest.mark.unit
def test_catalog_discuss_agentic_bypass_with_unified_content_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Agentic tool_router calls must not require discuss-intent phrasing in user_line."""

    monkeypatch.setattr(
        "api.ewa_platform.companion.storage.catalog_file_discuss.catalog_file_discuss_env_enabled",
        lambda: True,
    )

    async def fake_build(*_a: Any, **_k: Any) -> str:
        return "## CRITICAL\n\nFile body here."

    monkeypatch.setattr(
        "api.ewa_platform.companion.storage.catalog_file_discuss.build_catalog_memory_block_for_unified_content",
        fake_build,
    )

    ctx = _make_ctx(content_catalog_user_id="uc-1", user_line="")
    out = asyncio.run(
        reg.dispatch_tool_by_name(
            "catalog_discuss",
            {
                "_tool_router_bypass_line_match": True,
                "unified_content_id": "aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            },
            ctx,
        )
    )
    assert out is not None
    assert out["tool"] == "catalog_discuss"
    assert out["status"] == "memory_append"
    assert "File body here" in _data(out)["memory_section_append"]
    assert _data(out)["unified_content_id"] == "aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


@pytest.mark.unit
def test_catalog_discuss_memory_append_when_body_injected(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_augment(*_a: Any, **_k: Any) -> tuple[str, str, str]:
        return ("## CRITICAL\n\nFile body here.", "aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "notes.md")

    monkeypatch.setattr(
        "api.ewa_platform.companion.storage.catalog_file_discuss.augment_memory_section_with_catalog_file_discuss",
        fake_augment,
    )
    ctx = _make_ctx(
        user_line="обсуди файл notes.md",
        content_catalog_user_id="uc-1",
    )
    out = asyncio.run(reg.dispatch_tool_by_name("catalog_discuss", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["tool"] == "catalog_discuss"
    assert out["status"] == "memory_append"
    assert out["reply"] == ""
    assert "File body here" in _data(out)["memory_section_append"]
    assert _data(out)["orchestration_branch"] == "catalog_discuss"
    assert _data(out)["unified_content_id"] == "aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    assert _data(out)["file_label"] == "notes.md"


# -- Phase E: file_create tool --------------------------------------------------


@pytest.mark.unit
def test_file_create_returns_none_for_unrelated_line() -> None:
    ctx = _make_ctx(user_line="hello there", content_catalog_user_id="uc-1")
    out = asyncio.run(reg.dispatch_tool_by_name("file_create", {"user_line": ctx.user_line}, ctx))
    assert out is None


@pytest.mark.unit
def test_file_create_needs_body_when_text_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    ctx = _make_ctx(
        user_line="создай файл notes.md",
        content_catalog_user_id="uc-1",
    )
    out = asyncio.run(reg.dispatch_tool_by_name("file_create", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["status"] == "ok"
    assert _task_run(out) is None
    assert "текст" in out["reply"].lower()


@pytest.mark.unit
def test_file_create_proposes_confirmation_task_run(monkeypatch: pytest.MonkeyPatch) -> None:
    created: list[dict[str, Any]] = []

    async def fake_run_create(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        run = {"id": "run-1", "status": kwargs["status"], "plan_payload": dict(kwargs["plan_payload"])}
        created.append(run)
        return run

    async def fake_step_create(*_a: Any, **_k: Any) -> dict[str, Any]:
        return {"id": "step-1"}

    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_run_create",
        fake_run_create,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_step_create",
        fake_step_create,
    )

    ctx = _make_ctx(
        user_line="создай файл test.md с текстом: привет",
        content_catalog_user_id="uc-1",
        companion_pool=object(),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("file_create", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["status"] == "needs_confirm"
    assert out["tool"] == "file_create"
    assert _data(out)["orchestration_branch"] == "doc_create"
    assert created[0]["plan_payload"]["kind"] == "doc_create"
    assert created[0]["plan_payload"]["name"] == "test.md"
    assert "Подтверди" in out["reply"]


@pytest.mark.unit
def test_file_rename_proposes_confirmation(monkeypatch: pytest.MonkeyPatch) -> None:
    created: list[dict[str, Any]] = []

    async def fake_resolve(*_a: Any, **_k: Any):
        from api.ewa_platform.companion.orchestration.flows.catalog_resolve import CatalogPhraseMatch

        return CatalogPhraseMatch(unified_content_id="uc-old", label="old.md")

    async def fake_run_create(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        run = {"id": "run-rn", "status": kwargs["status"], "plan_payload": dict(kwargs["plan_payload"])}
        created.append(run)
        return run

    async def fake_step_create(*_a: Any, **_k: Any) -> dict[str, Any]:
        return {"id": "step-rn"}

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.file_rename.resolve_uc_by_phrase",
        fake_resolve,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_run_create",
        fake_run_create,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_step_create",
        fake_step_create,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.file_rename.query_service_or_none",
        AsyncMock(return_value=object()),
    )

    ctx = _make_ctx(
        user_line="переименуй old.md в fresh.md",
        content_catalog_user_id="uc-1",
        companion_pool=object(),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("file_rename", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["status"] == "needs_confirm"
    assert created[0]["plan_payload"]["kind"] == "file_rename"


@pytest.mark.unit
def test_doc_insert_needs_open_editor_without_shell_uc() -> None:
    ctx = _make_ctx(
        user_line="вставь файл notes.md в документ редактора",
        content_catalog_user_id="uc-1",
        companion_pool=object(),
        shell_norm={"windows": []},
    )
    out = asyncio.run(reg.dispatch_tool_by_name("doc_insert", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["status"] == "needs_open_editor"
    assert "редактор" in out["reply"].lower()


# -- Phase C: theme_set tool --------------------------------------------------


@pytest.mark.unit
def test_theme_set_explicit_args_applies_when_auth_available(monkeypatch: pytest.MonkeyPatch) -> None:
    """Explicit ``theme=light`` triggers ``patch_desktop_config`` via the desktop API driver."""

    captured: dict[str, Any] = {}

    async def fake_apply(
        actions: list[dict[str, Any]],
        *,
        bearer_token: str | None,
        auth_user: Any,
    ) -> tuple[list[dict[str, Any]], bool]:
        captured["actions"] = list(actions)
        captured["bearer"] = bearer_token
        captured["auth"] = auth_user
        return [], True

    monkeypatch.setattr(
        "api.ewa_platform.companion.ux.desktop_config_execute.companion_apply_patch_desktop_config_actions",
        fake_apply,
    )

    ctx = _make_ctx(
        user_line="set desktop to light theme",
        bearer_token="bear-xyz",
        auth_user=MagicMock(name="auth_user"),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("theme_set", {"theme": "light"}, ctx))
    assert out is not None
    assert out["tool"] == "theme_set"
    assert out["status"] == "ok"
    assert "light" in out["reply"].lower()
    assert captured["actions"][0]["patch"]["theme"] == "light"
    assert captured["bearer"] == "bear-xyz"


@pytest.mark.unit
def test_theme_set_infers_from_user_line(monkeypatch: pytest.MonkeyPatch) -> None:
    """No explicit ``theme`` → infer from ``ctx.user_line`` via the shared inference helper."""

    async def fake_apply(*_args: Any, **_kwargs: Any) -> tuple[list[dict[str, Any]], bool]:
        return [], True

    monkeypatch.setattr(
        "api.ewa_platform.companion.ux.desktop_config_execute.companion_apply_patch_desktop_config_actions",
        fake_apply,
    )

    ctx = _make_ctx(
        user_line="поставь тёмную тему рабочего стола",
        bearer_token="bear-xyz",
        auth_user=MagicMock(name="auth_user"),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("theme_set", {}, ctx))
    assert out is not None
    assert _data(out)["theme"] == "dark"
    assert "тём" in out["reply"].lower()


@pytest.mark.unit
def test_theme_set_emits_task_run_snapshot_when_companion_pool_available(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Successful immediate tools should expose a durable task-run row for the operations panel."""

    async def fake_apply(*_args: Any, **_kwargs: Any) -> tuple[list[dict[str, Any]], bool]:
        return [], True

    monkeypatch.setattr(
        "api.ewa_platform.companion.ux.desktop_config_execute.companion_apply_patch_desktop_config_actions",
        fake_apply,
    )
    mock_record = AsyncMock(return_value={"id": "run-theme", "status": "completed"})
    monkeypatch.setattr(reg, "_record_instant_completed_task_run", mock_record)

    ctx = _make_ctx(
        user_line="set desktop to dark theme",
        bearer_token="bear-xyz",
        auth_user=MagicMock(name="auth_user"),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("theme_set", {"theme": "dark"}, ctx))
    assert out is not None
    assert out["status"] == "ok"
    assert isinstance(out.get("task_run"), dict)
    assert str(_require_task_run(out).get("id") or "") == "run-theme"
    assert mock_record.await_count == 1
    assert _awaited(mock_record).kwargs["intent_kind"] == "theme_set"


@pytest.mark.unit
def test_theme_set_returns_none_when_user_line_is_not_theme() -> None:
    """When inference yields no theme and no explicit arg, the tool must short-circuit to None."""

    ctx = _make_ctx(
        user_line="расскажи о себе",
        bearer_token="bear-xyz",
        auth_user=MagicMock(name="auth_user"),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("theme_set", {}, ctx))
    assert out is None


@pytest.mark.unit
def test_theme_set_does_not_execute_for_how_question(monkeypatch: pytest.MonkeyPatch) -> None:
    """Questions like «как сменить тему…?» are explanatory and must not mutate desktop config."""

    async def fake_apply(*_args: Any, **_kwargs: Any) -> tuple[list[dict[str, Any]], bool]:
        raise AssertionError("theme_set must not apply side effects for how-questions")

    monkeypatch.setattr(
        "api.ewa_platform.companion.ux.desktop_config_execute.companion_apply_patch_desktop_config_actions",
        fake_apply,
    )
    ctx = _make_ctx(
        user_line="как сменить тему рабочего стола?",
        bearer_token="bear-xyz",
        auth_user=MagicMock(name="auth_user"),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("theme_set", {}, ctx))
    assert out is None


@pytest.mark.unit
def test_theme_set_reports_unavailable_without_auth() -> None:
    """Theme inferred but no bearer/auth → ``status='unavailable'`` (do not silently no-op)."""

    ctx = _make_ctx(
        user_line="поставь светлую тему рабочего стола",
        bearer_token=None,
        auth_user=None,
    )
    out = asyncio.run(reg.dispatch_tool_by_name("theme_set", {}, ctx))
    assert out is not None
    assert out["status"] == "unavailable"
    assert _data(out)["theme"] == "light"


@pytest.mark.unit
def test_theme_set_surfaces_apply_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """When the desktop API PATCH does not succeed, the tool reports ``status='error'``."""

    async def fake_apply(*_args: Any, **_kwargs: Any) -> tuple[list[dict[str, Any]], bool]:
        return [], False

    monkeypatch.setattr(
        "api.ewa_platform.companion.ux.desktop_config_execute.companion_apply_patch_desktop_config_actions",
        fake_apply,
    )

    ctx = _make_ctx(
        user_line="set desktop to dark theme",
        bearer_token="bear-xyz",
        auth_user=MagicMock(name="auth_user"),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("theme_set", {}, ctx))
    assert out is not None
    assert out["status"] == "error"


# -- Phase D: music_generation (env-gated) ------------------------------------


@pytest.mark.unit
def test_music_generation_returns_none_when_env_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """Without ``EWA_COMPANION_BACKEND_MUSIC_GENERATION``, the handler falls through (UI branch may run)."""

    monkeypatch.delenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", raising=False)
    ctx = _make_ctx(
        user_line="сгенерируй песню про лето",
        bearer_token="tok",
        auth_user=MagicMock(),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("music_generation", {"user_line": ctx.user_line}, ctx))
    assert out is None


@pytest.mark.unit
@pytest.mark.parametrize(
    "user_line",
    [
        "сгенерируй песню про лето",
        "давай сгенерим песню на твой вкус",
        "давай сгенерируем песню на твой вкус",
        "можешь сделать песню про дождь?",
        "нужно сгенерировать трек в стиле рок",
        "давай песню про море",
        "нужна песня про весну",
        "can you write me a song about stars",
    ],
)
def test_music_generation_posts_and_returns_tool_result(
    monkeypatch: pytest.MonkeyPatch,
    user_line: str,
) -> None:
    """When env gate is on and HTTP succeeds, start background run and return immediately."""

    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    spawned = _stub_background_music_task_spawn(monkeypatch)

    def _ok(obj: dict[str, Any]) -> MagicMock:
        m = MagicMock()
        m.status_code = 200
        m.text = "{}"
        m.json.return_value = obj
        return m

    mock_inst = MagicMock()
    mock_inst.post = AsyncMock(
        side_effect=[
            _ok({"lyrics": "[Verse 1]\nhello\n"}),
            _ok(
                {
                    "vocal": "female",
                    "bpm": 120,
                    "duration_seconds": 160,
                    "language": "ru",
                    "timesignature": "4",
                    "keyscale": "C major",
                },
            ),
            _ok({"tags": "warm pop"}),
        ],
    )
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_inst)
    mock_cm.__aexit__ = AsyncMock(return_value=None)

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.tool_registry.httpx.AsyncClient",
        MagicMock(return_value=mock_cm),
    )
    mock_run_create = AsyncMock(return_value={"id": "run-abc", "status": "running"})
    monkeypatch.setattr(reg.companion_pg, "companion_task_run_create", mock_run_create)
    mock_step_create = AsyncMock(return_value={"id": "step-1"})
    monkeypatch.setattr(reg.companion_pg, "companion_task_step_create", mock_step_create)

    ctx = _make_ctx(
        user_line=user_line,
        bearer_token="tok-1",
        auth_user=MagicMock(),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("music_generation", {"user_line": ctx.user_line, "bpm": 120}, ctx))
    assert out is not None
    assert out["tool"] == "music_generation"
    assert out["status"] == "ok"
    assert not _actions(out)
    assert isinstance(out.get("task_run"), dict)
    assert str(_require_task_run(out).get("id") or "") == "run-abc"
    reply_l = str(out.get("reply") or "").lower()
    assert "фоне" in reply_l or "background" in reply_l
    assert _data(out)["run_id"] == "run-abc"
    assert _data(out)["background"] is True
    assert _data(out)["autoplay_requested"] is False
    assert mock_run_create.await_count == 1
    assert mock_step_create.await_count == 1
    assert mock_inst.post.await_count == 0
    step_payload = _awaited(mock_step_create).kwargs["input_payload"]
    assert step_payload["bpm_override"] == 120
    assert spawned["count"] == 1


@pytest.mark.unit
def test_music_generation_celery_returns_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_MUSIC_ENABLED", "1")
    spawned = _stub_background_music_task_spawn(monkeypatch)

    enqueued: list[str] = []
    mock_step_create = AsyncMock(return_value={"id": "step-celery"})

    def fake_enqueue(**kwargs: Any) -> str:
        enqueued.append(str(kwargs.get("run_id")))
        return "celery-id-1"

    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run",
        fake_enqueue,
    )
    monkeypatch.setattr(
        reg.companion_pg,
        "companion_task_run_create",
        AsyncMock(return_value={"id": "run-celery", "status": "running", "execution_mode": "async"}),
    )
    monkeypatch.setattr(
        reg.companion_pg,
        "companion_task_step_create",
        mock_step_create,
    )

    ctx = _make_ctx(
        user_line="сгенерируй песню про осень",
        bearer_token="tok-1",
        auth_user=MagicMock(),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("music_generation", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["status"] == "accepted"
    assert _data(out)["execution_mode"] == "async"
    assert enqueued == ["run-celery"]
    assert spawned["count"] == 0
    step_payload = _awaited(mock_step_create).kwargs["input_payload"]
    assert step_payload["theme"]
    assert step_payload["style_key"] == step_payload["style"]
    assert step_payload["language_e"]
    assert step_payload["base_url"]


@pytest.mark.unit
def test_resolve_music_job_base_url_rewrites_loopback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_LAN_WORKER_HTTP_BASE_URL", "http://192.168.1.136:29000")
    monkeypatch.setattr(
        reg.socket,
        "getaddrinfo",
        MagicMock(side_effect=OSError("stack0 dns unavailable")),
    )
    out = reg._resolve_music_job_base_url({"base_url": "http://127.0.0.1:8000/api/v1/music-generator"})
    assert out == "http://192.168.1.136:29000/api/v1/music-generator"


@pytest.mark.unit
def test_resolve_music_job_base_url_prefers_local_stack0_when_resolvable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ELITEEW_LAN_WORKER_HTTP_BASE_URL", "http://192.168.1.136:29000")
    monkeypatch.setattr(reg.socket, "getaddrinfo", lambda *_args, **_kwargs: [object()])

    out = reg._resolve_music_job_base_url({"base_url": "http://192.168.1.136:29000/api/v1/music-generator"})

    assert out == "http://stack0-eliteew-api-prod:8000/api/v1/music-generator"


@pytest.mark.unit
def test_music_generation_celery_uses_lan_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_MUSIC_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_LAN_WORKER_HTTP_BASE_URL", "http://192.168.1.136:29000")
    _stub_background_music_task_spawn(monkeypatch)
    captured: dict[str, Any] = {}

    def fake_enqueue(**kwargs: Any) -> str:
        captured.update(kwargs.get("job_payload") or {})
        return "celery-id-lan"

    monkeypatch.setattr("api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run", fake_enqueue)
    monkeypatch.setattr(
        reg.companion_pg,
        "companion_task_run_create",
        AsyncMock(return_value={"id": "run-lan", "status": "running", "execution_mode": "async"}),
    )
    monkeypatch.setattr(
        reg.companion_pg,
        "companion_task_step_create",
        AsyncMock(return_value={"id": "step-lan"}),
    )
    ctx = _make_ctx(
        user_line="сгенерируй песню про осень",
        bearer_token="tok-1",
        auth_user=MagicMock(),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("music_generation", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert captured.get("base_url") == "http://192.168.1.136:29000/api/v1/music-generator"


@pytest.mark.unit
def test_music_generation_retry_reuses_failed_run_theme(monkeypatch: pytest.MonkeyPatch) -> None:
    """Retry phrases enqueue a new run with theme/style from the latest failed music operation."""

    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_MUSIC_ENABLED", "1")
    _stub_background_music_task_spawn(monkeypatch)

    enqueued: list[str] = []

    def fake_enqueue(**kwargs: Any) -> str:
        enqueued.append(str(kwargs.get("run_id")))
        return "celery-id-retry"

    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run",
        fake_enqueue,
    )
    monkeypatch.setattr(
        reg.companion_pg,
        "companion_task_find_latest_failed_by_intent",
        AsyncMock(
            return_value={
                "id": "run-failed-1",
                "plan_payload": {
                    "theme_preview": "Empery World быстрая динамичная",
                    "style": "pop",
                    "voice_diversity": "balanced",
                },
            },
        ),
    )
    mock_run_create = AsyncMock(return_value={"id": "run-retry", "status": "running", "execution_mode": "async"})
    mock_step_create = AsyncMock(return_value={"id": "step-retry"})
    monkeypatch.setattr(reg.companion_pg, "companion_task_run_create", mock_run_create)
    monkeypatch.setattr(reg.companion_pg, "companion_task_step_create", mock_step_create)

    ctx = _make_ctx(
        user_line="перезапусти, та упала с ошибкой",
        bearer_token="tok-1",
        auth_user=MagicMock(),
        companion_pool=MagicMock(name="companion_pool"),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("music_generation", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["status"] == "accepted"
    assert enqueued == ["run-retry"]
    plan_payload = _awaited(mock_run_create).kwargs["plan_payload"]
    assert plan_payload["theme_preview"] == "Empery World быстрая динамичная"
    assert plan_payload["style"] == "pop"


@pytest.mark.unit
@pytest.mark.parametrize(
    "user_line",
    [
        "Davay ehe odny Empery World",
        "давай еще один Empery World",
        "eshe odin pro leto",
        "another song about summer",
    ],
)
def test_user_line_requests_music_another_one(user_line: str) -> None:
    assert reg._user_line_requests_music_another_one(user_line)
    assert reg._user_line_requests_music_creation(user_line)


@pytest.mark.unit
def test_music_generation_another_one_translit_enqueues(monkeypatch: pytest.MonkeyPatch) -> None:
    """Transliterated «давай ещё один …» must enqueue Celery, not fall through to plain LLM chat."""

    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_MUSIC_ENABLED", "1")
    _stub_background_music_task_spawn(monkeypatch)

    enqueued: list[str] = []

    def fake_enqueue(**kwargs: Any) -> str:
        enqueued.append(str(kwargs.get("run_id")))
        return "celery-id-another"

    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run",
        fake_enqueue,
    )
    monkeypatch.setattr(
        reg.companion_pg,
        "companion_task_find_latest_completed_by_intent",
        AsyncMock(
            return_value={
                "id": "run-done-1",
                "plan_payload": {
                    "theme_preview": "Empery World быстрая динамичная",
                    "style": "pop",
                    "voice_diversity": "balanced",
                },
            },
        ),
    )
    mock_run_create = AsyncMock(return_value={"id": "run-another", "status": "running", "execution_mode": "async"})
    mock_step_create = AsyncMock(return_value={"id": "step-another"})
    monkeypatch.setattr(reg.companion_pg, "companion_task_run_create", mock_run_create)
    monkeypatch.setattr(reg.companion_pg, "companion_task_step_create", mock_step_create)

    ctx = _make_ctx(
        user_line="Davay ehe odny Empery World",
        bearer_token="tok-1",
        auth_user=MagicMock(),
        companion_pool=MagicMock(name="companion_pool"),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("music_generation", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["status"] == "accepted"
    assert enqueued == ["run-another"]
    plan_payload = _awaited(mock_run_create).kwargs["plan_payload"]
    assert plan_payload["theme_preview"] == "Empery World"


@pytest.mark.unit
@pytest.mark.parametrize(
    "user_line_auto",
    [
        "сгенерируй песню про лето и сразу включай как будет готово",
        "напиши трек про дождь, включай как будет готово",
        "generate a song about rain, play when ready",
    ],
)
def test_music_generation_autoplay_skips_confirm(
    monkeypatch: pytest.MonkeyPatch,
    user_line_auto: str,
) -> None:
    """Autoplay phrasing marks background run for auto-play, without blocking the turn."""

    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    spawned = _stub_background_music_task_spawn(monkeypatch)

    def _ok(obj: dict[str, Any]) -> MagicMock:
        m = MagicMock()
        m.status_code = 200
        m.text = "{}"
        m.json.return_value = obj
        return m

    mock_resp_chain = [
        _ok({"lyrics": "[Verse 1]\nhello\n"}),
        _ok(
            {
                "vocal": "female",
                "bpm": 118,
                "duration_seconds": 160,
                "language": "ru",
                "timesignature": "4",
                "keyscale": "C major",
            },
        ),
        _ok({"tags": "x"}),
    ]

    mock_inst = MagicMock()
    mock_inst.post = AsyncMock(side_effect=mock_resp_chain)
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_inst)
    mock_cm.__aexit__ = AsyncMock(return_value=None)

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.tool_registry.httpx.AsyncClient",
        MagicMock(return_value=mock_cm),
    )
    mock_run_create = AsyncMock(return_value={"id": "run-auto", "status": "running"})
    monkeypatch.setattr(reg.companion_pg, "companion_task_run_create", mock_run_create)
    mock_step_create = AsyncMock(return_value={"id": "step-auto"})
    monkeypatch.setattr(reg.companion_pg, "companion_task_step_create", mock_step_create)

    ctx = _make_ctx(user_line=user_line_auto, bearer_token="tok-a", auth_user=MagicMock())
    out = asyncio.run(reg.dispatch_tool_by_name("music_generation", {"user_line": user_line_auto}, ctx))
    assert out is not None
    assert out["status"] == "ok"
    assert _actions(out) == []
    assert _data(out)["autoplay_requested"] is True
    assert _data(out)["background"] is True
    assert _data(out)["run_id"] == "run-auto"
    assert mock_run_create.await_count == 1
    assert mock_step_create.await_count == 1
    assert mock_inst.post.await_count == 0
    step_payload = _awaited(mock_step_create).kwargs["input_payload"]
    assert "сразу включай" not in str(step_payload.get("theme_preview") or "").lower()
    assert spawned["count"] == 1


@pytest.mark.unit
def test_music_generation_autoplay_from_explicit_arg(monkeypatch: pytest.MonkeyPatch) -> None:
    """Truth-y ``play_when_ready`` / ``autoplay`` in args marks background run for auto-play."""

    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    spawned = _stub_background_music_task_spawn(monkeypatch)

    def _ok(obj: dict[str, Any]) -> MagicMock:
        m = MagicMock()
        m.status_code = 200
        m.text = "{}"
        m.json.return_value = obj
        return m

    mock_inst = MagicMock()
    mock_inst.post = AsyncMock(
        side_effect=[
            _ok({"lyrics": "[Verse 1]\nhello\n"}),
            _ok(
                {
                    "vocal": "female",
                    "bpm": 120,
                    "duration_seconds": 160,
                    "language": "ru",
                    "timesignature": "4",
                    "keyscale": "C major",
                },
            ),
            _ok({"tags": "t"}),
        ],
    )
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_inst)
    mock_cm.__aexit__ = AsyncMock(return_value=None)

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.tool_registry.httpx.AsyncClient",
        MagicMock(return_value=mock_cm),
    )
    mock_run_create = AsyncMock(return_value={"id": "run-arg", "status": "running"})
    monkeypatch.setattr(reg.companion_pg, "companion_task_run_create", mock_run_create)
    mock_step_create = AsyncMock(return_value={"id": "step-arg"})
    monkeypatch.setattr(reg.companion_pg, "companion_task_step_create", mock_step_create)

    ctx = _make_ctx(user_line="сгенерируй песню про осень", bearer_token="tok-b", auth_user=MagicMock())
    out = asyncio.run(
        reg.dispatch_tool_by_name(
            "music_generation",
            {"user_line": ctx.user_line, "play_when_ready": True},
            ctx,
        ),
    )
    assert out is not None and out["status"] == "ok"
    assert _actions(out) == []
    assert _data(out)["run_id"] == "run-arg"
    assert _data(out)["autoplay_requested"] is True
    assert _data(out)["background"] is True
    assert mock_run_create.await_count == 1
    assert mock_step_create.await_count == 1
    assert mock_inst.post.await_count == 0
    assert spawned["count"] == 1


@pytest.mark.unit
def test_music_generation_explicit_lyrics_skips_lyrics_http(monkeypatch: pytest.MonkeyPatch) -> None:
    """When ``lyrics`` is passed in args, skip ``POST …/lyrics`` before background dispatch."""

    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    spawned = _stub_background_music_task_spawn(monkeypatch)

    def _ok(obj: dict[str, Any]) -> MagicMock:
        m = MagicMock()
        m.status_code = 200
        m.text = "{}"
        m.json.return_value = obj
        return m

    mock_inst = MagicMock()
    mock_inst.post = AsyncMock(
        side_effect=[
            _ok(
                {
                    "vocal": "female",
                    "bpm": 120,
                    "duration_seconds": 160,
                    "language": "ru",
                    "timesignature": "4",
                    "keyscale": "C major",
                },
            ),
            _ok({"tags": "styled"}),
        ],
    )
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_inst)
    mock_cm.__aexit__ = AsyncMock(return_value=None)

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.tool_registry.httpx.AsyncClient",
        MagicMock(return_value=mock_cm),
    )
    monkeypatch.setattr(
        reg.companion_pg,
        "companion_task_run_create",
        AsyncMock(return_value={"id": "run-x", "status": "running"}),
    )
    mock_step_create = AsyncMock(return_value={"id": "s1"})
    monkeypatch.setattr(reg.companion_pg, "companion_task_step_create", mock_step_create)

    ctx = _make_ctx(user_line="сгенерируй песню про зиму", bearer_token="tok-c", auth_user=MagicMock())
    lyrics = "[Verse 1]\nуже есть текст\n"
    out = asyncio.run(
        reg.dispatch_tool_by_name(
            "music_generation",
            {"user_line": ctx.user_line, "lyrics": lyrics},
            ctx,
        ),
    )
    assert out is not None and out["status"] == "ok"
    assert _data(out)["run_id"] == "run-x"
    assert _data(out)["background"] is True
    assert mock_inst.post.await_count == 0
    step_payload = _awaited(mock_step_create).kwargs["input_payload"]
    assert step_payload["lyrics_supplied"] is True
    assert spawned["count"] == 1


@pytest.mark.unit
def test_allowlist_accepts_music_play_track() -> None:
    from api.ewa_platform.companion.actions.allowlist import normalize_actions_list_from_json

    rows = normalize_actions_list_from_json(
        [{"type": "music_play_track", "unified_content_id": "u1", "track_name": "Named"}],
    )
    assert len(rows) == 1
    assert rows[0]["type"] == "music_play_track"
    assert rows[0]["unified_content_id"] == "u1"
    assert rows[0]["track_name"] == "Named"


@pytest.mark.unit
@pytest.mark.unit
def test_clamp_companion_pipeline_lyrics_truncates_over_limit() -> None:
    long_text = "x" * 9000
    from api.routers.music_generator_constants import MAX_LYRICS_LENGTH

    clipped = reg._clamp_companion_pipeline_lyrics(long_text)
    assert len(clipped) == MAX_LYRICS_LENGTH


@pytest.mark.unit
@pytest.mark.parametrize(
    "user_line",
    [
        "АХУЕННЫЙ ТРЕК ТЫ СДЕЛАЛА",
        "ахуенный трек ты сделала",
        "классный трек, спасибо",
        "great track you made",
        "thanks for the song",
    ],
)
def test_user_line_is_music_feedback_or_praise(user_line: str) -> None:
    assert reg._user_line_is_music_feedback_or_praise(user_line)
    assert not reg._user_line_requests_music_creation(user_line)


@pytest.mark.unit
def test_music_retry_does_not_match_ne_povtoryat_in_glossary_question() -> None:
    line = "и не повторять одно и то же, если есть более эффективный способ"
    assert not reg._user_line_requests_music_creation(line)


@pytest.mark.unit
def test_music_retry_still_matches_explicit_retry_phrase() -> None:
    assert reg._user_line_requests_music_creation("повтори генерацию с темой Empery World")


@pytest.mark.unit
@pytest.mark.parametrize(
    "user_line",
    [
        "сделай трек про лето",
        "сделай крутой трек про дождь",
        "давай еще один pro leto",
        "Davay ehe odny Empery World",
    ],
)
def test_music_creation_still_matches_generation_intents(user_line: str) -> None:
    assert not reg._user_line_is_music_feedback_or_praise(user_line)
    assert reg._user_line_requests_music_creation(user_line)


@pytest.mark.unit
def test_music_generation_skips_praise_even_with_router_bypass(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    ctx = _make_ctx(user_line="АХУЕННЫЙ ТРЕК ТЫ СДЕЛАЛА", bearer_token="t", auth_user=MagicMock())
    out = asyncio.run(
        reg.dispatch_tool_by_name(
            "music_generation",
            {
                "user_line": ctx.user_line,
                "theme": "ахуенный",
                "_tool_router_bypass_line_match": True,
            },
            ctx,
        )
    )
    assert out is None


@pytest.mark.unit
def test_music_generation_returns_none_for_unrelated_chat(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    ctx = _make_ctx(user_line="расскажи анекдот", bearer_token="t", auth_user=MagicMock())
    out = asyncio.run(reg.dispatch_tool_by_name("music_generation", {"user_line": ctx.user_line}, ctx))
    assert out is None


@pytest.mark.unit
def test_music_generation_returns_none_for_how_question(monkeypatch: pytest.MonkeyPatch) -> None:
    """How-to questions about generation must not fire server-side generation."""

    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    ctx = _make_ctx(user_line="как сгенерировать песню в студии?", bearer_token="t", auth_user=MagicMock())
    out = asyncio.run(reg.dispatch_tool_by_name("music_generation", {"user_line": ctx.user_line}, ctx))
    assert out is None


# -- Presentation tool (EWRP adapter) -----------------------------------------


@pytest.mark.unit
def test_presentation_generation_creates_background_run(monkeypatch: pytest.MonkeyPatch) -> None:
    """Companion presentation requests should enqueue an EWRP-backed operation."""

    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "0")
    spawned = _stub_background_music_task_spawn(monkeypatch)
    mock_run_create = AsyncMock(return_value={"id": "run-prs", "status": "running"})
    mock_step_create = AsyncMock(return_value={"id": "step-prs"})
    monkeypatch.setattr(reg.companion_pg, "companion_task_run_create", mock_run_create)
    monkeypatch.setattr(reg.companion_pg, "companion_task_step_create", mock_step_create)

    ctx = _make_ctx(
        user_line="создай презентацию на 9 слайдов про премиальный фитнес-клуб",
        bearer_token="tok-prs",
        auth_user=MagicMock(),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("presentation_generation", {"user_line": ctx.user_line}, ctx))

    assert out is not None
    assert out["tool"] == "presentation_generation"
    assert out["status"] == "ok"
    assert _data(out)["run_id"] == "run-prs"
    assert _data(out)["background"] is True
    assert _data(out)["num_slides"] == 9
    step_payload = _awaited(mock_step_create).kwargs["input_payload"]
    assert step_payload["num_slides"] == 9
    assert "фитнес" in step_payload["topic"]
    assert step_payload["presentation_theme"] in {"aurora", "editorial"}
    assert spawned["count"] == 1


@pytest.mark.unit
def test_presentation_generation_returns_none_for_how_question() -> None:
    ctx = _make_ctx(
        user_line="как сделать презентацию в EWRP?",
        bearer_token="tok-prs",
        auth_user=MagicMock(),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("presentation_generation", {"user_line": ctx.user_line}, ctx))
    assert out is None


# -- Image tool (generation/editing) ------------------------------------------


@pytest.mark.unit
def test_image_tool_queues_edit_run_from_source_content_id(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_IMAGE_GENERATION_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "1")
    captured_enqueue: dict[str, Any] = {}
    captured_step: dict[str, Any] = {}

    def fake_enqueue(**kwargs: Any) -> str:
        captured_enqueue.update(kwargs)
        return "celery-image-edit"

    async def fake_run_create(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        return {
            "id": "run-img-edit",
            "principal_id": kwargs["principal_id"],
            "status": kwargs["status"],
            "intent_kind": kwargs["intent_kind"],
            "plan_payload": dict(kwargs["plan_payload"]),
        }

    async def fake_step_create(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        captured_step.update(dict(kwargs["input_payload"]))
        return {"id": "step-img-edit", "input_payload": dict(kwargs["input_payload"])}

    monkeypatch.setattr("api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run", fake_enqueue)
    monkeypatch.setattr(reg.companion_pg, "companion_task_run_create", fake_run_create)
    monkeypatch.setattr(reg.companion_pg, "companion_task_step_create", fake_step_create)

    source_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    ctx = _make_ctx(user_line=f"измени изображение uc={source_id}: убери фон")
    out = asyncio.run(reg.dispatch_tool_by_name("image_generation", {"user_line": ctx.user_line}, ctx))

    assert out is not None
    assert out["status"] == "accepted"
    assert _require_task_run(out)["intent_kind"] == "image_edit_background"
    assert _require_task_run(out)["plan_payload"]["image_tool_mode"] == "edit"
    assert _require_task_run(out)["plan_payload"]["source_content_id"] == source_id
    assert captured_enqueue["job_payload"]["operation_mode"] == "edit"
    assert captured_enqueue["job_payload"]["source_content_id"] == source_id
    assert captured_step["catalog_user_id"] == "user-1"
    assert captured_step["operation_mode"] == "edit"
    assert captured_step["prompt"]
    assert captured_step["source_content_id"] == source_id


@pytest.mark.unit
def test_image_tool_does_not_steal_vision_analysis_with_attachment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_IMAGE_GENERATION_ENABLED", "1")
    ctx = _make_ctx(
        user_line="опиши картинку",
        image_attachment={"mime_type": "image/png", "data_base64": "unused"},
    )

    out = asyncio.run(reg.dispatch_tool_by_name("image_generation", {"user_line": ctx.user_line}, ctx))

    assert out is None


# -- Phase D: music_studio_open + app_open ------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize(
    "user_line",
    [
        "сделай мне песню про лето",
        "сгенерируй трек в стиле synthwave",
        "напиши песню для моей дочки",
        "запиши новую композицию",
        "включи студию записи",
        "открой студию звукозаписи",
        "generate a new song about coding",
        "compose a track for me",
        "write me a song about the ocean",
        "open the music studio",
        "песню сгенерируй про любовь",
        "хочу новую песню",
        "запусти генерацию трека",
        "давай сгенерим песню на твой вкус",
        "давай сгенерируем песню на твой вкус",
        "I want a song about rain",
        "можешь сделать песню про дождь?",
        "нужна песня про весну",
        "давай трек про ночь",
        "can you write me a song about stars",
    ],
)
def test_music_studio_open_recognizes_music_generation_intents(
    monkeypatch: pytest.MonkeyPatch,
    user_line: str,
) -> None:
    """Phase D: RU/EN imperatives about song / track creation must open the Music Studio when backend gate is off."""

    monkeypatch.delenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", raising=False)
    monkeypatch.setattr(reg, "_companion_backend_music_generation_enabled", lambda: False)
    ctx = _make_ctx(user_line=user_line)
    out = asyncio.run(reg.dispatch_tool_by_name("music_studio_open", {"user_line": user_line}, ctx))
    assert out is not None, f"music_studio_open must match: {user_line!r}"
    assert out["tool"] == "music_studio_open"
    assert out["status"] == "ok"
    assert _actions(out), "must include an open_app action"
    action = _actions(out)[0]
    assert action["type"] == "open_app"
    assert action["app_component"] == "MusicGenerator"
    assert out["reply"], "must include a non-empty user-facing reply"


@pytest.mark.unit
def test_music_studio_open_returns_none_for_unrelated_chat() -> None:
    """Phase D: chat lines that do not match music intents must fall through (return None)."""

    ctx = _make_ctx(user_line="расскажи как ты себя чувствуешь")
    out = asyncio.run(reg.dispatch_tool_by_name("music_studio_open", {"user_line": ctx.user_line}, ctx))
    assert out is None


@pytest.mark.unit
def test_music_studio_open_returns_none_for_how_question() -> None:
    ctx = _make_ctx(user_line="как открыть music studio?")
    out = asyncio.run(reg.dispatch_tool_by_name("music_studio_open", {"user_line": ctx.user_line}, ctx))
    assert out is None


@pytest.mark.unit
def test_music_studio_open_emits_task_run_snapshot(monkeypatch: pytest.MonkeyPatch) -> None:
    """Music Studio quick-open is immediate but should still appear in Current operations."""

    monkeypatch.delenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", raising=False)
    monkeypatch.setattr(reg, "_companion_backend_music_generation_enabled", lambda: False)
    mock_record = AsyncMock(return_value={"id": "run-studio", "status": "completed"})
    monkeypatch.setattr(reg, "_record_instant_completed_task_run", mock_record)

    ctx = _make_ctx(user_line="открой студию записи")
    out = asyncio.run(reg.dispatch_tool_by_name("music_studio_open", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["status"] == "ok"
    assert _actions(out)[0]["app_component"] == "MusicGenerator"
    assert isinstance(out.get("task_run"), dict)
    assert str(_require_task_run(out).get("id") or "") == "run-studio"
    assert _awaited(mock_record).kwargs["intent_kind"] == "music_studio_open"
    assert mock_record.await_count == 1


@pytest.mark.unit
def test_music_studio_open_mobile_delegates_to_music_generation(monkeypatch: pytest.MonkeyPatch) -> None:
    """Mobile shell must not emit useless open_app — delegate to background music_generation."""

    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    _stub_background_music_task_spawn(monkeypatch)
    mock_handle = AsyncMock(return_value={"tool": "music_generation", "status": "ok", "reply": "ok", "actions": []})
    monkeypatch.setattr(reg, "_handle_music_generation", mock_handle)

    ctx = _make_ctx(
        user_line="Открой музыкальную студию, чтобы запустить генерацию вручную.",
        shell_norm={"schema_version": 1, "client_surface": "mobile", "windows": []},
        bearer_token="tok",
        auth_user=MagicMock(),
    )
    out = asyncio.run(
        reg.dispatch_tool_by_name(
            "music_studio_open",
            {"user_line": ctx.user_line, "_tool_router_bypass_line_match": True},
            ctx,
        )
    )
    assert out is not None
    assert out["tool"] == "music_generation"
    mock_handle.assert_awaited_once()


@pytest.mark.unit
def test_app_open_mobile_music_generator_delegates(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    mock_handle = AsyncMock(return_value={"tool": "music_generation", "status": "ok", "reply": "ok", "actions": []})
    monkeypatch.setattr(reg, "_handle_music_generation", mock_handle)

    ctx = _make_ctx(
        user_line="open music studio",
        shell_norm={"schema_version": 1, "client_surface": "mobile", "windows": []},
        bearer_token="tok",
        auth_user=MagicMock(),
    )
    out = asyncio.run(reg.dispatch_tool_by_name("app_open", {"app_component": "MusicGenerator"}, ctx))
    assert out is not None
    assert out["tool"] == "music_generation"
    mock_handle.assert_awaited_once()


@pytest.mark.unit
def test_app_open_remaps_legacy_elite_chat_component() -> None:
    ctx = _make_ctx(user_line="hi")
    out = asyncio.run(
        reg.dispatch_tool_by_name("app_open", {"app_component": "EliteChat"}, ctx),
    )
    assert out is not None
    assert out["status"] == "ok"
    assert _actions(out)[0]["app_component"] == "GAFChatApp"


@pytest.mark.unit
def test_app_open_explicit_component_emits_allowlisted_action() -> None:
    """Phase D: explicit ``app_component`` argument emits an ``open_app`` SPA action."""

    ctx = _make_ctx(user_line="hi")
    out = asyncio.run(
        reg.dispatch_tool_by_name("app_open", {"app_component": "DocEditor"}, ctx),
    )
    assert out is not None
    assert out["status"] == "ok"
    assert _actions(out)[0]["type"] == "open_app"
    assert _actions(out)[0]["app_component"] == "DocEditor"


@pytest.mark.unit
def test_app_open_emits_task_run_snapshot(monkeypatch: pytest.MonkeyPatch) -> None:
    """Allowlisted app-open should persist as a completed operation row."""

    mock_record = AsyncMock(return_value={"id": "run-open", "status": "completed"})
    monkeypatch.setattr(reg, "_record_instant_completed_task_run", mock_record)

    ctx = _make_ctx(user_line="open doc editor")
    out = asyncio.run(
        reg.dispatch_tool_by_name("app_open", {"app_component": "DocEditor"}, ctx),
    )
    assert out is not None
    assert out["status"] == "ok"
    assert _actions(out)[0]["type"] == "open_app"
    assert _actions(out)[0]["app_component"] == "DocEditor"
    assert isinstance(out.get("task_run"), dict)
    assert str(_require_task_run(out).get("id") or "") == "run-open"
    assert _awaited(mock_record).kwargs["intent_kind"] == "app_open"
    assert mock_record.await_count == 1


@pytest.mark.unit
def test_app_open_rejects_non_allowlisted_component() -> None:
    """Phase D: app components outside the companion allowlist must produce ``status='error'``, not silent no-op."""

    ctx = _make_ctx(user_line="hi")
    out = asyncio.run(
        reg.dispatch_tool_by_name("app_open", {"app_component": "ServerInternalSecretsApp"}, ctx),
    )
    assert out is not None
    assert out["status"] == "error"
    assert not _actions(out)
    assert "ServerInternalSecretsApp" in out["reply"] or "ServerInternalSecretsApp" in str(_data(out))


@pytest.mark.unit
@pytest.mark.parametrize(
    ("user_line", "expected_component"),
    [
        ("открой плеер", "MusicPlayer"),
        ("запусти редактор документов", "DocEditor"),
        ("открой настройки", "DesktopShellSettings"),
        ("launch DocEditor", "DocEditor"),
        ("open assistant", "AssistantApp"),
        ("открой каталог", "ContentManagerPro"),
        ("запусти студию изображений", "ImageStudio"),
    ],
)
def test_app_open_infers_component_from_user_line(user_line: str, expected_component: str) -> None:
    """Phase D: ``открой / запусти / open / launch <NAME>`` infers a canonical allowlisted component."""

    ctx = _make_ctx(user_line=user_line)
    out = asyncio.run(reg.dispatch_tool_by_name("app_open", {"user_line": user_line}, ctx))
    assert out is not None, f"app_open must match: {user_line!r}"
    assert out["status"] == "ok"
    assert _actions(out)[0]["app_component"] == expected_component


@pytest.mark.unit
def test_app_open_returns_none_for_unrelated_chat() -> None:
    """Phase D: lines that are neither explicit nor "open X" patterns must fall through (None)."""

    ctx = _make_ctx(user_line="расскажи кто ты")
    out = asyncio.run(reg.dispatch_tool_by_name("app_open", {"user_line": ctx.user_line}, ctx))
    assert out is None


@pytest.mark.unit
def test_app_open_returns_none_for_how_question() -> None:
    """How-to questions should remain chat answers, not immediate app launches."""

    ctx = _make_ctx(user_line="как открыть плеер?")
    out = asyncio.run(reg.dispatch_tool_by_name("app_open", {"user_line": ctx.user_line}, ctx))
    assert out is None


# -- Phase F: catalog_list + file_open server tools ---------------------------


@pytest.mark.unit
def test_catalog_list_returns_none_for_unrelated_line() -> None:
    ctx = _make_ctx(user_line="привет, как дела?")
    out = asyncio.run(reg.dispatch_tool_by_name("catalog_list", {"user_line": ctx.user_line}, ctx))
    assert out is None


@pytest.mark.unit
def test_catalog_list_workflow_bypass_force_browse(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.ewa_platform.companion.orchestration.flows.catalog_resolve as catalog_resolve
    import api.ewa_platform.companion.storage.catalog_find as catalog_find

    fake_row = MagicMock()
    fake_row.id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    fake_row.name = "notes.md"
    fake_row.content_type = "document"
    fake_row.mime_type = "text/markdown"
    fake_row.updated_at = ""
    fake_row.search_snippet = ""
    fake_bundle = MagicMock()
    fake_bundle.collected_rows = (fake_row,)
    fake_bundle.appendix = "**Catalog (EwaFile browse):**\n- notes.md"
    fake_bundle.keyword_query = ""
    fake_bundle.browse_all = True

    build_mock = AsyncMock(return_value=fake_bundle)
    monkeypatch.setattr(catalog_resolve, "query_service_or_none", AsyncMock(return_value=MagicMock(name="query_svc")))
    monkeypatch.setattr(catalog_find, "build_companion_catalog_find_bundle", build_mock)

    ctx = _make_ctx(user_line="делаем дела")
    out = asyncio.run(
        reg.dispatch_tool_by_name(
            "catalog_list",
            {"user_line": ctx.user_line, "mode": "list", "_tool_router_bypass_line_match": True},
            ctx,
        )
    )
    assert out is not None
    assert out["status"] == "ok"
    assert _awaited(build_mock).kwargs.get("force_browse") is True
    surface = out.get("output_surface")
    assert isinstance(surface, dict)
    assert surface["mode"] == "file_list"


@pytest.mark.unit
def test_catalog_list_workflow_bypass_returns_unavailable_when_query_service_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import api.ewa_platform.companion.orchestration.flows.catalog_resolve as catalog_resolve

    monkeypatch.setattr(catalog_resolve, "query_service_or_none", AsyncMock(return_value=None))

    ctx = _make_ctx(user_line="покажи мой каталог")
    out = asyncio.run(
        reg.dispatch_tool_by_name(
            "catalog_list",
            {"user_line": ctx.user_line, "_tool_router_bypass_line_match": True},
            ctx,
        )
    )
    assert out is not None
    assert out["status"] == "unavailable"
    assert _actions(out)[0]["type"] == "open_app"
    assert _actions(out)[0]["app_component"] == "EwaFileManager"
    assert _data(out)["fallback"] == "query_service_unavailable"


@pytest.mark.unit
def test_catalog_list_materializes_clickable_file_list_surface(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.ewa_platform.companion.orchestration.flows.catalog_resolve as catalog_resolve
    import api.ewa_platform.companion.storage.catalog_find as catalog_find

    fake_row = MagicMock()
    fake_row.id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    fake_row.name = "notes.md"
    fake_row.content_type = "document"
    fake_row.mime_type = "text/markdown"
    fake_row.updated_at = ""
    fake_row.search_snippet = ""
    fake_bundle = MagicMock()
    fake_bundle.collected_rows = (fake_row,)
    fake_bundle.appendix = "**Catalog (EwaFile browse):**\n- notes.md"
    fake_bundle.keyword_query = ""
    fake_bundle.browse_all = True

    monkeypatch.setattr(
        catalog_resolve,
        "query_service_or_none",
        AsyncMock(return_value=MagicMock(name="query_svc")),
    )
    monkeypatch.setattr(catalog_find, "build_companion_catalog_find_bundle", AsyncMock(return_value=fake_bundle))

    ctx = _make_ctx(user_line="покажи список файлов")
    out = asyncio.run(reg.dispatch_tool_by_name("catalog_list", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["status"] == "ok"
    assert out["tool"] == "catalog_list"
    assert _data(out)["catalog_appendix"] == fake_bundle.appendix
    assert _actions(out) == []
    assert _surface(out)["mode"] == "file_list"
    assert _surface(out)["payload"]["items"][0]["unifiedContentId"] == fake_row.id


@pytest.mark.unit
def test_file_open_returns_none_for_unrelated_line(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.ewa_platform.companion.orchestration.flows.file_open as file_open_flow

    monkeypatch.setattr(file_open_flow, "propose_file_open", AsyncMock(return_value=None))
    ctx = _make_ctx(user_line="расскажи анекдот")
    out = asyncio.run(reg.dispatch_tool_by_name("file_open", {"user_line": ctx.user_line}, ctx))
    assert out is None


@pytest.mark.unit
def test_file_open_emits_doceditor_action(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.ewa_platform.companion.orchestration.flows.file_open as file_open_flow

    uid = "dddddddd-dddd-dddd-dddd-dddddddddddd"

    async def _propose(**_kw: Any) -> dict[str, Any]:
        return {
            "reply": "Открываю «notes.md» в редакторе документов.",
            "actions": [
                {
                    "type": "open_app",
                    "app_component": "DocEditor",
                    "unified_content_id": uid,
                },
            ],
            "output_surface": {
                "mode": "document_editor",
                "payload": {"unifiedContentId": uid, "title": "notes.md", "source": "companion_action"},
            },
            "task_run": None,
            "data": {"unified_content_id": uid, "label": "notes.md"},
        }

    monkeypatch.setattr(file_open_flow, "propose_file_open", _propose)
    ctx = _make_ctx(user_line="открой notes.md в редакторе")
    out = asyncio.run(reg.dispatch_tool_by_name("file_open", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    assert out["status"] == "ok"
    assert out["tool"] == "file_open"
    assert _actions(out)[0]["unified_content_id"] == uid
    assert _surface(out)["mode"] == "document_editor"
    assert _surface(out)["payload"]["unifiedContentId"] == uid
