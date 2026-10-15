# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Backend-first Music Evolution pipeline: durable run state, corpus hints, golden ACE workflow routing,
# UGS text/audio calls, unified_content persistence, and feedback snapshots.
# Invariants:
# - Audio keeps the Evolution billing/debug type key while `ugs_workflow` is selected from the soloist lane.
# - Run input slots (`mood`, `meaning_tags`, `vocal`, `language`) are copied into normalized_input and final metadata.
# - Terminal run states are never overwritten by late pipeline steps; cancellation is checked between long operations.
# - UGS audio requests carry `music_evolution_run_id` correlation and are reconciled by cancel/reaper paths.
# - When enabled, UGS/Comfy payloads are persisted under generated_files (see music_evolution_debug_io).
# - Existing MusicGenerator UI/API behavior is not modified; shared helpers are imported as libraries.
# Related:
# - api/routers/music_evolution.py
# - api/services/music_evolution_corpus.py
# - api/services/music_generator_xl_base_pipeline.py
# ---
"""Music Evolution backend pipeline."""

from __future__ import annotations

import asyncio
import base64
import contextlib
import json
import logging
import os
import random
import re
import tempfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.database_manager import get_database_manager
from api.routers.creative_studio_utils import run_studio_ugs_generate
from api.routers.music_lyrics_validation import sanitize_lyrics_ai_output
from api.routers.unified_content import get_content_service
from api.schemas.music_evolution import MusicEvolutionRunCreate, MusicEvolutionRunOut, MusicEvolutionStepOut
from api.schemas.notifications import NotificationCreate, NotificationPriority, NotificationType
from api.schemas.unified_content import ContentCreate, ContentType, Visibility
from api.services.music_evolution_corpus import (
    collect_music_evolution_corpus,
    upsert_music_evolution_recipe_source,
)
from api.services.music_evolution_debug_io import save_music_evolution_ugs_payload
from api.services.music_evolution_lyrics_craft import (
    evolution_lyrics_errors_retryable,
    evolution_lyrics_retry_user_message,
    polish_evolution_lyrics,
    validate_music_evolution_lyrics_substance,
)
from api.services.music_evolution_prompts import (
    _meaning_labels,
    build_lyrics_messages,
    build_song_recipe_messages,
    build_style_messages,
    parse_song_recipe_text,
    song_recipe_retry_user_message,
    validate_lyrics_against_song_recipe,
    validate_style_tags_against_song_recipe,
)
from api.services.music_evolution_soloists import (
    finalize_soloist_evolution_tags,
    is_soloist_anchor,
    soloist_workflow_overrides,
)
from api.services.music_evolution_tags_sync import sync_evolution_tags_sections_to_lyrics
from api.services.music_evolution_vocal import (
    capitalize_ace_section_tags_in_style,
    enrich_evolution_lyrics_with_voice_lines,
    enrich_evolution_vocal_tags,
    evolution_production_overrides,
    evolution_stable_seed,
    finalize_luna_evolution_tags,
    pick_evolution_vocal_tag_profile,
    resolve_evolution_vocal_slot,
    strip_music_stack_leaks_from_lyrics,
)
from api.services.music_generator_dislike_feedback import validate_dislike_reason
from api.services.music_generator_liked_recipe import build_liked_recipe_payload
from api.services.music_generator_xl_base_pipeline import (
    build_xl_base_input_observability,
    count_lyrics_section_headers,
    count_sung_content_lines,
    extract_xl_base_obs_from_ugs_response,
    prepare_xl_base_lyrics_for_comfy,
    prepare_xl_base_tags_for_comfy,
    stamp_xl_base_observability_on_input_data,
    xl_base_lyrics_retry_user_message,
)
from api.services.notification_service import get_notification_service
from api.services.ugs.unified_generation_service import UnifiedGenerationService

logger = logging.getLogger(__name__)

MUSIC_EVOLUTION_VERSION = "music_evolution_v1"
MUSIC_EVOLUTION_TOTAL_STEPS = 11
MUSIC_EVOLUTION_TERMINAL_STATUSES = frozenset({"completed", "failed", "cancelled"})
MUSIC_EVOLUTION_ACTIVE_STATUSES = frozenset({"queued", "running"})
MUSIC_EVOLUTION_STALE_REAPER_DEFAULT_SECONDS = 2 * 60 * 60
# XL Base render targets: align with studio tab (30–300s); Evolution default ~3:15 like liked Luna exports.
EVOLUTION_AUTO_DURATION_DEFAULT = 195
EVOLUTION_AUTO_DURATION_MIN = 165
EVOLUTION_AUTO_DURATION_MAX = 300
_MUSIC_GENERATOR_LIKED_RECIPES_DIR = os.environ.get("MUSIC_GENERATOR_LIKED_RECIPES_DIR", "").strip()

STEP_DEFS: tuple[tuple[int, str, str], ...] = (
    (1, "intake_normalize", "Нормализую идею песни"),
    (2, "experience_retrieval", "Подбираю опыт удачных песен"),
    (3, "creative_brief", "Собираю творческий бриф"),
    (4, "lyrics_generation", "Пишу текст песни"),
    (5, "lyrics_quality_gate", "Проверяю текст для XL Base"),
    (6, "production_params", "Выбираю темп и параметры"),
    (7, "style_tags_generation", "Собираю теги звучания"),
    (8, "xl_base_finalize", "Готовлю XL Base payload"),
    (9, "audio_generation", "Запускаю XL Base рендер"),
    (10, "content_persist", "Сохраняю трек"),
    (11, "result_ready", "Готовлю результат"),
)


class MusicEvolutionCancelled(RuntimeError):
    """Raised inside the worker when durable run state is already cancelled."""


@dataclass(frozen=True, slots=True)
class MusicEvolutionRunCreateResult:
    """Durable run creation result with idempotency reuse metadata."""

    run_id: UUID
    status: str
    created: bool


GENRE_BPM: dict[str, int] = {
    "pop": 118,
    "hip_hop": 92,
    "rock": 128,
    "house": 124,
    "techno": 132,
    "trance": 138,
    "vocal_trance": 172,
    "edm": 128,
    "luna": 90,
    "folk": 96,
    "chanson": 78,
    "alt_pop": 116,
    "indie_folk": 86,
    "duet_pop": 112,
    "cinematic": 82,
}
MOOD_BPM_DELTA: dict[str, int] = {
    "sad": -12,
    "calm": -10,
    "dark": -4,
    "warm": 0,
    "romantic": -2,
    "ironic": 4,
    "energetic": 14,
    "epic": 8,
    "custom": 0,
}

# Genres where distortion/grit tags are intentional, not ACE vocal artifacts.
EVOLUTION_AGGRESSIVE_GENRES: frozenset[str] = frozenset(
    {"hardstyle", "techno", "grunge", "metal", "industrial", "drum_and_bass", "vocal_trance"}
)

_HARSH_TAG_REPLACEMENTS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bdistorted\s+bass\b", re.I), "warm sub bass, clear low end"),
    (re.compile(r"\bgritty\s+mix\b", re.I), "balanced mix, clear vocal"),
    (re.compile(r"\bgritty\b", re.I), "natural"),
    (re.compile(r"\bdistorted\b", re.I), "warm"),
    (re.compile(r"\bharsh\b", re.I), "smooth"),
    (re.compile(r"\bmetallic\b", re.I), "rounded"),
    (re.compile(r"\bscreeching\b", re.I), "expressive"),
)


def normalize_music_evolution_input(body: MusicEvolutionRunCreate) -> dict[str, Any]:
    """Normalize user creative slots without dropping any contract field."""
    from api.services.music_evolution_soloists import (
        apply_soloist_to_run_create,
        is_freeform_soloist,
        resolve_soloist_id,
    )

    locked = apply_soloist_to_run_create(body)
    soloist_id = resolve_soloist_id(locked.soloist)
    genre = re.sub(r"[^a-z0-9_-]+", "_", locked.genre.strip().lower()).strip("_") or "pop"
    workflow = soloist_workflow_overrides(soloist_id)
    return {
        "theme": locked.theme.strip(),
        "soloist": soloist_id,
        "vocal": locked.vocal,
        "genre": genre,
        "language": locked.language,
        "mood": locked.mood,
        "meaning_tags": list(locked.meaning_tags),
        "extra_context": (locked.extra_context or "").strip(),
        "duration_seconds": int(locked.duration_seconds),
        "ugs_workflow": str(workflow["ugs_workflow"]),
        "ace_workflow": str(workflow["ace_workflow"]),
        "model_scope": str(workflow["model_scope"]),
        "workflow_file": str(workflow["workflow_file"]),
        "ksampler_use_comfy_template": bool(workflow["ksampler_use_comfy_template"]),
        **({"v4_soloist": str(workflow["v4_soloist"])} if workflow.get("v4_soloist") else {}),
        "version": MUSIC_EVOLUTION_VERSION,
        "vocal_locked": not is_freeform_soloist(soloist_id),
    }


def _apply_evolution_vocal_context(normalized_input: dict[str, Any], *, run_id: str) -> dict[str, Any]:
    """Resolve vocal slot; soloist lock skips mood-based ``auto`` randomization."""
    stable_seed = evolution_stable_seed(run_id=run_id, theme=str(normalized_input.get("theme") or ""))
    vocal_raw = str(normalized_input.get("vocal") or "auto").strip().lower()
    if normalized_input.get("vocal_locked") and vocal_raw in {"female", "male", "duet"}:
        vocal_effective = vocal_raw
    else:
        vocal_effective = resolve_evolution_vocal_slot(
            vocal=vocal_raw or "auto",
            mood=str(normalized_input.get("mood") or "warm"),
            seed=stable_seed,
        )
    return {**normalized_input, "vocal_effective": vocal_effective, "_vocal_stable_seed": stable_seed}


