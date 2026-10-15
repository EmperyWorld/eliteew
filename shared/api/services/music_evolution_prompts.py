# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Prompt builders for Music Evolution: creative brief, XL Base lyrics, and ACE tags.
# Invariants:
# - Prompts always state XL Base / v2_base scope and forbid Turbo/V3/DiffRhythm modes.
# - User-facing slots (`mood`, `meaning_tags`, `vocal`, `language`) are explicitly represented.
# Related:
# - api/services/music_evolution_pipeline.py
# - api/schemas/music_evolution.py
# ---
"""Prompt builders for the Music Evolution XL Base pipeline."""

from __future__ import annotations

import json
import re
from typing import Any


def _copy_nested_dict(payload: dict[str, Any], key: str) -> dict[str, Any]:
    raw = payload.get(key)
    return dict(raw) if isinstance(raw, dict) else {}


from api.routers.music_lyrics_validation import lyrics_section_labels_ordered_exact
from api.services.music_evolution_lyrics_craft import evolution_lyrics_system_craft_block
from api.services.music_evolution_soloists import (
    soloist_creative_rules,
    soloist_prompt_label,
    soloist_style_tag_hint,
)

ATYA_STORM_BPM_MIN = 168
ATYA_STORM_BPM_DEFAULT = 172
ATYA_STORM_BPM_MAX = 176
ATYA_REFERENCE_HOOK_PHRASE = "нас больше не будет"

MEANING_RU: dict[str, str] = {
    "love": "про любовь",
    "life": "про жизнь",
    "road": "про дорогу",
    "family": "про семью",
    "victory": "про победу",
    "loss": "про потерю",
    "city": "про город",
    "work": "про работу и дело",
    "friendship": "про дружбу",
    "irony": "с иронией",
    "faith": "про веру и внутреннюю опору",
    "custom": "по дополнительному смыслу пользователя",
}

MOOD_RU: dict[str, str] = {
    "warm": "тёплое",
    "sad": "грустное",
    "energetic": "энергичное",
    "dark": "тёмное",
    "ironic": "ироничное",
    "romantic": "романтичное",
    "epic": "эпичное",
    "calm": "спокойное",
    "custom": "особое настроение пользователя",
}


def _meaning_labels(tags: list[str], *, theme: str = "") -> str:
    labels = [MEANING_RU.get(tag, tag) for tag in tags if tag]
    if labels:
        return ", ".join(labels)
    clean_theme = (theme or "").strip()
    if clean_theme:
        return f"конкретная сцена из темы «{clean_theme[:80]}»"
    return "конкретная сцена без абстрактных клише"


def _resolved_vocal_label(vocal: str, *, normalized_input: dict[str, Any] | None = None) -> str:
    """Map UI vocal slot to a concrete ACE tag label (never ``auto`` in style tags)."""
    if normalized_input and normalized_input.get("vocal_effective"):
        return str(normalized_input["vocal_effective"]).strip().lower()
    key = (vocal or "auto").strip().lower()
    if key == "auto":
        return "female"
    return key


def _effective_vocal(normalized_input: dict[str, Any]) -> str:
    return str(normalized_input.get("vocal_effective") or normalized_input.get("vocal") or "female").strip().lower()


def _clamp_atya_storm_bpm(raw: Any) -> int:
    """Return a safe Atya storm BPM even when LLM recipe data is malformed."""
    try:
        value = int(raw)
    except TypeError, ValueError:
        value = ATYA_STORM_BPM_DEFAULT
    return max(ATYA_STORM_BPM_MIN, min(ATYA_STORM_BPM_MAX, value))


def _theme_is_short(theme: str) -> bool:
    words = [part for part in re.split(r"\s+", (theme or "").strip()) if part]
    return len(words) <= 3 and len(theme or "") <= 36


def _evolution_line_count_target(normalized_input: dict[str, Any]) -> int:
    """Keep sung-line budget aligned with golden XL Base duration corridors."""
    dur = int(normalized_input.get("duration_seconds") or 195)
    if dur <= 130:
        return 10
    if dur <= 195:
        return 14
    return 18


def _evolution_section_plan_for_duration(normalized_input: dict[str, Any]) -> list[str]:
    dur = int(normalized_input.get("duration_seconds") or 195)
    if dur <= 130:
        return ["Intro", "Verse 1", "Chorus", "Verse 2", "Outro"]
    if dur <= 195:
        return ["Intro", "Verse 1", "Chorus", "Verse 2", "Chorus", "Outro"]
    return ["Intro", "Verse 1", "Chorus", "Verse 2", "Bridge", "Chorus", "Outro"]


def _corpus_hint(corpus_snapshot: dict[str, Any]) -> str:
    items = corpus_snapshot.get("items") if isinstance(corpus_snapshot, dict) else None
    summary = corpus_snapshot.get("quality_summary") if isinstance(corpus_snapshot, dict) else None
    lines: list[str] = []
    if isinstance(summary, dict) and summary.get("liked_count"):
        median_sung = summary.get("median_sung_lines")
        median_dur = summary.get("median_duration_seconds")
        vocals = ", ".join(summary.get("common_vocals") or []) or "mixed"
        styles = ", ".join(summary.get("common_styles") or []) or "mixed"
        lines.append(
            f"Удачные XL Base треки пользователя (n={summary.get('liked_count')}): "
            f"ориентир ~{median_sung} строк для пения, ~{median_dur}s, vocal={vocals}, style={styles}. "
            "Держись этой плотности — не короче, вокал разборчивый."
        )
    if not isinstance(items, list) or not items:
        if lines:
            return "\n".join(lines)
        return "Нет близких XL Base рецептов; создай самостоятельный, конкретный и не клишированный трек."
    for item in items[:5]:
        if not isinstance(item, dict):
            continue
        if int(item.get("quality_signal") or 0) < 0:
            continue
        title = str(item.get("name") or item.get("content_id") or "track")[:80]
        style = str(item.get("style") or "unknown")
        sung = item.get("sung_line_count")
        vocal = str(item.get("vocal") or "")
        lines.append(
            f"- {title}: style={style}, vocal={vocal}, sung_lines={sung}, signal={item.get('quality_signal')} "
            "(hint only — не копируй текст)"
        )
    dislikes = [item for item in (items or []) if isinstance(item, dict) and int(item.get("quality_signal") or 0) < 0][
        :3
    ]
    for item in dislikes:
        reason = str(item.get("reason_code") or "quality")
        lines.append(f"- Избегать (dislike/{reason}): короткий skeleton, слабый вокал, клише.")
    return "\n".join(lines) if lines else "Корпус пуст после фильтрации XL Base."


def _soloist_rules(normalized_input: dict[str, Any]) -> str:
    soloist_id = str(normalized_input.get("soloist") or "ray")
    return soloist_creative_rules(soloist_id)


_PROMPT_GENRE_BPM: dict[str, int] = {
    "pop": 118,
    "techno": 130,
    "lofi_chill": 82,
    "phonk": 144,
    "jazz": 112,
    "electronic": 128,
    "house": 128,
    "trance": 138,
    "luna": 116,
    "drum_and_bass": 174,
    "hip_hop": 92,
    "rock": 112,
    "vocal_trance": 172,
    "edm": 128,
    "folk": 84,
    "chanson": 82,
    "alt_pop": 116,
    "indie_folk": 84,
    "duet_pop": 112,
    "cinematic": 82,
}

