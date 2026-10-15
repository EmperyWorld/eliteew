# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for named companion workflows (match + env gate + visible reply hygiene).
# Related:
# - api/ewa_platform/companion/workflows/registry.py
# ---

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.companion.workflows.registry import WorkflowId, match_workflow_id
from api.ewa_platform.companion.workflows.runner import (  # noqa: PLC0415
    extract_final_prose_from_llm_reasoning,
    normalize_reflect_week_memory_section,
    sanitize_workflow_visible_reply,
    try_workflow_orchestration_reply,
)


def test_match_reflect_week_intent() -> None:
    assert match_workflow_id("Подведи итоги недели") == WorkflowId.REFLECT_WEEK


def test_normalize_reflect_week_memory_strips_english_header() -> None:
    raw = (
        "What you remember about us (compact, identity facts + related episodes):\n"
        "- [identity] Имя: Архитектор\n"
        "- — related episodes —\n"
        "- [episode/turn_user] Писали план на две недели."
    )
    out = normalize_reflect_week_memory_section(raw)
    assert "What you remember" not in out
    assert "Имя: Архитектор" in out
    assert "Писали план" in out
    assert "[episode/" not in out


def test_sanitize_workflow_visible_reply_strips_role_labels() -> None:
    raw = (
        "user:eliteew role:companion\nWhat you remember about us:\nНа этой неделе ты продвинул план и закрыл два шага."
    )
    out = sanitize_workflow_visible_reply(raw)
    assert "user:eliteew" not in out.lower()
    assert "role:companion" not in out.lower()
    assert "What you remember" not in out
    assert "продвинул план" in out


def test_sanitize_workflow_visible_reply_strips_channel_markup() -> None:
    raw = "<|channel>thought\n<channel|>Твоя неделя была продуктивной."
    out = sanitize_workflow_visible_reply(raw)
    assert "channel" not in out.lower()
    assert out.startswith("Твоя неделя")


def test_sanitize_workflow_visible_reply_extracts_json_envelope() -> None:
    raw = '{"visible_reply":"Итог: хорошая неделя.","memory":[],"actions":[]}'
    assert sanitize_workflow_visible_reply(raw) == "Итог: хорошая неделя."


def test_extract_final_prose_from_llm_reasoning_numbered_ru_tail() -> None:
    reasoning = (
        "Mela (Warm). User: EliteEW. Role: Companion.\n"
        "* Final Polish (Russian):*\n"
        "Эта неделя была похожа на попытку разжечь огонь под дождём. "
        "На следующую неделю — финальное тестирование companion plans.\n"
        "1. Эта неделя была похожа на попытку разжечь огонь под проливным дождем.\n"
        "2. Ты круто начал путь в Python и физическую форму.\n"
        "3. Ощущение одиночества сейчас сильнее всего тормозит прогресс."
    )
    out = extract_final_prose_from_llm_reasoning(reasoning)
    assert "user:eliteew" not in out.lower()
    assert "Role: Companion" not in out
    assert "Python" in out
    assert "\n\n" in out or "Python" in out


def test_extract_final_prose_from_llm_reasoning_prefers_final_polish_block() -> None:
    reasoning = (
        "Analysis in English only.\n\n"
        "Final Polish (Russian):\n"
        "Неделя выдалась тяжёлой, но ты держишь план. "
        "На следующей — один приоритет: релиз companion plans."
    )
    out = extract_final_prose_from_llm_reasoning(reasoning)
    assert out.startswith("Неделя")
    assert "companion plans" in out


@pytest.mark.unit
def test_workflow_disabled_returns_none(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_WORKFLOW_REFLECT_WEEK_ENABLED", raising=False)
    out = asyncio.run(try_workflow_orchestration_reply("Подведи итоги недели"))
    assert out is None


@pytest.mark.unit
def test_workflow_reflect_week_short_circuit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_WORKFLOW_REFLECT_WEEK_ENABLED", "1")
    memory_mock = AsyncMock(return_value="- Закрыли шаг «черновик»")
    llm_mock = AsyncMock(return_value="Итог недели: хороший прогресс.")
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.chat.runner._build_reflect_week_memory_context",
        memory_mock,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.chat.runner._llm_reflect_week_reply",
        llm_mock,
    )
    out = asyncio.run(
        try_workflow_orchestration_reply(
            "Подведи итоги недели",
            pool=object(),
            principal_id="user-A",
            profile={"seed_persona_id": "mela"},
        )
    )
    assert out is not None
    assert "прогресс" in out["reply"]
    memory_mock.assert_awaited_once()
    llm_mock.assert_awaited_once()
    llm_call = llm_mock.await_args
    assert llm_call is not None
    assert llm_call.kwargs["user_line"] == "Подведи итоги недели"
