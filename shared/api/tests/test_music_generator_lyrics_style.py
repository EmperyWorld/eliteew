# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Narrow Layer C guards for music_generator_lyrics_style / lyrics_prompts
# helpers (Phase C.4 extract + prompts split).
# Invariants:
# - Import path must not pull the parent router module (no cycle).
# - prompts must not import lyrics_style (dependency direction).
# Related:
# - api/routers/music_generator_lyrics_style.py
# - api/routers/music_generator_lyrics_prompts.py
# ---
"""Contract tests for lyrics/style helpers extracted from music_generator."""

from __future__ import annotations

import sys
from pathlib import Path

from api.routers.music_generator_lyrics_prompts import (
    LYRICS_STYLE_GUIDE_RU,
    LYRICS_THEME_PRIORITY_UNIVERSAL_RU,
    _normalize_luna_mode,
)
from api.routers.music_generator_lyrics_style import (
    _duration_seconds_fallback_for_style,
    _lyrics_skip_auto_enrich,
    _parse_json_object_from_llm,
)


def test_lyrics_style_module_does_not_import_parent_router() -> None:
    """Forbidden cycle: lyrics_style must not load music_generator router."""
    parent = "api.routers.music_generator"
    was_loaded = parent in sys.modules
    # Ensure our import under test does not require parent.
    import api.routers.music_generator_lyrics_style as lyrics_style  # noqa: PLC0415

    assert lyrics_style is not None
    if not was_loaded:
        assert parent not in sys.modules


def test_lyrics_prompts_module_does_not_import_style_or_parent() -> None:
    """Forbidden cycle: prompts must not import lyrics_style or parent router."""
    parent = "api.routers.music_generator"
    parent_was = parent in sys.modules
    import api.routers.music_generator_lyrics_prompts as lyrics_prompts  # noqa: PLC0415

    assert lyrics_prompts is not None
    assert lyrics_prompts.__file__ is not None
    src = Path(lyrics_prompts.__file__).read_text(encoding="utf-8")
    assert "import api.routers.music_generator_lyrics_style" not in src
    assert "from api.routers.music_generator_lyrics_style" not in src
    assert "import api.routers.music_generator\n" not in src
    assert "from api.routers.music_generator " not in src
    assert "from api.routers.music_generator import" not in src
    if not parent_was:
        assert parent not in sys.modules


def test_lyrics_prompt_constants_present() -> None:
    assert "Приоритет полей запроса" in LYRICS_THEME_PRIORITY_UNIVERSAL_RU
    assert "pop" in LYRICS_STYLE_GUIDE_RU
    assert "luna" in LYRICS_STYLE_GUIDE_RU
    # Facade re-export: parent consumers keep importing via lyrics_style.
    from api.routers import music_generator_lyrics_style as facade  # noqa: PLC0415

    assert facade.LYRICS_THEME_PRIORITY_UNIVERSAL_RU is LYRICS_THEME_PRIORITY_UNIVERSAL_RU


def test_normalize_luna_mode_classic_vs_experimental() -> None:
    assert _normalize_luna_mode(None) == "classic"
    assert _normalize_luna_mode("classic") == "classic"
    assert _normalize_luna_mode("experimental") == "experimental"
    assert _normalize_luna_mode("эксперимент") == "experimental"


def test_parse_json_object_from_llm_fenced_and_raw() -> None:
    assert _parse_json_object_from_llm('{"vocal":"female","bpm":120}') == {
        "vocal": "female",
        "bpm": 120,
    }
    fenced = '```json\n{"language":"ru"}\n```'
    assert _parse_json_object_from_llm(fenced) == {"language": "ru"}
    assert _parse_json_object_from_llm("not json") is None


def test_lyrics_skip_auto_enrich_detects_structured() -> None:
    plain = "[Verse]\nhello"
    assert _lyrics_skip_auto_enrich(plain) is False
    enriched = "[Verse: drums and bass, 120 BPM feel]\n(Voice: female, soft)\nhello"
    assert _lyrics_skip_auto_enrich(enriched) is True
    split = "(Arrangement: pad, 100 BPM feel)\n(Voice: female)\nline"
    assert _lyrics_skip_auto_enrich(split) is True


def test_duration_seconds_fallback_for_style_ballad_vs_default() -> None:
    assert _duration_seconds_fallback_for_style("ballad") == 240
    assert _duration_seconds_fallback_for_style("pop") == 180
    assert _duration_seconds_fallback_for_style("drum and bass") == 200
