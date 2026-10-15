# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Discussion preset: product review.
# Invariants: — (нет)
# Related:
# - discussion/presets/base.py
# ---
from __future__ import annotations

from api.services.desktop_chat_ensemble.discussion.contracts import DiscussionIntensity, DiscussionRelation
from api.services.desktop_chat_ensemble.discussion.presets.base import DiscussionPreset, register_preset

PRODUCT_REVIEW = register_preset(
    DiscussionPreset(
        id="product_review",
        title_ru="Разбор продукта",
        title_en="Product review",
        description_ru="Границы поставки, риски, UX friction и критерии приёмки.",
        description_en="Delivery boundaries, risks, UX friction, and acceptance criteria.",
        goal_rubric="Выявить главные product-риски и решить, что в scope / out of scope.",
        completion_rubric="Есть согласованный (или явно спорный) scope-cut и список блокеров.",
        role_weights={"product": 1.3, "engineering": 1.2, "behavioral": 1.0, "finance": 0.9},
        allowed_relations=(
            DiscussionRelation.OPENING,
            DiscussionRelation.CHALLENGE,
            DiscussionRelation.REBUTTAL,
            DiscussionRelation.SUPPORT,
            DiscussionRelation.SYNTHESIS,
        ),
        default_intensity=DiscussionIntensity.PROFESSIONAL_CONFRONTATIONAL,
        moderator_policy="firm",
        catalog_order=20,
    )
)
