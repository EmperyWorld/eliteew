# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/music_generator_promo.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""Promo voiceover helpers for the music generator.

The promo flow feeds short ad copy into the ACE music workflow.  It needs a
stricter and less song-like contract than regular lyrics.
"""

from __future__ import annotations

import ast
import json
import math
import re
from collections.abc import Mapping
from typing import Any

from api.routers.music_lyrics_validation import sanitize_lyrics_ai_output

_JSON_LYRICS_FIELD_RE = re.compile(
    r"""["']lyrics["']\s*:\s*(?P<quote>["'])(?P<body>[\s\S]*?)(?P=quote)\s*(?:,\s*["']tags["']|\}\s*$)""",
    re.IGNORECASE,
)
_JSON_TAGS_TAIL_RE = re.compile(r""",\s*["']tags["']\s*:\s*["'][\s\S]*$""", re.IGNORECASE)
_SECTION_LINE_RE = re.compile(r"^\s*\[(?P<section>[^\]\n]{1,80})]\s*(?P<rest>.*)$")
_INLINE_PARENTHESES_RE = re.compile(
    r"^(?P<header>\[[^\]\n]{1,80}])\s+(?P<hint>\((?:Arrangement|Voice|Vocal):[^)]{1,220}\))\s*(?P<rest>.*)$",
    re.IGNORECASE,
)
_LATIN_PROMO_PARENTHESES_RE = re.compile(r"^\((?:Arrangement|Voice|Vocal):[^)]{1,220}\)$", re.IGNORECASE)
_PROMO_SPOKEN_WORD_RE = re.compile(r"[A-Za-zА-Яа-яЁё0-9]+(?:[-'’][A-Za-zА-Яа-яЁё0-9]+)?")


_PROMO_PRESET_DIRECTOR_DEFAULTS: dict[str, dict[str, Any]] = {
    "pirate_radio": {
        "tempo_intensity": 7,
        "rhythm_intensity": 8,
        "genre_bias": 8,
        "voice_strength": 8,
        "bed_level": 5,
        "stinger_intensity": 8,
        "drama_contrast": 7,
        "clarity": 7,
        "genre_line": "pirate radio, grimey talkdown, dark lo-fi bumper",
        "rhythm_line": "punchy stop-start rhythm, hard pauses before insults and CTA",
        "bed_line": "lo-fi air band, tape hiss, vinyl grit, foghorn, short brass stabs",
    },
    "trailer_epic": {
        "tempo_intensity": 5,
        "rhythm_intensity": 6,
        "genre_bias": 9,
        "voice_strength": 9,
        "bed_level": 7,
        "stinger_intensity": 9,
        "drama_contrast": 10,
        "clarity": 8,
        "genre_line": "cinematic trailer, braams, dark orchestral pulses",
        "rhythm_line": "slow threat, impact gaps, escalation in three steps",
        "bed_line": "sub drops, reverse cymbals, braam hits, low strings, trailer risers",
    },
    "tv_clean": {
        "tempo_intensity": 5,
        "rhythm_intensity": 4,
        "genre_bias": 5,
        "voice_strength": 5,
        "bed_level": 4,
        "stinger_intensity": 4,
        "drama_contrast": 3,
        "clarity": 10,
        "genre_line": "clean broadcast, friendly radio, neutral branded bed",
        "rhythm_line": "steady readable cadence, no rushed punchlines",
        "bed_line": "soft piano, light plucks, clean logo accent, quiet wide pad",
    },
    "late_night": {
        "tempo_intensity": 4,
        "rhythm_intensity": 5,
        "genre_bias": 7,
        "voice_strength": 6,
        "bed_level": 5,
        "stinger_intensity": 5,
        "drama_contrast": 6,
        "clarity": 8,
        "genre_line": "late-night talk radio, smoky lo-fi jazz",
        "rhythm_line": "lazy swing, intimate pauses, after-hours confidence",
        "bed_line": "Rhodes pad, brushed hats, room tone, tape warmth, quiet bass thump",
    },
    "tech_keynote": {
        "tempo_intensity": 5,
        "rhythm_intensity": 5,
        "genre_bias": 6,
        "voice_strength": 6,
        "bed_level": 4,
        "stinger_intensity": 5,
        "drama_contrast": 4,
        "clarity": 10,
        "genre_line": "premium tech keynote, glassy product launch",
        "rhythm_line": "precise confident cadence, clean reveals, short resolve",
        "bed_line": "glassy plucks, airy pads, soft riser, clean clicks, no EDM drop",
    },
    "playful_brand": {
        "tempo_intensity": 8,
        "rhythm_intensity": 8,
        "genre_bias": 7,
        "voice_strength": 6,
        "bed_level": 6,
        "stinger_intensity": 7,
        "drama_contrast": 5,
        "clarity": 8,
        "genre_line": "playful social ad, bouncy branded pop bumper",
        "rhythm_line": "quick hook, bright bounce, cheeky stops, meme-ready CTA",
        "bed_line": "bouncy claps, bright percussion, plucks, upbeat logo sting",
    },
}

_PROMO_PRESET_TAG_PARTS: dict[str, dict[str, str]] = {
    "pirate_radio": {
        "head": "pirate radio bumper, grimey talkdown, dark lo-fi ad",
        "intro": "filtered static, distant sea air, tape start, short foghorn",
        "verse": "close-mic gritty announcer, ducked lo-fi bed, vinyl grit",
        "bridge": "hard stop, brass stab, short riser, punchy air-band hit",
        "outro": "low-pass crackle tail, final foghorn sting, dry CTA spotlight",
    },
    "trailer_epic": {
        "head": "cinematic trailer voiceover, dark impact promo",
        "intro": "dark pad, reverse cymbal, heartbeat sub",
        "verse": "deep spoken narrator, ducked orchestral pulse, tight room",
        "bridge": "impact hit, braam, silence gap, rising tension",
        "outro": "long reverb tail, sub drop, final CTA hit",
    },
    "tv_clean": {
        "head": "clean broadcast radio read, trustworthy branded bed",
        "intro": "soft jingle bed, gentle swell, light pluck",
        "verse": "clear announcer diction, neutral ducked bed, broadcast polish",
        "bridge": "short logo accent, clean transition, no harsh sibilance",
        "outro": "wide stereo fade, quiet resolve, readable CTA",
    },
    "late_night": {
        "head": "late-night talk radio, smoky lo-fi jazz promo",
        "intro": "vinyl crackle, Rhodes pad, room tone",
        "verse": "intimate close-mic announcer, brushed hats, warm tape",
        "bridge": "jazzy chord hit, lazy swing pause, low bass thump",
        "outro": "plate reverb tail, quiet bed, after-hours CTA",
    },
    "tech_keynote": {
        "head": "premium tech keynote voiceover, clean product launch",
        "intro": "glassy plucks, airy pads, soft riser",
        "verse": "confident dry presenter, clean clicks, ducked synth bed",
        "bridge": "sparkle accent, precise reveal, short silence",
        "outro": "clean resolve, premium tail, clear CTA",
    },
    "playful_brand": {
        "head": "playful social ad, bouncy branded pop bumper",
        "intro": "bright loop, claps, quick hook",
        "verse": "energetic spoken announcer, punchy ducked bed, tight mix",
        "bridge": "cheeky stinger, stop-start accent, bright percussion",
        "outro": "upbeat logo tail, clean stop, memorable CTA",
    },
}


def _clamp_factor(value: object, default: int) -> int:
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):  # fmt: skip
        n = default
    return max(1, min(10, n))


