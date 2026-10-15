"""Prompt and preset helpers for the independent Music Generator V3 flow."""

from __future__ import annotations

import json
import re
from contextlib import suppress
from typing import Any, Literal

from api.routers.music_lyrics_validation import parse_music_section_header
from api.services.music_song_mood import resolve_song_mood, song_mood_prompt_blocks

V3Vocal = Literal["male", "female", "duet"]

V3_LYRICS_SONGCRAFT_CONTRACT = (
    "SONGCRAFT CONTRACT: every song needs a concrete situation, not just mood words. "
    "Verse 1 introduces who speaks, to whom/about what, where they are, and what is at stake. "
    "Verse 2 must add action, consequence, memory, conflict or a changed angle. "
    "Bridge must contain a turn: a decision, confession, joke, reversal, loss, win or new truth. "
    "Chorus is the main human hook, not a generic slogan about night, lights, dance or music. "
    "Do not default to sad romance: themes may be friendship, city life, work, absurd humor, family memory, victory, rage, satire, growing up, freedom, risk, or social tension. "
    "Use concrete objects, places, gestures and sensory details every few lines."
)

V3_LYRICS_RU_CRAFT_CONTRACT = (
    "For Russian lyrics: keep morphology natural; agree case, gender, number and verb aspect. "
    "Do not twist word order only for rhyme. Rhyme must respect natural word stress; never force an unnatural stress. "
    "Use 'ё' when it clarifies stress or meaning (всё, твоё, моё, идёт, несёт, ещё). "
    "Avoid fake poetic filler and childish neologisms. "
    "Forbidden Russian clichés: «в ритме ночи», «в ритме танца», «ритм ночи», «ритм танца», «ритмы сердца», «бьётся в такт», "
    "«огни города зовут», «мы летим до рассвета», «между небом и землёй», «сердце на замке», «танцуй до утра», «растворимся в ночи». "
    "If a line tends toward a cliché, replace it with a specific detail from the theme."
)


def sanitize_v3_tags_for_venera(tag_line: str) -> str:
    """
    Смягчает/выкидывает фразы в ACE-тегах, которые на turbo/длинных треках часто дают
    визг, «вой» в начале, японо-city-pop блеск вместо холодного инди-электро.
    """
    s = (tag_line or "").strip()
    if not s:
        return s
    for pat, to in (
        (r"(?i)\bbright\s+lead\s+vocal\b", "intimate lead vocal, mid-focused, cool dry mix"),
        (r"(?i)\b(lead\s+)?vocal\s+soar(s|ing|ed)?\b", "steady intimate lead, same narrow range"),
        (r"(?i)\bsoar(s|ing|ed)?\b", "gentle line, contained dynamics"),
        (r"(?i)\bcity\s*pop\b", "eastern European indie electropop"),
        (r"(?i)\bj[\s-]?(pop|rock)\b", "indie pop"),
    ):
        s = re.sub(pat, to, s)
    parts = re.split(r"\s*,\s*", s)
    drop = re.compile(
        r"(?i)(^|\s)(wail(ing|s|ed)?|screech(ing|es|ed)?|belting|glossy\s+synth\s+brass|"
        r"anime|power\s+ballad|belt-?(note|ing)|crying\s+vocal|opera|operatic|chipper(?=[\s,]|$))"
    )
    out: list[str] = []
    for p in parts:
        t = p.strip()
        if not t or drop.search(t):
            continue
        if re.search(r"(?i)\bsoar", t) and "steady intimate" not in t.lower():
            continue
        out.append(t)
    joined = ", ".join(out)
    return re.sub(r",\s*,+", ", ", re.sub(r"\s{2,}", " ", joined)).strip(" ,")


def sanitize_v3_lyrics_for_venera(lyrics: str) -> str:
    """
    Правит English в [Arrangement:…] / скобках: те же слова, что ломают вокал в ACE.
    """
    s = lyrics or ""
    for pat, to in (
        (r"(?i)lead vocal soars?|vocal soars?|vocal soaring", "steady intimate lead, cool tone, narrow pitch range"),
        (r"(?i)bright lead vocal|bright,?\s*clean lead", "intimate close-mic lead, warm midrange"),
        (r"(?i)city pop", "indie electropop"),
        (r"(?i)105\s*BPM city pop|BPM city pop", "105 BPM laid-back electropop"),
    ):
        s = re.sub(pat, to, s)
    return s


def dedupe_v3_comma_tags(tag_line: str, *, max_segments: int = 36) -> str:
    """
    Сжимает теги V3: убирает подряд идущие дубликаты (по нормализованной подстроке) и сокращает «простыню».
    """
    s = (tag_line or "").strip()
    if not s:
        return s
    parts = re.split(r"\s*,\s*", s)
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        t = p.strip()
        if not t:
            continue
        key = re.sub(r"\s+", " ", t.lower())[:200]
        if key in seen:
            continue
        seen.add(key)
        out.append(t)
        if len(out) >= max_segments:
            break
    return ", ".join(out)


def dedupe_v3_lyrics_voice_markers(lyrics: str) -> str:
    """
    Схлопывает подряд идущие одинаковые (Voice: …) / похожие полустрочки от LLM + постобработки.
    """
    lines = (lyrics or "").splitlines()
    out: list[str] = []
    prev_voice: str | None = None
    for line in lines:
        s = line.strip()
        m = re.match(r"(?i)^\(Voice:\s*([^)]+)\)\s*$", s)
        if m:
            norm = re.sub(r"\s+", " ", m.group(1).lower())[:200]
            if norm == prev_voice:
                continue
            prev_voice = norm
            out.append(line.rstrip())
        else:
            prev_voice = None
            out.append(line.rstrip())
    cleaned = "\n".join(out)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


