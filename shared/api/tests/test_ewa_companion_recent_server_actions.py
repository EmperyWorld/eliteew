# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for Phase D.2 of the server-only migration: the **recent server actions** ring buffer that
# lets the chat LLM speak truthfully about what the orchestrator did on previous turns. Covers
# ``api.ewa_platform.companion.sidecar.recent_server_actions.recent_server_actions_prompt_section`` (rendering) and
# the orchestrator-side recording call (``_record_recent_server_action``) — no Postgres / LLM I/O; storage is
# monkeypatched at the module boundary.
# Invariants:
# - Empty / absent / malformed rings render an empty string (so callers can use ``if section:`` cheaply).
# - Ring entries are passed through verbatim (tool / status / summary) — no rewording in the section helper.
# - Recording only fires for terminal statuses ``ok`` / ``needs_confirm``; non-state-changing outcomes
#   (``error`` / ``unavailable`` / ``needs_open_editor``) are NOT persisted.
# - Recording is best-effort: storage exceptions never propagate to the orchestrator.
# Related:
# - api/ewa_platform/companion/sidecar/recent_server_actions.py
# - api/ewa_platform/companion/orchestration/task_orchestrator.py (``_record_recent_server_action``)
# - api/ewa_platform/persistence_pg/companion_asyncpg.py (``companion_record_recent_server_action``)
# ---
"""Phase D.2 tests: recent server actions ring + chat-LLM prompt memo."""

from __future__ import annotations

import asyncio
from typing import Any, Literal
from unittest.mock import MagicMock

import pytest

from api.ewa_platform.companion.orchestration import task_orchestrator
from api.ewa_platform.companion.orchestration.tool_registry import ToolContext, ToolResult
from api.ewa_platform.companion.sidecar.recent_server_actions import recent_server_actions_prompt_section

# -- Rendering helpers --------------------------------------------------------


def test_section_empty_when_profile_missing() -> None:
    """A ``None`` profile must produce an empty section (caller decides whether to inject)."""

    assert recent_server_actions_prompt_section(None) == ""


def test_section_empty_when_learned_preferences_missing() -> None:
    """A profile without ``learned_preferences`` must produce an empty section."""

    assert recent_server_actions_prompt_section({}) == ""
    assert recent_server_actions_prompt_section({"learned_preferences": None}) == ""
    assert recent_server_actions_prompt_section({"learned_preferences": {}}) == ""


def test_section_empty_when_ring_absent_or_empty() -> None:
    """A profile with an absent / empty ring must produce an empty section."""

    assert recent_server_actions_prompt_section({"learned_preferences": {"other": [1, 2, 3]}}) == ""
    assert recent_server_actions_prompt_section({"learned_preferences": {"companion_recent_server_actions": []}}) == ""


def test_section_renders_entries_in_canonical_format() -> None:
    """Each entry must appear as ``- <tool> · <status> · <summary>``; section header must reference ground truth."""

    profile: dict[str, Any] = {
        "learned_preferences": {
            "companion_recent_server_actions": [
                {
                    "ts": "2026-05-13T00:01:00+00:00",
                    "branch": "theme_set",
                    "tool": "theme_set",
                    "status": "ok",
                    "summary": "Поставила тёмную тему рабочего стола.",
                },
                {
                    "ts": "2026-05-13T00:02:00+00:00",
                    "branch": "music_studio_open",
                    "tool": "music_studio_open",
                    "status": "ok",
                    "summary": "Открываю Студию записи — оформим там идею песни.",
                },
            ],
        },
    }
    section = recent_server_actions_prompt_section(profile)
    assert section, "must render non-empty section"
    assert "Recent_server_actions" in section
    assert "ground truth" in section
    assert "- theme_set · ok · Поставила тёмную тему рабочего стола." in section
    assert "- music_studio_open · ok · Открываю Студию записи" in section


def test_section_drops_malformed_entries() -> None:
    """Entries without a valid tool / branch must be skipped silently (never crash the prompt)."""

    profile: dict[str, Any] = {
        "learned_preferences": {
            "companion_recent_server_actions": [
                {},
                {"tool": "", "status": "ok"},
                {"summary": "no tool"},
                {"tool": "app_open", "status": "ok", "summary": "Open Music Player"},
            ],
        },
    }
    section = recent_server_actions_prompt_section(profile)
    assert section.count("\n- ") == 1, f"only the well-formed entry should render: {section!r}"
    assert "app_open" in section


