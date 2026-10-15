# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave A Pipeline Architect locks: seeded modes/pipelines, activate hard-gate, stage types.
# Invariants:
# - code_default_bundle exposes Modes with audio_comfy lane binding.
# - Validator rejects missing modes / invalid stage_type / missing audio stage.
# Related:
# - api/services/music_forge/config/stage_types.py
# - api/services/music_forge/config/validator.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from api.services.music_forge.config.seed import code_default_bundle
from api.services.music_forge.config.stage_types import (
    ALLOWED_STAGE_TYPES,
    default_pipeline_for_lane,
)
from api.services.music_forge.config.validator import (
    ConfigBundleValidator,
    _validate_modes_and_pipelines,
)


def test_code_default_bundle_includes_modes_and_pipelines() -> None:
    bundle = code_default_bundle()
    assert bundle.modes
    assert any(m.get("is_default") for m in bundle.modes.values())
    assert set(bundle.modes.keys()) == set(bundle.pipelines.keys())
    default_mode = next(m for m in bundle.modes.values() if m.get("is_default"))
    stages = bundle.pipelines[str(default_mode["mode_key"])]
    types = {str(s["stage_type"]) for s in stages}
    assert "audio_comfy" in types
    assert types <= ALLOWED_STAGE_TYPES
    audio = next(s for s in stages if s["stage_type"] == "audio_comfy")
    assert audio["settings"]["lane_key"] == default_mode["lane_key"]


def test_code_default_bundle_mode_labels_are_user_facing() -> None:
    bundle = code_default_bundle()
    sft = bundle.modes["sft_xl"]
    assert sft["label_ru"] != "sft_xl"
    assert "SFT XL" in str(sft["label_ru"])
    assert "SFT XL" in str(sft["label_en"])


def test_default_pipeline_stage_types_are_closed_registry() -> None:
    stages = default_pipeline_for_lane("SFT XL")
    assert len(stages) == 8
    for stage in stages:
        assert stage["stage_type"] in ALLOWED_STAGE_TYPES


def test_validate_modes_requires_default_enabled_and_audio() -> None:
    lanes = {"SFT XL": {"lane_key": "SFT XL", "is_default": True}}
    prompts = {"blueprint": {}, "lyrics": {}, "style": {}}
    modes = {
        "sft_xl": {
            "mode_key": "sft_xl",
            "enabled": True,
            "is_default": False,
            "lane_key": "SFT XL",
        }
    }
    pipelines = {"sft_xl": [{"stage_key": "x", "stage_type": "intent_normalize", "enabled": True, "settings": {}}]}
    reasons = _validate_modes_and_pipelines(modes, pipelines, lanes, prompts)
    assert "modes_missing_is_default" in reasons
    assert "pipeline_missing_audio_comfy:sft_xl" in reasons


def test_validate_modes_rejects_unknown_stage_type() -> None:
    lanes = {"SFT XL": {"lane_key": "SFT XL", "is_default": True}}
    prompts = {"blueprint": {}, "lyrics": {}, "style": {}}
    modes = {
        "sft_xl": {
            "mode_key": "sft_xl",
            "enabled": True,
            "is_default": True,
            "lane_key": "SFT XL",
        }
    }
    pipelines = {
        "sft_xl": [
            {
                "stage_key": "master",
                "stage_type": "audio_master",
                "enabled": True,
                "settings": {},
            },
            {
                "stage_key": "audio_render",
                "stage_type": "audio_comfy",
                "enabled": True,
                "settings": {"lane_key": "SFT XL"},
            },
        ]
    }
    reasons = _validate_modes_and_pipelines(modes, pipelines, lanes, prompts)
    assert any(r.startswith("stage_type_invalid:sft_xl:master:") for r in reasons)


@pytest.mark.asyncio
async def test_validate_revision_reports_modes_empty() -> None:
    revision_id = uuid4()
    db = AsyncMock()

    class _Result:
        def __init__(self, *, first: Any = None, rows: list | None = None) -> None:
            self._first = first
            self._rows = rows or []

        def first(self) -> Any:
            return self._first

        def mappings(self) -> _Result:
            return self

        def all(self) -> list:
            return self._rows

    async def _execute(stmt: Any, params: dict[str, Any] | None = None) -> _Result:
        sql = str(stmt)
        if "FROM music_forge_config_revisions" in sql and "LIMIT 1" in sql:
            return _Result(first=(revision_id,))
        if "FROM music_forge_lanes" in sql:
            return _Result(
                rows=[
                    {
                        "lane_key": "SFT XL",
                        "ugs_workflow": "v4",
                        "ace_workflow": "v4",
                        "model_scope": "xl_sft",
                        "workflow_file": "ace_sft_new.json",
                        "billing_mode": "music_forge_xl_sft",
                        "ksampler_use_comfy_template": False,
                        "markers": [],
                        "sampler": {},
                        "is_default": True,
                        "sort_order": 1,
                    }
                ]
            )
        if "FROM music_forge_style_profiles" in sql:
            return _Result(
                rows=[
                    {
                        "style_key": "pop",
                        "keyscale": "A minor",
                        "default_vocal": None,
                        "bpm_default": 112,
                        "textures": {},
                        "arrangement": {},
                        "voice": {},
                        "soloist_policy": {},
                    }
                ]
            )
        if "FROM music_forge_prompt_templates" in sql:
            return _Result(
                rows=[
                    {"kind": "blueprint", "system_prompt": "x", "rules": [], "extras": {}},
                    {"kind": "lyrics", "system_prompt": "x", "rules": [], "extras": {}},
                    {"kind": "style", "system_prompt": "x", "rules": [], "extras": {}},
                ]
            )
        if "FROM music_forge_product_settings" in sql:
            return _Result(
                first={
                    "duration_min": 60,
                    "duration_max": 240,
                    "duration_default": 180,
                    "mvp_lane_label": "SFT",
                    "max_completed_runs_per_day": None,
                    "max_completed_runs_per_month": None,
                    "audio_type_key": "music_generator_forge_audio",
                }
            )
        if "FROM music_forge_modes" in sql:
            return _Result(rows=[])
        if "FROM music_forge_pipeline_stages" in sql:
            return _Result(rows=[])
        return _Result()

    db.execute = AsyncMock(side_effect=_execute)
    reasons = await ConfigBundleValidator(db).validate_revision_for_activation(revision_id)
    assert "modes_empty" in reasons
