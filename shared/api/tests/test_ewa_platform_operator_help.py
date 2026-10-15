# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Tests for operator-facing EWA platform setting help enrichment.
# Invariants:
# - EXACT overrides must be longer than generic bool boilerplate.
# Related:
# - api/ewa_platform/settings/operator_help.py
# ---

from __future__ import annotations

from ewa_platform.settings.operator_help import enrich_setting_help


def test_wf_engine_exact_help_is_detailed() -> None:
    help_text = enrich_setting_help(
        "EWA_COMPANION_WF_ENGINE_ENABLED",
        value_type="bool",
        short_ru="short",
        short_en="short",
        affects_ru="a",
        affects_en="a",
        allowed_values="0|1",
    )
    assert "Postgres" in help_text.description_ru
    assert "EWA_COMPANION_ASYNC_JOBS_ENABLED" in help_text.description_ru
    assert len(help_text.description_ru) > 120


def test_persona_directness_template() -> None:
    help_text = enrich_setting_help(
        "EWA_PERSONA_MELA_DIRECTNESS",
        value_type="float",
        short_ru="x",
        short_en="x",
        affects_ru="y",
        affects_en="y",
        allowed_values="0–1",
    )
    assert "Mela" in help_text.description_ru
    assert "0–1" in help_text.description_ru


def test_generic_bool_adds_operator_guidance() -> None:
    help_text = enrich_setting_help(
        "EWA_COMPANION_CHAT_CONDENSE_ENABLED",
        value_type="bool",
        short_ru="Condense старых сообщений чата.",
        short_en="Condense old chat messages.",
        affects_ru="memory/chat_condense.py.",
        affects_en="memory/chat_condense.py.",
        allowed_values="0|1",
    )
    assert "Postgres" in help_text.description_ru
    assert "Condense" in help_text.description_ru
