# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared helpers for music_generator_generate (idempotency, debug/liked JSON,
# style English map, UGS audio unwrap, promo TTS mix, content persist).
# No APIRouter — generate child remains HTTP owner for /generate and /edit.
# Invariants:
# - Must not import api.routers.music_generator or music_generator_generate (no cycles).
# - Public URL shapes unchanged; this module has no routes.
# Related:
# - api/routers/music_generator_generate.py
# - documentation/product/MUSIC-GENERATOR-REFERENCE.md
# - documentation/platform/ATOMIC-ROUTER-DECOMPOSITION-CANON.md
# ---
"""Generate/edit support helpers extracted from music_generator_generate (Phase C.4 wave 4)."""

from __future__ import annotations

import base64
import json
import logging
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, Request
from pydantic import BaseModel  # type: ignore[import-untyped]

from api.routers.creative_studio_utils import find_studio_ugs_idempotent_reuse, run_studio_ugs_generate
from api.routers.music_generator_lyrics_style import (
    _lyrics_contains_enriched_headers,
    _normalize_luna_mode,
    _style_english_luna_line,
    _style_english_rnb_classic_line,
)
from api.routers.music_generator_tag_finalize import substitute_first_bpm_token_in_text
from api.routers.ugs.deps import _idempotency_key_from_body_or_headers
from api.schemas.music_generate_request import MusicGenerateRequest
from api.schemas.notifications import (
    NotificationCreate,
    NotificationPriority,
    NotificationType,
)
from api.schemas.unified_content import ContentCreate, ContentType, Visibility
from api.services.music_generator_promo import bpm_speech_for_promo
from api.services.music_generator_xl_base_pipeline import extract_xl_base_obs_from_ugs_response
from api.services.music_promo_audio_mixer import (
    mix_promo_voice_with_bed,
    prepare_promo_text_for_tts,
    silero_voice_for_promo,
)
from api.services.music_promo_audio_mixer import (
    settings_for_director as promo_mix_settings_for_director,
)
from api.services.notification_service import get_notification_service
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.services.unified_content.content_storage_service import ContentStorageService
from api.services.voice_gateway_service import synthesize_speech as silero_synthesize_speech

logger = logging.getLogger(__name__)

# Must stay aligned with parent ``_PROMO_PRESET_NARRATION_HINT_RU`` keys (promo-script route).
VALID_PROMO_VOICEOVER_PRESETS = frozenset(
    {
        "pirate_radio",
        "trailer_epic",
        "tv_clean",
        "late_night",
        "tech_keynote",
        "playful_brand",
    }
)

MUSIC_GENERATE_IN_PROGRESS_STATUSES = frozenset({"queued", "processing", "retrying"})

_MUSIC_GENERATOR_DEBUG_JSON_DIR = os.environ.get("MUSIC_GENERATOR_DEBUG_JSON_DIR", "").strip()
_MUSIC_GENERATOR_LIKED_RECIPES_DIR = os.environ.get("MUSIC_GENERATOR_LIKED_RECIPES_DIR", "").strip()

