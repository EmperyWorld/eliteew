# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for companion music pipeline service-layer errors and Trust T4
# workflow-child ``task_completed`` SSE (no HTTP self-call path).
# Invariants:
# - Tests mock music_generator handlers; no live UGS/Postgres required.
# - Workflow-child early-return paths must still publish ``task_completed`` (V-L1).
# Related:
# - api/services/companion_music_pipeline.py
# - api/ewa_platform/companion/orchestration/tools/handlers_media.py
# - documentation/product/ewa/EWA-TRUST-RESTORATION-PROGRAM-2026-07-09.md
# ---

from __future__ import annotations

import importlib
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

pipeline = importlib.import_module("api.services.companion_music_pipeline")


@pytest.mark.asyncio
async def test_execute_companion_music_wizard_maps_lyrics_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    run_id = str(uuid.uuid4())
    catalog_user_id = str(uuid.uuid4())

    async def _fail_lyrics(*_args, **_kwargs):
        raise HTTPException(status_code=502, detail="Llama returned empty lyrics")

    monkeypatch.setattr(
        "api.routers.music_generator.generate_lyrics",
        _fail_lyrics,
    )
    manager = MagicMock()
    session = MagicMock()
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock(return_value=None)
    manager.postgres_session_factory = True
    manager.get_postgres_session = MagicMock(return_value=session)
    monkeypatch.setattr(pipeline, "get_database_manager", AsyncMock(return_value=manager))
    monkeypatch.setattr(pipeline, "_build_ugs", AsyncMock(return_value=MagicMock(close=AsyncMock())))

    with pytest.raises(pipeline.CompanionMusicPipelineError) as exc_info:
        await pipeline.execute_companion_music_wizard(
            catalog_user_id=catalog_user_id,
            run_id=run_id,
            step_id=str(uuid.uuid4()),
            principal_id=str(uuid.uuid4()),
            style_key="pop",
            vocal_eff="female",
            language_e="ru",
            ugs_wf="v2",
            theme="Летняя ночь",
            lyrics_arg="",
            voice_diversity="balanced",
            luna_mode=None,
            bpm_override=None,
            duration_override=None,
            name_arg="",
            explicit_tags="",
            skip_lyrics_validation=False,
            billing_mode="wizard",
            ksampler_use_comfy_template=False,
            ewa_companion_context="",
            w_temp=0.85,
            w_cfg=2.0,
            w_top=0.9,
            suggest_t=0.7,
            suggest_c=1.8,
            suggest_p=0.9,
            default_pipeline_bpm=120,
            clamp_lyrics=lambda s: s.strip(),
            coerce_bpm_for_style=lambda _style, bpm: bpm,
            on_stage=None,
        )

    err = exc_info.value
    assert err.stage == "lyrics"
    assert err.http_status == 502


@pytest.mark.asyncio
async def test_background_music_job_inits_http_clients_before_pipeline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Celery/in-process music jobs must init shared httpx before generate_lyrics."""

    from api.ewa_platform.companion.orchestration import tool_registry

    init_mock = AsyncMock()
    monkeypatch.setattr("api.core.http_clients.init_http_clients", init_mock)

    async def _fail_pipeline(**_kwargs: object) -> None:
        raise pipeline.CompanionMusicPipelineError(message="stop_after_init", stage="init")

    monkeypatch.setattr(
        "api.services.companion_music_pipeline.execute_companion_music_wizard",
        _fail_pipeline,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_step_update",
        AsyncMock(),
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_run_update",
        AsyncMock(),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.music_pipeline_progress.publish_music_pipeline_step",
        AsyncMock(),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.music_pipeline_progress.publish_music_task_failed",
        AsyncMock(),
    )

    await tool_registry._run_background_music_generation_job(
        companion_pool=MagicMock(),
        principal_id="principal-1",
        run_id=str(uuid.uuid4()),
        step_id=str(uuid.uuid4()),
        style_key="pop",
        vocal_eff="female",
        language_e="ru",
        ugs_wf="v2",
        theme="test",
        lyrics_arg="",
        voice_diversity="balanced",
        luna_mode=None,
        bpm_override=None,
        duration_override=None,
        name_arg="",
        explicit_tags="",
        skip_lyrics_validation=False,
        autoplay_requested=False,
    )

    init_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_background_music_publishes_task_completed_when_workflow_child_advances(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Trust T4 / V-L1: DAG/declarative child advance must not skip ``task_completed`` SSE."""

    from api.ewa_platform.companion.orchestration import tool_registry

    run_id = str(uuid.uuid4())
    step_id = str(uuid.uuid4())
    published_completed: list[dict[str, Any]] = []

    class _PipelineResult:
        content_id = "content-1"
        track_name = "Track"
        next_lyrics = "lyrics"
        gen_bpm = 120
        gen_duration_seconds = 30

    monkeypatch.setattr("api.core.http_clients.init_http_clients", AsyncMock())
    monkeypatch.setattr(
        "api.services.companion_music_pipeline.execute_companion_music_wizard",
        AsyncMock(return_value=_PipelineResult()),
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_run_fetch",
        AsyncMock(return_value={"id": run_id, "status": "running", "run_revision": 1}),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.run_lifecycle.apply_companion_run_terminal",
        AsyncMock(return_value={"id": run_id, "status": "completed", "run_revision": 2}),
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_step_update",
        AsyncMock(),
    )
    monkeypatch.setattr(
        "api.ewa_platform.agentic.jobs.child_reconcile.maybe_complete_agentic_awaiting_child_from_run",
        AsyncMock(),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.music_pipeline_progress.publish_music_pipeline_step",
        AsyncMock(),
    )

    async def _capture_completed(**kwargs: Any) -> None:
        published_completed.append(dict(kwargs))

    monkeypatch.setattr(
        "api.ewa_platform.companion.jobs.music_pipeline_progress.publish_music_task_completed",
        _capture_completed,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.dag.dag_async_resume.maybe_advance_workflow_from_child_run",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.action.advance.maybe_advance_workflow_after_music_step",
        AsyncMock(return_value=False),
    )

    await tool_registry._run_background_music_generation_job(
        companion_pool=MagicMock(),
        principal_id="principal-1",
        run_id=run_id,
        step_id=step_id,
        style_key="pop",
        vocal_eff="female",
        language_e="ru",
        ugs_wf="v2",
        theme="test",
        lyrics_arg="",
        voice_diversity="balanced",
        luna_mode=None,
        bpm_override=None,
        duration_override=None,
        name_arg="",
        explicit_tags="",
        skip_lyrics_validation=False,
        autoplay_requested=False,
    )

    assert len(published_completed) == 1
    assert published_completed[0]["run_id"] == run_id
    assert published_completed[0]["principal_id"] == "principal-1"
    assert published_completed[0]["result_payload"]["content_id"] == "content-1"