MUSIC_GENERATOR_V3_STYLE_PRESETS: dict[str, dict[str, Any]] = {
    "cinematic_pop": {
        "label": "Cinematic pop",
        "bpm": 118,
        "duration_seconds": 170,
        "vocal": "female",
        "keyscale": "A minor",
        "timesignature": "4",
        "temperature": 0.85,
        "cfg_scale": 2.0,
        "top_p": 0.9,
        "top_k": 0,
        "min_p": 0.0,
        "steps": 8,
        "cfg": 2.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,
        "batch_size": 1,
        "shift": 3.0,
        "tags": (
            "118 BPM cinematic pop, wide emotional vocal, piano pulse, warm pads, "
            "tight modern drums, orchestral lift, clean stereo mix"
        ),
    },
    "neon_rock": {
        "label": "Neon rock",
        "bpm": 132,
        "duration_seconds": 165,
        "vocal": "male",
        "keyscale": "E minor",
        "timesignature": "4",
        "temperature": 0.9,
        "cfg_scale": 2.2,
        "top_p": 0.92,
        "top_k": 0,
        "min_p": 0.0,
        "steps": 8,
        "cfg": 2.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,
        "batch_size": 1,
        "shift": 3.0,
        "tags": (
            "132 BPM neon rock, distorted guitars, punchy live drums, synth edge, "
            "anthemic chorus, saturated but clear mix"
        ),
    },
    "deep_dance": {
        "label": "Deep dance",
        "bpm": 124,
        "duration_seconds": 180,
        "vocal": "female",
        "keyscale": "F minor",
        "timesignature": "4",
        "temperature": 0.88,
        "cfg_scale": 2.0,
        "top_p": 0.9,
        "top_k": 0,
        "min_p": 0.0,
        "steps": 8,
        "cfg": 2.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,
        "batch_size": 1,
        "shift": 3.0,
        "tags": (
            "124 BPM deep dance pop, sidechain bass, crisp kick, airy vocal chops, "
            "[build up] riser tension, [drop] melodic bass release"
        ),
    },
    "folk_future": {
        "label": "Folk future",
        "bpm": 104,
        "duration_seconds": 175,
        "vocal": "duet",
        "keyscale": "G major",
        "timesignature": "4",
        "temperature": 0.8,
        "cfg_scale": 1.8,
        "top_p": 0.88,
        "top_k": 0,
        "min_p": 0.0,
        "steps": 8,
        "cfg": 2.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,
        "batch_size": 1,
        "shift": 3.0,
        "tags": (
            "104 BPM folk future, acoustic strings, hand percussion, soft synth bed, "
            "duet vocal, organic room, modern polish"
        ),
    },
    "synthwave_drive": {
        "label": "Synthwave drive",
        "bpm": 112,
        "duration_seconds": 170,
        "vocal": "female",
        "keyscale": "C# minor",
        "timesignature": "4",
        "temperature": 0.9,
        "cfg_scale": 2.1,
        "top_p": 0.92,
        "top_k": 0,
        "min_p": 0.0,
        "steps": 8,
        "cfg": 2.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,
        "batch_size": 1,
        "shift": 3.0,
        "tags": (
            "112 BPM synthwave, analog bass arpeggio, gated drums, neon pads, "
            "wide chorus vocal, night drive atmosphere, glossy retro mix"
        ),
    },
    "trap_soul": {
        "label": "Trap soul",
        "bpm": 142,
        "duration_seconds": 160,
        "vocal": "male",
        "keyscale": "D minor",
        "timesignature": "4",
        "temperature": 0.9,
        "cfg_scale": 2.0,
        "top_p": 0.9,
        "top_k": 0,
        "min_p": 0.0,
        "steps": 8,
        "cfg": 2.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,
        "batch_size": 1,
        "shift": 3.0,
        "tags": (
            "142 BPM trap soul, half-time bounce, deep 808, crisp hi-hats, "
            "moody keys, intimate lead vocal, dark spacious mix"
        ),
    },
    "punk_anthem": {
        "label": "Punk anthem",
        "bpm": 176,
        "duration_seconds": 150,
        "vocal": "male",
        "keyscale": "B minor",
        "timesignature": "4",
        "temperature": 0.95,
        "cfg_scale": 2.2,
        "top_p": 0.94,
        "top_k": 0,
        "min_p": 0.0,
        "steps": 8,
        "cfg": 2.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,
        "batch_size": 1,
        "shift": 3.0,
        "tags": (
            "176 BPM punk rock anthem, fast downstroke guitars, raw gang backing vocals, "
            "tight live drums, shout chorus, gritty club mix"
        ),
    },
    "ambient_orchestra": {
        "label": "Ambient orchestra",
        "bpm": 82,
        "duration_seconds": 190,
        "vocal": "female",
        "keyscale": "C minor",
        "timesignature": "4",
        "temperature": 0.75,
        "cfg_scale": 1.7,
        "top_p": 0.86,
        "top_k": 0,
        "min_p": 0.0,
        "steps": 8,
        "cfg": 2.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,
        "batch_size": 1,
        "shift": 3.0,
        "tags": (
            "82 BPM ambient orchestral song, slow strings, soft piano, distant choir pads, "
            "cinematic swells, intimate vocal, spacious reverb"
        ),
    },
    "jazz_soul": {
        "label": "Jazz soul",
        "bpm": 96,
        "duration_seconds": 175,
        "vocal": "female",
        "keyscale": "Eb minor",
        "timesignature": "4",
        "temperature": 0.82,
        "cfg_scale": 1.9,
        "top_p": 0.88,
        "top_k": 0,
        "min_p": 0.0,
        "steps": 8,
        "cfg": 2.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,
        "batch_size": 1,
        "shift": 3.0,
        "tags": (
            "96 BPM jazz soul, Rhodes chords, upright bass, brushed drums, warm brass stabs, "
            "expressive lead vocal, smoky late-night mix"
        ),
    },
    "metalcore_light": {
        "label": "Metalcore light",
        "bpm": 150,
        "duration_seconds": 165,
        "vocal": "duet",
        "keyscale": "F# minor",
        "timesignature": "4",
        "temperature": 0.92,
        "cfg_scale": 2.3,
        "top_p": 0.92,
        "top_k": 0,
        "min_p": 0.0,
        "steps": 8,
        "cfg": 2.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,
        "batch_size": 1,
        "shift": 3.0,
        "tags": (
            "150 BPM melodic metalcore, heavy rhythm guitars, double-kick accents, "
            "clean duet chorus, breakdown tension, polished aggressive mix"
        ),
    },
    "amapiano_pop": {
        "label": "Amapiano pop",
        "bpm": 113,
        "duration_seconds": 178,
        "vocal": "female",
        "keyscale": "G minor",
        "timesignature": "4",
        "temperature": 0.88,
        "cfg_scale": 2.0,
        "top_p": 0.9,
        "top_k": 0,
        "min_p": 0.0,
        "steps": 8,
        "cfg": 2.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,
        "batch_size": 1,
        "shift": 3.0,
        "tags": (
            "113 BPM amapiano pop, log drum bass, shuffling percussion, airy piano chords, "
            "smooth vocal hook, warm dancefloor mix"
        ),
    },
    "city_pop_night": {
        "label": "City pop night",
        "bpm": 105,
        "duration_seconds": 172,
        "vocal": "female",
        "keyscale": "A major",
        "timesignature": "4",
        "temperature": 0.84,
        "cfg_scale": 2.0,
        "top_p": 0.9,
        "top_k": 0,
        "min_p": 0.0,
        "steps": 8,
        "cfg": 2.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,
        "batch_size": 1,
        "shift": 3.0,
        "tags": (
            "105 BPM city pop, slap bass, clean rhythm guitar, glossy synth brass, "
            "bright lead vocal, 80s Japanese pop polish, night skyline mood"
        ),
    },
}

