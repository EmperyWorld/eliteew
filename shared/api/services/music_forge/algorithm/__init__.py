# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Public re-export surface for MusicForge structured song algorithm (package entrypoint).
# Invariants:
# - Import paths from api.services.music_forge.algorithm remain stable for pipeline and tests.
# - All music semantics are derived on the backend; frontend never decides model parameters.
# Related:
# - api/services/music_forge/pipeline.py
# - api/tests/test_music_forge_algorithm.py
# ---

"""MusicForge structured song algorithm."""

from api.services.music_forge.algorithm.audio import (
    build_audio_input_data,
    build_content_metadata,
)
from api.services.music_forge.algorithm.constants import (
    MUSIC_FORGE_AUDIO_TYPE_KEY,
    MUSIC_FORGE_BLUEPRINT_TYPE_KEY,
    MUSIC_FORGE_LANE_BASE_XL,
    MUSIC_FORGE_LANE_SFT_XL,
    MUSIC_FORGE_LANE_TURBO_XL,
    MUSIC_FORGE_LYRICS_TYPE_KEY,
    MUSIC_FORGE_STYLE_TYPE_KEY,
    MUSIC_FORGE_VERSION,
)
from api.services.music_forge.algorithm.lanes import (
    normalize_music_forge_input,
    select_music_forge_model_lane,
)
from api.services.music_forge.algorithm.lyrics import (
    enrich_music_forge_lyrics_for_ace,
    validate_and_repair_lyrics,
)
from api.services.music_forge.algorithm.prompts import (
    build_blueprint_messages,
    build_lyrics_messages,
    build_style_messages,
    corpus_hints_for_prompt,
    fallback_song_blueprint,
    parse_song_blueprint,
)
from api.services.music_forge.algorithm.style import (
    align_style_caption_to_vocal,
    build_style_capsule,
    infer_music_forge_style_key,
    lock_voice_enrich_lines_to_vocal,
    music_forge_keyscale_for_style,
    resolve_music_forge_vocal,
    slim_ace_style_caption,
)

__all__ = [
    "MUSIC_FORGE_AUDIO_TYPE_KEY",
    "MUSIC_FORGE_BLUEPRINT_TYPE_KEY",
    "MUSIC_FORGE_LANE_BASE_XL",
    "MUSIC_FORGE_LANE_SFT_XL",
    "MUSIC_FORGE_LANE_TURBO_XL",
    "MUSIC_FORGE_LYRICS_TYPE_KEY",
    "MUSIC_FORGE_STYLE_TYPE_KEY",
    "MUSIC_FORGE_VERSION",
    "align_style_caption_to_vocal",
    "build_audio_input_data",
    "build_blueprint_messages",
    "build_content_metadata",
    "build_lyrics_messages",
    "build_style_capsule",
    "build_style_messages",
    "corpus_hints_for_prompt",
    "enrich_music_forge_lyrics_for_ace",
    "fallback_song_blueprint",
    "infer_music_forge_style_key",
    "lock_voice_enrich_lines_to_vocal",
    "music_forge_keyscale_for_style",
    "normalize_music_forge_input",
    "parse_song_blueprint",
    "resolve_music_forge_vocal",
    "select_music_forge_model_lane",
    "slim_ace_style_caption",
    "validate_and_repair_lyrics",
]
