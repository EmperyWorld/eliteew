# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave C Pipeline Builder locks: mode/stage draft CRUD + closed stage_type gate.
# Invariants:
# - Invalid stage_type rejected; last audio_comfy delete blocked.
# Related:
# - api/services/music_forge/config/admin_ops_pipeline.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.services.music_forge.config import admin_ops_pipeline
from api.services.music_forge.config.stage_types import ALLOWED_STAGE_TYPES


def test_stage_types_catalog_matches_registry() -> None:
    catalog = admin_ops_pipeline.stage_types_catalog()
    assert set(catalog["stage_types"]) == set(ALLOWED_STAGE_TYPES)
    assert catalog["defaults"]
    assert any(d["stage_type"] == "audio_comfy" for d in catalog["defaults"])


@pytest.mark.asyncio
async def test_patch_mode_rejects_unknown_lane(monkeypatch: pytest.MonkeyPatch) -> None:
    revision_id = uuid4()
    db = AsyncMock()
    monkeypatch.setattr(
        admin_ops_pipeline,
        "_require_draft_revision",
        AsyncMock(return_value={"status": "draft"}),
    )
    monkeypatch.setattr(
        admin_ops_pipeline.config_repo,
        "fetch_modes",
        AsyncMock(
            return_value={
                "sft_xl": {
                    "mode_key": "sft_xl",
                    "lane_key": "sft_xl",
                    "enabled": True,
                    "is_default": True,
                }
            }
        ),
    )
    monkeypatch.setattr(
        admin_ops_pipeline.config_repo,
        "fetch_lanes",
        AsyncMock(return_value={"sft_xl": {"lane": "sft_xl"}}),
    )
    with pytest.raises(ValueError, match="music_forge_config_mode_lane_key_unknown"):
        await admin_ops_pipeline.patch_mode_settings(db, revision_id, "sft_xl", {"lane_key": "missing_lane"})


@pytest.mark.asyncio
async def test_create_stage_rejects_unknown_type(monkeypatch: pytest.MonkeyPatch) -> None:
    revision_id = uuid4()
    db = AsyncMock()
    monkeypatch.setattr(
        admin_ops_pipeline,
        "_require_draft_revision",
        AsyncMock(return_value={"status": "draft"}),
    )
    with pytest.raises(ValueError, match="music_forge_config_stage_type_invalid"):
        await admin_ops_pipeline.create_stage(
            db,
            revision_id,
            "sft_xl",
            stage_key="custom_master",
            stage_type="mastering",
        )


@pytest.mark.asyncio
async def test_delete_last_audio_comfy_blocked(monkeypatch: pytest.MonkeyPatch) -> None:
    revision_id = uuid4()
    db = AsyncMock()
    monkeypatch.setattr(
        admin_ops_pipeline,
        "_require_draft_revision",
        AsyncMock(return_value={"status": "draft"}),
    )
    monkeypatch.setattr(
        admin_ops_pipeline.config_repo,
        "fetch_modes",
        AsyncMock(return_value={"sft_xl": {"mode_key": "sft_xl", "lane_key": "sft_xl"}}),
    )
    monkeypatch.setattr(
        admin_ops_pipeline.config_repo,
        "fetch_pipelines",
        AsyncMock(
            return_value={
                "sft_xl": [
                    {
                        "stage_key": "audio_render",
                        "stage_type": "audio_comfy",
                        "enabled": True,
                        "sort_order": 70,
                        "title_ru": "render",
                        "settings": {},
                    }
                ]
            }
        ),
    )
    with pytest.raises(ValueError, match="music_forge_config_stage_delete_last_audio_comfy"):
        await admin_ops_pipeline.delete_stage(db, revision_id, "sft_xl", "audio_render")