_DEFAULT_STYLE = "cinematic_pop"
_DEFAULT_SOLOIST = "none"

# KSampler (узел 3) + AuraFlow shift для «Венера» при ACE 1.5 **XL** Turbo: как в v3-шаблоне Comfy
# (euler + simple, невысокий CFG, shift 3; denoise 1.0).
MUSIC_GENERATOR_V3_VENERA_KSAMPLER: dict[str, Any] = {
    "cfg": 2.0,
    "sampler_name": "euler",
    "scheduler": "simple",
    "denoise": 1.0,
    "shift": 3.0,
}

MUSIC_GENERATOR_V3_SOLOIST_PRESETS: dict[str, dict[str, Any]] = {
    "none": {
        "label": "По вокалу",
        "vocal": None,
        "hint": "Без отдельного героя: используется выбранный тип вокала.",
        "voice_tags": "",
        "style_tags": "",
        "lyrics_directive": "",
    },
    "venera": {
        "label": "Венера",
        "vocal": "female",
        "locked_style": "deep_dance",
        "locked_language": "ru",
        "hint": (
            "Холодный, «душевный» инди-электро/синти/трип-хоп: притлушённый вокал, сухо и близко к микрофону, "
            "меланхолия, ностальгия 90–2000-х, клавиши в духе дрим-электроники — не city pop, не яркий японо-боевик, "
            "не оперный/аниме-белт."
        ),
        "voice_tags": (
            "one female lead, same person whole track, cool restrained delivery, mid-focused dryish mix, close mic, "
            "narrow pitch range, no melisma runs, no cry-vocal, no wailing, no belted high notes, no anime vocal trope, "
            "intimate not shouty, subtle vibrato, eastern European bedroom indie pop tone, low drama"
        ),
        "style_tags": (
            "indie pop, synth-pop, electropop, trip-hop influenced drums, deep sub and sparse hats, detuned warm pads, "
            "soft saturated keys, cold melancholy, 90s FM nostalgia, intimate bedroom production, not glossy shōwa brass, "
            "not dancefloor EDM, not j-pop city pop sheen"
        ),
        "lyrics_directive": (
            "One same female 'I' from intro to outro; do not change narrator attitude or 'energy' so much that a new "
            "singer is implied. Melancholy sensual lines; city night, glass, rain, neon, inner monologue. "
            "Chorus can lift emotionally but not as a new vocal identity (no all-caps hype, no braggadocious switch). "
            "Do not name or quote real artists or their songs; write original words."
        ),
    },
    "sever": {
        "label": "Север",
        "vocal": "male",
        "locked_style": "neon_rock",
        "locked_language": "ru",
        "hint": "Низкий мужской тембр, сдержанная сила, кинематографичный поп-рок.",
        "voice_tags": (
            "deep male baritone vocal, warm chest tone, calm confident delivery, slight grit, close dry lead vocal"
        ),
        "style_tags": (
            "cinematic pop rock, restrained verses, wide anthem chorus, live drums, low piano, muted electric guitars"
        ),
        "lyrics_directive": (
            "Write for a masculine narrator: grounded, laconic, protective, with concrete actions and fewer metaphors."
        ),
    },
    "mira": {
        "label": "Мира",
        "vocal": "female",
        "locked_style": "jazz_soul",
        "locked_language": "ru",
        "hint": "Дымный soul/R&B, бархатная подача и поздний ночной грув.",
        "voice_tags": ("smoky female contralto vocal, velvet tone, warm vibrato, intimate soul phrasing, soft melisma"),
        "style_tags": ("late-night R&B, jazz soul, Rhodes chords, brushed drums, upright bass, warm tape saturation"),
        "lyrics_directive": (
            "Write for a feminine narrator with mature emotional detail, tactile images and conversational confidence."
        ),
    },
    "neon": {
        "label": "Неон",
        "vocal": "male",
        "locked_style": "trap_soul",
        "locked_language": "ru",
        "hint": "Ритмичный urban/pop вокал, быстрые фразы и уверенный хук.",
        "voice_tags": ("agile male tenor vocal, rhythmic spoken-sung phrasing, crisp consonants, urban pop confidence"),
        "style_tags": ("trap pop, UK garage bounce, syncopated drums, tight 808, chopped synth stabs, energetic hook"),
        "lyrics_directive": (
            "Write for a masculine narrator with direct street-level details, punchy short lines and a memorable hook."
        ),
    },
    "iskra": {
        "label": "Искра",
        "vocal": "female",
        "locked_style": "cinematic_pop",
        "locked_language": "ru",
        "hint": "Яркий поп-вокал с сильным припевом и чистым верхом.",
        "voice_tags": (
            "bright female pop vocal, clear soprano edge, confident belting in chorus, clean high harmonies"
        ),
        "style_tags": ("modern pop anthem, punchy drums, glossy synth bass, claps, wide chorus lift, radio-ready mix"),
        "lyrics_directive": (
            "Write for a feminine narrator with bold optimism, clear stakes, concrete verbs and a chant-ready chorus."
        ),
    },
    "orbita": {
        "label": "Орбита",
        "vocal": "duet",
        "locked_style": "folk_future",
        "locked_language": "ru",
        "hint": "Мужской/женский дуэт: обмен репликами, общий припев и гармонии.",
        "voice_tags": (
            "male and female duet vocal, warm male baritone, airy female lead, alternating verses, call and response, "
            "wide duet harmonies in chorus"
        ),
        "style_tags": (
            "cinematic duet pop, acoustic pulse, soft synth bed, live drums, emotional pre-chorus, shared chorus"
        ),
        "lyrics_directive": (
            "Write as a clear dialogue: male lead and female lead answer each other, chorus uses plural 'мы'."
        ),
    },
}


