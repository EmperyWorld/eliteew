# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Verify semantic ensemble routing and joint/separate delivery decisions.
# Invariants:
# - Document-like short requests route before the generic short-message fallback.
# - Explicit separate discussion and social turns keep conversational delivery.
# Related:
# - api/services/desktop_chat_ensemble/conversational_route.py
# - api/services/desktop_chat_ensemble/archive/legacy_freeform/orchestrator.py
# ---
"""Routing/orchestrator heuristics for ensemble follow-ups and short turns."""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_speech import (
    council_speech_transcript_message,
    format_council_speech_line,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.orchestrator import (
    EnsembleTaskBlock,
    mentioned_hero_for_brief_ping,
    plan_ensemble_speakers,
    user_acknowledges_briefly,
    user_explicitly_requests_separate_delivery,
    user_explicitly_wants_everyone,
    user_group_smalltalk_wants_full_panel,
    user_human_support_request,
    user_panel_smalltalk_question,
    user_prefers_unified_joint_artifact,
    user_project_assessment_question,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.stream_turn import (
    _joint_section_title,
    _turn_text_mode,
)
from api.services.desktop_chat_ensemble.conversational_route import (
    heuristic_ensemble_route_phase,
    user_requests_30_60_90_day_plan,
)


def _msg(role: str, content: str = "", metadata: dict[str, object] | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        role=role,
        content=content,
        message_metadata=metadata or {},
        tool_calls=None,
    )


def test_ack_after_joint_artifact_stays_legacy() -> None:
    phase = heuristic_ensemble_route_phase(
        user_text="ясно...",
        defaults={},
        history=[
            _msg(
                "assistant",
                "совместный план",
                {
                    "desktop_ensemble_joint": True,
                    "desktop_ensemble_contributors": ["likiy_sorrento", "arlyqueen"],
                },
            )
        ],
    )
    assert phase == "legacy"


def test_short_followup_to_joint_artifact_goes_blueprint() -> None:
    phase = heuristic_ensemble_route_phase(
        user_text="добавь бюджет и риски",
        defaults={},
        history=[
            _msg(
                "assistant",
                "совместный план",
                {
                    "desktop_ensemble_joint": True,
                    "desktop_ensemble_blueprint": True,
                    "desktop_ensemble_contributors": ["likiy_sorrento", "arlyqueen"],
                },
            )
        ],
    )
    assert phase == "blueprint"


def test_orchestrator_detects_group_smalltalk() -> None:
    assert user_panel_smalltalk_question("Как ваше настроение?")


def test_orchestrator_detects_human_support_request() -> None:
    assert user_human_support_request("Нужна ваша помощь.")
    assert user_human_support_request("Мне тяжело, не знаю с чего начать")
    assert not user_human_support_request("Нужна помощь с настройкой kubernetes")
    assert not user_human_support_request("Помогите составить технический план по пунктам")


def test_human_support_routes_legacy_even_with_web_search() -> None:
    phase = heuristic_ensemble_route_phase(
        user_text="Нужна ваша помощь.",
        defaults={},
        history=None,
        use_web_search=True,
    )
    assert phase == "legacy"


def test_human_support_turn_mode() -> None:
    assert _turn_text_mode("Нужна ваша помощь.") == "support"


def test_plan_ensemble_speakers_forces_human_support_separate() -> None:
    roster = [
        "teresa_agnesovna",
        "yanus_arnievich",
        "nikolay_fyodorovich",
        "richard_joshuevich",
    ]

    class FakeLlama:
        async def chat(self, *_args: object, **_kwargs: object) -> dict[str, object]:
            raise AssertionError("LLM orchestrator must not run for human-support turns")

    async def _run() -> None:
        plan = await plan_ensemble_speakers(
            FakeLlama(),  # type: ignore[arg-type]
            model="test",
            roster=roster,
            history=[],
            user_excerpt="Нужна ваша помощь.",
            rag_summary={},
            defaults={},
        )
        assert plan.delivery_mode == "separate"
        assert plan.speakers == ["teresa_agnesovna"]
        assert "слуш" in plan.task_blocks[0].objective.casefold()

    asyncio.run(_run())


def test_orchestrator_detects_brief_acknowledgement() -> None:
    assert user_acknowledges_briefly("ясно...")


def test_orchestrator_detects_direct_hero_ping() -> None:
    assert (
        mentioned_hero_for_brief_ping(
            "А че Аким Борисович онемел?",
            ["likiy_sorrento", "arlyqueen", "akimbo"],
        )
        == "akimbo"
    )


def test_orchestrator_detects_project_assessment_question() -> None:
    assert user_project_assessment_question("Оцените проект? Че скажите?")


def test_orchestrator_detects_full_panel_request() -> None:
    assert user_explicitly_wants_everyone("Давайте все вместе, каждый в своей компетенции")


def test_orchestrator_detects_full_panel_greeting() -> None:
    assert user_explicitly_wants_everyone("Всех приветствую ребята")


def test_orchestrator_detects_smalltalk_for_full_panel() -> None:
    assert user_group_smalltalk_wants_full_panel("Всем привет.")
    assert user_group_smalltalk_wants_full_panel("Как ваше настроение?")
    assert user_group_smalltalk_wants_full_panel("Привет как дела")


def test_user_requests_30_60_90_day_plan() -> None:
    assert user_requests_30_60_90_day_plan("Сделайте 30 60 90")
    assert user_requests_30_60_90_day_plan("дайте 30/60/90 на квартал")
    assert not user_requests_30_60_90_day_plan("как дела у тебя")


def test_heuristic_routes_306090_to_blueprint() -> None:
    assert heuristic_ensemble_route_phase(user_text="Сделайте 30 60 90", defaults={}, history=None) == "blueprint"


def test_short_generic_marketing_question_stays_legacy() -> None:
    assert (
        heuristic_ensemble_route_phase(
            user_text="что думаете про маркетинг проекта?",
            defaults={},
            history=None,
        )
        == "legacy"
    )


def test_explicit_marketing_brief_routes_to_blueprint() -> None:
    assert (
        heuristic_ensemble_route_phase(
            user_text="Соберите маркетинговый бриф по офферу и JTBD",
            defaults={},
            history=None,
        )
        == "blueprint"
    )


@pytest.mark.parametrize(
    "user_text",
    [
        "Проведите полноценный аудит проекта",
        "Предложите 3–5 стратегических гипотез",
        "Подготовьте исследовательский отчёт по рынку",
        "давайте с аудита начнём",
        "Давайте с аудита начнем",
        "начнём с аудита",
        "давайте аудит",
        "Сделайте реестр из 60 уникальных приложений",
        "Нужен список из 40 модулей по пунктам",
        "Соберите backlog MVP по фичам",
        "Техническое задание на интеграцию",
    ],
)
def test_short_substantive_deliverable_routes_before_length_fallback(user_text: str) -> None:
    assert heuristic_ensemble_route_phase(user_text=user_text, defaults={}, history=None) == "blueprint"


def test_short_greeting_remains_legacy() -> None:
    assert heuristic_ensemble_route_phase(user_text="Всем привет", defaults={}, history=None) == "legacy"


def test_short_explicit_verify_routes_blueprint() -> None:
    assert (
        heuristic_ensemble_route_phase(
            user_text="найди в сети практики desktop agents",
            defaults={},
            history=None,
        )
        == "blueprint"
    )


def test_short_with_web_armed_not_hard_legacy() -> None:
    phase = heuristic_ensemble_route_phase(
        user_text="какие практики desktop agents сейчас SOTA?",
        defaults={},
        history=None,
        use_web_search=True,
    )
    assert phase != "legacy"


def test_brief_ack_with_web_armed_stays_legacy() -> None:
    """«ок» is not a research turn — web toggle must not force blueprint packs."""
    phase = heuristic_ensemble_route_phase(
        user_text="ок",
        defaults={},
        history=None,
        use_web_search=True,
    )
    assert phase == "legacy"


def test_explicit_separate_delivery_phrases_are_preserved() -> None:
    assert user_explicitly_requests_separate_delivery("Пусть каждый ответит отдельно")
    assert user_explicitly_requests_separate_delivery("Устройте дискуссию и поспорьте")
    assert not user_explicitly_requests_separate_delivery("Соберите один ответ команды")


def test_web_search_work_turn_is_not_panel_smalltalk() -> None:
    text = "ребята , работаем с тем что есть. а что нужно смотрим по веб поиску"
    assert user_panel_smalltalk_question(text) is False


def test_plan_ensemble_speakers_forces_joint_when_web_search_used() -> None:
    class FakeLlama:
        async def chat(self, *_args: object, **_kwargs: object) -> dict[str, object]:
            return {
                "text": json.dumps(
                    {
                        "speakers": ["mark_arkadevich", "elena_valeryevna", "artur_sergeevich"],
                        "delivery_mode": "separate",
                        "task_blocks": [
                            {
                                "id": "b1",
                                "hero_id": "mark_arkadevich",
                                "title": "Разведка",
                                "objective": "План поиска.",
                            },
                            {
                                "id": "b2",
                                "hero_id": "elena_valeryevna",
                                "title": "Цифры",
                                "objective": "Контрольный список.",
                            },
                            {
                                "id": "b3",
                                "hero_id": "artur_sergeevich",
                                "title": "Воронка",
                                "objective": "Каналы.",
                            },
                        ],
                    },
                    ensure_ascii=False,
                )
            }

    async def _run() -> None:
        plan = await plan_ensemble_speakers(
            FakeLlama(),  # type: ignore[arg-type]
            model="test",
            roster=["mark_arkadevich", "elena_valeryevna", "artur_sergeevich"],
            history=[],
            user_excerpt="ребята , работаем с тем что есть. а что нужно смотрим по веб поиску",
            rag_summary={"web_search_used": True, "web_search_sources": [{"citation_id": "W1"}]},
            defaults={},
        )
        assert plan.delivery_mode == "joint"
        assert len(plan.speakers) >= 2

    asyncio.run(_run())


def test_substantive_legacy_multi_speaker_defaults_to_joint() -> None:
    class FakeLlama:
        async def chat(self, *_args: object, **_kwargs: object) -> dict[str, object]:
            return {
                "text": json.dumps(
                    {
                        "speakers": ["likiy_sorrento", "arlyqueen"],
                        "delivery_mode": "separate",
                        "task_blocks": [
                            {
                                "id": "b1",
                                "hero_id": "likiy_sorrento",
                                "title": "Стратегическая оценка",
                                "objective": "Дать вывод.",
                            },
                            {
                                "id": "b2",
                                "hero_id": "arlyqueen",
                                "title": "Рыночный ракурс",
                                "objective": "Проверить ценность.",
                            },
                        ],
                    },
                    ensure_ascii=False,
                )
            }

    async def _run() -> None:
        plan = await plan_ensemble_speakers(
            FakeLlama(),  # type: ignore[arg-type]
            model="test",
            roster=["likiy_sorrento", "arlyqueen", "akimbo"],
            history=[],
            user_excerpt="Что команда думает о модели выхода на рынок?",
            rag_summary={},
            defaults={},
        )
        assert plan.delivery_mode == "joint"
        assert [block.title for block in plan.task_blocks] == [
            "Стратегическая оценка",
            "Рыночный ракурс",
        ]

    asyncio.run(_run())


def test_explicit_discussion_overrides_joint_model_choice() -> None:
    class FakeLlama:
        async def chat(self, *_args: object, **_kwargs: object) -> dict[str, object]:
            return {
                "text": json.dumps(
                    {
                        "speakers": ["likiy_sorrento", "arlyqueen"],
                        "delivery_mode": "joint",
                        "task_blocks": [],
                    }
                )
            }

    async def _run() -> None:
        plan = await plan_ensemble_speakers(
            FakeLlama(),  # type: ignore[arg-type]
            model="test",
            roster=["likiy_sorrento", "arlyqueen"],
            history=[],
            user_excerpt="Поспорьте: кто что думает, каждый отдельно",
            rag_summary={},
            defaults={},
        )
        assert plan.delivery_mode == "separate"

    asyncio.run(_run())


def test_joint_document_heading_and_peer_speech_context_stay_separate() -> None:
    block = EnsembleTaskBlock(
        block_id="b1",
        hero_id="likiy_sorrento",
        title="Рыночная диагностика",
        objective="Проверить рыночные сигналы.",
        phase="body",
    )
    title = _joint_section_title(block, index=0)
    speech_line = format_council_speech_line(
        hero_id="likiy_sorrento",
        speech="Рынок пока не доказан; сначала проверим сигналы.",
    )
    peer_context = council_speech_transcript_message([speech_line])
    assert title == "Рыночная диагностика"
    assert "[Ликий Соренто]:" in peer_context["content"]
    assert "проверим сигналы" in peer_context["content"]
    assert "## Рыночная диагностика" not in peer_context["content"]


def test_306090_followup_after_joint_artifact_is_blueprint() -> None:
    phase = heuristic_ensemble_route_phase(
        user_text="Сделайте 30 60 90",
        defaults={},
        history=[
            _msg(
                "assistant",
                "совместный бриф",
                {"desktop_ensemble_joint": True, "desktop_ensemble_blueprint": True},
            )
        ],
    )
    assert phase == "blueprint"


def test_business_plan_prefers_unified_artifact() -> None:
    assert user_prefers_unified_joint_artifact("Сделайте полный бизнес план одним сообщением")
