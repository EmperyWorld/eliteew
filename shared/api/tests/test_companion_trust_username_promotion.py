# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for ``companion_trust_promotion_baseline_delta`` — allowlisted usernames only; no-op at floor **10**.
# Invariants:
# - Pure helper; no DB.
# Related:
# - api/ewa_platform/companion/sidecar/trust_username_promotion.py
# ---
from __future__ import annotations

from api.ewa_platform.companion.sidecar.trust_username_promotion import (
    companion_trust_promotion_baseline_delta,
)


def test_promotes_poet_when_below_floor() -> None:
    d = companion_trust_promotion_baseline_delta(username="Poet", baseline={})
    assert d is not None
    assert d["ewa_companion_trust_v1"]["score"] == 10


def test_promotes_lady_boss_case_insensitive() -> None:
    d = companion_trust_promotion_baseline_delta(username="Lady_BOSS", baseline={})
    assert d is not None
    assert d["ewa_companion_trust_v1"]["score"] == 10


def test_skips_when_already_at_floor() -> None:
    assert (
        companion_trust_promotion_baseline_delta(
            username="lady_boss",
            baseline={"ewa_companion_trust_v1": {"score": 10}},
        )
        is None
    )


def test_skips_unknown_username() -> None:
    assert companion_trust_promotion_baseline_delta(username="nobody", baseline={}) is None


def test_skips_blank_username() -> None:
    assert companion_trust_promotion_baseline_delta(username="   ", baseline={}) is None
