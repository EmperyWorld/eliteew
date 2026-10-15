# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Map music wizard pipeline stages to companion SSE ``task_step`` / terminal events (Phase 2).
# Invariants:
# - Four fixed stages; publish is best-effort via Redis (see ``task_events``).
# - Async entrypoints use ``publish_task_event_async`` (non-blocking Redis).
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - documentation/product/ewa/EWA-COMPANION-BACKGROUND-ORCHESTRATION-MASTER-PLAN.md §6.3
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.jobs.task_events import publish_task_event_async, publish_task_event_sync

_MUSIC_STAGE_TOTAL = 4

MUSIC_PIPELINE_STAGE_COUNT = _MUSIC_STAGE_TOTAL

_MUSIC_STAGES: tuple[tuple[str, str, str], ...] = (
    ("lyrics", "Текст песни", "Lyrics"),
    ("suggest-production-params", "Параметры продакшена", "Production parameters"),
    ("generate-style", "Генерация стиля", "Style generation"),
    ("generate", "Генерация трека", "Track generation"),
)

_STAGE_INDEX_BY_KEY = {kind: idx + 1 for idx, (kind, _ru, _en) in enumerate(_MUSIC_STAGES)}


def music_stage_index(stage_key: str) -> int | None:
    """Resolve orchestrator stage name to 1..4 index."""

    return _STAGE_INDEX_BY_KEY.get(str(stage_key or "").strip())


def _stage_title(stage_index: int, *, ru: bool) -> str:
    _kind, ru_t, en_t = _MUSIC_STAGES[stage_index - 1]
    return ru_t if ru else en_t


def _sse_step_status(internal: str) -> str:
    st = str(internal or "").strip().lower()
    if st in {"running", "in_progress", "pending"}:
        return "in_progress"
    return st or "in_progress"


async def publish_music_pipeline_step(
    *,
    principal_id: str,
    run_id: str,
    stage_index: int,
    status: str,
    ru: bool = True,
) -> None:
    """Emit ``task_step`` for one music pipeline stage."""

    if stage_index < 1 or stage_index > _MUSIC_STAGE_TOTAL:
        return
    step_kind = _MUSIC_STAGES[stage_index - 1][0]
    await publish_task_event_async(
        principal_id=principal_id,
        event_name="task_step",
        payload={
            "run_id": run_id,
            "step_index": stage_index,
            "step_kind": step_kind,
            "status": _sse_step_status(status),
            "title": _stage_title(stage_index, ru=ru),
            "progress": {"current": stage_index, "total": _MUSIC_STAGE_TOTAL},
        },
    )


async def publish_music_task_completed(
    *,
    principal_id: str,
    run_id: str,
    result_payload: Mapping[str, Any] | None = None,
) -> None:
    await publish_task_event_async(
        principal_id=principal_id,
        event_name="task_completed",
        payload={
            "run_id": run_id,
            "status": "completed",
            "intent_kind": "music_generation_background",
            "result_payload": dict(result_payload or {}),
        },
    )


async def publish_music_task_failed(
    *,
    principal_id: str,
    run_id: str,
    error_payload: Mapping[str, Any] | None = None,
    stage: str = "",
) -> None:
    payload: dict[str, Any] = {
        "run_id": run_id,
        "status": "failed",
        "intent_kind": "music_generation_background",
        "error_payload": dict(error_payload or {}),
    }
    if stage.strip():
        payload["stage"] = stage.strip()[:80]
    await publish_task_event_async(
        principal_id=principal_id,
        event_name="task_failed",
        payload=payload,
    )


def publish_music_pipeline_step_sync(
    *,
    principal_id: str,
    run_id: str,
    stage_index: int,
    status: str,
    ru: bool = True,
) -> None:
    """Sync fallback for Celery-only callers without a running event loop."""

    if stage_index < 1 or stage_index > _MUSIC_STAGE_TOTAL:
        return
    step_kind = _MUSIC_STAGES[stage_index - 1][0]
    publish_task_event_sync(
        principal_id=principal_id,
        event_name="task_step",
        payload={
            "run_id": run_id,
            "step_index": stage_index,
            "step_kind": step_kind,
            "status": _sse_step_status(status),
            "title": _stage_title(stage_index, ru=ru),
            "progress": {"current": stage_index, "total": _MUSIC_STAGE_TOTAL},
        },
    )


__all__ = (
    "MUSIC_PIPELINE_STAGE_COUNT",
    "music_stage_index",
    "publish_music_pipeline_step",
    "publish_music_pipeline_step_sync",
    "publish_music_task_completed",
    "publish_music_task_failed",
)
