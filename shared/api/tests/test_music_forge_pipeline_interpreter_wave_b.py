# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave B PipelineInterpreter locks: mode resolve, stage dispatch order, handler registry.
# Invariants:
# - Default Mode pipeline is walked in sort_order; unknown stage_type fails closed.
# Related:
# - api/services/music_forge/pipeline_interpreter.py
# - api/services/music_forge/pipeline_mode.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.services.music_forge.config.seed import code_default_bundle
from api.services.music_forge.config.stage_types import ALLOWED_STAGE_TYPES
from api.services.music_forge.config.types import MusicForgeConfigBundle
from api.services.music_forge.pipeline_context import MusicForgePipelineContext
from api.services.music_forge.pipeline_interpreter import run_pipeline_interpreter
from api.services.music_forge.pipeline_mode import (
    enabled_pipeline_stages,
    resolve_default_mode,
    resolve_mode_for_intent,
)
from api.services.music_forge.pipeline_stage_handlers import STAGE_HANDLERS
from api.services.music_forge.pipeline_steps_materialize import (
    step_defs_from_pipeline_stages,
)


def test_stage_handlers_cover_allowed_types() -> None:
    assert set(STAGE_HANDLERS.keys()) == set(ALLOWED_STAGE_TYPES)


def test_step_defs_append_result_ready() -> None:
    stages = [
        {"stage_key": "intent_normalize", "title_ru": "A", "enabled": True},
        {"stage_key": "lyrics_gate", "title_ru": "B", "enabled": True},
    ]
    defs = step_defs_from_pipeline_stages(stages)
    assert [d[1] for d in defs] == ["intent_normalize", "lyrics_gate", "result_ready"]


@pytest.mark.asyncio
async def test_refresh_progress_uses_step_row_count_not_legacy_eight() -> None:
    """Wave B seed pipelines are 9 steps; refresh must not force progress_total=8."""
    from api.services.music_forge.pipeline_repository import MusicForgeRunRepository

    db = MagicMock()
    db.execute = AsyncMock()
    repo = MusicForgeRunRepository(db)
    await repo._refresh_progress("00000000-0000-4000-8000-000000000001")
    assert db.execute.await_count == 1
    sql = str(db.execute.await_args.args[0])
    params = db.execute.await_args.args[1]
    assert "progress_total" in sql
    assert "COUNT(*)" in sql
    assert "progress_total" not in params
    assert params == {"run_id": "00000000-0000-4000-8000-000000000001"}


def test_resolve_default_mode_from_code_bundle() -> None:
    bundle = code_default_bundle()
    mode = resolve_default_mode(bundle)
    assert mode is not None
    assert mode.get("is_default") is True
    stages = enabled_pipeline_stages(bundle, str(mode["mode_key"]))
    assert stages[0]["stage_type"] == "intent_normalize"
    assert any(s["stage_type"] == "audio_comfy" for s in stages)


def test_resolve_mode_honors_intent_mode_key() -> None:
    bundle = code_default_bundle()
    turbo = next(m for m in bundle.modes.values() if "turbo" in str(m["mode_key"]))
    mode, lane, stages = resolve_mode_for_intent(
        bundle,
        {"idea": "x", "language": "en", "mode_key": turbo["mode_key"]},
        corpus=None,
    )
    assert mode["mode_key"] == turbo["mode_key"]
    assert str(lane.get("lane") or lane.get("lane_key")) == str(turbo["lane_key"])
    assert stages