def normalize_v3_style_key(style: str | None) -> str:
    key = (style or "").strip().lower().replace("-", "_").replace(" ", "_")
    return key if key in MUSIC_GENERATOR_V3_STYLE_PRESETS else _DEFAULT_STYLE


def normalize_v3_soloist_key(soloist: str | None) -> str:
    key = (soloist or _DEFAULT_SOLOIST).strip().lower().replace("-", "_").replace(" ", "_")
    return key if key in MUSIC_GENERATOR_V3_SOLOIST_PRESETS else _DEFAULT_SOLOIST


def coerce_v3_style_and_language(
    soloist: str | None,
    *,
    style: str | None,
    language: str | None,
) -> tuple[str, str]:
    """
    Для выбранного солиста фиксируем стиль и язык (пресет героя), иначе — запрос пользователя.
    """
    sk = normalize_v3_soloist_key(soloist)
    lang = (language or "ru").strip() or "ru"
    st = (style or "").strip()
    if sk != "none":
        p = MUSIC_GENERATOR_V3_SOLOIST_PRESETS[sk]
        if p.get("locked_style"):
            st = str(p["locked_style"])
        if p.get("locked_language"):
            lang = (str(p["locked_language"]).strip() or lang)[:32]
    return normalize_v3_style_key(st or _DEFAULT_STYLE), (lang or "ru")[:16]


def normalize_v3_vocal(vocal: str | None) -> V3Vocal:
    v = (vocal or "").strip().lower()
    if v in ("male", "female", "duet"):
        return v  # type: ignore[return-value]
    return "female"


def effective_v3_vocal(vocal: str | None, soloist: str | None = None) -> V3Vocal:
    preset = MUSIC_GENERATOR_V3_SOLOIST_PRESETS[normalize_v3_soloist_key(soloist)]
    solo_vocal = preset.get("vocal")
    return normalize_v3_vocal(str(solo_vocal)) if solo_vocal else normalize_v3_vocal(vocal)


def v3_soloist_tag_phrase(soloist: str | None) -> str:
    preset = MUSIC_GENERATOR_V3_SOLOIST_PRESETS[normalize_v3_soloist_key(soloist)]
    parts = [str(preset.get("voice_tags") or "").strip(), str(preset.get("style_tags") or "").strip()]
    return ", ".join(part for part in parts if part)


