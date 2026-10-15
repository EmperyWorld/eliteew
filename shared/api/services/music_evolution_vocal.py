# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Vocal resolution, Luna-style tag/lyrics enrichment, and stack-name leak stripping for Music Evolution.
# Invariants:
# - Luna preset: Vaporwave lo-fi psychedelic melancholy, C# minor, ~110–118 BPM, ~195s render target.
# - Empty [Intro] and numbered [Chorus 2/3] headers are stripped before Comfy (ACE section glitches).
# - Bare section headers (``Verse 1``) are braced before enrich; anchor soloists get ``(Arrangement:)`` / ``(Voice:)``.
# Related:
# - api/services/music_evolution_pipeline.py
# - api/services/music_evolution_prompts.py
# ---
"""Vocal profiles and Luna enrichment for Music Evolution XL Base."""

from __future__ import annotations

import hashlib
import re
from typing import Any

_SECTION_HEADER_RE = re.compile(
    r"^\s*\[(Intro|Verse(?:\s+\d+)?|Pre-Chorus|Chorus(?:\s+\d+)?|Bridge(?:\s+\d+)?|Outro|Hook)\]",
    re.I,
)

_VOICE_LINE_RE = re.compile(r"^\s*\(Voice:", re.I)
_ARRANGEMENT_LINE_RE = re.compile(r"^\s*\(Arrangement:", re.I)
_CHILDREN_CHOIR_LINE_RE = re.compile(r"^\s*\(Children choir:\s*([^)]*)\)\s*$", re.I)

_STACK_LEAK_RE = re.compile(
    r"\b(ACE\s+Step(?:\s+XL\s+Base|\s+1\.5)?|XL\s+Base|v2_base|v2_sft|Turbo|DiffRhythm|ComfyUI|UGS|Llama)\b",
    re.I,
)

_LUNA_KEYSCALE = "C# minor"
_LUNA_CHORD_LOOP = "C#m G# E B melancholic vaporwave chord loop"

_AUTO_VOCAL_BY_MOOD: dict[str, tuple[tuple[str, int], ...]] = {
    "romantic": (("female", 55), ("duet", 30), ("male", 15)),
    "warm": (("female", 50), ("duet", 30), ("male", 20)),
    "ironic": (("duet", 40), ("female", 35), ("male", 25)),
    "dark": (("female", 40), ("male", 35), ("duet", 25)),
    "epic": (("male", 40), ("female", 35), ("duet", 25)),
    "energetic": (("female", 45), ("male", 35), ("duet", 20)),
    "sad": (("female", 50), ("male", 30), ("duet", 20)),
    "calm": (("female", 45), ("duet", 35), ("male", 20)),
    "custom": (("female", 40), ("duet", 35), ("male", 25)),
}

_VOCAL_TAG_PROFILES: dict[str, tuple[str, ...]] = {
    "female": (
        "breathy close-mic vocal",
        "silky phrasing",
        "confessional vocal",
        "warm chest tone female",
        "soft mezzo lead",
    ),
    "male": (
        "warm baritone close-mic",
        "smoky male lead",
        "intimate tenor delivery",
        "grounded chest voice",
        "confessional male vocal",
    ),
    "duet": (
        "male and female duet call-and-response",
        "interwoven duet harmonies",
        "alternating male female leads",
        "intimate duet blend",
    ),
}

_LUNA_VOCAL_PROFILES: tuple[str, ...] = (
    "confessional vocal",
    "fragile melancholic vocal",
    "breathy close-mic vocal",
    "hypnotic breathy vocal",
    "wistful silky vocal",
    "seductive nocturnal vocal",
    "intoxicated dreamy vocal",
)

# Liked Comfy export (``луна похоже``): 90s nostalgic soulful pop, not pop uplift.
_LUNA_SECTION_VOICE: dict[str, str] = {
    "intro": "half-whisper, intimate close-mic, anticipatory breath, no belting",
    "verse": "psychedelic melancholic half-whisper, detached intimate murmur, spoken-sung phrasing",
    "pre-chorus": "aching psychedelic breath, airy close-mic murmur, chorus delay wash, no power belt",
    "chorus": "hypnotic melancholic mantra, wistful silk half-whisper, muted psychedelic tone, soft reverb",
    "bridge": "dreamy psychedelic trip-hop confession, fragile nocturnal drift, close and unforced",
    "outro": "fading whisper, melancholic neon haze, dissolving psychedelic nostalgia",
}

