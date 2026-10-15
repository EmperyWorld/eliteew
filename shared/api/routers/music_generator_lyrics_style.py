# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lyrics/style runtime helpers for Music Generator: ACE guidance, creative
# sliders, enrich/parenthetical pipeline, suggest-production parsers, Llama
# chat/title. Prompt constants live in music_generator_lyrics_prompts.py.
# Invariants:
# - Must not import api.routers.music_generator (no cycle with the parent router).
# - May import music_generator_lyrics_prompts; prompts must not import this module.
# - Public URL paths and OpenAPI operation ids stay owned by music_generator.py.
# Related:
# - api/routers/music_generator.py
# - api/routers/music_generator_lyrics_prompts.py
# - api/routers/music_generator_tag_finalize.py
# - api/routers/music_lyrics_validation.py
# - documentation/product/MUSIC-GENERATOR-REFERENCE.md
# ---
"""Lyrics/style runtime helpers extracted from music_generator.py (Phase C.4)."""

from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import Any

import httpx
from fastapi import HTTPException

from api.core.http_clients import get_httpx_client

# Explicit ``Name as Name`` re-exports for child routes / parent / craft modules.
from api.routers.music_generator_lyrics_prompts import (
    IMPROVE_DIRECTIONS as IMPROVE_DIRECTIONS,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_ABSOLUTE_TABOO_WORDS_RU as LYRICS_ABSOLUTE_TABOO_WORDS_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_IMPROVE_FIX_GIBBERISH_RU as LYRICS_IMPROVE_FIX_GIBBERISH_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_IMPROVE_NO_PRODUCTION_SECTIONS_RU as LYRICS_IMPROVE_NO_PRODUCTION_SECTIONS_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_MARKUP_EDM_IF_THEME_EXPLICIT_RU as LYRICS_MARKUP_EDM_IF_THEME_EXPLICIT_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_MARKUP_RULES_BASE_RU as LYRICS_MARKUP_RULES_BASE_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_MARKUP_RULES_FOR_MODEL_RU as LYRICS_MARKUP_RULES_FOR_MODEL_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_MORPHOLOGY_AND_STRESS_RU as LYRICS_MORPHOLOGY_AND_STRESS_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_NO_CLICHE_PHRASES_RU as LYRICS_NO_CLICHE_PHRASES_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_NO_META_ABOUT_WRITING_RU as LYRICS_NO_META_ABOUT_WRITING_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_NO_META_MUSIC_DESCRIPTION_RU as LYRICS_NO_META_MUSIC_DESCRIPTION_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_OUTPUT_FORMAT_FOOTER_RU as LYRICS_OUTPUT_FORMAT_FOOTER_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_QUALITY_NO_GIBBERISH_RU as LYRICS_QUALITY_NO_GIBBERISH_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_SONG_VOICE_NOT_SCENE_RU as LYRICS_SONG_VOICE_NOT_SCENE_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_SONGCRAFT_MEANING_RU as LYRICS_SONGCRAFT_MEANING_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_STYLE_GUIDE_RU as LYRICS_STYLE_GUIDE_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_THEME_PRIORITY_UNIVERSAL_RU as LYRICS_THEME_PRIORITY_UNIVERSAL_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_VOCAL_GRAMMAR_EN as LYRICS_VOCAL_GRAMMAR_EN,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_VOCAL_GRAMMAR_FR as LYRICS_VOCAL_GRAMMAR_FR,
)
from api.routers.music_generator_lyrics_prompts import (
    LYRICS_VOCAL_GRAMMAR_RU as LYRICS_VOCAL_GRAMMAR_RU,
)
from api.routers.music_generator_lyrics_prompts import (
    _get_form_specific_instructions as _get_form_specific_instructions,
)
from api.routers.music_generator_lyrics_prompts import (
    _lyrics_improve_preserve_language_line as _lyrics_improve_preserve_language_line,
)
from api.routers.music_generator_lyrics_prompts import (
    _lyrics_language_instruction as _lyrics_language_instruction,
)
from api.routers.music_generator_lyrics_prompts import (
    _lyrics_style_block_ru as _lyrics_style_block_ru,
)
from api.routers.music_generator_lyrics_prompts import (
    _lyrics_vocal_grammar_for_language as _lyrics_vocal_grammar_for_language,
)
from api.routers.music_generator_lyrics_prompts import (
    _normalize_luna_mode,
)
from api.routers.music_generator_lyrics_prompts import (
    _normalize_lyrics_style_key as _normalize_lyrics_style_key,
)
from api.routers.music_generator_lyrics_prompts import (
    _style_english_luna_line as _style_english_luna_line,
)
from api.routers.music_generator_lyrics_prompts import (
    _style_english_rnb_classic_line as _style_english_rnb_classic_line,
)
from api.routers.music_generator_tag_finalize import _typical_bpm_for_music_style
from api.routers.music_lyrics_validation import (
    enforce_lyrics_vocal_gender_consistency,
    parse_music_section_header,
    sanitize_lyrics_ai_output,
    sanitize_lyrics_for_xl_base_comfy,
    scrub_forbidden_meta_music_words,
)
from api.schemas.music_suggest_production_params import SuggestProductionParamsResponse
from api.services.music_generator_title_lang import language_wants_russian_title
from api.services.studio_comfy_workflows import normalize_keyscale_for_ace_comfy

