# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Web search quality tiers for marketing cabinet — query count, hit limits, prompt budget.
# Invariants:
# - off disables search; legacy use_web_search=true → standard.
# Related:
# - api.services.marketing_web_search_context
# ---

from __future__ import annotations

from dataclasses import dataclass

from api.schemas.marketing_web_search import WEB_SEARCH_QUALITY_VALUES, WebSearchQuality


@dataclass(frozen=True, slots=True)
class WebSearchQualityTier:
    max_queries: int
    hits_per_query: int
    max_total_chars: int


WEB_SEARCH_QUALITY_TIERS: dict[WebSearchQuality, WebSearchQualityTier] = {
    "off": WebSearchQualityTier(max_queries=0, hits_per_query=0, max_total_chars=0),
    "light": WebSearchQualityTier(max_queries=1, hits_per_query=5, max_total_chars=1800),
    "standard": WebSearchQualityTier(max_queries=2, hits_per_query=6, max_total_chars=3200),
    "deep": WebSearchQualityTier(max_queries=3, hits_per_query=8, max_total_chars=5000),
}


def normalize_web_search_quality(
    quality: str | None = None,
    *,
    use_web_search: bool = False,
) -> WebSearchQuality:
    raw = str(quality or "").strip().lower()
    if raw in WEB_SEARCH_QUALITY_VALUES and raw != "off":
        return raw  # type: ignore[return-value]
    if use_web_search is True:
        return "standard"
    return "off"


def web_search_enabled(quality: WebSearchQuality) -> bool:
    return quality != "off"