def _evolution_vocal_effective(normalized_input: dict[str, Any], params: dict[str, Any] | None = None) -> str:
    if params and params.get("vocal_effective"):
        return str(params["vocal_effective"])
    if normalized_input.get("vocal_effective"):
        return str(normalized_input["vocal_effective"])
    vocal = str(normalized_input.get("vocal") or "auto")
    return "female" if vocal == "auto" else vocal


def ensure_evolution_vocal_marker(tags: str, *, vocal: str) -> str:
    """Ensure final ACE tags contain the exact vocal marker required by XL Base validation."""
    text = (tags or "").strip()
    low = text.lower()
    v = (vocal or "female").strip().lower()
    if v == "duet":
        if "duet" in low or "male and female" in low:
            return text
        marker = "male and female duet vocals"
    else:
        if f"{v} vocal" in low or f"{v} lead" in low:
            return text
        marker = f"{v} vocal"
    return f"{marker}, {text}" if text else marker


def music_evolution_production_params(normalized_input: dict[str, Any]) -> dict[str, Any]:
    """Deterministic first-release production params; LLM remains responsible for lyrics/tags."""
    genre = str(normalized_input.get("genre") or "pop")
    mood = str(normalized_input.get("mood") or "warm")
    bpm = max(60, min(220, GENRE_BPM.get(genre, 118) + MOOD_BPM_DELTA.get(mood, 0)))
    temperature = 0.8
    top_p = 0.88
    cfg_scale = 1.9
    if mood in {"calm", "warm", "romantic"}:
        temperature, top_p, cfg_scale = 0.78, 0.87, 1.85
    elif mood in {"energetic", "epic"}:
        temperature, top_p, cfg_scale = 0.82, 0.89, 1.95
    seed = random.SystemRandom().randint(0, 2**53 - 1)
    vocal_effective = _evolution_vocal_effective(normalized_input)
    params: dict[str, Any] = {
        "bpm": bpm,
        "duration_seconds": int(normalized_input.get("duration_seconds") or EVOLUTION_AUTO_DURATION_DEFAULT),
        "keyscale": "C major",
        "timesignature": "4",
        "temperature": temperature,
        "cfg_scale": cfg_scale,
        "top_p": top_p,
        "seed": seed,
        "generate_audio_codes": True,
        "vocal_effective": vocal_effective,
        "vocal_tag_profile": pick_evolution_vocal_tag_profile(vocal=vocal_effective, seed=seed, genre=genre),
    }
    from api.services.music_evolution_soloists import soloist_production_overrides

    stable = int(normalized_input.get("_vocal_stable_seed") or 0)
    soloist_id = str(normalized_input.get("soloist") or "")
    params.update(
        soloist_production_overrides(
            soloist_id=soloist_id or None,
            mood=mood,
            seed=seed,
            stable_seed=stable,
        )
        or evolution_production_overrides(
            genre=genre,
            mood=mood,
            seed=seed,
            stable_seed=stable,
        )
    )
    return params


def build_music_evolution_audio_input_data(
    *,
    normalized_input: dict[str, Any],
    brief: dict[str, Any],
    lyrics: str,
    tags: str,
    params: dict[str, Any],
    run_id: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build the XL Base audio payload and observable final params."""
    vocal_eff = _evolution_vocal_effective(normalized_input, params)
    input_data = {
        "lyrics": lyrics,
        "tags": tags,
        "style": normalized_input["genre"],
        "vocal": vocal_eff,
        "language": normalized_input["language"],
        "bpm": params["bpm"],
        "duration_seconds": params["duration_seconds"],
        "keyscale": params["keyscale"],
        "timesignature": params["timesignature"],
        "temperature": params["temperature"],
        "cfg_scale": params["cfg_scale"],
        "top_p": params["top_p"],
        "seed": params["seed"],
        "generate_audio_codes": params["generate_audio_codes"],
        **({"sampler_name": str(params["sampler_name"])} if params.get("sampler_name") else {}),
        **({"scheduler": str(params["scheduler"])} if params.get("scheduler") else {}),
        "ugs_workflow": normalized_input.get("ugs_workflow", "v2_base"),
        "ace_workflow": normalized_input.get("ace_workflow", normalized_input.get("ugs_workflow", "v2_base")),
        "billing_mode": "evolution_xl_base",
        "ksampler_use_comfy_template": bool(normalized_input.get("ksampler_use_comfy_template", True)),
        **({"v4_soloist": str(normalized_input["v4_soloist"])} if normalized_input.get("v4_soloist") else {}),
        "music_generator_workflow_file": normalized_input.get("workflow_file"),
        "music_generator_model_scope": normalized_input.get("model_scope"),
        "music_evolution_run_id": run_id,
        "music_evolution_version": MUSIC_EVOLUTION_VERSION,
        "music_evolution_soloist": normalized_input.get("soloist"),
        "music_evolution_mood": normalized_input["mood"],
        "music_evolution_meaning_tags": normalized_input["meaning_tags"],
        "music_evolution_brief": brief,
        "music_evolution_song_recipe": brief,
    }
    xl_obs = build_xl_base_input_observability(lyrics, tags, language=str(normalized_input["language"]))
    stamp_xl_base_observability_on_input_data(input_data, xl_obs)
    return input_data, {**params, "input_observability": xl_obs}


def build_music_evolution_content_metadata(
    *,
    normalized_input: dict[str, Any],
    brief: dict[str, Any],
    corpus: dict[str, Any],
    lyrics: str,
    tags: str,
    params: dict[str, Any],
    run_id: str,
    xl_obs_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build compatible music_generator_* metadata plus Music Evolution provenance."""
    vocal_eff = _evolution_vocal_effective(normalized_input, params)
    metadata: dict[str, Any] = {
        "music_generator_lyrics": lyrics,
        "music_generator_tags": tags,
        "music_generator_style": normalized_input["genre"],
        "music_generator_vocal": vocal_eff,
        "music_generator_language": normalized_input["language"],
        "music_generator_bpm": params["bpm"],
        "music_generator_duration_seconds": params["duration_seconds"],
        "music_generator_keyscale": params["keyscale"],
        "music_generator_timesignature": params["timesignature"],
        "music_generator_temperature": params["temperature"],
        "music_generator_cfg_scale": params["cfg_scale"],
        "music_generator_top_p": params["top_p"],
        "music_generator_seed_used": params["seed"],
        "music_generator_billing_mode": "evolution_xl_base",
        "ugs_workflow": normalized_input.get("ugs_workflow", "v2_base"),
        "ace_workflow": normalized_input.get("ace_workflow", normalized_input.get("ugs_workflow", "v2_base")),
        "music_generator_workflow_file": normalized_input.get("workflow_file"),
        "music_generator_model_scope": normalized_input.get("model_scope"),
        "music_evolution_run_id": run_id,
        "music_evolution_version": MUSIC_EVOLUTION_VERSION,
        "music_evolution_mood": normalized_input["mood"],
        "music_evolution_meaning_tags": normalized_input["meaning_tags"],
        "music_evolution_soloist": normalized_input.get("soloist"),
        "music_evolution_corpus_ids": [
            str(item.get("content_id") or item.get("source_key"))
            for item in (corpus.get("items") or [])
            if isinstance(item, dict)
        ],
        "music_evolution_brief": brief,
        "music_evolution_song_recipe": brief,
    }
    metadata.update(xl_obs_meta or {})
    return metadata


_BRIEF_JSON_FIELDS: tuple[tuple[str, str | None], ...] = (
    ("angle", "story_arc"),
    ("story_arc", "avoid"),
    ("hook_idea", "production_hint"),
    ("production_hint", None),
)


def fallback_brief(normalized_input: dict[str, Any], corpus_snapshot: dict[str, Any]) -> dict[str, Any]:
    """Safe brief if the LLM returns non-JSON or empty text."""
    meaning = _meaning_labels(list(normalized_input.get("meaning_tags") or []))
    theme = str(normalized_input.get("theme") or "главный образ").strip()
    return {
        "angle": f"{theme} — {meaning}",
        "story_arc": "конкретная ситуация -> внутренний поворот -> ясный финальный образ",
        "avoid": ["пустые клише", "служебные production-фразы в lyrics", "копирование прошлых рецептов"],
        "hook_idea": theme[:120],
        "production_hint": f"{normalized_input.get('genre')} / {normalized_input.get('mood')}",
        "corpus_selected_count": corpus_snapshot.get("selected_count", 0),
    }


def _strip_brief_markdown_fence(text_raw: str) -> str:
    if not text_raw.startswith("```"):
        return text_raw
    text_raw = re.sub(r"^```(?:json)?\s*", "", text_raw, flags=re.I).strip()
    return re.sub(r"\s*```$", "", text_raw).strip()


def _extract_brief_string_field(raw: str, field: str, next_field: str | None) -> str | None:
    if next_field:
        pattern = rf'"{re.escape(field)}"\s*:\s*"(.*)"\s*,\s*"{re.escape(next_field)}"\s*:'
    else:
        pattern = rf'"{re.escape(field)}"\s*:\s*"(.*)"\s*\}}\s*$'
    match = re.search(pattern, raw, flags=re.S)
    if not match:
        return None
    return match.group(1).replace('\\"', '"').strip()


def _extract_brief_avoid_list(raw: str) -> list[str] | None:
    match = re.search(r'"avoid"\s*:\s*(\[[\s\S]*?\])\s*,\s*"hook_idea"\s*:', raw)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(1))
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, list):
        return None
    return [str(item).strip() for item in parsed if str(item).strip()]


