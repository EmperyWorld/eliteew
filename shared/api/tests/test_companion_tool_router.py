# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for companion Tool Router parsing, mode gates, costly-tool line-match,
# theme-hint continuation gate, and shadow dispatch.
# Related:
# - api/ewa_platform/companion/sidecar/tool_router.py
# - api/ewa_platform/companion/orchestration/tool_router_dispatch.py
# - documentation/product/ewa/EWA-COMPANION-TOOL-ROUTER.md
# ---

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from api.ewa_platform.companion.orchestration import tool_registry as reg
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext, ToolResult
from api.ewa_platform.companion.orchestration.tool_router_dispatch import (
    _user_line_allows_recent_music_theme_hint,
    maybe_dispatch_companion_tool_router,
)
from api.ewa_platform.companion.sidecar import tool_router as tr
from api.ewa_platform.schemas.pydantic.companion_tool_router import (
    CompanionToolRouterResultV1,
)


@pytest.mark.unit
def test_parse_tool_router_payload_music() -> None:
    plan = tr.parse_tool_router_payload(
        {
            "intent": "music_generation",
            "confidence": 0.91,
            "theme": "Empery World",
            "understood_summary_ru": "ещё один трек",
        }
    )
    assert plan is not None
    assert plan.tool == "music_generation"
    assert plan.confidence == pytest.approx(0.91)
    assert plan.theme == "Empery World"


@pytest.mark.unit
def test_parse_tool_router_payload_image_generation() -> None:
    plan = tr.parse_tool_router_payload(
        {
            "intent": "image_generation",
            "confidence": 0.87,
            "prompt": "cinematic sunset over city",
            "aspect_ratio": "16:9",
            "image_tool_mode": "generate",
        }
    )
    assert plan is not None
    assert plan.tool == "image_generation"
    assert plan.prompt == "cinematic sunset over city"
    assert plan.aspect_ratio == "16:9"
    assert plan.image_tool_mode == "generate"


@pytest.mark.unit
def test_parse_tool_router_payload_presentation_generation() -> None:
    plan = tr.parse_tool_router_payload(
        {
            "intent": "presentation_generation",
            "confidence": 0.9,
            "topic": "EWA companion roadmap",
            "title": "Companion Tools",
            "num_slides": 9,
            "presentation_theme": "aurora",
        }
    )
    assert plan is not None
    assert plan.tool == "presentation_generation"
    assert plan.topic == "EWA companion roadmap"
    assert plan.title == "Companion Tools"
    assert plan.num_slides == 9
    assert plan.presentation_theme == "aurora"


@pytest.mark.unit
def test_parse_tool_router_payload_file_open_slots() -> None:
    plan = tr.parse_tool_router_payload(
        {
            "intent": "file_open",
            "confidence": 0.72,
            "file_query": "meeting-notes.md",
            "unified_content_id": "uc-123",
        }
    )
    assert plan is not None
    assert plan.tool == "file_open"
    assert plan.file_query == "meeting-notes.md"
    assert plan.unified_content_id == "uc-123"


@pytest.mark.unit
def test_parse_tool_router_payload_operation_cancel_with_run_id() -> None:
    plan = tr.parse_tool_router_payload(
        {
            "intent": "operation_cancel",
            "confidence": 0.8,
            "run_id": "9f5202fd-644f-4f4d-9398-c6ed8de9f74a",
        }
    )
    assert plan is not None
    assert plan.tool == "operation_cancel"
    assert plan.run_id == "9f5202fd-644f-4f4d-9398-c6ed8de9f74a"


@pytest.mark.unit
def test_router_plan_to_tool_args_costly_tools_omit_bypass() -> None:
    music_args = tr.router_plan_to_tool_args(
        CompanionToolRouterResultV1(tool="music_generation", confidence=0.9, theme="X")
    )
    assert music_args["_tool_router_bypass_line_match"] is False
    assert music_args["theme"] == "X"

    image_args = tr.router_plan_to_tool_args(
        CompanionToolRouterResultV1(tool="image_generation", confidence=0.9, prompt="city")
    )
    assert image_args["_tool_router_bypass_line_match"] is False

    presentation_args = tr.router_plan_to_tool_args(
        CompanionToolRouterResultV1(tool="presentation_generation", confidence=0.9, topic="Q2")
    )
    assert presentation_args["_tool_router_bypass_line_match"] is False


