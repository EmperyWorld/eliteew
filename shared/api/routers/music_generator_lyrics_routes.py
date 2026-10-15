# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Music Generator child router: POST /lyrics and POST /improve-lyrics (UGS Llama text).
# Invariants:
# - APIRouter has no extra prefix; parent mounts under prefix="/music-generator".
# - Must not import api.routers.music_generator (no cycle with the parent router).
# - Public paths stay /music-generator/lyrics and /music-generator/improve-lyrics.
# Related:
# - api/routers/music_generator.py (parent mount + re-export)
# - api/routers/music_generator_lyrics_style.py
# - api/routers/music_generator_lyrics_prompts.py
# - api/routers/music_generator_constants.py
# - documentation/product/MUSIC-GENERATOR-REFERENCE.md
# - documentation/platform/ATOMIC-ROUTER-DECOMPOSITION-CANON.md
# ---
"""Lyrics/improve-lyrics routes extracted from music_generator.py (Phase C.4 wave 5)."""

from __future__ import annotations

import logging
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.companion.orchestration.companion_music_creative_context import (
    companion_context_has_deictic_source_material,
    companion_music_deictic_lyrics_priority_block,
    companion_music_tone_balance_block_from_context,
)
from api.ewa_platform.companion.orchestration.companion_music_lyrics_craft import (
    COMPANION_LYRICS_MARKUP_SIMPLE_RU,
    COMPANION_LYRICS_SECTION_LINES_RU,
    COMPANION_LYRICS_SINGABILITY_RU,
    COMPANION_LYRICS_USER_FOOTER_RU,
    companion_lyrics_errors_retryable,
    companion_lyrics_retry_user_message,
    validate_companion_russian_singability,
)
from api.routers.creative_studio_utils import run_studio_ugs_generate
from api.routers.music_generator_constants import (
    MAX_EWA_COMPANION_CONTEXT_CHARS,
    MAX_LYRICS_LENGTH,
    MAX_WIZARD_THEME_CHARS,
)
from api.routers.music_generator_generate_support import (
    maybe_save_music_generator_request_json,
)
from api.routers.music_generator_lyrics_style import (
    IMPROVE_DIRECTIONS,
    LYRICS_ABSOLUTE_TABOO_WORDS_RU,
    LYRICS_IMPROVE_FIX_GIBBERISH_RU,
    LYRICS_IMPROVE_NO_PRODUCTION_SECTIONS_RU,
    LYRICS_MARKUP_EDM_IF_THEME_EXPLICIT_RU,
    LYRICS_MARKUP_RULES_BASE_RU,
    LYRICS_MARKUP_RULES_FOR_MODEL_RU,
    LYRICS_MORPHOLOGY_AND_STRESS_RU,
    LYRICS_NO_CLICHE_PHRASES_RU,
    LYRICS_NO_META_ABOUT_WRITING_RU,
    LYRICS_NO_META_MUSIC_DESCRIPTION_RU,
    LYRICS_OUTPUT_FORMAT_FOOTER_RU,
    LYRICS_QUALITY_NO_GIBBERISH_RU,
    LYRICS_SONG_VOICE_NOT_SCENE_RU,
    LYRICS_SONGCRAFT_MEANING_RU,
    LYRICS_THEME_PRIORITY_UNIVERSAL_RU,
    _ensure_enriched_auto_lyrics_sections,
    _get_form_specific_instructions,
    _llama_options_for_lyrics_pipeline,
    _lyrics_creative_extra_block_ru,
    _lyrics_improve_preserve_language_line,
    _lyrics_language_instruction,
    _lyrics_skip_auto_enrich,
    _lyrics_style_block_ru,
    _lyrics_vocal_grammar_for_language,
    _normalize_luna_mode,
    _normalize_voice_variation_level,
    _parse_optional_music_creative_sliders,
    _postprocess_llm_lyrics_content,
    _voice_diversity_prompt_ru,
)
from api.routers.music_lyrics_validation import (
    enforce_lyrics_vocal_gender_consistency,
    sanitize_lyrics_ai_output,
    scrub_forbidden_meta_music_words,
)
from api.routers.ugs import get_ugs_service
from api.services.music_generator_xl_base_pipeline import (
    XL_BASE_MIN_SUNG_LINES,
    assess_xl_base_lyrics_pipeline,
    xl_base_lyrics_retry_user_message,
)
from api.services.music_song_mood import (
    resolve_song_mood,
    song_mood_prompt_blocks,
    song_mood_public_dict,
)
from api.services.ugs.unified_generation_service import UnifiedGenerationService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Music Generator"])

