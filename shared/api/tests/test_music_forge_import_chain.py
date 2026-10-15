# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Import-chain lock after MusicForge algorithm/pipeline module split (Phase 1).
# Invariants:
# - Public facade imports resolve without loading the retired monolith algorithm.py.
# Related:
# - api/services/music_forge/pipeline.py
# - api/services/music_forge/algorithm/
# ---
"""Import-chain regression for MusicForge package split."""

from __future__ import annotations


def test_music_forge_algorithm_package_exports_lane_selectors() -> None:
    from api.services.music_forge.algorithm import (
        MUSIC_FORGE_AUDIO_TYPE_KEY,
        normalize_music_forge_input,
        select_music_forge_model_lane,
    )

    assert MUSIC_FORGE_AUDIO_TYPE_KEY == "music_generator_forge_audio"
    assert callable(normalize_music_forge_input)
    assert callable(select_music_forge_model_lane)


def test_music_forge_pipeline_composition_exposes_contract_methods() -> None:
    """Lock repository/executor composition without importing the facade (avoids content/bcrypt chain)."""
    from api.services.music_forge.billing_gate import MusicForgeBillingGate
    from api.services.music_forge.pipeline_execute import MusicForgeRunExecutor
    from api.services.music_forge.pipeline_repository import MusicForgeRunRepository

    assert hasattr(MusicForgeRunRepository, "_set_run_status")
    assert hasattr(MusicForgeRunRepository, "_ensure_steps")
    assert hasattr(MusicForgeRunExecutor, "execute_run")
    assert callable(MusicForgeRunExecutor.execute_run)
    assert hasattr(MusicForgeBillingGate, "preflight_credits")
    assert hasattr(MusicForgeBillingGate, "enforce_run_budget")
