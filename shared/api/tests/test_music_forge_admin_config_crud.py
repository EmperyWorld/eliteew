# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for MusicForge admin config draft/CRUD gateway helpers (Phase 1-T3).
# Invariants:
# - create_draft_from_active fails closed without active revision.
# - patch_product_settings rejects non-draft revisions.
# Related:
# - api/services/music_forge/config/admin_ops.py
# - api/services/music_forge/config/gateway.py
# ---
"""MusicForge admin config draft/CRUD tests."""

from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest

from api.services.music_forge.config import admin_ops
from api.services.music_forge.config.gateway import MusicForgeConfigGateway
from api.services.music_forge.config.types import MusicForgeConfigUnavailableError


@pytest.mark.asyncio
async def test_create_draft_from_active_raises_without_active(monkeypatch: pytest.MonkeyPatch) -> None:
    db = AsyncMock()
    monkeypatch.setattr(admin_ops.config_repo, "fetch_active_revision_row", AsyncMock(return_value=None))
    gateway = MusicForgeConfigGateway(db)
    with pytest.raises(MusicForgeConfigUnavailableError):
        await gateway.create_draft_from_active(uuid4())


@pytest.mark.asyncio
async def test_create_draft_from_active_copies_bundle_and_commits(monkeypatch: pytest.MonkeyPatch) -> None:
    active_id = uuid4()
    new_id = uuid4()
    db = AsyncMock()
    revision_row = {
        "id": new_id,
        "version": "draft-v1-platform-abc12345",
        "status": "draft",
        "notes": None,
        "activated_at": None,
        "created_by": None,
        "created_at": "2026-07-20T00:00:00Z",
        "updated_at": "2026-07-20T00:00:00Z",
    }

    monkeypatch.setattr(
        admin_ops.config_repo,
        "fetch_active_revision_row",
        AsyncMock(return_value={"id": active_id, "version": "v1-platform"}),
    )

    execute_results = [
        type("R", (), {"mappings": lambda self: self, "first": lambda self: revision_row})(),
    ]
    # INSERT revision + copy lanes/styles/prompts/product/modes/pipeline_stages
    db.execute = AsyncMock(side_effect=execute_results + [AsyncMock() for _ in range(6)])

    result = await admin_ops.create_draft_from_active(db, None)
    assert result["status"] == "draft"
    assert result["id"] == new_id
    assert db.execute.await_count == 7
    first_call = db.execute.await_args_list[0]
    # SQL params are the second positional arg to execute(text(...), params)
    params = first_call.args[1] if len(first_call.args) > 1 else first_call.kwargs.get("parameters")
    assert params is not None
    assert str(params["version"]).startswith("draft-v1-platform-")
    assert "draft-draft-" not in str(params["version"])
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_draft_strips_nested_draft_active_label(monkeypatch: pytest.MonkeyPatch) -> None:
    active_id = uuid4()
    new_id = uuid4()
    db = AsyncMock()
    revision_row = {
        "id": new_id,
        "version": "draft-platform-deadbeef",
        "status": "draft",
        "notes": None,
        "activated_at": None,
        "created_by": None,
        "created_at": "2026-07-20T00:00:00Z",
        "updated_at": "2026-07-20T00:00:00Z",
    }
    monkeypatch.setattr(
        admin_ops.config_repo,
        "fetch_active_revision_row",
        AsyncMock(
            return_value={
                "id": active_id,
                "version": "draft-draft-v1-platform-d8bc2449-cfbbb9d7",
            }
        ),
    )
    db.execute = AsyncMock(
        side_effect=[
            type("R", (), {"mappings": lambda self: self, "first": lambda self: revision_row})(),
            *[AsyncMock() for _ in range(6)],
        ]
    )
    await admin_ops.create_draft_from_active(db, None)
    params = db.execute.await_args_list[0].args[1]
    assert params["version"].startswith("draft-v1-platform-")
    assert not params["version"].startswith("draft-draft-")


