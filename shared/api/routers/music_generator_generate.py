# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Music Generator child router: POST /generate and POST /edit (UGS Comfy audio).
# Shared helpers live in music_generator_generate_support (no routes).
# Invariants:
# - APIRouter has no extra prefix; parent mounts under prefix="/music-generator".
# - Must not import api.routers.music_generator (no cycle with the parent router).
# - Must not be imported by music_generator_generate_support (no cycle).
# - Public paths stay /music-generator/generate and /music-generator/edit.
# Related:
# - api/routers/music_generator.py (parent mount + style/promo routes; lyrics child separate)
# - api/routers/music_generator_generate_support.py
# - api/routers/music_generator_lyrics_style.py
# - api/routers/music_generator_constants.py
# - documentation/product/MUSIC-GENERATOR-REFERENCE.md
# - documentation/platform/ATOMIC-ROUTER-DECOMPOSITION-CANON.md
# ---
"""Generate/edit routes extracted from music_generator.py (Phase C.4 wave 3+4)."""

from __future__ import annotations

import base64
import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.core.unified_config import get_unified_settings
from api.routers.creative_studio_utils import run_studio_ugs_generate
from api.routers.music_generator_chaotic import (
    CHAOTIC_TRANSITION_TEMPLATES,
    build_chaotic_bundle,
    resolve_chaotic_template_key,
)
from api.routers.music_generator_constants import MAX_LYRICS_LENGTH
from api.routers.music_generator_generate_support import (
    VALID_PROMO_VOICEOVER_PRESETS,
    MusicEditRequest,
    apply_promo_voiceover_tts_mix,
    build_music_generator_mg_metadata,
    datetime_now_str,
    decode_first_ugs_audio_bytes,
    maybe_save_liked_recipe_json,
    maybe_save_music_generator_request_json,
    persist_generated_music_content,
    resolve_music_generate_idempotency_key,
    resolve_style_english_line,
    resolve_track_bpm,
    run_music_generate_ugs,
    safe_mp3_original_filename,
    unwrap_audio_block,
)
from api.routers.music_generator_lyrics_style import (
    _generate_song_title,
    _normalize_luna_mode,
)
from api.routers.music_generator_tag_finalize import (
    MAX_TAGS_LENGTH,
    _finalize_ace_step_style_tags,
    align_first_bpm_in_tags_to_value,
    coerce_tags_to_genre_preset,
    ensure_intro_section_tag_if_lyrics_have_intro,
    ensure_luna_ace_section_tags,
    format_ace_tags_prose_to_sections,
    luna_append_signature_production,
    normalize_vocal_token_in_tags,
    simplify_tags_for_ace,
    soften_luna_ace_tags,
    strip_backticks_from_ace_tags,
)
from api.routers.music_lyrics_validation import (
    sanitize_lyrics_ai_output,
    sanitize_lyrics_for_xl_base_comfy,
    scrub_forbidden_meta_music_words,
    validate_lyrics_for_music,
)
from api.routers.ugs import get_ugs_service
from api.routers.unified_content import get_content_service
from api.schemas.music_generate_request import MusicGenerateRequest
from api.schemas.unified_content import ContentCreate, ContentType, Visibility
from api.services.music_generation_seed_policy import resolve_music_generation_seed
from api.services.music_generator_promo import (
    align_promo_arrangement_bpm,
    bpm_speech_for_promo,
    build_concise_promo_ace_tags,
    normalize_promo_director_factors,
    normalize_promo_voiceover_lyrics,
    recommend_promo_duration_and_bpm,
    validate_promo_voiceover_payload,
)
from api.services.music_generator_title_lang import fallback_auto_track_name
from api.services.music_generator_v4.soloists import (
    MUSIC_GENERATOR_V4_SOLOIST_PRESETS,
    apply_v4_luna_soloist_tags,
    coerce_v4_soloist_generate_params,
    normalize_v4_soloist_key,
)
from api.services.music_generator_xl_base_pipeline import (
    build_xl_base_input_observability,
    count_sung_content_lines,
    log_xl_base_gate_passed,
    prepare_xl_base_lyrics_for_comfy,
    stamp_xl_base_observability_on_input_data,
    validate_xl_base_lyrics_substance,
)
from api.services.music_promo_audio_mixer import (
    build_instrumental_promo_lyrics,
    extract_promo_spoken_text,
)
from api.services.studio_comfy_workflows import (
    WORKFLOW_PATH_M2M_EDIT,
    normalize_keyscale_for_ace_comfy,
)
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.services.unified_content.content_storage_service import ContentStorageService
from api.services.unified_content.storage_backends.minio_storage import SeaweedFileCorruptedError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Music Generator"])