_LUNA_SECTION_ARRANGEMENT: dict[str, str] = {
    "intro": "Psychedelic pad swirl, detuned analog synth haze, tape hiss, filtered lo-fi drum machine, {bpm} BPM feel",
    "verse": "Melancholic psychedelic synth groove, detuned pads, light electronic beat, enveloping sub bass, {bpm} BPM",
    "pre-chorus": "Soft trip-hop drums, rising psychedelic synth haze, chorus/flanger wash, {bpm} BPM",
    "chorus": "Hypnotic melancholic mantra hook, detuned retro-disco shimmer, Gm Eb Bb F loop, {bpm} BPM",
    "bridge": "Downtempo psychedelic trip-hop break, melancholic drifting pads, Gm Eb Bb F chord loop, {bpm} BPM",
    "outro": "Tape-warm psychedelic synth fade, melancholic ambient tail, {bpm} BPM feel",
}


def _digest_index(seed: int, *parts: str, modulo: int) -> int:
    blob = f"{seed}|{'|'.join(parts)}".encode()
    return int(hashlib.sha1(blob).hexdigest()[:8], 16) % max(1, modulo)


def luna_evolution_bpm(*, mood: str, seed: int) -> int:
    """Dream vaporwave tempo from liked Luna studio exports (~110–118 BPM, center 115)."""
    base = 115
    mood_key = (mood or "warm").strip().lower()
    if mood_key in {"sad", "dark", "calm"}:
        base = 110
    elif mood_key in {"romantic", "custom"}:
        base = 118
    jitter = _digest_index(seed, "luna_bpm", modulo=5) - 2
    return max(108, min(120, base + jitter))


def resolve_evolution_vocal_slot(*, vocal: str, mood: str, seed: int) -> str:
    """Resolve UI ``auto`` to concrete ACE vocal slot with mood + seed variation."""
    key = (vocal or "auto").strip().lower()
    if key in {"female", "male", "duet"}:
        return key
    weights = _AUTO_VOCAL_BY_MOOD.get((mood or "warm").strip().lower(), _AUTO_VOCAL_BY_MOOD["warm"])
    total = sum(w for _, w in weights)
    pick = _digest_index(seed, "vocal", modulo=total)
    acc = 0
    for choice, weight in weights:
        acc += weight
        if pick < acc:
            return choice
    return weights[0][0]


def pick_evolution_vocal_tag_profile(*, vocal: str, seed: int, genre: str = "") -> str:
    """Seed-selected vocal-color tag; Luna uses melancholic/psychedelic pool only."""
    if (genre or "").strip().lower() == "luna":
        return _LUNA_VOCAL_PROFILES[_digest_index(seed, "luna_vocal_profile", modulo=len(_LUNA_VOCAL_PROFILES))]
    key = (vocal or "female").strip().lower()
    pool = _VOCAL_TAG_PROFILES.get(key, _VOCAL_TAG_PROFILES["female"])
    return pool[_digest_index(seed, "vocal_profile", modulo=len(pool))]


def strip_music_stack_leaks_from_lyrics(lyrics: str) -> str:
    """Remove model/stack names that LLM sometimes rhymes into sung lines."""
    out_lines: list[str] = []
    for line in (lyrics or "").splitlines():
        if _SECTION_HEADER_RE.match(line.strip()):
            out_lines.append(line.rstrip())
            continue
        cleaned = _STACK_LEAK_RE.sub("", line)
        cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
        if cleaned:
            out_lines.append(cleaned)
    return "\n".join(out_lines).strip()


def _section_kind(header: str) -> str:
    name = header.strip().lower()
    if name.startswith("[intro"):
        return "intro"
    if "pre-chorus" in name:
        return "pre-chorus"
    if name.startswith("[chorus"):
        return "chorus"
    if name.startswith("[bridge"):
        return "bridge"
    if name.startswith("[outro"):
        return "outro"
    return "verse"


def _line_is_meta(ln: str) -> bool:
    s = ln.strip()
    return bool(not s or _VOICE_LINE_RE.match(s) or _ARRANGEMENT_LINE_RE.match(s) or _SECTION_HEADER_RE.match(s))


def strip_luna_empty_intro_section(lyrics: str) -> str:
    """Drop [Intro] only when it has no sung lines and no (Arrangement:)/(Voice:) meta."""
    lines = (lyrics or "").splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        if re.match(r"^\[Intro\]", stripped, re.I):
            j = i + 1
            while j < len(lines) and not _SECTION_HEADER_RE.match(lines[j].strip()):
                j += 1
            block_body = lines[i + 1 : j]
            has_sung = any(not _line_is_meta(ln) for ln in block_body)
            has_meta = any(
                _ARRANGEMENT_LINE_RE.match(ln.strip()) or _VOICE_LINE_RE.match(ln.strip()) for ln in block_body
            )
            if not has_sung and not has_meta:
                i = j
                continue
        out.append(lines[i])
        i += 1
    return "\n".join(out).strip()


