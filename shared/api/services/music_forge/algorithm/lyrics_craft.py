# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MusicForge sung-lyric craft contract: ban meta-music filler and empty pop clichés.
# Invariants:
# - style_hint is arrangement, never a source of sung vocabulary (ритм/пульс/бит).
# - Gate rejects filler; it does not rewrite ритм→пульс (that swap is itself filler).
# Related:
# - api/services/music_forge/algorithm/lyrics.py
# - api/services/music_forge/algorithm/prompts.py
# - documentation/product/MUSIC-FORGE-APP.md
# ---
"""MusicForge lyrics craft: forbidden sung tokens and weak-cliché scan."""

from __future__ import annotations

import re
from typing import Any

_SECTION_OR_PAREN_RE = re.compile(r"^\s*(?:\[[^\]]+\]|\([^)]+\))\s*$")
_VERSE_HEADER_RE = re.compile(r"^\s*\[Verse", re.I)
_ANY_SECTION_RE = re.compile(r"^\s*\[", re.I)

# Production / dance-floor vocabulary leaking into the singer's mouth.
_META_MUSIC_RE = re.compile(
    r"(?i)\b(?:"
    r"ритм(?:ы|а|у|е|ом|ов)?|"
    r"пульс(?:ы|а|у|е|ом|ов)?|"
    r"бит(?:а|у|е|ом|ы)?|"
    r"такт(?:ы|а|у|е|ом|ов)?|"
    r"bpm|"
    r"bass[- ]?drop|"
    r"the drop|"
    r"build[- ]?up|"
    r"rhythm|"
    r"pulse|"
    r"beat(?:s)?|"
    r"groove"
    r")\b"
)

_EMPTY_POP_CLICHE_RES: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?i)бьёт\s+по\s+венам"),
    re.compile(r"(?i)пульс\s+в\s+висках"),
    re.compile(r"(?i)сквозь\s+туман"),
    re.compile(r"(?i)мой\s+компас"),
    re.compile(r"(?i)мой\s+океан"),
    re.compile(r"(?i)яркий\s+маршрут"),
    re.compile(r"(?i)личный\s+поток"),
    re.compile(r"(?i)весь\s+этот\s+мир\s+в\s+моих\s+руках"),
    re.compile(r"(?i)endless\s+dreams"),
    re.compile(r"(?i)shining\s+stars"),
    re.compile(r"(?i)through\s+the\s+fog"),
    re.compile(r"(?i)my\s+compass"),
    re.compile(r"(?i)beats?\s+in\s+my\s+veins"),
)

LYRICS_CRAFT_FAIL_CODES: frozenset[str] = frozenset(
    {
        "meta_music_jargon",
        "empty_pop_cliche",
        "weak_cliche_fill",
        "abstract_noun_chant",
    }
)

LYRICS_CRAFT_RULES: tuple[str, ...] = (
    "style_hint and constraints are production notes for the band — never copy them into sung lines.",
    "Sung lines: one camera shot each (place, object, body, weather, a line of speech). Concrete verbs.",
    "If the idea is abstract (судьба, любовь, свобода), show one specific night/choice; do not chant the abstract noun every line.",
    "Forbidden in sung text (any form): ритм, пульс, бит, такт, BPM, drop, rhythm, pulse, beat, groove — those describe the track, not the story.",
    "Forbidden empty-pop glue: сквозь туман, мой компас, мой океан, яркий маршрут, личный поток, бьёт по венам, пульс в висках, весь этот мир в моих руках.",
    "Chorus hook may repeat the user idea once as a title phrase; verses must add new facts, not synonyms of destiny/ocean/fog.",
    "Each verse line must follow a distinct scene_beat from the blueprint when provided.",
    "Rhyme by stress and living speech, not by stacking cosmic nouns.",
)

LYRICS_CRAFT_SYSTEM_ADDON = (
    "You write lyrics a skilled human songwriter would keep. "
    "Short singable lines, audible rhyme in the chorus, no production jargon in the mouth of the singer. "
    + " ".join(LYRICS_CRAFT_RULES)
)

LYRICS_CRAFT_EXAMPLES: dict[str, list[str]] = {
    "bad_sung_ru": [
        "Ритм бьёт по венам, пульс в висках.",
        "Судьба ведёт меня сквозь туман.",
        "Судьба — мой компас, мой океан.",
        "Только мой ритм.",
    ],
    "good_sung_ru": [
        "Ключ царапнул замок в подъезде.",
        "Лифт застрял между третьим и четвёртым.",
        "Сосед курит на площадке и молчит.",
        "Я всё равно выхожу на двор.",
    ],
    "bad_sung_en": [
        "Rhythm beats in my veins, pulse in my temples.",
        "Through the fog I chase my compass and ocean.",
        "Only my groove remains.",
    ],
    "good_sung_en": [
        "The key scratched the lock in the stairwell.",
        "The elevator stuck between three and four.",
        "My neighbor smokes on the landing and says nothing.",
        "I still walk out into the yard.",
    ],
}


def craft_examples_for_language(language: str) -> dict[str, list[str]]:
    """Return good/bad few-shot lines for the target sung language."""
    if str(language or "").lower().startswith("en"):
        return {
            "bad_sung": list(LYRICS_CRAFT_EXAMPLES["bad_sung_en"]),
            "good_sung": list(LYRICS_CRAFT_EXAMPLES["good_sung_en"]),
        }
    return {
        "bad_sung": list(LYRICS_CRAFT_EXAMPLES["bad_sung_ru"]),
        "good_sung": list(LYRICS_CRAFT_EXAMPLES["good_sung_ru"]),
    }


