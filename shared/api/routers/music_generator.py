# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Music Generator parent router: style/suggest/validate/promo/like + mounts children.
# Lyrics/improve and generate/edit live on child routers (no extra prefix).
# Invariants:
# - Parent keeps prefix="/music-generator"; child routers have no extra prefix.
# - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
# - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# - api/routers/music_generator_constants.py (лимиты, общие с companion registry).
# - api/routers/music_generator_lyrics_style.py (lyrics/style/prompt helpers).
# - api/routers/music_generator_lyrics_routes.py (POST /lyrics, /improve-lyrics).
# - api/routers/music_generator_generate.py (POST /generate, /edit child router).
# ---
"""
Music Generator API: lyrics via UGS (Llama), музыка и правки — через UGS (единый пайплайн студии).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel  # type: ignore[import-untyped]
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.companion.orchestration.companion_music_creative_context import (
    companion_music_deictic_style_guard_from_context,
    companion_music_tone_balance_block_from_context,
)
from api.routers.creative_studio_utils import run_studio_ugs_generate
from api.routers.music_generator_constants import (
    MAX_EWA_COMPANION_CONTEXT_CHARS,
    MAX_LYRICS_LENGTH,
)
from api.routers.music_generator_generate import (
    _maybe_save_liked_recipe_json,
    _maybe_save_music_generator_request_json,
)
from api.routers.music_generator_generate import (
    edit_music as edit_music,
)
from api.routers.music_generator_generate import (
    generate_music as generate_music,
)
from api.routers.music_generator_generate import (
    router as music_generator_generate_router,
)
from api.routers.music_generator_lyrics_routes import (
    generate_lyrics as generate_lyrics,
)
from api.routers.music_generator_lyrics_routes import (
    improve_lyrics as improve_lyrics,
)
from api.routers.music_generator_lyrics_routes import (
    router as music_generator_lyrics_router,
)
from api.routers.music_generator_lyrics_style import (
    ACE_STEP_SPECIFIC_GUIDANCE,
    _fallback_suggest_production_params,
    _llama_options_for_lyrics_pipeline,
    _lyrics_creative_extra_block_ru,
    _normalize_luna_mode,
    _parse_json_object_from_llm,
    _parse_optional_music_creative_sliders,
    _parse_suggest_production_response,
    _style_creative_extra_block_en,
)
from api.routers.music_generator_lyrics_style import (
    LYRICS_ABSOLUTE_TABOO_WORDS_RU as LYRICS_ABSOLUTE_TABOO_WORDS_RU,
)
from api.routers.music_generator_lyrics_style import (
    LYRICS_MORPHOLOGY_AND_STRESS_RU as LYRICS_MORPHOLOGY_AND_STRESS_RU,
)
from api.routers.music_generator_lyrics_style import (
    LYRICS_NO_CLICHE_PHRASES_RU as LYRICS_NO_CLICHE_PHRASES_RU,
)
from api.routers.music_generator_lyrics_style import (
    LYRICS_NO_META_ABOUT_WRITING_RU as LYRICS_NO_META_ABOUT_WRITING_RU,
)
from api.routers.music_generator_tag_finalize import (
    ACE_STEP_TAG_VOCAB_HINT_EN,
    ELECTRONIC_STYLES_REQUIRING_DROP,
    MAX_TAGS_LENGTH,
    _finalize_ace_step_style_tags,
    _typical_bpm_for_music_style,
    coerce_tags_to_genre_preset,
    ensure_intro_section_tag_if_lyrics_have_intro,
    ensure_luna_ace_section_tags,
    format_ace_tags_prose_to_sections,
    luna_append_signature_production,
    lyrics_mood_hints_for_style_prompt,
    normalize_vocal_token_in_tags,
    simplify_tags_for_ace,
    soften_luna_ace_tags,
    strip_backticks_from_ace_tags,
)
from api.routers.music_lyrics_validation import (
    infer_lyrics_first_person_gender,
    lyrics_section_music_hints_for_style_prompt,
    lyrics_section_outline_for_style_prompt,
    lyrics_track_structure_canonical_for_style_prompt,
    sanitize_lyrics_ai_output,
    sanitize_lyrics_for_xl_base_comfy,
    validate_lyrics_for_music,
)
from api.routers.ugs import get_ugs_service
from api.routers.unified_content import get_content_service
from api.schemas.music_suggest_production_params import (
    SuggestProductionParamsRequest,
    SuggestProductionParamsResponse,
)
from api.services.music_generator_dislike_feedback import (
    build_dislike_recipe_snapshot,
    content_eligible_for_dislike_feedback,
    validate_dislike_reason,
)
from api.services.music_generator_liked_recipe import (
    build_liked_recipe_payload,
    content_eligible_for_liked_recipe,
)
from api.services.music_generator_promo import (
    align_promo_arrangement_bpm,
    build_concise_promo_ace_tags,
    build_raw_promo_lyrics_preserving_copy,
    normalize_promo_director_factors,
    normalize_promo_voiceover_lyrics,
    promo_director_prompt_block,
    recommend_promo_duration_and_bpm,
)
from api.services.music_generator_promo import (
    bpm_speech_for_promo as _promo_bpm_speech_for_promo,
)
from api.services.music_generator_xl_base_pipeline import (
    prepare_xl_base_tags_for_comfy,
)
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.services.unified_content.content_storage_service import ContentStorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/music-generator", tags=["Music Generator"])

router.include_router(music_generator_lyrics_router)
router.include_router(music_generator_generate_router)


class RecordLikeRecipeRequest(BaseModel):
    content_id: UUID


class RecordDislikeFeedbackRequest(BaseModel):
    content_id: UUID
    reason_code: str
    reason_custom: str | None = None


def _bpm_speech_for_promo(target_duration_sec: int) -> int:
    """Скорость рекламной реплики: ~30–60 с — чуть бодрее, длинные — ровнее."""
    return _promo_bpm_speech_for_promo(target_duration_sec)


def _text_from_ugs_result(ugs_result: dict[str, Any]) -> str:
    block = ugs_result.get("result") or {}
    if isinstance(block, dict):
        if isinstance(block.get("result"), dict):
            inner = block["result"]
            return str(inner.get("text") or inner.get("content") or inner.get("response") or "").strip()
        return str(block.get("text") or block.get("content") or block.get("response") or "").strip()
    return ""


def _plain_text_from_ugs_llm_result(ugs_result: dict[str, Any]) -> str:
    """Strip Gemma ``<|channel|>`` / CoT wrappers from stack2 text completions (lyrics, tags)."""
    from api.utils.llm_json_extract import strip_llm_thinking_prefix

    return strip_llm_thinking_prefix(_text_from_ugs_result(ugs_result))


def _strip_markdown_code_fences(text: str) -> str:
    """Убирает внешние обёртки ```lang ... ``` (в т.ч. повторные), которые LLM иногда добавляет."""
    s = (text or "").strip()
    for _ in range(6):
        if not s.startswith("```"):
            break
        lines = s.splitlines()
        if len(lines) < 2:
            break
        if not lines[0].lstrip().startswith("```"):
            break
        if lines[-1].strip() != "```":
            break
        s = "\n".join(lines[1:-1]).strip()
    return s


@router.post("/generate-style")
async def generate_style(
    body: dict,
    user: User = Depends(require_oauth2_user),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> dict:
    """
    Generate track style (tags) in English via UGS from lyrics + genre + vocal.
    Ориентир ACE Step 1.5: tags = инструментал и продакшн (секции, эффекты); lyrics в промпте
    только как контекст — не копировать слова в описание.
    """
    _maybe_save_music_generator_request_json("generate-style", user_id=str(user.id), body=body)
    lyrics = (body.get("lyrics") or "").strip()
    if not lyrics:
        raise HTTPException(status_code=400, detail="lyrics is required")
    if len(lyrics) > 4000:
        lyrics = lyrics[:4000] + "\n[...]"
    genre = (body.get("style") or "pop").strip().lower() or "pop"
    luna_mode = _normalize_luna_mode(body.get("luna_mode"))
    vocal = (body.get("vocal") or "female").strip().lower()
    if vocal not in ("male", "female", "duet"):
        vocal = "female"
    vocal_label = "duet (male and female)" if vocal == "duet" else vocal
    genre_bpm = _typical_bpm_for_music_style(genre)
    canonical_structure = lyrics_track_structure_canonical_for_style_prompt(lyrics)
    section_outline = lyrics_section_outline_for_style_prompt(lyrics)
    section_music_hints = lyrics_section_music_hints_for_style_prompt(lyrics)
    t_sl, cfg_sl, tp_sl = _parse_optional_music_creative_sliders(body)
    style_extra = _style_creative_extra_block_en(t_sl, cfg_sl, tp_sl)
    llama_opts = _llama_options_for_lyrics_pipeline(t_sl, cfg_sl, tp_sl)

    target_wf = (body.get("target_ugs_workflow") or body.get("ace_workflow") or "").strip().lower()
    if target_wf not in ("", "v2", "v2_base", "v2_sft"):
        target_wf = ""
    is_xl_base_sft = target_wf in ("v2_base", "v2_sft")
    if is_xl_base_sft:
        lyrics = sanitize_lyrics_for_xl_base_comfy(lyrics)
    xl_base_sft_role = (
        "TARGET: ACE Step 1.5 XL Base or XL SFT weights (not XL Turbo). "
        "Favor a compact, high-signal English brief: clear BPM + genre + vocal, then either "
        "(a) 3-6 [section] blocks with short production terms, OR (b) one cohesive producer-style "
        "paragraph of instrumental/mix detail (like a studio handoff). "
        "Do not maximize section count; avoid long prose sentences and redundant literary filler. "
        "Prioritize instrument names, groove, and mix adjectives the model can condition on. "
        "Place [build up]/[drop]/[breakdown] INSIDE the relevant [pre-chorus]/[chorus]/[bridge] blocks — "
        "never append global [build up]/[drop]/[breakdown] AFTER [outro]. "
        "Never write two bracket markers back-to-back (bad: [pre-chorus] [build up] — good: [pre-chorus] riser, drum build-up).\n\n"
    )

    system_prompt = (
        (xl_base_sft_role if is_xl_base_sft else "")
        + "ROLE SEPARATION: User lyrics may include enriched section headers with music hints "
        "([Verse: ... BPM feel, instruments/effects]) and optional (Voice: ...) lines. "
        "Treat these hints as arrangement guidance, but your output remains TAGS only "
        "(instrumental arrangement, mix, FX, section markers). Never paste or quote lyrical lines into tags.\n\n"
        "GENRE PRESET IS BINDING: The user's genre preset (given in the user message) sets BPM family and style. "
        "The opening of your tags MUST use that genre — e.g. ballad / folk / pop / luna → matching tempo and texture; "
        "do NOT output 'drum and bass', neuro, or '174 BPM' unless the preset is exactly drum and bass. "
        "Read lyrics for mood and imagery first; arrangement must fit BOTH the mood and the preset (no club DnB drop for melancholic ballads or fairy-tale lyrics unless preset is bass music).\n\n"
        "You are a professional music producer for ACE Step 1.5 AI music generator. "
        "Write a detailed English track description (the 'tags' field) that controls INSTRUMENTAL sound, "
        "arrangement, mix, and section-by-section production — NOT the sung words.\n\n"
        "STRUCTURE (critical):\n"
        "- If the lyrics use section headers in square brackets ([Intro], [Verse 1], [Chorus], …), "
        "your tags MUST follow the SAME ORDER: one bracketed section label per block, with English "
        "production notes after each (e.g. [intro] …, [verse 1] …, [chorus] …).\n"
        "- Section markers in tags MUST be lowercase: [intro], [verse], [chorus], [chorus 2], … — "
        "never '(occurrence N)' or Title Case like [Chorus].\n"
        "- If a section repeats (e.g. two choruses), use [chorus 2] (or [chorus 3]) with higher energy, "
        "riser, fuller mix — match the arc of the song.\n"
        "- If a STRUCTURE line is given in the user message, mirror it exactly.\n"
        "- If there are no [section] headers, infer a sensible pop/EDM structure for the genre.\n"
        "- At most 12 section blocks total; one [section] … clause per block — no extra storytelling paragraph.\n\n"
        "THEME → SOUND (infer from lyrics in any language; do NOT quote lyrics):\n"
        "- Map mood and imagery to arrangement: e.g. whirlwind/turbulence → dynamic shifts, "
        "filter sweeps, contrast; inner calm / still point → sparse bridge, piano or pads; "
        "city pulse / heartbeat → tight kick/snare groove; stars / vast space → wide pads, "
        "reverb tails, stereo depth.\n"
        '- Do NOT end tags with a literary closing sentence, meta-summary, or "theme tying" phrase. '
        'No filler like "to reflect the mood", "capturing the journey", "a testament to".\n\n'
        "PRODUCTION VOCABULARY:\n"
        "- Sections: [intro], [verse], [pre-chorus], [chorus], [build up], [drop], [breakdown], "
        "[bridge], [outro] as needed.\n"
        "- Effects: white noise sweep, riser, impact hit, downlifter, vocal chop, reverse cymbal.\n"
        "- Mix: sidechain compression, stereo width, saturation, reverb tail, delay throws, "
        "layered vocals, harmonies.\n\n"
        f"{ACE_STEP_TAG_VOCAB_HINT_EN}\n\n"
        f"Vocal line: use '{vocal_label} vocal' (or 'duet vocal' if duet).\n"
        "Gender consistency is strict: do NOT output opposite-gender lead descriptors "
        "(e.g. no 'female lead' when selected vocal is male, and vice versa).\n"
        "Start with BPM and genre flavor (e.g. '128 BPM modern electronic pop, female vocal, …').\n\n"
        "OUTPUT: One continuous line of comma-separated cues (no bullet lists, no markdown fences). "
        "Keep each [section] block concise — short phrases, not long storytelling.\n"
        "ACE Step 1.5: you MUST output bracketed section markers [intro], [verse], [chorus] at minimum "
        "(plus [bridge], [outro] when the song arc needs them). Each marker must be followed by short English "
        "production words — not prose sentences.\n"
        "Do NOT paste or quote any line from the user's lyrics.\n" + ACE_STEP_SPECIFIC_GUIDANCE + style_extra
    )
    lyrics_ctx = lyrics[:3000] if len(lyrics) > 3000 else lyrics
    mood_hint_line = lyrics_mood_hints_for_style_prompt(lyrics_ctx)
    structure_parts: list[str] = []
    if canonical_structure:
        structure_parts.append(canonical_structure)
    if section_outline:
        structure_parts.append(
            "SECTION ORDER FROM LYRICS (ACE lowercase outline; expand each with production in tags):\n"
            + section_outline
        )
    if section_music_hints:
        structure_parts.append(section_music_hints)
    structure_block = ("\n\n".join(structure_parts) + "\n\n") if structure_parts else ""
    electronic_extra = ""
    if genre == "luna":
        luna_vocal_phrase = (
            "duet vocal with intimate emotional delivery"
            if vocal == "duet"
            else f"{vocal} vocal with intimate emotional delivery"
        )
        luna_vocal_lead = "intimate emotional duet vocals" if vocal == "duet" else f"intimate emotional {vocal} vocal"
        luna_variant_line = (
            "Variant: classic (stable intimate contour, gentle transitions)."
            if luna_mode == "classic"
            else "Variant: experimental (same core mood, but bolder texture flips, unusual vocal doubles and section contrast)."
        )
        electronic_extra = (
            f"SPECIAL — preset «luna» (Russian dream / indie electro-pop ~110-122 BPM), Luna-style reference: {luna_vocal_lead}, "
            "nostalgic synth palette, close-mic breathy phrasing, warm pads, restrained sidechain pulse, chorus wider than verse, "
            "human intimacy in mix — NOT aggressive festival EDM [drop], NOT over-compressed rave shouting.\n"
            f"{luna_variant_line}\n"
            "FORMAT (mandatory for ACE Step 1.5): start with "
            f'"118 BPM Russian dream / indie electro-pop (Luna style), {luna_vocal_phrase}, " '
            "then IN ORDER comma-separated blocks: "
            "[intro] …, [verse] …, [chorus] …, [bridge] …, [outro] … — each bracket label immediately followed by "
            "short production terms (pads, analog synths, harmonies, piano, reverb tails, gentle sidechain).\n"
            "Mood: melancholic yet warm; intimate verses → wider emotional chorus; bridge dreamy/reflective.\n\n"
        )
    elif genre == "rnb_classic_female" and vocal in ("male", "duet"):
        electronic_extra = (
            "SPECIAL — preset «rnb_classic_female» with non-default vocal selected: "
            "keep classic R&B instrumentation (warm keys, swung groove, harmonies), "
            f"but lead vocal must be '{vocal_label}' and never 'female lead' unless vocal is female.\n\n"
        )
    elif genre == "electro_swing":
        electronic_extra = (
            "SPECIAL — preset «electro_swing» (electro swing / neo-swing): This is CLUB DANCE / ELECTRONIC music first. "
            "A loud modern EDM or house-weight groove (pumping four-on-the-floor or strong kick, club sub-bass, heavy sidechain, saturated mix, shuffled or swung hi-hats) is MANDATORY; "
            "1920s–40s or jazz is ONLY a LAYER: brass stabs, clarinet/trumpet hits, vinyl crackle, chopped vocal or scat samples, swing-ghosted snare — not a 'small jazz band' or 'acoustic guitar + brushed cymbals only' as the main picture.\n"
            f"You MUST use exactly ONE explicit BPM value in the entire tags string: {genre_bpm} BPM at the very beginning. "
            "Do NOT add a second or third different BPM in any [verse], [chorus], or [bridge] block (no '100 BPM' or '110 BPM' after the main tempo — same dance grid in every section).\n"
            "In [drop] and [chorus], name EDM transients: kick, sub, sidechain, horn stack or stab layers — not a quiet swing combo.\n"
            "Your tags MUST still include [build up] and [drop] with riser, bass, and peak energy (neo-swing / festival feel).\n\n"
        )
    elif genre in ELECTRONIC_STYLES_REQUIRING_DROP:
        electronic_extra = (
            "For this electronic/EDM genre preset, tags MUST include [build up] and [drop] "
            "with concise English production notes (riser, bass, energy).\n\n"
        )
    luna_tail = ""
    if genre == "luna":
        luna_tail = (
            "\n\nLUNA CHECKLIST (English tags only):\n"
            "- Do NOT write one long sentence; use ONLY the [intro]/[verse]/[chorus]/[bridge]/[outro] pattern above.\n"
            "- Keep the vocal space intimate in verses and wider in choruses; if any section is weak, "
            "strengthen arrangement words, not storytelling.\n"
            f"- Luna mode: {luna_mode}.\n"
            "- Do NOT force moon/stars/cosmic imagery unless lyrics explicitly ask for it.\n"
            '- No "to reflect the theme" or literary filler.\n'
        )
    mood_block = f"{mood_hint_line}\n\n" if mood_hint_line else ""
    companion_style_ctx = str(body.get("ewa_companion_context") or "").strip()
    companion_block = ""
    if companion_style_ctx:
        ru_style = bool(re.search(r"[\u0400-\u04ff]", companion_style_ctx))
        style_guard = companion_music_deictic_style_guard_from_context(companion_style_ctx, ru=ru_style)
        companion_block = style_guard + (
            "EWA companion context (dialog mood / persona — align tags, do not quote lyrics):\n"
            f"{companion_style_ctx[:MAX_EWA_COMPANION_CONTEXT_CHARS]}\n\n"
        )
    user_prompt = (
        f"Genre preset: {genre}. Vocal: {vocal_label}. "
        f"Typical BPM for this genre (hint): {genre_bpm}.\n"
        f"You MUST align tags with this genre preset and the hinted BPM — do not substitute another genre.\n\n"
        f"{companion_block}"
        f"{mood_block}"
        f"{electronic_extra}"
        f"{structure_block}"
        "Song lyrics (read for theme, mood, and section structure only; do NOT quote or copy lines):\n"
        f"{lyrics_ctx}\n\n"
        "Write the ACE Step 1.5 tags (instrumental + production + section markers) in English:"
        f"{luna_tail}"
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    try:
        resp = await run_studio_ugs_generate(
            ugs,
            user_id=str(user.id),
            type_key="music_generator_style",
            input_data={"messages": messages, "options": llama_opts},
        )
    except HTTPException:
        raise
    raw_tags = _strip_markdown_code_fences(_plain_text_from_ugs_llm_result(resp))
    if not raw_tags:
        raise HTTPException(status_code=502, detail="Llama returned empty style")
    tags = coerce_tags_to_genre_preset(strip_backticks_from_ace_tags(raw_tags.strip()), genre)
    tags = ensure_intro_section_tag_if_lyrics_have_intro(tags, lyrics_ctx)
    tags = _finalize_ace_step_style_tags(tags, genre=genre, ace_workflow=target_wf or None)
    logger.info(
        "music_generator generate_style: genre=%s mood_hint=%s raw_preview=%s",
        genre,
        bool(mood_hint_line),
        (raw_tags.strip()[:220] + "…") if len(raw_tags.strip()) > 220 else raw_tags.strip(),
    )
    tags = simplify_tags_for_ace(tags)
    if genre == "luna":
        tags = soften_luna_ace_tags(tags)
    tags = format_ace_tags_prose_to_sections(tags)
    if genre == "luna":
        tags = ensure_luna_ace_section_tags(tags)
        tags = luna_append_signature_production(tags)
    tags = simplify_tags_for_ace(tags)
    tags = normalize_vocal_token_in_tags(tags, vocal)
    if (target_wf or "").strip().lower() == "v2_base":
        tags = prepare_xl_base_tags_for_comfy(
            tags,
            style_key=genre,
            bpm_hint=genre_bpm,
            ace_workflow="v2_base",
        )
    elif len(tags) > MAX_TAGS_LENGTH:
        tags = tags[:MAX_TAGS_LENGTH]
    return {"tags": tags}


@router.post("/suggest-production-params", response_model=SuggestProductionParamsResponse)
async def suggest_production_params(
    body: SuggestProductionParamsRequest,
    user: User = Depends(require_oauth2_user),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> SuggestProductionParamsResponse:
    """
    Подсказка вокала, BPM, длительности и смежных полей для мастера «Основной» (без ручного «Генератор»).
    При сбое LLM или невалидном JSON — детерминированный fallback по жанру.
    """
    _maybe_save_music_generator_request_json("suggest-production-params", user_id=str(user.id), body=body)
    style_key = (body.style or "pop").strip().lower() or "pop"
    lyrics_ctx = (body.lyrics or "").strip()
    if len(lyrics_ctx) > 4000:
        lyrics_ctx = lyrics_ctx[:4000] + "\n[...]"
    llama_opts = _llama_options_for_lyrics_pipeline(body.temperature, body.cfg_scale, body.top_p)
    system_prompt = (
        "You are a music production assistant. Response is one JSON object (stack2 enforces JSON syntax). "
        "Keys: vocal (string, exactly one of: male, female, duet), bpm (integer 40-300), "
        "duration_seconds (integer 30-300), language (string, e.g. ru, en, or fr), "
        "timesignature (string, exactly one of: 3, 4, 6), "
        'keyscale (string: full English name like "A minor" or "F# major", NOT abbreviations like "Am" or "F#m"). '
        "Infer mood from lyrics; match energy to the genre preset. "
        "If lyrics contain enriched section headers ([Section: ... BPM feel, instruments/effects]), use them as strong guidance."
    )
    user_prompt = (
        f"Genre preset: {style_key}.\n\n"
        "Lyrics may include enriched section headers and (Voice: ...) parentheticals.\n\n"
    )
    companion_ctx = str(getattr(body, "ewa_companion_context", None) or "").strip()
    if companion_ctx:
        ru_suggest = bool(re.search(r"[\u0400-\u04ff]", companion_ctx))
        tone_hint = companion_music_tone_balance_block_from_context(companion_ctx, ru=ru_suggest)
        user_prompt += (
            "--- EWA companion thematic context (align BPM, energy, vocal feel — do not ignore) ---\n"
            f"{companion_ctx[:MAX_EWA_COMPANION_CONTEXT_CHARS]}\n\n"
        )
        if tone_hint:
            user_prompt += (
                "Production hint: source rejects pure grief — prefer BPM 95-120, modern pop energy, "
                "brighter chorus; avoid funeral ballad / whisper-only / solo piano defaults.\n\n"
            )
    user_prompt += f"Lyrics (mood and energy only):\n{lyrics_ctx}\n"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    try:
        resp = await run_studio_ugs_generate(
            ugs,
            user_id=str(user.id),
            type_key="music_generator_suggest_params",
            input_data={"messages": messages, "options": llama_opts, "json_format": True},
        )
        text = _plain_text_from_ugs_llm_result(resp).strip()
        parsed = _parse_json_object_from_llm(text)
        if parsed:
            out = _parse_suggest_production_response(parsed, style_key)
            inferred_vocal = infer_lyrics_first_person_gender(lyrics_ctx, language=str(parsed.get("language") or ""))
            if inferred_vocal in ("male", "female") and out.vocal != inferred_vocal:
                out = out.model_copy(update={"vocal": inferred_vocal})
            return out
    except Exception as e:
        logger.warning("suggest_production_params: failed, using fallback: %s", e)
    out = _fallback_suggest_production_params(style_key)
    inferred_vocal = infer_lyrics_first_person_gender(lyrics_ctx, language="ru")
    if inferred_vocal in ("male", "female") and out.vocal != inferred_vocal:
        out = out.model_copy(update={"vocal": inferred_vocal})
    return out


@router.post("/validate-lyrics")
async def validate_lyrics_endpoint(
    body: dict,
    user: User = Depends(require_oauth2_user),
) -> dict:
    """
    Проверка текста перед генерацией: пустые секции, подозрительные строки, длинные ().
    Тот же алгоритм, что и перед POST /generate (если не skip_lyrics_validation).
    """
    _maybe_save_music_generator_request_json("validate-lyrics", user_id=str(user.id), body=body)
    _ = user
    lyrics = (body.get("lyrics") or "").strip()
    if not lyrics:
        raise HTTPException(status_code=400, detail="lyrics is required")
    if len(lyrics) > MAX_LYRICS_LENGTH:
        lyrics = lyrics[:MAX_LYRICS_LENGTH]
    return validate_lyrics_for_music(lyrics)


@router.post("/record-like-recipe", status_code=204)
async def record_like_recipe(
    body: RecordLikeRecipeRequest,
    user: User = Depends(require_oauth2_user),
    content_service: ContentStorageService = Depends(get_content_service),
) -> Response:
    """
    Внутренний учёт: сохранить снимок метаданных лайкнутого трека (если задан MUSIC_GENERATOR_LIKED_RECIPES_DIR).
    Клиент после успешного ответа уже выполнил перенос в папку «Музыка» и избранное плеера.
    """
    uid = str(user.id)
    try:
        content = await content_service.get_content(body.content_id, uid, check_permissions=True)
    except ValueError:
        raise HTTPException(status_code=404, detail="content not found") from None
    except PermissionError:
        raise HTTPException(status_code=403, detail="access denied") from None
    if str(content.user_id) != uid:
        raise HTTPException(status_code=403, detail="only owner can record like recipe")
    if not content_eligible_for_liked_recipe(content):
        raise HTTPException(
            status_code=400,
            detail="content is not an eligible music generator audio item",
        )
    payload = build_liked_recipe_payload(user_id=uid, content=content)
    _maybe_save_liked_recipe_json(user_id=uid, content_id=body.content_id, payload=payload)
    return Response(status_code=204)


@router.post("/record-dislike-feedback", status_code=204)
async def record_dislike_feedback(
    body: RecordDislikeFeedbackRequest,
    user: User = Depends(require_oauth2_user),
    content_service: ContentStorageService = Depends(get_content_service),
    db: AsyncSession = Depends(get_postgres_session),
) -> Response:
    """
    Сохранить дизлайк: причина + снимок metadata рецепта. Вызывать **до** DELETE контента
    (после успеха клиент удаляет трек, как и раньше).
    """
    uid = str(user.id)
    try:
        custom_norm = validate_dislike_reason(
            code=body.reason_code,
            custom=body.reason_custom,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    try:
        content = await content_service.get_content(body.content_id, uid, check_permissions=True)
    except ValueError:
        raise HTTPException(status_code=404, detail="content not found") from None
    except PermissionError:
        raise HTTPException(status_code=403, detail="access denied") from None
    if str(content.user_id) != uid:
        raise HTTPException(status_code=403, detail="only owner can record dislike")
    if not content_eligible_for_dislike_feedback(content):
        raise HTTPException(
            status_code=400,
            detail="content is not an eligible music generator audio item",
        )
    snap = build_dislike_recipe_snapshot(user_id=uid, content=content)
    rcode = body.reason_code.strip().lower()
    await db.execute(
        text(
            """
            INSERT INTO music_generator_dislike_feedback
            (user_id, content_id, name, reason_code, reason_custom, recipe_snapshot)
            VALUES
            (CAST(:user_id AS uuid), CAST(:content_id AS uuid), :name, :reason_code, :reason_custom, CAST(:recipe_snapshot AS jsonb))
            ON CONFLICT (user_id, content_id) DO UPDATE SET
                name = EXCLUDED.name,
                reason_code = EXCLUDED.reason_code,
                reason_custom = EXCLUDED.reason_custom,
                recipe_snapshot = EXCLUDED.recipe_snapshot
            """
        ),
        {
            "user_id": uid,
            "content_id": str(body.content_id),
            "name": (content.name or "")[:500] if content.name else None,
            "reason_code": rcode,
            "reason_custom": custom_norm,
            "recipe_snapshot": json.dumps(snap, ensure_ascii=False, default=str),
        },
    )
    await db.commit()
    return Response(status_code=204)


# Пресеты короткой промо-озвучки (не песня): сценарий + теги для ACE.
_PROMO_PRESET_NARRATION_HINT_RU: dict[str, str] = {
    "pirate_radio": (
        "Пиратская/«налётчик» радиостанция: хрипловатый диктор, уверенно и с иронией; "
        "лёгкий шум эфира, короткие сигналы, как промо пиратской волны — без длинного пения."
    ),
    "trailer_epic": (
        "Кино-трейлер: густой 'голос за кадром', паузы на удар, нарастание, финальный акцент; "
        "короткие фразы, драматургия, без рекламного писка."
    ),
    "tv_clean": (
        "Нейтральный диктор ТВ/радио: чёткая дикция, спокойный темп, доверие; "
        "лёгкий ненавязчивый музыкальный плед под голос."
    ),
    "late_night": (
        "Ночной эфир / talk: интимный, чуть срывающийся тембр, близко к микрофону, "
        "минималистичный джазовый или лоу-фи плед; не как дневная реклама."
    ),
    "tech_keynote": (
        "Презентация/запуск продукта: уверенно, чисто, 'Apple-style' без крика; "
        "сдержанные синты и щелчки, кульминация коротким 'one more thing' ощущением (без реальных брендов)."
    ),
    "playful_brand": (
        "Молодой бренд/соцсети: динамично, с юмором, без пафоса; лёгкий бит, яркие ударные акценты, к короткому ролику."
    ),
}


@router.post("/promo-script")
async def generate_promo_script(
    body: dict,
    user: User = Depends(require_oauth2_user),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> dict:
    """
    Сценарий короткой промо-озвучки (ролик/бампер): один вызов LLM → lyrics + tags для /generate
    со style=promo_voiceover.
    Body: mode=brief|raw, language, vocal, promo_preset, target_duration_sec (30–300),
    brief: theses (строка); raw: raw_text.
    """
    _maybe_save_music_generator_request_json("promo-script", user_id=str(user.id), body=body)
    mode = str(body.get("mode") or "brief").strip().lower()
    if mode not in ("brief", "raw"):
        raise HTTPException(status_code=400, detail="mode must be brief or raw")
    language = (body.get("language") or "ru").strip() or "ru"
    vocal_raw = (body.get("vocal") or "male").strip().lower()
    if vocal_raw not in ("male", "female", "duet"):
        vocal_raw = "male"
    preset_key = str(body.get("promo_preset") or "pirate_radio").strip().lower()
    if preset_key not in _PROMO_PRESET_NARRATION_HINT_RU:
        raise HTTPException(
            status_code=400,
            detail="promo_preset must be one of: " + ", ".join(sorted(_PROMO_PRESET_NARRATION_HINT_RU)),
        )
    t_sl, cfg_sl, tp_sl = _parse_optional_music_creative_sliders(body)
    llama_opts = _llama_options_for_lyrics_pipeline(t_sl, cfg_sl, tp_sl)
    creative_extra = _lyrics_creative_extra_block_ru(t_sl, cfg_sl, tp_sl)
    try:
        target_duration_sec = int(float(str(body.get("target_duration_sec") or body.get("duration_seconds") or 45)))
    except (TypeError, ValueError):  # fmt: skip
        target_duration_sec = 45
    target_duration_sec = max(30, min(300, target_duration_sec))

    preset_hint = _PROMO_PRESET_NARRATION_HINT_RU[preset_key]
    director_factors = normalize_promo_director_factors(preset_key, body)
    director_prompt = promo_director_prompt_block(director_factors)
    raw_text_for_preserve = ""
    if mode == "brief":
        theses = (body.get("theses") or body.get("theme") or "").strip()
        if not theses:
            raise HTTPException(status_code=400, detail="theses is required for mode=brief")
        if len(theses) > 4000:
            theses = theses[:4000] + "\n[...]"
        user_block = (
            f"Целевая длительность озвучки: около {target_duration_sec} секунд (подбери длину фраз и число реплик).\n"
            f"Ключевые тезисы/идеи:\n{theses}\n"
        )
    else:
        raw_text = (body.get("raw_text") or body.get("text") or "").strip()
        if len(raw_text) < 8:
            raise HTTPException(status_code=400, detail="raw_text is required (at least 8 characters) for mode=raw")
        if len(raw_text) > MAX_LYRICS_LENGTH:
            raw_text = raw_text[:MAX_LYRICS_LENGTH] + "\n[...]"
        raw_text_for_preserve = raw_text
        user_block = (
            f"Целевая длительность: около {target_duration_sec} секунд. Ниже сырой текст — "
            "разложи в структуру с репликами диктора, секциями и краткими подсказками под движок музыки. "
            "НЕ переписывай рекламные реплики: сохрани слова, порядок, паузы, CAPS и смысловые повторы. "
            "Можно только добавить section headers и English technical hints.\n\n"
            f"Сырой текст:\n{raw_text}\n"
        )

    target_words = max(24, min(260, int(round(target_duration_sec * 2.2))))
    # Формат lyrics как в эталонной студийной записи (см. ACE: секции + круглые скобки только для Arrangement/Voice, англ. в подсказках).
    system_prompt = (
        "You write a SHORT PROMO VOICEOVER script for ACE Step music generator (not a pop song, not rapping, not verse/chorus singing). "
        'Response is a JSON object with exactly two string keys: "lyrics" and "tags" (server enforces JSON syntax).\n\n'
        'CRITICAL for "lyrics" string (multiline, same spirit as a normal studio track):\n'
        "- Use ONLY these English section headers alone on a line: [Intro], [Verse], [Bridge], [Outro]. "
        "Do NOT use [Line], [Sting], [Drop], [Chorus], [Hook], [CTA], or song/verse/chorus pop structure. "
        "Do NOT put a colon on the same line as the section tag (WRONG: [Verse]: text). CORRECT: [Verse] on one line, spoken lines on following lines.\n"
        "- After a section header, you MAY add hint lines in parentheses, ONLY two kinds, ENGLISH TEXT ONLY (Latin), never Russian/Cyrillic inside parentheses:\n"
        "  (Arrangement: 110 BPM feel, production words: pads, riser, static, pluck, sidechain, bed — English only. NO Russian.)\n"
        "  (Voice: e.g. male, close-mic, dry, playful — English only. NO Russian.)\n"
        "- Spoken ad copy: lines in the user language (e.g. Russian) only as plain lines OUTSIDE parentheses; "
        "not inside JSON, not a Python list. If you put Russian inside (Arrangement) or (Voice), the server replaces those lines with English.\n"
        "- For raw text mode: preserve the user's spoken copy. Do not rewrite it, do not make it rhyme, do not soften slang, "
        "do not replace aggressive direct lines with generic advertising filler.\n"
        f"- Keep spoken copy around {target_words} words total for the target duration. Use short announcer phrases, pauses, and one clear CTA. "
        "No long monologue and no repeated slogan more than twice.\n"
        "- Never embed a JSON object inside the lyrics string. Never output ['...','...'] list syntax.\n\n"
        'CRITICAL for "tags" string: ONE line, English ONLY (Latin), comma-separated, like a normal song: '
        "start with BPM and vocal role, then genre/bed, then LOWERCASE section markers [intro] [verse] [bridge] [outro] with short English production after each. "
        "No Russian, no nested quotes, no duplicate 'Style:' prefix. "
        "You may add extra English cues, but the server will merge with a preset anchor; still include your best mix description.\n\n"
        f"Script mood (Russian brief for you): {preset_hint}\n"
        f"Announcer language for spoken lines: {language}. "
        f"Target rough duration: ~{target_duration_sec} seconds — short sentences.\n"
        f"Voice in tags must match: {vocal_raw} (male|female|duet).\n" + director_prompt + creative_extra
    )
    user_prompt = f"Язык реплик: {language}.\nХарактер озвучки: {preset_hint}\n\n" + user_block
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    try:
        resp = await run_studio_ugs_generate(
            ugs,
            user_id=str(user.id),
            type_key="music_generator_promo_script",
            input_data={
                "messages": messages,
                "options": llama_opts,
                "json_format": True,
                "suppress_notification": True,
            },
        )
    except HTTPException:
        raise
    raw_out = _plain_text_from_ugs_llm_result(resp)
    parsed = _parse_json_object_from_llm(raw_out)
    lyrics = ""
    tags = ""
    if isinstance(parsed, dict):
        lyrics = str(parsed.get("lyrics") or "").strip()
        tags = str(parsed.get("tags") or "").strip()
    if not lyrics:
        p2 = _parse_json_object_from_llm(_strip_markdown_code_fences(raw_out))
        if isinstance(p2, dict) and (p2.get("lyrics") or "").strip():
            lyrics = str(p2.get("lyrics", "")).strip()
            if not tags:
                tags = str(p2.get("tags", "")).strip()
    if not lyrics:
        lyrics = sanitize_lyrics_ai_output(raw_out)
    bpm_ace = _bpm_speech_for_promo(target_duration_sec)
    if mode == "raw" and raw_text_for_preserve:
        lyrics = build_raw_promo_lyrics_preserving_copy(
            raw_text_for_preserve,
            preset=preset_key,
            vocal=vocal_raw,
            bpm=bpm_ace,
        )
    lyrics = normalize_promo_voiceover_lyrics(lyrics, preset=preset_key, vocal=vocal_raw, bpm=bpm_ace)
    recommendation = recommend_promo_duration_and_bpm(lyrics, preset=preset_key, factors=director_factors)
    bpm_ace = int(recommendation["recommended_bpm"])
    lyrics = align_promo_arrangement_bpm(lyrics, bpm_ace)
    tags = build_concise_promo_ace_tags(
        preset=preset_key,
        vocal=vocal_raw,
        bpm=bpm_ace,
        factors=director_factors,
        extra_tags=tags,
        max_length=MAX_TAGS_LENGTH,
    )
    tags = strip_backticks_from_ace_tags(tags)[:MAX_TAGS_LENGTH]
    if not lyrics:
        raise HTTPException(status_code=502, detail="Llama returned empty promo script")
    return {
        "lyrics": lyrics,
        "tags": tags,
        "promo_preset": preset_key,
        "recommended_duration_sec": recommendation["recommended_duration_sec"],
        "recommended_bpm": recommendation["recommended_bpm"],
        "estimated_spoken_words": recommendation["estimated_spoken_words"],
        "estimated_words_per_sec": recommendation["estimated_words_per_sec"],
        "director": recommendation["factors"],
    }
