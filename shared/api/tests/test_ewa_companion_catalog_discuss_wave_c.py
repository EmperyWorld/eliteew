# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave C contract tests: unified ``catalog_discuss`` registry path and ``chat_turn`` prefetch skip gate.
# Invariants:
# - Pure unit tests — no DB or HTTP.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/storage/catalog_file_discuss.py
# ---

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import MagicMock

import pytest

from api.ewa_platform.companion.orchestration import tool_registry as reg
from api.ewa_platform.companion.storage.catalog_file_discuss import (
    should_skip_catalog_find_prefetch_for_turn,
)


def _make_ctx(**overrides: Any) -> reg.ToolContext:
    defaults: dict[str, Any] = {
        "principal_id": "tester",
        "user_line": "обсуди файл notes.md",
        "content_catalog_user_id": "uc-1",
        "oauth2_sub_for_content_alternate": None,
        "main_pool": MagicMock(name="main_pool"),
        "companion_pool": MagicMock(name="companion_pool"),
        "shell_norm": None,
        "intent_plan": None,
    }
    defaults.update(overrides)
    return reg.ToolContext(**defaults)


@pytest.mark.unit
def test_catalog_discuss_tool_result_includes_uc_and_label(monkeypatch: pytest.MonkeyPatch) -> None:
    uc = "aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    async def fake_augment(*_a: Any, **_k: Any) -> tuple[str, str, str]:
        return ("## CRITICAL\n\nFile body here.", uc, "notes.md")

    monkeypatch.setattr(
        "api.ewa_platform.companion.storage.catalog_file_discuss.augment_memory_section_with_catalog_file_discuss",
        fake_augment,
    )
    ctx = _make_ctx()
    out = asyncio.run(reg.dispatch_tool_by_name("catalog_discuss", {"user_line": ctx.user_line}, ctx))
    assert out is not None
    data = out.get("data")
    assert isinstance(data, dict)
    assert data["unified_content_id"] == uc
    assert data["file_label"] == "notes.md"


@pytest.mark.unit
def test_catalog_discuss_memory_tuple_from_result() -> None:
    result: reg.ToolResult = {
        "tool": "catalog_discuss",
        "status": "memory_append",
        "reply": "",
        "actions": [],
        "data": {
            "memory_section_append": "body",
            "unified_content_id": "uc-1",
            "file_label": "a.md",
        },
        "task_run": None,
    }
    tup = reg.catalog_discuss_memory_tuple_from_result(result)
    assert tup == ("body", "uc-1", "a.md")
    assert reg.catalog_discuss_memory_tuple_from_result(None) is None
    assert reg.catalog_discuss_memory_tuple_from_result({"tool": "x", "status": "ok"}) is None


@pytest.mark.unit
def test_resolve_catalog_discuss_memory_inject_delegates(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_dispatch(_name: str, _args: Any, _ctx: reg.ToolContext) -> reg.ToolResult:
        return {
            "tool": "catalog_discuss",
            "status": "memory_append",
            "reply": "",
            "actions": [],
            "data": {
                "memory_section_append": "block",
                "unified_content_id": "id-1",
                "file_label": "f.md",
            },
            "task_run": None,
        }

    monkeypatch.setattr(reg, "dispatch_tool_by_name", fake_dispatch)
    ctx = _make_ctx(user_line="прочитай f.md")
    tup = asyncio.run(reg.resolve_catalog_discuss_memory_inject(ctx, user_line="прочитай f.md"))
    assert tup == ("block", "id-1", "f.md")


@pytest.mark.unit
def test_catalog_discuss_resolve_failure_emits_degrade_debug(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, str]] = []

    def _capture(_logger: object, context: str, detail: str, **_kw: object) -> None:
        calls.append((context, detail))

    async def fake_resolve(*_a: object, **_k: object) -> None:
        return None

    monkeypatch.setattr(
        "api.ewa_platform.companion.storage.catalog_file_discuss.companion_degrade_debug",
        _capture,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.storage.catalog_file_discuss._resolve_uc_and_label",
        fake_resolve,
    )

    import asyncio

    from api.ewa_platform.companion.storage.catalog_file_discuss import (
        augment_memory_section_with_catalog_file_discuss,
    )

    pool = object()
    out = asyncio.run(
        augment_memory_section_with_catalog_file_discuss(
            pool,  # type: ignore[arg-type]
            principal_id="p1",
            user_line="прочитай notes.md",
            content_catalog_user_id="uid-1",
            oauth2_sub_for_content_alternate=None,
        ),
    )
    assert out is None
    assert ("catalog_discuss_augment", "resolve_failed") in calls


@pytest.mark.parametrize(
    ("memory", "branch", "line", "expect_skip"),
    [
        ("already injected", None, "hello", True),
        (None, "catalog_discuss", "hello", True),
        (None, "compound_file_chain", "hello", True),
        (None, "file_study_compose", "hello", True),
        (None, None, "обсуди файл notes.md", True),
        (None, None, "show me all files", False),
    ],
)
@pytest.mark.unit
def test_should_skip_catalog_find_prefetch_for_turn(
    memory: str | None,
    branch: str | None,
    line: str,
    expect_skip: bool,
) -> None:
    assert (
        should_skip_catalog_find_prefetch_for_turn(
            line,
            orchestrated_memory_append=memory,
            orchestration_branch=branch,
            profile=None,
        )
        is expect_skip
    )
