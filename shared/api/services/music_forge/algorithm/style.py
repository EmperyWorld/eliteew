# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MusicForge style resolution: vocal gender, genre keys, BPM, caption capsule, and forge-owned enrich profiles.
# Invariants:
# - Arrangement/Voice enrich BPM must equal style_capsule / tags / Comfy bpm (no soloist clamp override).
# - Lead vocal gender priority: explicit intent → caption → genre default → blueprint → corpus.
# - AceStep caption stays hierarchical and sparse (BPM/vocal/genre → rhythm → bass → lead → ≤1 texture);
#   stacking sidechain+acid+granular+sub in one section causes muddy spectral collapse.
# Related:
# - api/services/music_forge/algorithm/constants.py
# - api/services/music_evolution_vocal.py
# - documentation/product/MUSIC-FORGE-IDEAL-TOP-SONG-CANON.md
# ---

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

from api.services.music_forge.algorithm.constants import (
    _BPM_EXTRACT_RE,
    _CAPTION_SECTION_SKELETON,
    _FORGE_DNB_ARRANGEMENT,
    _FORGE_DNB_VOICE,
    _FORGE_HOUSE_ARRANGEMENT,
    _FORGE_HOUSE_VOICE,
    _FORGE_INDIE_ARRANGEMENT,
    _FORGE_INDIE_VOICE,
    _FORGE_LOFI_ARRANGEMENT,
    _FORGE_LOFI_VOICE,
    _STYLE_DEFAULT_VOCAL,
    _STYLE_KEYSCALE,
    MUSIC_FORGE_ANTI_WAIL_NEGATIVE_PROMPT,
)
from api.utils.llm_json_extract import strip_llm_thinking_prefix

if TYPE_CHECKING:
    from api.services.music_forge.config import MusicForgeConfigBundle

# Hard cap after Ideal-TOP audit: dense 1600-char production prose collapses AceStep mix.
ACE_STYLE_CAPTION_MAX_CHARS = 720
# Production FX terms that must not stack in the same caption (semantic overload → muddy mix).
_ACE_CAPTION_OVERLOAD_TERMS = (
    "sidechain",
    "side-chain",
    "side chained",
    "granular",
    "acid bass",
    "acid",
    "sub-bass",
    "sub bass",
    "four-on-the-floor",
    "four on the floor",
    "pluck synth",
    "supersaw",
    "reverb-heavy",
    "stereo synth",
)


def infer_vocal_from_text(text: str) -> str | None:
    """Extract male/female/duet from free-text caption / identity (None if ambiguous)."""
    probe = (text or "").lower()
    if not probe.strip():
        return None
    if re.search(r"\bduet\b", probe) or "дуэт" in probe:
        return "duet"
    male_hit = bool(re.search(r"\bmale\b", probe) or "мужск" in probe or "baritone" in probe or "tenor" in probe)
    female_hit = bool(re.search(r"\bfemale\b", probe) or "женск" in probe or "mezzo" in probe or "soprano" in probe)
    if male_hit and not female_hit:
        return "male"
    if female_hit and not male_hit:
        return "female"
    return None


def resolve_music_forge_vocal(
    intent: dict[str, Any],
    blueprint: dict[str, Any],
    corpus: dict[str, Any] | None = None,
    *,
    style_caption: str | None = None,
    style_key: str | None = None,
) -> str:
    """
    Resolve lead vocal for ACE tags + Voice lines.

    Priority (cause of gender mush): explicit intent → caption → genre default →
    blueprint → liked corpus (last, never override a clearer signal).
    """
    intent_probe = " ".join(
        [
            str(intent.get("constraints") or ""),
            str(intent.get("style_hint") or ""),
            str(intent.get("idea") or ""),
        ]
    )
    from_intent = infer_vocal_from_text(intent_probe)
    if from_intent:
        return from_intent

    from_caption = infer_vocal_from_text(style_caption or "")
    if from_caption:
        return from_caption

    sk = (style_key or "").strip().lower()
    if sk in _STYLE_DEFAULT_VOCAL:
        return _STYLE_DEFAULT_VOCAL[sk]

    from_blueprint = infer_vocal_from_text(str(blueprint.get("vocal_identity") or ""))
    if from_blueprint:
        return from_blueprint

    for item in (corpus or {}).get("items") or []:
        if not isinstance(item, dict) or int(item.get("quality_signal") or 0) <= 0:
            continue
        vocal = str(item.get("vocal") or "").strip().lower()
        if vocal in {"male", "female", "duet"}:
            return vocal
    return "female"


