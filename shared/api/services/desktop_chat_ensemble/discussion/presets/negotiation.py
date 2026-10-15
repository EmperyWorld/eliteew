# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Discussion preset: negotiation (positions, concessions, red lines).
# Invariants:
# - Personal attacks stay excluded regardless of intensity.
# Related:
# - discussion/presets/base.py
# ---
from __future__ import annotations

from api.services.desktop_chat_ensemble.discussion.contracts import DiscussionIntensity, DiscussionRelation
from api.services.desktop_chat_ensemble.discussion.presets.base import DiscussionPreset, register_preset

NEGOTIATION = register_preset(
    DiscussionPreset(
        id="negotiation",
        title_ru="Переговоры",
        title_en="Negotiation",
        description_ru="Позиции, уступки и красные линии — без личных атак.",
        description_en="Positions, concessions, and red lines — without personal attacks.",
        goal_rubric=(
            "Прояснить позиции сторон, возможные уступки и красные линии; не выдавать согласие, которого не было."
        ),
        completion_rubric=(
            "Есть карта интересов, одна реалистичная зона сделки или явный тупик с причиной — без выдуманных обещаний."
        ),
        role_weights={"legal_edge": 1.3, "behavioral": 1.2, "finance": 1.1, "brand_voice": 0.9},
        allowed_relations=(
            DiscussionRelation.OPENING,
            DiscussionRelation.CHALLENGE,
            DiscussionRelation.REBUTTAL,
            DiscussionRelation.SUPPORT,
            DiscussionRelation.SYNTHESIS,
        ),
        default_intensity=DiscussionIntensity.PROFESSIONAL_CONFRONTATIONAL,
        moderator_policy="firm",
        catalog_order=70,
    )
)