# Style English prefixes for non-luna presets (BPM tokens substituted at resolve time).
STYLE_ENGLISH_MAP: dict[str, str] = {
    "pop": "Pop",
    "rock": "Rock",
    "electronic": "Electronic",
    "ballad": "Ballad",
    "drum and bass": "Drum and bass",
    "hip_hop": "Hip-hop",
    "classical": "Classical",
    "dubstep": "Dubstep",
    "lofi_chill": (
        "Lo-fi hip hop / chill beats: warm tape saturation, soft kick, lazy swung groove, vinyl crackle, mellow pads."
    ),
    "noir_cabaret": (
        "Dark jazz / noir cabaret: smoky bar, upright bass, brushed ride, muted trumpet stabs, slow late-night swing."
    ),
    "folk": "Russian folk / acoustic roots: acoustic instruments, simple mix, story-forward vocal.",
    "house": "House / club: 128 BPM four-on-the-floor, crisp hats, warm sub-bass, sidechain, club polish.",
    "techno": "Techno: 130 BPM driving kick, minimal percussion, dark low-end, warehouse atmosphere.",
    "trance": "Trance: 138 BPM rolling bass, supersaw pads, arpeggiated leads, euphoric lift.",
    "edm": "Big-room EDM: 128 BPM festival kick, wide chords, snare fills, mainstage hook energy.",
    "hardstyle": "Hardstyle: 150 BPM distorted kick, aggressive leads, raw high-impact dance energy.",
    "ambient_instrumental": "Ambient instrumental: 68 BPM evolving pads, drones, wide space, no lead vocal.",
    "post_rock_instrumental": ("Post-rock instrumental: 112 BPM guitar layers, crescendos, dynamic drums, no vocals."),
    "cinematic_instrumental": (
        "Cinematic orchestral instrumental: 82 BPM strings, brass, subtle pulses, no lead vocal."
    ),
    "bossa_instrumental": ("Bossa nova instrumental: 126 BPM nylon guitar, brushed drums, upright bass, no vocal."),
    "funk_instrumental": (
        "Funk instrumental: 104 BPM syncopated groove, bass, clav and guitars, horn stabs optional, no vocal."
    ),
    "celtic_instrumental": (
        "Celtic folk instrumental: 108 BPM fiddle or whistle, bodhrán, acoustic strings, no vocal."
    ),
    "metal": (
        "Heavy metal: 152 BPM double-kick drive, downtuned guitars, aggressive or melodic lead vocal, "
        "scooped bass, tight snare."
    ),
    "indie_rock": (
        "Indie rock: 115 BPM live drums, jangly or crunchy guitars, melodic bass, introspective or anthemic lead vocal."
    ),
    "grunge": (
        "Grunge /90s alt-rock: 92 BPM thick distorted guitars, lazy swung groove, raw emotional lead "
        "vocal, loud-quiet dynamics."
    ),
    "soul": (
        "Classic soul / Motown: 96 BPM live drums, walking bass, horn stabs optional, warm keys, "
        "passionate lead vocal with hooks."
    ),
    "latin_pop": (
        "Latin pop: 96 BPM salsa or bachata-influenced grooves, layered percussion, guitar or piano "
        "montuno, romantic lead vocal."
    ),
    "disco": (
        "Disco / nu-disco: 118 BPM four-on-the-floor kick, muted funk guitar, string stabs, bouncing "
        "bass, dance-floor polish."
    ),
    "amapiano": (
        "Amapiano: 115 BPM log-drum bass patterns, airy chords, shakers, soulful hooks, warm South African club bounce."
    ),
    "bollywood_pop": (
        "Bollywood pop: 110 BPM tabla/dhol pockets, strings, romantic or heroic lead vocal, cinematic dynamics."
    ),
    "mandopop": ("Mandopop: 118 BPM polished C-pop, emotional lead, piano or traditional color, modern chorus lift."),
    "drill": "Drill: 140 BPM sliding 808s, dark melodies, sparse kick, busy hats, rap vocal half-time feel.",
    "reggae": ("Reggae: 78 BPM one-drop, organ bubbles, guitar chops, warm bass, conscious or lovers-rock vocal."),
    "baile_funk": ("Baile funk: 132 BPM tamborzão pattern, MC energy, brass stabs, heavy sub, Brazilian street club."),
    "punjabi_pop": ("Punjabi pop: 98 BPM dhol groove, tumbi hooks, claps, celebratory lead vocal, festival bounce."),
    "neo_soul": (
        "Neo-soul: 88 BPM Rhodes or Wurlitzer, round bass, live drums with ghost notes, intimate "
        "soulful lead, warm analog mix."
    ),
    "gospel_soul": (
        "Gospel soul: 100 BPM Hammond or piano, claps, stacked harmonies, uplifting passionate lead "
        "vocal, spirited dynamics."
    ),
    "indie_folk_pop": (
        "Indie folk pop: 108 BPM acoustic guitar, stomp and claps, earnest lead vocal, anthemic chorus "
        "lift, earthy room sound."
    ),
    "boogie_funk": (
        "Boogie funk: 112 BPM syncopated keys, rubbery bass, crisp drums, playful warm lead vocal, "
        "1970s-style dance groove."
    ),
    "trap": (
        "Trap: 140 BPM sliding 808 bass, triplet hi-hats, sparse dark melody, punchy snare, confident "
        "rap or melodic hook."
    ),
    "punk_rock": (
        "Punk rock: 172 BPM fast downstroke guitars, urgent live drums, raw vocal, gang hooks, short "
        "high-energy sections."
    ),
    "shoegaze": (
        "Shoegaze: 96 BPM blurred guitar wall, reverse reverb, soft buried vocal, wide hazy stereo, "
        "slow emotional bloom."
    ),
    "darkwave": (
        "Darkwave: 122 BPM minor-key synth bass, drum machine pulse, chorus-heavy guitars or pads, "
        "nocturnal gothic mood."
    ),
    "eurodance": (
        "Eurodance: 138 BPM bright piano stabs, four-on-the-floor kick, rave synth hooks, rap verse and sung chorus."
    ),
    "electro_swing": (
        "Electro swing / neo-swing: 120 BPM club and festival — pumping house or four-on-the-floor kick, "
        "heavy sidechain, loud sub, saturated mix; 1920s–40s as brass stabs, clarinet and trumpet chops, "
        "swing-layer hats, vinyl cuts, vocal chops; NOT acoustic jazz-trio or brushed-drums-only as the "
        "main bed."
    ),
    "uk_garage": (
        "UK garage / 2-step: 132 BPM shuffled drums, swung hats, chopped soulful vocal, warm sub-bass, "
        "bouncy club groove."
    ),
    "flamenco_pop": (
        "Flamenco pop: 98 BPM nylon guitar rasgueado, palmas, cajon, dramatic lead vocal, organic Spanish pop fusion."
    ),
    "city_pop": (
        "Japanese city pop: 112 BPM glossy 80s fusion-pop, slap bass, electric piano, clean guitars, "
        "brass stabs, night-drive warmth."
    ),
}


