# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared recipe feature extraction for Music Evolution corpus, audit, and feedback.
# Invariants:
# - Full lyrics/tags are never copied into LLM prompts — only counts and short hints.
# - Music Evolution golden lanes are accepted; unrelated Turbo/V3 tracks without Evolution metadata are excluded.
# Related:
# - api/services/music_evolution_corpus.py
# - api/scripts/music_evolution_xl_base_corpus_audit.py
# ---
"""Recipe metadata features for Music Evolution."""

from __future__ import annotations

import re
from typing import Any

from api.services.music_generator_xl_base_pipeline import count_sung_content_lines

_SECTION_HEADER_RE = re.compile(r"^\s*\[(Intro|Verse|Chorus|Bridge|Outro|Pre-Chorus)", re.I | re.M)
_VOICE_ANNOTATION_RE = re.compile(r"^\s*\(Voice:", re.I | re.M)
_ARRANGEMENT_ANNOTATION_RE = re.compile(r"^\s*\(Arrangement:", re.I | re.M)


def _md_str(metadata: dict[str, Any], *keys: str, default: str = "") -> str:
    for key in keys:
        value = metadata.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return default


def is_xl_base_recipe_metadata(metadata: dict[str, Any] | None) -> bool:
    """True when unified_content metadata is from a Music Evolution or compatible XL render."""
    md = metadata if isinstance(metadata, dict) else {}
    workflow = _md_str(md, "ugs_workflow", "ace_workflow").lower()
    if workflow == "v2_base":
        return True
    billing = _md_str(md, "music_generator_billing_mode", "billing_mode").lower()
    if billing in {"evolution_xl_base", "xl_base", "music_forge_xl_base", "music_forge_xl_turbo"}:
        return True
    if md.get("music_forge_run_id"):
        model_scope = _md_str(md, "music_generator_model_scope", "model_scope").lower()
        return model_scope in {"xl_base", "xl_turbo"}
    if md.get("music_evolution_run_id"):
        return True
    model_scope = _md_str(md, "music_generator_model_scope", "model_scope").lower()
    return model_scope in {"xl_base_only", "xl_base", "xl_sft", "xl_sft_lora", "xl_turbo"}


def _avg_words_per_line(lyrics: str) -> float:
    sung_lines: list[str] = []
    for line in (lyrics or "").splitlines():
        s = line.strip()
        if not s or s.startswith("[") or s.startswith("("):
            continue
        if len(s) >= 3:
            sung_lines.append(s)
    if not sung_lines:
        return 0.0
    total_words = sum(len(re.findall(r"\S+", ln)) for ln in sung_lines)
    return round(total_words / len(sung_lines), 2)


def recipe_features_from_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    """Extract stable music-generator features from a unified_content metadata snapshot."""
    from api.services.music_evolution_soloists import resolve_soloist_id

    md = metadata if isinstance(metadata, dict) else {}
    lyrics = _md_str(md, "music_generator_lyrics", "lyrics")
    tags = _md_str(md, "music_generator_tags", "tags")
    language = _md_str(md, "music_generator_language", "language", default="ru")
    sung_total, sung_cyr = count_sung_content_lines(lyrics, language=language)
    soloist_raw = _md_str(md, "music_evolution_soloist", "soloist")
    return {
        "style": _md_str(md, "music_generator_style", "style", default="pop").lower(),
        "soloist": resolve_soloist_id(soloist_raw) if soloist_raw else "",
        "vocal": _md_str(md, "music_generator_vocal", "vocal", default="auto"),
        "language": language,
        "bpm": md.get("music_generator_bpm", md.get("bpm")),
        "duration_seconds": md.get("music_generator_duration_seconds", md.get("duration_seconds")),
        "lyrics_preview": lyrics[:700],
        "tags_preview": tags[:700],
        "sung_line_count": sung_total,
        "cyrillic_line_count": sung_cyr,
        "section_count": len(_SECTION_HEADER_RE.findall(lyrics)),
        "avg_words_per_line": _avg_words_per_line(lyrics),
        "has_voice_annotations": bool(_VOICE_ANNOTATION_RE.search(lyrics)),
        "has_arrangement_annotations": bool(_ARRANGEMENT_ANNOTATION_RE.search(lyrics)),
        "tags_has_female_vocal": "female vocal" in tags.lower(),
        "tags_has_male_vocal": "male vocal" in tags.lower(),
        "tags_has_duet_vocal": "duet" in tags.lower() and "vocal" in tags.lower(),
        "is_xl_base": is_xl_base_recipe_metadata(md),
        "is_short_skeleton": sung_total < 8,
        "is_low_cyrillic": language.startswith("ru") and sung_cyr < 6,
    }


def corpus_quality_summary(items: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate positive corpus items for structured LLM hints (no verbatim lyrics)."""
    positive = [item for item in items if isinstance(item, dict) and int(item.get("quality_signal") or 0) > 0]
    if not positive:
        return {}
    sung_counts = [int(item.get("sung_line_count") or 0) for item in positive if item.get("sung_line_count")]
    durations = [
        int(item.get("duration_seconds") or 0)
        for item in positive
        if item.get("duration_seconds") and int(item.get("duration_seconds") or 0) > 0
    ]
    styles: list[str] = []
    vocals: list[str] = []
    for item in positive[:5]:
        style = str(item.get("style") or "").strip()
        vocal = str(item.get("vocal") or "").strip()
        if style:
            styles.append(style)
        if vocal:
            vocals.append(vocal)
    summary: dict[str, Any] = {
        "liked_count": len(positive),
        "median_sung_lines": sorted(sung_counts)[len(sung_counts) // 2] if sung_counts else None,
        "median_duration_seconds": sorted(durations)[len(durations) // 2] if durations else None,
        "common_styles": list(dict.fromkeys(styles))[:3],
        "common_vocals": list(dict.fromkeys(vocals))[:3],
    }
    return summary