def v3_soloist_lyrics_directive(soloist: str | None) -> str:
    preset = MUSIC_GENERATOR_V3_SOLOIST_PRESETS[normalize_v3_soloist_key(soloist)]
    if normalize_v3_soloist_key(soloist) == _DEFAULT_SOLOIST:
        return ""
    return f"Auto soloist: {preset['label']}. Voice and style anchor: {preset['hint']} {preset['lyrics_directive']}"


def v3_vocal_tag_phrase(vocal: str | None, soloist: str | None = None) -> str:
    v = effective_v3_vocal(vocal, soloist)
    if v == "male":
        return "male vocal, single male lead, masculine first-person delivery"
    if v == "duet":
        return "male and female duet vocal, alternating male/female leads, call and response, duet harmonies"
    return "female vocal, single female lead, feminine first-person delivery"


def _v3_vocal_lyrics_contract(vocal: str | None, language: str | None) -> str:
    v = normalize_v3_vocal(vocal)
    lang = (language or "ru").strip().lower()
    if lang.startswith("ru"):
        if v == "male":
            return (
                "VOCAL CONTRACT: single male singer. If lyrics use first person, use masculine Russian forms "
                "(я был, я устал, я нашёл, я один). Never use feminine first-person forms "
                "(я была, устала, нашла, одна) unless the theme explicitly quotes another character."
            )
        if v == "duet":
            return (
                "VOCAL CONTRACT: male/female duet. Mark who sings with concise section tags: "
                "[Verse - male lead], [Verse - female lead], [Chorus - duet harmonies]. "
                "Male-lead lines use masculine first-person forms; female-lead lines use feminine forms. "
                "Shared chorus should prefer plural 'мы' or gender-neutral wording."
            )
        return (
            "VOCAL CONTRACT: single female singer. If lyrics use first person, use feminine Russian forms "
            "(я была, я устала, я нашла, я одна). Never use masculine first-person forms "
            "(я был, устал, нашёл, один) unless the theme explicitly quotes another character."
        )
    if v == "duet":
        return (
            "VOCAL CONTRACT: male/female duet. Mark sections as [Verse - male lead], "
            "[Verse - female lead], [Chorus - duet harmonies]."
        )
    if v == "male":
        return "VOCAL CONTRACT: single male lead vocal. Do not write for a female narrator."
    return "VOCAL CONTRACT: single female lead vocal. Do not write for a male narrator."


def apply_v3_duet_section_markers(lyrics: str, *, vocal: str | None) -> str:
    if normalize_v3_vocal(vocal) != "duet":
        return (lyrics or "").strip()
    lines = (lyrics or "").splitlines()
    out: list[str] = []
    lead_next = "male"
    for line in lines:
        s = line.strip()
        m = re.match(r"^\[([^\]]+)]$", s)
        if not m:
            out.append(line.rstrip())
            continue
        inner = m.group(1).strip()
        name, hint = (inner.split(":", 1) + [""])[:2] if ":" in inner else (inner, "")
        name = name.strip()
        hint = hint.strip()
        low = name.lower()
        if any(token in low for token in ("male", "female", "duet", "harmony", "harmonies")):
            out.append(line.rstrip())
            continue
        base = re.sub(r"\s+\d+$", "", name).strip()
        base_low = base.lower()
        suffix = f": {hint}" if hint else ""
        if base_low in ("chorus", "final chorus", "hook"):
            out.append(f"[{name} - duet harmonies{suffix}]")
        elif base_low in ("verse", "pre-chorus", "bridge"):
            lead = "male" if lead_next == "male" else "female"
            out.append(f"[{name} - {lead} lead{suffix}]")
            lead_next = "female" if lead_next == "male" else "male"
        else:
            out.append(line.rstrip())
    cleaned = "\n".join(out)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _section_kind_from_header(section_name: str) -> str:
    s = (section_name or "").strip().lower()
    s = re.sub(r"\s+", " ", s).replace("–", "-").replace("—", "-")
    if s.startswith("intro"):
        return "intro"
    if s.startswith("outro"):
        return "outro"
    if s.startswith("pre-chorus") or s.startswith("pre chorus") or s.startswith("prechorus"):
        return "pre-chorus"
    if s.startswith("chorus") or s.startswith("hook"):
        return "chorus"
    if s.startswith("bridge"):
        return "bridge"
    if s.startswith("build up") or s.startswith("build-up"):
        return "build up"
    if s.startswith("drop"):
        return "drop"
    if s.startswith("breakdown"):
        return "breakdown"
    return "verse"