logger = logging.getLogger(__name__)

ACE_STEP_SPECIFIC_GUIDANCE = (
    "\nACE STEP 1.5 (strict):\n"
    "- Tags must be SHORT comma-separated production cues ACE can parse — not a literary essay.\n"
    '- Avoid filler clauses: no "to reflect…", "evoking…", "journey of…", "tying arrangement to theme…".\n'
    '- Put BPM and genre first (e.g. "118 BPM …, female vocal, …"), then sections in order.\n'
    "- Section markers control arrangement: [intro], [verse], [chorus], [build up], [drop], [breakdown], [outro].\n"
    '- After each [section], use brief English production words (e.g. "[verse] clean mix, synth bass").\n'
    "- FX where needed: riser, white noise sweep, sidechain — name them briefly.\n"
    "- For hard electronic/EDM presets only: include [build up] and [drop] with tight notes.\n"
    "- For intimate indie / electro-pop (e.g. luna), prefer emotional [chorus] lift over aggressive club [drop].\n"
    "- Do not repeat or quote lyrics lines in tags.\n"
)


def _parse_optional_music_creative_sliders(body: dict) -> tuple[float | None, float | None, float | None]:
    """Те же поля, что у генерации музыки: temperature, cfg_scale, top_p (все опционально)."""
    raw_t = body.get("temperature")
    raw_cfg = body.get("cfg_scale")
    raw_tp = body.get("top_p")
    t: float | None = None
    cfg: float | None = None
    tp: float | None = None
    if raw_t is not None:
        try:
            t = max(0.0, min(1.0, float(raw_t)))
        except (TypeError, ValueError):  # fmt: skip
            t = None
    if raw_cfg is not None:
        try:
            cfg = max(1.0, min(4.0, float(raw_cfg)))
        except (TypeError, ValueError):  # fmt: skip
            cfg = None
    if raw_tp is not None:
        try:
            tp = max(0.8, min(0.98, float(raw_tp)))
        except (TypeError, ValueError):  # fmt: skip
            tp = None
    return t, cfg, tp


def _llama_options_for_lyrics_pipeline(
    temperature: float | None,
    cfg_scale: float | None,
    top_p: float | None,
) -> dict[str, Any]:
    """Опции Llama chat для текстовых шагов студии (совпадают по смыслу с ползунками генерации музыки)."""
    opts: dict[str, Any] = {"num_predict": 8192}
    if temperature is not None:
        opts["temperature"] = temperature
    if top_p is not None:
        opts["top_p"] = top_p
    if cfg_scale is not None:
        # cfg выше — чуть сильнее «держать» формулировки (аналог силы следования промпту)
        opts["repeat_penalty"] = 1.05 + (cfg_scale - 1.0) / 3.0 * 0.22
    return opts


def _lyrics_creative_extra_block_ru(
    temperature: float | None,
    cfg_scale: float | None,
    top_p: float | None,
) -> str:
    if all(x is None for x in (temperature, cfg_scale, top_p)):
        return ""
    parts: list[str] = []
    if temperature is not None:
        parts.append(f"вариативность формулировок ~{temperature:.2f} (0 — строже, 1 — свободнее)")
    if cfg_scale is not None:
        parts.append(f"следование теме и жанру ~{cfg_scale:.2f}/4 (выше — ближе к жанровому брифу)")
    if top_p is not None:
        parts.append(f"разнообразие лексики ~{top_p:.2f} (выше — богаче выбор слов)")
    return "\n\nПараметры от пользователя (учитывай в балансе креатива): " + "; ".join(parts) + "."