def align_style_caption_to_vocal(caption: str, vocal: str) -> str:
    """Force one lead-vocal gender in the ACE style caption."""
    v = vocal if vocal in {"male", "female", "duet"} else "female"
    text = caption or ""
    replacement = "duet (male and female) lead vocal" if v == "duet" else f"{v} lead vocal"
    text = re.sub(
        r"\b(?:intimate,\s*)?(?:breathy\s+)?(?:male|female)\s+lead\s+vocal\b",
        replacement,
        text,
        flags=re.I,
    )
    text = re.sub(r"\b(?:male|female)\s+vocal\b", f"{v} vocal" if v != "duet" else "duet vocal", text, flags=re.I)
    if v != "duet" and f"{v} vocal" not in text.lower() and "lead vocal" not in text.lower():
        text = f"{text.rstrip('. ')}. {replacement}."
    return " ".join(text.split())


def slim_ace_style_caption(caption: str) -> str:
    """
    Keep AceStep caption hierarchical and sparse.

    Drop stacked production FX jargon (sidechain+acid+granular+…) that collapses the mix into mud.
    At most one overload term is kept for the whole caption (longest match wins at a span;
    nested shorter terms like ``acid`` inside ``acid bass`` do not erase the kept phrase).
    """
    text = " ".join((caption or "").split())
    if not text:
        return text

    def _token_span(start: int, end: int) -> tuple[int, int]:
        left = start
        while left > 0 and not text[left - 1].isspace():
            left -= 1
        right = end
        while right < len(text) and not text[right].isspace():
            right += 1
        return left, right

    # Longest-first so "acid bass" claims its span before nested "acid".
    terms_by_len = sorted(set(_ACE_CAPTION_OVERLOAD_TERMS), key=len, reverse=True)
    candidates: list[tuple[int, int]] = []
    occupied: list[tuple[int, int]] = []
    for term in terms_by_len:
        for match in re.finditer(re.escape(term), text, flags=re.I):
            span = _token_span(match.start(), match.end())
            if any(not (span[1] <= left or span[0] >= right) for left, right in occupied):
                continue
            occupied.append(span)
            candidates.append(span)

    if candidates:
        # Prefer the most specific (longest) overload; tie-break earliest in caption.
        # Earliest-only keep left "acid then and" when a later "acid bass" was stripped.
        keep_start, keep_end = min(
            candidates,
            key=lambda item: (-(item[1] - item[0]), item[0]),
        )
        for start, end in sorted(candidates, key=lambda item: item[0], reverse=True):
            if start == keep_start and end == keep_end:
                continue
            text = f"{text[:start]} {text[end:]}".strip()

    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"\s+([,.])", r"\1", text)
    # Drop glue left by mid-caption FX removal ("then and", trailing "and").
    for _ in range(3):
        text = re.sub(
            r"\b(and|then|with|or)\s+(and|then|with|or)\b",
            r"\1",
            text,
            flags=re.I,
        )
    text = re.sub(r"(\[[^\]]+\])\s+(?:and|then|with|or)\b", r"\1", text, flags=re.I)
    text = re.sub(r"\s+(?:and|then|with|or)\s*([,.])", r"\1", text, flags=re.I)
    text = re.sub(r"\s+(?:and|then|with|or)\s*$", "", text, flags=re.I)
    return " ".join(text.split())[:ACE_STYLE_CAPTION_MAX_CHARS]


