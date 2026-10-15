# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Discussion preset: brainstorm.
# Invariants: — (нет)
# Related:
# - discussion/presets/base.py
# ---
from __future__ import annotations

from api.services.desktop_chat_ensemble.discussion.contracts import DiscussionIntensity, DiscussionRelation
from api.services.desktop_chat_ensemble.discussion.presets.base import DiscussionPreset, register_preset

BRAINSTORM = register_preset(
    DiscussionPreset(
        id="brainstorm",
        title_ru="Мозговой штурм",
        title_en="Brainstorm",
        description_ru="Генерация вариантов, быстрые возражения и отбор сильных идей.",
        description_en="Generate options, challenge weak ones, and keep strong ideas.",
        goal_rubric="Собрать несколько рабочих вариантов и критерии выбора без финального реестра в речи.",
        completion_rubric="Есть ≥3 осмысленных варианта и явные trade-offs; команда может выбрать следующий шаг.",
        role_weights={"creative": 1.2, "product": 1.1, "growth": 1.0, "rigor": 0.9},
        allowed_relations=(
            DiscussionRelation.OPENING,
            DiscussionRelation.SUPPORT,
            DiscussionRelation.CHALLENGE,
            DiscussionRelation.REBUTTAL,
            DiscussionRelation.SYNTHESIS,
        ),
        default_intensity=DiscussionIntensity.PROFESSIONAL_CONFRONTATIONAL,
        moderator_policy="light",
        catalog_order=10,
    )
)
