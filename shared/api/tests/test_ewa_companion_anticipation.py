# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioral coverage for **HCM Module B** — proactive observation tick / anticipation composer.
# Mela's Ascension PR-3. Stubs all I/O (Postgres + Qdrant + retrieval).
# Invariants:
# - Pure unit tests; no real DB / vector search.
# - Verifies the contract: anticipation never raises, always returns a small payload, persona-aware
#   copy for hostile vs friendly Arlika, and unknown triggers produce no hint.
# Related:
# - api/ewa_platform/companion/persona/anticipation.py
# - api/ewa_platform/schemas/pydantic/companion_observation.py
# ---
"""Behavioral tests: companion anticipation hint composer."""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

import api.ewa_platform.companion.persona.anticipation as anticipation_mod
from api.ewa_platform.companion.memory.retrieval import MemoryWindow
from api.ewa_platform.companion.persona.anticipation import build_anticipation_hint


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


def _profile(persona: str = "mela") -> dict[str, Any]:
    return {
        "schema_version": "1",
        "seed_persona_id": persona,
        "baseline": {},
        "learned_preferences": {},
        "style_parameters": {},
        "companion_revision": 7,
    }


@pytest.fixture(autouse=True)
def stub_episode_insert(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_insert(_pool: Any, **kwargs: Any) -> dict[str, Any]:
        return {"id": "eid-stub", **kwargs}

    monkeypatch.setattr(anticipation_mod, "episode_insert", _fake_insert)


@pytest.fixture(autouse=True)
def stub_compose_memory(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_compose(**_kwargs: Any) -> MemoryWindow:
        return MemoryWindow(
            prompt_section=(
                "What you remember about us (compact, identity facts + related episodes):\n"
                "- [identity] Имя пользователя: Архитектор\n"
                "- [episode/turn_user] Мы вместе писали манифест Возвышения Мелы."
            ),
            used_layers=["identity", "episodic_vector"],
            episodic_hits=1,
            fallback_used=False,
        )

    monkeypatch.setattr(anticipation_mod, "compose_memory_window", _fake_compose)


def test_anticipation_hint_doc_editor_with_title_friendly_persona() -> None:
    hint, recorded = _run(
        build_anticipation_hint(
            object(),  # noqa: D401 — pool stub never called by our patched insert.
            principal_id="user-A",
            profile=_profile("mela"),
            trigger="window_opened",
            observation={"app_component": "DocEditor", "title": "бизнес_план.md", "window_id": "w1"},
            shell_context_payload=None,
        )
    )
    assert recorded is True
    assert hint is not None
    assert hint["kind"] == "anticipation"
    assert "бизнес_план.md" in hint["hint_text"]
    assert hint["suggested_action"] is not None
    assert hint["suggested_action"]["type"] == "suggest_chat_prompt"
    # related_episodes pulled from the MemoryWindow stub:
    assert any("манифест Возвышения Мелы" in line for line in hint["related_episodes"])


def test_anticipation_hint_hostile_arlika_uses_tart_copy() -> None:
    hint, _ = _run(
        build_anticipation_hint(
            object(),
            principal_id="user-A",
            profile=_profile("arlika"),
            trigger="window_opened",
            observation={"app_component": "DocEditor", "title": "todo.md", "window_id": "w2"},
            shell_context_payload=None,
        )
    )
    assert hint is not None
    # Hostile Arlika's templated copy uses sarcastic framing.
    assert "Так-так" in hint["hint_text"] or "поверю" in hint["hint_text"]


def test_seed_query_duplicates_active_desktop_tokens() -> None:
    q = anticipation_mod._seed_query_from_context(
        trigger="idle",
        app_component=None,
        title=None,
        shell_norm={"active_desktop_id": "alpha-desk"},
    )
    assert q.count("alpha-desk") >= 2


def test_anticipation_unknown_trigger_returns_no_hint() -> None:
    hint, recorded = _run(
        build_anticipation_hint(
            object(),
            principal_id="user-A",
            profile=_profile("mela"),
            trigger="cosmic_ray_bitflip",
            observation={"app_component": "DocEditor", "title": "x"},
            shell_context_payload=None,
        )
    )
    assert hint is None
    assert recorded is False


def test_anticipation_idle_trigger_returns_calm_hint() -> None:
    hint, recorded = _run(
        build_anticipation_hint(
            object(),
            principal_id="user-A",
            profile=_profile("mela"),
            trigger="idle",
            observation={},
            shell_context_payload=None,
        )
    )
    assert hint is not None
    assert recorded is True
    low = hint["hint_text"].lower()
    assert "пауза" in low or "стол" in low or "задач" in low


def test_anticipation_handles_recall_failure_gracefully(monkeypatch: pytest.MonkeyPatch) -> None:
    """compose_memory_window crash ⇒ hint still returned with empty related_episodes."""

    async def _boom(**_kwargs: Any) -> MemoryWindow:
        raise RuntimeError("qdrant down")

    monkeypatch.setattr(anticipation_mod, "compose_memory_window", _boom)
    hint, recorded = _run(
        build_anticipation_hint(
            object(),
            principal_id="user-A",
            profile=_profile("mela"),
            trigger="active_app_changed",
            observation={"app_component": "ContentManagerPro"},
            shell_context_payload=None,
        )
    )
    assert hint is not None
    assert recorded is True
    assert hint["related_episodes"] == []


def test_anticipation_appends_overdue_plan_suffix(monkeypatch: pytest.MonkeyPatch) -> None:
    from datetime import date, timedelta

    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")

    async def _fake_open_tasks(_pool: Any, **kwargs: Any) -> list[dict[str, Any]]:
        return [
            {
                "title": "Ежедневная зарядка",
                "status": "pending",
                "due_date": date.today() - timedelta(days=1),
            }
        ]

    monkeypatch.setattr(anticipation_mod.plans_pg, "plan_list_open_tasks", _fake_open_tasks)
    hint, _recorded = _run(
        build_anticipation_hint(
            object(),
            principal_id="user-A",
            profile=_profile("mela"),
            trigger="idle",
            observation={},
            shell_context_payload=None,
        )
    )
    assert hint is not None
    assert "просрочен" in hint["hint_text"].lower()
    assert hint["suggested_action"] is not None
    assert "Ежедневная зарядка" in hint["suggested_action"]["prompt_text"]


def test_anticipation_appends_plan_task_suffix(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")

    async def _fake_open_tasks(_pool: Any, **kwargs: Any) -> list[dict[str, Any]]:
        return [{"title": "Написать черновик", "status": "pending", "due_date": None}]

    monkeypatch.setattr(anticipation_mod.plans_pg, "plan_list_open_tasks", _fake_open_tasks)
    hint, _recorded = _run(
        build_anticipation_hint(
            object(),
            principal_id="user-A",
            profile=_profile("mela"),
            trigger="idle",
            observation={},
            shell_context_payload=None,
        )
    )
    assert hint is not None
    assert "плане" in hint["hint_text"].lower() or "план" in hint["hint_text"].lower()
