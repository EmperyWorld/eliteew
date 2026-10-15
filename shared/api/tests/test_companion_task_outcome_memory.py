# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract locks for HCM episodic ``task_outcome`` body/dedupe helpers,
# compose Recent tasks strip, and ``recall_memory`` task section.
# Related:
# - api/ewa_platform/companion/episodic/task_outcome.py
# - api/ewa_platform/companion/memory/retrieval.py
# - api/ewa_platform/companion/orchestration/tools/handlers_ops.py
# ---

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import MagicMock

import pytest

import api.ewa_platform.companion.memory.retrieval as mem_mod
import api.ewa_platform.companion.orchestration.tools.handlers_ops as handlers_ops
from api.ewa_platform.companion.episodic.task_outcome import (
    TASK_OUTCOME_KIND,
    TASK_OUTCOME_SOURCE_AGENTIC,
    artifacts_from_created_documents,
    build_task_outcome_body,
    goal_from_task_run,
    outcome_from_task_run,
    task_outcome_dedupe_key,
)
from api.ewa_platform.companion.memory import MEMORY_NS
from api.ewa_platform.companion.memory.retrieval import compose_memory_window
from api.ewa_platform.companion.orchestration.tools.registry_types import ToolContext


def test_task_outcome_dedupe_key_stable() -> None:
    assert task_outcome_dedupe_key(source="agentic", run_id="run-1", status="completed") == "agentic:run-1:completed"


def test_build_task_outcome_body_compact() -> None:
    body = build_task_outcome_body(
        goal="Сделай описание EliteEW",
        status="completed",
        outcome="Готова: создала документ Описание.md",
        artifacts=["Описание.md", "Инструкция.md"],
        mode="agentic_session",
    )
    assert "Task (completed):" in body
    assert "Описание.md" in body
    assert "## Фокус" not in body
    assert len(body) <= 2000


def test_goal_and_outcome_from_run_prefer_mission_summary() -> None:
    run = {
        "user_message": "длинная цель пользователя",
        "plan_payload": {
            "kind": "agentic_session_v1",
            "mission_answer_summary": "Главный ответ миссии",
            "created_documents": [{"name": "doc.md"}],
        },
        "result_payload": {},
    }
    assert goal_from_task_run(run) == "длинная цель пользователя"
    assert outcome_from_task_run(run) == "Главный ответ миссии"
    assert artifacts_from_created_documents(run["plan_payload"]["created_documents"]) == ["doc.md"]


def test_outcome_skips_research_plan_scaffold_heading() -> None:
    run = {
        "user_message": "goal",
        "plan_payload": {"mission_answer_summary": "## Фокус"},
        "result_payload": {"primary_result": "Нормальный итог"},
    }
    # ## Фокус skipped; falls through to result primary_result
    assert outcome_from_task_run(run) == "Нормальный итог"


def test_goal_skips_scaffold_heading_when_no_user_message() -> None:
    run = {
        "user_message": "",
        "plan_payload": {"goal_text": "## Фокус", "plan_summary": "Реальная цель"},
        "result_payload": {},
    }
    assert goal_from_task_run(run) == "Реальная цель"


def test_task_outcome_kind_constant() -> None:
    assert TASK_OUTCOME_KIND == "task_outcome"
    assert TASK_OUTCOME_SOURCE_AGENTIC == "agentic"


def test_record_task_outcome_from_run_skips_non_terminal() -> None:
    from api.ewa_platform.companion.episodic.task_outcome_bridge import record_task_outcome_from_run

    out = _run(
        record_task_outcome_from_run(
            MagicMock(),
            run={"id": "r1", "principal_id": "p1", "status": "running", "user_message": "x"},
        )
    )
    assert out is None


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def force_hcm_retrieval(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_HCM_RETRIEVAL_ENABLED", "1")


def test_compose_window_includes_recent_tasks_strip(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _no_embed(_text: str) -> tuple[list[float], int | None]:
        return [], None

    async def _fake_recent(
        _pool: Any, *, principal_id: str, limit: int = 20, kinds: list[str] | None = None
    ) -> list[dict[str, Any]]:
        assert principal_id == "user-task"
        assert kinds == [TASK_OUTCOME_KIND]
        return [
            {
                "id": "ep-1",
                "body": "Task (completed): Сделай описание EliteEW\nOutcome: Готово",
                "kind": TASK_OUTCOME_KIND,
            }
        ]

    monkeypatch.setattr(mem_mod, "_embed_query", _no_embed)
    monkeypatch.setattr(mem_mod, "episodes_recent_for_principal", _fake_recent)

    profile = {
        "schema_version": "1",
        "seed_persona_id": "mela",
        "baseline": {},
        "learned_preferences": {MEMORY_NS: []},
        "style_parameters": {},
        "companion_revision": 1,
    }
    window = _run(
        compose_memory_window(
            profile=profile,
            principal_id="user-task",
            current_user_text="",
            persona="mela",
            pool=MagicMock(),
        )
    )
    assert "### Recent tasks / Недавние задачи" in window.prompt_section
    assert "Сделай описание EliteEW" in window.prompt_section
    assert "task_outcome_recent" in window.used_layers


def test_recall_memory_includes_task_section(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_profile(_pool: Any, *, principal_id: str) -> dict[str, Any]:
        return {
            "principal_id": principal_id,
            "learned_preferences": {MEMORY_NS: []},
        }

    async def _fake_recent(
        _pool: Any, *, principal_id: str, limit: int = 20, kinds: list[str] | None = None
    ) -> list[dict[str, Any]]:
        assert kinds == [TASK_OUTCOME_KIND]
        return [
            {
                "body": "Task (completed): lady_boss docs\nArtifacts: Описание.md",
                "kind": TASK_OUTCOME_KIND,
            }
        ]

    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_profile_fetch",
        _fake_profile,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.episodes_asyncpg.episodes_recent_for_principal",
        _fake_recent,
    )

    ctx = ToolContext(
        principal_id="user-task",
        user_line="что мы делали",
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
        companion_pool=MagicMock(),
    )
    result = _run(handlers_ops._handle_recall_memory({"user_line": "что мы делали"}, ctx))
    assert result is not None
    assert result["status"] == "ok"
    assert "Недавние задачи" in (result.get("reply") or "")
    assert "lady_boss docs" in (result.get("reply") or "")
    assert (result.get("data") or {}).get("task_outcome_count") == 1