@pytest.mark.unit
def test_router_plan_to_tool_args_low_risk_keeps_bypass() -> None:
    args = tr.router_plan_to_tool_args(CompanionToolRouterResultV1(tool="operations_status", confidence=0.9))
    assert args["_tool_router_bypass_line_match"] is True


@pytest.mark.unit
def test_router_plan_to_tool_args_image_and_presentation_slots() -> None:
    plan = CompanionToolRouterResultV1(
        tool="image_generation",
        confidence=0.93,
        prompt="retro anime city",
        aspect_ratio="9:16",
        image_tool_mode="edit",
        source_unified_content_id="uc-src-1",
        topic="Quarterly review",
        title="Q2 deck",
        num_slides=11,
        presentation_theme="minimal",
        default_slide_layout="title-content",
    )
    args = tr.router_plan_to_tool_args(plan)
    assert args["_tool_router_bypass_line_match"] is False
    assert args["prompt"] == "retro anime city"
    assert args["aspect_ratio"] == "9:16"
    assert args["image_tool_mode"] == "edit"
    assert args["source_unified_content_id"] == "uc-src-1"
    assert args["topic"] == "Quarterly review"
    assert args["title"] == "Q2 deck"
    assert args["num_slides"] == 11
    assert args["presentation_theme"] == "minimal"
    assert args["default_slide_layout"] == "title-content"


@pytest.mark.unit
def test_parse_tool_router_payload_plan_v1() -> None:
    plan = tr.parse_tool_router_payload(
        {
            "intent": "plan_v1",
            "confidence": 0.88,
            "understood_summary_ru": "план на две недели",
        }
    )
    assert plan is not None
    assert plan.tool == "plan_v1"
    assert plan.confidence == pytest.approx(0.88)


@pytest.mark.unit
def test_parse_tool_router_payload_check_task_status_slots() -> None:
    plan = tr.parse_tool_router_payload(
        {
            "intent": "check_task_status",
            "confidence": 0.79,
            "run_id": "9f5202fd-644f-4f4d-9398-c6ed8de9f74a",
            "task_id": "9f5202fd-644f-4f4d-9398-c6ed8de9f74a",
        }
    )
    assert plan is not None
    assert plan.tool == "check_task_status"
    assert plan.run_id == "9f5202fd-644f-4f4d-9398-c6ed8de9f74a"
    assert plan.task_id == "9f5202fd-644f-4f4d-9398-c6ed8de9f74a"


@pytest.mark.unit
def test_router_plan_to_tool_args_check_task_status_includes_task_id() -> None:
    plan = CompanionToolRouterResultV1(
        tool="check_task_status",
        confidence=0.9,
        run_id="run-a",
        task_id="task-b",
    )
    args = tr.router_plan_to_tool_args(plan)
    assert args["run_id"] == "run-a"
    assert args["task_id"] == "task-b"