_VOICE_ENRICH_LINE_RE = re.compile(r"^(\(Voice:\s*)([^)]*)(\)\s*)$", re.I)
_OPPOSITE_GENDER = {"male": "female", "female": "male"}


def lock_voice_enrich_lines_to_vocal(lyrics: str, vocal: str) -> str:
    """Rewrite every ``(Voice: …)`` line so lead gender matches intent (no male+female mush)."""
    v = vocal if vocal in {"male", "female", "duet"} else "female"
    out: list[str] = []
    for line in (lyrics or "").splitlines():
        stripped = line.strip()
        match = _VOICE_ENRICH_LINE_RE.match(stripped)
        if not match:
            out.append(line)
            continue
        body = match.group(2).strip()
        if v == "duet":
            if "duet" not in body.lower() and not ("male" in body.lower() and "female" in body.lower()):
                body = f"duet (male and female), {body}".strip(", ")
        else:
            opposite = _OPPOSITE_GENDER[v]
            body = re.sub(rf"\b{opposite}\b", v, body, flags=re.I)
            body = re.sub(r"\bduet\b", v, body, flags=re.I)
            if v not in body.lower():
                body = f"{v}, {body}".strip(", ")
            # Collapse duplicated lead gender after opposite→intent rewrite.
            body = re.sub(rf"\b{v}\s*,\s*{v}\b", v, body, flags=re.I)
            body = re.sub(rf"\b{v}\s+and\s+{v}\b", v, body, flags=re.I)
            body = re.sub(rf"\b{v}\s*/\s*{v}\b", v, body, flags=re.I)
            body = re.sub(rf"\b{v}/{v}\b", v, body, flags=re.I)
        out.append(f"{match.group(1)}{body}{match.group(3)}")
    return "\n".join(out)


def infer_music_forge_style_key(intent: dict[str, Any], blueprint: dict[str, Any]) -> str:
    """Map free-text arrangement/style to studio MUSIC_STYLE keys (not a coarse bucket)."""
    probe = " ".join(
        [
            str(blueprint.get("arrangement") or ""),
            str(intent.get("style_hint") or ""),
            str(intent.get("idea") or ""),
        ]
    ).lower()
    if any(word in probe for word in ("drum and bass", "drum&bass", "dnb", "jungle", "breakbeat")):
        return "drum and bass"
    if "phonk" in probe:
        return "phonk"
    if any(word in probe for word in ("lofi", "lo-fi", "лофай", "lofi_chill")):
        return "lofi_chill"
    if any(word in probe for word in ("hip hop", "hip-hop", "hip_hop", "rap", "рэп", "хип")):
        return "hip_hop"
    if "synthwave" in probe or "синтивав" in probe:
        return "synthwave"
    if "dubstep" in probe or "дабстеп" in probe:
        return "dubstep"
    if "metal" in probe or "метал" in probe:
        return "metal"
    if any(word in probe for word in ("r&b", "rnb", "soul", "соул")):
        return "rnb_classic_female"
    if "reggaeton" in probe or "реггетон" in probe:
        return "reggaeton"
    if "afrobeat" in probe:
        return "afrobeats"
    if "k-pop" in probe or "kpop" in probe or "кей-поп" in probe:
        return "kpop"
    if "house" in probe:
        return "house"
    if "techno" in probe:
        return "techno"
    if "trance" in probe:
        return "trance"
    if any(word in probe for word in ("edm", "big room")):
        return "edm"
    if "indie" in probe:
        return "indie_rock"
    if "rock" in probe or "рок" in probe:
        return "rock"
    if any(word in probe for word in ("ballad", "баллада", "piano ballad")):
        return "ballad"
    if any(word in probe for word in ("electronic", "электро", "dance", "танц")):
        return "electronic"
    return "pop"


def music_forge_keyscale_for_style(
    style_key: str,
    *,
    language: str = "ru",
    config: MusicForgeConfigBundle | None = None,
) -> str:
    sk = (style_key or "pop").strip().lower() or "pop"
    if config is not None:
        profile = config.styles.get(sk)
        if profile and profile.get("keyscale"):
            return str(profile["keyscale"])
    if sk in _STYLE_KEYSCALE:
        return _STYLE_KEYSCALE[sk]
    return "A minor" if (language or "ru").startswith("ru") else "C major"


