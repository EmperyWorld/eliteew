# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Discussion preset: interview (AI panel interviews the human participant).
# Invariants:
# - Heroes ask the participant; they do not debate each other as the main move.
# Related:
# - discussion/presets/base.py
# ---
from __future__ import annotations

from api.services.desktop_chat_ensemble.discussion.contracts import DiscussionIntensity, DiscussionRelation
from api.services.desktop_chat_ensemble.discussion.presets.base import DiscussionPreset, register_preset

INTERVIEW = register_preset(
    DiscussionPreset(
        id="interview",
        title_ru="Интервью",
        title_en="Interview",
        description_ru="Вопросы к вам: уточнения и короткая оценка ответов.",
        description_en="They interview you: questions, probes, and a short read of your answers.",
        goal_rubric=(
            "Провести интервью с участником: ясные вопросы, уточнения по ответам, "
            "без монолога ИИ и без спора героев между собой."
        ),
        completion_rubric=(
            "Покрыты ключевые темы, ответы уточнены, есть короткая развилка "
            "«что уже ясно / какой вопрос остался» — не анкета и не документ."
        ),
        role_weights={"research": 1.3, "rigor": 1.2, "behavioral": 1.2, "legal_edge": 0.9},
        allowed_relations=(
            DiscussionRelation.OPENING,
            DiscussionRelation.CHALLENGE,
            DiscussionRelation.SUPPORT,
            DiscussionRelation.SYNTHESIS,
        ),
        default_intensity=DiscussionIntensity.CALM,
        moderator_policy="firm",
        min_roster=1,
        max_roster=4,
        catalog_order=50,
        relation_hints={
            DiscussionRelation.OPENING.value: (
                "Задай собеседнику один ясный вопрос по теме. Не отвечай за него и не спорь с коллегами."
            ),
            DiscussionRelation.CHALLENGE.value: (
                "Уточни последний ответ одним вопросом: факты, пример, граница или допущение."
            ),
            DiscussionRelation.SUPPORT.value: (
                "Коротко признай сильный ответ и задай следующий вопрос в той же линии."
            ),
            DiscussionRelation.SYNTHESIS.value: (
                "Собери короткую развилку: что уже ясно и какой вопрос остался. Без анкеты."
            ),
        },
    )
)