_maybe_save_music_generator_request_json = maybe_save_music_generator_request_json


def _text_from_ugs_result(ugs_result: dict[str, Any]) -> str:
    block = ugs_result.get("result") or {}
    if isinstance(block, dict):
        if isinstance(block.get("result"), dict):
            inner = block["result"]
            return str(inner.get("text") or inner.get("content") or inner.get("response") or "").strip()
        return str(block.get("text") or block.get("content") or block.get("response") or "").strip()
    return ""


def _plain_text_from_ugs_llm_result(ugs_result: dict[str, Any]) -> str:
    """Strip Gemma ``<|channel|>`` / CoT wrappers from stack2 text completions (lyrics)."""
    from api.utils.llm_json_extract import strip_llm_thinking_prefix

    return strip_llm_thinking_prefix(_text_from_ugs_result(ugs_result))


@router.post("/lyrics")
async def generate_lyrics(
    body: dict,
    user: User = Depends(require_oauth2_user),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> dict:
    """
    Generate song lyrics using Llama via UGS. Body: theme (required), style?, language?, vocal? (male|female|duet).
    """
    _maybe_save_music_generator_request_json("lyrics", user_id=str(user.id), body=body)
    theme = (body.get("theme") or "").strip()
    if not theme:
        raise HTTPException(status_code=400, detail="theme is required")
    if len(theme) > MAX_WIZARD_THEME_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"theme must be at most {MAX_WIZARD_THEME_CHARS} characters",
        )
    style = (body.get("style") or "").strip() or "pop"
    language = (body.get("language") or "").strip() or "ru"
    voice_variation = _normalize_voice_variation_level(body.get("voice_diversity"))
    luna_mode = _normalize_luna_mode(body.get("luna_mode"))
    vocal_raw = (body.get("vocal") or "").strip().lower()
    vocal_instruction = ""
    if vocal_raw == "female":
        vocal_instruction = (
            "\n\nГолос исполнителя: ЖЕНСКИЙ (обязательно, не игнорировать). "
            "Лирическая героиня — везде женские формы от «я»: устала, рада, готова, была, ушла; не «я устал», не «я рад»."
        )
    elif vocal_raw == "male":
        vocal_instruction = (
            "\n\nГолос исполнителя: МУЖСКОЙ (обязательно, не игнорировать). "
            "Лирический герой — везде мужские формы от «я»: устал, рад, готов, был, ушёл; не «я устала», не «я рада»."
        )
    elif vocal_raw == "duet":
        vocal_instruction = (
            "\n\nГолос исполнителя: ДУЭТ — два голоса (мужской и женский). "
            "Согласуй формы «я»/обращения по смыслу строк; можно чередовать перспективы, избегая смешения рода в одной реплике."
        )
    t_sl, cfg_sl, tp_sl = _parse_optional_music_creative_sliders(body)
    creative_extra = _lyrics_creative_extra_block_ru(t_sl, cfg_sl, tp_sl)
    llama_opts = _llama_options_for_lyrics_pipeline(t_sl, cfg_sl, tp_sl)
    target_wf = (body.get("target_ugs_workflow") or body.get("ace_workflow") or "").strip().lower()
    if target_wf not in ("", "v2", "v2_base", "v2_sft"):
        target_wf = ""
    is_xl_base_sft = target_wf in ("v2_base", "v2_sft")
    is_xl_base = target_wf == "v2_base"
    style_block = _lyrics_style_block_ru(style, vocal=vocal_raw, luna_mode=luna_mode)
    form_instructions = _get_form_specific_instructions(theme)
    lang_low = (language or "ru").strip().lower()
    companion_ctx = str(body.get("ewa_companion_context") or "").strip()
    companion_vocal_mode = bool(companion_ctx)
    ru_lyrics_early = lang_low.startswith("ru") or bool(re.search(r"[\u0400-\u04ff]", theme))
    markup_block = (
        COMPANION_LYRICS_MARKUP_SIMPLE_RU
        if companion_vocal_mode and ru_lyrics_early
        else LYRICS_MARKUP_RULES_BASE_RU + "\n\n" + LYRICS_MARKUP_EDM_IF_THEME_EXPLICIT_RU
    )
    lang_block = _lyrics_language_instruction(language)
    random_mood_raw = body.get("random_song_mood")
    randomize_mood = (
        True
        if random_mood_raw is None
        else (
            random_mood_raw
            if isinstance(random_mood_raw, bool)
            else str(random_mood_raw).strip().lower() not in ("0", "false", "no", "off")
        )
    )
    mood_seed_parts = [str(user.id), theme, style]
    run_id = str(body.get("run_id") or body.get("generation_run_id") or "").strip()
    if run_id:
        mood_seed_parts.insert(0, run_id)
    song_mood_pick = resolve_song_mood(
        theme=theme,
        explicit_mood=body.get("song_mood") or body.get("mood"),
        randomize=randomize_mood,
        seed=":".join(mood_seed_parts),
        companion_context=companion_ctx or None,
    )
    mood_system_block, mood_user_block = song_mood_prompt_blocks(song_mood_pick, language=language)
    vocal_grammar_block = ""
    if vocal_raw in ("male", "female"):
        vocal_grammar_block = _lyrics_vocal_grammar_for_language(lang_low)
    elif vocal_raw == "duet":
        vocal_grammar_block = "\n\nДля дуэта: ясно различай два голоса по смыслу строк; при необходимости помечай смену куплетов секциями [Verse], [Verse 2], [Chorus]."

    section_lines = (
        COMPANION_LYRICS_SECTION_LINES_RU
        if companion_vocal_mode and ru_lyrics_early
        else (
            "\n\nФормат секций обязателен: [Section: music hints]. "
            "Внутри [ ] имя секции только на английском, после двоеточия — краткие музыкальные подсказки на английском. "
            "Каждая секция должна содержать BPM/BPM feel и минимум один инструмент/эффект/переход (например drums, bass, pads, riser, reverb, transition). "
            "Допускаются [Build Up]/[Drop]/[Breakdown] по смыслу темы и жанра. "
            "После секции можно ставить короткую строку (Voice: ...), но основа — текст песни. "
            + _voice_diversity_prompt_ru(voice_variation)
        )
    )
    default_structure = (
        "\n\nБазовая структура, если тема не требует другого: "
        "[Intro] → [Verse 1] → [Pre-Chorus] → [Chorus] → [Verse 2] → [Bridge] → [Chorus]. "
        "Припев должен появляться минимум два раза; каждую секцию заполни строками для пения, не оставляй пустых блоков."
    )

    system_prompt = (
        "Ты автор песен. Выведи только текст песни, без пояснений до или после текста."
        + LYRICS_THEME_PRIORITY_UNIVERSAL_RU
        + form_instructions
        + "\n\n"
        + markup_block
        + default_structure
        + section_lines
        + "\n\n--- Стиль и жанр текста (пресет студии; вторичен относительно темы) ---\n"
        + style_block
        + "\n\n--- Язык и оформление ---\n"
        + lang_block
        + LYRICS_OUTPUT_FORMAT_FOOTER_RU
        + LYRICS_QUALITY_NO_GIBBERISH_RU
        + LYRICS_SONG_VOICE_NOT_SCENE_RU
        + LYRICS_NO_META_MUSIC_DESCRIPTION_RU
        + LYRICS_SONGCRAFT_MEANING_RU
        + LYRICS_MORPHOLOGY_AND_STRESS_RU
        + (COMPANION_LYRICS_SINGABILITY_RU if companion_vocal_mode and ru_lyrics_early else "")
        + LYRICS_NO_CLICHE_PHRASES_RU
        + LYRICS_ABSOLUTE_TABOO_WORDS_RU
        + LYRICS_NO_META_ABOUT_WRITING_RU
        + "\n\nТОН: избегай нытья и жалоб ради жалоб; даже в грустных темах герой действует, решает, шутит или принимает исход. "
        "Не превращай куплеты в бесконечное самосожаление."
        + mood_system_block
        + (
            "\n\nРЕЖИМ XL Base (ACE Step 1.5): выведи ТОЛЬКО текст песни — без рассуждений, "
            "без списков «No …», без английских пометок планирования, без «Let's …», "
            "без «Self-Correction». Первая строка ответа — [Intro] или [Verse 1]. "
            "Короткие (Voice: …) и (Arrangement: …) допускаются; planning на английском запрещён."
            + (
                f" Между секциями обязательны строки для пения на языке песни (≥{XL_BASE_MIN_SUNG_LINES} строк всего); "
                "ответ только из (Voice/Arrangement) без куплетов недопустим."
                if is_xl_base
                else ""
            )
            if is_xl_base_sft
            else ""
        )
        + vocal_grammar_block
        + creative_extra
    )
    ru_lyrics = lang_low.startswith("ru") or bool(re.search(r"[\u0400-\u04ff]", theme))
    deictic_source = companion_context_has_deictic_source_material(companion_ctx)
    tone_balance_block = companion_music_tone_balance_block_from_context(companion_ctx, ru=ru_lyrics)
    if deictic_source:
        theme_line = (
            f"Тема-заголовок (кратко; PRIMARY — исходный материал в контексте ниже): {theme}\n"
            if ru_lyrics
            else f"Headline theme (short; PRIMARY — source material in context below): {theme}\n"
        )
        style_preset_line = (
            f"Пресет стиля в студии (вторично): {style}\n"
            if ru_lyrics
            else f"Studio style preset (secondary): {style}\n"
        )
        lang_line = f"Язык: {language}" if ru_lyrics else f"Language: {language}"
        user_prompt = (
            f"{companion_music_deictic_lyrics_priority_block(ru=ru_lyrics)}\n\n"
            f"{tone_balance_block}"
            f"{theme_line}"
            f"{style_preset_line}"
            f"{lang_line}"
            f"{vocal_instruction}\n\n"
            f"{mood_user_block}\n\n"
        )
    else:
        user_prompt = (
            f"Тема песни (главное — жанр, форма, о чём писать): {theme}\n"
            f"Пресет стиля в студии (вторично): {style}\n"
            f"Язык: {language}"
            f"{vocal_instruction}\n\n"
            f"{mood_user_block}\n\n"
        )
    if companion_ctx:
        ctx_label = (
            "--- Контекст EWA companion (исходный материал — главный источник сюжета и фактов) ---\n"
            if deictic_source and ru_lyrics
            else (
                "--- EWA companion context (source material — primary story and facts) ---\n"
                if deictic_source
                else "--- Контекст EWA companion (диалог, настроение, persona; используй для образа песни) ---\n"
            )
        )
        user_prompt += f"{ctx_label}{companion_ctx[:MAX_EWA_COMPANION_CONTEXT_CHARS]}\n\n"
    user_prompt += (
        (
            COMPANION_LYRICS_USER_FOOTER_RU + "\n\n"
            if companion_vocal_mode and ru_lyrics
            else (
                "ВАЖНО: если тема указывает на конкретную форму (частушки, баллада, сонет, рэп-куплеты, народная песня и т.д.), "
                "сначала строго следуй этой форме и содержанию темы, затем при необходимости учитывай пресет стиля — без подмены жанра.\n\n"
                "Напиши полный текст с разметкой enriched-секций в []. Это должен быть текст песни (слова для пения/чтения), а не сценарий клипа. "
                "Для КАЖДОЙ секции укажи музыкальный контекст: BPM/BPM feel + инструменты/эффекты/переходы. "
            )
        )
        + "Не пиши песню про то, как ты пишешь песни, и не выдумывай слова ради рифмы — только сюжет и нормальная лексика по теме. "
        "Сделай в песне смысловой поворот: от первого куплета к финалу герой должен что-то понять, решить, потерять, выиграть или высмеять. "
        "Табу-лексика в тексте песни: любые формы слов «ритм», «звук», «такт», а также клише «ритмы сердца», «в такт», «в ритме ночи», «в ритме танца»."
        + (
            "\nДля пресета Luna выбрано: ЭКСПЕРИМЕНТ. Сохраняй интимный тон, но делай смелее контраст подачи между секциями."
            if style.strip().lower() == "luna" and luna_mode == "experimental"
            else ""
        )
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    async def _invoke_lyrics_llm(chat_messages: list[dict[str, str]]) -> str:
        try:
            resp = await run_studio_ugs_generate(
                ugs,
                user_id=str(user.id),
                type_key="music_generator_lyrics",
                input_data={"messages": chat_messages, "options": llama_opts},
            )
        except HTTPException:
            raise
        return _plain_text_from_ugs_llm_result(resp)

    skip_enrich = bool(body.get("skip_enriched_sections")) or (
        companion_vocal_mode and ru_lyrics_early and not is_xl_base
    )
    raw_content = await _invoke_lyrics_llm(messages)
    content = _postprocess_llm_lyrics_content(
        raw_content,
        style_key=style,
        language=language,
        vocal_raw=vocal_raw,
        voice_variation_level=voice_variation,
        luna_mode=luna_mode,
        is_xl_base_sft=is_xl_base_sft,
        skip_enriched_sections=skip_enrich or _lyrics_skip_auto_enrich(sanitize_lyrics_ai_output(raw_content)),
    )

    companion_retry_used = False
    companion_singability_errors: list[dict[str, Any]] = []
    if companion_vocal_mode and ru_lyrics_early and not is_xl_base:
        companion_singability_errors = validate_companion_russian_singability(content, language=language)
        if companion_singability_errors and companion_lyrics_errors_retryable(companion_singability_errors):
            logger.warning(
                "[STEP] companion_lyrics /lyrics attempt=1 singability codes=%s",
                [e.get("code") for e in companion_singability_errors],
            )
            retry_messages = [
                *messages,
                {"role": "assistant", "content": content},
                {"role": "user", "content": companion_lyrics_retry_user_message(companion_singability_errors)},
            ]
            raw_retry = await _invoke_lyrics_llm(retry_messages)
            companion_retry_used = True
            content = _postprocess_llm_lyrics_content(
                raw_retry,
                style_key=style,
                language=language,
                vocal_raw=vocal_raw,
                voice_variation_level=voice_variation,
                luna_mode=luna_mode,
                is_xl_base_sft=is_xl_base_sft,
                skip_enriched_sections=True,
            )
            companion_singability_errors = validate_companion_russian_singability(content, language=language)
            logger.info(
                "[STEP] companion_lyrics /lyrics attempt=2 retry_used=%s codes=%s",
                companion_retry_used,
                [e.get("code") for e in companion_singability_errors],
            )

    xl_base_retry_used = False
    xl_base_errors: list[dict] = []
    xl_base_valid: bool | None = None
    if is_xl_base:
        prepared, xl_base_errors, xl_base_valid = assess_xl_base_lyrics_pipeline(content, language=language)
        if not xl_base_valid:
            logger.warning(
                "[STEP] xl_base_lyrics /lyrics attempt=1 invalid codes=%s",
                [e.get("code") for e in xl_base_errors],
            )
            retry_messages = [
                *messages,
                {"role": "assistant", "content": content},
                {"role": "user", "content": xl_base_lyrics_retry_user_message(xl_base_errors)},
            ]
            raw_retry = await _invoke_lyrics_llm(retry_messages)
            xl_base_retry_used = True
            content = _postprocess_llm_lyrics_content(
                raw_retry,
                style_key=style,
                language=language,
                vocal_raw=vocal_raw,
                voice_variation_level=voice_variation,
                luna_mode=luna_mode,
                is_xl_base_sft=is_xl_base_sft,
                skip_enriched_sections=skip_enrich or _lyrics_skip_auto_enrich(sanitize_lyrics_ai_output(raw_retry)),
            )
            prepared, xl_base_errors, xl_base_valid = assess_xl_base_lyrics_pipeline(content, language=language)
            logger.info(
                "[STEP] xl_base_lyrics /lyrics attempt=2 valid=%s sung_check codes=%s",
                xl_base_valid,
                [e.get("code") for e in xl_base_errors],
            )
        if xl_base_valid:
            content = prepared

    if not content:
        raise HTTPException(status_code=502, detail="Llama returned empty lyrics")
    out: dict = {"lyrics": content, "song_mood": song_mood_public_dict(song_mood_pick)}
    if companion_vocal_mode and ru_lyrics_early and not is_xl_base:
        out["companion_singability_errors"] = companion_singability_errors
        out["companion_lyrics_retry_used"] = companion_retry_used
    if is_xl_base:
        out["xl_base_valid"] = bool(xl_base_valid)
        out["xl_base_errors"] = xl_base_errors
        out["xl_base_retry_used"] = xl_base_retry_used
    return out


@router.post("/improve-lyrics")
async def improve_lyrics(
    body: dict,
    user: User = Depends(require_oauth2_user),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> dict:
    """
    Improve existing song lyrics with Llama via UGS. Body: lyrics (required), direction (required).
    """
    _maybe_save_music_generator_request_json("improve-lyrics", user_id=str(user.id), body=body)
    lyrics = (body.get("lyrics") or "").strip()
    if not lyrics:
        raise HTTPException(status_code=400, detail="lyrics is required")
    if len(lyrics) > MAX_LYRICS_LENGTH:
        lyrics = lyrics[:MAX_LYRICS_LENGTH] + "\n[... обрезано]"
    direction = (body.get("direction") or "").strip()
    instruction = IMPROVE_DIRECTIONS.get(direction)
    if not instruction:
        raise HTTPException(
            status_code=400,
            detail=f"direction must be one of: {', '.join(IMPROVE_DIRECTIONS)}",
        )
    vocal_raw = (body.get("vocal") or "").strip().lower()
    voice_variation = _normalize_voice_variation_level(body.get("voice_diversity"))
    luna_mode = _normalize_luna_mode(body.get("luna_mode"))
    improve_style_key = (body.get("style") or "pop").strip().lower() or "pop"
    lang_raw = (body.get("language") or "ru").strip()
    vocal_instruction = ""
    if vocal_raw == "female":
        vocal_instruction = (
            "\n\nГолос исполнителя: ЖЕНСКИЙ. "
            "Исправляй строки так, чтобы от первого лица были женские формы; убирай мужские формы, если они встречаются."
        )
    elif vocal_raw == "male":
        vocal_instruction = (
            "\n\nГолос исполнителя: МУЖСКОЙ. "
            "Исправляй строки так, чтобы от первого лица были мужские формы; убирай женские формы, если они встречаются."
        )
    elif vocal_raw == "duet":
        vocal_instruction = (
            "\n\nГолос исполнителя: ДУЭТ. "
            "Сохраняй разделение голосов и не смешивай мужскую и женскую форму в одной реплике."
        )
    lang_low = lang_raw.lower()
    vocal_grammar_block = ""
    if vocal_raw in ("male", "female"):
        vocal_grammar_block = _lyrics_vocal_grammar_for_language(lang_low)
    elif vocal_raw == "duet":
        vocal_grammar_block = "\n\nДля дуэта: различай реплики голосов и не смешивай род в пределах одной строки."
    t_sl, cfg_sl, tp_sl = _parse_optional_music_creative_sliders(body)
    creative_extra = _lyrics_creative_extra_block_ru(t_sl, cfg_sl, tp_sl)
    llama_opts = _llama_options_for_lyrics_pipeline(t_sl, cfg_sl, tp_sl)

    system_prompt = (
        "Ты редактор текстов песен. Получаешь текст и задание по улучшению. "
        "Верни только итоговый текст песни, без комментариев снаружи.\n\n"
        + LYRICS_MARKUP_RULES_FOR_MODEL_RU
        + "\n\nСохраняй enriched-секции в []: [Section: music hints], отдельной строкой. "
        "Не переводи содержимое музыкальной части секции на другой язык. "
        "Круглые скобки () используй для короткого (Voice: ...) после секции, если это помогает подаче. "
        + _lyrics_improve_preserve_language_line(lang_low)
        + "\n"
        + LYRICS_OUTPUT_FORMAT_FOOTER_RU
        + LYRICS_IMPROVE_FIX_GIBBERISH_RU
        + LYRICS_SONG_VOICE_NOT_SCENE_RU
        + LYRICS_NO_META_MUSIC_DESCRIPTION_RU
        + LYRICS_SONGCRAFT_MEANING_RU
        + LYRICS_MORPHOLOGY_AND_STRESS_RU
        + LYRICS_NO_CLICHE_PHRASES_RU
        + LYRICS_ABSOLUTE_TABOO_WORDS_RU
        + LYRICS_NO_META_ABOUT_WRITING_RU
        + LYRICS_IMPROVE_NO_PRODUCTION_SECTIONS_RU
        + "\n\n"
        + _voice_diversity_prompt_ru(voice_variation)
        + (
            "\n\nРежим Luna: ЭКСПЕРИМЕНТ — сохрани интимный характер, но допускай более смелые "
            "тембровые и эмоциональные контрасты между секциями."
            if improve_style_key == "luna" and luna_mode == "experimental"
            else ""
        )
        + vocal_grammar_block
        + creative_extra
    )
    user_prompt = (
        f"{instruction}{vocal_instruction}\n\n"
        + (
            "Song lyrics:\n\n"
            if lang_low.startswith("en")
            else "Paroles :\n\n"
            if lang_low.startswith("fr")
            else "Текст песни:\n\n"
        )
        + lyrics
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    try:
        resp = await run_studio_ugs_generate(
            ugs,
            user_id=str(user.id),
            type_key="music_generator_improve_lyrics",
            input_data={"messages": messages, "options": llama_opts},
        )
    except HTTPException:
        raise
    content = sanitize_lyrics_ai_output(_plain_text_from_ugs_llm_result(resp))
    content = _ensure_enriched_auto_lyrics_sections(
        content,
        style_key=improve_style_key,
        vocal=(body.get("vocal") or "female").strip().lower() or "female",
        voice_variation_level=voice_variation,
        luna_mode=luna_mode,
    )
    if vocal_raw in ("male", "female"):
        content, _ = enforce_lyrics_vocal_gender_consistency(content, vocal=vocal_raw, language=lang_raw)
    content, _taboo_changed, _taboo_hits = scrub_forbidden_meta_music_words(content, language=lang_raw)
    if not content:
        raise HTTPException(status_code=502, detail="Llama returned empty lyrics")
    return {"lyrics": content}