def _v3_default_section_hint(section_kind: str, *, style: str, bpm: int, soloist: str | None) -> str:
    preset = MUSIC_GENERATOR_V3_STYLE_PRESETS[normalize_v3_style_key(style)]
    solo_tags = v3_soloist_tag_phrase(soloist)
    texture = str(preset.get("tags") or "").split(",")[0].strip()
    texture = re.sub(r"^\s*\d{2,3}\s*BPM\s*", "", texture, flags=re.I).strip(" ,")
    voice = (solo_tags.split(",")[0].strip() if solo_tags else "lead vocal").strip()
    common = f"{texture}, {bpm} BPM feel"
    is_venera = normalize_v3_soloist_key(soloist) == "venera"
    chorus_vox = (
        f"{common}, chorus lift, {voice}, same single lead only, light unison or subtle stereo double same timbre"
        if is_venera
        else f"{common}, full chorus lift, {voice}, wide harmonies, stereo delay"
    )
    bridge_vox = (
        f"{common}, bridge, same lead vocal, reduced drums, reverb tail transition"
        if is_venera
        else f"{common}, contrasting bridge, reduced drums, reverb tail transition"
    )
    hints = {
        "intro": f"{common}, atmospheric intro, pads, short transition",
        "verse": f"{common}, focused groove, {voice}, drums and bass foundation",
        "pre-chorus": f"{common}, tension build, filter sweep, riser transition",
        "chorus": chorus_vox,
        "bridge": bridge_vox,
        "build up": f"{common}, riser, snare lift, sidechain tension",
        "drop": f"{common}, bass release, punchy drums, instrumental energy",
        "breakdown": f"{common}, sparse breakdown, filtered pads, low energy",
        "outro": f"{common}, outro fade, reverb tail, soft ending",
    }
    return hints.get(section_kind, hints["verse"])


def ensure_v3_enriched_lyrics_sections(
    lyrics: str,
    *,
    style: str,
    bpm: int | None,
    vocal: str | None,
    soloist: str | None = None,
) -> str:
    """
    V3 follows the stable V2 ACE contract:
    lyrics carry enriched headers, workflow turns them into English Arrangement notes,
    while tags mirror the same section order.
    """
    text = (lyrics or "").strip()
    if not text:
        return text
    bpm_hint = max(10, min(300, int(bpm or MUSIC_GENERATOR_V3_STYLE_PRESETS[normalize_v3_style_key(style)]["bpm"])))
    out: list[str] = []
    saw_section = False
    input_lines = text.splitlines()
    i = 0
    n = len(input_lines)
    while i < n:
        line = input_lines[i]
        s = line.strip()
        if not s:
            out.append("")
            i += 1
            continue
        parsed = parse_music_section_header(s)
        if not parsed:
            out.append(line.rstrip())
            i += 1
            continue
        saw_section = True
        section_name = parsed["section_name_raw"] or "Verse"
        section_kind = _section_kind_from_header(section_name)
        hint = (parsed["arrangement_hint"] or "").strip()
        if hint and re.search(r"[А-Яа-яЁё]", hint):
            hint = ""
        if not hint:
            hint = _v3_default_section_hint(section_kind, style=style, bpm=bpm_hint, soloist=soloist)
        elif not re.search(r"\b\d{2,3}\s*BPM(?:\s*feel)?\b", hint, flags=re.I):
            hint = f"{hint.rstrip(' ,;')}, {bpm_hint} BPM feel"
        out.append(f"[{section_name}: {hint}]")
        if section_kind not in ("intro", "outro", "build up", "drop", "breakdown"):
            next_line = input_lines[i + 1].strip() if i + 1 < n else ""
            if re.match(r"(?i)^\(Voice:\s*", next_line):
                i += 1
                out.append(input_lines[i].rstrip())
            else:
                voice_phrase = v3_vocal_tag_phrase(vocal, soloist).split(",")[0].strip()
                out.append(f"(Voice: {voice_phrase}, clean lead, controlled delivery)")
        i += 1
    if not saw_section:
        body = text
        out = [
            f"[Intro: {_v3_default_section_hint('intro', style=style, bpm=bpm_hint, soloist=soloist)}]",
            "",
            f"[Verse: {_v3_default_section_hint('verse', style=style, bpm=bpm_hint, soloist=soloist)}]",
            body,
        ]
    cleaned = "\n".join(out)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def sanitize_v3_lyrics_for_ace(lyrics: str) -> str:
    """
    ACE-Step treats parentheses in lyrics as singable background vocals/echoes.
    Keep V3 lyrics as structure + words; move arrangement/mix detail to tags.
    """
    out: list[str] = []
    for line in (lyrics or "").splitlines():
        s = line.strip()
        if re.match(r"^\((?:Production|Mix|FX|Effect|Effects)\s*:[^)]*\)$", s, flags=re.I):
            continue
        if re.match(r"^\((?:Arrangement|Voice|Vocal)\s*:[^)]*\)$", s, flags=re.I):
            if re.search(r"[А-Яа-яЁё]", s):
                continue
            out.append(s)
            continue
        if s.startswith("(") and s.endswith(")"):
            continue
        line = re.sub(r"\s*\([^)]*[А-Яа-яЁё][^)]*\)", "", line).rstrip()
        s = line.strip()
        if not s:
            continue
        if re.match(r"^\[\s*\d+\s*(?:bars?|такта?|тактов)\b[^\]]*]\s*$", s, flags=re.I):
            continue
        m = re.match(r"^\[([^\]:]+):[^\]]+]\s*(.*)$", s)
        if m:
            section = m.group(1).strip()
            hint = s[s.find(":") + 1 : s.rfind("]")].strip()
            rest = m.group(2).strip()
            if hint and not re.search(r"[А-Яа-яЁё]", hint):
                out.append(f"[{section}: {hint}]")
            else:
                out.append(f"[{section}]")
            if rest:
                out.append(rest)
            continue
        out.append(line.rstrip())
    cleaned = "\n".join(out)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def v3_style_prompt_seed(style: str | None) -> str:
    preset = MUSIC_GENERATOR_V3_STYLE_PRESETS[normalize_v3_style_key(style)]
    return str(preset["tags"])