def test_section_truncates_long_summary() -> None:
    """Summaries beyond the per-line cap must be truncated, not split across lines."""

    long = "x" * 1024
    profile = {
        "learned_preferences": {
            "companion_recent_server_actions": [
                {"tool": "file_rewrite", "status": "ok", "summary": long},
            ],
        },
    }
    section = recent_server_actions_prompt_section(profile)
    line = next((ln for ln in section.splitlines() if ln.startswith("- ")), "")
    assert len(line) <= 220


# -- Orchestrator recording call (``_record_recent_server_action``) ----------


def _ctx_with_pool(pool: Any) -> ToolContext:
    return ToolContext(
        principal_id="tester",
        user_line="поставь тёмную тему",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
        main_pool=None,
        companion_pool=pool,
    )


@pytest.mark.parametrize("status", ["ok", "needs_confirm"])
def test_record_persists_for_state_changing_statuses(
    monkeypatch: pytest.MonkeyPatch,
    status: Literal["ok", "needs_confirm"],
) -> None:
    """Phase D.2: ``ok`` and ``needs_confirm`` (real actions / pending) must be persisted to the ring."""

    captured: dict[str, Any] = {}

    async def fake_record(
        _pool: Any,
        *,
        principal_id: str,
        branch: str,
        tool: str,
        status: str,
        summary: str,
        occurred_at: str,
    ) -> bool:
        captured.update(
            {
                "principal_id": principal_id,
                "branch": branch,
                "tool": tool,
                "status": status,
                "summary": summary,
                "occurred_at": occurred_at,
            },
        )
        return True

    monkeypatch.setattr(
        task_orchestrator.companion_pg,
        "companion_record_recent_server_action",
        fake_record,
    )

    result: ToolResult = {
        "tool": "theme_set",
        "status": status,
        "reply": "Поставила тёмную тему рабочего стола.",
        "actions": [],
        "data": {"theme": "dark", "applied": True},
        "task_run": None,
    }
    asyncio.run(
        task_orchestrator._record_recent_server_action(
            _ctx_with_pool(MagicMock(name="companion_pool")),
            name="theme_set",
            result=result,
            user_line="поставь тёмную тему",
        ),
    )
    assert captured["principal_id"] == "tester"
    assert captured["branch"] == "theme_set"
    assert captured["tool"] == "theme_set"
    assert captured["status"] == status
    assert "Поставила тёмную тему" in captured["summary"]
    assert captured["occurred_at"]  # ISO-format timestamp present


@pytest.mark.parametrize("status", ["error", "unavailable", "needs_open_editor"])
def test_record_skips_non_state_changing_statuses(
    monkeypatch: pytest.MonkeyPatch,
    status: Literal["error", "unavailable", "needs_open_editor"],
) -> None:
    """Phase D.2: errors / unavailable / needs_open_editor must NOT pollute the ring (no state changed)."""

    called = False

    async def fake_record(*_a: Any, **_k: Any) -> bool:
        nonlocal called
        called = True
        return True

    monkeypatch.setattr(
        task_orchestrator.companion_pg,
        "companion_record_recent_server_action",
        fake_record,
    )

    result: ToolResult = {
        "tool": "theme_set",
        "status": status,
        "reply": "blocked",
        "actions": [],
        "data": {},
        "task_run": None,
    }
    asyncio.run(
        task_orchestrator._record_recent_server_action(
            _ctx_with_pool(MagicMock(name="companion_pool")),
            name="theme_set",
            result=result,
            user_line="x",
        ),
    )
    assert called is False, f"status={status!r} must NOT be recorded"