def strip_luna_intro_section(lyrics: str) -> str:
    """
    Hoist sung [Intro] lines into the first [Verse].
    Instrumental intro (only ``(Arrangement:)`` / ``(Voice:)`` or empty body) is kept for studio parity.
    """
    lines = (lyrics or "").splitlines()
    intro_sung: list[str] = []
    body: list[str] = []
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        if re.match(r"^\[Intro\]", stripped, re.I):
            j = i + 1
            intro_block: list[str] = []
            while j < len(lines) and not _SECTION_HEADER_RE.match(lines[j].strip()):
                intro_block.append(lines[j])
                ln = lines[j].strip()
                if ln and not _line_is_meta(ln):
                    intro_sung.append(ln)
                j += 1
            if intro_sung:
                i = j
                continue
            body.append(lines[i])
            body.extend(intro_block)
            i = j
            continue
        body.append(lines[i])
        i += 1
    if not intro_sung:
        return "\n".join(body).strip()
    out: list[str] = []
    merged = False
    for line in body:
        if not merged and re.match(r"^\[Verse", line.strip(), re.I):
            out.append(line)
            out.extend(intro_sung)
            merged = True
        else:
            out.append(line)
    if not merged:
        out = ["[Verse 1]", *intro_sung, *body]
    return "\n".join(out).strip()


def collapse_luna_numbered_chorus_headers(lyrics: str) -> str:
    """Numbered chorus headers re-trigger ACE sections (~1:06 glitch); keep one [Chorus] label."""
    return re.sub(r"\[Chorus\s+\d+\]", "[Chorus]", lyrics or "", flags=re.I)


def collapse_luna_excess_verses(lyrics: str, *, max_verses: int = 2) -> str:
    """Cap verse sections — long skeletons confuse XL Base pacing."""
    lines = (lyrics or "").splitlines()
    out: list[str] = []
    skipping = False
    for line in lines:
        stripped = line.strip()
        m = re.match(r"^\[Verse(?:\s+(\d+))?\]", stripped, re.I)
        if m:
            num = int(m.group(1) or "1")
            if num > max_verses:
                skipping = True
                continue
            skipping = False
        elif _SECTION_HEADER_RE.match(stripped):
            skipping = False
        if skipping:
            continue
        out.append(line)
    return "\n".join(out).strip()


def prepare_luna_evolution_lyrics(lyrics: str) -> str:
    """Luna lyrics structure guards before Comfy (intro vocal mute + mid-song section reset)."""
    text = strip_luna_intro_section(lyrics)
    text = collapse_luna_numbered_chorus_headers(text)
    text = collapse_luna_excess_verses(text, max_verses=2)
    return text.strip()


_ATYA_CHOIR_EN_LINES: tuple[str, ...] = (
    "(Children choir: higher than sky, wind tears)",
    "(Children choir: storm rise, thunder above)",
    "(Children choir: wind and storm, above us)",
)

_ATYA_ARRANGEMENT = {
    "intro": "Thunder pad, filtered trance pluck, distant children choir swell, storm riser, {bpm} BPM feel, instrumental only",
    "verse": "Rolling amen breakbeat, Reese bass, ghost snares, adult female lead, {bpm} BPM",
    "pre-chorus": "Snare ghosts, rising supersaw, storm build, distant children choir swell, {bpm} BPM",
    "chorus": "Hurricane DnB drop, massive sub bass, rolling DnB drums, adult female hook, background children choir short storm phrase, {bpm} BPM",
    "bridge": "Half-time storm break, choir texture layer, thunder hits, {bpm} BPM",
    "outro": "Breakbeat and pluck fade, choir echo tail, {bpm} BPM feel",
}
_ATYA_VOICE = {
    "intro": "no lead vocal, atmospheric storm pad only",
    "verse": "fragile adult lead, clear diction, detached storm tone, close-mic",
    "pre-chorus": "rising intensity, breath building, storm anticipation",
    "chorus": "powerful fragile hook, anthemic storm lead, clear articulation",
    "bridge": "intimate storm confession, dynamic contrast",
    "outro": "fading whisper, choir tail",
}


def prepare_atya_evolution_lyrics(lyrics: str) -> str:
    """Atya structure guards before Comfy (empty intro mute, chorus re-trigger, verse cap)."""
    text = strip_luna_intro_section(lyrics)
    text = collapse_luna_numbered_chorus_headers(text)
    text = collapse_luna_excess_verses(text, max_verses=2)
    return text.strip()