def resolve_music_generate_idempotency_key(
    body_key: str | None,
    http_request: Request | None,
) -> str | None:
    """Body field wins over Idempotency-Key / X-Idempotency-Key headers; value must be UUID."""
    raw = _idempotency_key_from_body_or_headers(body_key, http_request)
    if not raw:
        return None
    try:
        return str(UUID(raw))
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "invalid_idempotency_key",
                "message": "idempotency_key must be a valid UUID",
            },
        ) from exc


def raise_music_generate_in_progress_conflict(reused_resp: dict[str, Any]) -> None:
    raise HTTPException(
        status_code=409,
        detail={
            "code": "music_generate_in_progress",
            "message": (
                "Генерация с этим ключом идемпотентности уже выполняется. "
                "Дождитесь завершения или используйте другой ключ."
            ),
            "request_id": reused_resp.get("request_id"),
            "status": reused_resp.get("status"),
        },
    )


def maybe_save_liked_recipe_json(*, user_id: str, content_id: UUID, payload: dict[str, Any]) -> None:
    """
    Если задан MUSIC_GENERATOR_LIKED_RECIPES_DIR, сохраняет снимок метаданных лайкнутого трека
    для внутреннего анализа (подкаталог liked-recipes/<user_id>/<content_id>.json).
    """
    if not _MUSIC_GENERATOR_LIKED_RECIPES_DIR:
        return
    try:
        root = Path(_MUSIC_GENERATOR_LIKED_RECIPES_DIR).expanduser()
        safe_uid = re.sub(r"[^a-zA-Z0-9_-]+", "_", (user_id or "anon")[:64]).strip("_") or "anon"
        subdir = root / "liked-recipes" / safe_uid
        subdir.mkdir(parents=True, exist_ok=True)
        out_path = subdir / f"{content_id}.json"
        out_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str) + "\n",
            encoding="utf-8",
        )
    except OSError as e:
        logger.warning("music_generator: liked recipe save failed (IO): %s", e)
    except Exception:
        logger.warning("music_generator: liked recipe save failed", exc_info=True)


