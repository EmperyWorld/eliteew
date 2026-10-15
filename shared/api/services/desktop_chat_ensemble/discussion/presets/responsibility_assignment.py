# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Discussion preset: responsibility assignment.
# Invariants: — (нет)
# Related:
# - discussion/presets/base.py
# ---
from __future__ import annotations

from api.services.desktop_chat_ensemble.discussion.contracts import DiscussionIntensity, DiscussionRelation
from api.services.desktop_chat_ensemble.discussion.presets.base import DiscussionPreset, register_preset

RESPONSIBILITY_ASSIGNMENT = register_preset(
    DiscussionPreset(
        id="responsibility_assignment",
        title_ru="Распределение ответственностей",
        title_en="Responsibility assignment",
        description_ru="Кто владеет чем, где handoff и какие критерии готовности.",
        description_en="Owners, handoffs, and done criteria — without a secretary essay.",
        goal_rubric="Закрепить owners и границы ответственности по ключевым зонам.",
        completion_rubric="По каждой зоне есть owner или явный конфликт ownership с критерием решения.",
        role_weights={"operations": 1.3, "product": 1.1, "rigor": 1.1, "finance": 0.9},
        allowed_relations=(
            DiscussionRelation.OPENING,
            DiscussionRelation.CHALLENGE,
            DiscussionRelation.REBUTTAL,
            DiscussionRelation.SUPPORT,
            DiscussionRelation.SYNTHESIS,
        ),
        default_intensity=DiscussionIntensity.PROFESSIONAL_CONFRONTATIONAL,
        moderator_policy="firm",
        catalog_order=40,
    )
)
