# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Pure helpers для liked recipes Music Generator: eligibility, payload snapshot,
#   маппинг metadata → batch effective_params (Phase 5 quality loop).
# Invariants:
#   - Без FastAPI/SQLAlchemy; владелец контента проверяется вызывающим кодом.
# Related:
#   - api/routers/music_generator.py (POST /record-like-recipe)
#   - api/services/music_batch_tests.py
# ---

"""Pure helpers for recording liked music-generator tracks (no FastAPI / SQLAlchemy)."""

from __future__ import annotations

import random
from datetime import UTC, datetime
from typing import Any

from api.schemas.unified_content import Content, ContentType


def content_eligible_for_liked_recipe(content: Content) -> bool:
    """Только аудио из генератора, владелец проверяется отдельно."""
    if content.content_type != ContentType.AUDIO:
        return False
    st = (content.sub_type or "").strip().lower()
    if st == "music_generator":
        return True
    tags = content.tags or []
    return "music_generator" in {str(x).lower() for x in tags}


def build_liked_recipe_payload(*, user_id: str, content: Content) -> dict[str, Any]:
    md = content.metadata or {}
    if not isinstance(md, dict):
        md = {}
    return {
        "content_id": str(content.id),
        "user_id": str(user_id),
        "liked_at": datetime.now(UTC).isoformat(),
        "name": content.name,
        "sub_type": content.sub_type,
        "source_service": content.source_service,
        "metadata": md,
    }


def _md_str(metadata: dict[str, Any], *keys: str, default: str = "") -> str:
    for key in keys:
        val = metadata.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return default


def effective_params_from_recipe_metadata(
    metadata: dict[str, Any],
    *,
    content_id: str,
    content_name: str,
    duration_seconds: int,
) -> dict[str, Any]:
    """
    Снимок параметров генерации из metadata лайкнутого трека для batch row (v2_base).
    """
    md = metadata if isinstance(metadata, dict) else {}
    lyrics = _md_str(md, "music_generator_lyrics", "lyrics")
    if not lyrics:
        raise ValueError(f"content {content_id}: missing music_generator_lyrics in metadata")
    tags = _md_str(md, "music_generator_tags", "tags")
    style = _md_str(md, "music_generator_style", "style", default="pop").lower() or "pop"
    language = _md_str(md, "music_generator_language", "language", default="ru") or "ru"
    vocal = _md_str(md, "music_generator_vocal", "vocal", default="female") or "female"
    keyscale = _md_str(md, "music_generator_keyscale", "keyscale", default="C major") or "C major"
    timesignature = _md_str(md, "music_generator_timesignature", "timesignature", default="4") or "4"

    bpm_raw = md.get("music_generator_bpm", md.get("bpm"))
    bpm = int(bpm_raw) if isinstance(bpm_raw, (int, float)) else 120

    dur_raw = md.get("music_generator_duration_seconds", md.get("duration_seconds"))
    duration = duration_seconds
    if isinstance(dur_raw, (int, float)) and int(dur_raw) > 0:
        duration = min(int(dur_raw), duration_seconds)

    def _float(key: str, default: float) -> float:
        v = md.get(key)
        return float(v) if isinstance(v, (int, float)) else default

    seed_raw = md.get("music_generator_seed_used", md.get("seed"))
    if isinstance(seed_raw, (int, float)) and int(seed_raw) >= 0:
        seed = int(seed_raw)
    else:
        seed = random.SystemRandom().randint(0, 2**53 - 1)

    return {
        "lyrics": lyrics,
        "tags": tags,
        "language": language,
        "style": style,
        "vocal": vocal,
        "bpm": bpm,
        "duration_seconds": duration,
        "keyscale": keyscale,
        "timesignature": timesignature,
        "temperature": _float("music_generator_temperature", 0.85),
        "cfg_scale": _float("music_generator_cfg_scale", 2.0),
        "top_p": _float("music_generator_top_p", 0.9),
        "top_k": int(md.get("music_generator_top_k", 0) or 0),
        "min_p": _float("music_generator_min_p", 0.0),
        "generate_audio_codes": bool(md.get("music_generator_generate_audio_codes", True)),
        "seed": seed,
        "liked_recipe_content_id": content_id,
        "liked_recipe_content_name": content_name,
    }
