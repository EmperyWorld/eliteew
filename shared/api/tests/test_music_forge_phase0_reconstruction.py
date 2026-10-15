# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 0 reconstruction locks: fail-closed config, activate hard-gate, reconcile orphans.
# Invariants:
# - get_active without active revision raises MusicForgeConfigUnavailableError (no code fallback).
# - Incomplete bundle cannot activate.
# Related:
# - api/services/music_forge/config/
# - api/services/music_forge/reconcile.py
# ---
"""Phase 0 MusicForge reconstruction contract tests."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from api.schemas.music_forge_admin import MusicForgeAdminConfigRevisionListOut
from api.services.music_forge.config import (
    MusicForgeConfigActivationInvalidError,
    MusicForgeConfigService,
    MusicForgeConfigUnavailableError,
    code_default_bundle,
)
from api.services.music_forge.config import coordinator as config_coordinator
from api.services.music_forge.reconcile import RECONCILE_ORPHAN_ERROR, reconcile_orphan_runs


class _Result:
    def __init__(self, rows: list[Any] | None = None, first: Any = None) -> None:
        self._rows = rows or []
        self._first = first

    def mappings(self) -> _Result:
        return self

    def all(self) -> list[Any]:
        return list(self._rows)

    def first(self) -> Any:
        return self._first


@pytest.fixture
def stub_config_coordinator(monkeypatch: pytest.MonkeyPatch) -> None:
    """Изолировать Redis/meta generation в unit-тестах gateway."""
    monkeypatch.setattr(config_coordinator, "read_redis_generation", AsyncMock(return_value=None))
    monkeypatch.setattr(config_coordinator, "fetch_pg_generation", AsyncMock(return_value=1))
    monkeypatch.setattr(config_coordinator, "publish_generation", AsyncMock())
    monkeypatch.setattr(config_coordinator, "clear_local_cache", config_coordinator.clear_local_cache)
    config_coordinator.clear_local_cache()


@pytest.mark.asyncio
async def test_get_active_raises_without_active_revision(stub_config_coordinator: None) -> None:
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_Result(first=None))
    service = MusicForgeConfigService(db)
    MusicForgeConfigService.invalidate()
    with pytest.raises(MusicForgeConfigUnavailableError) as exc:
        await service.get_active()
    assert exc.value.detail == "music_forge_config_unavailable"


@pytest.mark.asyncio
async def test_get_active_raises_when_active_missing_default_lane(
    stub_config_coordinator: None,
) -> None:
    revision_id = uuid4()
    db = AsyncMock()

    async def _execute(stmt: Any, params: dict[str, Any] | None = None) -> Any:
        sql = str(stmt)
        if "WHERE status = 'active'" in sql:
            return _Result(first={"id": revision_id, "version": "broken", "status": "active", "activated_at": None})

        class _Map:
            def mappings(self) -> Any:
                return self

            def all(self) -> list[dict[str, Any]]:
                if "FROM music_forge_lanes" in sql:
                    return [
                        {
                            "lane_key": "sft",
                            "ugs_workflow": "v4",
                            "ace_workflow": "x",
                            "model_scope": "sft",
                            "workflow_file": "x.json",
                            "billing_mode": "default",
                            "ksampler_use_comfy_template": False,
                            "markers": [],
                            "sampler": {},
                            "is_default": False,
                            "sort_order": 0,
                        }
                    ]
                if "FROM music_forge_style_profiles" in sql:
                    return [
                        {
                            "style_key": "default",
                            "keyscale": "A minor",
                            "default_vocal": "female",
                            "bpm_default": 120,
                            "textures": {},
                            "arrangement": {},
                            "voice": {},
                            "soloist_policy": {},
                        }
                    ]
                if "FROM music_forge_prompt_templates" in sql:
                    return [
                        {"kind": "blueprint", "system_prompt": "a", "rules": [], "extras": {}},
                        {"kind": "lyrics", "system_prompt": "b", "rules": [], "extras": {}},
                        {"kind": "style", "system_prompt": "c", "rules": [], "extras": {}},
                    ]
                return []

            def first(self) -> dict[str, Any] | None:
                if "FROM music_forge_product_settings" in sql:
                    return {
                        "duration_min": 60,
                        "duration_max": 240,
                        "duration_default": 120,
                        "mvp_lane_label": "sft",
                        "max_completed_runs_per_day": None,
                        "max_completed_runs_per_month": None,
                        "audio_type_key": "music_generator_evolution_xl_base",
                    }
                return None

        return _Map()

    db.execute = AsyncMock(side_effect=_execute)
    service = MusicForgeConfigService(db)
    MusicForgeConfigService.invalidate()
    with pytest.raises(MusicForgeConfigUnavailableError):
        await service.get_active()


@pytest.mark.asyncio
async def test_validate_revision_requires_default_lane_prompts_product() -> None:
    revision_id = uuid4()
    db = AsyncMock()

    async def _execute(stmt: Any, params: dict[str, Any] | None = None) -> _Result:
        sql = str(stmt)
        if "FROM music_forge_config_revisions" in sql and "LIMIT 1" in sql:
            return _Result(first=(revision_id,))
        if "FROM music_forge_lanes" in sql:
            return _Result(rows=[])  # empty lanes
        if "FROM music_forge_style_profiles" in sql:
            return _Result(rows=[])
        if "FROM music_forge_prompt_templates" in sql:
            return _Result(rows=[])
        if "FROM music_forge_product_settings" in sql:
            return _Result(first=None)
        return _Result()

    db.execute = AsyncMock(side_effect=_execute)
    service = MusicForgeConfigService(db)
    reasons = await service.validate_revision_for_activation(revision_id)
    assert "lanes_empty" in reasons
    assert "styles_empty" in reasons
    assert any(r.startswith("prompts_missing:") for r in reasons)
    assert "product_settings_missing" in reasons
    assert "modes_empty" in reasons


@pytest.mark.asyncio
async def test_activate_raises_422_class_on_invalid_bundle() -> None:
    revision_id = uuid4()
    db = AsyncMock()

    async def _execute(stmt: Any, params: dict[str, Any] | None = None) -> _Result:
        sql = str(stmt)
        if "FROM music_forge_config_revisions" in sql and "LIMIT 1" in sql:
            return _Result(first=(revision_id,))
        return _Result(rows=[], first=None)

    db.execute = AsyncMock(side_effect=_execute)
    service = MusicForgeConfigService(db)
    with pytest.raises(MusicForgeConfigActivationInvalidError) as exc:
        await service.activate_revision(revision_id, None)
    assert exc.value.reasons


def test_admin_config_revision_list_envelope_schema() -> None:
    model = MusicForgeAdminConfigRevisionListOut(items=[], total=0)
    dumped = model.model_dump()
    assert set(dumped.keys()) == {"items", "total"}
    assert dumped["total"] == 0


def test_code_default_bundle_still_available_for_seed_tests_only() -> None:
    bundle = code_default_bundle()
    assert bundle.version == "v1-platform-code"
    assert any(lane.get("is_default") for lane in bundle.lanes.values())


def test_celery_beat_registers_music_forge_orphan_reconcile() -> None:
    from api.tasks.celery_app import celery_app

    entry = celery_app.conf.beat_schedule.get("music-forge-orphan-run-reconcile")
    assert entry is not None
    assert entry["task"] == "api.tasks.music_forge.reconcile_orphan_runs"


def test_music_forge_pipeline_task_time_limits_above_comfy_music_timeout() -> None:
    """Global Celery soft=540 < Comfy music timeout=600; task must override higher."""
    from api.tasks.music_forge import run_music_forge_pipeline_task

    comfy_music_timeout_floor = 600
    soft = int(run_music_forge_pipeline_task.soft_time_limit)
    hard = int(run_music_forge_pipeline_task.time_limit)
    assert soft >= comfy_music_timeout_floor
    assert hard > soft


@pytest.mark.asyncio
async def test_reconcile_orphan_runs_marks_stale_non_terminal() -> None:
    run_id = uuid4()
    executed: list[str] = []

    class _Db2:
        async def execute(self, stmt: Any, params: dict[str, Any] | None = None) -> Any:
            sql = str(stmt)
            executed.append("SQL" if "UPDATE" in sql or "SELECT" in sql else sql)

            class _Map:
                def mappings(self) -> Any:
                    return self

                def all(self) -> list[dict[str, Any]]:
                    if "SELECT id" in sql:
                        return [{"id": run_id}]
                    return []

            return _Map()

        async def commit(self) -> None:
            executed.append("COMMIT")

    count = await reconcile_orphan_runs(_Db2(), stale_after_seconds=1, limit=10)
    assert count == 1
    assert "COMMIT" in executed
    assert RECONCILE_ORPHAN_ERROR["stage"] == "reconcile_orphan"