def maybe_save_music_generator_request_json(
    endpoint_slug: str,
    *,
    user_id: str,
    body: dict[str, Any] | BaseModel,
) -> None:
    """
    Если задан MUSIC_GENERATOR_DEBUG_JSON_DIR, сохраняет полное JSON-тело запроса
    (как распарсил FastAPI), по одному файлу на запрос. Файлы раскладываются по
    подкаталогам по имени эндпоинта (например .../generate/, .../lyrics/).
    """
    if not _MUSIC_GENERATOR_DEBUG_JSON_DIR:
        return
    try:
        payload = body.model_dump(mode="json") if isinstance(body, BaseModel) else dict(body)
        root = Path(_MUSIC_GENERATOR_DEBUG_JSON_DIR).expanduser()
        safe_slug = re.sub(r"[^a-z0-9_-]+", "_", endpoint_slug.lower())[:48].strip("_") or "req"
        subdir = root / safe_slug
        subdir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S_%f")
        uid_short = (user_id or "anon")[:12]
        fname = f"{ts}_{uid_short}_{uuid4().hex[:8]}.json"
        out_path = subdir / fname
        out_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str) + "\n",
            encoding="utf-8",
        )
    except OSError as e:
        logger.warning("music_generator: debug JSON save failed (IO): %s", e)
    except Exception:
        logger.warning("music_generator: debug JSON save failed", exc_info=True)


def resolve_track_bpm(
    body: MusicGenerateRequest,
    *,
    is_chaotic: bool,
    chaotic_bundle: dict[str, Any] | None,
    is_promo_voiceover: bool,
    promo_recommended_bpm: int | None,
) -> int:
    """Один проход: тот же приоритет, что ранее в generate_music (chaotic / promo / default)."""
    if is_chaotic and chaotic_bundle is not None and body.bpm is None:
        raw_bpm = chaotic_bundle["bpm"]
    elif (not is_chaotic) and is_promo_voiceover:
        raw_bpm = promo_recommended_bpm or body.bpm or bpm_speech_for_promo(body.duration_seconds or 45)
    else:
        raw_bpm = body.bpm if body.bpm is not None else 120
    try:
        bpm = int(raw_bpm)
    except (TypeError, ValueError):  # fmt: skip
        bpm = 120
    return max(10, min(300, bpm))


class MusicEditRequest(BaseModel):
    content_id: str | None = None
    lyrics: str | None = None
    tags: str | None = None
    lyrics_strength: float | None = None
    denoise: float | None = None
    steps: int | None = None
    cfg: int | None = None
    seed: int | None = None


def unwrap_audio_block(ugs_result: dict[str, Any]) -> dict[str, Any]:
    block = ugs_result.get("result") or {}
    if isinstance(block, dict) and "audio" not in block and isinstance(block.get("result"), dict):
        inner = block.get("result")
        if isinstance(inner, dict) and "audio" in inner:
            return inner
    return block if isinstance(block, dict) else {}


def safe_mp3_original_filename(track_name: str, *, fallback_stem: str = "track") -> str:
    """Имя файла для сохранения: без технических маркеров пайплайна в названии."""
    stem = (track_name or "").strip() or fallback_stem
    stem = re.sub(r'[/\\?*:|"<>]', "", stem)
    stem = re.sub(r"\s+", "_", stem)
    stem = re.sub(
        r"(?i)(comfyui?|ace[\s_-]?step\s*1?\.?5?|diffrhythm|m2m|workflow|custom_nodes)",
        "",
        stem,
    )
    stem = re.sub(r"_+", "_", stem).strip("_") or fallback_stem
    if len(stem) > 180:
        stem = stem[:180]
    if stem.lower().endswith(".mp3"):
        return stem
    return f"{stem}.mp3"


def datetime_now_str() -> str:
    return datetime.now(UTC).strftime("%Y%m%d_%H%M%S")


