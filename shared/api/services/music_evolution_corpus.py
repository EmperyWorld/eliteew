# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Privacy-scoped recipe corpus collection for the Music Evolution XL Base pipeline.
# Invariants:
# - Default retrieval is per-user; no cross-user recipe leakage.
# - Only XL Base metadata rows enter the corpus; Turbo/V3 tracks are excluded.
# - Corpus entries are quality hints only, not templates copied verbatim into prompts.
# Related:
# - api/services/music_evolution_recipe_features.py
# - api/services/music_generator_liked_recipe.py
# - api/services/music_evolution_pipeline.py
# ---
"""Recipe corpus helpers for Music Evolution."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.services.music_evolution_recipe_features import (
    corpus_quality_summary,
    is_xl_base_recipe_metadata,
    recipe_features_from_metadata,
)


def _normalized_soloist_id(raw: object) -> str:
    from api.services.music_evolution_soloists import resolve_soloist_id

    text = str(raw or "").strip().lower()
    return resolve_soloist_id(text) if text else ""


def score_recipe_against_input(
    features: dict[str, Any], normalized_input: dict[str, Any], *, quality_signal: int
) -> int:
    """Small deterministic score for choosing useful per-user hints."""
    score = int(quality_signal) * 10
    target_genre = str(normalized_input.get("genre") or "").lower()
    target_soloist = _normalized_soloist_id(normalized_input.get("soloist"))
    feat_style = str(features.get("style") or "").lower()
    feat_soloist = _normalized_soloist_id(features.get("soloist"))
    if target_soloist and feat_soloist:
        if feat_soloist == target_soloist:
            score += 12
        else:
            score -= 10
    if feat_style and target_genre:
        if feat_style == target_genre:
            score += 8
        else:
            score -= 8
    if str(features.get("vocal") or "").lower() == str(normalized_input.get("vocal") or "").lower():
        score += 4
    if str(features.get("language") or "").lower() == str(normalized_input.get("language") or "").lower():
        score += 3
    if int(features.get("sung_line_count") or 0) >= 10:
        score += 3
    if features.get("has_voice_annotations"):
        score += 2
    if features.get("is_short_skeleton"):
        score -= 6
    if features.get("is_low_cyrillic"):
        score -= 4
    return score


async def collect_music_evolution_corpus(
    db: AsyncSession,
    *,
    user_id: str,
    normalized_input: dict[str, Any],
    limit: int = 6,
) -> dict[str, Any]:
    """Collect per-user liked/disliked XL Base recipe hints from main DB tables."""
    evolution_feedback = (
        await db.execute(
            text(
                """
                SELECT content_id::text AS content_id, rating, reason_code
                FROM music_evolution_feedback
                WHERE user_id = CAST(:user_id AS uuid)
                """
            ),
            {"user_id": user_id},
        )
    ).mappings()
    feedback_by_content: dict[str, dict[str, str]] = {
        str(row.get("content_id")): {
            "rating": str(row.get("rating") or ""),
            "reason_code": str(row.get("reason_code") or ""),
        }
        for row in evolution_feedback
    }

    liked_rows = (
        await db.execute(
            text(
                """
                SELECT id::text AS content_id, name, metadata, created_at
                FROM unified_content
                WHERE user_id = CAST(:user_id AS uuid)
                  AND content_type = 'audio'
                  AND metadata ? 'music_generator_lyrics'
                ORDER BY created_at DESC
                LIMIT 50
                """
            ),
            {"user_id": user_id},
        )
    ).mappings()
    entries: list[dict[str, Any]] = []
    for row in liked_rows:
        content_id = str(row.get("content_id"))
        fb = feedback_by_content.get(content_id, {})
        evolution_rating = fb.get("rating", "")
        if evolution_rating == "dislike":
            continue
        metadata_raw = row.get("metadata")
        metadata: dict[str, Any] = metadata_raw if isinstance(metadata_raw, dict) else {}
        if not is_xl_base_recipe_metadata(metadata):
            continue
        features = recipe_features_from_metadata(metadata)
        quality_signal = 5 if evolution_rating == "like" else 1
        entries.append(
            {
                "source_kind": "liked_content",
                "source_key": content_id,
                "content_id": content_id,
                "name": row.get("name"),
                "quality_signal": quality_signal,
                **features,
                "score": score_recipe_against_input(features, normalized_input, quality_signal=quality_signal),
            }
        )

    dislike_rows = (
        await db.execute(
            text(
                """
                SELECT content_id::text AS content_id, name, recipe_snapshot, reason_code, created_at
                FROM music_generator_dislike_feedback
                WHERE user_id = CAST(:user_id AS uuid)
                ORDER BY created_at DESC
                LIMIT 50
                """
            ),
            {"user_id": user_id},
        )
    ).mappings()
    for row in dislike_rows:
        snap_raw = row.get("recipe_snapshot")
        snap: dict[str, Any] = snap_raw if isinstance(snap_raw, dict) else {}
        meta_raw = snap.get("metadata")
        recipe_metadata: dict[str, Any] = meta_raw if isinstance(meta_raw, dict) else {}
        if recipe_metadata and not is_xl_base_recipe_metadata(recipe_metadata):
            continue
        features = recipe_features_from_metadata(recipe_metadata)
        quality_signal = -4
        entries.append(
            {
                "source_kind": "dislike_feedback",
                "source_key": str(row.get("content_id")),
                "content_id": str(row.get("content_id")),
                "name": row.get("name"),
                "reason_code": row.get("reason_code"),
                "quality_signal": quality_signal,
                **features,
                "score": score_recipe_against_input(features, normalized_input, quality_signal=quality_signal),
            }
        )

    selected = sorted(entries, key=lambda item: int(item.get("score") or 0), reverse=True)[:limit]
    quality_summary = corpus_quality_summary(selected)
    return {
        "scope": "user",
        "items": selected,
        "selected_count": len(selected),
        "candidate_count": len(entries),
        "quality_summary": quality_summary,
        "input_keys": {
            "genre": normalized_input.get("genre"),
            "soloist": normalized_input.get("soloist"),
            "vocal": normalized_input.get("vocal"),
            "language": normalized_input.get("language"),
            "mood": normalized_input.get("mood"),
            "meaning_tags": normalized_input.get("meaning_tags"),
        },
    }


async def upsert_music_evolution_recipe_source(
    db: AsyncSession,
    *,
    source_kind: str,
    source_key: str,
    user_id: str,
    content_id: str | None,
    quality_signal: int,
    metadata: dict[str, Any],
    feature_payload: dict[str, Any],
) -> None:
    """Materialize one recipe source for future corpus retrieval."""
    features = recipe_features_from_metadata(metadata)
    await db.execute(
        text(
            """
            INSERT INTO music_evolution_recipe_sources
            (source_kind, source_key, source_content_id, user_id, quality_signal, style, vocal, language,
             mood, meaning_tags, metadata_snapshot, feature_payload, last_seen_at)
            VALUES
            (:source_kind, :source_key, CAST(:content_id AS uuid), CAST(:user_id AS uuid), :quality_signal,
             :style, :vocal, :language, :mood, CAST(:meaning_tags AS jsonb), CAST(:metadata AS jsonb),
             CAST(:feature_payload AS jsonb), NOW())
            ON CONFLICT (source_kind, source_key) DO UPDATE SET
                quality_signal = EXCLUDED.quality_signal,
                style = EXCLUDED.style,
                vocal = EXCLUDED.vocal,
                language = EXCLUDED.language,
                mood = EXCLUDED.mood,
                meaning_tags = EXCLUDED.meaning_tags,
                metadata_snapshot = EXCLUDED.metadata_snapshot,
                feature_payload = EXCLUDED.feature_payload,
                last_seen_at = NOW()
            """
        ),
        {
            "source_kind": source_kind,
            "source_key": source_key,
            "content_id": content_id,
            "user_id": user_id,
            "quality_signal": quality_signal,
            "style": features.get("style"),
            "vocal": features.get("vocal"),
            "language": features.get("language"),
            "mood": feature_payload.get("mood"),
            "meaning_tags": feature_payload.get("meaning_tags_json", "[]"),
            "metadata": feature_payload.get("metadata_json", "{}"),
            "feature_payload": feature_payload.get("feature_payload_json", "{}"),
        },
    )
