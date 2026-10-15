# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Independent Music Generator V3 API.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""Independent Music Generator V3 API."""

from __future__ import annotations

import base64
import logging
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.routers.creative_studio_utils import run_studio_ugs_generate
from api.routers.music_generator_tag_finalize import (
    MAX_TAGS_LENGTH,
    align_first_bpm_in_tags_to_value,
    format_ace_tags_prose_to_sections,
    normalize_vocal_token_in_tags,
    simplify_tags_for_ace,
    strip_backticks_from_ace_tags,
)
from api.routers.music_lyrics_validation import (
    enforce_lyrics_vocal_gender_consistency,
    sanitize_lyrics_ai_output,
    scrub_forbidden_meta_music_words,
    validate_lyrics_for_music,
)
from api.routers.ugs import get_ugs_service
from api.routers.unified_content import get_content_service
from api.schemas.music_generator_v3 import (
    MusicGeneratorV3GenerateRequest,
    MusicGeneratorV3LyricsRequest,
    MusicGeneratorV3StyleRequest,
    MusicGeneratorV3SuggestRequest,
    MusicGeneratorV3SuggestResponse,
)
from api.schemas.notifications import NotificationCreate, NotificationPriority, NotificationType
from api.schemas.unified_content import ContentCreate, ContentType, Visibility
from api.services.music_generator_title_lang import fallback_auto_track_name
from api.services.music_generator_v3.prompts import (
    MUSIC_GENERATOR_V3_SOLOIST_PRESETS,
    MUSIC_GENERATOR_V3_STYLE_PRESETS,
    MUSIC_GENERATOR_V3_VENERA_KSAMPLER,
    apply_v3_duet_section_markers,
    build_v3_lyrics_messages,
    build_v3_style_messages,
    build_v3_suggest_messages,
    coerce_v3_style_and_language,
    dedupe_v3_comma_tags,
    dedupe_v3_lyrics_voice_markers,
    effective_v3_vocal,
    ensure_v3_enriched_lyrics_sections,
    fallback_v3_suggest,
    llama_options_for_v3,
    normalize_v3_soloist_key,
    normalize_v3_style_key,
    parse_v3_suggest_payload,
    sanitize_v3_lyrics_for_ace,
    sanitize_v3_lyrics_for_venera,
    sanitize_v3_tags_for_venera,
    v3_section_tag_skeleton,
    v3_soloist_tag_phrase,
    v3_style_prompt_seed,
    v3_vocal_tag_phrase,
)
from api.services.music_song_mood import resolve_song_mood, song_mood_public_dict
from api.services.notification_service import get_notification_service
from api.services.studio_comfy_workflows import (
    UGS_TYPE_KEY_ACE_MUSIC_V3,
    normalize_keyscale_for_ace_comfy,
)
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.services.unified_content.content_storage_service import ContentStorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/music-generator/v3", tags=["Music Generator V3"])

MAX_LYRICS_LENGTH = 8000
_DEBUG_JSON_DIR = os.environ.get("MUSIC_GENERATOR_DEBUG_JSON_DIR", "").strip()


def _maybe_save_v3_request_json(endpoint_slug: str, *, user_id: str, body: Any) -> None:
    if not _DEBUG_JSON_DIR:
        return
    try:
        import json

        payload = body.model_dump(mode="json") if hasattr(body, "model_dump") else dict(body)
        root = Path(_DEBUG_JSON_DIR).expanduser() / f"v3-{endpoint_slug}"
        root.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S_%f")
        safe_uid = re.sub(r"[^a-zA-Z0-9_-]+", "_", (user_id or "anon")[:32]).strip("_") or "anon"
        (root / f"{ts}_{safe_uid}_{uuid4().hex[:8]}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str) + "\n",
            encoding="utf-8",
        )
    except Exception:
        logger.warning("music_generator_v3: debug JSON save failed", exc_info=True)