def v3_section_tag_skeleton(*, lyrics: str, style: str, bpm: int, soloist: str | None) -> str:
    rows: list[str] = []
    seen = 0
    for line in (lyrics or "").splitlines():
        parsed = parse_music_section_header(line.strip())
        if not parsed:
            continue
        seen += 1
        if seen > 8:
            break
        section_kind = _section_kind_from_header(str(parsed["section_name_raw"] or parsed["section_name"]))
        hint = str(parsed.get("arrangement_hint") or "").strip()
        if not hint or re.search(r"[А-Яа-яЁё]", hint):
            hint = _v3_default_section_hint(section_kind, style=style, bpm=bpm, soloist=soloist)
        rows.append(f"[{section_kind}] {hint}")
    if rows:
        return ", ".join(rows)
    return ", ".join(
        [
            f"[intro] {_v3_default_section_hint('intro', style=style, bpm=bpm, soloist=soloist)}",
            f"[verse] {_v3_default_section_hint('verse', style=style, bpm=bpm, soloist=soloist)}",
            f"[chorus] {_v3_default_section_hint('chorus', style=style, bpm=bpm, soloist=soloist)}",
            f"[outro] {_v3_default_section_hint('outro', style=style, bpm=bpm, soloist=soloist)}",
        ]
    )


def _llama_options(
    temperature: float | None,
    cfg_scale: float | None,
    top_p: float | None,
) -> dict[str, Any]:
    opts: dict[str, Any] = {"num_predict": 4096}
    if temperature is not None:
        opts["temperature"] = max(0.0, min(1.2, float(temperature)))
    if top_p is not None:
        opts["top_p"] = max(0.1, min(1.0, float(top_p)))
    if cfg_scale is not None:
        opts["repeat_penalty"] = 1.04 + (max(0.0, min(4.0, float(cfg_scale))) / 4.0) * 0.2
    return opts


def _language_line(language: str | None) -> str:
    lang = (language or "ru").strip().lower()
    if lang.startswith("en"):
        return "Write lyrics in English."
    if lang.startswith("fr"):
        return "Write lyrics in French."
    return "Write lyrics in Russian, but keep section names and technical production hints in English."