def prepare_anchor_evolution_lyrics_common(lyrics: str) -> str:
    """Shared ACE structure guards for anchor soloists (chorus re-trigger, verse cap, empty intro)."""
    text = collapse_luna_numbered_chorus_headers(lyrics)
    text = collapse_luna_excess_verses(text, max_verses=2)
    text = strip_luna_empty_intro_section(text)
    return text.strip()


def normalize_atya_children_choir_lines(lyrics: str, *, seed: int) -> str:
    """ACE background choir: short English storm phrase, distinct from adult hook (studio meta parity)."""
    lines = (lyrics or "").splitlines()
    out: list[str] = []
    choir_idx = 0
    for line in lines:
        if _CHILDREN_CHOIR_LINE_RE.match(line.strip()):
            phrase = _ATYA_CHOIR_EN_LINES[
                _digest_index(seed, "choir", str(choir_idx), modulo=len(_ATYA_CHOIR_EN_LINES))
            ]
            out.append(phrase)
            choir_idx += 1
            continue
        out.append(line)
    return "\n".join(out).strip()


def enrich_luna_lyrics_with_voice_lines(lyrics: str, *, vocal: str, seed: int, bpm: int) -> str:
    """
    Inject ``(Arrangement: …)`` + ``(Voice: …)`` like liked Luna XL Base Comfy exports.
    Replaces prior Voice/Arrangement meta lines so LLM cannot leave pop-uplift cues.
    """
    v = (vocal or "female").strip().lower()
    if v == "duet":
        voice_label = "duet (male and female)"
    elif v == "male":
        voice_label = "male"
    else:
        voice_label = "female"
    b = max(108, min(120, int(bpm)))
    lines = (lyrics or "").splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if _SECTION_HEADER_RE.match(stripped):
            out.append(line)
            kind = _section_kind(stripped)
            j = i + 1
            while j < len(lines) and not _SECTION_HEADER_RE.match(lines[j].strip()):
                j += 1
            block_body = lines[i + 1 : j]
            has_sung = any(ln.strip() and not _line_is_meta(ln) for ln in block_body)
            while i + 1 < len(lines) and (
                _VOICE_LINE_RE.match(lines[i + 1].strip()) or _ARRANGEMENT_LINE_RE.match(lines[i + 1].strip())
            ):
                i += 1
            arrangement = _LUNA_SECTION_ARRANGEMENT.get(kind, _LUNA_SECTION_ARRANGEMENT["verse"]).format(bpm=b)
            voice_mood = _LUNA_SECTION_VOICE.get(kind, _LUNA_SECTION_VOICE["verse"])
            voice_label_for_section = voice_label
            if kind == "intro" and not has_sung:
                voice_label_for_section = "instrumental"
                voice_mood = "no sung line, pad-only instrumental bed"
            else:
                alt = _digest_index(seed, kind, modulo=4)
                if alt == 1 and kind == "verse":
                    voice_mood = "confessional, fragile, hypnotic breath, subtle stereo width"
                elif alt == 2 and kind == "chorus":
                    voice_mood = "bittersweet, seductive ache, wistful silk, light reverb"
                elif alt == 3 and kind == "bridge":
                    voice_mood = "intoxicated dreamy, nocturnal temptation, light reverb"
            out.append(f"(Arrangement: {arrangement})")
            out.append(f"(Voice: {voice_label_for_section}, {voice_mood})")
        else:
            out.append(line)
        i += 1
    return "\n".join(out).strip()


def _generic_enrich_lyrics_with_profiles(
    lyrics: str,
    *,
    vocal: str,
    seed: int,
    bpm: int,
    section_voice: dict[str, str],
    section_arrangement: dict[str, str],
    bpm_clamp: tuple[int, int] = (60, 220),
) -> str:
    """Inject (Arrangement) + (Voice) meta lines per section for anchor soloists."""
    v = (vocal or "female").strip().lower()
    if v == "duet":
        voice_label = "duet (male and female)"
    elif v == "male":
        voice_label = "male"
    else:
        voice_label = "female"
    lo, hi = bpm_clamp
    b = max(lo, min(hi, int(bpm)))
    lines = (lyrics or "").splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if _SECTION_HEADER_RE.match(stripped):
            out.append(line)
            kind = _section_kind(stripped)
            while i + 1 < len(lines) and (
                _VOICE_LINE_RE.match(lines[i + 1].strip()) or _ARRANGEMENT_LINE_RE.match(lines[i + 1].strip())
            ):
                i += 1
            arrangement = section_arrangement.get(kind, section_arrangement.get("verse", "")).format(bpm=b)
            voice_mood = section_voice.get(kind, section_voice.get("verse", "clear close-mic vocal"))
            out.append(f"(Arrangement: {arrangement})")
            out.append(f"(Voice: {voice_label}, {voice_mood})")
        else:
            out.append(line)
        i += 1
    return "\n".join(out).strip()


