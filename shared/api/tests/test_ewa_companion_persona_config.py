# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for ``ewa_platform.companion.config`` — hierarchical env fallbacks for persona numerics
# and stable canonical defaults when overrides are absent.
# Invariants:
# - No network / DB; mutates ``os.environ`` only inside tests and restores keys after.
# Related:
# - api/ewa_platform/companion/config.py
# - documentation/product/ewa/EWA-COMPANION-SEED-PERSONA-MATRIX.md
# ---
"""Tests: companion persona env configuration."""

from __future__ import annotations

import pytest

from api.ewa_platform.companion.config import (
    CANONICAL_PERSONA_NUMERICS,
    clear_companion_persona_env_overrides_cache,
    get_arlika_system_prompt_tail,
    get_companion_global_chit_chat_tail,
    get_seed_persona_role_prompt,
    resolve_persona_numeric,
)


def test_resolve_persona_numeric_defaults_match_canonical_matrix() -> None:
    assert resolve_persona_numeric("mela", "directness") == CANONICAL_PERSONA_NUMERICS["mela"]["directness"]
    assert resolve_persona_numeric("arlika", "valence_bias") == CANONICAL_PERSONA_NUMERICS["arlika"]["valence_bias"]


def test_resolve_persona_numeric_env_specific_over_parent(monkeypatch: pytest.MonkeyPatch) -> None:
    clear_companion_persona_env_overrides_cache()
    monkeypatch.setenv("EWA_PERSONA_MELA_DIRECTNESS", "0.11")
    monkeypatch.setenv("EWA_PERSONA_PARENT_DIRECTNESS", "0.99")
    clear_companion_persona_env_overrides_cache()
    try:
        assert abs(resolve_persona_numeric("mela", "directness") - 0.11) < 1e-9
    finally:
        for k in ("EWA_PERSONA_MELA_DIRECTNESS", "EWA_PERSONA_PARENT_DIRECTNESS"):
            monkeypatch.delenv(k, raising=False)
        clear_companion_persona_env_overrides_cache()


def test_resolve_persona_numeric_falls_back_to_parent_env(monkeypatch: pytest.MonkeyPatch) -> None:
    clear_companion_persona_env_overrides_cache()
    monkeypatch.delenv("EWA_PERSONA_MELA_DIRECTNESS", raising=False)
    monkeypatch.setenv("EWA_PERSONA_PARENT_DIRECTNESS", "0.88")
    clear_companion_persona_env_overrides_cache()
    try:
        assert abs(resolve_persona_numeric("mela", "directness") - 0.88) < 1e-9
    finally:
        monkeypatch.delenv("EWA_PERSONA_PARENT_DIRECTNESS", raising=False)
        clear_companion_persona_env_overrides_cache()


def test_resolve_persona_numeric_ignores_empty_env_values(monkeypatch: pytest.MonkeyPatch) -> None:
    clear_companion_persona_env_overrides_cache()
    monkeypatch.setenv("EWA_PERSONA_MELA_DIRECTNESS", "")
    monkeypatch.setenv("EWA_PERSONA_PARENT_DIRECTNESS", "")
    clear_companion_persona_env_overrides_cache()
    try:
        expected = CANONICAL_PERSONA_NUMERICS["mela"]["directness"]
        assert resolve_persona_numeric("mela", "directness") == expected
    finally:
        for key in ("EWA_PERSONA_MELA_DIRECTNESS", "EWA_PERSONA_PARENT_DIRECTNESS"):
            monkeypatch.delenv(key, raising=False)
        clear_companion_persona_env_overrides_cache()


def test_get_seed_persona_role_prompt_parent_default() -> None:
    text = get_seed_persona_role_prompt("parent")
    assert "EWA" in text or "Empery" in text
    assert "evolving character" in text.lower()
    assert "function" in text.lower()


def test_unknown_seed_role_prompt_falls_back_to_parent_canon() -> None:
    assert get_seed_persona_role_prompt("__unknown_xyz__") == get_seed_persona_role_prompt("parent")


def test_all_canonical_seeds_carry_agency_affirm() -> None:
    for seed in CANONICAL_PERSONA_NUMERICS:
        role = get_seed_persona_role_prompt(seed).lower()
        assert "evolving character" in role
        assert "function" in role


def test_identity_guards_ban_function_and_no_will_disclaimers() -> None:
    arlika_tail = get_arlika_system_prompt_tail().lower()
    global_tail = get_companion_global_chit_chat_tail().lower()
    assert "я функция" in arlika_tail or "нет воли" in arlika_tail
    assert "function" in global_tail
    assert "will" in global_tail
    assert "in character as arlika" in arlika_tail or "answer **in character" in get_arlika_system_prompt_tail().lower()