def bpm_speech_for_promo(target_duration_sec: object) -> int:
    """Speech-bed BPM for a short voiceover: shorter spots can move faster."""
    try:
        t = int(float(target_duration_sec or 45))
    except (TypeError, ValueError):  # fmt: skip
        t = 45
    t = max(30, min(300, t))
    if t <= 45:
        return 112
    if t <= 75:
        return 108
    if t <= 120:
        return 104
    return 100


def normalize_promo_director_factors(preset: str, raw: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """Normalize user-facing promo direction controls into one compact profile."""
    p = (preset or "pirate_radio").strip().lower()
    defaults = dict(_PROMO_PRESET_DIRECTOR_DEFAULTS.get(p, _PROMO_PRESET_DIRECTOR_DEFAULTS["pirate_radio"]))
    raw = raw or {}
    aliases = {
        "tempo_intensity": ("promo_tempo_intensity", "promo_tempo", "tempo_intensity"),
        "rhythm_intensity": ("promo_rhythm_intensity", "promo_rhythm", "rhythm_intensity"),
        "genre_bias": ("promo_genre_bias", "genre_bias"),
        "voice_strength": ("promo_voice_strength", "voice_strength"),
        "bed_level": ("promo_bed_level", "promo_music_bed", "bed_level"),
        "stinger_intensity": ("promo_stinger_intensity", "promo_stinger", "stinger_intensity"),
        "drama_contrast": ("promo_drama_contrast", "promo_contrast", "drama_contrast"),
        "clarity": ("promo_clarity", "clarity"),
    }
    out = defaults
    for key, keys in aliases.items():
        value = next((raw[k] for k in keys if k in raw and raw[k] is not None), None)
        out[key] = _clamp_factor(value, int(defaults[key]))
    out["preset"] = p
    return out


def count_promo_spoken_words(lyrics: str) -> int:
    """Count only spoken copy, ignoring section headers and technical hints."""
    spoken: list[str] = []
    for line in (lyrics or "").splitlines():
        s = line.strip()
        if not s or s.startswith("[") or _LATIN_PROMO_PARENTHESES_RE.match(s):
            continue
        spoken.append(s)
    return len(_PROMO_SPOKEN_WORD_RE.findall(" ".join(spoken)))


def build_raw_promo_lyrics_preserving_copy(
    raw_text: str,
    *,
    preset: str,
    vocal: str,
    bpm: int,
) -> str:
    """Wrap raw ad copy into promo sections without rewriting the user's words."""
    cleaned = _unescape_prompt_newlines(raw_text or "")
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not cleaned:
        return ""
    # Keep emphatic line breaks, but collapse accidental huge gaps.
    blocks = [b.strip() for b in re.split(r"\n\s*\n+", cleaned) if b.strip()]
    if not blocks:
        blocks = [cleaned]
    if len(blocks) == 1:
        lines = [ln.strip() for ln in blocks[0].splitlines() if ln.strip()]
        if len(lines) >= 5:
            blocks = [
                "\n".join(lines[:2]),
                "\n".join(lines[2:-3]),
                "\n".join(lines[-3:-1]),
                lines[-1],
            ]
    section_names = ["Intro", "Verse", "Bridge", "Outro"]
    while len(blocks) < 4:
        if len(blocks) == 1:
            blocks.append("")
        elif len(blocks) == 2:
            blocks.append(blocks[-1])
            blocks[-2] = ""
        else:
            blocks.append("")
    blocks = blocks[:4]
    arrangement = _arrangement_parenthetical_english(preset, bpm)
    voice = _voice_parenthetical_english(vocal)
    out: list[str] = []
    for idx, name in enumerate(section_names):
        body = blocks[idx].strip()
        if not body and name not in ("Intro", "Outro"):
            continue
        out.append(f"[{name}]")
        out.append(arrangement if name in ("Intro", "Bridge") else voice)
        if body:
            out.append(body)
        out.append("")
    return "\n".join(out).strip()


def align_promo_arrangement_bpm(lyrics: str, bpm: int) -> str:
    """Keep technical arrangement hints in sync with the final ACE BPM field."""
    b = min(130, max(80, int(bpm)))
    return re.sub(
        r"\(Arrangement:\s*\d{2,3}\s*BPM\s+feel",
        f"(Arrangement: {b} BPM feel",
        lyrics or "",
        flags=re.IGNORECASE,
    )


def recommend_promo_duration_and_bpm(
    lyrics: str,
    *,
    preset: str,
    factors: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Recommend final duration from actual script length and direction factors."""
    f = normalize_promo_director_factors(preset, factors)
    words = count_promo_spoken_words(lyrics)
    sections = len(re.findall(r"^\s*\[[^\]\n]{1,80}]\s*$", lyrics or "", flags=re.MULTILINE))
    emphatic = len(re.findall(r"[!…]|\.{3}|^[А-ЯA-Z0-9 ,+-]{6,}$", lyrics or "", flags=re.MULTILINE))
    # Words/sec: faster tempo raises speed; high drama/voice/stingers need more breathing room.
    wps = 2.22
    wps += (int(f["tempo_intensity"]) - 5) * 0.045
    wps += (int(f["rhythm_intensity"]) - 5) * 0.025
    wps -= (int(f["drama_contrast"]) - 5) * 0.04
    wps -= (int(f["voice_strength"]) - 5) * 0.025
    wps -= max(0, int(f["stinger_intensity"]) - 6) * 0.025
    wps = max(1.65, min(2.65, wps))
    raw_seconds = (words / wps if words else 30.0) + max(2, sections) * 1.25 + emphatic * 0.45 + 2.5
    duration = max(30, min(300, int(math.ceil(raw_seconds / 5.0) * 5)))
    bpm = bpm_speech_for_promo(duration)
    bpm += (int(f["tempo_intensity"]) - 5) * 2
    bpm += int(round((int(f["rhythm_intensity"]) - 5) * 1.2))
    bpm += int(round((int(f["stinger_intensity"]) - 5) * 0.8))
    bpm -= max(0, int(f["drama_contrast"]) - 8) * 2
    bpm = max(92, min(128, bpm))
    return {
        "estimated_spoken_words": words,
        "recommended_duration_sec": duration,
        "recommended_bpm": bpm,
        "estimated_words_per_sec": round(wps, 2),
        "sections_count": sections,
        "factors": f,
    }


def promo_director_prompt_block(factors: Mapping[str, Any]) -> str:
    """Prompt block that makes the LLM act like a promo director, not a lyricist."""
    f = normalize_promo_director_factors(str(factors.get("preset") or "pirate_radio"), factors)
    return (
        "\n\nPROMO DIRECTOR SETTINGS (must influence both copy and tags):\n"
        f"- Tempo intensity {f['tempo_intensity']}/10: choose pacing and pause density accordingly.\n"
        f"- Rhythm intensity {f['rhythm_intensity']}/10: {f['rhythm_line']}.\n"
        f"- Genre bias {f['genre_bias']}/10: lean into {f['genre_line']}.\n"
        f"- Voice strength {f['voice_strength']}/10: stronger means more chest, grit, projection and fewer soft fillers.\n"
        f"- Music bed level {f['bed_level']}/10: bed must duck under speech; never bury words.\n"
        f"- Stinger intensity {f['stinger_intensity']}/10: decide how hard transitions and logo hits should land.\n"
        f"- Drama contrast {f['drama_contrast']}/10: use contrast, silence and short escalation if high.\n"
        f"- Clarity {f['clarity']}/10: intelligibility is mandatory; keep CTA clean.\n"
        "Write as an ad director: hook -> pressure/benefit -> turn -> CTA. Avoid generic filler.\n"
    )


def promo_director_tags_suffix(factors: Mapping[str, Any], recommendation: Mapping[str, Any] | None = None) -> str:
    """English tags that carry high-level promo direction into ACE."""
    f = normalize_promo_director_factors(str(factors.get("preset") or "pirate_radio"), factors)
    bpm = recommendation.get("recommended_bpm") if isinstance(recommendation, Mapping) else None
    bpm_part = f"{bpm} BPM director target, " if bpm else ""
    return (
        f"{bpm_part}promo director mix, {f['genre_line']}, {f['rhythm_line']}, {f['bed_line']}, "
        f"voice strength {f['voice_strength']}/10, rhythm drive {f['rhythm_intensity']}/10, "
        f"genre bias {f['genre_bias']}/10, bed level {f['bed_level']}/10 with speech ducking, "
        f"stinger intensity {f['stinger_intensity']}/10, drama contrast {f['drama_contrast']}/10, "
        f"clarity {f['clarity']}/10, hard CTA spotlight, broadcast-ready voiceover, no singing"
    )


def build_concise_promo_ace_tags(
    *,
    preset: str,
    vocal: str,
    bpm: int,
    factors: Mapping[str, Any] | None = None,
    extra_tags: str | None = None,
    max_length: int = 2000,
) -> str:
    """Deterministic ACE tags for promo; avoids song-style and numeric UI clutter."""
    p = (preset or "pirate_radio").strip().lower()
    parts = _PROMO_PRESET_TAG_PARTS.get(p, _PROMO_PRESET_TAG_PARTS["pirate_radio"])
    f = normalize_promo_director_factors(p, factors)
    v = (vocal or "male").strip().lower()
    voice = {
        "female": "female spoken announcer",
        "duet": "alternating duet spoken announcers",
    }.get(v, "male spoken announcer")
    drive_words: list[str] = []
    if int(f["tempo_intensity"]) >= 8:
        drive_words.append("fast punchy pacing")
    elif int(f["tempo_intensity"]) <= 4:
        drive_words.append("measured pacing")
    if int(f["voice_strength"]) >= 8:
        drive_words.append("strong projected voice")
    else:
        drive_words.append("controlled voice")
    if int(f["bed_level"]) >= 7:
        drive_words.append("dense ducked music bed")
    else:
        drive_words.append("minimal ducked music bed")
    if int(f["stinger_intensity"]) >= 7:
        drive_words.append("hard stingers")
    else:
        drive_words.append("subtle stingers")
    if int(f["drama_contrast"]) >= 7:
        drive_words.append("silence gaps before CTA")
    if int(f["clarity"]) >= 8:
        drive_words.append("high speech intelligibility")
    extra = _strip_cyrillic_from_tags_en_only(extra_tags or "")
    extra = re.sub(r"\b\d{1,3}\s*BPM\b", "", extra, flags=re.I)
    extra = re.sub(r"\b(?:male|female|duet)\s+vocal\b", "", extra, flags=re.I)
    extra = re.sub(r"\bvoice strength\s+\d+/10\b", "", extra, flags=re.I)
    extra = re.sub(
        r"\b(?:rhythm drive|genre bias|bed level|stinger intensity|drama contrast|clarity)\s+\d+/10[^,]*",
        "",
        extra,
        flags=re.I,
    )
    extra = re.sub(r"\s{2,}", " ", extra).strip(" ,")
    tags = (
        f"{max(80, min(130, int(bpm)))} BPM, {voice} voiceover, {parts['head']}, "
        f"{', '.join(drive_words)}, speech-forward mix, no singing, no lead melody, "
        f"[intro] {parts['intro']}, [verse] {parts['verse']}, "
        f"[bridge] {parts['bridge']}, [outro] {parts['outro']}"
    )
    if extra and "promo director mix" not in extra.lower():
        tags = f"{tags}, {extra[:220].rstrip(' ,')}"
    return tags[:max_length].rstrip(" ,")


def _strip_cyrillic_from_tags_en_only(tags: str) -> str:
    """Keep only English-ish tag chunks; promo tags go directly into ACE."""
    parts = [p.strip() for p in re.split(r",\s*", tags or "") if p.strip()]
    kept = [p for p in parts if not re.search(r"[\u0400-\u04ff]", p)]
    out = ", ".join(kept)
    out = re.sub(r"\s{2,}", " ", out)
    return out.strip(" ,")


def enrich_promo_tags_with_director(
    tags: str,
    *,
    preset: str,
    factors: Mapping[str, Any] | None = None,
    recommendation: Mapping[str, Any] | None = None,
    max_length: int = 2000,
) -> str:
    """Append the director profile unless the tags already include it."""
    f = normalize_promo_director_factors(preset, factors)
    suffix = promo_director_tags_suffix(f, recommendation)
    base = (tags or "").strip().rstrip(" ,")
    if "promo director mix" in base.lower():
        merged = base
    elif base:
        merged = f"{base}, {suffix}"
    else:
        merged = suffix
    return merged[:max_length].rstrip(" ,")


def _decode_relaxed_json_string(raw: str) -> str:
    """Decode common escaped JSON string content, tolerating raw newlines."""
    body = (raw or "").strip()
    if not body:
        return ""
    safe = body.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\\n")
    try:
        decoded = json.loads(f'"{safe}"')
    except json.JSONDecodeError:
        decoded = body
    return str(decoded)


def extract_jsonish_lyrics_field(text: str) -> str:
    """
    Extract lyrics from both valid JSON and common malformed JSON-like LLM output.

    Some models put raw newlines inside the JSON string, so normal json.loads()
    cannot parse it.  The scanner keeps the useful body and discards the tags
    object tail before ACE sees it.
    """
    s = (text or "").strip()
    if not s:
        return ""
    for _ in range(4):
        parsed: Any | None = None
        try:
            candidate = json.loads(s)
            parsed = candidate if isinstance(candidate, dict) else None
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, dict) and parsed.get("lyrics"):
            nxt = str(parsed.get("lyrics") or "").strip()
            if not nxt or nxt == s:
                break
            s = nxt
            continue
        m = _JSON_LYRICS_FIELD_RE.search(s)
        if not m:
            break
        nxt = _decode_relaxed_json_string(m.group("body"))
        if not nxt or nxt == s:
            break
        s = nxt.strip()
    return s


def strip_stray_json_tags_tail(text: str) -> str:
    """Drop a dangling `,\"tags\": ...}` fragment from malformed LLM lyrics."""
    t = (text or "").strip()
    if not t:
        return ""
    t = _JSON_TAGS_TAIL_RE.sub("", t).rstrip()
    for _ in range(4):
        stripped = t.rstrip()
        if stripped.endswith(("}", "]")) and stripped.count("{") < stripped.count("}"):
            t = stripped[:-1].rstrip().rstrip(",").rstrip('"').rstrip("'")
            continue
        break
    return t.strip()


def python_list_repr_to_promo_lyrics(text: str) -> str:
    """Convert accidental Python-list repr to multiline script text."""
    t = (text or "").strip()
    if len(t) < 4 or not (t.startswith("[") and t.endswith("]")):
        return text
    try:
        value = ast.literal_eval(t)
    except (ValueError, SyntaxError, TypeError, MemoryError):  # fmt: skip
        return text
    if not isinstance(value, list):
        return text
    out = "\n".join(str(item).strip() for item in value if str(item).strip())
    return out or text


def _unescape_prompt_newlines(text: str) -> str:
    t = (text or "").replace("\\\\n", "\n")
    t = t.replace("\\r\\n", "\n")
    t = t.replace("\\n", "\n")
    t = t.replace("\\r", "\n")
    return t


def _canonical_promo_section(raw: str) -> str:
    name, _, hint = (raw or "").partition(":")
    key = re.sub(r"\s+", " ", name.strip().lower().replace("_", " "))
    if key.startswith(("intro", "opening", "start")):
        mapped = "Intro"
    elif key.startswith(("outro", "ending", "end", "tail")):
        mapped = "Outro"
    elif key.startswith(("bridge", "sting", "cta", "call to action", "hook", "accent")):
        mapped = "Bridge"
    else:
        mapped = "Verse"
    if hint.strip():
        return f"{mapped}: {hint.strip()}"
    return mapped


def normalize_promo_sections(text: str) -> str:
    """Map ad-copy section labels to ACE-friendly vocal sections."""
    lines: list[str] = []
    for raw_line in (text or "").splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        m = _SECTION_LINE_RE.match(stripped)
        if not m:
            lines.append(line)
            continue
        section = _canonical_promo_section(m.group("section"))
        rest = (m.group("rest") or "").strip()
        lines.append(f"[{section}]")
        if rest:
            lines.append(rest)
    return "\n".join(lines)


def split_inline_promo_parentheticals(text: str) -> str:
    """
    `[Intro] (Arrangement: ...) copy` -> section line, hint line, copy line.

    ACE parses this more reliably than a header and parenthetical on one line.
    """
    out: list[str] = []
    for raw_line in (text or "").splitlines():
        line = raw_line.rstrip()
        m = _INLINE_PARENTHESES_RE.match(line.strip())
        if not m:
            out.append(line)
            continue
        out.append(m.group("header"))
        out.append(m.group("hint"))
        rest = (m.group("rest") or "").strip()
        if rest:
            out.append(rest)
    return "\n".join(out)


def _arrangement_parenthetical_english(preset: str, bpm: int) -> str:
    p = (preset or "pirate_radio").strip().lower()
    b = min(130, max(80, int(bpm)))
    lines: dict[str, str] = {
        "pirate_radio": f"{b} BPM feel, lo-fi static, short foghorn, air band, vinyl crackle, minimal bed",
        "trailer_epic": f"{b} BPM feel, dark pads, reverse cymbal, sub pulse, whoosh, tension, no pop hook",
        "tv_clean": f"{b} BPM feel, soft neutral bed, jingle tail, light piano, broadcast polish, minimal FX",
        "late_night": f"{b} BPM feel, Rhodes pad, brush hats, lo-fi thump, room tone, under-voice bed",
        "tech_keynote": f"{b} BPM feel, glassy plucks, soft riser, airy pads, clean clicks, no EDM drop",
        "playful_brand": f"{b} BPM feel, bouncy claps, bright transient, fun loop, no epic trailer",
    }
    return f"(Arrangement: {lines.get(p, lines['pirate_radio'])})"


def _voice_parenthetical_english(vocal: str) -> str:
    v = (vocal or "male").strip().lower()
    if v == "female":
        return "(Voice: female, close-mic, warm, clear, announcer, no singing)"
    if v == "duet":
        return "(Voice: duet, alternating, close-mic, tight mix, no singing)"
    return "(Voice: male, close-mic, gritty, dry, announcer, no singing)"


def replace_cyrillic_in_promo_parentheticals(text: str, *, preset: str, vocal: str, bpm: int) -> str:
    """Keep promo technical parentheticals English-only for ACE."""

    def sub_arr(m: re.Match[str]) -> str:
        inner = m.group(1) or ""
        if re.search(r"[\u0400-\u04ff]", inner):
            return _arrangement_parenthetical_english(preset, bpm)
        return m.group(0)

    def sub_voice(m: re.Match[str]) -> str:
        inner = m.group(1) or ""
        if re.search(r"[\u0400-\u04ff]", inner):
            return _voice_parenthetical_english(vocal)
        return m.group(0)

    out = re.sub(r"\(Arrangement:\s*([^)]*)\)", sub_arr, text or "", flags=re.IGNORECASE)
    return re.sub(r"\((?:Voice|Vocal):\s*([^)]*)\)", sub_voice, out, flags=re.IGNORECASE)


def normalize_promo_voiceover_lyrics(
    text: str, *, preset: str = "pirate_radio", vocal: str = "male", bpm: int = 110
) -> str:
    """Full promo lyrics cleanup before validation and Comfy."""
    out = extract_jsonish_lyrics_field(text)
    out = python_list_repr_to_promo_lyrics(out)
    out = _unescape_prompt_newlines(out)
    out = strip_stray_json_tags_tail(out)
    out = split_inline_promo_parentheticals(out)
    out = replace_cyrillic_in_promo_parentheticals(out, preset=preset, vocal=vocal, bpm=bpm)
    out = sanitize_lyrics_ai_output(out)
    out = extract_jsonish_lyrics_field(out)
    out = strip_stray_json_tags_tail(out)
    out = split_inline_promo_parentheticals(out)
    out = normalize_promo_sections(out)
    out = re.sub(r"[ \t]+\n", "\n", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def validate_promo_voiceover_payload(lyrics: str, tags: str | None = None) -> dict[str, Any]:
    """Small contract validator for promo voiceovers."""
    text = (lyrics or "").strip()
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    if not text:
        errors.append({"code": "empty_promo_script", "message": "Пустой сценарий промо-озвучки."})
    if "```" in text:
        errors.append({"code": "promo_markdown_fence", "message": "В сценарии осталась markdown-обёртка ```."})
    if re.search(r"""["']lyrics["']\s*:""", text):
        errors.append({"code": "promo_json_wrapper", "message": "В сценарии осталась JSON-обёртка lyrics."})
    sections = re.findall(r"^\s*\[([^\]\n]{1,80})]\s*$", text, flags=re.MULTILINE)
    if len(sections) < 2:
        errors.append(
            {"code": "promo_too_few_sections", "message": "Для промо нужно минимум две секции: Intro/Verse/Outro."}
        )
    if len(sections) > 6:
        warnings.append(
            {"code": "promo_many_sections", "message": "В промо больше шести секций — ролик может звучать рвано."}
        )
    for i, line in enumerate(text.splitlines(), start=1):
        s = line.strip()
        if not s or s.startswith("[") or _LATIN_PROMO_PARENTHESES_RE.match(s):
            continue
        if len(s) > 180:
            errors.append(
                {
                    "code": "promo_line_too_long",
                    "line": i,
                    "message": "Слишком длинная реплика для дикторского промо; разбейте её на короткие фразы.",
                    "preview": s[:120],
                }
            )
    if tags is not None and re.search(r"[\u0400-\u04ff]", tags or ""):
        errors.append(
            {
                "code": "promo_tags_not_english",
                "message": "Описание звучания promo tags должно быть на английском без кириллицы.",
            }
        )
    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "errors_count": len(errors),
        "warnings_count": len(warnings),
        "normalized_lyrics": text,
        "lyrics_were_normalized": False,
    }