def resolve_style_english_line(
    style_key: str,
    *,
    vocal: str,
    luna_mode: str,
    bpm: int,
) -> str:
    """English Style: prefix for ACE tags (luna / rnb / map / title-case fallback)."""
    if style_key == "luna":
        return _style_english_luna_line(vocal, luna_mode=luna_mode)
    if style_key == "rnb_classic_female":
        style_english = _style_english_rnb_classic_line(vocal)
    else:
        style_english = STYLE_ENGLISH_MAP.get(style_key, style_key.replace("_", " ").title())
    return substitute_first_bpm_token_in_text(style_english, bpm)


def decode_first_ugs_audio_bytes(ugs_resp: dict[str, Any]) -> bytes:
    """Unwrap UGS result and decode the first base64 audio blob (HTTP 502 on empty)."""
    block = unwrap_audio_block(ugs_resp)
    audio_list = block.get("audio") or []
    if not audio_list:
        raise HTTPException(
            status_code=502,
            detail="Не удалось получить аудиофайл. Повторите попытку позже.",
        )
    first = audio_list[0]
    b64 = first.get("data")
    if not b64:
        raise HTTPException(
            status_code=502,
            detail="Получен пустой аудиофайл. Повторите попытку позже.",
        )
    return base64.b64decode(b64)


async def run_music_generate_ugs(
    ugs: UnifiedGenerationService,
    *,
    user_id: str,
    type_key: str,
    input_data: dict[str, Any],
    idempotency_key: str | None,
) -> dict[str, Any]:
    """Idempotent UGS submit for generate; raises 409 when same key is still in progress."""
    resp: dict[str, Any] | None = None
    if idempotency_key:
        reused = await find_studio_ugs_idempotent_reuse(
            ugs,
            user_id=user_id,
            type_key=type_key,
            idempotency_key=idempotency_key,
        )
        if reused is not None:
            reused_status = str(reused.get("status") or "")
            if reused_status in MUSIC_GENERATE_IN_PROGRESS_STATUSES:
                raise_music_generate_in_progress_conflict(reused)
            if reused_status == "completed":
                resp = reused

    if resp is None:
        resp = await run_studio_ugs_generate(
            ugs,
            user_id=user_id,
            type_key=type_key,
            input_data=input_data,
            idempotency_key=idempotency_key,
            allow_idempotent_reuse=True,
        )
        if resp.get("reused") and str(resp.get("status") or "") in MUSIC_GENERATE_IN_PROGRESS_STATUSES:
            raise_music_generate_in_progress_conflict(resp)
    return resp


async def apply_promo_voiceover_tts_mix(
    *,
    audio_bytes: bytes,
    style_key: str,
    promo_use_tts_mix: bool,
    promo_spoken_text: str,
    vocal: str,
    promo_director_factors_for_mix: dict[str, int],
    duration_seconds: int,
) -> tuple[bytes, str, str | None, float | None, str | None]:
    """
    Optional Silero TTS + bed mix for promo_voiceover.
    Returns (audio_bytes, mix_status, voice_id, voice_speed, mix_error).
    """
    promo_mix_status = "skipped"
    promo_mix_voice_id: str | None = None
    promo_mix_speed: float | None = None
    promo_mix_error: str | None = None
    if style_key == "promo_voiceover" and promo_use_tts_mix and promo_spoken_text:
        try:
            voice_id, voice_speed = silero_voice_for_promo(
                vocal,
                voice_strength=int(promo_director_factors_for_mix.get("voice_strength") or 6),
            )
            promo_mix_voice_id = voice_id
            promo_mix_speed = voice_speed
            tts_clean_text = prepare_promo_text_for_tts(promo_spoken_text)
            voice_wav = await silero_synthesize_speech(
                tts_clean_text,
                voice=voice_id,
                speed=voice_speed,
            )
            mix_settings = promo_mix_settings_for_director(promo_director_factors_for_mix)
            mixed_mp3 = await mix_promo_voice_with_bed(
                voice_wav=voice_wav,
                bed_audio=audio_bytes,
                bed_format_hint="mp3",
                settings=mix_settings,
                target_duration_sec=duration_seconds,
            )
            audio_bytes = mixed_mp3
            promo_mix_status = "ok"
            logger.info(
                "promo_voiceover: TTS+bed mix applied (voice=%s speed=%.2f bed_in=%d bytes mix_out=%d bytes)",
                voice_id,
                voice_speed,
                len(audio_bytes) if audio_bytes is not None else 0,
                len(mixed_mp3),
            )
        except Exception as mix_exc:  # noqa: BLE001
            promo_mix_status = "fallback_bed_only"
            promo_mix_error = str(mix_exc)[:300]
            logger.warning(
                "promo_voiceover: TTS+bed mix failed, keeping ACE bed as-is: %s",
                mix_exc,
                exc_info=True,
            )
    return audio_bytes, promo_mix_status, promo_mix_voice_id, promo_mix_speed, promo_mix_error


