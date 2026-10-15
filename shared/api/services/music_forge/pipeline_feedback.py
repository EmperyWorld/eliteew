# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MusicForge run feedback persistence (like/dislike + recipe snapshot).
# Related:
# - api/services/music_forge/pipeline.py
# ---
"""MusicForge feedback persistence."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.music_forge import MusicForgeRunOut
from api.services.music_forge.pipeline_repository import _json_param
from api.services.music_generator_dislike_feedback import validate_dislike_reason
from api.services.music_generator_liked_recipe import build_liked_recipe_payload


async def record_music_forge_feedback(
    *,
    db: AsyncSession,
    content_service: Any | None,
    run: MusicForgeRunOut,
    run_id: str,
    user_id: str,
    rating: str,
    reason_code: str | None,
    reason_custom: str | None,
) -> None:
    if run.content_id is None:
        raise HTTPException(status_code=400, detail="run has no generated content")
    if content_service is None:
        raise HTTPException(status_code=503, detail="content service unavailable")
    content = await content_service.get_content(run.content_id, user_id, check_permissions=True)
    if str(content.user_id) != user_id:
        raise HTTPException(status_code=403, detail="only owner can record feedback")
    if rating == "dislike":
        try:
            reason_custom = validate_dislike_reason(code=reason_code or "", custom=reason_custom)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    snapshot = build_liked_recipe_payload(user_id=user_id, content=content)
    await db.execute(
        text(
            "INSERT INTO music_forge_feedback "
            "(user_id, run_id, content_id, rating, reason_code, reason_custom, recipe_snapshot) "
            "VALUES (CAST(:user_id AS uuid), CAST(:run_id AS uuid), CAST(:content_id AS uuid), "
            ":rating, :reason_code, :reason_custom, CAST(:recipe_snapshot AS jsonb)) "
            "ON CONFLICT (user_id, content_id) DO UPDATE SET "
            "rating = EXCLUDED.rating, reason_code = EXCLUDED.reason_code, "
            "reason_custom = EXCLUDED.reason_custom, "
            "recipe_snapshot = EXCLUDED.recipe_snapshot, updated_at = NOW()"
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
    await db.commit()