def _parse_brief_relaxed_json(text_raw: str) -> dict[str, Any] | None:
    """Recover brief fields when the model emits JSON with unescaped inner quotes."""
    blob = text_raw.strip()
    if not blob.startswith("{"):
        start = blob.find("{")
        if start < 0:
            return None
        blob = blob[start:]
    end = blob.rfind("}")
    if end < 0:
        return None
    blob = blob[: end + 1]

    out: dict[str, Any] = {}
    for field, next_field in _BRIEF_JSON_FIELDS:
        value = _extract_brief_string_field(blob, field, next_field)
        if value:
            out[field] = value
    avoid = _extract_brief_avoid_list(blob)
    if avoid:
        out["avoid"] = avoid
    return out or None


def parse_brief_text(raw: str, normalized_input: dict[str, Any], corpus_snapshot: dict[str, Any]) -> dict[str, Any]:
    """Parse compact JSON brief with deterministic fallback."""
    text_raw = _strip_brief_markdown_fence((raw or "").strip())
    parsed: dict[str, Any] | None = None
    if text_raw:
        try:
            candidate = json.loads(text_raw)
            if isinstance(candidate, dict):
                parsed = candidate
        except json.JSONDecodeError:
            parsed = _parse_brief_relaxed_json(text_raw)
    if not isinstance(parsed, dict):
        return fallback_brief(normalized_input, corpus_snapshot)
    out = fallback_brief(normalized_input, corpus_snapshot)
    out.update({k: v for k, v in parsed.items() if isinstance(k, str) or k == "avoid"})
    if isinstance(parsed.get("avoid"), list):
        out["avoid"] = [str(item).strip() for item in parsed["avoid"] if str(item).strip()]
    return out


def _text_from_ugs_result(ugs_result: dict[str, Any]) -> str:
    block = ugs_result.get("result") or {}
    if isinstance(block, dict):
        if isinstance(block.get("result"), dict):
            inner = block["result"]
            return str(inner.get("text") or inner.get("content") or inner.get("response") or "").strip()
        return str(block.get("text") or block.get("content") or block.get("response") or "").strip()
    return ""


def _plain_text_from_ugs_llm_result(ugs_result: dict[str, Any]) -> str:
    """Strip Gemma ``<|channel>thought`` wrappers before lyrics/tags/brief parsing."""
    from api.utils.llm_json_extract import strip_llm_thinking_prefix

    return strip_llm_thinking_prefix(_text_from_ugs_result(ugs_result))


def _unwrap_audio_block(ugs_result: dict[str, Any]) -> dict[str, Any]:
    block = ugs_result.get("result") or {}
    if isinstance(block, dict) and "audio" not in block and isinstance(block.get("result"), dict):
        inner = block.get("result")
        if isinstance(inner, dict) and "audio" in inner:
            return inner
    return block if isinstance(block, dict) else {}


def _safe_mp3_filename(name: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9а-яА-ЯёЁ._ -]+", "_", (name or "music-evolution").strip()).strip(" ._-")
    return f"{(stem or 'music-evolution')[:80]}.mp3"


