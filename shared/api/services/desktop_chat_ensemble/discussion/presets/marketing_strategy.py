# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Discussion preset: marketing strategy.
# Invariants: — (нет)
# Related:
# - discussion/presets/base.py
# ---
from __future__ import annotations

from api.services.desktop_chat_ensemble.discussion.contracts import DiscussionIntensity, DiscussionRelation
from api.services.desktop_chat_ensemble.discussion.presets.base import DiscussionPreset, register_preset

MARKETING_STRATEGY = register_preset(
    DiscussionPreset(
        id="marketing_strategy",
        title_ru="Маркетинговая стратегия",
        title_en="Marketing strategy",
        description_ru="Сегменты, оффер, каналы и доказательные ограничения.",
        description_en="Segments, offer, channels, and evidence boundaries.",
        goal_rubric="Сформировать рабочую гипотезу go-to-market с явными допущениями.",
        completion_rubric="Есть целевой сегмент, оффер-тезис и каналный rationale без выдуманных метрик.",
        role_weights={"brand_voice": 1.2, "growth": 1.2, "research": 1.1, "finance": 1.0},
        allowed_relations=(
            DiscussionRelation.OPENING,
            DiscussionRelation.SUPPORT,
            DiscussionRelation.CHALLENGE,
            DiscussionRelation.REBUTTAL,
            DiscussionRelation.SYNTHESIS,
        ),
        default_intensity=DiscussionIntensity.PROFESSIONAL_CONFRONTATIONAL,
        moderator_policy="light",
        catalog_order=30,
    )
)