@pytest.mark.asyncio
async def test_purge_retired_revisions_deletes_and_commits(monkeypatch: pytest.MonkeyPatch) -> None:
    db = AsyncMock()
    listed = [
        {"id": uuid4(), "version": "draft-junk-aaaaaaaa"},
        {"id": uuid4(), "version": "v1-platform"},
    ]

    class _MapResult:
        def mappings(self):
            return self

        def all(self):
            return listed

    db.execute = AsyncMock(side_effect=[_MapResult(), AsyncMock()])
    out = await admin_ops.purge_retired_revisions(db)
    assert out["deleted"] == 2
    assert out["versions"] == ["draft-junk-aaaaaaaa", "v1-platform"]
    assert db.execute.await_count == 2
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_rename_revision_version_conflict_and_success(monkeypatch: pytest.MonkeyPatch) -> None:
    revision_id = uuid4()
    db = AsyncMock()
    monkeypatch.setattr(
        admin_ops.config_repo,
        "fetch_revision_row",
        AsyncMock(
            return_value={
                "id": revision_id,
                "version": "old-label",
                "status": "draft",
            }
        ),
    )
    # First: UNIQUE clash
    db.execute = AsyncMock(
        side_effect=[
            type("R", (), {"first": lambda self: (uuid4(),)})(),
        ]
    )
    with pytest.raises(ValueError, match="music_forge_config_version_conflict"):
        await admin_ops.rename_revision_version(db, revision_id, version="taken")

    updated = {
        "id": revision_id,
        "version": "platform",
        "status": "draft",
        "notes": "n",
        "activated_at": None,
        "created_by": None,
        "created_at": "2026-07-20T00:00:00Z",
        "updated_at": "2026-07-20T00:00:00Z",
    }
    db.execute = AsyncMock(
        side_effect=[
            type("R", (), {"first": lambda self: None})(),
            type("R", (), {"mappings": lambda self: self, "first": lambda self: updated})(),
        ]
    )
    out = await admin_ops.rename_revision_version(db, revision_id, version="platform", notes="n")
    assert out["version"] == "platform"
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_gateway_rename_active_bumps_generation(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.music_forge.config import coordinator
    from api.services.music_forge.config.gateway import MusicForgeConfigGateway

    revision_id = uuid4()
    db = AsyncMock()
    renamed = {
        "id": revision_id,
        "version": "platform",
        "status": "active",
        "notes": None,
        "activated_at": None,
        "created_by": None,
        "created_at": "2026-07-20T00:00:00Z",
        "updated_at": "2026-07-20T00:00:00Z",
    }
    monkeypatch.setattr(
        admin_ops,
        "rename_revision_version",
        AsyncMock(return_value=renamed),
    )
    monkeypatch.setattr(coordinator, "bump_pg_generation", AsyncMock(return_value=42))
    monkeypatch.setattr(coordinator, "publish_generation", AsyncMock())
    monkeypatch.setattr(coordinator, "clear_local_cache", lambda: None)
    gateway = MusicForgeConfigGateway(db)
    out = await gateway.rename_revision_version(revision_id, version="platform")
    assert out["config_generation"] == 42
    coordinator.bump_pg_generation.assert_awaited_once()
    coordinator.publish_generation.assert_awaited_once_with(42)
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_patch_product_settings_rejects_non_draft(monkeypatch: pytest.MonkeyPatch) -> None:
    revision_id = uuid4()
    db = AsyncMock()
    monkeypatch.setattr(
        admin_ops.config_repo,
        "fetch_revision_row",
        AsyncMock(
            return_value={
                "id": revision_id,
                "version": "v1-platform",
                "status": "active",
            }
        ),
    )
    gateway = MusicForgeConfigGateway(db)
    with pytest.raises(ValueError, match="music_forge_config_revision_not_draft"):
        await gateway.patch_product_settings(revision_id, {"duration_default": 120})


@pytest.mark.asyncio
async def test_patch_product_settings_updates_draft(monkeypatch: pytest.MonkeyPatch) -> None:
    revision_id = uuid4()
    db = AsyncMock()
    monkeypatch.setattr(
        admin_ops.config_repo,
        "fetch_revision_row",
        AsyncMock(
            return_value={
                "id": revision_id,
                "version": "draft-v1",
                "status": "draft",
            }
        ),
    )
    updated_row = {
        "duration_min": 60,
        "duration_max": 240,
        "duration_default": 120,
        "mvp_lane_label": "SFT XL",
        "max_completed_runs_per_day": None,
        "max_completed_runs_per_month": None,
        "audio_type_key": "music_generator_evolution_xl_base",
    }
    db.execute = AsyncMock(
        return_value=type("R", (), {"mappings": lambda self: self, "first": lambda self: updated_row})()
    )
    result = await admin_ops.patch_product_settings(db, revision_id, {"duration_default": 120})
    assert result["duration_default"] == 120
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_diff_revision_against_active_reports_product_change(monkeypatch: pytest.MonkeyPatch) -> None:
    active_id = uuid4()
    target_id = uuid4()
    db = AsyncMock()
    monkeypatch.setattr(
        admin_ops.config_repo,
        "fetch_active_revision_row",
        AsyncMock(return_value={"id": active_id, "version": "v1-platform"}),
    )
    monkeypatch.setattr(
        admin_ops.config_repo,
        "fetch_revision_row",
        AsyncMock(return_value={"id": target_id, "version": "draft-v1"}),
    )
    monkeypatch.setattr(admin_ops.config_repo, "fetch_lanes", AsyncMock(return_value={}))
    monkeypatch.setattr(admin_ops.config_repo, "fetch_styles", AsyncMock(return_value={}))
    monkeypatch.setattr(admin_ops.config_repo, "fetch_prompts", AsyncMock(return_value={}))
    monkeypatch.setattr(admin_ops.config_repo, "fetch_modes", AsyncMock(return_value={}))
    monkeypatch.setattr(admin_ops.config_repo, "fetch_pipelines", AsyncMock(return_value={}))
    product_side_effect = [
        {"duration_default": 180, "duration_min": 60, "duration_max": 240},
        {"duration_default": 120, "duration_min": 60, "duration_max": 240},
    ]
    monkeypatch.setattr(admin_ops.config_repo, "fetch_product", AsyncMock(side_effect=product_side_effect))

    payload = await admin_ops.diff_revision_against_active(db, target_id)
    assert payload["base_version"] == "v1-platform"
    assert payload["target_version"] == "draft-v1"
    paths = [change["path"] for change in payload["changes"]]
    assert "product.duration_default" in paths


@pytest.mark.asyncio
async def test_get_revision_bundle_raises_when_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    db = AsyncMock()
    missing_id = UUID("00000000-0000-4000-8000-000000000001")
    monkeypatch.setattr(admin_ops.config_repo, "fetch_revision_row", AsyncMock(return_value=None))
    with pytest.raises(ValueError, match="music_forge_config_revision_not_found"):
        await admin_ops.get_revision_bundle(db, missing_id)


@pytest.mark.asyncio
async def test_patch_lane_rejects_invalid_ugs_workflow(monkeypatch: pytest.MonkeyPatch) -> None:
    revision_id = uuid4()
    db = AsyncMock()
    monkeypatch.setattr(
        admin_ops.config_repo,
        "fetch_revision_row",
        AsyncMock(return_value={"id": revision_id, "status": "draft", "version": "draft-v1"}),
    )
    monkeypatch.setattr(
        admin_ops.config_repo,
        "fetch_lanes",
        AsyncMock(
            return_value={
                "sft_xl": {
                    "lane": "sft_xl",
                    "ugs_workflow": "v4",
                    "workflow_file": "ace_sft_new.json",
                }
            }
        ),
    )
    with pytest.raises(ValueError, match="music_forge_config_lane_ugs_workflow_invalid"):
        await admin_ops.patch_lane_settings(db, revision_id, "sft_xl", {"ugs_workflow": "not_a_real_workflow"})


@pytest.mark.asyncio
async def test_preview_audio_payload_returns_builder_and_sampler(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    revision_id = uuid4()
    db = AsyncMock()
    monkeypatch.setattr(
        admin_ops,
        "get_revision_bundle",
        AsyncMock(
            return_value={
                "revision": {
                    "id": revision_id,
                    "version": "draft-v1",
                    "status": "draft",
                },
                "lanes": {
                    "sft_xl": {
                        "lane": "sft_xl",
                        "lane_key": "sft_xl",
                        "ugs_workflow": "v4",
                        "ace_workflow": "v4",
                        "model_scope": "xl_sft",
                        "workflow_file": "ace_sft_new.json",
                        "billing_mode": "music_forge_xl_sft",
                        "ksampler_use_comfy_template": False,
                        "markers": [],
                        "sampler": {"cfg": 9.0, "steps": 40, "sampler_name": "jkass_admin"},
                        "is_default": True,
                        "sort_order": 0,
                    }
                },
                "styles": {},
                "prompts": {
                    "blueprint": {"kind": "blueprint", "system_prompt": "x", "rules": [], "extras": {}},
                    "lyrics": {"kind": "lyrics", "system_prompt": "x", "rules": [], "extras": {}},
                    "style": {"kind": "style", "system_prompt": "x", "rules": [], "extras": {}},
                },
                "product": {
                    "duration_min": 60,
                    "duration_max": 240,
                    "duration_default": 180,
                    "mvp_lane_label": "SFT XL",
                    "audio_type_key": "music_generator_forge_audio",
                },
            }
        ),
    )
    payload = await admin_ops.preview_audio_payload(db, revision_id, idea="Night drive home")
    assert payload["resolved_builder"] == "v4_sft"
    assert payload["lane_key"] == "sft_xl"
    assert payload["input_data"]["cfg"] == 9.0
    assert payload["input_data"]["sampler_name"] == "jkass_admin"