_SOLOIST_RECIPE_DEFAULTS: dict[str, dict[str, Any]] = {
    "pulse": {
        "primary_style": "Dark warehouse techno Pulse",
        "keyscale": "A minor",
        "instruments": ["four-on-the-floor kick", "rolling acid bassline", "metallic hi-hats", "sidechain pump"],
        "secondary_colors": ["hypnotic groove", "warehouse atmosphere", "driving energy"],
        "negative_tags": ["pop ballad", "acoustic guitar", "lo-fi whisper", "male lead"],
        "section_plan": ["Intro", "Verse 1", "Chorus", "Verse 2", "Outro"],
        "point_of_view": "first-person night warehouse drive",
        "tone": "focused female lead, dry and clear over techno bed",
    },
    "haze": {
        "primary_style": "Lo-fi chill Haze",
        "keyscale": "D minor",
        "instruments": ["vinyl crackle", "mellow rhodes", "lazy boom bap drums", "warm tape saturation"],
        "secondary_colors": ["intimate room", "rain mood", "soft night"],
        "negative_tags": ["EDM drop", "techno kick", "female lead", "scream"],
        "section_plan": ["Intro", "Verse 1", "Chorus", "Verse 2", "Outro"],
        "point_of_view": "first-person quiet night at home",
        "tone": "warm male vocal, intimate close-mic",
    },
    "grit": {
        "primary_style": "Memphis phonk Grit",
        "keyscale": "D minor",
        "instruments": ["distorted cowbell", "heavy 808 bass", "gritty lo-fi drums", "sample chop"],
        "secondary_colors": ["dark street", "aggressive energy", "night drive"],
        "negative_tags": ["jazz lounge", "female lead", "acoustic folk"],
        "section_plan": ["Intro", "Verse 1", "Chorus", "Verse 2", "Outro"],
        "point_of_view": "first-person street night adrenaline",
        "tone": "gritty low male vocal, raw but intelligible",
    },
    "ray": {
        "primary_style": "Modern Russian pop Ray",
        "keyscale": "A minor",
        "instruments": ["rhythmic piano", "supersaw hook", "tight kick", "layered harmonies"],
        "secondary_colors": ["bright hook", "clean mix", "uplift"],
        "negative_tags": ["techno warehouse", "lo-fi whisper", "phonk distortion"],
        "section_plan": ["Intro", "Verse 1", "Chorus", "Verse 2", "Chorus", "Outro"],
        "point_of_view": "first-person confident Russian pop address",
        "tone": "bright female vocal, crisp diction, hook-first",
    },
    "velvet": {
        "primary_style": "Smoky jazz lounge Velvet",
        "keyscale": "F major",
        "instruments": ["brushed drums", "upright bass", "piano comping", "soft sax pads"],
        "secondary_colors": ["swing feel", "smoky lounge", "warm room"],
        "negative_tags": ["EDM drop", "phonk 808", "scream"],
        "section_plan": ["Intro", "Verse 1", "Chorus", "Verse 2", "Outro"],
        "point_of_view": "first-person jazz club confession",
        "tone": "smoky expressive female vocal, swing phrasing",
    },
    "nova": {
        "primary_style": "Electronic dance Nova",
        "keyscale": "F minor",
        "instruments": ["atmospheric pads", "driving synth bass", "filtered drums", "sidechain pump"],
        "secondary_colors": ["club night", "yearning motion", "wide stereo"],
        "negative_tags": ["acoustic-only folk", "phonk cowbell", "male lead"],
        "section_plan": ["Intro", "Verse 1", "Chorus", "Verse 2", "Chorus", "Outro"],
        "point_of_view": "first-person electronic night movement",
        "tone": "breathy female vocal, clear over driving bed",
    },
    "nebula": {
        "primary_style": ("Vaporwave lo-fi psychedelic melancholy Nebula, Russian dream trip-hop, EMEW Luna lane"),
        "keyscale": "F# minor",
        "instruments": [
            "detuned synth haze",
            "trip-hop pulse",
            "lo-fi tape saturation",
            "enveloping sub bass",
            "chorus/flanger wash",
        ],
        "secondary_colors": ["psychedelic melancholy", "nocturnal scene", "half-whisper intimacy"],
        "negative_tags": [
            "bright radio pop",
            "festival EDM",
            "sterile polished mix",
            "scream",
            "power belting",
        ],
        "section_plan": ["Intro", "Verse 1", "Chorus", "Verse 2", "Bridge", "Chorus"],
        "point_of_view": "first-person night scene with quiet inner turn",
        "tone": "breathy close-mic female half-whisper, melancholic, intimate",
    },
    "ascent": {
        "primary_style": "Euphoric trance Ascent",
        "keyscale": "D minor",
        "instruments": ["supersaw lead", "rolling bassline", "four-on-the-floor kick", "snare roll build"],
        "secondary_colors": ["euphoric lift", "wide stereo", "peak energy"],
        "negative_tags": ["phonk", "lo-fi chill", "acoustic folk"],
        "section_plan": ["Intro", "Verse 1", "Build Up", "Chorus", "Verse 2", "Chorus", "Outro"],
        "point_of_view": "first-person flight above clouds",
        "tone": "ethereal female vocal, lifted and clear",
    },
    "ritm": {
        "primary_style": "Club house Ritm",
        "keyscale": "F minor",
        "instruments": ["four-on-the-floor kick", "piano stabs", "groovy bassline", "open hi-hats"],
        "secondary_colors": ["club energy", "groove", "night dancefloor"],
        "negative_tags": ["acoustic folk", "male lead", "jazz swing"],
        "section_plan": ["Intro", "Verse 1", "Chorus", "Verse 2", "Chorus", "Outro"],
        "point_of_view": "first-person club night freedom",
        "tone": "groovy confident female house vocal",
    },
    "tempest": {
        "primary_style": "Drum and bass duet Tempest",
        "keyscale": "D minor",
        "instruments": ["rolling breakbeat", "reese bass", "amen texture", "layered duet vocals"],
        "secondary_colors": ["high energy", "call-and-response", "peak drop"],
        "negative_tags": ["single lead only", "pop ballad", "child lead vocal"],
        "section_plan": [
            "Intro",
            "Verse 1 call-and-response",
            "Chorus together",
            "Verse 2 call-and-response",
            "Chorus together",
            "Outro",
        ],
        "point_of_view": "duet dialogue resolving into we/us over DnB drop",
        "tone": "male baritone and female airy duet, alternating then unified",
    },
}


def _as_text_list(value: Any, *, fallback: list[str] | None = None, max_items: int = 8) -> list[str]:
    items: list[str] = []
    if isinstance(value, list):
        source = value
    elif isinstance(value, tuple | set):
        source = list(value)
    elif isinstance(value, str) and value.strip():
        source = [part.strip() for part in value.split(",")]
    else:
        source = fallback or []
    for item in source:
        text = str(item).strip()
        if text and text not in items:
            items.append(text)
    return items[:max_items]


