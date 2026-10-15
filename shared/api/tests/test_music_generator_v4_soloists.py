"""Music Generator v4 soloist presets."""

from __future__ import annotations

from api.services.music_generator_v4.soloists import (
    apply_v4_luna_soloist_tags,
    coerce_v4_soloist_generate_params,
    normalize_v4_soloist_key,
    v4_soloist_tag_phrase,
)


def test_normalize_v4_soloist_unknown_to_none() -> None:
    assert normalize_v4_soloist_key("missing") == "none"
    assert normalize_v4_soloist_key("luna") == "luna"


def test_luna_tag_phrase_includes_lora_trigger() -> None:
    phrase = v4_soloist_tag_phrase("luna")
    assert "EMEW_STYLE_V1" in phrase
    assert "psychedelic" in phrase.lower()


def test_apply_v4_luna_soloist_tags_prepends_anchor() -> None:
    out = apply_v4_luna_soloist_tags("120 BPM pop, female vocal", "luna")
    assert "EMEW_STYLE_V1" in out
    assert "120 BPM pop" in out


def test_coerce_v4_luna_locked_params() -> None:
    vocal, style, lang, bpm, ks = coerce_v4_soloist_generate_params(
        "luna",
        vocal="male",
        style="pop",
        language="en",
        bpm=120,
        keyscale="C major",
    )
    assert vocal == "female"
    assert style == "luna"
    assert lang == "ru"
    assert bpm == 134
    assert ks == "G minor"