def music_forge_soloist_for_render(*, vocal: str, style_key: str) -> str | None:
    """
    Evolution soloist id for enrich, or None when Forge-owned profiles must be used
    (lofi/indie/dnb/house TOP-shaped arrangement lines).
    """
    sk = (style_key or "pop").strip().lower()
    v = (vocal or "female").strip().lower()
    if sk in {"lofi_chill", "indie_rock", "indie_folk_pop", "drum and bass", "house"}:
        return None
    if sk in {"dubstep", "phonk", "edm", "hardstyle"}:
        return "grit" if v == "male" else "pulse"
    if sk in {"ballad", "ambient_instrumental"}:
        return "haze"
    if sk in {"techno", "trance", "electronic"}:
        return "ritm" if v != "male" else "pulse"
    if v == "male":
        return "grit"
    if v == "duet":
        return "ray"
    return "ray"


def forge_voice_and_arrangement_profiles(style_key: str) -> tuple[dict[str, str], dict[str, str]]:
    """Return forge-owned Voice/Arrangement profile maps for genres that skip Evolution soloist."""
    sk = (style_key or "pop").strip().lower()
    if sk == "lofi_chill":
        return _FORGE_LOFI_VOICE, _FORGE_LOFI_ARRANGEMENT
    if sk == "drum and bass":
        return _FORGE_DNB_VOICE, _FORGE_DNB_ARRANGEMENT
    if sk == "house":
        return _FORGE_HOUSE_VOICE, _FORGE_HOUSE_ARRANGEMENT
    return _FORGE_INDIE_VOICE, _FORGE_INDIE_ARRANGEMENT


def _default_section_textures(style_key: str, *, config: MusicForgeConfigBundle | None = None) -> dict[str, str]:
    sk = (style_key or "pop").strip().lower()
    if config is not None:
        profile = config.styles.get(sk)
        if profile and isinstance(profile.get("textures"), dict) and profile["textures"]:
            return {str(k): str(v) for k, v in profile["textures"].items()}
    if sk == "drum and bass":
        return {
            "intro": "amen chop filter, Reese sub swell",
            "verse": "rolling breaks, dark Reese bass, sparse snare",
            "pre": "snare roll build, rising noise",
            "chorus": "full amen energy, supersaw stab, heavy sub",
            "verse2": "tighter breaks, bass growl",
            "pre2": "longer snare roll, white noise riser",
            "chorus2": "maximal break energy, layered stabs",
            "bridge": "half-time break, vocal focus",
            "chorus3": "full power return, wide stereo",
            "outro": "breaks dissolve, long reverb, sub fade",
        }
    if sk == "house":
        return {
            "intro": "kick and filtered pad",
            "verse": "bassline, light hats",
            "pre": "filter open, clap entry",
            "chorus": "driving kick, warm pads, clear lead vocal",
            "verse2": "bass groove, shaker",
            "pre2": "filter sweep",
            "chorus2": "fuller pads, forward vocal",
            "bridge": "pads and vocal only",
            "chorus3": "full stack, strong vocal",
            "outro": "kick fade, soft pad",
        }
    return {
        "intro": "soft pad, light kick",
        "verse": "bass, sparse drums, clear lead vocal",
        "pre": "rising pad, kick entry",
        "chorus": "pads, steady drums, forward lead vocal",
        "verse2": "bass focus, light percussion",
        "pre2": "build into chorus",
        "chorus2": "wider pads, strong lead vocal",
        "bridge": "stripped pads, close-mic vocal",
        "chorus3": "full return, clear vocal",
        "outro": "pad decay, soft fade",
    }