def _recipe_base_for_soloist(normalized_input: dict[str, Any]) -> dict[str, Any]:
    soloist_id = str(normalized_input.get("soloist") or "ray").strip().lower()
    if soloist_id in _SOLOIST_RECIPE_DEFAULTS:
        return dict(_SOLOIST_RECIPE_DEFAULTS[soloist_id])
    genre = str(normalized_input.get("genre") or "pop").strip().lower()
    vocal = _effective_vocal(normalized_input)
    return {
        "primary_style": genre.replace("_", " "),
        "keyscale": "C major",
        "instruments": ["clear lead vocal", "balanced rhythm section", "warm low end", "supporting harmony"],
        "secondary_colors": ["specific imagery", "natural vocal", "clear mix"],
        "negative_tags": ["auto vocal", "unrelated genre drift", "muddy vocal"],
        "section_plan": ["Verse 1", "Chorus", "Verse 2", "Bridge", "Chorus"],
        "point_of_view": f"{vocal} lead perspective",
        "tone": f"{vocal} vocal, natural articulation",
    }


def _theme_mentions_atya_reference_hook(theme: str) -> bool:
    return ATYA_REFERENCE_HOOK_PHRASE in (theme or "").lower().replace("ё", "е")


def _strip_atya_reference_hook_terms(terms: list[str]) -> list[str]:
    cleaned: list[str] = []
    for term in terms:
        low = term.lower().replace("ё", "е")
        if ATYA_REFERENCE_HOOK_PHRASE in low or ("ритмический повтор" in low and "нас больше" in low):
            continue
        cleaned.append(term)
    return cleaned


def _sanitize_atya_recipe_hooks(recipe: dict[str, Any], theme: str) -> dict[str, Any]:
    """Keep Atya hooks theme-native; do not inject Chekhova-style reference phrases by default."""
    out = dict(recipe)
    theme_text = (theme or "").strip()
    if not _theme_mentions_atya_reference_hook(theme_text):
        hook = str(out.get("hook_idea") or "")
        if ATYA_REFERENCE_HOOK_PHRASE in hook.lower().replace("ё", "е"):
            out["hook_idea"] = (
                f"{theme_text or 'главный образ'}: короткий припевный образ из слов темы, без чужих эталонных фраз"
            )[:500]

    lyrics_plan = _copy_nested_dict(out, "lyrics_plan")
    chorus_terms = _strip_atya_reference_hook_terms(_as_text_list(lyrics_plan.get("chorus_must_include"), fallback=[]))
    if not _theme_mentions_atya_reference_hook(theme_text):
        for term in _theme_anchor_terms(theme_text)[:3]:
            if term not in chorus_terms:
                chorus_terms.append(term)
    for required in ("шторм", "ветер"):
        if required not in chorus_terms:
            chorus_terms.append(required)
    lyrics_plan["chorus_must_include"] = chorus_terms[:5]
    out["lyrics_plan"] = lyrics_plan

    avoid = _as_text_list(out.get("avoid"), fallback=[])
    for item in (
        "чужие эталонные фразы",
        "цитирование чужих хитов",
        "повтор adult hook детским хором",
        "дословный повтор одной строки в каждом припеве",
    ):
        if item not in avoid:
            avoid.append(item)
    out["avoid"] = avoid[:12]
    return out


def _force_atya_storm_recipe(recipe: dict[str, Any]) -> dict[str, Any]:
    """Keep Atya from drifting into soft pop after LLM recipe merge."""
    out = dict(recipe)
    out["production_hint"] = (
        "Storm Russian vocal trance + drum and bass: 170–176 BPM, amen-style breakbeat, rolling DnB drums, "
        "Reese/sub bass pressure, trance pluck, supersaw storm build, mandatory background children choir "
        "behind adult female lead in chorus/bridge."
    )
    out["avoid"] = [
        item
        for item in _as_text_list(out.get("avoid"), fallback=[])
        if not re.search(r"(aggressive|агрессив\w*|choir|хор\w*|бит\w*|beats?)", item, flags=re.I)
    ]
    for item in ("попсовая мягкость", "ballad drift", "child lead vocal", "copied lyrics", "male lead"):
        if item not in out["avoid"]:
            out["avoid"].append(item)

    lyrics_plan = _copy_nested_dict(out, "lyrics_plan")
    lyrics_plan["section_plan"] = [
        "Intro storm",
        "Verse 1",
        "Pre-Chorus build",
        "Chorus DnB drop with background children choir",
        "Verse 2",
        "Bridge storm choir",
        "Chorus DnB drop with background children choir",
    ]
    lyrics_plan["point_of_view"] = "первое лицо: шторм/ураган/сила природы как образ внутренней правды"
    chorus_terms = _strip_atya_reference_hook_terms(_as_text_list(lyrics_plan.get("chorus_must_include"), fallback=[]))
    for required in ("шторм", "ветер"):
        if required not in chorus_terms:
            chorus_terms.append(required)
    lyrics_plan["chorus_must_include"] = chorus_terms[:5]
    out["lyrics_plan"] = lyrics_plan

    vocal_plan = _copy_nested_dict(out, "vocal_plan")
    vocal_plan["lead"] = "female"
    vocal_plan["tone"] = "adult fragile female lead, clean and piercing over storm DnB pressure"
    vocal_plan["diction"] = (
        "русская морфология без канцелярита; короткие ударные фразы, пригодные для повторяемого хука"
    )
    vocal_plan["section_voice"] = {
        "verse": "intimate adult female lead over rolling breakbeat",
        "chorus": "adult female hook with mandatory background children choir short storm phrase only",
    }
    out["vocal_plan"] = vocal_plan

    style_plan = _copy_nested_dict(out, "style_plan")
    style_plan["primary_style"] = "Storm Russian vocal trance drum and bass Atya"
    style_plan["bpm"] = _clamp_atya_storm_bpm(style_plan.get("bpm"))
    style_plan["keyscale"] = str(style_plan.get("keyscale") or "A minor / C minor")[:80]
    style_plan["instruments"] = [
        "amen-style breakbeat",
        "rolling DnB drums",
        "ghost snares",
        "Reese bass",
        "deep sub bass pressure",
        "supersaw trance pluck",
        "storm pads",
        "mandatory background children choir",
    ]
    style_plan["secondary_colors"] = ["hurricane energy", "force of nature", "rave storm", "minor trance hook"]
    positive = _as_text_list(style_plan.get("positive_tags"), fallback=[])
    for required in (
        "Storm Russian vocal trance drum and bass Atya",
        "172 BPM",
        "female vocal",
        "amen-style breakbeat",
        "rolling DnB drums",
        "Reese bass",
        "background children choir",
        "hurricane build",
    ):
        if not any(required.lower() in item.lower() for item in positive):
            positive.append(required)
    style_plan["positive_tags"] = positive[:12]
    style_plan["negative_tags"] = [
        "pop ballad",
        "soft electro-pop",
        "gentle lounge",
        "child lead vocal",
        "copied lyrics",
        "male lead",
        "folk-only acoustic",
    ]
    out["style_plan"] = style_plan
    return out