_VERA_ARRANGEMENT = {
    "intro": "Piano intro, soft strings pad, {bpm} BPM feel, warm room",
    "verse": "Piano ballad, light strings, {bpm} BPM, intimate room",
    "pre-chorus": "Strings swell, soft drums brush, {bpm} BPM",
    "chorus": "Full strings, piano chords, {bpm} BPM, emotional lift",
    "bridge": "Solo piano, reduced strings, {bpm} BPM",
    "outro": "Piano fade, string tail, {bpm} BPM feel",
}
_VERA_VOICE = {
    "intro": "warm mezzo, close-mic, confessional, soft reverb",
    "verse": "warm mezzo, storytelling, natural articulation",
    "pre-chorus": "rising emotion, controlled breath, silky tone",
    "chorus": "powerful mezzo belt, bittersweet, clear diction",
    "bridge": "vulnerable, hushed, intimate",
    "outro": "fading whisper, tender resolve",
}

_NIKA_ARRANGEMENT = {
    "intro": "Synth pad, filtered kick, {bpm} BPM feel, modern pop",
    "verse": "Alt-pop groove, synth bass, {bpm} BPM, tight drums",
    "pre-chorus": "Build synth layers, sidechain pulse, {bpm} BPM",
    "chorus": "Wide synth hook, punchy kick, {bpm} BPM, bright top",
    "bridge": "Stripped beat, vocal focus, {bpm} BPM",
    "outro": "Filter sweep fade, {bpm} BPM feel",
}
_NIKA_VOICE = {
    "intro": "airy, anticipatory, clean top",
    "verse": "grounded, crisp diction, subtle width",
    "pre-chorus": "rising energy, bright intimate tone",
    "chorus": "anthemic belt, hook-forward, light reverb",
    "bridge": "confessional, close-mic, dynamic contrast",
    "outro": "soft landing, breathy tail",
}

_YANA_ARRANGEMENT = {
    "intro": "Fingerpicked guitar, room ambience, {bpm} BPM feel",
    "verse": "Acoustic guitar, light percussion, {bpm} BPM, warm room",
    "pre-chorus": "Added harmonics, soft shaker, {bpm} BPM",
    "chorus": "Strings pad, fuller guitar, {bpm} BPM, singable hook",
    "bridge": "Guitar solo interlude, {bpm} BPM",
    "outro": "Guitar fade, natural tail, {bpm} BPM feel",
}
_YANA_VOICE = {
    "intro": "warm storyteller, close-mic folk",
    "verse": "narrative, gentle vibrato, natural room",
    "pre-chorus": "hopeful lift, airy head voice",
    "chorus": "singable hook, warm chest, light reverb",
    "bridge": "reflective, intimate, soft dynamics",
    "outro": "whispered resolve, dissolving reverb",
}

_AURORA_ARRANGEMENT = {
    "intro": "Cinematic pad, piano motif, {bpm} BPM feel, wide stereo",
    "verse": "Orchestral pop bed, steady pulse, {bpm} BPM, duet space",
    "pre-chorus": "Rising strings, tom build, {bpm} BPM",
    "chorus": "Full cinematic stack, {bpm} BPM, anthemic duet hook",
    "bridge": "Stripped piano duet, {bpm} BPM, emotional peak",
    "outro": "Orchestral fade, {bpm} BPM feel, unified harmony",
}
_AURORA_VOICE = {
    "intro": "duet (male and female), hushed, cinematic anticipation",
    "verse": "duet call-and-response, male baritone and female mezzo, intimate",
    "pre-chorus": "interwoven harmonies, rising tension",
    "chorus": "powerful duet blend, male and female unison hook, wide reverb",
    "bridge": "trading lines, emotional dialogue, close then wide",
    "outro": "harmonized fade, tender unison",
}