def build_music_generator_mg_metadata(
    *,
    body: MusicGenerateRequest,
    lyrics: str,
    tags: str,
    billing: str,
    seed: int,
    style_key: str,
    vocal: str,
    language: str,
    bpm: int,
    duration_seconds: int,
    keyscale: str,
    timesignature: str,
    temperature: float,
    cfg_scale: float,
    top_p: float,
    diff_steps: int,
    requested_seed: int | None,
    ugs_resp: dict[str, Any],
    is_chaotic: bool,
    chaotic_resolved_template_key: str | None,
    chaos_level_used: int | None,
    promo_use_tts_mix: bool,
    promo_spoken_text: str,
    promo_original_lyrics_for_meta: str,
    promo_mix_status: str,
    promo_mix_voice_id: str | None,
    promo_mix_speed: float | None,
    promo_mix_error: str | None,
) -> dict[str, Any]:
    """Unified-content metadata for a freshly generated track."""
    mg_metadata: dict[str, Any] = {
        "music_generator_lyrics": lyrics,
        "music_generator_tags": tags,
        "music_generator_billing_mode": billing,
        "music_generator_seed_used": seed,
        "music_generator_lyrics_format": (
            "enriched_sections_v1" if _lyrics_contains_enriched_headers(lyrics) else "legacy_sections"
        ),
    }
    if style_key == "promo_voiceover":
        _pv_render = getattr(body, "promo_vocal_render", None)
        if _pv_render not in ("tts_mix", "ace_model"):
            _pv_render = "tts_mix"
        mg_metadata["music_generator_promo_vocal_render"] = _pv_render
        if promo_use_tts_mix and promo_original_lyrics_for_meta:
            mg_metadata["music_generator_lyrics"] = promo_original_lyrics_for_meta
            mg_metadata["music_generator_promo_instrumental_lyrics"] = lyrics
        mg_metadata["music_generator_promo_spoken_text"] = promo_spoken_text or ""
        mg_metadata["music_generator_promo_mix_status"] = promo_mix_status
        if promo_mix_voice_id is not None:
            mg_metadata["music_generator_promo_voice_id"] = promo_mix_voice_id
        if promo_mix_speed is not None:
            mg_metadata["music_generator_promo_voice_speed"] = round(float(promo_mix_speed), 3)
        if promo_mix_error is not None:
            mg_metadata["music_generator_promo_mix_error"] = promo_mix_error
    wf_meta = getattr(body, "ugs_workflow", None)
    if wf_meta in ("v2", "v2_base", "v2_sft", "v4", "v5"):
        mg_metadata["ugs_workflow"] = str(wf_meta)
    xl_obs_meta = extract_xl_base_obs_from_ugs_response(ugs_resp)
    if xl_obs_meta:
        mg_metadata.update(xl_obs_meta)
    if getattr(body, "source_mode", None) == "xl_base_sft_tab":
        mg_metadata["music_generator_source_mode"] = "xl_base_sft_tab"
    style_for_meta = (getattr(body, "style", "") or "").strip().lower()
    if style_for_meta == "luna":
        mg_metadata["music_generator_luna_mode"] = _normalize_luna_mode(getattr(body, "luna_mode", None))
    if style_for_meta == "promo_voiceover":
        pp = getattr(body, "promo_preset", None)
        if pp and str(pp).strip():
            mg_metadata["music_generator_promo_preset"] = str(pp).strip()[:120]
    if is_chaotic and chaotic_resolved_template_key:
        mg_metadata["chaotic_transition_template"] = chaotic_resolved_template_key
        if chaos_level_used is not None:
            mg_metadata["chaos_level"] = chaos_level_used
        if body.transition_pace:
            mg_metadata["chaotic_transition_pace"] = body.transition_pace
        mg_metadata["chaotic_add_glitch"] = body.chaotic_add_glitch
        mg_metadata["chaotic_add_silence"] = body.chaotic_add_silence
        mg_metadata["chaotic_add_scream"] = body.chaotic_add_scream
    mg_metadata["music_generator_style"] = style_key
    mg_metadata["music_generator_vocal"] = vocal
    mg_metadata["music_generator_language"] = language
    mg_metadata["music_generator_bpm"] = bpm
    mg_metadata["music_generator_duration_seconds"] = duration_seconds
    mg_metadata["music_generator_keyscale"] = keyscale
    mg_metadata["music_generator_timesignature"] = timesignature
    mg_metadata["music_generator_temperature"] = temperature
    mg_metadata["music_generator_cfg_scale"] = cfg_scale
    mg_metadata["music_generator_top_p"] = top_p
    mg_metadata["music_generator_steps"] = diff_steps
    if body.cfg is not None:
        mg_metadata["music_generator_diffusion_cfg"] = body.cfg
    if requested_seed is not None:
        mg_metadata["music_generator_seed_requested"] = requested_seed
    return mg_metadata