@pytest.mark.unit
@pytest.mark.parametrize(
    ("mode", "tool", "allowed"),
    [
        ("shadow", "music_generation", False),
        ("partial", "music_generation", True),
        ("partial", "image_generation", False),
        ("partial", "file_create", False),
        ("partial", "plan_v1", False),
        ("full", "file_create", True),
        ("full", "operations_status", True),
        ("full", "operation_cancel", True),
        ("full", "file_open", True),
        ("full", "catalog_discuss", True),
        ("full", "music_xl_base_interactive", True),
        ("full", "image_generation", True),
        ("full", "presentation_generation", True),
        ("full", "plan_v1", True),
        ("full", "calendar_v1", True),
        ("full", "plan_task_complete_v1", True),
        ("full", "check_task_status", True),
        ("full", "file_rewrite", True),
        ("full", "chat_only", False),
    ],
)
def test_router_tool_allowed_in_mode(mode: str, tool: str, allowed: bool, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_MODE", mode)
    assert tr.router_tool_allowed_in_current_mode(tool) is allowed  # type: ignore[arg-type]


@pytest.mark.unit
def test_music_generation_router_bypass_enqueues(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_MUSIC_ENABLED", "1")

    enqueued: list[str] = []

    def fake_enqueue(**kwargs: Any) -> str:
        enqueued.append(str(kwargs.get("run_id")))
        return "celery-id-router"

    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run",
        fake_enqueue,
    )
    mock_run_create = AsyncMock(return_value={"id": "run-router", "status": "running", "execution_mode": "async"})
    mock_step_create = AsyncMock(return_value={"id": "step-router"})
    monkeypatch.setattr(reg.companion_pg, "companion_task_run_create", mock_run_create)
    monkeypatch.setattr(reg.companion_pg, "companion_task_step_create", mock_step_create)

    ctx = ToolContext(
        principal_id="p1",
        user_line="Davay ehe odny Empery World",
        content_catalog_user_id="u1",
        oauth2_sub_for_content_alternate=None,
        main_pool=None,
        companion_pool=MagicMock(),
        shell_norm={},
        bearer_token="tok",
        auth_user=MagicMock(),
    )
    out = asyncio.run(
        reg.dispatch_tool_by_name(
            "music_generation",
            {
                "user_line": ctx.user_line,
                "theme": "Empery World",
                "_tool_router_bypass_line_match": True,
            },
            ctx,
        )
    )
    assert out is not None
    assert out["status"] == "accepted"
    assert enqueued == ["run-router"]


@pytest.mark.unit
def test_recent_music_theme_hint_only_for_continuation_lines() -> None:
    assert _user_line_allows_recent_music_theme_hint("давай ещё одну") is True
    assert _user_line_allows_recent_music_theme_hint("повтори генерацию") is True
    assert _user_line_allows_recent_music_theme_hint("Да готов. Ставь техническое задание и мы сделаем") is False
    assert _user_line_allows_recent_music_theme_hint("сгенерируй песню про лето") is False


@pytest.mark.unit
def test_false_music_route_tz_line_does_not_enqueue(monkeypatch: pytest.MonkeyPatch) -> None:
    """Incident lock: router music plan + TZ line must not bypass handler line gate."""

    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_MUSIC_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_MODE", "full")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_URL", "http://router.test")

    enqueued: list[str] = []

    def fake_enqueue(**kwargs: Any) -> str:
        enqueued.append(str(kwargs.get("run_id")))
        return "celery-id-false-music"

    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run",
        fake_enqueue,
    )
    monkeypatch.setattr(
        reg.companion_pg,
        "companion_task_run_create",
        AsyncMock(return_value={"id": "run-false", "status": "running", "execution_mode": "async"}),
    )
    monkeypatch.setattr(
        reg.companion_pg,
        "companion_task_step_create",
        AsyncMock(return_value={"id": "step-false"}),
    )

    incident_line = "Да готов. Ставь техническое задание и мы сделаем"
    plan = CompanionToolRouterResultV1(
        tool="music_generation",
        confidence=0.95,
        theme="техническое задание",
    )
    router_mock = AsyncMock(return_value=plan)

    async def run_branch(
        tool: str, args: dict[str, Any], tool_ctx: ToolContext, **kwargs: Any
    ) -> ToolResult | None:
        assert args.get("_tool_router_bypass_line_match") is False
        return await reg.dispatch_tool_by_name(tool, args, tool_ctx)

    with (
        patch(
            "api.ewa_platform.companion.orchestration.tool_router_dispatch.run_companion_tool_router",
            new=router_mock,
        ),
        patch(
            "api.ewa_platform.companion.orchestration.tool_router_dispatch._recent_music_theme_hint",
            new=AsyncMock(return_value="sticky romantic theme"),
        ) as theme_hint,
    ):
        ctx = ToolContext(
            principal_id="p1",
            user_line=incident_line,
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
            main_pool=None,
            companion_pool=MagicMock(),
            shell_norm={},
            bearer_token="tok",
            auth_user=MagicMock(),
        )
        out = asyncio.run(
            maybe_dispatch_companion_tool_router(
                ctx.companion_pool,
                tool_ctx=ctx,
                user_line=incident_line,
                shell_norm={},
                russian_user=True,
                run_tool_branch=run_branch,
            )
        )

    assert out is None
    assert enqueued == []
    theme_hint.assert_not_called()
    assert router_mock.await_args is not None
    assert router_mock.await_args.kwargs.get("recent_music_theme") is None


