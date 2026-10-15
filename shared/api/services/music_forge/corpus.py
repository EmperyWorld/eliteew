# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Per-user liked-song corpus for MusicForge create: Forge feedback first, Evolution fill.
# Invariants:
# - music_forge_feedback likes are primary (incl. SFT TOP lane); Evolution is secondary warm-start.
# - Full lyrics/tags never copied into LLM prompts — counts and short hints only.
# - Dislike reason codes become negative prompt hints for the next run.
# Related:
# - api/services/music_evolution_corpus.py
# - api/services/music_forge/algorithm/prompts.py
# - documentation/product/MUSIC-FORGE-IMPROVEMENT-PLAN.md
# ---
"""MusicForge liked-recipe corpus (Forge feedback first, Evolution fill)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.services.music_evolution_corpus import (
    collect_music_evolution_corpus,
    score_recipe_against_input,
)
from api.services.music_evolution_recipe_features import (
    corpus_quality_summary,
    is_xl_base_recipe_metadata,
    recipe_features_from_metadata,
)


def forge_corpus_normalized_input(intent: dict[str, Any]) -> dict[str, Any]:
    """Map MusicForge public intent into Music Evolution corpus scorer keys."""
    probe = " ".join(
        [
            str(intent.get("idea") or ""),
            str(intent.get("style_hint") or ""),
            str(intent.get("constraints") or ""),
        ]
    ).lower()
    genre = "pop"
    if any(word in probe for word in ("rock", "рок", "metal", "метал")):
        genre = "rock"
    elif any(word in probe for word in ("house", "techno", "trance", "edm", "dance", "рейв")):
        genre = "dance"
    elif any(word in probe for word in ("ballad", "баллада", "piano", "фортеп")):
        genre = "ballad"
    mood = "warm"
    if any(word in probe for word in ("dark", "мрач", "груст", "sad")):
        mood = "dark"
    elif any(word in probe for word in ("energy", "энерг", "drive", "драйв", "fast", "быстр")):
        mood = "energetic"
    vocal = "female"
    if any(word in probe for word in ("male", "муж", "baritone", "tenor")):
        vocal = "male"
    elif "duet" in probe or "дуэт" in probe:
        vocal = "duet"
    return {
        "genre": genre,
        "soloist": "ray",
        "vocal": vocal,
        "language": str(intent.get("language") or "ru"),
        "mood": mood,
        "meaning_tags": [],
    }


def _brief_hints_from_evolution_snapshot(snapshot: dict[str, Any]) -> dict[str, Any] | None:
    """Extract compact hints from music_evolution_feedback.recipe_snapshot JSON."""
    meta_raw = snapshot.get("metadata")
    metadata: dict[str, Any] = meta_raw if isinstance(meta_raw, dict) else {}
    if not is_xl_base_recipe_metadata(metadata):
        return None
    brief_raw = metadata.get("music_evolution_brief") or metadata.get("music_evolution_song_recipe")
    brief: dict[str, Any] = brief_raw if isinstance(brief_raw, dict) else {}
    style_plan_raw = brief.get("style_plan")
    style_plan: dict[str, Any] = style_plan_raw if isinstance(style_plan_raw, dict) else {}
    return {
        "source_kind": "evolution_feedback_like",
        "name": snapshot.get("name"),
        "quality_signal": 6,
        "style": str(metadata.get("music_generator_style") or "pop").lower(),
        "vocal": str(metadata.get("music_generator_vocal") or "female").lower(),
        "language": str(metadata.get("music_generator_language") or "ru"),
        "bpm": metadata.get("music_generator_bpm"),
        "model_scope": str(metadata.get("music_generator_model_scope") or metadata.get("model_scope") or "xl_base"),
        "ugs_workflow": str(metadata.get("ugs_workflow") or "v2_base"),
        "hook_idea": str(brief.get("hook_idea") or "")[:220],
        "angle": str(brief.get("angle") or "")[:320],
        "avoid": [str(item)[:120] for item in (brief.get("avoid") or [])[:6] if str(item).strip()],
        "positive_tags": [str(item)[:80] for item in (style_plan.get("positive_tags") or [])[:6] if str(item).strip()],
        "primary_style": str(style_plan.get("primary_style") or "")[:160],
    }


def _hints_from_forge_like_snapshot(snapshot: dict[str, Any]) -> dict[str, Any] | None:
    """Extract compact hints from music_forge_feedback like recipe_snapshot (any lane)."""
    meta_raw = snapshot.get("metadata")
    metadata: dict[str, Any] = meta_raw if isinstance(meta_raw, dict) else {}
    if not metadata and not snapshot.get("content_id"):
        return None
    capsule_raw = metadata.get("music_forge_style_capsule")
    capsule: dict[str, Any] = capsule_raw if isinstance(capsule_raw, dict) else {}
    blueprint_raw = metadata.get("music_forge_blueprint")
    blueprint: dict[str, Any] = blueprint_raw if isinstance(blueprint_raw, dict) else {}
    style = str(
        capsule.get("style_key")
        or metadata.get("music_generator_style")
        or metadata.get("music_forge_style_hint")
        or "pop"
    ).lower()
    vocal = str(capsule.get("vocal") or metadata.get("music_generator_vocal") or "female").lower()
    bpm = capsule.get("bpm") if capsule.get("bpm") is not None else metadata.get("music_generator_bpm")
    return {
        "source_kind": "forge_feedback_like",
        "source_key": str(snapshot.get("content_id") or metadata.get("music_forge_run_id") or ""),
        "content_id": snapshot.get("content_id"),
        "name": snapshot.get("name"),
        "quality_signal": 8,
        "style": style,
        "vocal": vocal if vocal in {"male", "female", "duet"} else "female",
        "language": str(metadata.get("music_forge_language") or metadata.get("music_generator_language") or "ru"),
        "bpm": bpm,
        "model_scope": str(metadata.get("music_generator_model_scope") or metadata.get("model_scope") or "xl_sft"),
        "ugs_workflow": str(metadata.get("ugs_workflow") or "v4"),
        "hook_idea": str(blueprint.get("hook") or metadata.get("music_forge_idea") or "")[:220],
        "angle": str(metadata.get("music_forge_idea") or "")[:320],
        "avoid": [str(item)[:120] for item in (blueprint.get("avoid") or [])[:6] if str(item).strip()],
        "positive_tags": [],
        "primary_style": str(capsule.get("caption") or "")[:160],
    }


def _merge_scored_items(
    *,
    primary: list[dict[str, Any]],
    secondary: list[dict[str, Any]],
    limit: int,
) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entry in [*primary, *secondary]:
        key = str(
            entry.get("source_key") or entry.get("content_id") or entry.get("name") or entry.get("hook_idea") or ""
        )
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        merged.append(entry)
    return sorted(merged, key=lambda item: int(item.get("score") or 0), reverse=True)[:limit]


async def count_music_forge_taste_profile(db: AsyncSession, *, user_id: str) -> dict[str, int]:
    """Return like/dislike counts for capabilities taste UI (no recipe content)."""
    row = (
        (
            await db.execute(
                text(
                    """
                SELECT
                    COUNT(*) FILTER (WHERE rating = 'like') AS likes,
                    COUNT(*) FILTER (WHERE rating = 'dislike') AS dislikes
                FROM music_forge_feedback
                WHERE user_id = CAST(:user_id AS uuid)
                """
                ),
                {"user_id": user_id},
            )
        )
        .mappings()
        .first()
    )
    if row is None:
        return {"likes": 0, "dislikes": 0}
    return {
        "likes": int(row.get("likes") or 0),
        "dislikes": int(row.get("dislikes") or 0),
    }


async def collect_music_forge_corpus(
    db: AsyncSession,
    *,
    user_id: str,
    intent: dict[str, Any],
    limit: int = 6,
) -> dict[str, Any]:
    """
    Collect per-user liked recipes for MusicForge create.

    Primary: ``music_forge_feedback`` likes (incl. SFT TOP).
    Secondary: Evolution unified_content corpus + ``music_evolution_feedback`` likes.
    Also returns ``dislike_hints`` from recent Forge dislikes for prompt negative guidance.
    """
    normalized_input = forge_corpus_normalized_input(intent)

    forge_like_rows = (
        await db.execute(
            text(
                """
                SELECT recipe_snapshot
                FROM music_forge_feedback
                WHERE user_id = CAST(:user_id AS uuid)
                  AND rating = 'like'
                ORDER BY COALESCE(updated_at, created_at) DESC
                LIMIT 30
                """
            ),
            {"user_id": user_id},
        )
    ).mappings()
    forge_items: list[dict[str, Any]] = []
    for row in forge_like_rows:
        snap_raw = row.get("recipe_snapshot")
        snap: dict[str, Any] = snap_raw if isinstance(snap_raw, dict) else {}
        hint = _hints_from_forge_like_snapshot(snap)
        if hint is None:
            continue
        features = recipe_features_from_metadata(snap.get("metadata") if isinstance(snap.get("metadata"), dict) else {})
        merged = {**hint, **features}
        merged["score"] = score_recipe_against_input(features, normalized_input, quality_signal=8) + 20
        forge_items.append(merged)

    dislike_rows = (
        await db.execute(
            text(
                """
                SELECT reason_code, reason_custom
                FROM music_forge_feedback
                WHERE user_id = CAST(:user_id AS uuid)
                  AND rating = 'dislike'
                ORDER BY COALESCE(updated_at, created_at) DESC
                LIMIT 12
                """
            ),
            {"user_id": user_id},
        )
    ).mappings()
    dislike_hints: list[dict[str, str]] = []
    seen_codes: set[str] = set()
    for row in dislike_rows:
        code = str(row.get("reason_code") or "").strip()
        custom = str(row.get("reason_custom") or "").strip()[:160]
        if not code or code in seen_codes:
            continue
        seen_codes.add(code)
        dislike_hints.append({"reason_code": code, "reason_custom": custom})

    evolution = await collect_music_evolution_corpus(
        db,
        user_id=user_id,
        normalized_input=normalized_input,
        limit=limit,
    )
    feedback_rows = (
        await db.execute(
            text(
                """
                SELECT recipe_snapshot
                FROM music_evolution_feedback
                WHERE user_id = CAST(:user_id AS uuid)
                  AND rating = 'like'
                ORDER BY created_at DESC
                LIMIT 30
                """
            ),
            {"user_id": user_id},
        )
    ).mappings()
    evolution_extra: list[dict[str, Any]] = []
    for row in feedback_rows:
        evo_snap_raw = row.get("recipe_snapshot")
        evo_snap: dict[str, Any] = evo_snap_raw if isinstance(evo_snap_raw, dict) else {}
        hint = _brief_hints_from_evolution_snapshot(evo_snap)
        if hint is None:
            continue
        features = recipe_features_from_metadata(
            evo_snap.get("metadata") if isinstance(evo_snap.get("metadata"), dict) else {}
        )
        merged = {**hint, **features}
        merged["score"] = score_recipe_against_input(features, normalized_input, quality_signal=6)
        evolution_extra.append(merged)

    evolution_items = list(evolution.get("items") or []) + evolution_extra
    selected = _merge_scored_items(primary=forge_items, secondary=evolution_items, limit=limit)
    quality_summary = corpus_quality_summary(selected)
    return {
        **evolution,
        "items": selected,
        "selected_count": len(selected),
        "candidate_count": int(evolution.get("candidate_count") or 0) + len(forge_items) + len(evolution_extra),
        "forge_like_count": len(forge_items),
        "dislike_hints": dislike_hints,
        "quality_summary": quality_summary,
        "input_keys": normalized_input,
        "corpus_policy": "forge_first_evolution_fill",
    }