async def persist_generated_music_content(
    content_service: ContentStorageService,
    *,
    user_id: str,
    name: str,
    audio_bytes: bytes,
    mg_metadata: dict[str, Any],
) -> dict[str, str]:
    """Save MP3 to unified content and best-effort notify; returns content_id + name."""
    original_filename = safe_mp3_original_filename(name)
    content_data = ContentCreate(
        user_id=user_id,
        name=name,
        description="Аудиотрек, созданный в генераторе песен",
        content_type=ContentType.AUDIO,
        mime_type="audio/mpeg",
        sub_type="music_generator",
        original_filename=original_filename,
        tags=["music_generator"],
        visibility=Visibility.PRIVATE,
        source_service="music_generator",
        source_id=str(uuid4()),
        metadata=mg_metadata,
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
            user_id=user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        logger.exception("Music Generator: create_content failed after audio generation: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Не удалось сохранить трек в хранилище. Повторите попытку или проверьте логи сервера.",
        ) from e
    out_name = (content.name or name or f"Song {datetime_now_str()}").strip()
    if not out_name:
        out_name = "Song"
    try:
        notification_service = get_notification_service()
        await notification_service.send_to_user(
            user_id,
            NotificationCreate(
                type=NotificationType.SUCCESS,
                title="Генератор песен: трек сохранён",
                message=out_name,
                priority=NotificationPriority.HIGH,
                persistent=True,
                source="music_generator",
                metadata={
                    "open_app": {
                        "appComponent": "MusicGenerator",
                        "unifiedContentId": str(content.id),
                        "musicGeneratorTab": "generator",
                    },
                },
            ),
        )
    except Exception:
        logger.debug(
            "Music Generator: post-save notification failed for user %s",
            user_id,
            exc_info=True,
        )
    return {"content_id": str(content.id), "name": out_name}


# Underscore aliases — keep historical import/patch paths stable via generate re-exports.
_VALID_PROMO_VOICEOVER_PRESETS = VALID_PROMO_VOICEOVER_PRESETS
_MUSIC_GENERATE_IN_PROGRESS_STATUSES = MUSIC_GENERATE_IN_PROGRESS_STATUSES
_resolve_music_generate_idempotency_key = resolve_music_generate_idempotency_key
_raise_music_generate_in_progress_conflict = raise_music_generate_in_progress_conflict
_maybe_save_liked_recipe_json = maybe_save_liked_recipe_json
_maybe_save_music_generator_request_json = maybe_save_music_generator_request_json
_resolve_track_bpm = resolve_track_bpm
_unwrap_audio_block = unwrap_audio_block
_safe_mp3_original_filename = safe_mp3_original_filename
_datetime_now_str = datetime_now_str
