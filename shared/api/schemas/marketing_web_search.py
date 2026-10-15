# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared marketing-cabinet web search quality contract (off/light/standard/deep).
# Invariants:
# - Default is off; legacy use_web_search=true maps to standard.
# Related:
# - api.services.marketing_web_search_quality
# ---

from __future__ import annotations

from typing import Literal

WebSearchQuality = Literal["off", "light", "standard", "deep"]

WEB_SEARCH_QUALITY_VALUES: frozenset[str] = frozenset({"off", "light", "standard", "deep"})