# Re-exports for parent router + tests that patch generate-module paths.
_maybe_save_liked_recipe_json = maybe_save_liked_recipe_json
_maybe_save_music_generator_request_json = maybe_save_music_generator_request_json
_VALID_PROMO_VOICEOVER_PRESETS = VALID_PROMO_VOICEOVER_PRESETS
_resolve_track_bpm = resolve_track_bpm
_unwrap_audio_block = unwrap_audio_block
_safe_mp3_original_filename = safe_mp3_original_filename
_datetime_now_str = datetime_now_str


@router.post("/generate")
async def generate_music(
    body: MusicGenerateRequest,
    http_request: Request,
    user: User = Depends(require_oauth2_user),
    content_service: ContentStorageService = Depends(get_content_service),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> dict:
    """
    Генерация музыки через UGS. Тело: lyrics (обязательно), model? (ace_step|diffrhythm), tags?, ...
    """
    _maybe_save_music_generator_request_json("generate", user_id=str(user.id), body=body)
    engine = (body.model or body.engine or "ace_step").strip().lower()
    if engine not in ("ace_step", "diffrhythm"):
        engine = "ace_step"

    style_key_early = (body.style or "pop").strip().lower() or "pop"
    ugs_wf_early = (getattr(body, "ugs_workflow", None) or "").strip().lower()
    v4_soloist_key = normalize_v4_soloist_key(getattr(body, "v4_soloist", None))
    is_chaotic = style_key_early == "chaotic_transitions"
    is_promo_voiceover = style_key_early == "promo_voiceover"
    promo_recommended_bpm: int | None = None
    if is_chaotic or is_promo_voiceover:
        engine = "ace_step"

    chaotic_bundle: dict[str, Any] | None = None
    promo_spoken_text: str = ""
    promo_use_tts_mix: bool = False
    promo_director_factors_for_mix: dict[str, int] = {}
    promo_original_lyrics_for_meta: str = ""
    chaotic_resolved_template_key: str | None = None
    chaos_level_used: int | None = None
    if is_chaotic:
        template_key = resolve_chaotic_template_key(body.chaotic_transition_template)
        chaotic_resolved_template_key = template_key
        chaos_level = body.chaos_level if body.chaos_level is not None else 5
        chaos_level_used = chaos_level
        chaotic_bundle = build_chaotic_bundle(
            template_key=template_key,
            chaos_level=chaos_level,
            pace=body.transition_pace,
            add_glitch=body.chaotic_add_glitch,
            add_silence=body.chaotic_add_silence,
            add_scream=body.chaotic_add_scream,
            language=(body.language or "ru").strip() or "ru",
        )
        lyrics_raw = (body.lyrics or "").strip()
        lyrics = lyrics_raw if lyrics_raw else chaotic_bundle["lyrics"]
        if len(lyrics) > MAX_LYRICS_LENGTH:
            lyrics = lyrics[:MAX_LYRICS_LENGTH] + "\n[... truncated]"
        lyrics = sanitize_lyrics_ai_output(lyrics)
        lyrics, _taboo_changed, _taboo_hits = scrub_forbidden_meta_music_words(lyrics, language=(body.language or "ru"))
        if not lyrics.strip():
            lyrics = sanitize_lyrics_ai_output(chaotic_bundle["lyrics"])
            lyrics, _taboo_changed, _taboo_hits = scrub_forbidden_meta_music_words(
                lyrics, language=(body.language or "ru")
            )
        if not lyrics.strip():
            raise HTTPException(status_code=400, detail="lyrics is required")
        if not body.skip_lyrics_validation:
            validation = validate_lyrics_for_music(lyrics)
            if not validation["ok"]:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "lyrics_validation_failed",
                        "errors": validation["errors"],
                        "warnings": validation["warnings"],
                        "normalized_lyrics": validation["normalized_lyrics"],
                        "lyrics_were_normalized": validation["lyrics_were_normalized"],
                    },
                )
        tags = chaotic_bundle["tags"]
        extra_user_tags = strip_backticks_from_ace_tags((body.tags or "").strip())
        if extra_user_tags:
            tags = f"{tags} {extra_user_tags}".strip()
            if len(tags) > MAX_TAGS_LENGTH:
                tags = tags[:MAX_TAGS_LENGTH].rstrip(" ,")
        vocal = (body.vocal or "female").strip().lower()
        if vocal not in ("male", "female", "duet"):
            vocal = "female"
        tags_lower = tags.lower()
        if "male vocal" not in tags_lower and "female vocal" not in tags_lower and "duet vocal" not in tags_lower:
            suffix = " Duet vocal." if vocal == "duet" else f" {vocal.capitalize()} vocal."
            tags = tags.rstrip() + suffix
        if len(tags) > MAX_TAGS_LENGTH:
            tags = tags[:MAX_TAGS_LENGTH]
        tags = normalize_vocal_token_in_tags(tags, vocal)
        if len(tags) > MAX_TAGS_LENGTH:
            tags = tags[:MAX_TAGS_LENGTH]
        style_key = "chaotic_transitions"
        desc = CHAOTIC_TRANSITION_TEMPLATES[template_key].get("description", template_key)
        tags = f"Chaotic transition experiment ({desc}). {tags}"
        if len(tags) > MAX_TAGS_LENGTH:
            tags = tags[:MAX_TAGS_LENGTH]
        bpm = resolve_track_bpm(
            body,
            is_chaotic=True,
            chaotic_bundle=chaotic_bundle,
            is_promo_voiceover=False,
            promo_recommended_bpm=None,
        )
    else:
        lyrics = (body.lyrics or "").strip()
        if not lyrics:
            raise HTTPException(status_code=400, detail="lyrics is required")
        if len(lyrics) > MAX_LYRICS_LENGTH:
            lyrics = lyrics[:MAX_LYRICS_LENGTH] + "\n[... truncated]"
        lyrics = sanitize_lyrics_ai_output(lyrics)
        if ugs_wf_early == "v2_base":
            try:
                lyrics = prepare_xl_base_lyrics_for_comfy(
                    lyrics,
                    language=(body.language or "ru"),
                    strict=True,
                )
            except ValueError as exc:
                xl_errs = validate_xl_base_lyrics_substance(lyrics, language=(body.language or "ru"))
                sung_total, _ = count_sung_content_lines(lyrics, language=(body.language or "ru"))
                logger.warning(
                    "[STEP] xl_base_gate generate blocked sung_lines=%s codes=%s",
                    sung_total,
                    [e.get("code") for e in xl_errs],
                )
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "xl_base_lyrics_invalid",
                        "message": str(exc),
                        "errors": xl_errs or [{"code": "xl_base_lyrics_invalid", "message": str(exc)}],
                    },
                ) from exc
        elif ugs_wf_early in ("v2_sft", "v4", "v5"):
            lyrics = sanitize_lyrics_for_xl_base_comfy(lyrics)
        if style_key_early == "promo_voiceover":
            try:
                _dur = int(float(body.duration_seconds or 45))
            except (TypeError, ValueError):  # fmt: skip
                _dur = 45
            _bpm_guess2 = body.bpm
            if _bpm_guess2 is None:
                _bpm_s = bpm_speech_for_promo(_dur)
            else:
                try:
                    _bpm_s = int(float(_bpm_guess2))
                except (TypeError, ValueError):  # fmt: skip
                    _bpm_s = 110
            _bpm_s = max(10, min(300, _bpm_s))
            _pp2 = getattr(body, "promo_preset", None)
            _pp2 = str(_pp2 or "pirate_radio").strip().lower()
            if _pp2 not in VALID_PROMO_VOICEOVER_PRESETS:
                _pp2 = "pirate_radio"
            _vox2 = (body.vocal or "male").strip().lower()
            if _vox2 not in ("male", "female", "duet"):
                _vox2 = "male"
            lyrics = normalize_promo_voiceover_lyrics(lyrics, preset=_pp2, vocal=_vox2, bpm=_bpm_s)
        else:
            lyrics, _taboo_changed, _taboo_hits = scrub_forbidden_meta_music_words(
                lyrics, language=(body.language or "ru")
            )
        if not lyrics.strip():
            raise HTTPException(status_code=400, detail="lyrics is required")
        if not body.skip_lyrics_validation and not is_promo_voiceover:
            validation = validate_lyrics_for_music(lyrics)
            if not validation["ok"]:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "lyrics_validation_failed",
                        "errors": validation["errors"],
                        "warnings": validation["warnings"],
                        "normalized_lyrics": validation["normalized_lyrics"],
                        "lyrics_were_normalized": validation["lyrics_were_normalized"],
                    },
                )
        tags = strip_backticks_from_ace_tags((body.tags or "").strip())
        if len(tags) > MAX_TAGS_LENGTH:
            tags = tags[:MAX_TAGS_LENGTH]
        if not tags:
            if style_key_early == "promo_voiceover":
                tags = (
                    "110 BPM spoken word promo, light music bed, announcer diction, "
                    "subtle risers, clean mix, short reel pacing"
                )
            else:
                tags = "melodic pop: Track with vocals and modern production. Catchy and emotional."
        vocal = (body.vocal or "female").strip().lower()
        if vocal not in ("male", "female", "duet"):
            vocal = "female"
        tags_lower = tags.lower()
        if "male vocal" not in tags_lower and "female vocal" not in tags_lower and "duet vocal" not in tags_lower:
            suffix = " Duet vocal." if vocal == "duet" else f" {vocal.capitalize()} vocal."
            tags = tags.rstrip() + suffix
        if len(tags) > MAX_TAGS_LENGTH:
            tags = tags[:MAX_TAGS_LENGTH]
        style_key = (body.style or "pop").strip().lower() or "pop"
        luna_mode = _normalize_luna_mode(getattr(body, "luna_mode", None))
        if style_key == "promo_voiceover":
            _pp_tags = str(getattr(body, "promo_preset", None) or "pirate_radio").strip().lower()
            if _pp_tags not in VALID_PROMO_VOICEOVER_PRESETS:
                _pp_tags = "pirate_radio"
            _promo_factor_payload = {
                "promo_tempo_intensity": body.promo_tempo_intensity,
                "promo_rhythm_intensity": body.promo_rhythm_intensity,
                "promo_genre_bias": body.promo_genre_bias,
                "promo_voice_strength": body.promo_voice_strength,
                "promo_bed_level": body.promo_bed_level,
                "promo_stinger_intensity": body.promo_stinger_intensity,
                "promo_drama_contrast": body.promo_drama_contrast,
                "promo_clarity": body.promo_clarity,
            }
            _promo_director = normalize_promo_director_factors(_pp_tags, _promo_factor_payload)
            _promo_recommendation = recommend_promo_duration_and_bpm(
                lyrics,
                preset=_pp_tags,
                factors=_promo_director,
            )
            try:
                _promo_bpm_for_tags = int(_promo_recommendation["recommended_bpm"])
            except (TypeError, ValueError, KeyError):  # fmt: skip
                _promo_bpm_for_tags = bpm_speech_for_promo(body.duration_seconds or 45)
            promo_recommended_bpm = _promo_bpm_for_tags
            lyrics = align_promo_arrangement_bpm(lyrics, _promo_bpm_for_tags)
            tags = build_concise_promo_ace_tags(
                preset=_pp_tags,
                vocal=vocal,
                bpm=_promo_bpm_for_tags,
                factors=_promo_director,
                extra_tags=tags,
                max_length=MAX_TAGS_LENGTH,
            )
            tags = ensure_intro_section_tag_if_lyrics_have_intro(tags, lyrics)
            tags = simplify_tags_for_ace(tags)
            tags = format_ace_tags_prose_to_sections(tags)
            tags = simplify_tags_for_ace(tags)
            if len(tags) > MAX_TAGS_LENGTH:
                tags = tags[:MAX_TAGS_LENGTH]
            promo_style_line = (
                "Spoken word promo / voiceover (short reel or radio spot), not a sung pop song. "
                "Minimal music bed, clear announcer diction, subtle stingers; avoid long melodic hooks."
            )
            tags = f"Style: {promo_style_line} {tags}"
            if len(tags) > MAX_TAGS_LENGTH:
                tags = tags[:MAX_TAGS_LENGTH]
            if not body.skip_lyrics_validation:
                validation = validate_promo_voiceover_payload(lyrics, tags)
                if not validation["ok"]:
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "code": "promo_validation_failed",
                            "errors": validation["errors"],
                            "warnings": validation["warnings"],
                            "normalized_lyrics": validation["normalized_lyrics"],
                            "lyrics_were_normalized": validation["lyrics_were_normalized"],
                        },
                    )
            # Promo speech goes through Silero TTS, NOT through ACE Step. ACE is a
            # music model: feeding it Russian copy makes it half-sing the lines,
            # which is the root cause of the "voice/diction not great" feedback.
            # We stash the cleaned spoken text for the post-render mix and
            # replace lyrics with an English instrumental brief so ACE renders
            # only the music bed.
            promo_original_lyrics_for_meta = lyrics
            promo_spoken_text = extract_promo_spoken_text(lyrics)
            _promo_render = getattr(body, "promo_vocal_render", None)
            if _promo_render not in ("tts_mix", "ace_model"):
                _promo_render = "tts_mix"
            promo_use_tts_mix = bool(promo_spoken_text) and _promo_render == "tts_mix"
            promo_director_factors_for_mix = dict(_promo_director or {})
            if promo_use_tts_mix:
                lyrics = build_instrumental_promo_lyrics(
                    preset=_pp_tags,
                    bpm=_promo_bpm_for_tags,
                )
            bpm = resolve_track_bpm(
                body,
                is_chaotic=False,
                chaotic_bundle=None,
                is_promo_voiceover=True,
                promo_recommended_bpm=promo_recommended_bpm,
            )
        else:
            bpm = resolve_track_bpm(
                body,
                is_chaotic=False,
                chaotic_bundle=None,
                is_promo_voiceover=False,
                promo_recommended_bpm=None,
            )
            tags = coerce_tags_to_genre_preset(tags, style_key)
            tags = ensure_intro_section_tag_if_lyrics_have_intro(tags, lyrics)
            tags = _finalize_ace_step_style_tags(
                tags,
                genre=style_key,
                ace_workflow=(getattr(body, "ugs_workflow", None) or "").strip().lower() or None,
            )
            tags = simplify_tags_for_ace(tags)
            if style_key == "luna":
                tags = soften_luna_ace_tags(tags)
                if "russian indie" not in tags.lower() and "luna" not in tags.lower():
                    prefix = (
                        f"{bpm} BPM Russian dream / indie electro-pop (Luna style, classic)"
                        if luna_mode == "classic"
                        else f"{bpm} BPM Russian dream / indie electro-pop (Luna style, experimental)"
                    )
                    tags = f"{prefix}, {tags}"
                if len(tags) > MAX_TAGS_LENGTH:
                    tags = tags[:MAX_TAGS_LENGTH]
            tags = format_ace_tags_prose_to_sections(tags)
            if style_key == "luna":
                tags = ensure_luna_ace_section_tags(tags)
                tags = luna_append_signature_production(tags)
                if len(tags) > MAX_TAGS_LENGTH:
                    tags = tags[:MAX_TAGS_LENGTH]
            tags = simplify_tags_for_ace(tags)
            if len(tags) > MAX_TAGS_LENGTH:
                tags = tags[:MAX_TAGS_LENGTH]
            tags = normalize_vocal_token_in_tags(tags, vocal)
            if len(tags) > MAX_TAGS_LENGTH:
                tags = tags[:MAX_TAGS_LENGTH]
        if style_key != "promo_voiceover":
            style_english = resolve_style_english_line(
                style_key,
                vocal=vocal,
                luna_mode=luna_mode,
                bpm=bpm,
            )
            tags = f"Style: {style_english}. {tags}"
            if len(tags) > MAX_TAGS_LENGTH:
                tags = tags[:MAX_TAGS_LENGTH]

    duration_seconds = body.duration_seconds or 120
    duration_seconds = max(30, min(300, duration_seconds))
    language = (body.language or "ru").strip() or "ru"
    keyscale = normalize_keyscale_for_ace_comfy((body.keyscale or "C major").strip() or "C major")
    if engine == "ace_step" and ugs_wf_early == "v4" and v4_soloist_key == "luna":
        vocal, style_key, language, bpm, keyscale = coerce_v4_soloist_generate_params(
            v4_soloist_key,
            vocal=vocal,
            style=style_key,
            language=language,
            bpm=bpm,
            keyscale=keyscale,
        )
        tags, _ = align_first_bpm_in_tags_to_value(tags, bpm)
        tags = apply_v4_luna_soloist_tags(tags, v4_soloist_key)
        tags = normalize_vocal_token_in_tags(tags, vocal)
        if len(tags) > MAX_TAGS_LENGTH:
            tags = tags[:MAX_TAGS_LENGTH]
    timesignature = str(body.timesignature or "4").strip()
    if timesignature not in ("2", "3", "4", "6"):
        timesignature = "4"
    temperature = body.temperature
    if temperature is not None:
        try:
            temperature = float(temperature)
            temperature = max(0.0, min(2.0, temperature))
        except (TypeError, ValueError):  # fmt: skip
            temperature = 0.85
    elif is_chaotic and chaotic_bundle is not None:
        temperature = float(chaotic_bundle["temperature"])
    else:
        temperature = 0.85
    cfg_scale = body.cfg_scale
    if cfg_scale is not None:
        try:
            cfg_scale = float(cfg_scale)
            cfg_scale = max(0.0, min(100.0, cfg_scale))
        except (TypeError, ValueError):  # fmt: skip
            cfg_scale = 2.0
    elif is_chaotic and chaotic_bundle is not None:
        cfg_scale = float(chaotic_bundle["cfg_scale"])
    else:
        cfg_scale = 2.0
    top_p = body.top_p
    if top_p is not None:
        try:
            top_p = float(top_p)
            top_p = max(0.0, min(1.0, top_p))
        except (TypeError, ValueError):  # fmt: skip
            top_p = 0.9
    else:
        top_p = 0.9
    requested_seed = body.seed
    seed, used_requested_seed, seed_was_clamped = resolve_music_generation_seed(requested_seed)
    if used_requested_seed:
        if seed_was_clamped:
            logger.info(
                "music_generator: requested seed clamped into safe range (requested=%s, applied=%s)",
                requested_seed,
                seed,
            )
        else:
            logger.info("music_generator: using requested seed=%s", seed)

    settings = get_unified_settings()
    if body.generate_title:
        try:
            name = await _generate_song_title(lyrics, settings, language)
        except HTTPException:
            name = ""
        if not name:
            name = fallback_auto_track_name(language)
    else:
        name = (body.name or "").strip()
        if not name:
            name = fallback_auto_track_name(language)
    name = (name or fallback_auto_track_name(language))[:200]

    if engine == "diffrhythm":
        if is_chaotic and chaotic_bundle is not None and body.steps is None:
            diff_steps = int(chaotic_bundle["steps"])
        else:
            diff_steps = body.steps or 50
    elif engine == "ace_step" and getattr(body, "ugs_workflow", None) in ("v4", "v5"):
        diff_steps = body.steps or 50
    else:
        # ACE Step Turbo/Base/SFT: KSampler на Comfy фиксирован (8) — body.steps на семплер не влияет.
        diff_steps = 8
    diff_steps = max(1, min(100, diff_steps))
    _raw_cfg = getattr(body, "cfg", None)
    diff_cfg = int(body.cfg_scale if body.cfg_scale is not None else (int(_raw_cfg) if _raw_cfg is not None else 4))
    diff_cfg = max(1, min(10, diff_cfg))
    sampler_cfg_for_ace = body.cfg
    if sampler_cfg_for_ace is not None:
        try:
            sampler_cfg_for_ace = float(sampler_cfg_for_ace)
        except (TypeError, ValueError):  # fmt: skip
            sampler_cfg_for_ace = None
    ugs_wf = getattr(body, "ugs_workflow", None)
    xl_studio_tab = getattr(body, "source_mode", None) == "xl_base_sft_tab"
    use_comfy_ksampler_template = bool(getattr(body, "ksampler_use_comfy_template", False))
    # Не трогать cfg/steps шаблона Comfy для Base/SFT (SFT: cfg 7, 50 steps в JSON).
    if use_comfy_ksampler_template and ugs_wf in (
        "v2_base",
        "v2_sft",
    ):
        sampler_cfg_for_ace = None
    # Для BASE/SFT держим KSampler CFG в безопасном окне, иначе модель чаще даёт шум/артефакты вместо вокала.
    elif ugs_wf in ("v2_base", "v2_sft") and sampler_cfg_for_ace is not None:
        sampler_cfg_for_ace = max(1.2, min(3.2, float(sampler_cfg_for_ace)))

    input_data: dict[str, Any] = {
        "lyrics": lyrics,
        "tags": tags,
        "vocal": vocal,
        "style": style_key,
        "bpm": bpm,
        "duration_seconds": duration_seconds,
        "language": language,
        "keyscale": keyscale,
        "timesignature": timesignature,
        "temperature": temperature,
        "cfg_scale": cfg_scale,
        "top_p": top_p,
        "seed": seed,
        "steps": diff_steps,
        "cfg": sampler_cfg_for_ace,
    }
    if getattr(body, "generate_audio_codes", None) is not None:
        input_data["generate_audio_codes"] = body.generate_audio_codes
    if getattr(body, "top_k", None) is not None:
        input_data["top_k"] = body.top_k
    if getattr(body, "min_p", None) is not None:
        input_data["min_p"] = body.min_p
    if use_comfy_ksampler_template:
        input_data["ksampler_use_comfy_template"] = True
    _sn = getattr(body, "sampler_name", None)
    if _sn:
        input_data["sampler_name"] = str(_sn).strip()
    _sch = getattr(body, "scheduler", None)
    if _sch:
        input_data["scheduler"] = str(_sch).strip()
    _bd = getattr(body, "denoise", None)
    if _bd is not None:
        input_data["denoise"] = float(_bd)

    if ugs_wf == "v2_base":
        xl_obs = build_xl_base_input_observability(lyrics, tags, language=language)
        stamp_xl_base_observability_on_input_data(input_data, xl_obs)
        log_xl_base_gate_passed(
            sung_lines=xl_obs.get("xl_base_lyrics_sung_lines"),
            tags_len=xl_obs.get("xl_base_tags_len"),
            tags_sections=xl_obs.get("xl_base_tags_section_count"),
        )

    if is_chaotic:
        billing = "chaotic"
        type_key = "music_generator_generate_ace_chaotic"
    elif engine == "ace_step" and ugs_wf == "v5":
        billing_mode_in = (body.billing_mode or "professional").strip().lower()
        if billing_mode_in == "wizard":
            billing = "wizard"
        elif billing_mode_in == "professional":
            billing = "professional"
        else:
            billing = "v5"
        type_key = "music_generator_generate_ace_v5"
        input_data["ugs_workflow"] = "v5"
        input_data["ace_workflow"] = "v5"
        if use_comfy_ksampler_template:
            input_data["ksampler_use_comfy_template"] = True
    elif engine == "ace_step" and ugs_wf == "v4":
        billing_mode_in = (body.billing_mode or "professional").strip().lower()
        if billing_mode_in == "wizard":
            billing = "wizard"
        elif billing_mode_in == "professional":
            billing = "professional"
        else:
            billing = "v4"
        type_key = "music_generator_generate_ace_v4"
        input_data["ugs_workflow"] = "v4"
        input_data["ace_workflow"] = "v4"
        input_data["v4_soloist"] = v4_soloist_key
        if v4_soloist_key == "luna":
            input_data["music_generator_v4_soloist"] = "luna"
            input_data["music_generator_v4_soloist_label"] = MUSIC_GENERATOR_V4_SOLOIST_PRESETS["luna"]["label"]
        if use_comfy_ksampler_template:
            input_data["ksampler_use_comfy_template"] = True
    elif engine == "ace_step" and ugs_wf in ("v2", "v2_base", "v2_sft"):
        billing_mode_in = (body.billing_mode or "professional").strip().lower()
        if billing_mode_in == "companion_xl_base":
            billing = "companion_xl_base"
            type_key = "music_generator_generate_ace_v2_base_companion"
        elif billing_mode_in == "wizard":
            billing = "wizard"
            type_key = "music_generator_generate_ace_v2"
        elif billing_mode_in == "professional":
            billing = "professional"
            type_key = "music_generator_generate_ace_v2"
        else:
            billing = "ugs_v2"
            type_key = "music_generator_generate_ace_v2"
        input_data["ugs_workflow"] = str(ugs_wf)
        input_data["ace_workflow"] = str(ugs_wf)
        if xl_studio_tab:
            input_data["music_generator_source_mode"] = "xl_base_sft_tab"
            input_data["source_mode"] = "xl_base_sft_tab"
    else:
        billing_raw = (body.billing_mode or "professional").strip().lower()
        billing = billing_raw if billing_raw in ("wizard", "professional") else "professional"
        suffix = "_wizard" if billing == "wizard" else "_professional"
        type_key = (
            f"music_generator_generate_diffrhythm{suffix}"
            if engine == "diffrhythm"
            else f"music_generator_generate_ace{suffix}"
        )

    for corr_key in (
        "ewa_companion_run_id",
        "ewa_companion_step_id",
        "ewa_companion_principal_id",
    ):
        corr_val = getattr(body, corr_key, None)
        if corr_val:
            input_data[corr_key] = str(corr_val).strip()

    try:
        idem_key = resolve_music_generate_idempotency_key(body.idempotency_key, http_request)
        resp = await run_music_generate_ugs(
            ugs,
            user_id=str(user.id),
            type_key=type_key,
            input_data=input_data,
            idempotency_key=idem_key,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Music Generator generate failed: %s", e)
        raise HTTPException(
            status_code=502,
            detail="Не удалось сгенерировать музыку. Повторите попытку позже.",
        ) from e

    audio_bytes = decode_first_ugs_audio_bytes(resp)
    (
        audio_bytes,
        promo_mix_status,
        promo_mix_voice_id,
        promo_mix_speed,
        promo_mix_error,
    ) = await apply_promo_voiceover_tts_mix(
        audio_bytes=audio_bytes,
        style_key=style_key,
        promo_use_tts_mix=promo_use_tts_mix,
        promo_spoken_text=promo_spoken_text,
        vocal=vocal,
        promo_director_factors_for_mix=promo_director_factors_for_mix,
        duration_seconds=duration_seconds,
    )
    mg_metadata = build_music_generator_mg_metadata(
        body=body,
        lyrics=lyrics,
        tags=tags,
        billing=billing,
        seed=seed,
        style_key=style_key,
        vocal=vocal,
        language=language,
        bpm=bpm,
        duration_seconds=duration_seconds,
        keyscale=keyscale,
        timesignature=timesignature,
        temperature=temperature,
        cfg_scale=cfg_scale,
        top_p=top_p,
        diff_steps=diff_steps,
        requested_seed=requested_seed,
        ugs_resp=resp,
        is_chaotic=is_chaotic,
        chaotic_resolved_template_key=chaotic_resolved_template_key,
        chaos_level_used=chaos_level_used,
        promo_use_tts_mix=promo_use_tts_mix,
        promo_spoken_text=promo_spoken_text,
        promo_original_lyrics_for_meta=promo_original_lyrics_for_meta,
        promo_mix_status=promo_mix_status,
        promo_mix_voice_id=promo_mix_voice_id,
        promo_mix_speed=promo_mix_speed,
        promo_mix_error=promo_mix_error,
    )
    return await persist_generated_music_content(
        content_service,
        user_id=str(user.id),
        name=name,
        audio_bytes=audio_bytes,
        mg_metadata=mg_metadata,
    )


@router.post("/edit")
async def edit_music(
    body: MusicEditRequest,
    user: User = Depends(require_oauth2_user),
    content_service: ContentStorageService = Depends(get_content_service),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> dict:
    """
    Edit an existing song with M2M (Music-to-Music) workflow via UGS.
    """
    _maybe_save_music_generator_request_json("edit", user_id=str(user.id), body=body)
    content_id_str = (body.content_id or "").strip()
    if not content_id_str:
        raise HTTPException(status_code=400, detail="content_id is required")
    try:
        content_id = UUID(content_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="content_id must be a valid UUID") from None

    lyrics = (body.lyrics or "").strip()
    if not lyrics:
        raise HTTPException(status_code=400, detail="lyrics is required")
    if len(lyrics) > MAX_LYRICS_LENGTH:
        lyrics = lyrics[:MAX_LYRICS_LENGTH] + "\n[... truncated]"
    lyrics = sanitize_lyrics_ai_output(lyrics)
    lyrics, _taboo_changed, _taboo_hits = scrub_forbidden_meta_music_words(lyrics, language="ru")
    if not lyrics.strip():
        raise HTTPException(status_code=400, detail="lyrics is required")
    tags = strip_backticks_from_ace_tags((body.tags or "").strip())
    if len(tags) > MAX_TAGS_LENGTH:
        tags = tags[:MAX_TAGS_LENGTH]
    if not tags:
        tags = "melodic pop, female vocal, piano, guitar, modern production, emotional"
    lyrics_strength = body.lyrics_strength
    if lyrics_strength is not None:
        try:
            lyrics_strength = float(lyrics_strength)
            lyrics_strength = max(0.0, min(1.0, lyrics_strength))
        except (TypeError, ValueError):  # fmt: skip
            lyrics_strength = 0.99
    else:
        lyrics_strength = 0.99
    denoise = body.denoise
    if denoise is not None:
        try:
            denoise = float(denoise)
            denoise = max(0.1, min(1.0, denoise))
        except (TypeError, ValueError):  # fmt: skip
            denoise = 0.3
    else:
        denoise = 0.3
    steps = body.steps or 50
    steps = max(1, min(100, steps))
    cfg = body.cfg or 5
    cfg = max(1, min(15, cfg))
    requested_seed = body.seed
    seed, used_requested_seed, seed_was_clamped = resolve_music_generation_seed(requested_seed)
    if used_requested_seed:
        if seed_was_clamped:
            logger.info(
                "music_generator/edit: requested seed clamped into safe range (requested=%s, applied=%s)",
                requested_seed,
                seed,
            )
        else:
            logger.info("music_generator/edit: using requested seed=%s", seed)

    content = await content_service.get_content(content_id, str(user.id))
    if content.content_type != ContentType.AUDIO:
        raise HTTPException(
            status_code=400,
            detail="content_id must refer to an audio track (music generator or other audio)",
        )
    if content.storage_backend is None:
        raise HTTPException(status_code=500, detail="Content storage not configured")
    backend = content_service.storage_factory.get_backend_by_name(content.storage_backend.value)
    try:
        file_data = await backend.retrieve(content.file_path or "", content_id)
    except (ValueError, FileNotFoundError, SeaweedFileCorruptedError) as e:
        logger.info(
            "music_generator/edit: blob missing or unreadable content_id=%s: %s",
            content_id,
            e,
        )
        raise HTTPException(
            status_code=404,
            detail="File data not found for this content",
        ) from e
    except Exception as e:
        logger.exception("music_generator/edit: storage retrieve failed content_id=%s", content_id)
        raise HTTPException(
            status_code=500,
            detail="Не удалось прочитать файл из хранилища.",
        ) from e
    if not file_data:
        raise HTTPException(status_code=404, detail="File data is empty")

    if not WORKFLOW_PATH_M2M_EDIT.exists():
        logger.error("Music edit workflow not found: %s", WORKFLOW_PATH_M2M_EDIT)
        raise HTTPException(
            status_code=500,
            detail="Редактирование треков на сервере сейчас недоступно.",
        )

    audio_b64 = base64.b64encode(file_data).decode("ascii")
    input_data = {
        "audio_base64": audio_b64,
        "lyrics": lyrics,
        "tags": tags,
        "lyrics_strength": lyrics_strength,
        "denoise": denoise,
        "steps": steps,
        "cfg": cfg,
        "seed": seed,
    }

    try:
        resp = await run_studio_ugs_generate(
            ugs,
            user_id=str(user.id),
            type_key="music_generator_edit",
            input_data=input_data,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Music Generator edit failed: %s", e)
        raise HTTPException(
            status_code=502,
            detail="Не удалось отредактировать трек. Повторите попытку позже.",
        ) from e

    audio_bytes = decode_first_ugs_audio_bytes(resp)
    name = f"Edited {datetime_now_str()}"
    original_filename = safe_mp3_original_filename(name, fallback_stem="edited_track")
    content_data = ContentCreate(
        user_id=str(user.id),
        name=name,
        description="Трек отредактирован в генераторе песен",
        content_type=ContentType.AUDIO,
        mime_type="audio/mpeg",
        sub_type="music_generator",
        original_filename=original_filename,
        tags=["music_generator", "edited_track"],
        visibility=Visibility.PRIVATE,
        source_service="music_generator",
        source_id=str(uuid4()),
        metadata={"music_generator_lyrics": lyrics, "music_generator_tags": tags},
        company_id=None,
        project_id=None,
        title=None,
        word_count=None,
        character_count=None,
        access_level=None,
        is_public=None,
        folder_item_id=None,
        apply_project_desktop_folder=True,
    )
    try:
        content_out = await content_service.create_content(
            content_data=content_data,
            file_data=audio_bytes,
            user_id=str(user.id),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        logger.exception("Music Generator edit: create_content failed after audio generation: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Не удалось сохранить отредактированный трек в хранилище. Повторите попытку.",
        ) from e
    return {"content_id": str(content_out.id), "name": content_out.name or name}