_ROOK_ARRANGEMENT = {
    "intro": "Drum count-in, muted guitar, {bpm} BPM feel",
    "verse": "Live drums, rhythm guitar, {bpm} BPM, rock groove",
    "pre-chorus": "Building guitars, driving bass, {bpm} BPM",
    "chorus": "Full band stack, {bpm} BPM, anthemic rock hook",
    "bridge": "Stripped drums, lead guitar, {bpm} BPM",
    "outro": "Band fade, {bpm} BPM feel",
}
_ROOK_VOICE = {
    "intro": "anticipatory, baritone hum",
    "verse": "baritone, grounded chest, live room",
    "pre-chorus": "rising drive, gritty but clear",
    "chorus": "baritone belt, anthemic, no scream",
    "bridge": "raw confessional, controlled grit",
    "outro": "baritone fade, band tail",
}


def enrich_evolution_lyrics_with_voice_lines(
    lyrics: str,
    *,
    soloist_id: str,
    vocal: str,
    seed: int,
    bpm: int,
    structure_prepare: bool = True,
    bpm_clamp_override: tuple[int, int] | None = None,
) -> str:
    """Per-soloist (Voice:) / (Arrangement:) enrichment for XL Base vocal clarity.

    ``bpm_clamp_override`` locks Arrangement BPM (MusicForge: match style_capsule / tags).
    """
    from api.routers.music_lyrics_validation import brace_bare_section_headers_for_ace
    from api.services.music_evolution_soloists import resolve_soloist_id

    def _clamp(default: tuple[int, int]) -> tuple[int, int]:
        return bpm_clamp_override if bpm_clamp_override is not None else default

    lyrics = brace_bare_section_headers_for_ace(lyrics)
    sid = resolve_soloist_id(soloist_id)
    if structure_prepare:
        if sid == "nebula":
            lyrics = prepare_luna_evolution_lyrics(lyrics)
        elif sid == "tempest":
            lyrics = prepare_atya_evolution_lyrics(lyrics)
        else:
            lyrics = prepare_anchor_evolution_lyrics_common(lyrics)
    if sid == "nebula":
        return enrich_luna_lyrics_with_voice_lines(lyrics, vocal=vocal, seed=seed, bpm=bpm)
    if sid == "tempest":
        lyrics = normalize_atya_children_choir_lines(lyrics, seed=seed)
        return _generic_enrich_lyrics_with_profiles(
            lyrics,
            vocal=vocal,
            seed=seed,
            bpm=bpm,
            section_voice=_ATYA_VOICE,
            section_arrangement=_ATYA_ARRANGEMENT,
            bpm_clamp=_clamp((168, 176)),
        )
    prepared = lyrics
    if sid == "velvet":
        return _generic_enrich_lyrics_with_profiles(
            prepared,
            vocal=vocal,
            seed=seed,
            bpm=bpm,
            section_voice=_VERA_VOICE,
            section_arrangement=_VERA_ARRANGEMENT,
            bpm_clamp=_clamp((108, 116)),
        )
    if sid == "ray":
        return _generic_enrich_lyrics_with_profiles(
            prepared,
            vocal=vocal,
            seed=seed,
            bpm=bpm,
            section_voice=_NIKA_VOICE,
            section_arrangement=_NIKA_ARRANGEMENT,
            bpm_clamp=_clamp((114, 122)),
        )
    if sid == "haze":
        return _generic_enrich_lyrics_with_profiles(
            prepared,
            vocal=vocal,
            seed=seed,
            bpm=bpm,
            section_voice=_YANA_VOICE,
            section_arrangement=_YANA_ARRANGEMENT,
            bpm_clamp=_clamp((78, 86)),
        )
    if sid == "ritm":
        return _generic_enrich_lyrics_with_profiles(
            prepared,
            vocal="female",
            seed=seed,
            bpm=bpm,
            section_voice={
                "verse": "diva, rhythmic phrasing, club groove",
                "chorus": "house belt, powerful top, sidechain feel",
                "bridge": "breakdown vocal, filtered tone",
            },
            section_arrangement={
                "verse": "Four-on-the-floor groove, piano stabs, {bpm} BPM",
                "chorus": "Full house drop, open hats, {bpm} BPM",
                "bridge": "Breakdown pads, {bpm} BPM",
            },
            bpm_clamp=_clamp((124, 130)),
        )
    if sid == "grit":
        return _generic_enrich_lyrics_with_profiles(
            prepared,
            vocal=vocal,
            seed=seed,
            bpm=bpm,
            section_voice=_ROOK_VOICE,
            section_arrangement=_ROOK_ARRANGEMENT,
            bpm_clamp=_clamp((140, 148)),
        )
    if sid == "pulse":
        return _generic_enrich_lyrics_with_profiles(
            prepared,
            vocal=vocal,
            seed=seed,
            bpm=bpm,
            section_voice={
                "verse": "focused female, dry techno delivery",
                "chorus": "hypnotic female hook, warehouse energy",
            },
            section_arrangement={
                "verse": "Rolling acid bass, metallic percussion, {bpm} BPM",
                "chorus": "Full four-on-the-floor, sidechain pump, {bpm} BPM",
                "bridge": "Filtered kick strip, {bpm} BPM",
            },
            bpm_clamp=_clamp((126, 132)),
        )
    if sid in {"nova", "ascent"}:
        return _generic_enrich_lyrics_with_profiles(
            prepared,
            vocal=vocal,
            seed=seed,
            bpm=bpm,
            section_voice=_NIKA_VOICE,
            section_arrangement=_NIKA_ARRANGEMENT,
            bpm_clamp=_clamp((124, 142)),
        )
    return prepared


