# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Golden-validation soloist presets for Music Evolution (Студия песен) — 10 locked style anchors.
# Invariants:
# - Ten soloists map 1:1 to golden_validation_2026-06-24 scenarios; no freeform «Тень».
# - ``nebula`` maps to internal genre ``luna`` (v4 Luna LoRA lane); UI label «Туманность».
# - Unknown soloist ids fall back to ``ray`` (pop default).
# Related:
# - host/comfyui/golden_validation_2026-06-24/manifest.json
# - api/services/music_evolution_pipeline.py
# ---
"""Music Evolution golden soloist catalog (10 styles)."""

from __future__ import annotations

from dataclasses import dataclass

from api.schemas.music_evolution import MusicEvolutionRunCreate, MusicEvolutionSoloistOption

GOLDEN_SOLOIST_IDS: tuple[str, ...] = (
    "pulse",
    "haze",
    "grit",
    "ray",
    "velvet",
    "nova",
    "nebula",
    "ascent",
    "ritm",
    "tempest",
)

DEFAULT_SOLOIST_ID = "ray"
SOLOIST_ANCHOR_IDS = frozenset(GOLDEN_SOLOIST_IDS)

# Golden lane mood — derived from soloist, not user chips (see apply_soloist_to_run_create).
SOLOIST_DEFAULT_MOOD: dict[str, str] = {
    "pulse": "energetic",
    "haze": "calm",
    "grit": "dark",
    "ray": "warm",
    "velvet": "romantic",
    "nova": "energetic",
    "nebula": "romantic",
    "ascent": "epic",
    "ritm": "energetic",
    "tempest": "energetic",
}

_BASE_WORKFLOW: dict[str, object] = {
    "ugs_workflow": "v2_base",
    "ace_workflow": "v2_base",
    "model_scope": "xl_base",
    "workflow_file": "Musicv2_base.json",
    "ksampler_use_comfy_template": True,
}

# Matches ``host/comfyui/golden_validation_2026-06-24/manifest.json``.
# The public app still exposes "soloists"; backend routes each lane to the
# workflow/model family that actually produced the accepted golden reference.
_SOLOIST_WORKFLOW_OVERRIDES: dict[str, dict[str, object]] = {
    "pulse": _BASE_WORKFLOW,
    "haze": _BASE_WORKFLOW,
    "grit": _BASE_WORKFLOW,
    "ray": _BASE_WORKFLOW,
    "tempest": _BASE_WORKFLOW,
    "velvet": {
        "ugs_workflow": "v2_sft",
        "ace_workflow": "v2_sft",
        "model_scope": "xl_sft",
        "workflow_file": "Musicv2_sft.json",
        "ksampler_use_comfy_template": True,
    },
    "nova": {
        "ugs_workflow": "v4",
        "ace_workflow": "v4",
        "model_scope": "xl_sft",
        "workflow_file": "ace_sft_new.json",
        "ksampler_use_comfy_template": False,
    },
    "nebula": {
        "ugs_workflow": "v4",
        "ace_workflow": "v4_luna",
        "model_scope": "xl_sft_lora",
        "workflow_file": "v4_luna_ace_sft_xl.json",
        "v4_soloist": "luna",
        "ksampler_use_comfy_template": False,
    },
    "ascent": {
        "ugs_workflow": "v2",
        "ace_workflow": "v2",
        "model_scope": "xl_turbo",
        "workflow_file": "Musicv2.json",
        "ksampler_use_comfy_template": False,
    },
    "ritm": {
        "ugs_workflow": "v5",
        "ace_workflow": "v5",
        "model_scope": "xl_sft_lora",
        "workflow_file": "BIG_XL_SFT.json",
        "ksampler_use_comfy_template": False,
    },
}

_LEGACY_SOLOIST_ALIASES: dict[str, str] = {
    "lula": "nebula",
    "atya": "tempest",
    "rook": "grit",
    "mira": "ritm",
    "sage": "haze",
    "shadow": "ray",
    "vera": "velvet",
    "nika": "ray",
    "yana": "haze",
    "aurora": "tempest",
}


@dataclass(frozen=True, slots=True)
class MusicEvolutionSoloistDef:
    id: str
    label_ru: str
    label_en: str
    description_ru: str
    vocal: str
    language: str
    genre: str
    genre_label_ru: str
    golden_scenario: str
    freeform: bool = False