def _ensure_top_caption_arc(
    caption: str,
    *,
    style_key: str,
    bpm: int,
    vocal: str,
    config: MusicForgeConfigBundle | None = None,
) -> str:
    """Guarantee TOP-like section markers exist; Title Case to match lyrics `[Intro]`/`[Verse]`."""
    from api.services.music_evolution_vocal import capitalize_ace_section_tags_in_style

    text = " ".join((caption or "").split())
    if not re.search(r"\[\s*intro\s*\]", text, flags=re.I):
        textures = _default_section_textures(style_key, config=config)
        skeleton = _CAPTION_SECTION_SKELETON.format(**textures)
        lead = f"{bpm} BPM, {vocal} vocal, {style_key}"
        text = f"{lead}, {text}. {skeleton}" if text else f"{lead}, {skeleton}"
    if not re.match(r"(?i)^style\s*:", text):
        text = f"Style: {text}"
    text = capitalize_ace_section_tags_in_style(text)
    return slim_ace_style_caption(text)


def _extract_bpm_from_text(text: str) -> int | None:
    match = _BPM_EXTRACT_RE.search(text or "")
    if not match:
        return None
    value = int(match.group(1))
    if 60 <= value <= 200:
        return value
    return None


def _estimate_bpm(intent: dict[str, Any], blueprint: dict[str, Any], caption: str) -> int:
    for source in (
        caption,
        str(intent.get("style_hint") or ""),
        str(blueprint.get("arrangement") or ""),
        str(intent.get("idea") or ""),
    ):
        extracted = _extract_bpm_from_text(source)
        if extracted is not None:
            return extracted
    probe = " ".join(
        [
            str(intent.get("idea") or ""),
            str(intent.get("style_hint") or ""),
            str(blueprint.get("arrangement") or ""),
            caption,
        ]
    ).lower()
    if any(word in probe for word in ("drum and bass", "drum&bass", "dnb", "jungle", "breakbeat")):
        return 174
    if any(word in probe for word in ("techno", "trance", "edm", "dance", "house", "рейв")):
        return 128
    if any(word in probe for word in ("fast", "uptempo", "быстр", "drive", "драйв")):
        return 140
    if any(word in probe for word in ("ballad", "piano", "sad", "грусть", "баллада")):
        return 84
    if any(word in probe for word in ("rock", "рок")):
        return 124
    return 112


def build_style_capsule(
    raw_text: str,
    intent: dict[str, Any],
    blueprint: dict[str, Any],
    *,
    config: MusicForgeConfigBundle | None = None,
) -> dict[str, Any]:
    """Normalize style caption + creative fields. KSampler/ACE knobs come from Mode→lane later."""
    caption = strip_llm_thinking_prefix(raw_text or "").strip()
    caption = re.sub(r"```(?:\w+)?", "", caption).replace("```", "").strip()
    if not caption or caption.lstrip().startswith(("{", "[")):
        caption = str(blueprint.get("arrangement") or "modern emotional pop, natural lead vocal, clean mix").strip()
    caption = re.sub(r"\b(ACE|ComfyUI|workflow|sampler|LoRA|model)\b", "", caption, flags=re.I)
    caption = slim_ace_style_caption(" ".join(caption.split()))
    bpm = _estimate_bpm(intent, blueprint, caption)
    style_key = infer_music_forge_style_key(intent, blueprint)
    keyscale = music_forge_keyscale_for_style(
        style_key,
        language=str(intent.get("language") or "ru"),
        config=config,
    )
    vocal_guess = "female"
    caption = _ensure_top_caption_arc(
        caption,
        style_key=style_key,
        bpm=bpm,
        vocal=vocal_guess,
        config=config,
    )
    caption = slim_ace_style_caption(caption)
    negative_prompt = config.negative_prompt if config is not None else MUSIC_FORGE_ANTI_WAIL_NEGATIVE_PROMPT
    # Do not copy default (SFT) lane.sampler here — that polluted Turbo/Base renders.
    return {
        "caption": caption,
        "bpm": bpm,
        "keyscale": keyscale,
        "style_key": style_key,
        "vocal": vocal_guess,
        "negative_prompt": negative_prompt,
        "timesignature": "4",
    }
