# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared MusicForge algorithm constants: version keys, lane labels, style maps, forge profiles, regexes.
# Invariants:
# - Title Case ACE section markers must match lyrics headers ([Intro] not [intro]).
# - Default render lane is AceStepSFT (v4 / ace_sft_new.json).
# Related:
# - api/services/music_forge/algorithm/__init__.py
# - documentation/product/MUSIC-FORGE-APP.md
# ---

from __future__ import annotations

import re

MUSIC_FORGE_VERSION = "music_forge_mvp_v2_xl_sft_q4_1"
MUSIC_FORGE_AUDIO_TYPE_KEY = "music_generator_forge_audio"
MUSIC_FORGE_BLUEPRINT_TYPE_KEY = "music_generator_forge_blueprint"
MUSIC_FORGE_LYRICS_TYPE_KEY = "music_generator_forge_lyrics"
MUSIC_FORGE_STYLE_TYPE_KEY = "music_generator_forge_style"

MUSIC_FORGE_LANE_SFT_XL = "SFT XL"
MUSIC_FORGE_LANE_BASE_XL = "BASE XL"
MUSIC_FORGE_LANE_TURBO_XL = "TURBO XL"

_FULL_SONG_SECTIONS = [
    "Intro",
    "Verse 1",
    "Pre-Chorus",
    "Chorus",
    "Verse 2",
    "Pre-Chorus",
    "Chorus",
    "Bridge",
    "Chorus",
    "Outro",
]

# Title Case section markers — must match lyrics `[Intro]` / `[Verse]`, not lowercase `[intro]`.
_CAPTION_SECTION_SKELETON = (
    "[Intro] {intro}, [Verse] {verse}, [Pre-Chorus] {pre}, [Chorus] {chorus}, "
    "[Verse 2] {verse2}, [Pre-Chorus 2] {pre2}, [Chorus 2] {chorus2}, "
    "[Bridge] {bridge}, [Chorus 3] {chorus3}, [Outro] {outro}"
)

_BPM_EXTRACT_RE = re.compile(r"\b(\d{2,3})\s*bpm\b", re.I)

_ELECTRONIC_INTENT_MARKERS = (
    "drum and bass",
    "drum&bass",
    "dnb",
    "jungle",
    "breakbeat",
    "techno",
    "edm",
    "house",
    "trance",
    "hardstyle",
    "рейв",
)

_CYRILLIC_RE = re.compile(r"[А-Яа-яЁё]")
# Numbered ACE markers ([Verse 1], [Chorus 2], …) are TOP-shaped and must not trip json_leak.
_SECTION_RE = re.compile(
    r"^\s*\[(?:verse|chorus|bridge|intro|outro|pre-chorus|hook)(?:\s+\d+)?\]\s*$",
    re.I | re.M,
)
_CONSONANT_RE = re.compile(r"[бвгджзйклмнпрстфхцчшщbcdfghjklmnpqrstvwxyz]", re.I)
_VOWEL_OR_MOAN_RE = re.compile(r"[аоэеиыуёюяaeiouyhмm]", re.I)
# Keep extreme non-song artifacts out; do not sterilize natural sung expression.
MUSIC_FORGE_ANTI_WAIL_NEGATIVE_PROMPT = (
    "extreme vocal wailing, non-lyrical moaning between sections, wordless screaming, "
    "crying voice, opera vibrato overload, synthetic choir wash drowning lead vocal, "
    "unintelligible adlibs, muddy mix without lead vocal"
)

_STYLE_KEYSCALE: dict[str, str] = {
    "pop": "A minor",
    "rock": "E minor",
    "electronic": "F minor",
    "ballad": "Eb major",
    "drum and bass": "D minor",
    "hip_hop": "A minor",
    "dubstep": "A minor",
    "lofi_chill": "D minor",
    "phonk": "D minor",
    "house": "F minor",
    "techno": "A minor",
    "trance": "D minor",
    "edm": "C minor",
    "synthwave": "E minor",
    "indie_rock": "A major",
    "metal": "E minor",
    "rnb_classic_female": "Eb major",
    "reggaeton": "A minor",
    "afrobeats": "F# minor",
    "kpop": "D minor",
    "dance": "F minor",
}

