# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared seed policy for Music Generator request paths. Keeps random-by-default behavior,
# but allows reproducible reruns when client explicitly sends `seed`.
# Invariants:
# - Applied seed always stays in safe Comfy/JS integer range [0, 2^53 - 1].
# - `requested_seed=None` always resolves to fresh random seed.
# Related:
# - api/routers/music_generator.py
# ---

from __future__ import annotations

import random
from collections.abc import Callable

MAX_MUSIC_GENERATION_SEED = 2**53 - 1


def resolve_music_generation_seed(
    requested_seed: int | None,
    *,
    randint: Callable[[int, int], int] | None = None,
) -> tuple[int, bool, bool]:
    """
    Resolve seed for music generation.

    Returns:
        (applied_seed, used_requested_seed, requested_seed_was_clamped)
    """
    if requested_seed is None:
        rng = randint or random.randint
        return rng(0, MAX_MUSIC_GENERATION_SEED), False, False

    requested = int(requested_seed)
    applied = max(0, min(MAX_MUSIC_GENERATION_SEED, requested))
    return applied, True, applied != requested