SOLOISTS: dict[str, MusicEvolutionSoloistDef] = {
    "pulse": MusicEvolutionSoloistDef(
        id="pulse",
        label_ru="Пульс",
        label_en="Pulse",
        description_ru=(
            "Dark warehouse techno: женский lead, four-on-the-floor, acid bass, 130 BPM, "
            "гипнотический groove без pop-drift."
        ),
        vocal="female",
        language="ru",
        genre="techno",
        genre_label_ru="Techno",
        golden_scenario="01_techno_xl_base",
    ),
    "haze": MusicEvolutionSoloistDef(
        id="haze",
        label_ru="Туман",
        label_en="Haze",
        description_ru=("Lo-fi chill: тёплый мужской голос, vinyl crackle, mellow Rhodes, lazy boom bap, ~82 BPM."),
        vocal="male",
        language="ru",
        genre="lofi_chill",
        genre_label_ru="Lo-fi chill",
        golden_scenario="02_lofi_xl_base",
    ),
    "grit": MusicEvolutionSoloistDef(
        id="grit",
        label_ru="Грит",
        label_en="Grit",
        description_ru=("Memphis phonk: gritty male vocal, cowbell hook, distorted 808, dark street mood, ~144 BPM."),
        vocal="male",
        language="ru",
        genre="phonk",
        genre_label_ru="Phonk",
        golden_scenario="03_phonk_xl_base",
    ),
    "ray": MusicEvolutionSoloistDef(
        id="ray",
        label_ru="Рэй",
        label_en="Ray",
        description_ru=(
            "Modern Russian pop: яркий женский lead, supersaw hook, clean mix, hook-first phrasing, ~118 BPM."
        ),
        vocal="female",
        language="ru",
        genre="pop",
        genre_label_ru="Pop",
        golden_scenario="04_pop_xl_base",
    ),
    "velvet": MusicEvolutionSoloistDef(
        id="velvet",
        label_ru="Vельвет",
        label_en="Velvet",
        description_ru=(
            "Smoky jazz lounge: женский вокал, brushed drums, upright bass, piano comping, swing ~112 BPM."
        ),
        vocal="female",
        language="ru",
        genre="jazz",
        genre_label_ru="Jazz",
        golden_scenario="05_jazz_xl_sft",
    ),
    "nova": MusicEvolutionSoloistDef(
        id="nova",
        label_ru="Nova",
        label_en="Nova",
        description_ru=(
            "Electronic dance: breathy female lead, atmospheric pads, driving bass, sidechain groove, ~128 BPM."
        ),
        vocal="female",
        language="ru",
        genre="electronic",
        genre_label_ru="Electronic",
        golden_scenario="06_electronic_v4_sft",
    ),
    "nebula": MusicEvolutionSoloistDef(
        id="nebula",
        label_ru="Туманность",
        label_en="Nebula",
        description_ru=(
            "Luna / EMEW dream lane: vaporwave lo-fi haze, trip-hop pulse, half-whisper, psychedelic melancholy, "
            "detuned synth swirl, ~116 BPM."
        ),
        vocal="female",
        language="ru",
        genre="luna",
        genre_label_ru="Dream / Luna",
        golden_scenario="07_luna_v4_lora",
    ),
    "ascent": MusicEvolutionSoloistDef(
        id="ascent",
        label_ru="Взлёт",
        label_en="Ascent",
        description_ru=(
            "Euphoric trance: ethereal female lead, supersaw, rolling bass, build-up snare roll, ~138 BPM."
        ),
        vocal="female",
        language="ru",
        genre="trance",
        genre_label_ru="Trance",
        golden_scenario="08_trance_xl_turbo",
    ),
    "ritm": MusicEvolutionSoloistDef(
        id="ritm",
        label_ru="Ритм",
        label_en="Ritm",
        description_ru=("Club house: groovy female vocal, four-on-the-floor, piano stabs, open hats, ~128 BPM."),
        vocal="female",
        language="ru",
        genre="house",
        genre_label_ru="House",
        golden_scenario="09_house_v5_lora",
    ),
    "tempest": MusicEvolutionSoloistDef(
        id="tempest",
        label_ru="Шторм",
        label_en="Tempest",
        description_ru=(
            "Drum & bass duet: male + female call-and-response, rolling breakbeat, reese bass, peak drop, ~174 BPM."
        ),
        vocal="duet",
        language="ru",
        genre="drum_and_bass",
        genre_label_ru="Drum & bass duet",
        golden_scenario="10_dnb_duet_xl_base",
    ),
}


