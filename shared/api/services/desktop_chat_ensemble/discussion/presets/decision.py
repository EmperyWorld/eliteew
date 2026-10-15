# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Discussion preset: decision (pick one next step with risks visible).
# Invariants: — (нет)
# Related:
# - discussion/presets/base.py
# ---
from __future__ import annotations

from api.services.desktop_chat_ensemble.discussion.contracts import DiscussionIntensity, DiscussionRelation
from api.services.desktop_chat_ensemble.discussion.presets.base import DiscussionPreset, register_preset

DECISION = register_preset(
    DiscussionPreset(
        id="decision",
        title_ru="Принятие решения",
        title_en="Decision",
        description_ru="Сравнить варианты и выбрать следующий шаг с явными рисками.",
        description_en="Compare options and pick the next step, with risks in the open.",
        goal_rubric=(
            "Свести развилку к одному следующему шагу: критерии, риски отказа и что проверяем сразу после выбора."
        ),
        completion_rubric=(
            "Есть предпочтительный шаг (или явный конфликт выбора) и одно проверяемое следствие, не полный план."
        ),
        role_weights={"product": 1.3, "rigor": 1.2, "finance": 1.1, "operations": 1.0},
        allowed_relations=(
            DiscussionRelation.OPENING,
            DiscussionRelation.CHALLENGE,
            DiscussionRelation.REBUTTAL,
            DiscussionRelation.SUPPORT,
            DiscussionRelation.SYNTHESIS,
        ),
        default_intensity=DiscussionIntensity.PROFESSIONAL_CONFRONTATIONAL,
        moderator_policy="firm",
        catalog_order=60,
    )
)