def _text_from_ugs_result(ugs_result: dict[str, Any]) -> str:
    block = ugs_result.get("result") or {}
    if isinstance(block, dict):
        if isinstance(block.get("result"), dict):
            inner = block["result"]
            return str(inner.get("text") or inner.get("content") or inner.get("response") or "").strip()
        return str(block.get("text") or block.get("content") or block.get("response") or "").strip()
    return ""


def _unwrap_audio_block(ugs_result: dict[str, Any]) -> dict[str, Any]:
    block = ugs_result.get("result") or {}
    if isinstance(block, dict) and "audio" not in block and isinstance(block.get("result"), dict):
        inner = block.get("result")
        if isinstance(inner, dict) and "audio" in inner:
            return inner
    return block if isinstance(block, dict) else {}


def _strip_markdown_code_fences(text: str) -> str:
    s = (text or "").strip()
    for _ in range(6):
        if not s.startswith("```"):
            break
        lines = s.splitlines()
        if len(lines) < 2 or lines[-1].strip() != "```":
            break
        s = "\n".join(lines[1:-1]).strip()
    return s


def _safe_mp3_original_filename(track_name: str, *, fallback_stem: str = "v3_track") -> str:
    stem = (track_name or "").strip() or fallback_stem
    stem = re.sub(r'[/\\?*:|"<>]', "", stem)
    stem = re.sub(r"\s+", "_", stem)
    stem = re.sub(r"_+", "_", stem).strip("_") or fallback_stem
    return stem[:180] + ("" if stem.lower().endswith(".mp3") else ".mp3")


def _clamp_float(raw: float | None, default: float, lo: float, hi: float) -> float:
    if raw is None:
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError):  # fmt: skip
        return default
    return max(lo, min(hi, value))


def _preset_float(preset: dict[str, Any], key: str, default: float) -> float:
    try:
        return float(preset.get(key, default))
    except (TypeError, ValueError):  # fmt: skip
        return default


def _preset_int(preset: dict[str, Any], key: str, default: int) -> int:
    try:
        return int(preset.get(key, default))
    except (TypeError, ValueError):  # fmt: skip
        return default


def _prepare_v3_tags(
    *,
    tags: str | None,
    style: str,
    vocal: str,
    bpm: int,
    soloist: str | None = None,
    lyrics: str | None = None,
) -> str:
    style_key = normalize_v3_style_key(style)
    preset = MUSIC_GENERATOR_V3_STYLE_PRESETS[style_key]
    raw = strip_backticks_from_ace_tags((tags or "").strip())
    if not raw:
        raw = v3_style_prompt_seed(style_key)
    soloist_key = normalize_v3_soloist_key(soloist)
    soloist_phrase = v3_soloist_tag_phrase(soloist_key)
    vocal_phrase = v3_vocal_tag_phrase(vocal, soloist_key)
    raw, _ = align_first_bpm_in_tags_to_value(raw, bpm)
    if "bpm" not in raw.lower():
        raw = f"{bpm} BPM, {raw}"
    vocal_norm = effective_v3_vocal(vocal, soloist_key)
    tags_lower = raw.lower()
    if "male vocal" not in tags_lower and "female vocal" not in tags_lower and "duet vocal" not in tags_lower:
        # Всегда добавляем явный токан муж/жен/дuet — иначе при солисте ACE часто слышит «левый» пол.
        raw = f"{raw.rstrip(' ,')}, {vocal_phrase}"
    if vocal_norm == "duet" and "alternating" not in raw.lower() and soloist_key == "none":
        raw = f"{raw.rstrip(' ,')}, alternating male/female leads, call and response, duet harmonies"
    raw = normalize_vocal_token_in_tags(raw, vocal_norm)
    if soloist_phrase:
        raw = f"{raw.rstrip(' ,')}, {soloist_phrase}"
    if lyrics:
        raw = re.sub(
            r"(?:\[(?:intro|verse|pre-chorus|chorus|bridge|outro|build up|build-up|drop|breakdown)[^\]]*]\s*){2,}",
            "",
            raw,
            flags=re.I,
        ).strip(" ,")
        skeleton = v3_section_tag_skeleton(lyrics=lyrics, style=style_key, bpm=bpm, soloist=soloist_key)
        raw_low = raw.lower()
        # Empty marker chains like "[intro] [verse] [chorus]" confuse ACE; append concrete section hints.
        if skeleton and (
            "[chorus]" not in raw_low
            or not re.search(r"\[(?:intro|verse|chorus|bridge|outro)[^\]]*]\s*[^,\[]+[a-z]", raw_low)
        ):
            raw = f"{raw.rstrip(' ,')}, {skeleton}"
    raw = format_ace_tags_prose_to_sections(raw)
    raw = simplify_tags_for_ace(raw)
    style_prefix = f"Style: Music Generator V3 / {preset['label']}. "
    if soloist_key != "none":
        _sol = MUSIC_GENERATOR_V3_SOLOIST_PRESETS[soloist_key]
        style_prefix = f"{style_prefix}Soloist: {_sol['label']} — {str(_sol.get('hint') or '')[:200]}. "
    out = f"{style_prefix}{raw}"
    out = dedupe_v3_comma_tags(out, max_segments=32)
    if soloist_key == "venera":
        out = sanitize_v3_tags_for_venera(out)
        out = dedupe_v3_comma_tags(out, max_segments=32)
    return out[:MAX_TAGS_LENGTH]


