# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock MIT CIS voice alias mapping for stack9 Silero (no torch).
# Related:
# - docker/builders/stack9-silero/voice_aliases.py
# ---

from __future__ import annotations

from voice_aliases import DEFAULT_VOICE, VOICE_ALIASES, resolve_ru_voice


def test_default_is_mit_cis_speaker() -> None:
    assert DEFAULT_VOICE.startswith("ru_")
    assert resolve_ru_voice(None) == DEFAULT_VOICE
    assert resolve_ru_voice("") == DEFAULT_VOICE
    assert resolve_ru_voice("auto") == "ru_ekaterina"
    assert DEFAULT_VOICE == "ru_ekaterina"


def test_legacy_ccnc_voices_map_to_cis() -> None:
    assert VOICE_ALIASES["xenia"] == "ru_ekaterina"
    assert VOICE_ALIASES["aidar"] == "ru_marat"
    assert resolve_ru_voice("xenia") == "ru_ekaterina"
    assert resolve_ru_voice("eugene") == "ru_dmitriy"


def test_unknown_falls_back_when_known_set() -> None:
    known = {"ru_ekaterina", "ru_marat"}
    assert resolve_ru_voice("nope", known) == DEFAULT_VOICE
    assert resolve_ru_voice("ru_marat", known) == "ru_marat"