@pytest.mark.unit
def test_music_line_router_dispatch_without_bypass_still_enqueues(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_JOBS_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ASYNC_MUSIC_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_MODE", "full")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_URL", "http://router.test")

    enqueued: list[str] = []

    def fake_enqueue(**kwargs: Any) -> str:
        enqueued.append(str(kwargs.get("run_id")))
        return "celery-id-ok-music"

    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.enqueue.enqueue_companion_run",
        fake_enqueue,
    )
    monkeypatch.setattr(
        reg.companion_pg,
        "companion_task_run_create",
        AsyncMock(return_value={"id": "run-ok", "status": "running", "execution_mode": "async"}),
    )
    monkeypatch.setattr(
        reg.companion_pg,
        "companion_task_step_create",
        AsyncMock(return_value={"id": "step-ok"}),
    )

    user_line = "сгенерируй песню про лето"
    plan = CompanionToolRouterResultV1(tool="music_generation", confidence=0.95, theme="лето")

    async def run_branch(
        tool: str, args: dict[str, Any], tool_ctx: ToolContext, **kwargs: Any
    ) -> ToolResult | None:
        assert args.get("_tool_router_bypass_line_match") is False
        return await reg.dispatch_tool_by_name(tool, args, tool_ctx)

    with patch(
        "api.ewa_platform.companion.orchestration.tool_router_dispatch.run_companion_tool_router",
        new=AsyncMock(return_value=plan),
    ):
        ctx = ToolContext(
            principal_id="p1",
            user_line=user_line,
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
            main_pool=None,
            companion_pool=MagicMock(),
            shell_norm={},
            bearer_token="tok",
            auth_user=MagicMock(),
        )
        out = asyncio.run(
            maybe_dispatch_companion_tool_router(
                ctx.companion_pool,
                tool_ctx=ctx,
                user_line=user_line,
                shell_norm={},
                russian_user=True,
                run_tool_branch=run_branch,
            )
        )

    assert out is not None
    assert out["status"] == "accepted"
    assert enqueued == ["run-ok"]


@pytest.mark.unit
def test_tool_router_skips_music_dispatch_for_track_praise(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_MODE", "partial")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_URL", "http://router.test")

    plan = CompanionToolRouterResultV1(tool="music_generation", confidence=0.95, theme="ахуенный")

    with patch(
        "api.ewa_platform.companion.orchestration.tool_router_dispatch.run_companion_tool_router",
        new=AsyncMock(return_value=plan),
    ):
        ctx = ToolContext(
            principal_id="p1",
            user_line="АХУЕННЫЙ ТРЕК ТЫ СДЕЛАЛА",
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
            main_pool=None,
            companion_pool=MagicMock(),
            shell_norm={},
            bearer_token="tok",
            auth_user=MagicMock(),
        )
        run_branch = AsyncMock(return_value={"reply": "ok", "orchestration_branch": "music_generation"})
        out = asyncio.run(
            maybe_dispatch_companion_tool_router(
                ctx.companion_pool,
                tool_ctx=ctx,
                user_line=ctx.user_line,
                shell_norm={},
                russian_user=True,
                run_tool_branch=run_branch,
            )
        )
    assert out is None
    run_branch.assert_not_called()