_ACE_STYLE_SECTION_TAG_RE = re.compile(
    r"\[(intro|verse(?:\s+\d+)?|pre-chorus(?:\s+\d+)?|pre\s+chorus(?:\s+\d+)?|"
    r"chorus(?:\s+\d+)?|bridge(?:\s+\d+)?|outro|build up|drop|breakdown)\]",
    re.I,
)


def _capitalize_ace_style_section_label(raw: str) -> str:
    s = re.sub(r"\s+", " ", (raw or "").strip())
    low = re.sub(r"\bpre\s+chorus\b", "pre-chorus", s.lower())
    if low == "build up":
        return "Build Up"
    exact = {"intro": "Intro", "outro": "Outro", "bridge": "Bridge", "drop": "Drop", "breakdown": "Breakdown"}
    if low in exact:
        return exact[low]
    m = re.match(r"^(verse|chorus|bridge|pre-chorus)\s*(\d+)?$", low)
    if m:
        base_map = {"verse": "Verse", "chorus": "Chorus", "bridge": "Bridge", "pre-chorus": "Pre-Chorus"}
        base = base_map[m.group(1)]
        num = m.group(2)
        return f"{base} {num}" if num else base
    return s.title()


_SOLOIST_SECTION_ARRANGEMENT: dict[str, dict[str, str]] = {
    "nebula": _LUNA_SECTION_ARRANGEMENT,
    "tempest": _AURORA_ARRANGEMENT,
    "velvet": _VERA_ARRANGEMENT,
    "ray": _NIKA_ARRANGEMENT,
    "haze": _YANA_ARRANGEMENT,
    "grit": _ROOK_ARRANGEMENT,
    "ritm": {
        "intro": "Filtered house kick build, {bpm} BPM feel",
        "verse": "House groove, piano stabs, {bpm} BPM",
        "pre-chorus": "Rising synth layers, {bpm} BPM",
        "chorus": "Full house drop, open hats, {bpm} BPM",
        "bridge": "Breakdown pads, {bpm} BPM",
        "outro": "Kick tail fade, {bpm} BPM feel",
    },
    "pulse": {
        "intro": "Filtered noise, tension riser, {bpm} BPM feel",
        "verse": "Rolling acid bass, metallic percussion, {bpm} BPM",
        "pre-chorus": "Rising filter sweep, {bpm} BPM",
        "chorus": "Full four-on-the-floor, sidechain pump, {bpm} BPM",
        "bridge": "Stripped kick, echo claps, {bpm} BPM",
        "outro": "Filter sweep fade, {bpm} BPM feel",
    },
    "nova": _NIKA_ARRANGEMENT,
    "ascent": _NIKA_ARRANGEMENT,
}


def evolution_section_arrangement_hint(*, soloist_id: str, kind: str, bpm: int) -> str:
    """Default English production hint for a section kind (Evolution tags sync fallback)."""
    from api.services.music_evolution_soloists import resolve_soloist_id

    sid = resolve_soloist_id(soloist_id)
    profile = _SOLOIST_SECTION_ARRANGEMENT.get(sid, _LUNA_SECTION_ARRANGEMENT)
    tpl = profile.get(kind) or profile.get("verse") or "clear mix, {bpm} BPM"
    b = max(60, min(220, int(bpm)))
    return tpl.format(bpm=b)


def capitalize_ace_section_tags_in_style(tags: str) -> str:
    """Evolution XL Base: section markers in tags use ``[Intro]`` / ``[Verse]`` (studio operator contract)."""

    def repl(m: re.Match[str]) -> str:
        return f"[{_capitalize_ace_style_section_label(m.group(1))}]"

    return _ACE_STYLE_SECTION_TAG_RE.sub(repl, tags or "")