def sung_lyric_lines(lyrics: str) -> list[str]:
    """Return singer lines only (skip ACE headers and Voice/Arrangement annotations)."""
    lines: list[str] = []
    for raw in (lyrics or "").splitlines():
        stripped = raw.strip()
        if not stripped or _SECTION_OR_PAREN_RE.match(stripped):
            continue
        if stripped.startswith("(Voice:") or stripped.startswith("(Arrangement:"):
            continue
        if stripped.startswith("(") and stripped.endswith(")"):
            continue
        lines.append(stripped)
    return lines


def verse_sung_lines(lyrics: str) -> list[str]:
    """Return sung lines that appear under [Verse] / [Verse N] headers only."""
    in_verse = False
    lines: list[str] = []
    for raw in (lyrics or "").splitlines():
        stripped = raw.strip()
        if _VERSE_HEADER_RE.match(stripped):
            in_verse = True
            continue
        if _ANY_SECTION_RE.match(stripped):
            in_verse = False
            continue
        if not in_verse:
            continue
        if not stripped or _SECTION_OR_PAREN_RE.match(stripped):
            continue
        if stripped.startswith("(Voice:") or stripped.startswith("(Arrangement:"):
            continue
        if stripped.startswith("(") and stripped.endswith(")"):
            continue
        lines.append(stripped)
    return lines


def _idea_allows_meta_token(token: str, idea: str) -> bool:
    """Allow a sung meta-token only if that word (not a substring) appears in the user idea."""
    raw = (token or "").strip().lower()
    if not raw or not idea:
        return False
    return bool(re.search(rf"(?i)(?<!\w){re.escape(raw)}(?!\w)", idea))


def _abstract_anchor_tokens(idea: str, hook: str) -> list[str]:
    anchor = (hook or idea or "").strip().lower()
    if not anchor:
        return []
    words = [w for w in re.findall(r"\w+", anchor, flags=re.UNICODE) if len(w) >= 3]
    if len(words) <= 4:
        return words
    return words[:3]


def _abstract_noun_chant(lyrics: str, intent: dict[str, Any], blueprint: dict[str, Any]) -> bool:
    """True when short abstract idea/hook is chanted across verse lines instead of concrete scenes."""
    idea = str(intent.get("idea") or "").strip()
    if len(idea.split()) > 4:
        return False
    tokens = _abstract_anchor_tokens(idea, str(blueprint.get("hook") or ""))
    if not tokens:
        return False
    verse_lines = verse_sung_lines(lyrics)
    if len(verse_lines) < 2:
        return False
    hit_lines = 0
    for line in verse_lines:
        low = line.lower()
        if any(re.search(rf"(?i)(?<!\w){re.escape(tok)}(?!\w)", low) for tok in tokens):
            hit_lines += 1
    return hit_lines >= 2


def scan_forge_lyrics_craft(
    lyrics: str,
    intent: dict[str, Any],
    *,
    blueprint: dict[str, Any] | None = None,
) -> list[str]:
    """Return craft error codes for the lyrics gate (no silent rewrite)."""
    idea = str(intent.get("idea") or "")
    bp = blueprint if isinstance(blueprint, dict) else {}
    errors: list[str] = []
    joined = "\n".join(sung_lyric_lines(lyrics))
    if not joined:
        return errors
    meta_hits = 0
    for match in _META_MUSIC_RE.finditer(joined):
        token = match.group(0).lower()
        if _idea_allows_meta_token(token, idea):
            continue
        meta_hits += 1
    if meta_hits:
        errors.append("meta_music_jargon")
    cliche_hits = sum(1 for pat in _EMPTY_POP_CLICHE_RES if pat.search(joined))
    if cliche_hits >= 1:
        errors.append("empty_pop_cliche")
    if cliche_hits >= 2:
        errors.append("weak_cliche_fill")
    if _abstract_noun_chant(lyrics, intent, bp):
        errors.append("abstract_noun_chant")
    return errors


def dislike_lyrics_hints(corpus: dict[str, Any] | None) -> list[str]:
    """Turn recent Forge dislikes into lyrics-oriented rewrite hints."""
    if not isinstance(corpus, dict):
        return []
    raw = corpus.get("dislike_hints")
    if not isinstance(raw, list):
        return []
    hints: list[str] = []
    for item in raw[:6]:
        if not isinstance(item, dict):
            continue
        code = str(item.get("reason_code") or "").strip().lower()
        custom = str(item.get("reason_custom") or "").strip()
        if code == "lyrics" and custom:
            hints.append(f"Avoid repeating prior lyric issues: {custom[:160]}")
        elif code == "lyrics":
            hints.append("Prior dislike: lyrics felt generic — use concrete scenes, not slogans.")
        elif code == "tempo_rhythm":
            hints.append("Prior dislike: tempo/groove — do not sing rhythm/pulse/beat words.")
        elif code == "vocal" and custom:
            hints.append(f"Keep lines easy to sing clearly: {custom[:120]}")
        elif code == "genre_mismatch" and custom:
            hints.append(f"Stay in user genre mood without copying production jargon: {custom[:120]}")
        elif code == "other" and custom:
            hints.append(f"User disliked prior run: {custom[:160]}")
    return hints[:4]


def lyrics_rewrite_notes(errors: list[str]) -> list[str]:
    notes: list[str] = []
    if "meta_music_jargon" in errors:
        notes.append(
            "Previous draft used rhythm/pulse/beat words (ритм, пульс, бит). Rewrite with story, not groove nouns."
        )
    if "empty_pop_cliche" in errors or "weak_cliche_fill" in errors:
        notes.append(
            "Previous draft used empty pop glue (fog/compass/ocean/veins). Replace with one concrete scene per line."
        )
    if "abstract_noun_chant" in errors:
        notes.append(
            "Previous draft chanted the abstract idea in verses. Verses must add new facts; hook only in chorus title line."
        )
    return notes
