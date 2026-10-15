# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for Evolution tags ↔ lyrics section mirror (numbered verses, pre-chorus).
# Invariants:
# - Tags section labels and order must match lyrics headers exactly.
# Related:
# - api/services/music_evolution_tags_sync.py
# ---

from __future__ import annotations

from api.services.music_evolution_tags_sync import (
    evolution_tags_section_labels,
    sync_evolution_tags_sections_to_lyrics,
)


def test_sync_tags_mirrors_numbered_verses_and_pre_chorus() -> None:
    lyrics = """[Intro]
(Arrangement: soft pad fade-in, 90 BPM feel)
Hmm

[Verse 1]
(Arrangement: lo-fi house groove, 90 BPM)
Первая строка

[Pre-Chorus]
(Arrangement: soft drums swell, 90 BPM)
Нарастание

[Chorus]
(Arrangement: indie-pop synth hook, 90 BPM)
Припев

[Verse 2]
(Arrangement: lo-fi groove return, 90 BPM)
Вторая строка

[Chorus]
Припев снова
"""
    tags = (
        "Style: Lo-fi house indie-pop. 90 BPM, female vocal, C# minor. "
        "[Intro] soft pad fade-in. [Verse] lo-fi groove. [Chorus] synth hook. [Outro] fade"
    )
    out = sync_evolution_tags_sections_to_lyrics(tags, lyrics, soloist_id="lula", bpm=90)
    labels = evolution_tags_section_labels(out)
    assert labels == ["Intro", "Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Chorus"]
    assert "[Verse 1]" in out
    assert "[Verse 2]" in out
    assert "[Pre-Chorus]" in out
    assert "soft drums swell" in out.lower() or "soft drums" in out.lower()
    assert "[Verse]" not in out.replace("[Verse 1]", "").replace("[Verse 2]", "")


def test_sync_tags_lula_collapses_numbered_chorus_labels() -> None:
    lyrics = """[Verse 1]
(Arrangement: Melancholic psychedelic synth groove, 89 BPM)
Line

[Chorus]
(Arrangement: Hypnotic melancholic mantra hook, 89 BPM)
Hook

[Bridge]
(Arrangement: Downtempo trip-hop break, 89 BPM)
Bridge line

[Chorus 2]
(Arrangement: Hypnotic melancholic mantra hook, 89 BPM)
Hook again
"""
    tags = "Style: Vaporwave lo-fi house psychedelic melancholy Lula. 89 BPM, female vocal. [Intro] pad. [Chorus] hook"
    out = sync_evolution_tags_sections_to_lyrics(tags, lyrics, soloist_id="lula", bpm=89)
    labels = evolution_tags_section_labels(out)
    assert labels == ["Verse 1", "Chorus", "Bridge", "Chorus"]
    assert "[Chorus 2]" not in out


def test_sync_tags_uses_lyrics_arrangement_hints() -> None:
    lyrics = """[Verse 1: Storm kick build, 172 BPM]
Line

[Chorus: Wide supersaw stack, 172 BPM]
Hook
"""
    tags = "Style: Storm EDM. 172 BPM, female vocal. [Verse] generic. [Chorus] generic"
    out = sync_evolution_tags_sections_to_lyrics(tags, lyrics, soloist_id="atya", bpm=172)
    assert "Storm kick build" in out
    assert "Wide supersaw stack" in out
    assert evolution_tags_section_labels(out) == ["Verse 1", "Chorus"]
