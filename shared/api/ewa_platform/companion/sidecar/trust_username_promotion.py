# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Optional **floor** for ``baseline.ewa_companion_trust_v1.score`` for named app usernames (internal operators /
# fixtures): when score is below the floor, HTTP paths merge ``trust_baseline_update(floor)`` once per catch-up.
# Invariants:
# - Case-insensitive ``username`` match; floor is **10**; allowlist is tiny and explicit — extend only with product intent.
# - Pure delta helper aside from ``read_trust_score`` / ``trust_baseline_update``; routers perform the patch + audit.
# Related:
# - api/ewa_platform/companion/sidecar/trust_state.py
# - api/ewa_platform/gateways/routers/companion_profile.py
# ---
"""Username-keyed promotion for the companion trust meter (0–10 baseline)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.sidecar.trust_state import (
    read_trust_score,
    trust_baseline_update,
)

TRUST_PROMOTED_USERNAMES: frozenset[str] = frozenset({"poet", "lady_boss"})
TRUST_PROMOTED_SCORE: int = 10


def companion_trust_promotion_baseline_delta(
    *,
    username: str | None,
    baseline: Mapping[str, Any] | None,
) -> dict[str, Any] | None:
    """Return shallow-merge baseline fragment to lift trust to ``TRUST_PROMOTED_SCORE``, or ``None`` if N/A."""

    if username is None or not str(username).strip():
        return None
    if str(username).strip().lower() not in TRUST_PROMOTED_USERNAMES:
        return None
    if read_trust_score(baseline) >= TRUST_PROMOTED_SCORE:
        return None
    return trust_baseline_update(TRUST_PROMOTED_SCORE)


__all__: tuple[str, ...] = (
    "TRUST_PROMOTED_SCORE",
    "TRUST_PROMOTED_USERNAMES",
    "companion_trust_promotion_baseline_delta",
)