def _force_nebula_recipe(recipe: dict[str, Any], normalized_input: dict[str, Any]) -> dict[str, Any]:
    """Keep Nebula in the Luna dream/trip-hop lane, not generic pop uplift."""
    out = dict(recipe)
    theme = str(normalized_input.get("theme") or "главный образ").strip()
    hook_terms = _theme_anchor_terms(theme, str(out.get("hook_idea") or ""))
    hook_seed = ", ".join(hook_terms[:3]) or theme[:80] or "ночная свобода"
    out["production_hint"] = (
        "Vaporwave lo-fi psychedelic melancholy Nebula: 108–120 BPM, "
        "F# minor, detuned synth haze, trip-hop pulse, lo-fi tape saturation, "
        "enveloping bass, hypnotic drifting atmosphere, close-mic female half-whisper."
    )
    out["story_arc"] = "ночная конкретная сцена -> тихое внутреннее решение -> короткий мантровый припев без пафоса"
    out["hook_idea"] = (f"{hook_seed}: короткая личная мантра из темы, 1–2 простые фразы, не абстрактный лозунг")[:500]

    avoid = _as_text_list(out.get("avoid"), fallback=[])
    for item in (
        "абстрактные лозунги про свет/душу/миры без сцены",
        "мотивационная попса",
        "пафосный EDM-припев",
        "копирование строк или названий реальных песен",
        "слова production в sung lyrics",
    ):
        if item not in avoid:
            avoid.append(item)
    out["avoid"] = avoid[:12]

    lyrics_plan = _copy_nested_dict(out, "lyrics_plan")
    lyrics_plan["section_plan"] = [
        "Intro",
        "Verse 1",
        "Pre-Chorus",
        "Chorus",
        "Verse 2",
        "Bridge",
        "Chorus",
    ]
    lyrics_plan["point_of_view"] = (
        "первое лицо, интимно и просто: комната/окно/стекло/ночной город как сцена для внутренней свободы"
    )
    chorus_terms = _as_text_list(lyrics_plan.get("chorus_must_include"), fallback=[])
    for term in hook_terms[:3] or [theme[:80]]:
        if term and term not in chorus_terms:
            chorus_terms.append(term)
    lyrics_plan["chorus_must_include"] = chorus_terms[:5]
    try:
        line_count_target = int(lyrics_plan.get("line_count_target") or 12)
    except TypeError, ValueError:
        line_count_target = 12
    lyrics_plan["line_count_target"] = max(18, line_count_target)
    out["lyrics_plan"] = lyrics_plan

    vocal_plan = _copy_nested_dict(out, "vocal_plan")
    vocal_plan["lead"] = "female"
    vocal_plan["tone"] = "soft melancholic close-mic half-whisper, sleepy and intimate, no belting"
    vocal_plan["diction"] = (
        "простая разговорная русская фраза, томная и расслабленная; каждая строка поётся как интимный разговор"
    )
    vocal_plan["section_voice"] = {
        "verse": "detached close-mic half-whisper, natural spoken-sung phrasing",
        "chorus": "naive hypnotic mantra, muted wistful tone, no power belt",
    }
    out["vocal_plan"] = vocal_plan

    style_plan = _copy_nested_dict(out, "style_plan")
    style_plan["primary_style"] = (
        "Vaporwave lo-fi psychedelic melancholy Nebula, Russian dream trip-hop, EMEW Luna lane"
    )
    style_plan["bpm"] = max(108, min(120, int(style_plan.get("bpm") or 115)))
    style_plan["keyscale"] = "G minor"
    style_plan["instruments"] = [
        "detuned analog synth haze",
        "chorus/flanger wash",
        "nostalgic analog synths",
        "lo-fi tape saturation",
        "light electronic beat",
        "downtempo trip-hop pulse",
        "enveloping sub bass",
        "retro-disco shimmer",
    ]
    style_plan["secondary_colors"] = [
        "psychedelic melancholy",
        "90s nostalgia",
        "hypnotic drifting atmosphere",
        "wistful minor-key melancholy",
        "private nocturnal scene",
        "close-mic intimacy",
    ]
    positive = _as_text_list(style_plan.get("positive_tags"), fallback=[])
    for required in (
        "Vaporwave lo-fi psychedelic melancholy Nebula",
        "90s nostalgic soulful pop",
        "psychedelic melancholy",
        "G minor",
        "female close-mic half-whisper",
        "detuned analog synth haze",
        "chorus/flanger wash",
        "lo-fi tape saturation",
        "downtempo trip-hop pulse",
        "enveloping sub bass",
        "retro-disco haze",
    ):
        if not any(required.lower() in item.lower() for item in positive):
            positive.append(required)
    style_plan["positive_tags"] = positive[:14]
    style_plan["negative_tags"] = [
        "festival EDM",
        "scream",
        "howl",
        "aggressive lead",
        "bright radio pop",
        "sterile polished mix",
        "cheerful uplifting pop",
        "generic commercial production",
        "generic motivational pop",
        "abstract word salad",
        "copied real-song lyrics",
        "power belting",
    ]
    out["style_plan"] = style_plan
    return out


def _force_tempest_dnb_recipe(recipe: dict[str, Any]) -> dict[str, Any]:
    """Keep Tempest duet on drum-and-bass corridor (golden #10)."""
    out = dict(recipe)
    out["production_hint"] = (
        "Drum and bass duet Tempest: 170–176 BPM, rolling breakbeat, reese bass, "
        "male baritone + female airy duet, call-and-response verses, unified chorus."
    )
    lyrics_plan = _copy_nested_dict(out, "lyrics_plan")
    lyrics_plan["section_plan"] = [
        "Intro",
        "Verse 1 call-and-response",
        "Chorus together",
        "Verse 2 call-and-response",
        "Chorus together",
        "Outro",
    ]
    lyrics_plan["point_of_view"] = "дуэт: чередование male/female строк, припев на «мы»"
    out["lyrics_plan"] = lyrics_plan

    vocal_plan = _copy_nested_dict(out, "vocal_plan")
    vocal_plan["lead"] = "duet"
    vocal_plan["tone"] = "male baritone sharp + female airy, unified in chorus"
    out["vocal_plan"] = vocal_plan

    style_plan = _copy_nested_dict(out, "style_plan")
    style_plan["primary_style"] = "Drum and bass duet Tempest"
    try:
        bpm = int(style_plan.get("bpm") or 174)
    except TypeError, ValueError:
        bpm = 174
    style_plan["bpm"] = max(168, min(176, bpm))
    style_plan["keyscale"] = "D minor"
    style_plan["instruments"] = [
        "rolling breakbeat",
        "reese bass",
        "amen texture",
        "layered male female duet vocals",
    ]
    style_plan["negative_tags"] = ["single lead only", "pop ballad", "child lead vocal"]
    out["style_plan"] = style_plan
    return out


def _theme_anchor_terms(theme: str, hook: str = "") -> list[str]:
    raw = f"{theme} {hook}".lower()
    tokens = [
        part.strip(".,:;!?()[]«»\"'") for part in re.split(r"\s+", raw) if len(part.strip(".,:;!?()[]«»\"'")) >= 4
    ]
    stop = {"песня", "тема", "про", "about", "song", "track", "with", "для", "как", "что", "это"}
    out = [token for token in tokens if token not in stop]
    return list(dict.fromkeys(out))[:5]