@pytest.mark.unit
def test_shadow_mode_does_not_dispatch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_MODE", "shadow")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_URL", "http://router.test")

    plan = CompanionToolRouterResultV1(tool="music_generation", confidence=0.95, theme="X")

    with patch(
        "api.ewa_platform.companion.orchestration.tool_router_dispatch.run_companion_tool_router",
        new=AsyncMock(return_value=plan),
    ):
        ctx = ToolContext(
            principal_id="p1",
            user_line="Davay ehe odny X",
            content_catalog_user_id="u1",
            oauth2_sub_for_content_alternate=None,
            main_pool=None,
            companion_pool=MagicMock(),
            shell_norm={},
            bearer_token="tok",
            auth_user=MagicMock(),
        )
        run_branch = AsyncMock(return_value={"reply": "ok", "orchestration_branch": "music_generation"})
        out = asyncio.run(
            maybe_dispatch_companion_tool_router(
                ctx.companion_pool,
                tool_ctx=ctx,
                user_line=ctx.user_line,
                shell_norm={},
                russian_user=False,
                run_tool_branch=run_branch,
            )
        )
    assert out is None
    run_branch.assert_not_called()


@pytest.mark.unit
def test_tool_router_timeout_opens_temporary_cooldown(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_MODE", "partial")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_URL", "http://router.test")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_FAILURE_COOLDOWN_SEC", "60")
    monkeypatch.setattr(tr, "_tool_router_disabled_until_monotonic", 0.0)

    failing_call = AsyncMock(side_effect=httpx.ReadTimeout("router slow"))
    monkeypatch.setattr(tr, "httpx_compat_chat_completion_json", failing_call)

    out = asyncio.run(
        tr.run_companion_tool_router(
            MagicMock(),
            user_line="сгенерируй песню",
            shell_norm={},
            russian_user=True,
        )
    )

    assert out is None
    assert tr._tool_router_disabled_until_monotonic > 0.0

    skipped_call = AsyncMock(return_value={})
    monkeypatch.setattr(tr, "httpx_compat_chat_completion_json", skipped_call)
    out = asyncio.run(
        tr.run_companion_tool_router(
            MagicMock(),
            user_line="сгенерируй песню",
            shell_norm={},
            russian_user=True,
        )
    )

    assert out is None
    skipped_call.assert_not_called()


@pytest.mark.unit
def test_golden_fixture_schema() -> None:
    path = Path(__file__).parent / "fixtures" / "companion_tool_router_golden.jsonl"
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(rows) >= 120
    for row in rows:
        assert "id" in row and "user_line" in row and "expect_tool" in row


@pytest.mark.unit
def test_companion_tool_router_base_url_not_main_chat(monkeypatch: pytest.MonkeyPatch) -> None:
    for env_name in (
        "EWA_COMPANION_TOOL_ROUTER_URL",
        "DESKTOP_AI_CHAT_TOOL_ROUTER_URL",
        "LLAMA_TOOL_ROUTER_URL",
        "HOST_IP",
        "LLAMA_TOOL_ROUTER_HOST_PORT",
        "LLAMA_REMOTE_HOST",
    ):
        monkeypatch.delenv(env_name, raising=False)
    assert tr.companion_tool_router_base_url() == "http://stack2-llama-tool-router:8080"


@pytest.mark.unit
def test_intent_planner_http_runtime_uses_tool_router_sidecar(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.sidecar.intent_planner import companion_intent_planner_http_runtime

    monkeypatch.delenv("EWA_COMPANION_INTENT_PLANNER_URL", raising=False)
    monkeypatch.delenv("EWA_COMPANION_INTENT_MODEL", raising=False)
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_URL", "http://192.168.1.141:8083")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_MODEL", "Qwen3-test.gguf")
    base, model = companion_intent_planner_http_runtime()
    assert base == "http://192.168.1.141:8083"
    assert model == "Qwen3-test.gguf"


@pytest.mark.unit
def test_intent_planner_skipped_when_router_partial(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion.sidecar.intent_planner import companion_intent_planner_enabled

    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_TOOL_ROUTER_MODE", "partial")
    monkeypatch.setenv("EWA_COMPANION_INTENT_PLANNER", "1")
    assert companion_intent_planner_enabled() is False