def build_v3_lyrics_messages(
    *,
    theme: str,
    style: str,
    language: str,
    vocal: str,
    soloist: str | None = None,
    explicit_mood: str | None = None,
    randomize_mood: bool = True,
    mood_seed: str | None = None,
) -> list[dict[str, str]]:
    style_key = normalize_v3_style_key(style)
    preset = MUSIC_GENERATOR_V3_STYLE_PRESETS[style_key]
    vocal_norm = effective_v3_vocal(vocal, soloist)
    vocal_contract = _v3_vocal_lyrics_contract(vocal_norm, language)
    soloist_directive = v3_soloist_lyrics_directive(soloist)
    mood_pick = resolve_song_mood(
        theme=theme,
        explicit_mood=explicit_mood,
        randomize=randomize_mood,
        seed=mood_seed or f"v3:{theme.strip()}:{style_key}",
    )
    mood_system, mood_user = song_mood_prompt_blocks(mood_pick, language=language)
    venera_lyrics = ""
    if normalize_v3_soloist_key(soloist) == "venera":
        venera_lyrics = (
            "Soloist 'Венера' means one continuous intimate female lead — same person, same emotional temperature; "
            "verses and chorus are the same voice, not a different 'energy singer' in the hook. "
        )
    system = (
        "You are Music Generator V3, an independent songwriting engine for ACE Step 1.5. "
        f"{venera_lyrics}"
        "Return only the song lyrics, no explanations. "
        "Use enriched song sections in square brackets: [Intro: English production hints, BPM feel], "
        "[Verse: English production hints, BPM feel], [Chorus: English production hints, BPM feel]. "
        "The part before ':' is the vocal section; the English hint after ':' is arrangement for ACE. "
        "Lyrics lines must stay singable and must not become a production manual. "
        "Do not write Russian text inside parentheses. Parentheses are only allowed for at most one short English (Voice: ...) hint "
        "immediately after a section header; never put two identical (Voice) lines in a row. "
        "Never write bar-count service notes like '[8 тактов]' inside the lyrics. "
        "Avoid generic abstraction: write concrete scenes, objects, actions and sensory details from the theme. "
        "Do not reuse old generator phrasing; write a fresh, self-contained song. "
        f"{V3_LYRICS_SONGCRAFT_CONTRACT} "
        f"{V3_LYRICS_RU_CRAFT_CONTRACT}"
        f"{mood_system}"
    )
    user = (
        f"Theme: {theme.strip()}\n"
        f"V3 style preset: {preset['label']}.\n"
        f"Sound seed that must influence mood, tempo and lyrical energy: {preset['tags']}.\n"
        f"Vocal: {vocal_norm}. {vocal_contract}\n"
        f"{soloist_directive}\n"
        f"{_language_line(language)}\n"
        f"{mood_user}\n\n"
        "Write a complete song with memorable verses and a chorus. "
        "If the theme implies a literary form or genre, obey the theme first. "
        "Every section header must include concise English instruments/effects/transitions and BPM feel after ':'. "
        "Do not put production descriptions into the lyric lines themselves. "
        "The selected V3 style must be audible from the imagery, rhythm and lyrical energy. "
        "Prefer concrete lyrics over abstract words like dream, destiny, universe, light, path unless the theme requires them."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_v3_style_messages(
    *,
    lyrics: str,
    style: str,
    vocal: str,
    bpm: int | None,
    soloist: str | None = None,
) -> list[dict[str, str]]:
    style_key = normalize_v3_style_key(style)
    preset = MUSIC_GENERATOR_V3_STYLE_PRESETS[style_key]
    vocal_norm = effective_v3_vocal(vocal, soloist)
    vocal_phrase = v3_vocal_tag_phrase(vocal_norm, soloist)
    soloist_phrase = v3_soloist_tag_phrase(soloist)
    bpm_hint = int(bpm or preset["bpm"])
    system = (
        "You are Music Generator V3, writing ACE Step 1.5 tags only. "
        "Output one English comma-separated production string. No markdown, no bullets. "
        "Tags control arrangement, instruments, mix, section markers and effects. "
        "Never quote lyrics. Mirror the exact section order from the lyrics. "
        "Each [section] marker must be followed by concrete production words, not empty marker chains. "
        "Use lowercase section markers such as [intro], [verse], [chorus], [bridge], [outro]."
    )
    section_rows = v3_section_tag_skeleton(lyrics=lyrics, style=style_key, bpm=bpm_hint, soloist=soloist)
    venera_lock = ""
    if normalize_v3_soloist_key(soloist) == "venera":
        venera_lock = (
            "Vocal lock (Венера / Luna-like indie electro): one cool intimate female lead, muted midrange, not anime/city-pop. "
            "FORBIDDEN in tags: city pop, j-pop, glossy brass fanfare, bright lead at intro, vocal soars, soaring, wailing, "
            "belting, screech, power notes, operatic, chipper, anime vocal. Use trip-hop-leaning drums, soft pads, dry vocal.\n"
        )
    user = (
        f"{venera_lock}"
        f"V3 style preset: {preset['label']}.\n"
        f"Baseline tags: {preset['tags']}.\n"
        f"BPM target: {bpm_hint}. Required vocal tags: {vocal_phrase}. "
        f"Auto soloist tags: {soloist_phrase or 'none'}.\n\n"
        f"Mandatory section tag skeleton to mirror and enrich: {section_rows}\n\n"
        "Lyrics for structure and mood only:\n"
        f"{lyrics[:3500]}\n\n"
        "Write final ACE Step 1.5 tags:"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_v3_suggest_messages(
    *, lyrics: str, style: str, vocal: str, language: str, soloist: str | None = None
) -> list[dict[str, str]]:
    style_key = normalize_v3_style_key(style)
    preset = MUSIC_GENERATOR_V3_STYLE_PRESETS[style_key]
    system = (
        "Response is one compact JSON object (stack2 enforces JSON syntax). "
        "Fields: vocal, bpm, duration_seconds, language, timesignature, keyscale. "
        "Do not change requested vocal."
    )
    user = (
        f"V3 style preset defaults: {json.dumps(preset, ensure_ascii=False)}\n\n"
        f"Requested vocal: {effective_v3_vocal(vocal, soloist)}. Requested language: {language or 'ru'}.\n"
        f"Auto soloist: {normalize_v3_soloist_key(soloist)}.\n\n"
        "Song lyrics:\n"
        f"{lyrics[:3000]}\n\n"
        "Suggest practical ACE Step parameters. Use vocal male/female/duet, "
        "bpm 10-300, duration_seconds 30-300, timesignature 2/3/4/6."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def fallback_v3_suggest(
    style: str, language: str = "ru", vocal: str | None = None, soloist: str | None = None
) -> dict[str, Any]:
    preset = MUSIC_GENERATOR_V3_STYLE_PRESETS[normalize_v3_style_key(style)]
    return {
        "vocal": effective_v3_vocal(vocal or str(preset["vocal"]), soloist),
        "bpm": preset["bpm"],
        "duration_seconds": preset["duration_seconds"],
        "language": language or "ru",
        "timesignature": preset["timesignature"],
        "keyscale": preset["keyscale"],
    }


def parse_v3_suggest_payload(
    raw: str, *, style: str, language: str = "ru", vocal: str | None = None, soloist: str | None = None
) -> dict[str, Any]:
    fallback = fallback_v3_suggest(style, language=language, vocal=vocal, soloist=soloist)
    text = (raw or "").strip()
    if not text:
        return fallback
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I).strip()
    text = re.sub(r"\s*```$", "", text).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return fallback
    if not isinstance(data, dict):
        return fallback

    out = dict(fallback)
    out["vocal"] = (
        effective_v3_vocal(vocal, soloist)
        if vocal
        else effective_v3_vocal(str(data.get("vocal") or out["vocal"]), soloist)
    )
    for key, lo, hi in (("bpm", 10, 300), ("duration_seconds", 30, 300)):
        with suppress(TypeError, ValueError):
            out[key] = max(lo, min(hi, int(round(float(data.get(key, out[key]))))))
    ts = str(data.get("timesignature") or out["timesignature"]).strip()
    if ts in ("2", "3", "4", "6"):
        out["timesignature"] = ts
    keyscale = str(data.get("keyscale") or out["keyscale"]).strip()
    if keyscale:
        out["keyscale"] = keyscale[:32]
    lang = str(data.get("language") or out["language"]).strip()
    if lang:
        out["language"] = lang[:16]
    return out


def llama_options_for_v3(
    temperature: float | None,
    cfg_scale: float | None,
    top_p: float | None,
) -> dict[str, Any]:
    return _llama_options(temperature, cfg_scale, top_p)