def is_freeform_soloist(soloist_id: str | None) -> bool:
    return get_soloist(soloist_id).freeform


def is_soloist_anchor(soloist_id: str | None) -> bool:
    return resolve_soloist_id(soloist_id) in SOLOIST_ANCHOR_IDS


def resolve_soloist_id(raw: str | None) -> str:
    key = (raw or DEFAULT_SOLOIST_ID).strip().lower()
    if key in SOLOISTS:
        return key
    if key in _LEGACY_SOLOIST_ALIASES:
        return _LEGACY_SOLOIST_ALIASES[key]
    return DEFAULT_SOLOIST_ID


def get_soloist(raw: str | None) -> MusicEvolutionSoloistDef:
    return SOLOISTS[resolve_soloist_id(raw)]


def soloist_workflow_overrides(soloist_id: str | None) -> dict[str, object]:
    """Return the golden ACE workflow lane for a Music Evolution soloist."""
    sid = resolve_soloist_id(soloist_id)
    return dict(_SOLOIST_WORKFLOW_OVERRIDES.get(sid, _BASE_WORKFLOW))


def soloist_options_for_api() -> list[MusicEvolutionSoloistOption]:
    return [
        MusicEvolutionSoloistOption(
            value=item.id,
            label_ru=item.label_ru,
            label_en=item.label_en,
            description_ru=item.description_ru,
            vocal=item.vocal,
            language=item.language,
            genre=item.genre,
            genre_label_ru=item.genre_label_ru,
            freeform=item.freeform,
        )
        for item in SOLOISTS.values()
    ]


def soloist_default_mood(soloist_id: str | None) -> str:
    """Production/LLM mood for a golden soloist lane (ignores UI mood chips)."""
    sid = resolve_soloist_id(soloist_id)
    return SOLOIST_DEFAULT_MOOD.get(sid, "warm")


def apply_soloist_to_run_create(body: MusicEvolutionRunCreate) -> MusicEvolutionRunCreate:
    """Lock vocal/language/genre/mood from golden soloist preset; drop meaning chips."""
    soloist = SOLOISTS[resolve_soloist_id(body.soloist)]
    if soloist.freeform:
        return body.model_copy(
            update={
                "soloist": soloist.id,
                "vocal": soloist.vocal,  # type: ignore[arg-type]
                "language": soloist.language,  # type: ignore[arg-type]
                "genre": soloist.genre,
            }
        )
    return body.model_copy(
        update={
            "soloist": soloist.id,
            "vocal": soloist.vocal,  # type: ignore[arg-type]
            "language": soloist.language,  # type: ignore[arg-type]
            "genre": soloist.genre,
            "mood": soloist_default_mood(soloist.id),  # type: ignore[arg-type]
            "meaning_tags": [],
        }
    )


def soloist_prompt_label(soloist_id: str | None) -> str:
    return get_soloist(soloist_id).label_ru