def fallback_song_recipe(
    normalized_input: dict[str, Any], corpus_snapshot: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Build a deterministic song recipe when the LLM returns a weak or malformed plan."""
    corpus = corpus_snapshot or {}
    base = _recipe_base_for_soloist(normalized_input)
    theme = str(normalized_input.get("theme") or "главный образ").strip()
    meaning = _meaning_labels(list(normalized_input.get("meaning_tags") or []), theme=theme)
    mood = MOOD_RU.get(str(normalized_input.get("mood") or "warm"), str(normalized_input.get("mood") or "warm"))
    language = str(normalized_input.get("language") or "ru")
    vocal = _effective_vocal(normalized_input)
    genre = str(normalized_input.get("genre") or "pop").strip().lower()
    bpm = _PROMPT_GENRE_BPM.get(genre, 118)
    hook_terms = _theme_anchor_terms(theme)
    hook_idea = f"{theme}: короткий припевный образ без клише"
    line_target = _evolution_line_count_target(normalized_input)
    section_plan = _evolution_section_plan_for_duration(normalized_input)
    return {
        "angle": f"{theme} — {meaning}, настроение {mood}",
        "story_arc": "конкретная сцена -> внутренний поворот -> ясный финальный образ",
        "avoid": [
            "пустые мотивационные клише",
            "служебные production-слова в lyrics",
            "копирование прошлых рецептов",
            *base["negative_tags"][:3],
        ],
        "hook_idea": hook_idea,
        "production_hint": f"{base['primary_style']}, {mood}, {vocal} vocal",
        "lyrics_plan": {
            "language": language,
            "point_of_view": base["point_of_view"],
            "section_plan": section_plan,
            "chorus_must_include": hook_terms or [theme[:80]],
            "line_count_target": line_target,
        },
        "vocal_plan": {
            "lead": vocal,
            "tone": base["tone"],
            "diction": "clear natural articulation, singable phrasing",
            "section_voice": {
                "verse": f"{vocal} intimate storytelling",
                "chorus": f"{vocal} clear hook, emotionally lifted but controlled",
            },
        },
        "style_plan": {
            "primary_style": base["primary_style"],
            "secondary_colors": base["secondary_colors"],
            "bpm": bpm,
            "keyscale": base["keyscale"],
            "instruments": base["instruments"],
            "positive_tags": [
                base["primary_style"],
                f"{vocal} vocal" if vocal != "duet" else "male and female duet vocals",
                "clear vocal",
                "warm low end",
                *base["secondary_colors"][:3],
            ],
            "negative_tags": base["negative_tags"],
        },
        "corpus_selected_count": corpus.get("selected_count", 0),
    }


def _strip_json_fence(raw: str) -> str:
    text = (raw or "").strip()
    if not text.startswith("```"):
        return text
    text = re.sub(r"^```(?:json|python)?\s*", "", text, flags=re.I).strip()
    return re.sub(r"\s*```$", "", text).strip()


def _coerce_recipe_candidate(raw: str) -> dict[str, Any] | None:
    text = _strip_json_fence(raw)
    if not text:
        return None
    if not text.startswith("{"):
        start = text.find("{")
        if start >= 0:
            text = text[start:]
    end = text.rfind("}")
    if end >= 0:
        text = text[: end + 1]
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    nested = parsed.get("song_recipe")
    if isinstance(nested, dict):
        merged = {key: value for key, value in parsed.items() if key != "song_recipe"}
        merged.update(nested)
        return merged
    return parsed


def _merge_recipe_dict(base: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, value in candidate.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            nested = dict(out[key])
            nested.update({k: v for k, v in value.items() if v not in (None, "", [], {})})
            out[key] = nested
        elif value not in (None, "", [], {}):
            out[key] = value
    return out


def validate_song_recipe(recipe: dict[str, Any], normalized_input: dict[str, Any]) -> dict[str, Any]:
    """Normalize the song recipe contract so downstream prompt builders can trust it."""
    base = fallback_song_recipe(normalized_input, {"selected_count": recipe.get("corpus_selected_count", 0)})
    out = _merge_recipe_dict(base, recipe if isinstance(recipe, dict) else {})
    language = str(normalized_input.get("language") or base["lyrics_plan"]["language"])
    vocal = _effective_vocal(normalized_input)
    genre = str(normalized_input.get("genre") or "pop").strip().lower()

    lyrics_plan = _copy_nested_dict(out, "lyrics_plan")
    lyrics_plan["language"] = language
    lyrics_plan["section_plan"] = _as_text_list(
        lyrics_plan.get("section_plan"),
        fallback=list(base["lyrics_plan"]["section_plan"]),
        max_items=8,
    )
    if len(lyrics_plan["section_plan"]) < 3:
        lyrics_plan["section_plan"] = list(base["lyrics_plan"]["section_plan"])
    chorus_terms = _as_text_list(
        lyrics_plan.get("chorus_must_include"),
        fallback=list(base["lyrics_plan"]["chorus_must_include"]),
        max_items=5,
    )
    for term in _theme_anchor_terms(str(normalized_input.get("theme") or ""), str(out.get("hook_idea") or ""))[:2]:
        if term not in chorus_terms:
            chorus_terms.append(term)
    lyrics_plan["chorus_must_include"] = chorus_terms[:5] or list(base["lyrics_plan"]["chorus_must_include"])
    try:
        target = int(lyrics_plan.get("line_count_target") or 0)
    except TypeError, ValueError:
        target = 0
    lyrics_plan["line_count_target"] = max(
        8,
        min(24, target or _evolution_line_count_target(normalized_input)),
    )
    lyrics_plan["point_of_view"] = str(lyrics_plan.get("point_of_view") or base["lyrics_plan"]["point_of_view"])[:160]
    out["lyrics_plan"] = lyrics_plan

    vocal_plan = _copy_nested_dict(out, "vocal_plan")
    vocal_plan["lead"] = vocal
    vocal_plan["tone"] = str(vocal_plan.get("tone") or base["vocal_plan"]["tone"])[:180]
    vocal_plan["diction"] = str(vocal_plan.get("diction") or base["vocal_plan"]["diction"])[:160]
    section_voice = _copy_nested_dict(vocal_plan, "section_voice")
    vocal_plan["section_voice"] = {
        "verse": str(section_voice.get("verse") or base["vocal_plan"]["section_voice"]["verse"])[:160],
        "chorus": str(section_voice.get("chorus") or base["vocal_plan"]["section_voice"]["chorus"])[:160],
    }
    out["vocal_plan"] = vocal_plan

    style_plan = _copy_nested_dict(out, "style_plan")
    style_plan["primary_style"] = str(style_plan.get("primary_style") or base["style_plan"]["primary_style"])[:180]
    style_plan["secondary_colors"] = _as_text_list(
        style_plan.get("secondary_colors"),
        fallback=list(base["style_plan"]["secondary_colors"]),
        max_items=6,
    )
    style_plan["instruments"] = _as_text_list(
        style_plan.get("instruments"),
        fallback=list(base["style_plan"]["instruments"]),
        max_items=8,
    )
    style_plan["positive_tags"] = _as_text_list(
        style_plan.get("positive_tags"),
        fallback=list(base["style_plan"]["positive_tags"]),
        max_items=12,
    )
    style_plan["positive_tags"] = [
        re.sub(r"\bauto\b", vocal, item, flags=re.I).strip() for item in style_plan["positive_tags"] if item.strip()
    ]
    style_plan["negative_tags"] = _as_text_list(
        style_plan.get("negative_tags"),
        fallback=list(base["style_plan"]["negative_tags"]),
        max_items=10,
    )
    try:
        bpm = int(style_plan.get("bpm") or _PROMPT_GENRE_BPM.get(genre, 118))
    except TypeError, ValueError:
        bpm = _PROMPT_GENRE_BPM.get(genre, 118)
    style_plan["bpm"] = max(60, min(220, bpm))
    style_plan["keyscale"] = str(style_plan.get("keyscale") or base["style_plan"]["keyscale"])[:80]
    vocal_tag = f"{vocal} vocal" if vocal != "duet" else "male and female duet vocals"
    for required in (genre.replace("_", " "), vocal_tag, "clear vocal"):
        if required and not any(required.lower() in item.lower() for item in style_plan["positive_tags"]):
            style_plan["positive_tags"].append(required)
    out["style_plan"] = style_plan

    for key in ("angle", "story_arc", "hook_idea", "production_hint"):
        out[key] = str(out.get(key) or base[key])[:500]
    out["avoid"] = _as_text_list(out.get("avoid"), fallback=list(base["avoid"]), max_items=12)
    soloist_id = str(normalized_input.get("soloist") or "").strip().lower()
    theme_text = str(normalized_input.get("theme") or "").strip()
    if soloist_id == "nebula":
        out = _force_nebula_recipe(out, normalized_input)
    if soloist_id == "tempest":
        out = _force_tempest_dnb_recipe(out)
    if soloist_id in {"atya", "aurora"}:
        out = _sanitize_atya_recipe_hooks(out, theme_text)
        out = _force_atya_storm_recipe(out)
    return out


def parse_song_recipe_text(
    raw: str,
    normalized_input: dict[str, Any],
    corpus_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Parse LLM song recipe JSON with deterministic fallback and compatibility fields."""
    candidate = _coerce_recipe_candidate(raw or "")
    if not isinstance(candidate, dict):
        candidate = fallback_song_recipe(normalized_input, corpus_snapshot)
    merged = _merge_recipe_dict(fallback_song_recipe(normalized_input, corpus_snapshot), candidate)
    return validate_song_recipe(merged, normalized_input)


def build_song_recipe_messages(
    normalized_input: dict[str, Any], corpus_snapshot: dict[str, Any]
) -> list[dict[str, str]]:
    """Build messages for a structured song recipe that drives lyrics, vocal cues and ACE tags."""
    theme = str(normalized_input.get("theme") or "").strip()
    meaning = _meaning_labels(list(normalized_input.get("meaning_tags") or []), theme=theme)
    mood = MOOD_RU.get(str(normalized_input.get("mood") or "warm"), "тёплое")
    extra = str(normalized_input.get("extra_context") or "").strip()
    soloist_label = soloist_prompt_label(str(normalized_input.get("soloist")))
    deterministic = fallback_song_recipe(normalized_input, corpus_snapshot)
    schema_hint = {
        "angle": "...",
        "story_arc": "...",
        "avoid": ["..."],
        "hook_idea": "...",
        "production_hint": "...",
        "lyrics_plan": {
            "language": normalized_input.get("language"),
            "point_of_view": "...",
            "section_plan": ["Verse 1", "Chorus", "Verse 2", "Bridge", "Chorus"],
            "chorus_must_include": ["theme image", "hook phrase"],
            "line_count_target": 12,
        },
        "vocal_plan": {
            "lead": _effective_vocal(normalized_input),
            "tone": "...",
            "diction": "clear natural articulation",
            "section_voice": {"verse": "...", "chorus": "..."},
        },
        "style_plan": {
            "primary_style": "...",
            "secondary_colors": ["..."],
            "bpm": deterministic["style_plan"]["bpm"],
            "keyscale": deterministic["style_plan"]["keyscale"],
            "instruments": ["..."],
            "positive_tags": ["..."],
            "negative_tags": ["..."],
        },
    }
    return [
        {
            "role": "system",
            "content": (
                "Ты музыкальный продюсер и сонграйтер EliteEW Music Evolution. "
                "Ответ — валидный JSON-объект по схеме пользователя (сервер llama.cpp ограничивает синтаксис JSON). "
                "Не упоминай модели, Turbo, V3, DiffRhythm, Comfy, UGS или внутренний стек. "
                "JSON должен быть рецептом песни: драматургия, lyrics_plan, vocal_plan, style_plan. "
                "Свяжи солиста, настроение, смысловые теги, хук, вокальный план и ACE style tags в один непротиворечивый рецепт. "
                "Lyrics-план должен помогать реально петь: конкретные образы, припевный хук, 10–16 строк, без канцелярита. "
                "Style-план должен давать совместимые теги: вокал, BPM, key, instruments, sections, clear vocal. "
                "negative_tags — это то, чего нельзя допускать в итоговых тегах."
                f"{_soloist_rules(normalized_input)}"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Схема JSON:\n{json.dumps(schema_hint, ensure_ascii=False)}\n\n"
                f"Базовый безопасный рецепт, который можно улучшить, но нельзя ломать:\n"
                f"{json.dumps(deterministic, ensure_ascii=False)}\n\n"
                f"Солист: {soloist_label}\n"
                f"Тема: {theme}\n"
                f"Жанр: {normalized_input.get('genre')}\n"
                f"Вокал: {_effective_vocal(normalized_input)}\n"
                f"Язык: {normalized_input.get('language')}\n"
                f"Настроение: {mood}\n"
                f"Смыслы: {meaning}\n"
                f"Дополнительно: {extra or '—'}\n\n"
                f"Опыт прошлых XL Base песен (не копируй lyrics):\n{_corpus_hint(corpus_snapshot)}"
            ),
        },
    ]


def build_brief_messages(normalized_input: dict[str, Any], corpus_snapshot: dict[str, Any]) -> list[dict[str, str]]:
    """Build messages for a compact structured creative brief."""
    theme = str(normalized_input.get("theme") or "").strip()
    meaning = _meaning_labels(list(normalized_input.get("meaning_tags") or []), theme=theme)
    mood = MOOD_RU.get(str(normalized_input.get("mood") or "warm"), "тёплое")
    extra = str(normalized_input.get("extra_context") or "").strip()
    short_theme_rule = (
        "Тема короткая/разговорная: не раздувай в корпоративный эпос; сохрани буквальный дух темы"
        + (f" и контекста «{extra}»." if extra else " и формулировку темы.")
        + " hook_idea должна опираться на слова темы, а не только на abstract «жизнь/работа/победа»."
        if _theme_is_short(theme)
        else "Сохраняй конкретику темы; не подменяй её абстрактным мотивационным клише."
    )
    soloist_rules = _soloist_rules(normalized_input)
    soloist_label = soloist_prompt_label(str(normalized_input.get("soloist")))
    return [
        {
            "role": "system",
            "content": (
                "Ты музыкальный драматург EliteEW Music Evolution. "
                "Ответ — краткий JSON-объект (сервер llama.cpp ограничивает синтаксис JSON): "
                '{"angle":"...","story_arc":"...","avoid":["..."],"hook_idea":"...","production_hint":"..."}. '
                "Пиши по-русски. Внутри JSON-строк используй «ёлочки» или одинарные кавычки, не неэкранированные "
                "двойные кавычки. Не упоминай Turbo, V3, DiffRhythm, модели или внутренний стек. "
                "production_hint описывает настроение и аранжировку, но не требует грязи/дисторшна/металлического скрежета в миксе — "
                "вокал должен звучать естественно и разборчиво. "
                f"{short_theme_rule}{soloist_rules}"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Солист: {soloist_label}\n"
                f"Тема: {theme}\n"
                f"Жанр (фиксирован солистом): {normalized_input.get('genre')}\n"
                f"Вокал: {normalized_input.get('vocal')}\n"
                f"Язык: {normalized_input.get('language')}\n"
                f"Настроение: {mood}\n"
                f"Смыслы: {meaning}\n"
                f"Дополнительно: {extra or '—'}\n\n"
                f"Опыт прошлых песен:\n{_corpus_hint(corpus_snapshot)}"
            ),
        },
    ]


def build_lyrics_messages(
    normalized_input: dict[str, Any],
    brief: dict[str, Any],
    corpus_snapshot: dict[str, Any] | None = None,
) -> list[dict[str, str]]:
    """Build XL Base lyrics messages."""
    theme = str(normalized_input.get("theme") or "").strip()
    meaning = _meaning_labels(list(normalized_input.get("meaning_tags") or []), theme=theme)
    mood = MOOD_RU.get(str(normalized_input.get("mood") or "warm"), "тёплое")
    genre = str(normalized_input.get("genre") or "pop").strip().lower()
    vocal = _effective_vocal(normalized_input)
    soloist_extra = _soloist_rules(normalized_input)
    soloist_label = soloist_prompt_label(str(normalized_input.get("soloist")))
    language = str(normalized_input.get("language") or "ru")
    craft = evolution_lyrics_system_craft_block(
        language=language,
        soloist_id=str(normalized_input.get("soloist")),
    )
    corpus_block = _corpus_hint(corpus_snapshot or {})
    lyrics_plan = _copy_nested_dict(brief, "lyrics_plan")
    vocal_plan = _copy_nested_dict(brief, "vocal_plan")
    planned_sections = (
        ", ".join(_as_text_list(lyrics_plan.get("section_plan"), fallback=[]))
        or "Verse 1, Chorus, Verse 2, Bridge, Chorus"
    )
    chorus_terms = ", ".join(_as_text_list(lyrics_plan.get("chorus_must_include"), fallback=[])) or str(
        brief.get("hook_idea") or normalized_input.get("theme")
    )
    line_target = lyrics_plan.get("line_count_target") or _evolution_line_count_target(normalized_input)
    short_theme_lyrics_rule = (
        " Тема из одного-двух слов: не уходи в абстрактный эпос; используй буквальный образ темы в [Chorus]."
        if _theme_is_short(theme)
        else ""
    )
    compact_rule = f" Компактная форма: не более {line_target} строк для пения, без лишнего [Bridge] если не указан в section_plan."
    voice_annotation_note = (
        " Допускаются «(Voice: …)» и «(Arrangement: …)» на английском после заголовка секции."
        if genre in {"luna", "chanson", "alt_pop", "indie_folk", "duet_pop", "rock", "vocal_trance"}
        else ""
    )
    return [
        {
            "role": "system",
            "content": (
                "Создай lyrics для ACE Step XL Base. Нужны только слова вокала и секции в квадратных скобках: "
                "[Intro], [Verse 1], [Chorus], [Bridge] — не печатай Verse 1 или Chorus без скобок. "
                "Не добавляй production tags, markdown, объяснения, JSON или комментарии. "
                "Конкретные образы, развитие между куплетами, без пустых клише. "
                "Если тема пользователя обрывается на «как», «что», «и» — допиши мысль естественно, "
                "не повторяй обрыв дословно в каждом припеве. "
                "Запрещены в тексте для пения production-слова и жаргон: дисторшн, дроп, билд, synth, bass-line, "
                "sample, EDM как термин. Запрещены названия моделей и стека: ACE Step, XL Base, Turbo, Comfy, v2_base. "
                "Строки певучие, без канцелярита. "
                "Слово или явный образ из темы пользователя обязан появиться минимум один раз в [Chorus]. "
                "Не повторяй один и тот же припев дословно больше двух раз подряд. "
                "Следуй song_recipe: section_plan задаёт форму, chorus_must_include задаёт обязательный образ припева, "
                "vocal_plan задаёт манеру пения. Не печатай JSON и не объясняй план."
                f"{soloist_extra}{craft}{voice_annotation_note}{short_theme_lyrics_rule}{compact_rule}"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Солист: {soloist_label}\n"
                f"Тема: {normalized_input.get('theme')}\n"
                f"Жанр (фиксирован солистом): {normalized_input.get('genre')}\n"
                f"Вокал: {vocal}\n"
                f"Язык lyrics: {language}\n"
                f"Настроение: {mood}\n"
                f"Смыслы: {meaning}\n"
                f"Угол: {brief.get('angle')}\n"
                f"Арка: {brief.get('story_arc')}\n"
                f"Хук: {brief.get('hook_idea')}\n"
                f"Избегать: {', '.join(brief.get('avoid') or [])}\n\n"
                f"Song recipe lyrics_plan:\n"
                f"- point_of_view: {lyrics_plan.get('point_of_view')}\n"
                f"- section_plan: {planned_sections}\n"
                f"- chorus_must_include: {chorus_terms}\n"
                f"- line_count_target: {line_target}\n"
                f"Song recipe vocal_plan:\n"
                f"- lead: {vocal_plan.get('lead') or vocal}\n"
                f"- tone: {vocal_plan.get('tone')}\n"
                f"- diction: {vocal_plan.get('diction')}\n\n"
                f"Опыт XL Base:\n{corpus_block}"
            ),
        },
    ]


def build_style_messages(
    normalized_input: dict[str, Any], brief: dict[str, Any], lyrics: str, bpm: int
) -> list[dict[str, str]]:
    """Build English ACE arrangement tags messages for XL Base."""
    vocal = _resolved_vocal_label(str(normalized_input.get("vocal") or "auto"), normalized_input=normalized_input)
    genre = str(normalized_input.get("genre") or "pop")
    soloist_line = soloist_style_tag_hint(str(normalized_input.get("soloist")))
    soloist_label = soloist_prompt_label(str(normalized_input.get("soloist")))
    style_plan = _copy_nested_dict(brief, "style_plan")
    lyrics_plan = _copy_nested_dict(brief, "lyrics_plan")
    positive_tags = _as_text_list(style_plan.get("positive_tags"), fallback=[])
    negative_tags = _as_text_list(style_plan.get("negative_tags"), fallback=[])
    instruments = _as_text_list(style_plan.get("instruments"), fallback=[])
    section_plan = _as_text_list(lyrics_plan.get("section_plan"), fallback=[])
    lyrics_sections = lyrics_section_labels_ordered_exact(lyrics)
    lyrics_sections_line = (
        ", ".join(f"[{label}]" for label in lyrics_sections) if lyrics_sections else ", ".join(section_plan)
    )
    return [
        {
            "role": "system",
            "content": (
                "Generate English ACE Step 1.5 tags for XL Base. Return one compact comma-separated tag block. "
                "Include BPM, genre, vocal character, instruments, mix, then one production block per lyrics section "
                "in the exact same order and labels as lyrics (e.g. [Intro], [Verse 1], [Pre-Chorus], [Chorus], "
                "[Verse 2], [Chorus] — keep verse numbers, never collapse to generic [Verse]). "
                "For club genres include [Build Up] and [Drop]. "
                "Do not include lyrics, markdown, JSON, or explanations. "
                "Vocal tag must be female, male, or duet — never auto. "
                "Prefer natural vocal articulation, clear mix, warm low end — avoid harsh distortion, gritty grind, "
                "metallic artifacts unless genre is explicitly aggressive (hardstyle/industrial/metal). "
                "Use song_recipe.style_plan as the source of truth for primary style, instruments, key, BPM and compatible colors. "
                "Include positive_tags if musically compatible. Exclude negative_tags completely unless phrased as a clear safety negation. "
                f"Primary genre tag must match user genre '{genre}' (do not replace edm with unrelated industrial unless genre is industrial)."
                f"{soloist_line}"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Soloist: {soloist_label}\n"
                f"Genre: {genre}\n"
                f"Vocal: {vocal}\n"
                f"Mood: {normalized_input.get('mood')}\n"
                f"Meanings: {', '.join(normalized_input.get('meaning_tags') or [])}\n"
                f"BPM: {bpm}\n"
                f"Primary style: {style_plan.get('primary_style') or genre}\n"
                f"Key: {style_plan.get('keyscale')}\n"
                f"Instruments: {', '.join(instruments)}\n"
                f"Positive tags: {', '.join(positive_tags)}\n"
                f"Negative tags: {', '.join(negative_tags)}\n"
                f"Sections to mirror (exact labels and order): {lyrics_sections_line}\n"
                f"Brief: {brief}\n\nLyrics:\n{lyrics[:5000]}"
            ),
        },
    ]


def _lyrics_chorus_text(lyrics: str) -> str:
    lines = (lyrics or "").splitlines()
    collecting = False
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        if re.match(r"^\[chorus(?:\s+\d+)?\]", stripped, re.I):
            collecting = True
            continue
        if collecting and re.match(r"^\[[^\]]+\]", stripped):
            break
        if collecting and stripped and not (stripped.startswith("(") and stripped.endswith(")")):
            out.append(stripped)
    return " ".join(out).lower()


def validate_lyrics_against_song_recipe(lyrics: str, song_recipe: dict[str, Any]) -> list[dict[str, Any]]:
    """Guard that generated lyrics use the song recipe instead of leaking JSON or generic text."""
    errors: list[dict[str, Any]] = []
    text = lyrics or ""
    if re.search(r"```|^\s*\{|\}\s*$|\"lyrics_plan\"|\"style_plan\"|\"vocal_plan\"", text, re.I | re.M):
        errors.append(
            {
                "code": "lyrics_json_or_markdown_leak",
                "message": "Lyrics leaked JSON/markdown instead of sung text.",
            }
        )
    lyrics_plan = _copy_nested_dict(song_recipe, "lyrics_plan")
    required = _as_text_list(lyrics_plan.get("chorus_must_include"), fallback=[], max_items=6)
    chorus = _lyrics_chorus_text(text)
    terms: list[str] = []
    for item in required:
        terms.extend(_theme_anchor_terms(item))
    terms = list(dict.fromkeys(terms))
    if terms and chorus and not any(term in chorus for term in terms):
        errors.append(
            {
                "code": "lyrics_chorus_missing_recipe_hook",
                "message": "Chorus does not include the required theme/hook image from song_recipe.",
                "required_terms": terms[:6],
            }
        )
    return errors


def song_recipe_retry_user_message(song_recipe: dict[str, Any], errors: list[dict[str, Any]]) -> str:
    """Build a focused retry nudge when lyrics violate the recipe contract."""
    lyrics_plan = _copy_nested_dict(song_recipe, "lyrics_plan")
    chorus_terms = ", ".join(_as_text_list(lyrics_plan.get("chorus_must_include"), fallback=[]))
    codes = {str(error.get("code") or "") for error in errors}
    parts = [
        "Перепиши полный lyrics заново: только секции и строки для пения, без JSON, markdown и объяснений.",
    ]
    if "lyrics_chorus_missing_recipe_hook" in codes and chorus_terms:
        parts.append(f"В [Chorus] обязательно включи один из образов/слов: {chorus_terms}.")
    if "lyrics_json_or_markdown_leak" in codes:
        parts.append("Не выводи поля lyrics_plan/style_plan/vocal_plan — они только для внутреннего плана.")
    return " ".join(parts)


def _contains_forbidden_positive_tag(text: str, phrase: str) -> bool:
    token = phrase.strip().lower()
    if len(token) < 4:
        return False
    pattern = re.compile(rf"(?<![a-zа-яё0-9]){re.escape(token)}(?![a-zа-яё0-9])", flags=re.I)
    for match in pattern.finditer(text):
        prefix = text[max(0, match.start() - 18) : match.start()]
        if re.search(r"\b(no|without|forbidden|avoid)\s+$", prefix):
            continue
        return True
    return False


def validate_style_tags_against_song_recipe(
    tags: str,
    song_recipe: dict[str, Any],
    normalized_input: dict[str, Any],
    *,
    bpm: int,
) -> list[dict[str, Any]]:
    """Guard final ACE tags before XL Base dispatch."""
    errors: list[dict[str, Any]] = []
    text = (tags or "").lower()
    vocal = _effective_vocal(normalized_input)
    genre = str(normalized_input.get("genre") or "pop").strip().lower().replace("_", " ")
    if not text:
        return [{"code": "style_tags_empty", "message": "Style tags are empty."}]
    if re.search(r"\bauto\b", text):
        errors.append({"code": "style_tags_auto_vocal", "message": "Style tags still contain auto vocal."})
    if str(int(bpm)) not in text:
        errors.append({"code": "style_tags_missing_bpm", "message": "Style tags do not include final BPM."})
    if not re.search(r"\[verse\b", text) or not re.search(r"\[chorus\b", text):
        errors.append(
            {"code": "style_tags_missing_sections", "message": "Style tags must include [verse] and [chorus]."}
        )
    if vocal == "duet":
        if "duet" not in text and "male and female" not in text:
            errors.append(
                {"code": "style_tags_missing_duet_vocal", "message": "Duet vocal is missing from style tags."}
            )
    elif f"{vocal} vocal" not in text and f"{vocal} lead" not in text:
        errors.append({"code": "style_tags_missing_vocal", "message": f"{vocal} vocal is missing from style tags."})
    style_plan = _copy_nested_dict(song_recipe, "style_plan")
    primary = str(style_plan.get("primary_style") or genre).strip().lower()
    primary_tokens = [token for token in re.split(r"[^a-zа-яё0-9#]+", primary) if len(token) >= 4][:4]
    if primary_tokens and not any(token in text for token in primary_tokens):
        errors.append(
            {
                "code": "style_tags_missing_primary_style",
                "message": "Style tags do not include the recipe primary style.",
                "primary_style": primary,
            }
        )
    for phrase in _as_text_list(style_plan.get("negative_tags"), fallback=[], max_items=10):
        if _contains_forbidden_positive_tag(text, phrase.lower()):
            errors.append(
                {
                    "code": "style_tags_forbidden_recipe_tag",
                    "message": f"Forbidden recipe tag leaked into final tags: {phrase}",
                    "tag": phrase,
                }
            )
            break
    return errors