def _style_creative_extra_block_en(
    temperature: float | None,
    cfg_scale: float | None,
    top_p: float | None,
) -> str:
    if all(x is None for x in (temperature, cfg_scale, top_p)):
        return ""
    return (
        "\n\n(User slider hints — reflect in how tight vs exploratory the description is: "
        f"creativity/temperature ≈ {temperature}; "
        f"adherence to genre+brief ≈ {cfg_scale}/4; "
        f"lexical diversity (top_p) ≈ {top_p}.)"
    )


def _parse_json_object_from_llm(text: str) -> dict[str, Any] | None:
    """Извлекает один JSON-object из ответа LLM (в т.ч. с обёрткой ```json)."""
    s = (text or "").strip()
    if not s:
        return None
    if s.startswith("```"):
        lines = s.splitlines()
        if len(lines) >= 2 and lines[0].strip().startswith("```"):
            end = len(lines)
            if lines[-1].strip() == "```":
                end = -1
            s = "\n".join(lines[1:end]).strip()
    try:
        obj = json.loads(s)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}", s)
    if m:
        try:
            obj = json.loads(m.group(0))
            return obj if isinstance(obj, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _canonical_section_for_enriched_hint(section_name: str) -> str:
    s = (section_name or "").strip().lower()
    s = re.sub(r"\s+", " ", s)
    if s.startswith("intro"):
        return "intro"
    if s.startswith("verse"):
        return "verse"
    if s.startswith("pre-chorus") or s.startswith("pre chorus") or s.startswith("prechorus"):
        return "pre-chorus"
    if s.startswith("chorus"):
        return "chorus"
    if s.startswith("build up") or s.startswith("build-up") or s.startswith("buildup"):
        return "build-up"
    if s.startswith("drop"):
        return "drop"
    if s.startswith("breakdown"):
        return "breakdown"
    if s.startswith("bridge"):
        return "bridge"
    if s.startswith("outro"):
        return "outro"
    if s.startswith("hook"):
        return "hook"
    return "verse"


def _style_flavor_for_enriched_hint(style_key: str, *, luna_mode: str = "classic") -> str:
    key = (style_key or "").strip().lower()
    lm = _normalize_luna_mode(luna_mode)
    style_map: dict[str, str] = {
        "pop": "polished pop groove",
        "rock": "guitar-driven rock groove",
        "electronic": "electronic dance groove",
        "drum and bass": "drum & bass breakbeat groove",
        "dubstep": "dubstep bass-forward groove",
        "ballad": "emotional ballad arrangement",
        "hip_hop": "hip-hop drum and bassline pocket",
        "classical": "orchestral cinematic texture",
        "luna": (
            "nostalgic dream / indie electro-pop texture"
            if lm == "classic"
            else "experimental dream / indie electro-pop texture"
        ),
        "folk": "acoustic folk texture",
        "chillout": "downtempo chill lounge texture",
        "jazz": "swing jazz ensemble texture",
        "chicago_blues": "Chicago blues shuffle groove texture",
        "house": "four-on-the-floor house groove",
        "techno": "minimal driving techno groove",
        "trance": "euphoric trance supersaw groove",
        "edm": "big-room festival EDM groove",
        "hardstyle": "distorted hardstyle kick groove",
        "ambient_instrumental": "ambient textural instrumental arrangement",
        "post_rock_instrumental": "post-rock guitar instrumental arrangement",
        "cinematic_instrumental": "cinematic orchestral instrumental arrangement",
        "bossa_instrumental": "bossa nova jazz instrumental arrangement",
        "funk_instrumental": "funk groove instrumental arrangement",
        "celtic_instrumental": "Celtic acoustic instrumental arrangement",
        "metal": "heavy metal guitar-forward groove",
        "indie_rock": "indie rock guitar band groove",
        "grunge": "grunge loud-quiet alt-rock groove",
        "soul": "classic soul Motown groove",
        "latin_pop": "Latin pop percussion-forward groove",
        "disco": "disco four-on-the-floor groove",
        "amapiano": "amapiano log-drum lounge groove",
        "bollywood_pop": "Bollywood film-pop orchestral groove",
        "mandopop": "Mandopop polished pop groove",
        "drill": "drill sliding-808 dark groove",
        "reggae": "reggae one-drop roots groove",
        "baile_funk": "baile funk tamborzão street groove",
        "punjabi_pop": "Punjabi dhol-driven bhangra groove",
        "neo_soul": "neo-soul warm Rhodes live-drums groove",
        "gospel_soul": "gospel soul uplifting organ-and-choir groove",
        "indie_folk_pop": "indie folk pop stomp-and-clap anthem groove",
        "boogie_funk": "boogie funk piano-forward dance groove",
        "trap": "modern trap 808-and-hat groove",
        "punk_rock": "fast punk rock band groove",
        "shoegaze": "shoegaze dream-rock guitar wall texture",
        "darkwave": "darkwave cold synth pulse",
        "eurodance": "Eurodance piano-stab rave-pop groove",
        "uk_garage": "UK garage two-step shuffle groove",
        "flamenco_pop": "flamenco pop nylon-guitar and palmas groove",
        "city_pop": "Japanese city pop glossy fusion groove",
        "electro_swing": "electro swing EDM bed with vintage brass and swing-layer hats (club first)",
        "singer_songwriter": "intimate acoustic singer-songwriter groove",
        "art_pop": "art pop experimental arrangement texture",
        "dance_pop": "radio dance pop four-on-the-floor hook groove",
        "tropical_house": "tropical house melodic beach groove",
        "future_bass": "future bass emotional supersaw drop groove",
        "indie_electropop": "indie electropop synth band groove",
        "french_chanson": "French chanson storytelling cabaret groove",
        "power_ballad": "power ballad slow epic chorus texture",
        "progressive_rock": "progressive rock shifting meters band texture",
        "ska_punk": "ska punk offbeat brass fast groove",
        "new_romantic": "80s new romantic synth wave groove",
        "middle_eastern_pop": "Middle Eastern pop percussion-forward groove",
        "moombahton": "moombahton dembow hybrid groove",
        "trip_hop": "trip-hop dusty downtempo sample groove",
        "vaporwave": "vaporwave chillwave nostalgic haze texture",
        "glam_rock": "glam rock arena rock big choir groove",
    }
    return style_map.get(key, "modern song arrangement")


def _normalize_voice_variation_level(raw: Any) -> str:
    key = str(raw or "").strip().lower()
    mapping = {
        "subtle": "subtle",
        "balanced": "balanced",
        "wild": "wild",
        "soft": "subtle",
        "medium": "balanced",
        "strong": "wild",
        "мягко": "subtle",
        "сдержанно": "subtle",
        "сбалансированно": "balanced",
        "баланс": "balanced",
        "смело": "wild",
        "ярко": "wild",
    }
    return mapping.get(key, "balanced")


def _voice_diversity_prompt_ru(level: str) -> str:
    lv = _normalize_voice_variation_level(level)
    if lv == "subtle":
        return "Подача Voice-ремарок: СДЕРЖАННАЯ. Меняй нюансы мягко между секциями, без резких контрастов характера."
    if lv == "wild":
        return (
            "Подача Voice-ремарок: СМЕЛАЯ. Делай заметные контрасты между секциями "
            "(интимно/напряжённо/широко), но без карикатурности."
        )
    return (
        "Подача Voice-ремарок: СБАЛАНСИРОВАННАЯ. Вариативно между секциями, "
        "с естественными переходами и без однотипных формулировок."
    )


def _default_enriched_section_hint(section_kind: str, *, style_key: str, bpm: int, luna_mode: str = "classic") -> str:
    flavor = _style_flavor_for_enriched_hint(style_key, luna_mode=luna_mode)
    lm = _normalize_luna_mode(luna_mode)
    hints: dict[str, str] = {
        "intro": f"{flavor}, atmospheric pad transition, subtle riser, {bpm} BPM feel",
        "verse": f"{flavor}, drums and bass foundation, light reverb tails, {bpm} BPM feel",
        "pre-chorus": f"{flavor}, tension build transition, filter sweep, {bpm} BPM feel",
        "chorus": f"{flavor}, fuller lead layers, wide stereo and delay throws, {bpm} BPM feel",
        "build-up": f"{flavor}, riser transition with snare lift, {bpm} BPM feel",
        "drop": f"{flavor}, impactful rhythm drop with bass emphasis, {bpm} BPM",
        "breakdown": f"{flavor}, sparse transition with filtered textures, {bpm} BPM feel",
        "bridge": f"{flavor}, contrasting transition, atmospheric effects, {bpm} BPM feel",
        "outro": f"{flavor}, gradual fade transition, reverb tail, {bpm} BPM feel",
        "hook": f"{flavor}, hook-focused rhythm and synth accent, {bpm} BPM feel",
    }
    if (style_key or "").strip().lower() == "luna":
        if lm == "experimental":
            hints.update(
                {
                    "intro": f"{flavor}, tape-noise bloom, detuned pad shimmer, {bpm} BPM feel",
                    "verse": f"{flavor}, dry close-mic pulse, broken drum-machine ghost notes, {bpm} BPM feel",
                    "chorus": f"{flavor}, wider synth bloom, layered doubles, risky harmony lift, {bpm} BPM feel",
                    "bridge": f"{flavor}, filtered drop in energy, dream-delay drift, {bpm} BPM feel",
                }
            )
        else:
            hints.update(
                {
                    "intro": f"{flavor}, soft analog pad fade-in, gentle pulse, {bpm} BPM feel",
                    "verse": f"{flavor}, intimate drum-machine pocket, warm bass movement, {bpm} BPM feel",
                    "chorus": f"{flavor}, emotional chorus width, airy doubles, {bpm} BPM feel",
                }
            )
    return hints.get(section_kind, hints["verse"])


def _default_voice_parenthetical(
    vocal: str,
    *,
    section_kind: str,
    style_key: str,
    content_anchor: str,
    voice_variation_level: str,
    luna_mode: str = "classic",
) -> str:
    v = (vocal or "female").strip().lower()
    if v == "male":
        voice_label = "male"
    elif v == "duet":
        voice_label = "duet (male and female)"
    else:
        voice_label = "female"
    level = _normalize_voice_variation_level(voice_variation_level)
    luna_mode_norm = _normalize_luna_mode(luna_mode)

    section_mood_map: dict[str, tuple[str, ...]] = {
        "intro": ("hushed", "cinematic", "anticipatory"),
        "verse": ("confessional", "grounded", "story-driven"),
        "pre-chorus": ("tense", "rising", "expectant"),
        "chorus": ("anthemic", "open-throated", "uplifting"),
        "build-up": ("urgent", "breath-held", "escalating"),
        "drop": ("commanding", "punchy", "high-energy"),
        "breakdown": ("intimate", "fragile", "stripped"),
        "bridge": ("contrasting", "dramatic", "reflective"),
        "outro": ("fading", "tender", "afterglow"),
        "hook": ("catchy", "magnetic", "direct"),
    }
    vocal_color_map: dict[str, tuple[str, ...]] = {
        "male": ("warm chest tone", "gritty edge", "close-mic depth"),
        "female": ("airy top line", "silky phrasing", "bright intimate tone"),
        "duet": ("call-and-response blend", "interwoven harmonies", "alternating leads"),
    }
    style_fx_map: dict[str, tuple[str, ...]] = {
        "drum and bass": ("short plate reverb", "stereo slap delay", "tight room reverb"),
        "dubstep": ("tight room reverb", "ping-pong delay", "saturated doubling"),
        "rock": ("room ambience", "slapback delay", "parallel saturation"),
        "ballad": ("long plate reverb", "subtle delay throws", "soft hall ambience"),
        "luna": (
            ("light chorus", "stereo micro-delay", "clean plate reverb")
            if luna_mode_norm == "classic"
            else ("tape flutter echo", "modulated micro-delay", "dreamy plate reverb")
        ),
    }
    style_fx_default = ("light reverb", "controlled delay", "subtle stereo width")

    moods = list(section_mood_map.get(section_kind, section_mood_map["verse"]))
    colors = list(vocal_color_map.get(v if v in vocal_color_map else "female", vocal_color_map["female"]))
    style_key_norm = (style_key or "").strip().lower()
    fx_opts = list(style_fx_map.get(style_key_norm, style_fx_default))

    if level == "subtle":
        moods = moods[:2] if len(moods) >= 2 else moods
        colors = colors[:2] if len(colors) >= 2 else colors
        fx_opts = fx_opts[:2] if len(fx_opts) >= 2 else fx_opts
    elif level == "wild":
        wild_moods: dict[str, tuple[str, ...]] = {
            "intro": ("hypnotic", "nocturnal"),
            "verse": ("vulnerable", "detached"),
            "pre-chorus": ("electric", "edge-of-breath"),
            "chorus": ("soaring", "magnetic"),
            "bridge": ("hallucinatory", "glass-soft"),
            "outro": ("weightless", "fading-neon"),
        }
        wild_colors: dict[str, tuple[str, ...]] = {
            "male": ("velvet low register", "smoky close-mic"),
            "female": ("breathy close-mic", "fragile metallic edge"),
            "duet": ("mirrored phrases", "cross-harmony tension"),
        }
        wild_fx: dict[str, tuple[str, ...]] = {
            "luna": ("tape flutter echo", "wide chorus bloom", "dreamy plate reverb"),
            "electronic": ("ping-pong delay", "modulated plate reverb"),
        }
        moods.extend(wild_moods.get(section_kind, ("cinematic",)))
        colors.extend(wild_colors.get(v if v in wild_colors else "female", ("intimate tone",)))
        fx_opts.extend(wild_fx.get(style_key_norm, ("stereo throw delay",)))

    fingerprint = f"{style_key_norm}|{luna_mode_norm}|{section_kind}|{v}|{content_anchor.strip().lower()[:120]}"
    digest = hashlib.sha1(fingerprint.encode("utf-8")).hexdigest()
    idx = int(digest[:8], 16)
    mood = moods[idx % len(moods)]
    color = colors[(idx // 7) % len(colors)]
    fx = fx_opts[(idx // 13) % len(fx_opts)]
    return f"(Voice: {voice_label}, {mood}, {color}, {fx})"


def _line_is_voice_parenthetical(line: str) -> bool:
    s = (line or "").strip().lower()
    if not (s.startswith("(") and s.endswith(")")):
        return False
    inner = s[1:-1].strip()
    return inner.startswith("voice:") or inner.startswith("vocal:")


def _line_is_arrangement_parenthetical(line: str) -> bool:
    s = (line or "").strip().lower()
    if not (s.startswith("(") and s.endswith(")")):
        return False
    inner = s[1:-1].strip()
    return inner.startswith("arrangement:") or inner.startswith("аранжировка:")


def _line_is_section_caption_label(line: str) -> bool:
    s = (line or "").strip().lower()
    return bool(
        re.fullmatch(
            r"(?:intro|verse(?:\s*\d+)?|chorus(?:\s*\d+)?|bridge|outro|pre-chorus|pre chorus|prechorus|"
            r"интро|куплет(?:\s*\d+)?|припев|бридж|аутро|вступление)\s*:",
            s,
        )
    )


def _lyrics_contains_enriched_headers(lyrics: str) -> bool:
    return bool(re.search(r"^\s*\[[^\]\n:]+:[^\]\n]+]\s*$", lyrics or "", re.MULTILINE))


def _lyrics_skip_auto_enrich(lyrics: str) -> bool:
    """Не повторять enrich, если lyrics уже structured (inline [Verse: …] или split Arrangement/Voice)."""
    text = (lyrics or "").strip()
    if not text:
        return False
    return bool(
        _lyrics_contains_enriched_headers(text)
        or (
            re.search(r"^\(Arrangement:", text, re.I | re.M) is not None
            and re.search(r"^\(Voice:", text, re.I | re.M) is not None
        )
    )


def _postprocess_llm_lyrics_content(
    raw_content: str,
    *,
    style_key: str,
    language: str,
    vocal_raw: str,
    voice_variation_level: str,
    luna_mode: str,
    is_xl_base_sft: bool,
    skip_enriched_sections: bool = False,
) -> str:
    content = sanitize_lyrics_ai_output(raw_content)
    if not skip_enriched_sections and not _lyrics_skip_auto_enrich(content):
        content = _ensure_enriched_auto_lyrics_sections(
            content,
            style_key=style_key,
            vocal=vocal_raw or "female",
            voice_variation_level=voice_variation_level,
            luna_mode=luna_mode,
        )
    if vocal_raw in ("male", "female"):
        content, _ = enforce_lyrics_vocal_gender_consistency(content, vocal=vocal_raw, language=language)
    content, _taboo_changed, _taboo_hits = scrub_forbidden_meta_music_words(content, language=language)
    if is_xl_base_sft:
        content = sanitize_lyrics_for_xl_base_comfy(content)
    return content.strip()


def _ensure_enriched_auto_lyrics_sections(
    lyrics: str,
    *,
    style_key: str,
    vocal: str,
    voice_variation_level: str = "balanced",
    luna_mode: str = "classic",
) -> str:
    """
    Guarantees enriched section headers for auto-generated lyrics:
    [Section: instruments/effects/transitions, N BPM feel]
    plus optional per-section Voice parenthetical.
    """
    text = (lyrics or "").strip()
    if not text:
        return text
    if _lyrics_skip_auto_enrich(text):
        return text
    bpm = _typical_bpm_for_music_style(style_key)
    variation_level = _normalize_voice_variation_level(voice_variation_level)
    luna_mode_norm = _normalize_luna_mode(luna_mode)
    lines = text.splitlines()
    out: list[str] = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        parsed = parse_music_section_header(stripped)
        if not parsed:
            if (
                _line_is_voice_parenthetical(stripped)
                or _line_is_arrangement_parenthetical(stripped)
                or _line_is_section_caption_label(stripped)
            ):
                # Для auto-lyrics стандартизируем и разнообразим Voice-строки ниже по секциям.
                continue
            out.append(line)
            continue
        section_name_raw = parsed["section_name_raw"] or "Verse"
        section_kind = _canonical_section_for_enriched_hint(section_name_raw)
        arrangement_hint = (parsed["arrangement_hint"] or "").strip()
        # Музыкальная ремарка в заголовке должна быть только на английском.
        if arrangement_hint and re.search(r"[А-Яа-яЁё]", arrangement_hint):
            arrangement_hint = ""
        if not arrangement_hint:
            arrangement_hint = _default_enriched_section_hint(
                section_kind, style_key=style_key, bpm=bpm, luna_mode=luna_mode_norm
            )
        elif not re.search(r"\b\d{2,3}\s*BPM(?:\s*feel)?\b", arrangement_hint, re.IGNORECASE):
            arrangement_hint = f"{arrangement_hint.rstrip(' ,;')}, {bpm} BPM feel"
        out.append(f"[{section_name_raw}: {arrangement_hint}]")

        anchor = ""
        for j in range(i + 1, len(lines)):
            probe = lines[j].strip()
            if not probe:
                continue
            if (
                _line_is_voice_parenthetical(probe)
                or _line_is_arrangement_parenthetical(probe)
                or _line_is_section_caption_label(probe)
            ):
                continue
            if parse_music_section_header(probe):
                break
            anchor = probe
            break
        out.append(
            _default_voice_parenthetical(
                vocal,
                section_kind=section_kind,
                style_key=style_key,
                content_anchor=anchor,
                voice_variation_level=variation_level,
                luna_mode=luna_mode_norm,
            )
        )
    s = "\n".join(out)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def _duration_seconds_fallback_for_style(style_key: str) -> int:
    sk = (style_key or "pop").strip().lower()
    if sk in (
        "ballad",
        "noir_cabaret",
        "classical",
        "chillout",
        "jazz",
        "chicago_blues",
        "reggae",
        "gospel_soul",
        "power_ballad",
        "progressive_rock",
        "french_chanson",
        "trip_hop",
    ):
        return 240
    if sk in (
        "ambient_instrumental",
        "post_rock_instrumental",
        "cinematic_instrumental",
    ):
        return 260
    if sk in ("bossa_instrumental", "funk_instrumental", "celtic_instrumental", "indie_folk_pop"):
        return 220
    if sk in (
        "drum and bass",
        "dubstep",
        "edm",
        "hardstyle",
        "techno",
        "house",
        "trance",
        "metal",
        "disco",
        "soul",
        "latin_pop",
        "indie_rock",
        "grunge",
        "amapiano",
        "bollywood_pop",
        "mandopop",
        "drill",
        "baile_funk",
        "punjabi_pop",
        "neo_soul",
        "boogie_funk",
        "trap",
        "punk_rock",
        "shoegaze",
        "darkwave",
        "eurodance",
        "electro_swing",
        "uk_garage",
        "flamenco_pop",
        "city_pop",
    ):
        return 200
    return 180


def _fallback_suggest_production_params(style_key: str) -> SuggestProductionParamsResponse:
    bpm = _typical_bpm_for_music_style(style_key)
    return SuggestProductionParamsResponse(
        vocal="female",
        bpm=max(40, min(300, int(bpm))),
        duration_seconds=_duration_seconds_fallback_for_style(style_key),
        language="ru",
        timesignature="4",
        keyscale="C major",
    )


def _parse_suggest_production_response(raw: dict[str, Any], style_key: str) -> SuggestProductionParamsResponse:
    try:
        merged = dict(raw)
        if isinstance(merged.get("keyscale"), str):
            merged["keyscale"] = normalize_keyscale_for_ace_comfy(merged["keyscale"])
        if merged.get("bpm") is not None:
            try:
                merged["bpm"] = max(40, min(300, int(merged["bpm"])))
            except (TypeError, ValueError):  # fmt: skip
                merged.pop("bpm", None)
        return SuggestProductionParamsResponse.model_validate(merged)
    except Exception:
        return _fallback_suggest_production_params(style_key)


async def _call_llama_chat(messages: list[dict], settings: object) -> str:
    """HTTP-к чату LLM (/api/chat и fallback /v1/chat/completions). Не означает «только приложение Llama»."""
    primary = getattr(settings, "llama_primary_url", None)
    # Без явного URL в конфигурации возможны запросы на docker-дефолт — оператор задаёт LLAMA_URL; см. STACK0-LLM-OVERVIEW.md
    fallback = getattr(settings, "llama_url", None) or "http://stack2-llama:11434"
    llama_urls = [u.rstrip("/") for u in [primary, fallback] if u]
    if not llama_urls:
        llama_urls = ["http://stack2-llama:11434"]
    music_model = getattr(settings, "llama_model_music_text_gen", None)
    if music_model and str(music_model).strip():
        model = str(music_model).strip()
    else:
        model = getattr(settings, "llama_primary_model", None) or getattr(settings, "default_ai_model", None)
        if not model:
            model = "llama3"
    payload = {"model": model, "messages": messages, "stream": False}
    data = None
    last_error: Exception | None = None
    client = get_httpx_client()
    for base_url in llama_urls:
        try:
            resp = await client.post(f"{base_url}/api/chat", json=payload, timeout=360.0)
            if resp.status_code == 404 or (resp.status_code == 200 and "error" in (resp.text or "").lower()):
                resp = await client.post(f"{base_url}/v1/chat/completions", json=payload, timeout=360.0)
            resp.raise_for_status()
            data = resp.json()
            break
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            last_error = e
            logger.warning("Llama at %s failed: %s, trying next", base_url, e)
            continue
    if data is None:
        raise HTTPException(status_code=502, detail="Llama unavailable") from last_error
    content = ""
    if "message" in data and isinstance(data["message"], dict):
        content = (data["message"].get("content") or "").strip()
    elif "choices" in data and isinstance(data["choices"], list) and data["choices"]:
        msg = data["choices"][0].get("message") or {}
        content = (msg.get("content") or "").strip()
    return content


async def _generate_song_title(lyrics: str, settings: object, language: str | None = None) -> str:
    """Generate a short song title from lyrics via Llama. Russian if song language is ru; English otherwise (en, fr, …)."""
    lyrics_sample = (lyrics or "").strip()[:2000]
    if not lyrics_sample:
        return ""
    if language_wants_russian_title(language):
        system_prompt = (
            "Ты автор. По тексту песни придумай краткое название (1–5 слов) на русском языке. "
            "Выведи только название, без кавычек и пояснений."
        )
        user_prompt = f"Текст песни:\n\n{lyrics_sample}\n\nНазвание песни:"
    else:
        system_prompt = (
            "You are a songwriter. From the lyrics, invent a short song title (1–5 words). "
            "Output only the title, no quotes or explanation. Use English, even if the lyrics are in another language."
        )
        user_prompt = f"Lyrics:\n\n{lyrics_sample}\n\nSong title:"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    content = await _call_llama_chat(messages, settings)
    title = (content or "").strip().strip("\"'")
    if not title:
        return ""
    return title[:200]