def soloist_creative_rules(soloist_id: str | None) -> str:
    sid = resolve_soloist_id(soloist_id)
    rules: dict[str, str] = {
        "pulse": (
            " Солистка Пульс: dark warehouse techno, 128–132 BPM, female lead, A minor. "
            "Four-on-the-floor kick, rolling acid bass, metallic hi-hats, sidechain pump в припеве. "
            "Текст на русском — ночной клуб/зал, строб, драйв; без pop-ballad и без acoustic drift."
        ),
        "haze": (
            " Солист Туман: lo-fi chill, 78–86 BPM, warm male vocal, D minor. "
            "Vinyl crackle, mellow Rhodes, lazy boom bap, tape saturation, intimate room. "
            "Текст на русском — домашняя ночь, дождь, тишина; без EDM drop и club kick."
        ),
        "grit": (
            " Солист Грит: Memphis phonk, 140–148 BPM, gritty male vocal, D minor. "
            "Distorted 808, cowbell hook, dark street mood. "
            "Текст на русском — ночной район, асфальт, адренalin; без jazz lounge и без female lead."
        ),
        "ray": (
            " Солистка Рэй: modern Russian pop, 114–122 BPM, bright female vocal, A minor. "
            "Rhythmic piano, supersaw hook, clean mix, layered chorus. "
            "Hook-first phrasing из темы пользователя; без lo-fi whisper и без techno warehouse."
        ),
        "velvet": (
            " Солистка Vельвет: smoky jazz lounge, 108–116 BPM, expressive female vocal, F major. "
            "Brushed drums, upright bass walk, piano comping, soft sax pads, swing feel. "
            "Текст на русском — зал, ночь, джазовые паузы; без EDM и без phonk."
        ),
        "nova": (
            " Солистка Nova: electronic dance, 124–132 BPM, breathy female vocal, F minor. "
            "Atmospheric pads, driving synth bass, filtered drums, sidechain in chorus. "
            "Текст на русском — клуб/вечер, движение; без acoustic folk-only bed."
        ),
        "nebula": (
            " Солистка Туманность: Luna dream lane — vaporwave lo-fi haze, trip-hop pulse, "
            "108–120 BPM, half-whisper female close-mic, psychedelic melancholy, detuned synth swirl. "
            "Конкретная ночная сцена (окно, неон, стекло); не абстрактная pop-мотивация. "
            "Макс. 2 [Verse] и 2 [Chorus]; не копируй чужие эталонные строки."
        ),
        "ascent": (
            " Солистка Взлёт: euphoric trance, 134–142 BPM, ethereal female vocal, D minor. "
            "Supersaw lead, rolling bassline, build-up snare roll, peak chorus energy. "
            "Текст на русском — полёт, свет, высота; без phonk/grit и без half-whisper lo-fi."
        ),
        "ritm": (
            " Солистка Ритм: club house, 124–130 BPM, groovy confident female vocal, F minor. "
            "Four-on-the-floor kick, piano stabs, open hi-hats, full house drop in chorus. "
            "Текст на русском — ночной клуб, тело знает ритм; без acoustic storyteller drift."
        ),
        "tempest": (
            " Дуэт Шторм: drum and bass, 170–176 BPM, male baritone + female airy duet, D minor. "
            "Rolling breakbeat, reese bass, amen texture, call-and-response verses, unified chorus on «мы». "
            "Чередуй (Male)/(Female)/(Both); текст только на русском; без child choir lead."
        ),
    }
    return rules.get(sid, "")


def soloist_style_tag_hint(soloist_id: str | None) -> str:
    sid = resolve_soloist_id(soloist_id)
    hints: dict[str, str] = {
        "pulse": (
            " SPECIAL Pulse — tags start «Style: Dark warehouse techno Pulse», 130 BPM, female vocal, "
            "driving four-on-the-floor, acid bassline, metallic hi-hats, sidechain pump. "
            "FORBIDDEN: pop ballad, acoustic guitar, lo-fi whisper, male lead."
        ),
        "haze": (
            " SPECIAL Haze — tags start «Style: Lo-fi chill Haze», 82 BPM, male vocal, vinyl crackle, "
            "mellow rhodes, lazy boom bap, warm tape saturation. "
            "FORBIDDEN: EDM drop, techno kick, female lead, scream."
        ),
        "grit": (
            " SPECIAL Grit — tags start «Style: Memphis phonk Grit», 144 BPM, gritty male vocal, "
            "cowbell hook, distorted 808 bass. FORBIDDEN: jazz lounge, female lead, acoustic folk."
        ),
        "ray": (
            " SPECIAL Ray — tags start «Style: Modern Russian pop Ray», 118 BPM, female vocal, "
            "bright production, supersaw hook, clean mix. FORBIDDEN: techno warehouse, lo-fi whisper."
        ),
        "velvet": (
            " SPECIAL Velvet — tags start «Style: Smoky jazz lounge Velvet», 112 BPM, female vocal, "
            "brushed drums, upright bass, piano comping, swing feel. FORBIDDEN: EDM drop, phonk 808."
        ),
        "nova": (
            " SPECIAL Nova — tags start «Style: Electronic dance Nova», 128 BPM, breathy female vocal, "
            "atmospheric pads, driving bassline, sidechain. FORBIDDEN: acoustic-only folk bed."
        ),
        "nebula": (
            " SPECIAL Nebula — tags start «Style: Vaporwave lo-fi psychedelic melancholy Nebula, "
            "Russian dream trip-hop», EMEW_STYLE_V1, detuned synth haze, trip-hop pulse, half-whisper. "
            "FORBIDDEN: bright radio pop, festival EDM, scream, sterile polished mix."
        ),
        "ascent": (
            " SPECIAL Ascent — tags start «Style: Euphoric trance Ascent», 138 BPM, ethereal female vocal, "
            "supersaw lead, rolling bass, build-up snare roll. FORBIDDEN: phonk, lo-fi chill."
        ),
        "ritm": (
            " SPECIAL Ritm — tags start «Style: Club house Ritm», 128 BPM, groovy female vocal, "
            "four-on-the-floor kick, piano stabs, open hi-hats. FORBIDDEN: acoustic folk, male lead."
        ),
        "tempest": (
            " SPECIAL Tempest — tags start «Style: Drum and bass duet Tempest», 174 BPM, "
            "male and female duet vocals, rolling breakbeat, reese bass, amen texture, full drop. "
            "FORBIDDEN: single lead only, pop ballad, child lead vocal."
        ),
    }
    return hints.get(sid, "")


