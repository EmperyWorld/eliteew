# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MusicForge lyrics enrichment for ACE and validation/repair gate before render.
# Invariants:
# - Generated lyrics must be sung text with ACE section markers, not JSON or production notes.
# - Arrangement BPM lock must match style_capsule (no soloist clamp override).
# - ``(Voice: …)`` lines must match resolved lead vocal gender (no male+female mush).
# Related:
# - api/services/music_forge/algorithm/style.py
# - api/services/music_forge/algorithm/lyrics_craft.py
# - api/routers/music_lyrics_validation.py
# ---

from __future__ import annotations

import re
from typing import Any

from api.routers.music_lyrics_validation import sanitize_lyrics_ai_output
from api.services.music_forge.algorithm.constants import (
    _CONSONANT_RE,
    _SECTION_RE,
    _VOWEL_OR_MOAN_RE,
)
from api.services.music_forge.algorithm.lyrics_craft import scan_forge_lyrics_craft
from api.services.music_forge.algorithm.style import (
    forge_voice_and_arrangement_profiles,
    lock_voice_enrich_lines_to_vocal,
    music_forge_soloist_for_render,
)
from api.utils.llm_json_extract import strip_llm_thinking_prefix


def enrich_music_forge_lyrics_for_ace(
    lyrics: str,
    *,
    vocal: str,
    style_key: str,
    bpm: int,
    seed: int,
    structure_prepare: bool = True,
) -> str:
    """Inject (Voice:)/(Arrangement:) lines aligned to genre — not conflicting Evolution folk defaults."""
    from api.routers.music_lyrics_validation import brace_bare_section_headers_for_ace
    from api.services.music_evolution_vocal import (
        _generic_enrich_lyrics_with_profiles,
        enrich_evolution_lyrics_with_voice_lines,
        prepare_anchor_evolution_lyrics_common,
    )

    v = vocal if vocal in {"male", "female", "duet"} else "female"
    sk = (style_key or "pop").strip().lower()
    bpm_i = max(10, min(300, int(bpm)))
    # Lock Arrangement BPM to the resolved style_capsule value (caption / Comfy field).
    # Soloist genre clamps (e.g. grit 140–148) must not rewrite a 115 BPM cinematic pop track.
    bpm_lock = (bpm_i, bpm_i)
    soloist = music_forge_soloist_for_render(vocal=v, style_key=sk)
    if soloist:
        enriched = enrich_evolution_lyrics_with_voice_lines(
            lyrics,
            soloist_id=soloist,
            vocal=v,
            seed=seed,
            bpm=bpm_i,
            structure_prepare=structure_prepare,
            bpm_clamp_override=bpm_lock,
        )
        return lock_voice_enrich_lines_to_vocal(enriched, v)

    text = brace_bare_section_headers_for_ace(lyrics or "")
    if structure_prepare:
        text = prepare_anchor_evolution_lyrics_common(text)
    voice, arr = forge_voice_and_arrangement_profiles(sk)
    enriched = _generic_enrich_lyrics_with_profiles(
        text,
        vocal=v,
        seed=seed,
        bpm=bpm_i,
        section_voice=voice,
        section_arrangement=arr,
        bpm_clamp=bpm_lock,
    )
    return lock_voice_enrich_lines_to_vocal(enriched, v)


def _drop_wordless_vocalization_lines(lyrics: str) -> str:
    """Remove standalone moan/adlib lines before the ACE text encoder sees them."""
    cleaned: list[str] = []
    for line in lyrics.splitlines():
        stripped = line.strip()
        if not stripped or _SECTION_RE.match(stripped):
            cleaned.append(line)
            continue
        lowered = stripped.lower()
        compact = re.sub(r"[\s\-—~.,!?'’\"`]+", "", lowered)
        if len(compact) <= 28 and _VOWEL_OR_MOAN_RE.search(compact) and not _CONSONANT_RE.search(compact):
            continue
        if re.fullmatch(r"(?:o+h+|a+h+|a+h+a+|u+h+|m+h+|yeah|yea|о+|а+|у+|э+|м+)+", compact, re.I):
            continue
        cleaned.append(line)
    return "\n".join(cleaned).strip()


def validate_and_repair_lyrics(raw_text: str, intent: dict[str, Any], blueprint: dict[str, Any]) -> dict[str, Any]:
    """Sanitize lyrics and return validation errors for the pipeline gate."""
    lyrics = sanitize_lyrics_ai_output(strip_llm_thinking_prefix(raw_text or ""))
    lyrics = re.sub(r"```(?:\w+)?", "", lyrics).replace("```", "").strip()
    lyrics = re.sub(r"(?im)^\s*(title|lyrics|song)\s*:\s*", "", lyrics).strip()
    before_adlib_drop = lyrics
    lyrics = _drop_wordless_vocalization_lines(lyrics)
    lyrics_head = lyrics.lstrip()
    errors: list[str] = []
    if not lyrics:
        errors.append("empty_lyrics")
    if lyrics != before_adlib_drop:
        errors.append("removed_wordless_vocalizations")
    if lyrics_head.startswith("{") or (lyrics_head.startswith("[") and not _SECTION_RE.match(lyrics_head)):
        errors.append("json_leak")
    if not _SECTION_RE.search(lyrics):
        errors.append("missing_sections")
        lyrics = f"[Verse]\n{lyrics}\n\n[Chorus]\n{blueprint.get('hook') or intent.get('idea')}"
    hook = str(blueprint.get("hook") or "").strip()
    if hook and hook.lower() not in lyrics.lower():
        errors.append("missing_hook")
        lyrics = lyrics.rstrip() + f"\n\n[Chorus]\n{hook}\n{hook}"
    if any(token in lyrics.lower() for token in ("comfyui", "sampler", "workflow", "lora", "json")):
        errors.append("stack_leak")
    errors.extend(scan_forge_lyrics_craft(lyrics, intent, blueprint=blueprint))
    return {"lyrics": lyrics.strip(), "errors": errors}
