# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Single source for EWRP presentation credit math (create / duplicate / retry / quote).
# Invariants:
# - ``generation_types.cost_credits`` for ``ewrp_presentation`` is **per slide**; fallback is 200.
# - Total cost is always ``num_slides * credits_per_slide`` (slides clamped to >= 1).
# Related:
# - api/routers/ewrp.py
# - documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md §4
# ---

from __future__ import annotations

from typing import Any

EWRP_BILLING_TYPE_KEY = "ewrp_presentation"
EWRP_CREDITS_PER_SLIDE = 200


def ewrp_credits_per_slide(gen_type: Any | None = None) -> int:
    """Per-slide credits from generation_types row, else ``EWRP_CREDITS_PER_SLIDE``."""
    if gen_type is not None:
        raw = getattr(gen_type, "cost_credits", None)
        if raw is not None:
            try:
                value = int(float(raw))
            except TypeError, ValueError:
                value = 0
            if value > 0:
                return value
    return EWRP_CREDITS_PER_SLIDE


def ewrp_normalize_slide_count(num_slides: int | None) -> int:
    try:
        slides = int(num_slides) if num_slides is not None else 1
    except TypeError, ValueError:
        slides = 1
    return max(1, slides)


def ewrp_presentation_credit_cost(
    num_slides: int | None,
    gen_type: Any | None = None,
) -> tuple[int, int]:
    """Return ``(credits_per_slide, credit_cost)`` for a full presentation bill."""
    per_slide = ewrp_credits_per_slide(gen_type)
    slides = ewrp_normalize_slide_count(num_slides)
    return per_slide, slides * per_slide