def luna_reference_tag_block(*, bpm: int, vocal: str, vocal_profile: str) -> str:
    """Nebula/Luna anchor: vaporwave psychedelic melancholy, C# minor loop (liked studio exports)."""
    v = (vocal or "female").strip().lower()
    lead = f"{v} vocal" if v != "duet" else "male and female duet vocals"
    b = max(108, min(120, int(bpm)))
    return (
        f"Style: Vaporwave lo-fi house psychedelic melancholy Nebula, 90s nostalgic soulful pop, Russian dream trip-hop. "
        f"{b} BPM, {lead}, {_LUNA_KEYSCALE}, {_LUNA_CHORD_LOOP}, {vocal_profile}, vaporwave synth haze, "
        "detuned analog synth haze, chorus/flanger wash, nostalgic analog synths, lo-fi tape saturation, "
        "analog drum machine, enveloping sub bass, nocturnal hypnotic drift, wistful confessional vocal, "
        "intimate close-mic half-whisper, naive hypnotic mantra phrasing, hazy lo-fi mix, "
        "no scream, no howl, no aggressive lead, no festival EDM, no bright radio pop, no mainstream pop hook, "
        "no sterile polished mix, no cheerful uplifting pop, no generic commercial production, no power belting. "
        f"[Intro] psychedelic pad swirl, detuned synth haze, tape hiss, filtered lo-fi drum machine, {b} BPM feel. "
        f"[Verse] melancholic psychedelic synth groove, detuned pads, enveloping sub bass, {b} BPM, "
        "close-mic melancholic half-whisper. "
        f"[Pre-Chorus] soft trip-hop drums, rising psychedelic synth haze, chorus/flanger wash, {b} BPM, "
        "sleepy intimate breath. "
        f"[Chorus] hypnotic melancholic mantra hook, detuned retro-disco shimmer, {b} BPM, wistful muted vocal, "
        f"{_LUNA_CHORD_LOOP}. "
        f"[Bridge] downtempo psychedelic trip-hop break, melancholic drifting pads, {_LUNA_CHORD_LOOP}, "
        f"nocturnal freedom, {b} BPM. "
        f"[Outro] tape-warm psychedelic synth fade, melancholic ambient tail, {b} BPM feel, dissolving reverb"
    )


def _strip_luna_duplicate_chorus_tag_sections(tags: str) -> str:
    text = re.sub(r"\[chorus\s+\d+\]", "[Chorus]", tags or "", flags=re.I)
    text = re.sub(r"\[verse\s+\d+\]", "[Verse]", text, flags=re.I)
    return capitalize_ace_section_tags_in_style(text)


def finalize_luna_evolution_tags(tags: str, *, bpm: int, vocal: str, vocal_profile: str) -> str:
    """Luna tags: operator anchor wins; strip duplicate section tags that cause mid-song resets."""
    from api.routers.music_generator_tag_finalize import soften_luna_ace_tags

    anchor = luna_reference_tag_block(bpm=bpm, vocal=vocal, vocal_profile=vocal_profile)
    merged = anchor
    merged = _strip_luna_duplicate_chorus_tag_sections(merged)
    merged = soften_luna_ace_tags(merged)
    return merged


def enrich_evolution_vocal_tags(tags: str, *, vocal: str, vocal_profile: str, genre: str) -> str:
    """Append seed-selected vocal color for non-Luna genres."""
    if (genre or "").strip().lower() == "luna":
        return tags
    v = (vocal or "female").strip().lower()
    text = (tags or "").strip()
    low = text.lower()
    if vocal_profile.lower() in low:
        return text
    if v not in low and v != "duet":
        text = f"{v} vocal, {text}" if text else f"{v} vocal"
    if "clear vocal" not in low and "close-mic" not in low:
        text = f"{text}, {vocal_profile}, clear vocal".strip(", ")
    return text


def evolution_production_overrides(
    *,
    genre: str,
    mood: str,
    seed: int,
    stable_seed: int | None = None,
) -> dict[str, Any]:
    """Genre-specific sampler overrides (Luna liked-recipe corridor)."""
    if (genre or "").strip().lower() != "luna":
        return {}
    bpm_seed = stable_seed if stable_seed is not None else seed
    return {
        "bpm": luna_evolution_bpm(mood=mood, seed=bpm_seed),
        "temperature": 0.7,
        "cfg_scale": 1.75,
        "top_p": 0.86,
        "keyscale": _LUNA_KEYSCALE,
    }


def evolution_stable_seed(*, run_id: str, theme: str) -> int:
    """Deterministic seed slice for vocal slot/profile variation within one run."""
    return int(hashlib.sha1(f"{run_id}:{theme}".encode()).hexdigest()[:12], 16)
