# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for Music Generator seed policy so fixed-seed reproducibility
# works while random-by-default behavior remains unchanged.
# Invariants:
# - Explicit seed is preserved (or clamped) and marked as requested.
# - Missing seed produces random value and is marked as non-requested.
# Related:
# - api/services/music_generation_seed_policy.py
# ---

from __future__ import annotations

from api.services.music_generation_seed_policy import (
    MAX_MUSIC_GENERATION_SEED,
    resolve_music_generation_seed,
)


def test_resolve_seed_uses_random_when_not_requested() -> None:
    seed, used_requested_seed, seed_was_clamped = resolve_music_generation_seed(
        None,
        randint=lambda _start, _end: 12345,
    )
    assert seed == 12345
    assert used_requested_seed is False
    assert seed_was_clamped is False


def test_resolve_seed_uses_requested_value_as_is() -> None:
    seed, used_requested_seed, seed_was_clamped = resolve_music_generation_seed(424242)
    assert seed == 424242
    assert used_requested_seed is True
    assert seed_was_clamped is False


def test_resolve_seed_clamps_negative_requested_value() -> None:
    seed, used_requested_seed, seed_was_clamped = resolve_music_generation_seed(-7)
    assert seed == 0
    assert used_requested_seed is True
    assert seed_was_clamped is True


def test_resolve_seed_clamps_above_max_safe_requested_value() -> None:
    seed, used_requested_seed, seed_was_clamped = resolve_music_generation_seed(MAX_MUSIC_GENERATION_SEED + 99)
    assert seed == MAX_MUSIC_GENERATION_SEED
    assert used_requested_seed is True
    assert seed_was_clamped is True
