# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Materialize durable music_forge_run_steps from Mode pipeline stages (Wave B).
# Invariants:
# - Always appends trailing result_ready; updates progress_total to match step count.
# Related:
# - api/services/music_forge/pipeline_repository.py
# - api/services/music_forge/pipeline_interpreter.py
# ---
"""Step-row materialization for MusicForge runs."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

MUSIC_FORGE_TOTAL_STEPS = 8

STEP_DEFS: tuple[tuple[int, str, str], ...] = (
    (1, "intent_normalize", "Понимаю идею песни"),
    (2, "song_blueprint", "Собираю драматургию и хук"),
    (3, "lyrics_draft", "Пишу текст песни"),
    (4, "lyrics_gate", "Проверяю текст перед рендером"),
    (5, "style_capsule", "Собираю звучание для ACE"),
    (6, "audio_render", "Запускаю XL lane"),
    (7, "content_persist", "Сохраняю готовый трек"),
    (8, "result_ready", "Готовлю результат и оценку"),
)


def step_defs_from_pipeline_stages(stages: list[dict[str, Any]]) -> list[tuple[int, str, str]]:
    """Build (index, kind, title) rows from enabled Mode stages + result_ready."""
    defs: list[tuple[int, str, str]] = []
    for stage in stages:
        if not stage.get("enabled", True):
            continue
        kind = str(stage.get("stage_key") or "").strip()
        if not kind or kind == "result_ready":
            continue
        title = str(stage.get("title_ru") or kind)
        defs.append((len(defs) + 1, kind, title))
    defs.append((len(defs) + 1, "result_ready", "Готовлю результат и оценку"))
    return defs


def legacy_step_defs_without_result_ready() -> list[dict[str, Any]]:
    """Legacy STEP_DEFS as stage-shaped dicts (excluding result_ready)."""
    return [
        {
            "stage_key": kind,
            "title_ru": title,
            "sort_order": idx * 10,
            "enabled": True,
        }
        for idx, kind, title in STEP_DEFS
        if kind != "result_ready"
    ]


async def materialize_run_steps(
    db: AsyncSession,
    run_id: str | UUID,
    stages: list[dict[str, Any]],
) -> int:
    """Insert/update step rows for run; return progress_total."""
    defs = step_defs_from_pipeline_stages(stages)
    total = len(defs)
    for idx, kind, title in defs:
        await db.execute(
            text(
                """
                INSERT INTO music_forge_run_steps (run_id, step_index, step_kind, title)
                VALUES (CAST(:run_id AS uuid), :step_index, :step_kind, :title)
                ON CONFLICT (run_id, step_index) DO UPDATE
                SET step_kind = EXCLUDED.step_kind,
                    title = EXCLUDED.title,
                    updated_at = NOW()
                """
            ),
            {"run_id": str(run_id), "step_index": idx, "step_kind": kind, "title": title},
        )
    await db.execute(
        text(
            """
            UPDATE music_forge_runs
            SET progress_total = :progress_total,
                updated_at = NOW()
            WHERE id = CAST(:run_id AS uuid)
            """
        ),
        {"run_id": str(run_id), "progress_total": total},
    )
    return total