def _bpm_jitter(base: int, bpm_seed: int, spread: int = 5) -> int:
    return max(60, min(220, base + (bpm_seed % spread) - (spread // 2)))


def soloist_production_overrides(
    *,
    soloist_id: str | None,
    mood: str,
    seed: int,
    stable_seed: int | None = None,
) -> dict[str, object]:
    from api.services.music_evolution_vocal import luna_evolution_bpm

    sid = resolve_soloist_id(soloist_id)
    bpm_seed = stable_seed if stable_seed is not None else seed
    mood_key = (mood or "warm").strip().lower()

    if sid == "nebula":
        return {
            "bpm": luna_evolution_bpm(mood=mood_key, seed=bpm_seed),
            "duration_seconds": 195,
            "temperature": 0.72,
            "cfg_scale": 1.8,
            "top_p": 0.86,
            "keyscale": "F# minor",
            "sampler_name": "deis",
            "scheduler": "kl_optimal",
        }

    corridors: dict[str, dict[str, object]] = {
        "pulse": {"bpm": 130, "keyscale": "A minor", "temperature": 0.76, "cfg_scale": 1.85, "top_p": 0.88},
        "haze": {"bpm": 82, "keyscale": "D minor", "temperature": 0.78, "cfg_scale": 1.82, "top_p": 0.86},
        "grit": {"bpm": 144, "keyscale": "D minor", "temperature": 0.77, "cfg_scale": 1.88, "top_p": 0.87},
        "ray": {"bpm": 118, "keyscale": "A minor", "temperature": 0.76, "cfg_scale": 1.85, "top_p": 0.88},
        "velvet": {"bpm": 112, "keyscale": "F major", "temperature": 0.8, "cfg_scale": 1.9, "top_p": 0.88},
        "nova": {"bpm": 128, "keyscale": "F minor", "temperature": 0.78, "cfg_scale": 1.85, "top_p": 0.88},
        "ascent": {"bpm": 138, "keyscale": "D minor", "temperature": 0.85, "cfg_scale": 2.0, "top_p": 0.9},
        "ritm": {"bpm": 128, "keyscale": "F minor", "temperature": 0.78, "cfg_scale": 1.88, "top_p": 0.87},
        "tempest": {"bpm": 174, "keyscale": "D minor", "temperature": 0.78, "cfg_scale": 1.9, "top_p": 0.88},
    }
    row = dict(corridors.get(sid, corridors["ray"]))
    base_bpm = int(row.pop("bpm"))
    if mood_key in {"energetic", "epic", "custom"}:
        base_bpm += 2
    elif mood_key in {"sad", "dark", "calm", "romantic"}:
        base_bpm -= 2
    row["bpm"] = _bpm_jitter(base_bpm, bpm_seed)
    return row


def finalize_soloist_evolution_tags(
    soloist_id: str | None,
    tags: str,
    *,
    bpm: int,
    vocal: str,
    vocal_profile: str,
) -> str:
    from api.services.music_evolution_vocal import capitalize_ace_section_tags_in_style, finalize_luna_evolution_tags

    sid = resolve_soloist_id(soloist_id)
    if sid == "nebula":
        return finalize_luna_evolution_tags(tags, bpm=bpm, vocal=vocal, vocal_profile=vocal_profile)

    v = (vocal or "female").strip().lower()
    lead = f"{v} vocal" if v != "duet" else "male and female duet vocals"
    b = max(60, min(220, int(bpm)))

    anchors: dict[str, str] = {
        "pulse": (
            f"Style: Dark warehouse techno Pulse. {b} BPM, female vocal, A minor, {vocal_profile}, "
            "driving four-on-the-floor kick, rolling acid bassline, metallic hi-hats, sidechain pump, "
            "dark warehouse atmosphere, hypnotic groove, clear female lead. "
            f"[Intro] filtered noise, tension riser, {b} BPM feel. "
            f"[Verse] rolling bassline, metallic percussion, {b} BPM. "
            f"[Chorus] full energy, wide stereo pads, sidechain pump, {b} BPM. "
            f"[Outro] filter sweep, reverb decay, {b} BPM feel"
        ),
        "haze": (
            f"Style: Lo-fi chill Haze. {b} BPM, male vocal, D minor, {vocal_profile}, "
            "vinyl crackle, mellow rhodes, lazy boom bap drums, warm tape saturation, intimate mix. "
            f"[Intro] soft keys, rain ambience, {b} BPM feel. "
            f"[Verse] muted bass, intimate room, {b} BPM. "
            f"[Chorus] gentle chord loop, {b} BPM. "
            f"[Outro] fading rhodes, {b} BPM feel"
        ),
        "grit": (
            f"Style: Memphis phonk Grit. {b} BPM, gritty male vocal, D minor, {vocal_profile}, "
            "distorted cowbell, heavy 808 bass, dark street phonk energy. "
            f"[Intro] sample chop, 808 slide, {b} BPM feel. "
            f"[Verse] heavy kick, phonk drums, {b} BPM. "
            f"[Chorus] maximal phonk energy, cowbell hook, {b} BPM. "
            f"[Outro] bass fade, {b} BPM feel"
        ),
        "ray": (
            f"Style: Modern Russian pop Ray. {b} BPM, female vocal, A minor, {vocal_profile}, "
            "bright production, rhythmic piano, supersaw hook, clean mix, layered harmonies. "
            f"[Intro] synth pluck, clean drums, {b} BPM feel. "
            f"[Verse] tight kick, rhythmic piano, {b} BPM. "
            f"[Chorus] supersaw hook, layered vocals, {b} BPM. "
            f"[Outro] hook fade, {b} BPM feel"
        ),
        "velvet": (
            f"Style: Smoky jazz lounge Velvet. {b} BPM, female vocal, F major, {vocal_profile}, "
            "brushed drums, upright bass, piano comping, soft sax pads, swing feel, warm room. "
            f"[Intro] warm room ambience, {b} BPM feel. "
            f"[Verse] piano comping, soft sax pad, {b} BPM. "
            f"[Chorus] horn stabs, swing feel, {b} BPM. "
            f"[Outro] piano fade, {b} BPM feel"
        ),
        "nova": (
            f"Style: Electronic dance Nova. {b} BPM, breathy female vocal, F minor, {vocal_profile}, "
            "atmospheric synth pads, driving bassline, filtered drums, sidechain in chorus. "
            f"[Intro] soft reverb pads, {b} BPM feel. "
            f"[Verse] pulsing groove, {b} BPM. "
            f"[Chorus] full energy, sidechain, {b} BPM. "
            f"[Outro] fading pads, {b} BPM feel"
        ),
        "ascent": (
            f"Style: Euphoric trance Ascent. {b} BPM, ethereal female vocal, D minor, {vocal_profile}, "
            "supersaw lead, rolling bassline, four-on-the-floor kick, wide stereo. "
            f"[Intro] rising pads, white noise sweep, {b} BPM feel. "
            f"[Verse] arpeggiated synth, rolling bass, {b} BPM. "
            f"[Build Up] snare roll, filter open, {b} BPM. "
            f"[Chorus] peak energy, supersaw lead, {b} BPM. "
            f"[Outro] soft breakdown pads, {b} BPM feel"
        ),
        "ritm": (
            f"Style: Club house Ritm. {b} BPM, groovy female vocal, F minor, {vocal_profile}, "
            "four-on-the-floor kick, piano stabs, open hi-hats, club energy, full house drop. "
            f"[Intro] filtered house kick, {b} BPM feel. "
            f"[Verse] bass groove, piano stabs, {b} BPM. "
            f"[Chorus] full drop, open hats, {b} BPM. "
            f"[Outro] kick fade, {b} BPM feel"
        ),
        "tempest": (
            f"Style: Drum and bass duet Tempest. {b} BPM, {lead}, D minor, {vocal_profile}, "
            "rolling breakbeat, reese bass, amen texture, high energy, layered male female vocals. "
            f"[Intro] sub rumble, amen break texture, {b} BPM feel. "
            f"[Verse] rolling breakbeat, reese bass, call-and-response duet, {b} BPM. "
            f"[Chorus] full dnb drop, layered duet vocals, {b} BPM. "
            f"[Outro] break fade, sub decay, {b} BPM feel"
        ),
    }
    anchor = anchors.get(sid, anchors["ray"])
    return capitalize_ace_section_tags_in_style(anchor)