@pytest.mark.asyncio
async def test_interpreter_dispatches_handlers_in_order(monkeypatch: pytest.MonkeyPatch) -> None:
    bundle = code_default_bundle()
    mode = resolve_default_mode(bundle)
    assert mode is not None
    stages = enabled_pipeline_stages(bundle, str(mode["mode_key"]))
    short = [s for s in stages if s["stage_type"] in {"intent_normalize", "lyrics_gate"}][:2]
    short_mode_key = str(mode["mode_key"])
    thin = MusicForgeConfigBundle(
        lanes=bundle.lanes,
        styles=bundle.styles,
        prompts=bundle.prompts,
        product=bundle.product,
        version=bundle.version,
        modes={short_mode_key: mode},
        pipelines={short_mode_key: short},
    )

    called: list[str] = []

    async def _fake_handler(ctx: MusicForgePipelineContext, settings: dict[str, Any]) -> dict[str, Any]:
        called.append(ctx.current_step)
        return {"ok": True}

    import api.services.music_forge.pipeline_interpreter as interp_mod

    monkeypatch.setattr(
        interp_mod,
        "STAGE_HANDLERS",
        {k: _fake_handler for k in ALLOWED_STAGE_TYPES},
    )
    monkeypatch.setattr(interp_mod, "record_upstream_success", AsyncMock())
    monkeypatch.setattr(interp_mod, "music_forge_metric_inc", AsyncMock())

    repo = MagicMock()
    repo._ensure_steps_for_pipeline = AsyncMock()
    repo._start_step = AsyncMock()
    repo._complete_step = AsyncMock()
    repo._raise_if_cancelled = AsyncMock()
    repo._set_run_status = AsyncMock()

    ctx = MusicForgePipelineContext(
        db=AsyncMock(),
        ugs=AsyncMock(),
        content_service=None,
        repo=repo,
        config=thin,
        run_id="00000000-0000-4000-8000-000000000099",
        user_id="00000000-0000-4000-8000-000000000001",
        intent={"idea": "night drive", "language": "en", "duration_seconds": 180},
    )
    last = await run_pipeline_interpreter(ctx)
    assert last == "result_ready"
    assert called == [str(s["stage_key"]) for s in short]
    assert repo._ensure_steps_for_pipeline.await_count == 1
    assert repo._set_run_status.await_args.args[1] == "completed"


@pytest.mark.asyncio
async def test_interpreter_skips_stages_listed_in_pipeline_skip_stages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bundle = code_default_bundle()
    mode = resolve_default_mode(bundle)
    assert mode is not None
    stages = enabled_pipeline_stages(bundle, str(mode["mode_key"]))
    short = [
        s for s in stages if str(s.get("stage_key") or "") in {"intent_normalize", "song_blueprint", "lyrics_draft"}
    ][:3]
    short_mode_key = str(mode["mode_key"])
    thin = MusicForgeConfigBundle(
        lanes=bundle.lanes,
        styles=bundle.styles,
        prompts=bundle.prompts,
        product=bundle.product,
        version=bundle.version,
        modes={short_mode_key: mode},
        pipelines={short_mode_key: short},
    )

    called: list[str] = []

    async def _fake_handler(ctx: MusicForgePipelineContext, settings: dict[str, Any]) -> dict[str, Any]:
        called.append(ctx.current_step)
        return {"ok": True}

    import api.services.music_forge.pipeline_interpreter as interp_mod

    monkeypatch.setattr(
        interp_mod,
        "STAGE_HANDLERS",
        {k: _fake_handler for k in ALLOWED_STAGE_TYPES},
    )
    monkeypatch.setattr(interp_mod, "record_upstream_success", AsyncMock())
    monkeypatch.setattr(interp_mod, "music_forge_metric_inc", AsyncMock())

    repo = MagicMock()
    repo._ensure_steps_for_pipeline = AsyncMock()
    repo._start_step = AsyncMock()
    repo._complete_step = AsyncMock()
    repo._skip_step = AsyncMock()
    repo._raise_if_cancelled = AsyncMock()
    repo._set_run_status = AsyncMock()

    ctx = MusicForgePipelineContext(
        db=AsyncMock(),
        ugs=AsyncMock(),
        content_service=None,
        repo=repo,
        config=thin,
        run_id="00000000-0000-4000-8000-000000000099",
        user_id="00000000-0000-4000-8000-000000000001",
        intent={
            "idea": "night drive",
            "language": "en",
            "duration_seconds": 180,
            "pipeline_skip_stages": ["song_blueprint"],
        },
        blueprint={"hook": "Night drive", "title": "Night drive"},
    )
    await run_pipeline_interpreter(ctx)
    assert "song_blueprint" not in called
    assert repo._skip_step.await_count == 1
    skip_args = repo._skip_step.await_args.args
    assert skip_args[1] == "song_blueprint"