def _normalize_v3_lyrics_for_vocal(
    lyrics: str,
    *,
    vocal: str,
    language: str,
    style: str,
    bpm: int | None = None,
    soloist: str | None = None,
) -> str:
    out = sanitize_v3_lyrics_for_ace(sanitize_lyrics_ai_output(lyrics))
    out, _changed = enforce_lyrics_vocal_gender_consistency(out, vocal=vocal, language=language)
    out = apply_v3_duet_section_markers(out, vocal=vocal)
    out = ensure_v3_enriched_lyrics_sections(
        out,
        style=style,
        bpm=bpm,
        vocal=vocal,
        soloist=soloist,
    )
    if normalize_v3_soloist_key(soloist) == "venera":
        out = sanitize_v3_lyrics_for_venera(out)
    out, _taboo_changed, _taboo_hits = scrub_forbidden_meta_music_words(out, language=language)
    out = dedupe_v3_lyrics_voice_markers(out)
    return out[:MAX_LYRICS_LENGTH]


@router.post("/lyrics")
async def generate_v3_lyrics(
    body: MusicGeneratorV3LyricsRequest,
    user: User = Depends(require_oauth2_user),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> dict[str, Any]:
    _maybe_save_v3_request_json("lyrics", user_id=str(user.id), body=body)
    style_e, language_e = coerce_v3_style_and_language(body.soloist, style=body.style, language=body.language)
    mood_seed = f"v3:{user.id}:{body.theme.strip()}:{style_e}"
    messages = build_v3_lyrics_messages(
        theme=body.theme,
        style=style_e,
        language=language_e,
        vocal=body.vocal,
        soloist=body.soloist,
        mood_seed=mood_seed,
    )
    resp = await run_studio_ugs_generate(
        ugs,
        user_id=str(user.id),
        type_key="music_generator_v3_lyrics",
        input_data={
            "messages": messages,
            "options": llama_options_for_v3(body.temperature, body.cfg_scale, body.top_p),
        },
    )
    lyrics = _normalize_v3_lyrics_for_vocal(
        _text_from_ugs_result(resp),
        vocal=effective_v3_vocal(body.vocal, body.soloist),
        language=language_e,
        style=style_e,
        bpm=_preset_int(MUSIC_GENERATOR_V3_STYLE_PRESETS[style_e], "bpm", 120),
        soloist=body.soloist,
    )
    if not lyrics.strip():
        raise HTTPException(status_code=502, detail="Llama returned empty V3 lyrics")
    mood_pick = resolve_song_mood(theme=body.theme, seed=mood_seed)
    return {"lyrics": lyrics, "song_mood": song_mood_public_dict(mood_pick)}


@router.post("/suggest-production-params", response_model=MusicGeneratorV3SuggestResponse)
async def suggest_v3_production_params(
    body: MusicGeneratorV3SuggestRequest,
    user: User = Depends(require_oauth2_user),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> MusicGeneratorV3SuggestResponse:
    _maybe_save_v3_request_json("suggest-production-params", user_id=str(user.id), body=body)
    style_e, language_e = coerce_v3_style_and_language(body.soloist, style=body.style, language=body.language)
    lyrics = _normalize_v3_lyrics_for_vocal(
        (body.lyrics or "").strip(),
        vocal=effective_v3_vocal(body.vocal, body.soloist),
        language=language_e,
        style=style_e,
        bpm=_preset_int(MUSIC_GENERATOR_V3_STYLE_PRESETS[style_e], "bpm", 120),
        soloist=body.soloist,
    )
    if not lyrics:
        raise HTTPException(status_code=400, detail="lyrics is required")
    try:
        resp = await run_studio_ugs_generate(
            ugs,
            user_id=str(user.id),
            type_key="music_generator_v3_suggest_params",
            input_data={
                "messages": build_v3_suggest_messages(
                    lyrics=lyrics,
                    style=style_e,
                    vocal=body.vocal,
                    language=language_e,
                    soloist=body.soloist,
                ),
                "options": llama_options_for_v3(body.temperature, body.cfg_scale, body.top_p),
                "json_format": True,
            },
        )
        payload = parse_v3_suggest_payload(
            _text_from_ugs_result(resp),
            style=style_e,
            language=language_e,
            vocal=body.vocal,
            soloist=body.soloist,
        )
    except Exception:
        logger.info("music_generator_v3: suggest fallback used", exc_info=True)
        payload = fallback_v3_suggest(
            style_e,
            language=language_e,
            vocal=body.vocal,
            soloist=body.soloist,
        )
    payload["vocal"] = effective_v3_vocal(body.vocal, body.soloist)
    payload["language"] = language_e
    payload["keyscale"] = normalize_keyscale_for_ace_comfy(str(payload.get("keyscale") or "C major"))
    return MusicGeneratorV3SuggestResponse(**payload)


@router.post("/generate-style")
async def generate_v3_style(
    body: MusicGeneratorV3StyleRequest,
    user: User = Depends(require_oauth2_user),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> dict[str, str]:
    _maybe_save_v3_request_json("generate-style", user_id=str(user.id), body=body)
    style_e, language_e = coerce_v3_style_and_language(body.soloist, style=body.style, language=body.language)
    lyrics = _normalize_v3_lyrics_for_vocal(
        (body.lyrics or "").strip(),
        vocal=effective_v3_vocal(body.vocal, body.soloist),
        language=language_e,
        style=style_e,
        bpm=body.bpm,
        soloist=body.soloist,
    )
    if not lyrics:
        raise HTTPException(status_code=400, detail="lyrics is required")
    style_key = style_e
    bpm = body.bpm or int(MUSIC_GENERATOR_V3_STYLE_PRESETS[style_key]["bpm"])
    resp = await run_studio_ugs_generate(
        ugs,
        user_id=str(user.id),
        type_key="music_generator_v3_style",
        input_data={
            "messages": build_v3_style_messages(
                lyrics=lyrics,
                style=style_key,
                vocal=body.vocal,
                bpm=bpm,
                soloist=body.soloist,
            ),
            "options": llama_options_for_v3(body.temperature, body.cfg_scale, body.top_p),
        },
    )
    raw = _strip_markdown_code_fences(_text_from_ugs_result(resp))
    if not raw:
        raise HTTPException(status_code=502, detail="Llama returned empty V3 style")
    tags = _prepare_v3_tags(
        tags=raw,
        style=style_key,
        vocal=body.vocal,
        bpm=bpm,
        soloist=body.soloist,
        lyrics=lyrics,
    )
    return {"tags": tags}


@router.post("/generate")
async def generate_v3_music(
    body: MusicGeneratorV3GenerateRequest,
    user: User = Depends(require_oauth2_user),
    content_service: ContentStorageService = Depends(get_content_service),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> dict[str, str]:
    _maybe_save_v3_request_json("generate", user_id=str(user.id), body=body)
    style_e, language_e = coerce_v3_style_and_language(body.soloist, style=body.style, language=body.language)
    lyrics = _normalize_v3_lyrics_for_vocal(
        (body.lyrics or "").strip(),
        vocal=effective_v3_vocal(body.vocal, body.soloist),
        language=language_e,
        style=style_e,
        bpm=body.bpm,
        soloist=body.soloist,
    )
    if not lyrics:
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

    style_key = style_e
    preset = MUSIC_GENERATOR_V3_STYLE_PRESETS[style_key]
    bpm = body.bpm or int(preset["bpm"])
    duration_seconds = body.duration_seconds or int(preset["duration_seconds"])
    soloist_key = normalize_v3_soloist_key(body.soloist)
    vocal = effective_v3_vocal(body.vocal, soloist_key)
    language = language_e
    keyscale = normalize_keyscale_for_ace_comfy(body.keyscale)
    timesignature = str(body.timesignature or preset["timesignature"])
    tags = _prepare_v3_tags(
        tags=body.tags,
        style=style_key,
        vocal=vocal,
        bpm=bpm,
        soloist=soloist_key,
        lyrics=lyrics,
    )
    name = (body.name or "").strip()
    if body.generate_title or not name:
        name = f"V3 {fallback_auto_track_name(language)}"
    name = name[:200]

    seed = int(datetime.now(UTC).timestamp() * 1000000) % (2**53 - 1)
    vks = MUSIC_GENERATOR_V3_VENERA_KSAMPLER
    if soloist_key == "venera":
        # Рецепт «качество» для интимного вокала: см. MUSIC_GENERATOR_V3_VENERA_KSAMPLER в prompts.py
        _cfg_ks = float(vks["cfg"])
        _sampler_ks = str(vks["sampler_name"])
        _sched_ks = str(vks["scheduler"])
        _denoise_ks = float(vks["denoise"])
        _shift_ks = float(vks["shift"])
    else:
        _cfg_ks = _clamp_float(body.cfg, _preset_float(preset, "cfg", 3.5), 0.0, 100.0)
        _sampler_ks = body.sampler_name or str(preset.get("sampler_name") or "euler")
        _sched_ks = body.scheduler or str(preset.get("scheduler") or "simple")
        _denoise_ks = _clamp_float(body.denoise, _preset_float(preset, "denoise", 1.0), 0.0, 1.0)
        _shift_ks = _clamp_float(body.shift, _preset_float(preset, "shift", 3.0), 0.0, 12.0)

    input_data: dict[str, Any] = {
        "lyrics": lyrics,
        "tags": tags,
        "vocal": vocal,
        "soloist": soloist_key,
        "style": style_key,
        "bpm": bpm,
        "duration_seconds": duration_seconds,
        "language": language,
        "keyscale": keyscale,
        "timesignature": timesignature,
        "temperature": _clamp_float(body.temperature, _preset_float(preset, "temperature", 0.85), 0.0, 2.0),
        "cfg_scale": _clamp_float(body.cfg_scale, _preset_float(preset, "cfg_scale", 2.0), 0.0, 100.0),
        "top_p": _clamp_float(body.top_p, _preset_float(preset, "top_p", 0.9), 0.0, 2000.0),
        "seed": seed,
        "steps": 8,
        "cfg": _cfg_ks,
        "sampler_name": _sampler_ks,
        "scheduler": _sched_ks,
        "denoise": _denoise_ks,
        "batch_size": body.batch_size or _preset_int(preset, "batch_size", 1),
        "shift": _shift_ks,
        "ugs_workflow": "v3",
        "ugs_type_key": UGS_TYPE_KEY_ACE_MUSIC_V3,
        "generate_audio_codes": True,
    }
    if body.top_k is not None:
        input_data["top_k"] = body.top_k
    if body.min_p is not None:
        input_data["min_p"] = body.min_p

    try:
        resp = await run_studio_ugs_generate(
            ugs,
            user_id=str(user.id),
            type_key=UGS_TYPE_KEY_ACE_MUSIC_V3,
            input_data=input_data,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Music Generator V3 generate failed: %s", e)
        raise HTTPException(
            status_code=502,
            detail="Не удалось сгенерировать музыку V3. Повторите попытку позже.",
        ) from e

    audio_list = _unwrap_audio_block(resp).get("audio") or []
    if not audio_list or not isinstance(audio_list[0], dict) or not audio_list[0].get("data"):
        raise HTTPException(status_code=502, detail="Не удалось получить аудиофайл V3.")
    audio_bytes = base64.b64decode(audio_list[0]["data"])

    metadata = {
        "music_generator_version": "v3",
        "ugs_workflow": "v3",
        "music_generator_v3_workflow": "audio_ace_step_1_5_split_4b_v3",
        "music_generator_lyrics": lyrics,
        "music_generator_tags": tags,
        "music_generator_style": style_key,
        "music_generator_vocal": vocal,
        "music_generator_v3_soloist": soloist_key,
        "music_generator_v3_soloist_label": MUSIC_GENERATOR_V3_SOLOIST_PRESETS[soloist_key]["label"],
        "music_generator_v3_generation_mode": body.generation_mode,
        "music_generator_language": language,
        "music_generator_bpm": bpm,
        "music_generator_duration_seconds": duration_seconds,
        "music_generator_keyscale": keyscale,
        "music_generator_timesignature": timesignature,
        "music_generator_temperature": input_data["temperature"],
        "music_generator_cfg_scale": input_data["cfg_scale"],
        "music_generator_top_p": input_data["top_p"],
        "music_generator_top_k": input_data.get("top_k"),
        "music_generator_min_p": input_data.get("min_p"),
        "music_generator_steps": input_data["steps"],
        "music_generator_sampler_cfg": input_data["cfg"],
        "music_generator_sampler_name": input_data["sampler_name"],
        "music_generator_scheduler": input_data["scheduler"],
        "music_generator_denoise": input_data["denoise"],
        "music_generator_generate_audio_codes": True,
        "music_generator_batch_size": input_data["batch_size"],
        "music_generator_shift": input_data["shift"],
        "music_generator_seed_used": seed,
        "music_generator_billing_mode": "v3",
    }
    content_data = ContentCreate(
        user_id=str(user.id),
        name=name,
        description="Аудиотрек, созданный в генераторе песен V3",
        content_type=ContentType.AUDIO,
        mime_type="audio/mpeg",
        sub_type="music_generator",
        original_filename=_safe_mp3_original_filename(name),
        tags=["music_generator", "music_generator_v3"],
        visibility=Visibility.PRIVATE,
        source_service="music_generator",
        source_id=str(uuid4()),
        metadata=metadata,
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
        content = await content_service.create_content(
            content_data=content_data,
            file_data=audio_bytes,
            user_id=str(user.id),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        logger.exception("Music Generator V3: create_content failed after audio generation: %s", e)
        raise HTTPException(status_code=503, detail="Не удалось сохранить трек V3 в хранилище.") from e

    out_name = (content.name or name or "V3 Song").strip()
    try:
        notification_service = get_notification_service()
        await notification_service.send_to_user(
            str(user.id),
            NotificationCreate(
                type=NotificationType.SUCCESS,
                title="Генератор песен V3: трек сохранён",
                message=out_name,
                priority=NotificationPriority.HIGH,
                persistent=True,
                source="music_generator",
                metadata={
                    "open_app": {
                        "appComponent": "MusicGenerator",
                        "unifiedContentId": str(content.id),
                        "musicGeneratorTab": "wizard",
                    },
                },
            ),
        )
    except Exception:
        logger.debug("Music Generator V3: post-save notification failed", exc_info=True)
    return {"content_id": str(content.id), "name": out_name}
