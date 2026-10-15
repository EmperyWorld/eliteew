# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Chaos/regression tests for agentic FSM, concurrency inbox, and bridge mapping.
# Related:
# - api/ewa_platform/agentic/kernel/state_machine.py
# ---

from __future__ import annotations

from typing import Any

import pytest

from api.ewa_platform.agentic import chat_bridge
from api.ewa_platform.agentic.kernel import state_machine as fsm
from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput
from api.ewa_platform.agentic.starter import (
    strip_agentic_prefix,
    user_line_requests_agentic_start,
    user_line_requests_agentic_work_session,
)
from api.ewa_platform.agentic.tools.bridge import map_tool_result_to_act_result


def _kora_dvfu_prompt() -> str:
    return """
Кора, ты нужна мне. Давай сегодня продуктивно поработаем в течение 2 ч.
Результат: 1. Составь документ в папке для внутренней сонастройки "правила работы Коры и Татьяны".
2. Дорожная карта проекта "Платформа EliteEW" без сложных описаний.
Планы на сегодня и в перспективе:
1). Подготовить тезисы презентации про платформу в формате PowerPoint.
2). Изучить Российский рынок ВУЗОВ и программ с АИ-агентами для студентов, преподавателей,
бизнес-компаний, госструктур и корпоративных организаций.
А) Российские ВУЗЫ, особенно направления ДВФУ, цель — найти 2-3 гипотезы разворачивания в контексте
стратегического развития 2025-2030 и "Цифровой кафедры".
Б) Бизнес-сообщество, собственники, малый бизнес и рынок услуг, консалтинга, маркетинга и цифровых
технологий для бизнеса; связи и матрица стейкхолдеров.
С) Пользователи, потребительские предпочтения, рекомендации, негативный контент и протесты против ИИ.
В) Кибербезопасность и киберпреступность — обозначить точки, критерии, правила и ответственность.
Р) Юридические вопросы, авторские права, пользовательские данные.
3) Пошагово расписать новому пользователю алгоритм "Знакомимся".
4) Сделать аудит рынка, конкурентов, ресурсов компании, отзывов клиентов.
5) Согласовать цель, задачи и стратегические амбиции с собственником и командой.
Смотри в папке: "ДВФУ_цифроваястратегия.txt", "Российсие ВУЗЫ_АИ2026.md", "Маркетинговый бриф.md".
Изучи и дай обратную связь, задай вопросы, дай как ты все поняла и тезисный план.
""".strip()


def test_fsm_illegal_transition() -> None:
    assert fsm.resolve_next_status(fsm.STATUS_COMPLETED, "start") is None
    assert fsm.resolve_next_status(fsm.STATUS_EXECUTING, "human_respond") is None


def test_fsm_cancel_from_executing() -> None:
    assert fsm.resolve_next_status(fsm.STATUS_EXECUTING, "cancel") == fsm.STATUS_CANCELLED


def test_fsm_gate_timeout_paths() -> None:
    assert fsm.resolve_next_status(fsm.STATUS_AWAITING_HUMAN, "gate_timeout_pause") == fsm.STATUS_PAUSED
    assert fsm.resolve_next_status(fsm.STATUS_AWAITING_HUMAN, "gate_timeout_abandon") == fsm.STATUS_ABANDONED


def test_agentic_start_prefix_detection() -> None:
    assert user_line_requests_agentic_start("/agent plan my week")
    assert strip_agentic_prefix("/agent plan my week") == "plan my week"
    assert not user_line_requests_agentic_start("hello")


def test_agentic_work_session_detection_for_kora_dvfu_prompt() -> None:
    assert user_line_requests_agentic_work_session(_kora_dvfu_prompt())
    assert not user_line_requests_agentic_work_session("Кора, привет. Как дела?")


@pytest.mark.asyncio
async def test_plain_kora_dvfu_prompt_auto_starts_agentic_session(monkeypatch: pytest.MonkeyPatch) -> None:
    started: list[str] = []

    async def _no_active(_pool: object, *, principal_id: str) -> None:
        assert principal_id == "p-1"
        return None

    async def _start(_pool: object, *, principal_id: str, user_line: str, **_kwargs: Any) -> dict[str, Any]:
        assert principal_id == "p-1"
        assert not user_line_requests_agentic_start(user_line)
        started.append(user_line)
        return {
            "ok": True,
            "reply": "Вижу большую рабочую сессию с несколькими задачами.",
            "task_run": {"id": "run-auto"},
        }

    monkeypatch.setenv("EWA_AGENTIC_SUBSTRATE_ENABLED", "1")
    monkeypatch.setattr(chat_bridge.agentic_pg, "agentic_session_fetch_active_for_principal", _no_active)
    monkeypatch.setattr(chat_bridge, "start_agentic_session", _start)

    out = await chat_bridge.maybe_handle_agentic_companion_turn(
        object(),  # type: ignore[arg-type]
        principal_id="p-1",
        user_line=_kora_dvfu_prompt(),
    )

    assert started
    assert out is not None
    assert out["orchestration_branch"] == "agentic_session"
    assert out["agentic_status"] == "auto_started_work_session"


def test_bridge_maps_tool_error() -> None:
    act = map_tool_result_to_act_result("catalog_list", {"status": "error", "reply": "fail"})
    assert act.status == "error"
    assert act.tool_name == "catalog_list"


def test_bridge_preserves_async_accepted_status() -> None:
    act = map_tool_result_to_act_result(
        "image_generation",
        {"status": "accepted", "reply": "Image job accepted.", "task_run": {"id": "child-run"}},
    )
    assert act.status == "accepted"
    assert act.raw["task_run"]["id"] == "child-run"


def test_think_output_schema_complete() -> None:
    out = AgenticThinkOutput(action="complete", rationale="done")
    assert out.action == "complete"