async def _probe_mp3_duration_seconds(audio_bytes: bytes) -> float | None:
    """Read actual MP3 duration via ffprobe; used to align metadata with rendered audio."""
    if not audio_bytes:
        return None
    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = Path(tmp.name)
        proc = await asyncio.create_subprocess_exec(
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(tmp_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        if proc.returncode != 0:
            return None
        value = float((stdout or b"").decode("utf-8").strip() or 0)
        return value if value > 0 else None
    except OSError, ValueError, TypeError:
        return None
    finally:
        if tmp_path is not None:
            with contextlib.suppress(OSError):
                tmp_path.unlink()


def _clamp_evolution_duration_seconds(
    value: float | int | None,
    *,
    fallback: int = EVOLUTION_AUTO_DURATION_DEFAULT,
) -> int:
    try:
        seconds = int(round(float(value if value is not None else fallback)))
    except TypeError, ValueError:
        seconds = fallback
    return max(30, min(EVOLUTION_AUTO_DURATION_MAX, seconds))


def _corpus_median_duration_seconds(corpus_snapshot: dict[str, Any] | None) -> int | None:
    if not isinstance(corpus_snapshot, dict):
        return None
    summary = corpus_snapshot.get("quality_summary")
    if not isinstance(summary, dict):
        return None
    raw = summary.get("median_duration_seconds")
    if raw is None:
        return None
    try:
        value = int(round(float(raw)))
    except TypeError, ValueError:
        return None
    if value < EVOLUTION_AUTO_DURATION_MIN:
        return None
    return _clamp_evolution_duration_seconds(value)


def estimate_evolution_duration_from_lyrics(*, lyrics: str, bpm: int, language: str) -> int:
    """Estimate XL Base render length from sung lines, sections and tempo."""
    sung_lines, _ = count_sung_content_lines(lyrics, language=language)
    if sung_lines <= 0:
        return EVOLUTION_AUTO_DURATION_DEFAULT
    section_count = count_lyrics_section_headers(lyrics)
    tempo = max(60, min(220, int(bpm)))
    beats_per_line = 8.5
    intro_outro_pad = 18
    section_pad_seconds = max(0, section_count - 1) * 8
    seconds = sung_lines * beats_per_line * 60.0 / tempo
    seconds = seconds * 1.32 + section_pad_seconds + intro_outro_pad
    estimated = _clamp_evolution_duration_seconds(seconds)
    return max(EVOLUTION_AUTO_DURATION_MIN, estimated)


def resolve_evolution_render_duration_seconds(
    *,
    normalized_input: dict[str, Any],
    params: dict[str, Any],
    lyrics: str,
    corpus_snapshot: dict[str, Any] | None = None,
) -> int:
    """Pick Comfy render duration: user baseline is the cap for golden soloist lanes."""
    from api.services.music_evolution_soloists import is_soloist_anchor

    baseline = int(
        params.get("duration_seconds") or normalized_input.get("duration_seconds") or EVOLUTION_AUTO_DURATION_DEFAULT
    )
    baseline = _clamp_evolution_duration_seconds(baseline)
    estimated = estimate_evolution_duration_from_lyrics(
        lyrics=lyrics,
        bpm=int(params["bpm"]),
        language=str(normalized_input.get("language") or "ru"),
    )
    corpus_target = _corpus_median_duration_seconds(corpus_snapshot)
    soloist_locked = bool(normalized_input.get("vocal_locked")) or is_soloist_anchor(
        str(normalized_input.get("soloist") or "")
    )
    if soloist_locked:
        # Golden XL Base corridors were validated ~118–195s; longer renders drift and sound mushy.
        target = baseline
    else:
        target = max(baseline, estimated)
        if corpus_target is not None:
            target = max(target, min(corpus_target, EVOLUTION_AUTO_DURATION_MAX))
    target = max(EVOLUTION_AUTO_DURATION_MIN, min(EVOLUTION_AUTO_DURATION_MAX, target))
    logger.info(
        "[music_evolution] render_duration baseline=%s estimated=%s corpus=%s soloist_locked=%s target=%s",
        baseline,
        estimated,
        corpus_target,
        soloist_locked,
        target,
    )
    return target


def normalize_evolution_style_tags_raw(tags: str, *, vocal: str, genre: str) -> str:
    """Strip UI-only tokens (``auto``) before Comfy tag finalize."""
    resolved_vocal = "female" if (vocal or "auto").strip().lower() == "auto" else (vocal or "female").strip().lower()
    genre_key = (genre or "pop").strip().lower() or "pop"
    text = re.sub(r"\bauto\b", resolved_vocal, (tags or "").strip(), flags=re.I)
    if genre_key and genre_key not in {part.strip().lower() for part in text.split(",")}:
        if re.match(r"^\s*\d+\s*,", text):
            parts = text.split(",", 1)
            text = f"{parts[0]},{genre_key},{parts[1].lstrip()}" if len(parts) == 2 else f"{text},{genre_key}"
        else:
            text = f"{genre_key},{resolved_vocal},{text}" if text else f"{genre_key},{resolved_vocal}"
    return text


def soften_evolution_audio_tags(tags: str, *, genre: str, mood: str) -> str:
    """Replace harsh distortion tags that often cause ACE vocal grind/artifacts."""
    genre_key = (genre or "pop").strip().lower()
    if genre_key in EVOLUTION_AGGRESSIVE_GENRES:
        return tags
    text = tags or ""
    for pattern, replacement in _HARSH_TAG_REPLACEMENTS:
        text = pattern.sub(replacement, text)
    if "clear vocal" not in text.lower():
        text = f"{text}, clear vocal, natural articulation".strip(", ")
    return text


def _maybe_save_liked_recipe_json(*, user_id: str, content_id: UUID, payload: dict[str, Any]) -> None:
    if not _MUSIC_GENERATOR_LIKED_RECIPES_DIR:
        return
    try:
        root = Path(_MUSIC_GENERATOR_LIKED_RECIPES_DIR).expanduser()
        safe_uid = re.sub(r"[^a-zA-Z0-9_-]+", "_", (user_id or "anon")[:64]).strip("_") or "anon"
        subdir = root / "liked-recipes" / safe_uid
        subdir.mkdir(parents=True, exist_ok=True)
        (subdir / f"{content_id}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str) + "\n",
            encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("music_evolution: liked recipe save failed (IO): %s", exc)
    except Exception:
        logger.warning("music_evolution: liked recipe save failed", exc_info=True)


def _json_param(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _dt(value: Any) -> datetime | None:
    return value if isinstance(value, datetime) else None


def _uuid(value: Any) -> UUID | None:
    if value is None:
        return None
    try:
        return value if isinstance(value, UUID) else UUID(str(value))
    except TypeError, ValueError:
        return None


def music_evolution_stale_reap_after_seconds() -> int:
    """Return configured stale timeout for orphan Music Evolution runs."""
    raw = os.environ.get("MUSIC_EVOLUTION_STALE_REAP_AFTER_SECONDS", "").strip()
    if not raw:
        return MUSIC_EVOLUTION_STALE_REAPER_DEFAULT_SECONDS
    try:
        value = int(raw)
    except ValueError:
        return MUSIC_EVOLUTION_STALE_REAPER_DEFAULT_SECONDS
    return max(300, min(86_400, value))


def _extract_ugs_request_id(ugs_result: dict[str, Any]) -> UUID | None:
    """Extract a usable UGS request UUID from direct or nested response metadata."""
    candidates: list[Any] = [
        ugs_result.get("request_id"),
        ugs_result.get("id"),
    ]
    metadata = ugs_result.get("metadata")
    if isinstance(metadata, dict):
        candidates.extend((metadata.get("request_id"), metadata.get("generation_request_id")))
        lifecycle = metadata.get("lifecycle")
        if isinstance(lifecycle, dict):
            candidates.extend((lifecycle.get("request_id"), lifecycle.get("generation_request_id")))
    result = ugs_result.get("result")
    if isinstance(result, dict):
        candidates.extend((result.get("request_id"), result.get("generation_request_id")))
    for candidate in candidates:
        parsed = _uuid(candidate)
        if parsed is not None:
            return parsed
    return None


def run_out_from_rows(run: dict[str, Any], steps: list[dict[str, Any]]) -> MusicEvolutionRunOut:
    """Convert raw SQL rows to API response."""
    normalized_input = run.get("normalized_input") or {}
    soloist = normalized_input.get("soloist") if isinstance(normalized_input, dict) else None
    return MusicEvolutionRunOut(
        id=UUID(str(run["id"])),
        status=run["status"],
        theme=run["theme"],
        soloist=str(soloist) if soloist else None,
        vocal=run["vocal"],
        genre=run["genre"],
        language=run["language"],
        mood=run["mood"],
        meaning_tags=list(run.get("meaning_tags") or []),
        extra_context=run.get("extra_context"),
        duration_seconds=int(run["duration_seconds"]),
        progress_current=int(run.get("progress_current") or 0),
        progress_total=int(run.get("progress_total") or MUSIC_EVOLUTION_TOTAL_STEPS),
        normalized_input=run.get("normalized_input") or {},
        corpus_snapshot=run.get("corpus_snapshot") or {},
        creative_brief=run.get("creative_brief") or {},
        final_params=run.get("final_params") or {},
        result_payload=run.get("result_payload") or {},
        error_payload=run.get("error_payload") or {},
        content_id=_uuid(run.get("content_id")),
        ugs_request_id=_uuid(run.get("ugs_request_id")),
        started_at=_dt(run.get("started_at")),
        completed_at=_dt(run.get("completed_at")),
        cancelled_at=_dt(run.get("cancelled_at")),
        created_at=run["created_at"],
        updated_at=run["updated_at"],
        steps=[
            MusicEvolutionStepOut(
                id=_uuid(step.get("id")),
                step_index=int(step["step_index"]),
                step_kind=step["step_kind"],
                title=step["title"],
                status=step["status"],
                input_payload=step.get("input_payload") or {},
                output_payload=step.get("output_payload") or {},
                error_payload=step.get("error_payload") or {},
                started_at=_dt(step.get("started_at")),
                completed_at=_dt(step.get("completed_at")),
                duration_ms=step.get("duration_ms"),
            )
            for step in steps
        ],
    )


class MusicEvolutionPipelineService:
    """Durable SQL-backed Music Evolution pipeline service."""

    def __init__(
        self,
        db: AsyncSession,
        *,
        ugs: UnifiedGenerationService | None = None,
        content_service: Any | None = None,
    ) -> None:
        self.db = db
        self.ugs = ugs
        self.content_service = content_service

    async def create_run(self, *, user_id: str, body: MusicEvolutionRunCreate) -> MusicEvolutionRunCreateResult:
        normalized = normalize_music_evolution_input(body)
        params = {
            "user_id": user_id,
            "theme": normalized["theme"],
            "vocal": normalized["vocal"],
            "genre": normalized["genre"],
            "language": normalized["language"],
            "mood": normalized["mood"],
            "meaning_tags": _json_param(normalized["meaning_tags"]),
            "extra_context": normalized["extra_context"] or None,
            "duration_seconds": normalized["duration_seconds"],
            "normalized_input": _json_param(normalized),
            "idempotency_key": body.idempotency_key,
        }
        if body.idempotency_key:
            row = (
                (
                    await self.db.execute(
                        text(
                            """
                        INSERT INTO music_evolution_runs
                        (user_id, theme, vocal, genre, language, mood, meaning_tags, extra_context,
                         duration_seconds, normalized_input, idempotency_key)
                        VALUES
                        (CAST(:user_id AS uuid), :theme, :vocal, :genre, :language, :mood,
                         CAST(:meaning_tags AS jsonb), :extra_context, :duration_seconds,
                         CAST(:normalized_input AS jsonb), :idempotency_key)
                        ON CONFLICT (user_id, idempotency_key)
                            WHERE idempotency_key IS NOT NULL AND btrim(idempotency_key) <> ''
                        DO UPDATE SET updated_at = music_evolution_runs.updated_at
                        RETURNING id, status, (xmax = 0) AS created
                        """
                        ),
                        params,
                    )
                )
                .mappings()
                .first()
            )
        else:
            row = (
                (
                    await self.db.execute(
                        text(
                            """
                        INSERT INTO music_evolution_runs
                        (user_id, theme, vocal, genre, language, mood, meaning_tags, extra_context,
                         duration_seconds, normalized_input)
                        VALUES
                        (CAST(:user_id AS uuid), :theme, :vocal, :genre, :language, :mood,
                         CAST(:meaning_tags AS jsonb), :extra_context, :duration_seconds,
                         CAST(:normalized_input AS jsonb))
                        RETURNING id, status, TRUE AS created
                        """
                        ),
                        params,
                    )
                )
                .mappings()
                .first()
            )
        if row is None:
            raise RuntimeError("music evolution run insert returned no id")
        run_id = UUID(str(row["id"]))
        await self._ensure_steps(run_id)
        await self.db.commit()
        return MusicEvolutionRunCreateResult(
            run_id=run_id,
            status=str(row.get("status") or "queued"),
            created=bool(row.get("created")),
        )

    async def _ensure_steps(self, run_id: UUID) -> None:
        for idx, kind, title in STEP_DEFS:
            await self.db.execute(
                text(
                    """
                    INSERT INTO music_evolution_run_steps (run_id, step_index, step_kind, title)
                    VALUES (CAST(:run_id AS uuid), :step_index, :step_kind, :title)
                    ON CONFLICT (run_id, step_index) DO NOTHING
                    """
                ),
                {"run_id": str(run_id), "step_index": idx, "step_kind": kind, "title": title},
            )

    async def fetch_run(self, *, run_id: str, user_id: str) -> MusicEvolutionRunOut:
        run = (
            (
                await self.db.execute(
                    text(
                        """
                    SELECT *
                    FROM music_evolution_runs
                    WHERE id = CAST(:run_id AS uuid)
                      AND user_id = CAST(:user_id AS uuid)
                    """
                    ),
                    {"run_id": run_id, "user_id": user_id},
                )
            )
            .mappings()
            .first()
        )
        if run is None:
            raise HTTPException(status_code=404, detail="music evolution run not found")
        steps = (
            (
                await self.db.execute(
                    text(
                        """
                    SELECT *
                    FROM music_evolution_run_steps
                    WHERE run_id = CAST(:run_id AS uuid)
                    ORDER BY step_index ASC
                    """
                    ),
                    {"run_id": run_id},
                )
            )
            .mappings()
            .all()
        )
        return run_out_from_rows(dict(run), [dict(step) for step in steps])

    async def cancel_run(self, *, run_id: str, user_id: str) -> MusicEvolutionRunOut:
        ugs_request_id = await self._find_latest_ugs_request_id_for_run(run_id=run_id, active_only=True)
        if ugs_request_id is not None:
            await self._persist_ugs_request_id(run_id=run_id, ugs_request_id=str(ugs_request_id))
            await self._cancel_ugs_request(ugs_request_id=str(ugs_request_id), user_id=user_id)
        await self.db.execute(
            text(
                """
                UPDATE music_evolution_runs
                SET status = CASE WHEN status IN ('completed', 'failed') THEN status ELSE 'cancelled' END,
                    cancelled_at = CASE WHEN status IN ('completed', 'failed') THEN cancelled_at ELSE NOW() END,
                    updated_at = NOW()
                WHERE id = CAST(:run_id AS uuid)
                  AND user_id = CAST(:user_id AS uuid)
                """
            ),
            {"run_id": run_id, "user_id": user_id},
        )
        await self._cancel_incomplete_steps(run_id=run_id, reason="cancelled_by_user")
        await self.db.commit()
        return await self.fetch_run(run_id=run_id, user_id=user_id)

    async def _find_latest_ugs_request_id_for_run(self, *, run_id: str, active_only: bool = False) -> UUID | None:
        clauses = [
            "gr.deleted_at IS NULL",
            "(gr.input_data->>'music_evolution_run_id' = :run_id OR gr.request_metadata->>'music_evolution_run_id' = :run_id)",
        ]
        if active_only:
            clauses.append("gr.status NOT IN ('completed', 'failed', 'cancelled')")
        result = await self.db.execute(
            text(
                f"""
                SELECT gr.id
                FROM generation_requests gr
                JOIN generation_types gt ON gt.id = gr.type_id
                WHERE {" AND ".join(clauses)}
                  AND gt.type_key = 'music_generator_evolution_xl_base'
                ORDER BY gr.created_at DESC
                LIMIT 1
                """
            ),
            {"run_id": run_id},
        )
        row = result.mappings().first()
        return _uuid(row.get("id")) if row is not None else None

    async def _persist_ugs_request_id(self, *, run_id: str, ugs_request_id: str | UUID | None) -> None:
        parsed = _uuid(ugs_request_id)
        if parsed is None:
            return
        await self.db.execute(
            text(
                """
                UPDATE music_evolution_runs
                SET ugs_request_id = CAST(:ugs_request_id AS uuid),
                    updated_at = NOW()
                WHERE id = CAST(:run_id AS uuid)
                  AND ugs_request_id IS DISTINCT FROM CAST(:ugs_request_id AS uuid)
                """
            ),
            {"run_id": run_id, "ugs_request_id": str(parsed)},
        )
        await self.db.commit()

    async def _cancel_ugs_request(self, *, ugs_request_id: str, user_id: str) -> None:
        owns_ugs = self.ugs is None
        ugs = self.ugs or UnifiedGenerationService(self.db)
        try:
            await ugs.cancel_generation(ugs_request_id, user_id=user_id)
        except (ValueError, PermissionError) as exc:
            logger.info(
                "Music Evolution UGS cancel skipped run user_id=%s request_id=%s err=%s",
                user_id,
                ugs_request_id,
                exc,
            )
        except Exception:
            logger.exception("Music Evolution UGS cancel failed request_id=%s", ugs_request_id)
        finally:
            if owns_ugs:
                await ugs.close()

    async def _cancel_incomplete_steps(self, *, run_id: str, reason: str) -> None:
        await self.db.execute(
            text(
                """
                UPDATE music_evolution_run_steps
                SET status = 'cancelled',
                    error_payload = CAST(:error_payload AS jsonb),
                    completed_at = COALESCE(completed_at, NOW()),
                    updated_at = NOW()
                WHERE run_id = CAST(:run_id AS uuid)
                  AND status NOT IN ('completed', 'failed', 'cancelled', 'skipped')
                """
            ),
            {"run_id": run_id, "error_payload": _json_param({"message": reason})},
        )

    async def _raise_if_cancelled(self, *, run_id: str) -> None:
        result = await self.db.execute(
            text(
                """
                SELECT status
                FROM music_evolution_runs
                WHERE id = CAST(:run_id AS uuid)
                """
            ),
            {"run_id": run_id},
        )
        row = result.mappings().first()
        status = str(row.get("status") or "").strip().lower() if row is not None else ""
        if status == "cancelled":
            raise MusicEvolutionCancelled(f"music_evolution_cancelled:{run_id}")
        if status in {"completed", "failed"}:
            raise MusicEvolutionCancelled(f"music_evolution_terminal:{status}:{run_id}")

    async def _claim_run_for_execution(self, *, run_id: str) -> bool:
        result = await self.db.execute(
            text(
                """
                UPDATE music_evolution_runs
                SET status = 'running',
                    started_at = COALESCE(started_at, NOW()),
                    updated_at = NOW()
                WHERE id = CAST(:run_id AS uuid)
                  AND status = 'queued'
                RETURNING status
                """
            ),
            {"run_id": run_id},
        )
        row = result.mappings().first()
        await self.db.commit()
        return row is not None

    async def _set_run_status(self, run_id: str, status: str, *, error_payload: dict[str, Any] | None = None) -> bool:
        """Update run status; split error vs no-error SQL to avoid nullable jsonb ambiguity."""
        common_set = """
            started_at = COALESCE(started_at, CASE WHEN :status = 'running' THEN NOW() ELSE started_at END),
            completed_at = CASE WHEN :status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
            updated_at = NOW()
        """
        if error_payload is not None:
            result = await self.db.execute(
                text(
                    f"""
                    UPDATE music_evolution_runs
                    SET status = :status,
                        error_payload = CAST(:error_payload AS jsonb),
                        {common_set}
                    WHERE id = CAST(:run_id AS uuid)
                      AND status NOT IN ('completed', 'failed', 'cancelled')
                    RETURNING status
                    """
                ),
                {
                    "run_id": run_id,
                    "status": status,
                    "error_payload": _json_param(error_payload),
                },
            )
        else:
            result = await self.db.execute(
                text(
                    f"""
                    UPDATE music_evolution_runs
                    SET status = :status,
                        {common_set}
                    WHERE id = CAST(:run_id AS uuid)
                      AND status NOT IN ('completed', 'failed', 'cancelled')
                    RETURNING status
                    """
                ),
                {"run_id": run_id, "status": status},
            )
        await self.db.commit()
        return result.mappings().first() is not None

    async def _start_step(self, run_id: str, step_kind: str, input_payload: dict[str, Any] | None = None) -> None:
        await self.db.execute(
            text(
                """
                UPDATE music_evolution_run_steps
                SET status = 'running',
                    input_payload = CAST(:input_payload AS jsonb),
                    started_at = COALESCE(started_at, NOW()),
                    updated_at = NOW()
                WHERE run_id = CAST(:run_id AS uuid)
                  AND step_kind = :step_kind
                  AND status NOT IN ('completed', 'failed', 'cancelled', 'skipped')
                  AND EXISTS (
                      SELECT 1
                      FROM music_evolution_runs r
                      WHERE r.id = CAST(:run_id AS uuid)
                        AND r.status NOT IN ('completed', 'failed', 'cancelled')
                  )
                """
            ),
            {"run_id": run_id, "step_kind": step_kind, "input_payload": _json_param(input_payload or {})},
        )
        await self.db.commit()

    async def _complete_step(self, run_id: str, step_kind: str, output_payload: dict[str, Any] | None = None) -> None:
        row = (
            (
                await self.db.execute(
                    text(
                        """
                    UPDATE music_evolution_run_steps
                    SET status = 'completed',
                        output_payload = CAST(:output_payload AS jsonb),
                        completed_at = NOW(),
                        duration_ms = CASE
                            WHEN started_at IS NULL THEN NULL
                            ELSE GREATEST(0, CAST(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 AS integer))
                        END,
                        updated_at = NOW()
                    WHERE run_id = CAST(:run_id AS uuid)
                      AND step_kind = :step_kind
                      AND status NOT IN ('failed', 'cancelled', 'skipped')
                      AND EXISTS (
                          SELECT 1
                          FROM music_evolution_runs r
                          WHERE r.id = CAST(:run_id AS uuid)
                            AND r.status NOT IN ('completed', 'failed', 'cancelled')
                      )
                    RETURNING step_index
                    """
                    ),
                    {"run_id": run_id, "step_kind": step_kind, "output_payload": _json_param(output_payload or {})},
                )
            )
            .mappings()
            .first()
        )
        if row:
            await self.db.execute(
                text(
                    """
                    UPDATE music_evolution_runs
                    SET progress_current = GREATEST(progress_current, :step_index),
                        updated_at = NOW()
                    WHERE id = CAST(:run_id AS uuid)
                      AND status NOT IN ('completed', 'failed', 'cancelled')
                    """
                ),
                {"run_id": run_id, "step_index": int(row["step_index"])},
            )
        await self.db.commit()

    async def _fail_step(self, run_id: str, step_kind: str, error_payload: dict[str, Any]) -> None:
        await self.db.execute(
            text(
                """
                UPDATE music_evolution_run_steps
                SET status = 'failed',
                    error_payload = CAST(:error_payload AS jsonb),
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE run_id = CAST(:run_id AS uuid)
                  AND step_kind = :step_kind
                  AND status NOT IN ('completed', 'failed', 'cancelled', 'skipped')
                  AND EXISTS (
                      SELECT 1
                      FROM music_evolution_runs r
                      WHERE r.id = CAST(:run_id AS uuid)
                        AND r.status NOT IN ('completed', 'failed', 'cancelled')
                  )
                """
            ),
            {"run_id": run_id, "step_kind": step_kind, "error_payload": _json_param(error_payload)},
        )
        await self.db.commit()

    async def run_pipeline(self, *, run_id: str, user_id: str) -> None:
        """Run all backend steps for one Music Evolution generation."""
        if self.ugs is None or self.content_service is None:
            raise RuntimeError("MusicEvolutionPipelineService requires UGS and ContentStorageService to run pipeline")
        current_step = "intake_normalize"
        try:
            if not await self._claim_run_for_execution(run_id=run_id):
                logger.info("Music Evolution pipeline skipped unclaimable run_id=%s", run_id)
                return
            run = await self.fetch_run(run_id=run_id, user_id=user_id)
            normalized = _apply_evolution_vocal_context(dict(run.normalized_input), run_id=run_id)

            await self._start_step(run_id, "intake_normalize", normalized)
            await self._complete_step(run_id, "intake_normalize", {"normalized_input": normalized})
            await self._raise_if_cancelled(run_id=run_id)

            current_step = "experience_retrieval"
            await self._start_step(run_id, current_step, {"scope": "user"})
            corpus = await collect_music_evolution_corpus(self.db, user_id=user_id, normalized_input=normalized)
            await self.db.execute(
                text(
                    """
                    UPDATE music_evolution_runs
                    SET corpus_snapshot = CAST(:corpus AS jsonb), updated_at = NOW()
                    WHERE id = CAST(:run_id AS uuid)
                    """
                ),
                {"run_id": run_id, "corpus": _json_param(corpus)},
            )
            await self._complete_step(run_id, current_step, corpus)
            await self._raise_if_cancelled(run_id=run_id)

            current_step = "creative_brief"
            await self._start_step(run_id, current_step)
            await self._raise_if_cancelled(run_id=run_id)
            brief_input = {
                "messages": build_song_recipe_messages(normalized, corpus),
                "options": {"temperature": 0.55},
                "json_format": True,
            }
            save_music_evolution_ugs_payload(
                run_id=run_id,
                step=current_step,
                type_key="music_generator_evolution_brief",
                input_data=brief_input,
                user_id=user_id,
            )
            brief_resp = await run_studio_ugs_generate(
                self.ugs,
                user_id=user_id,
                type_key="music_generator_evolution_brief",
                input_data=brief_input,
            )
            await self._raise_if_cancelled(run_id=run_id)
            brief = parse_song_recipe_text(_plain_text_from_ugs_llm_result(brief_resp), normalized, corpus)
            await self.db.execute(
                text(
                    """
                    UPDATE music_evolution_runs
                    SET creative_brief = CAST(:brief AS jsonb), updated_at = NOW()
                    WHERE id = CAST(:run_id AS uuid)
                    """
                ),
                {"run_id": run_id, "brief": _json_param(brief)},
            )
            await self._complete_step(run_id, current_step, brief)
            await self._raise_if_cancelled(run_id=run_id)

            current_step = "lyrics_generation"
            await self._start_step(run_id, current_step)
            soloist_id = str(normalized.get("soloist") or "ray").strip().lower()
            theme_text = str(normalized.get("theme") or "")
            lyrics_messages = build_lyrics_messages(normalized, brief, corpus_snapshot=corpus)
            lyrics_temperature = 0.76 if soloist_id == "nebula" else 0.85
            await self._raise_if_cancelled(run_id=run_id)
            lyrics_input = {"messages": lyrics_messages, "options": {"temperature": lyrics_temperature}}
            save_music_evolution_ugs_payload(
                run_id=run_id,
                step=current_step,
                type_key="music_generator_evolution_lyrics",
                input_data=lyrics_input,
                user_id=user_id,
            )
            lyrics_resp = await run_studio_ugs_generate(
                self.ugs,
                user_id=user_id,
                type_key="music_generator_evolution_lyrics",
                input_data=lyrics_input,
            )
            await self._raise_if_cancelled(run_id=run_id)
            lyrics = _plain_text_from_ugs_llm_result(lyrics_resp)
            if not lyrics:
                raise ValueError("music_evolution_empty_lyrics")
            lyrics = sanitize_lyrics_ai_output(lyrics)
            lyrics = strip_music_stack_leaks_from_lyrics(lyrics)
            preview_params = music_evolution_production_params(normalized)
            vocal_eff = str(normalized.get("vocal_effective") or preview_params.get("vocal_effective") or "female")
            if is_soloist_anchor(soloist_id):
                lyrics = enrich_evolution_lyrics_with_voice_lines(
                    lyrics,
                    soloist_id=soloist_id,
                    vocal=vocal_eff,
                    seed=int(normalized.get("_vocal_stable_seed") or 0),
                    bpm=int(preview_params["bpm"]),
                )
            await self._complete_step(run_id, current_step, {"lyrics_preview": lyrics[:600], "chars": len(lyrics)})
            await self._raise_if_cancelled(run_id=run_id)

            current_step = "lyrics_quality_gate"
            await self._start_step(run_id, current_step)
            await self._raise_if_cancelled(run_id=run_id)
            language = str(normalized["language"])
            lyrics = strip_music_stack_leaks_from_lyrics(lyrics)
            lyrics = polish_evolution_lyrics(
                lyrics,
                vocal_effective=vocal_eff,
                language=language,
                soloist_id=soloist_id,
            )
            substance_errors = validate_music_evolution_lyrics_substance(
                lyrics,
                language=language,
                soloist_id=soloist_id,
                theme=theme_text,
            )
            recipe_errors = validate_lyrics_against_song_recipe(lyrics, brief)
            errors = [*substance_errors, *recipe_errors]
            if errors and (evolution_lyrics_errors_retryable(substance_errors) or recipe_errors):
                substance_codes = {str(error.get("code") or "") for error in substance_errors}
                xl_retry = (
                    xl_base_lyrics_retry_user_message(substance_errors)
                    if substance_errors and any(not code.startswith("lyrics_atya_") for code in substance_codes)
                    else ""
                )
                evolution_retry = evolution_lyrics_retry_user_message(substance_errors) if substance_errors else ""
                retry_messages = list(lyrics_messages)
                retry_messages.append(
                    {
                        "role": "user",
                        "content": "\n".join(
                            part
                            for part in (
                                xl_retry,
                                evolution_retry,
                                song_recipe_retry_user_message(brief, recipe_errors) if recipe_errors else "",
                            )
                            if part
                        ),
                    }
                )
                await self._raise_if_cancelled(run_id=run_id)
                lyrics_retry_input = {
                    "messages": retry_messages,
                    "options": {"temperature": lyrics_temperature},
                }
                save_music_evolution_ugs_payload(
                    run_id=run_id,
                    step=f"{current_step}_retry",
                    type_key="music_generator_evolution_lyrics",
                    input_data=lyrics_retry_input,
                    user_id=user_id,
                )
                lyrics_resp = await run_studio_ugs_generate(
                    self.ugs,
                    user_id=user_id,
                    type_key="music_generator_evolution_lyrics",
                    input_data=lyrics_retry_input,
                )
                await self._raise_if_cancelled(run_id=run_id)
                lyrics = _plain_text_from_ugs_llm_result(lyrics_resp)
                if not lyrics:
                    raise ValueError("music_evolution_empty_lyrics_retry")
                lyrics = sanitize_lyrics_ai_output(lyrics)
                lyrics = strip_music_stack_leaks_from_lyrics(lyrics)
                if is_soloist_anchor(soloist_id):
                    lyrics = enrich_evolution_lyrics_with_voice_lines(
                        lyrics,
                        soloist_id=soloist_id,
                        vocal=vocal_eff,
                        seed=int(normalized.get("_vocal_stable_seed") or 0),
                        bpm=int(preview_params["bpm"]),
                    )
                lyrics = polish_evolution_lyrics(
                    lyrics,
                    vocal_effective=vocal_eff,
                    language=language,
                    soloist_id=soloist_id,
                )
                substance_errors = validate_music_evolution_lyrics_substance(
                    lyrics,
                    language=language,
                    soloist_id=soloist_id,
                    theme=theme_text,
                )
                recipe_errors = validate_lyrics_against_song_recipe(lyrics, brief)
                errors = [*substance_errors, *recipe_errors]
            lyrics = prepare_xl_base_lyrics_for_comfy(lyrics, language=language)
            if is_soloist_anchor(soloist_id):
                lyrics = enrich_evolution_lyrics_with_voice_lines(
                    lyrics,
                    soloist_id=soloist_id,
                    vocal=vocal_eff,
                    seed=int(normalized.get("_vocal_stable_seed") or 0),
                    bpm=int(preview_params["bpm"]),
                    structure_prepare=False,
                )
            if errors:
                raise ValueError(f"music_evolution_xl_base_lyrics_invalid: {errors[0].get('code')}")
            await self._complete_step(run_id, current_step, {"ok": True})
            await self._raise_if_cancelled(run_id=run_id)

            current_step = "production_params"
            await self._start_step(run_id, current_step)
            await self._raise_if_cancelled(run_id=run_id)
            params = music_evolution_production_params(normalized)
            render_duration = resolve_evolution_render_duration_seconds(
                normalized_input=normalized,
                params=params,
                lyrics=lyrics,
                corpus_snapshot=corpus,
            )
            params["duration_seconds"] = render_duration
            raw_style_plan = brief.get("style_plan")
            style_plan = dict(raw_style_plan) if isinstance(raw_style_plan, dict) else {}
            style_plan.update({"bpm": int(params["bpm"]), "keyscale": str(params["keyscale"])})
            brief = {**brief, "style_plan": style_plan}
            await self._complete_step(run_id, current_step, params)
            await self._raise_if_cancelled(run_id=run_id)

            current_step = "style_tags_generation"
            await self._start_step(run_id, current_step)
            await self._raise_if_cancelled(run_id=run_id)
            style_input = {
                "messages": build_style_messages(normalized, brief, lyrics, int(params["bpm"])),
                "options": {"temperature": 0.75},
            }
            save_music_evolution_ugs_payload(
                run_id=run_id,
                step=current_step,
                type_key="music_generator_evolution_style",
                input_data=style_input,
                user_id=user_id,
            )
            style_resp = await run_studio_ugs_generate(
                self.ugs,
                user_id=user_id,
                type_key="music_generator_evolution_style",
                input_data=style_input,
            )
            await self._raise_if_cancelled(run_id=run_id)
            tags = _plain_text_from_ugs_llm_result(style_resp)
            if not tags:
                raise ValueError("music_evolution_empty_tags")
            tags = normalize_evolution_style_tags_raw(
                tags,
                vocal=str(normalized.get("vocal_effective") or normalized["vocal"]),
                genre=str(normalized["genre"]),
            )
            tags = soften_evolution_audio_tags(
                tags,
                genre=str(normalized["genre"]),
                mood=str(normalized["mood"]),
            )
            vocal_eff = str(params.get("vocal_effective") or normalized.get("vocal_effective") or "female")
            vocal_profile = str(params.get("vocal_tag_profile") or "")

            soloist_id = str(normalized.get("soloist") or "ray").strip().lower()
            if is_soloist_anchor(soloist_id):
                tags = finalize_soloist_evolution_tags(
                    soloist_id,
                    tags,
                    bpm=int(params["bpm"]),
                    vocal=vocal_eff,
                    vocal_profile=vocal_profile,
                )
            elif str(normalized.get("genre") or "").strip().lower() == "luna":
                tags = finalize_luna_evolution_tags(
                    tags,
                    bpm=int(params["bpm"]),
                    vocal=vocal_eff,
                    vocal_profile=vocal_profile,
                )
            else:
                tags = enrich_evolution_vocal_tags(
                    tags,
                    vocal=vocal_eff,
                    vocal_profile=vocal_profile,
                    genre=str(normalized["genre"]),
                )
            await self._complete_step(run_id, current_step, {"tags_preview": tags[:600], "chars": len(tags)})
            await self._raise_if_cancelled(run_id=run_id)

            current_step = "xl_base_finalize"
            await self._start_step(run_id, current_step)
            await self._raise_if_cancelled(run_id=run_id)
            tags = prepare_xl_base_tags_for_comfy(
                tags,
                style_key=str(normalized["genre"]),
                bpm_hint=int(params["bpm"]),
                ace_workflow="v2_base",
            )
            tags = capitalize_ace_section_tags_in_style(tags)
            tags = sync_evolution_tags_sections_to_lyrics(
                tags,
                lyrics,
                soloist_id=soloist_id,
                bpm=int(params["bpm"]),
            )
            tags = ensure_evolution_vocal_marker(tags, vocal=vocal_eff)
            tag_errors = validate_style_tags_against_song_recipe(tags, brief, normalized, bpm=int(params["bpm"]))
            if tag_errors:
                raise ValueError(f"music_evolution_style_tags_invalid: {tag_errors[0].get('code')}")
            input_data, final_params = build_music_evolution_audio_input_data(
                normalized_input=normalized,
                brief=brief,
                lyrics=lyrics,
                tags=tags,
                params=params,
                run_id=run_id,
            )
            await self.db.execute(
                text(
                    """
                    UPDATE music_evolution_runs
                    SET final_params = CAST(:final_params AS jsonb), updated_at = NOW()
                    WHERE id = CAST(:run_id AS uuid)
                    """
                ),
                {"run_id": run_id, "final_params": _json_param(final_params)},
            )
            await self._complete_step(run_id, current_step, {"xl_base": final_params.get("input_observability", {})})
            await self._raise_if_cancelled(run_id=run_id)

            current_step = "audio_generation"
            await self._start_step(run_id, current_step, {"type_key": "music_generator_evolution_xl_base"})
            await self._raise_if_cancelled(run_id=run_id)
            save_music_evolution_ugs_payload(
                run_id=run_id,
                step=current_step,
                type_key="music_generator_evolution_xl_base",
                input_data=input_data,
                user_id=user_id,
            )
            audio_resp = await run_studio_ugs_generate(
                self.ugs,
                user_id=user_id,
                type_key="music_generator_evolution_xl_base",
                input_data=input_data,
            )
            ugs_request_id = _extract_ugs_request_id(audio_resp) or await self._find_latest_ugs_request_id_for_run(
                run_id=run_id,
                active_only=False,
            )
            await self._persist_ugs_request_id(run_id=run_id, ugs_request_id=ugs_request_id)
            await self._raise_if_cancelled(run_id=run_id)
            block = _unwrap_audio_block(audio_resp)
            audio_list = block.get("audio") or []
            if not audio_list or not isinstance(audio_list[0], dict) or not audio_list[0].get("data"):
                raise ValueError("music_evolution_empty_audio")
            audio_bytes = base64.b64decode(audio_list[0]["data"])
            render_target = int(
                params.get("duration_seconds") or normalized.get("duration_seconds") or EVOLUTION_AUTO_DURATION_DEFAULT
            )
            probed_duration = await _probe_mp3_duration_seconds(audio_bytes)
            probed_clamped = _clamp_evolution_duration_seconds(
                probed_duration,
                fallback=render_target,
            )
            if probed_duration is not None and probed_clamped < render_target * 0.55:
                logger.warning(
                    "[music_evolution] probed_duration=%.2fs << render_target=%ss — "
                    "keeping render_target for metadata (check Comfy seconds/duration nodes)",
                    probed_duration,
                    render_target,
                )
                actual_duration = render_target
            else:
                actual_duration = probed_clamped
            params = {**params, "duration_seconds": actual_duration}
            if probed_duration is not None:
                final_params = {
                    **final_params,
                    "duration_seconds": actual_duration,
                    "probed_duration_seconds": probed_duration,
                }
                await self.db.execute(
                    text(
                        """
                        UPDATE music_evolution_runs
                        SET final_params = CAST(:final_params AS jsonb),
                            duration_seconds = :duration_seconds,
                            updated_at = NOW()
                        WHERE id = CAST(:run_id AS uuid)
                        """
                    ),
                    {
                        "run_id": run_id,
                        "final_params": _json_param(final_params),
                        "duration_seconds": actual_duration,
                    },
                )
            await self._complete_step(
                run_id,
                current_step,
                {
                    "bytes": len(audio_bytes),
                    "probed_duration_seconds": probed_duration,
                    "duration_seconds": actual_duration,
                    "ugs_request_id": str(ugs_request_id) if ugs_request_id else None,
                },
            )
            await self._raise_if_cancelled(run_id=run_id)

            current_step = "content_persist"
            await self._start_step(run_id, current_step)
            await self._raise_if_cancelled(run_id=run_id)
            name = f"{normalized['theme'][:80]} — Music Evolution".strip()
            xl_obs_meta = extract_xl_base_obs_from_ugs_response(audio_resp)
            metadata = build_music_evolution_content_metadata(
                normalized_input=normalized,
                brief=brief,
                corpus=corpus,
                lyrics=lyrics,
                tags=tags,
                params=params,
                run_id=run_id,
                xl_obs_meta=xl_obs_meta,
            )
            if probed_duration is not None:
                metadata["duration"] = probed_duration
            content = await self.content_service.create_content(
                content_data=ContentCreate(
                    user_id=user_id,
                    name=name,
                    description="Аудиотрек, созданный в Music Evolution на XL Base",
                    content_type=ContentType.AUDIO,
                    mime_type="audio/mpeg",
                    sub_type="music_generator",
                    original_filename=_safe_mp3_filename(name),
                    tags=["music_generator", "music_evolution", "xl_base"],
                    visibility=Visibility.PRIVATE,
                    source_service="music_evolution",
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
                ),
                file_data=audio_bytes,
                user_id=user_id,
            )
            await self.db.execute(
                text(
                    """
                    UPDATE music_evolution_runs
                    SET content_id = CAST(:content_id AS uuid),
                        result_payload = CAST(:result_payload AS jsonb),
                        updated_at = NOW()
                    WHERE id = CAST(:run_id AS uuid)
                    """
                ),
                {
                    "run_id": run_id,
                    "content_id": str(content.id),
                    "result_payload": _json_param(
                        {
                            "content_id": str(content.id),
                            "name": content.name or name,
                            "download_url": f"/api/v1/content/{content.id}/download",
                            "duration_seconds": actual_duration,
                            "mime_type": "audio/mpeg",
                        }
                    ),
                },
            )
            await self._complete_step(run_id, current_step, {"content_id": str(content.id)})
            await self._raise_if_cancelled(run_id=run_id)

            current_step = "result_ready"
            await self._start_step(run_id, current_step)
            await self._raise_if_cancelled(run_id=run_id)
            await self._send_notification(
                user_id=user_id,
                run_id=run_id,
                content_id=str(content.id),
                name=content.name or name,
            )
            await self._complete_step(run_id, current_step, {"ready": True, "content_id": str(content.id)})
            await self._raise_if_cancelled(run_id=run_id)
            await self._set_run_status(run_id, "completed")
        except MusicEvolutionCancelled as exc:
            logger.info("Music Evolution pipeline stopped run_id=%s step=%s reason=%s", run_id, current_step, exc)
            try:
                await self.db.rollback()
            except Exception:
                logger.debug("Music Evolution rollback after cancellation failed", exc_info=True)
            try:
                await self._cancel_incomplete_steps(run_id=run_id, reason="pipeline_observed_cancelled")
                await self._set_run_status(run_id, "cancelled")
            except Exception:
                logger.debug("Music Evolution cancelled state persistence skipped", exc_info=True)
        except Exception as exc:
            logger.exception("Music Evolution pipeline failed run_id=%s step=%s: %s", run_id, current_step, exc)
            error = {"stage": current_step, "message": str(exc)[:500]}
            try:
                await self.db.rollback()
            except Exception:
                logger.debug("Music Evolution rollback before failure persist failed", exc_info=True)
            try:
                await self._fail_step(run_id, current_step, error)
                await self._set_run_status(run_id, "failed", error_payload=error)
            except Exception:
                logger.exception(
                    "Music Evolution failed to persist terminal error state run_id=%s step=%s",
                    run_id,
                    current_step,
                )
                try:
                    await self.db.rollback()
                except Exception:
                    logger.debug("Music Evolution rollback after failure persist failed", exc_info=True)

    async def _send_notification(self, *, user_id: str, run_id: str, content_id: str, name: str) -> None:
        try:
            notification_service = get_notification_service()
            await notification_service.send_to_user(
                user_id,
                NotificationCreate(
                    type=NotificationType.SUCCESS,
                    title="Студия песен: трек готов",
                    message=name,
                    priority=NotificationPriority.HIGH,
                    persistent=True,
                    source="music_evolution",
                    metadata={
                        "open_app": {
                            "appComponent": "MusicForgeApp",
                            "musicForgeRunId": run_id,
                            "unifiedContentId": content_id,
                        }
                    },
                ),
            )
        except Exception:
            logger.debug("Music Evolution notification failed for user %s", user_id, exc_info=True)

    async def record_feedback(
        self,
        *,
        run_id: str,
        user_id: str,
        rating: str,
        reason_code: str | None,
        reason_custom: str | None,
    ) -> None:
        run = await self.fetch_run(run_id=run_id, user_id=user_id)
        if run.content_id is None:
            raise HTTPException(status_code=400, detail="run has no generated content")
        if self.content_service is None:
            raise HTTPException(status_code=503, detail="content service unavailable")
        content = await self.content_service.get_content(run.content_id, user_id, check_permissions=True)
        if str(content.user_id) != user_id:
            raise HTTPException(status_code=403, detail="only owner can record feedback")
        if rating == "dislike":
            try:
                reason_custom = validate_dislike_reason(code=reason_code or "", custom=reason_custom)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
        metadata = content.metadata if isinstance(content.metadata, dict) else {}
        snapshot = build_liked_recipe_payload(user_id=user_id, content=content)
        if rating == "like":
            _maybe_save_liked_recipe_json(user_id=user_id, content_id=UUID(str(run.content_id)), payload=snapshot)
        await self.db.execute(
            text(
                """
                INSERT INTO music_evolution_feedback
                (user_id, run_id, content_id, rating, reason_code, reason_custom, recipe_snapshot)
                VALUES
                (CAST(:user_id AS uuid), CAST(:run_id AS uuid), CAST(:content_id AS uuid),
                 :rating, :reason_code, :reason_custom, CAST(:recipe_snapshot AS jsonb))
                ON CONFLICT (user_id, content_id) DO UPDATE SET
                    rating = EXCLUDED.rating,
                    reason_code = EXCLUDED.reason_code,
                    reason_custom = EXCLUDED.reason_custom,
                    recipe_snapshot = EXCLUDED.recipe_snapshot,
                    updated_at = NOW()
                """
            ),
            {
                "user_id": user_id,
                "run_id": run_id,
                "content_id": str(run.content_id),
                "rating": rating,
                "reason_code": reason_code,
                "reason_custom": reason_custom,
                "recipe_snapshot": _json_param(snapshot),
            },
        )
        await upsert_music_evolution_recipe_source(
            self.db,
            source_kind="evolution_feedback",
            source_key=str(run.content_id),
            user_id=user_id,
            content_id=str(run.content_id),
            quality_signal=5 if rating == "like" else -5,
            metadata=metadata,
            feature_payload={
                "mood": metadata.get("music_evolution_mood"),
                "meaning_tags_json": _json_param(metadata.get("music_evolution_meaning_tags") or []),
                "metadata_json": _json_param(metadata),
                "feature_payload_json": _json_param({"run_id": run_id, "rating": rating, "reason_code": reason_code}),
            },
        )
        if rating == "like":
            await upsert_music_evolution_recipe_source(
                self.db,
                source_kind="liked_content",
                source_key=str(run.content_id),
                user_id=user_id,
                content_id=str(run.content_id),
                quality_signal=5,
                metadata=metadata,
                feature_payload={
                    "mood": metadata.get("music_evolution_mood"),
                    "meaning_tags_json": _json_param(metadata.get("music_evolution_meaning_tags") or []),
                    "metadata_json": _json_param(metadata),
                    "feature_payload_json": _json_param({"run_id": run_id, "rating": rating}),
                },
            )
        await self.db.commit()


async def _latest_ugs_row_for_music_evolution_run(db: AsyncSession, *, run_id: str) -> dict[str, Any] | None:
    result = await db.execute(
        text(
            """
            SELECT gr.id::text AS request_id,
                   gr.status,
                   gr.error_message,
                   gr.output_data,
                   gt.type_key
            FROM generation_requests gr
            JOIN generation_types gt ON gt.id = gr.type_id
            WHERE gr.deleted_at IS NULL
              AND gt.type_key = 'music_generator_evolution_xl_base'
              AND (
                    gr.input_data->>'music_evolution_run_id' = :run_id
                 OR gr.request_metadata->>'music_evolution_run_id' = :run_id
              )
            ORDER BY gr.created_at DESC
            LIMIT 1
            """
        ),
        {"run_id": run_id},
    )
    row = result.mappings().first()
    return dict(row) if row is not None else None


async def _terminalize_stale_music_evolution_run(
    db: AsyncSession,
    *,
    run_id: str,
    status: str,
    stage: str,
    message: str,
    ugs_request_id: str | None = None,
) -> bool:
    error_payload = {"stage": stage, "message": message[:500]}
    if ugs_request_id:
        error_payload["ugs_request_id"] = ugs_request_id
    result = await db.execute(
        text(
            """
            UPDATE music_evolution_runs
            SET status = :status,
                error_payload = CASE
                    WHEN :status = 'completed' THEN error_payload
                    ELSE CAST(:error_payload AS jsonb)
                END,
                ugs_request_id = COALESCE(ugs_request_id, CAST(:ugs_request_id AS uuid)),
                completed_at = CASE WHEN :status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
                cancelled_at = CASE WHEN :status = 'cancelled' THEN COALESCE(cancelled_at, NOW()) ELSE cancelled_at END,
                updated_at = NOW()
            WHERE id = CAST(:run_id AS uuid)
              AND status NOT IN ('completed', 'failed', 'cancelled')
            RETURNING status
            """
        ),
        {
            "run_id": run_id,
            "status": status,
            "error_payload": _json_param(error_payload),
            "ugs_request_id": ugs_request_id,
        },
    )
    changed = result.mappings().first() is not None
    if changed:
        await db.execute(
            text(
                """
                UPDATE music_evolution_run_steps
                SET status = :status,
                    error_payload = CAST(:error_payload AS jsonb),
                    completed_at = COALESCE(completed_at, NOW()),
                    updated_at = NOW()
                WHERE run_id = CAST(:run_id AS uuid)
                  AND status NOT IN ('completed', 'failed', 'cancelled', 'skipped')
                """
            ),
            {"run_id": run_id, "status": status, "error_payload": _json_param(error_payload)},
        )
        await db.commit()
    else:
        await db.rollback()
    return changed


async def reap_stale_music_evolution_runs(*, stale_after_seconds: int | None = None, limit: int = 50) -> int:
    """Find stale queued/running Music Evolution runs and reconcile them with UGS terminal state."""
    manager = await get_database_manager()
    timeout = stale_after_seconds if stale_after_seconds is not None else music_evolution_stale_reap_after_seconds()
    reconciled = 0
    async with manager.get_postgres_session() as db:
        result = await db.execute(
            text(
                """
                SELECT id::text AS id, user_id::text AS user_id, status, ugs_request_id::text AS ugs_request_id
                FROM music_evolution_runs
                WHERE status IN ('queued', 'running')
                  AND updated_at < NOW() - (CAST(:stale_after_seconds AS int) * INTERVAL '1 second')
                ORDER BY updated_at ASC
                LIMIT :limit
                """
            ),
            {"stale_after_seconds": int(timeout), "limit": int(limit)},
        )
        rows = [dict(row) for row in result.mappings().all()]
        for row in rows:
            run_id = str(row.get("id") or "").strip()
            if not run_id:
                continue
            ugs_row = await _latest_ugs_row_for_music_evolution_run(db, run_id=run_id)
            ugs_status = str((ugs_row or {}).get("status") or "").strip().lower()
            ugs_request_id = str((ugs_row or {}).get("request_id") or row.get("ugs_request_id") or "").strip() or None
            if ugs_status == "cancelled":
                changed = await _terminalize_stale_music_evolution_run(
                    db,
                    run_id=run_id,
                    status="cancelled",
                    stage="ugs-cancelled",
                    message="music_evolution_ugs_cancelled",
                    ugs_request_id=ugs_request_id,
                )
            elif ugs_status == "failed":
                changed = await _terminalize_stale_music_evolution_run(
                    db,
                    run_id=run_id,
                    status="failed",
                    stage="ugs-failed",
                    message=str((ugs_row or {}).get("error_message") or "music_evolution_ugs_failed"),
                    ugs_request_id=ugs_request_id,
                )
            else:
                if ugs_status in {"pending", "processing", "queued", "running"} and ugs_request_id:
                    await MusicEvolutionPipelineService(db)._cancel_ugs_request(
                        ugs_request_id=ugs_request_id,
                        user_id=str(row.get("user_id") or ""),
                    )
                changed = await _terminalize_stale_music_evolution_run(
                    db,
                    run_id=run_id,
                    status="failed",
                    stage="stale-reaper",
                    message=f"stale_music_evolution_run_timeout:{ugs_status or 'no_ugs_request'}",
                    ugs_request_id=ugs_request_id,
                )
            if changed:
                reconciled += 1
    return reconciled


async def run_music_evolution_pipeline_background(*, run_id: str, user_id: str) -> None:
    """Create fresh resources and run a Music Evolution job after HTTP 202 response."""
    manager = await get_database_manager()
    async with manager.get_postgres_session() as db:
        content_service = await get_content_service()
        ugs = UnifiedGenerationService(db, content_service=content_service)
        try:
            await MusicEvolutionPipelineService(db, ugs=ugs, content_service=content_service).run_pipeline(
                run_id=run_id,
                user_id=user_id,
            )
        finally:
            await ugs.close()