def test_record_does_not_raise_when_storage_fails(monkeypatch, caplog) -> None:
    """Phase D.2: storage exceptions must be caught and logged — never propagate to the orchestrator."""

    async def fake_record(*_a: Any, **_k: Any) -> bool:
        raise RuntimeError("pg gone")

    monkeypatch.setattr(
        task_orchestrator.companion_pg,
        "companion_record_recent_server_action",
        fake_record,
    )

    with caplog.at_level("WARNING", logger=task_orchestrator.logger.name):
        # Must not raise — best-effort observability.
        asyncio.run(
            task_orchestrator._record_recent_server_action(
                _ctx_with_pool(MagicMock(name="companion_pool")),
                name="theme_set",
                result={"tool": "theme_set", "status": "ok", "reply": "x", "actions": [], "task_run": None},
                user_line="x",
            ),
        )
    assert any("companion_record_recent_server_action_failed" in r.message for r in caplog.records), (
        f"failure must be logged; got: {[r.message for r in caplog.records]}"
    )


def test_record_skipped_when_companion_pool_missing(monkeypatch) -> None:
    """Phase D.2: when ``ctx.companion_pool`` is None (rare edge), do not call storage and do not raise."""

    called = False

    async def fake_record(*_a: Any, **_k: Any) -> bool:
        nonlocal called
        called = True
        return True

    monkeypatch.setattr(
        task_orchestrator.companion_pg,
        "companion_record_recent_server_action",
        fake_record,
    )

    asyncio.run(
        task_orchestrator._record_recent_server_action(
            _ctx_with_pool(None),
            name="theme_set",
            result={"tool": "theme_set", "status": "ok", "reply": "x", "actions": [], "task_run": None},
            user_line="x",
        ),
    )
    assert called is False


# -- ``_run_tool_branch`` integration ----------------------------------------


def test_run_tool_branch_records_on_ok(monkeypatch) -> None:
    """End-to-end: when ``_run_tool_branch`` short-circuits with ``ok``, the ring receives one entry."""

    async def fake_dispatch(*_a: Any, **_k: Any) -> ToolResult:
        return {
            "tool": "music_studio_open",
            "status": "ok",
            "reply": "Открываю Студию записи — оформим там идею песни.",
            "actions": [{"type": "open_app", "app_component": "MusicGenerator"}],
            "data": {"app_component": "MusicGenerator"},
            "task_run": None,
        }

    recorded: list[dict[str, Any]] = []

    async def fake_record(
        _pool: Any,
        *,
        principal_id: str,
        branch: str,
        tool: str,
        status: str,
        summary: str,
        occurred_at: str,
    ) -> bool:
        recorded.append({"branch": branch, "tool": tool, "status": status, "summary": summary})
        return True

    monkeypatch.setattr(task_orchestrator, "dispatch_tool_by_name", fake_dispatch)
    monkeypatch.setattr(
        task_orchestrator.companion_pg,
        "companion_record_recent_server_action",
        fake_record,
    )

    out = asyncio.run(
        task_orchestrator._run_tool_branch(
            "music_studio_open",
            {"user_line": "сделай песню про лето"},
            _ctx_with_pool(MagicMock(name="companion_pool")),
            user_line="сделай песню про лето",
        ),
    )
    assert out is not None
    assert recorded == [
        {
            "branch": "music_studio_open",
            "tool": "music_studio_open",
            "status": "ok",
            "summary": "Открываю Студию записи — оформим там идею песни.",
        },
    ]


def test_run_tool_branch_does_not_record_on_error(monkeypatch) -> None:
    """End-to-end: ``status='error'`` short-circuits but must NOT enter the recent-actions ring."""

    async def fake_dispatch(*_a: Any, **_k: Any) -> ToolResult:
        return {
            "tool": "app_open",
            "status": "error",
            "reply": "Не могу открыть приложение — оно не в разрешённом списке.",
            "actions": [],
            "data": {},
            "task_run": None,
        }

    recorded: list[dict[str, Any]] = []

    async def fake_record(*_a: Any, **k: Any) -> bool:
        recorded.append(dict(k))
        return True

    monkeypatch.setattr(task_orchestrator, "dispatch_tool_by_name", fake_dispatch)
    monkeypatch.setattr(
        task_orchestrator.companion_pg,
        "companion_record_recent_server_action",
        fake_record,
    )

    out = asyncio.run(
        task_orchestrator._run_tool_branch(
            "app_open",
            {"user_line": "open SecretApp"},
            _ctx_with_pool(MagicMock(name="companion_pool")),
            user_line="open SecretApp",
        ),
    )
    assert out is not None
    assert recorded == []
