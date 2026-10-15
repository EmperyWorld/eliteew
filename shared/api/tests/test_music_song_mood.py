# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for random song mood resolution used in lyrics generation.
# Invariants:
# - Same seed → same mood; explicit theme/request overrides random.
# Related:
# - api/services/music_song_mood.py
# ---

from __future__ import annotations

from api.services.music_generator_v3.prompts import build_v3_lyrics_messages
from api.services.music_song_mood import (
    detect_mood_from_text,
    detect_mood_from_theme,
    resolve_song_mood,
    song_mood_prompt_blocks,
    source_text_negates_sadness,
)


def test_resolve_song_mood_stable_with_seed() -> None:
    a = resolve_song_mood(theme="линия на бумаге", seed="run-1")
    b = resolve_song_mood(theme="линия на бумаге", seed="run-1")
    c = resolve_song_mood(theme="линия на бумаге", seed="run-2")
    assert a.mood_id == b.mood_id
    assert a.source == "random"
    assert c.mood_id  # different seed may differ


def test_explicit_request_overrides_random() -> None:
    pick = resolve_song_mood(theme="любая тема", explicit_mood="joy", seed="x")
    assert pick.mood_id == "joyful"
    assert pick.source == "explicit_request"


def test_theme_detects_desire_not_default_sad() -> None:
    assert detect_mood_from_theme("ночной флирт и вожделение") == "desire"
    pick = resolve_song_mood(theme="тайна и секретный шпион", seed="z")
    assert pick.mood_id == "intrigue"
    assert pick.source == "explicit_theme"


def test_melancholic_not_default_random_pool() -> None:
    ids = {resolve_song_mood(theme="линия на бумаге", seed=f"s{i}").mood_id for i in range(64)}
    assert "melancholic" not in ids
    assert "dark_intense" not in ids
    assert len(ids) >= 4


def test_blocklisted_moods_only_by_explicit_request() -> None:
    pick = resolve_song_mood(theme="грусть и потеря", explicit_mood="melancholic", seed="sad-seed")
    assert pick.mood_id == "melancholic"
    assert pick.source == "explicit_request"


def test_prompt_blocks_contain_anti_sadness_ru() -> None:
    pick = resolve_song_mood(theme="x", explicit_mood="playful", seed="s")
    system, user = song_mood_prompt_blocks(pick, language="ru")
    assert "страдание" in system
    assert "игра" in user.lower() or "ирони" in user.lower()


def test_v3_lyrics_messages_include_song_mood() -> None:
    messages = build_v3_lyrics_messages(
        theme="офисный понедельник",
        style="cinematic_pop",
        language="ru",
        vocal="female",
        mood_seed="v3:test:seed",
    )
    prompt = "\n".join(m["content"] for m in messages)
    assert "НАСТРОЕНИЕ ПЕСНИ" in prompt or "SONG MOOD" in prompt
    assert "случайно" in prompt or "радость" in prompt or "интриг" in prompt


def test_negated_sadness_theme_not_melancholic() -> None:
    theme = "Владивостокская осень: почему это не про «грустный сентябрь», а про особый вайб и выживание"
    assert source_text_negates_sadness(theme)
    assert detect_mood_from_text(theme) == "triumphant"
    pick = resolve_song_mood(theme=theme, seed="vlad-autumn")
    assert pick.mood_id in {"triumphant", "joyful", "rebellious", "epic_cinematic"}
    assert pick.mood_id != "melancholic"
    assert pick.source == "explicit_theme"


def test_melancholic_still_detected_when_requested() -> None:
    assert detect_mood_from_theme("грусть и потеря") == "melancholic"