@pytest.mark.asyncio
async def test_create_stage_inserts_with_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    revision_id = uuid4()
    db = AsyncMock()
    db.execute = AsyncMock()
    monkeypatch.setattr(
        admin_ops_pipeline,
        "_require_draft_revision",
        AsyncMock(return_value={"status": "draft"}),
    )
    monkeypatch.setattr(
        admin_ops_pipeline.config_repo,
        "fetch_modes",
        AsyncMock(return_value={"sft_xl": {"mode_key": "sft_xl", "lane_key": "sft_xl"}}),
    )
    monkeypatch.setattr(
        admin_ops_pipeline.config_repo,
        "fetch_pipelines",
        AsyncMock(
            side_effect=[
                {"sft_xl": []},
                {
                    "sft_xl": [
                        {
                            "stage_key": "lyrics_gate_extra",
                            "stage_type": "lyrics_gate",
                            "title_ru": "Проверка текста",
                            "sort_order": 10,
                            "enabled": True,
                            "settings": {"fail_on": ["empty_lyrics", "json_leak"]},
                        }
                    ]
                },
            ]
        ),
    )
    row = await admin_ops_pipeline.create_stage(
        db,
        revision_id,
        "sft_xl",
        stage_key="lyrics_gate_extra",
        stage_type="lyrics_gate",
    )
    assert row["stage_key"] == "lyrics_gate_extra"
    assert row["stage_type"] == "lyrics_gate"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_mode_seeds_pipeline(monkeypatch: pytest.MonkeyPatch) -> None:
    revision_id = uuid4()
    db = AsyncMock()
    db.execute = AsyncMock()
    monkeypatch.setattr(
        admin_ops_pipeline,
        "_require_draft_revision",
        AsyncMock(return_value={"status": "draft"}),
    )
    monkeypatch.setattr(
        admin_ops_pipeline.config_repo,
        "fetch_lanes",
        AsyncMock(return_value={"sft_xl": {"lane": "sft_xl"}}),
    )
    monkeypatch.setattr(
        admin_ops_pipeline.config_repo,
        "fetch_modes",
        AsyncMock(
            side_effect=[
                {},
                {
                    "custom_sft": {
                        "mode_key": "custom_sft",
                        "label_ru": "Custom",
                        "label_en": "Custom",
                        "lane_key": "sft_xl",
                        "enabled": True,
                        "is_default": True,
                    }
                },
            ]
        ),
    )
    row = await admin_ops_pipeline.create_mode(
        db,
        revision_id,
        mode_key="custom_sft",
        label_ru="Custom",
        label_en="Custom",
        lane_key="sft_xl",
    )
    assert row["mode_key"] == "custom_sft"
    assert db.execute.await_count >= 2
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_mode_rejects_duplicate_key(monkeypatch: pytest.MonkeyPatch) -> None:
    revision_id = uuid4()
    db = AsyncMock()
    monkeypatch.setattr(
        admin_ops_pipeline,
        "_require_draft_revision",
        AsyncMock(return_value={"status": "draft"}),
    )
    monkeypatch.setattr(
        admin_ops_pipeline.config_repo,
        "fetch_lanes",
        AsyncMock(return_value={"sft_xl": {"lane": "sft_xl"}}),
    )
    monkeypatch.setattr(
        admin_ops_pipeline.config_repo,
        "fetch_modes",
        AsyncMock(return_value={"sft_xl": {"mode_key": "sft_xl", "lane_key": "sft_xl"}}),
    )
    with pytest.raises(ValueError, match="music_forge_config_mode_key_duplicate"):
        await admin_ops_pipeline.create_mode(
            db,
            revision_id,
            mode_key="sft_xl",
            label_ru="Dup",
            label_en="Dup",
            lane_key="sft_xl",
        )


@pytest.mark.asyncio
async def test_delete_mode_blocked_when_last(monkeypatch: pytest.MonkeyPatch) -> None:
    revision_id = uuid4()
    db = AsyncMock()
    monkeypatch.setattr(
        admin_ops_pipeline,
        "_require_draft_revision",
        AsyncMock(return_value={"status": "draft"}),
    )
    monkeypatch.setattr(
        admin_ops_pipeline.config_repo,
        "fetch_modes",
        AsyncMock(return_value={"sft_xl": {"mode_key": "sft_xl", "is_default": True}}),
    )
    with pytest.raises(ValueError, match="music_forge_config_mode_delete_last"):
        await admin_ops_pipeline.delete_mode(db, revision_id, "sft_xl")


@pytest.mark.asyncio
async def test_gateway_delegates_mode_patch(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.music_forge.config.gateway import MusicForgeConfigGateway

    db = MagicMock()
    revision_id = uuid4()
    expected = {"mode_key": "sft_xl", "label_ru": "SFT"}
    monkeypatch.setattr(
        admin_ops_pipeline,
        "patch_mode_settings",
        AsyncMock(return_value=expected),
    )
    gateway = MusicForgeConfigGateway(db)
    out = await gateway.patch_mode_settings(revision_id, "sft_xl", {"label_ru": "SFT"})
    assert out == expected