_STYLE_DEFAULT_VOCAL: dict[str, str] = {
    "lofi_chill": "male",
    "phonk": "male",
    "hip_hop": "male",
    "metal": "male",
    "drum and bass": "female",
    "rnb_classic_female": "female",
    "ballad": "female",
    "kpop": "female",
}

# Forge-owned enrich for genres where Evolution soloist graphs fight the style caption.
_FORGE_LOFI_ARRANGEMENT = {
    "intro": "Vinyl crackle, soft Rhodes stab, dusty kick, {bpm} BPM feel",
    "verse": "Boom-bap loop, muted Rhodes, upright bass, {bpm} BPM",
    "pre-chorus": "Filtered hats, rising pad, {bpm} BPM",
    "chorus": "Fuller Rhodes chords, soft snare, warm sub, {bpm} BPM",
    "bridge": "Stripped vinyl + Rhodes motif, {bpm} BPM",
    "outro": "Tape fade, crackle tail, {bpm} BPM feel",
}
_FORGE_LOFI_VOICE = {
    "intro": "warm close-mic, intimate, low dynamics",
    "verse": "narrative, dry intimate, clear diction",
    "pre-chorus": "soft lift, breathy but lexical",
    "chorus": "singable hook, chest-forward, light plate reverb",
    "bridge": "hushed confessional, close-mic",
    "outro": "fade whisper on words, no wordless pad",
}
_FORGE_INDIE_ARRANGEMENT = {
    "intro": "Clean electric guitar motif, room drums count-in, {bpm} BPM feel",
    "verse": "Live kit, bass, jangly guitar, {bpm} BPM",
    "pre-chorus": "Added snare lift, second guitar, {bpm} BPM",
    "chorus": "Full indie-rock stack, open hats, {bpm} BPM",
    "bridge": "Breakdown guitar + tom fill, {bpm} BPM",
    "outro": "Guitar feedback fade, {bpm} BPM feel",
}
_FORGE_INDIE_VOICE = {
    "intro": "dry close lead, indie intimacy",
    "verse": "conversational belt, slight grit",
    "pre-chorus": "push into hook, clear consonants",
    "chorus": "anthemic but human, doubled lead",
    "bridge": "raw near-mic, emotional peak",
    "outro": "soft landing, spoken-sung tail",
}
_FORGE_DNB_ARRANGEMENT = {
    "intro": "Amen chop filter, Reese sub swell, {bpm} BPM feel",
    "verse": "Rolling breaks, dark Reese bass, sparse snare, {bpm} BPM",
    "pre-chorus": "Snare roll build, rising noise, {bpm} BPM",
    "chorus": "Full amen energy, wide supersaw stab, heavy sub, {bpm} BPM",
    "bridge": "Half-time break, filtered Reese, vocal focus, {bpm} BPM",
    "outro": "Breaks dissolve into reverb, sub fade, {bpm} BPM feel",
}
_FORGE_DNB_VOICE = {
    "intro": "breathy close-mic, tense anticipation",
    "verse": "rhythmic narrative, dry intimate, clear diction",
    "pre-chorus": "urgency lift, sharp consonants",
    "chorus": "powerful belt, forward hook, light plate",
    "bridge": "hushed confession over half-time",
    "outro": "whispered last line, no wordless scream",
}
_FORGE_HOUSE_ARRANGEMENT = {
    "intro": "Four-on-floor kick, filtered pad, disco hat, {bpm} BPM feel",
    "verse": "Pulsing bassline, light hats, warm keys, {bpm} BPM",
    "pre-chorus": "Filter open, clap entry, rising pad, {bpm} BPM",
    "chorus": "Wide house stack, sidechain pads, driving kick, {bpm} BPM",
    "bridge": "Breakdown: pads + vocal, kick mute, {bpm} BPM",
    "outro": "Kick fade, looping stab, long reverb, {bpm} BPM feel",
}
_FORGE_HOUSE_VOICE = {
    "intro": "soft breathy, club intimacy",
    "verse": "groove talk-sing, clear diction",
    "pre-chorus": "rising urgency, open vowels on words",
    "chorus": "anthemic house lead, doubled hook",
    "bridge": "close-mic emotional, sparse",
    "outro": "fade whisper on lexical line",
}
