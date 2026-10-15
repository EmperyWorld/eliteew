# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MusicForge ConfigGateway — load active bundle by config_generation stamp.
# Invariants:
# - Process cache только при совпадении generation (Redis/PG); без TTL-only.
# - Нет/неполный active → MusicForgeConfigUnavailableError.
# - activate: hard-gate + bump generation в той же PG-транзакции + Redis publish.
# Related:
# - api/services/music_forge/config/coordinator.py
# - api/services/music_forge/config/admin_ops.py
# - api/services/music_forge/config/validator.py
# - documentation/product/MUSIC-FORGE-APP.md
# ---
"""MusicForge ConfigGateway."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.services.music_forge.config import admin_ops, admin_ops_pipeline, coordinator
from api.services.music_forge.config import repository as config_repo
from api.services.music_forge.config.types import (
    REQUIRED_PROMPT_KINDS,
    MusicForgeConfigActivationInvalidError,
    MusicForgeConfigBundle,
    MusicForgeConfigUnavailableError,
)
from api.services.music_forge.config.validator import ConfigBundleValidator

logger = logging.getLogger(__name__)


class MusicForgeConfigGateway:
    """Load and activate MusicForge configuration revisions (distributed generation)."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self._validator = ConfigBundleValidator(db)

    @staticmethod
    def invalidate() -> None:
        coordinator.clear_local_cache()

    async def get_active(self) -> MusicForgeConfigBundle:
        """Загрузить active revision. Cache hit только при match generation."""
        redis_gen = await coordinator.read_redis_generation()
        if redis_gen is not None:
            cached = coordinator.get_local_cached(redis_gen)
            if cached is not None:
                return cached

        pg_gen = await coordinator.fetch_pg_generation(self.db)
        if redis_gen is not None and redis_gen == pg_gen:
            cached = coordinator.get_local_cached(pg_gen)
            if cached is not None:
                return cached
        elif redis_gen is None:
            # Redis down/miss — не использовать stale local без stamp.
            coordinator.clear_local_cache()
            await coordinator.publish_generation(pg_gen)
        elif redis_gen != pg_gen:
            await coordinator.publish_generation(pg_gen)
            coordinator.clear_local_cache()

        # Reload from PG — сбросить любой stale local (другое generation).
        coordinator.clear_local_cache()
        revision_row = await config_repo.fetch_active_revision_row(self.db)
        if revision_row is None:
            logger.error("[STEP] music_forge_config_unavailable no active DB revision")
            raise MusicForgeConfigUnavailableError("music_forge_config_unavailable")

        revision_id = revision_row["id"]
        lanes = await config_repo.fetch_lanes(self.db, revision_id)
        styles = await config_repo.fetch_styles(self.db, revision_id)
        prompts = await config_repo.fetch_prompts(self.db, revision_id)
        product = await config_repo.fetch_product(self.db, revision_id)
        modes = await config_repo.fetch_modes(self.db, revision_id)
        pipelines = await config_repo.fetch_pipelines(self.db, revision_id)
        missing_prompts = sorted(REQUIRED_PROMPT_KINDS - set(prompts.keys()))
        enabled_modes = [m for m in modes.values() if m.get("enabled")]
        incomplete = (
            not lanes
            or not any(bool(lane.get("is_default")) for lane in lanes.values())
            or not styles
            or bool(missing_prompts)
            or not product
            or not enabled_modes
            or not any(bool(m.get("is_default")) for m in enabled_modes)
            or any(not [s for s in pipelines.get(str(m["mode_key"]), []) if s.get("enabled")] for m in enabled_modes)
        )
        if incomplete:
            logger.error(
                "[STEP] music_forge_config_unavailable incomplete active revision_id=%s",
                revision_id,
            )
            raise MusicForgeConfigUnavailableError("music_forge_config_unavailable")

        bundle = MusicForgeConfigBundle(
            lanes=lanes,
            styles=styles,
            prompts=prompts,
            product=product,
            version=str(revision_row["version"]),
            revision_id=revision_id,
            config_generation=pg_gen,
            modes=modes,
            pipelines=pipelines,
        )
        coordinator.set_local_cache(pg_gen, bundle)
        return bundle

    async def list_revisions(self) -> list[dict[str, Any]]:
        """Список ревизий для admin UI."""
        result = await self.db.execute(
            text(
                """
                SELECT id, version, status, notes, activated_at, created_by, created_at, updated_at
                FROM music_forge_config_revisions
                ORDER BY created_at DESC
                """
            )
        )
        return [dict(row) for row in result.mappings().all()]

    async def create_draft_from_active(
        self,
        user_id: UUID | None,
        *,
        version: str | None = None,
        notes: str | None = None,
    ) -> dict[str, Any]:
        return await admin_ops.create_draft_from_active(
            self.db,
            user_id,
            version=version,
            notes=notes,
        )

    async def purge_retired_revisions(self) -> dict[str, Any]:
        return await admin_ops.purge_retired_revisions(self.db)

    async def rename_revision_version(
        self,
        revision_id: UUID,
        *,
        version: str,
        notes: str | None = None,
    ) -> dict[str, Any]:
        row = await admin_ops.rename_revision_version(
            self.db,
            revision_id,
            version=version,
            notes=notes,
        )
        # Active label is part of run provenance — bump generation so workers reload.
        if str(row.get("status") or "") == "active":
            generation = await coordinator.bump_pg_generation(self.db)
            await self.db.commit()
            await coordinator.publish_generation(generation)
            coordinator.clear_local_cache()
            row = dict(row)
            row["config_generation"] = generation
        return row

    async def get_revision_bundle(self, revision_id: UUID) -> dict[str, Any]:
        return await admin_ops.get_revision_bundle(self.db, revision_id)

    async def diff_revision_against_active(self, revision_id: UUID) -> dict[str, Any]:
        return await admin_ops.diff_revision_against_active(self.db, revision_id)

    async def patch_product_settings(self, revision_id: UUID, patch: dict[str, Any]) -> dict[str, Any]:
        return await admin_ops.patch_product_settings(self.db, revision_id, patch)

    async def patch_lane_settings(self, revision_id: UUID, lane_key: str, patch: dict[str, Any]) -> dict[str, Any]:
        return await admin_ops.patch_lane_settings(self.db, revision_id, lane_key, patch)

    async def patch_prompt_settings(self, revision_id: UUID, kind: str, patch: dict[str, Any]) -> dict[str, Any]:
        return await admin_ops.patch_prompt_settings(self.db, revision_id, kind, patch)

    async def patch_style_settings(self, revision_id: UUID, style_key: str, patch: dict[str, Any]) -> dict[str, Any]:
        return await admin_ops.patch_style_settings(self.db, revision_id, style_key, patch)

    async def patch_mode_settings(self, revision_id: UUID, mode_key: str, patch: dict[str, Any]) -> dict[str, Any]:
        return await admin_ops_pipeline.patch_mode_settings(self.db, revision_id, mode_key, patch)

    async def create_mode(
        self,
        revision_id: UUID,
        *,
        mode_key: str,
        label_ru: str,
        label_en: str,
        lane_key: str,
        description: str | None = None,
        enabled: bool = True,
        is_default: bool | None = None,
        sort_order: int | None = None,
        style_hint_default: str | None = None,
    ) -> dict[str, Any]:
        return await admin_ops_pipeline.create_mode(
            self.db,
            revision_id,
            mode_key=mode_key,
            label_ru=label_ru,
            label_en=label_en,
            lane_key=lane_key,
            description=description,
            enabled=enabled,
            is_default=is_default,
            sort_order=sort_order,
            style_hint_default=style_hint_default,
        )

    async def delete_mode(self, revision_id: UUID, mode_key: str) -> dict[str, Any]:
        return await admin_ops_pipeline.delete_mode(self.db, revision_id, mode_key)

    async def patch_stage_settings(
        self, revision_id: UUID, mode_key: str, stage_key: str, patch: dict[str, Any]
    ) -> dict[str, Any]:
        return await admin_ops_pipeline.patch_stage_settings(self.db, revision_id, mode_key, stage_key, patch)

    async def create_stage(
        self,
        revision_id: UUID,
        mode_key: str,
        *,
        stage_key: str,
        stage_type: str,
        title_ru: str | None = None,
        sort_order: int | None = None,
        enabled: bool = True,
        settings: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await admin_ops_pipeline.create_stage(
            self.db,
            revision_id,
            mode_key,
            stage_key=stage_key,
            stage_type=stage_type,
            title_ru=title_ru,
            sort_order=sort_order,
            enabled=enabled,
            settings=settings,
        )

    async def delete_stage(self, revision_id: UUID, mode_key: str, stage_key: str) -> dict[str, Any]:
        return await admin_ops_pipeline.delete_stage(self.db, revision_id, mode_key, stage_key)

    async def preview_audio_payload(
        self,
        revision_id: UUID,
        *,
        idea: str = "Admin preview song idea",
        style_hint: str | None = None,
        constraints: str | None = None,
        language: str = "auto",
        duration_seconds: int = 220,
    ) -> dict[str, Any]:
        return await admin_ops.preview_audio_payload(
            self.db,
            revision_id,
            idea=idea,
            style_hint=style_hint,
            constraints=constraints,
            language=language,
            duration_seconds=duration_seconds,
        )

    async def validate_revision_for_activation(self, revision_id: UUID) -> list[str]:
        return await self._validator.validate_revision_for_activation(revision_id)

    async def activate_revision(self, revision_id: UUID, user_id: UUID | None) -> dict[str, Any]:
        """Activate после hard-gate; bump generation в той же транзакции."""
        reasons = await self.validate_revision_for_activation(revision_id)
        if reasons:
            if len(reasons) == 1 and reasons[0].startswith("music_forge_config_revision_not_found:"):
                raise ValueError(reasons[0])
            raise MusicForgeConfigActivationInvalidError(reasons)
        await self.db.execute(
            text(
                """
                UPDATE music_forge_config_revisions
                SET status = 'retired', updated_at = NOW()
                WHERE status = 'active' AND id <> CAST(:revision_id AS uuid)
                """
            ),
            {"revision_id": str(revision_id)},
        )
        result = await self.db.execute(
            text(
                """
                UPDATE music_forge_config_revisions
                SET status = 'active',
                    activated_at = NOW(),
                    updated_at = NOW(),
                    created_by = COALESCE(created_by, CAST(:user_id AS uuid))
                WHERE id = CAST(:revision_id AS uuid)
                RETURNING id, version, status, activated_at
                """
            ),
            {"revision_id": str(revision_id), "user_id": str(user_id) if user_id else None},
        )
        row = result.mappings().first()
        if row is None:
            raise ValueError(f"music_forge_config_revision_not_found:{revision_id}")
        generation = await coordinator.bump_pg_generation(self.db)
        await self.db.commit()
        await coordinator.publish_generation(generation)
        coordinator.clear_local_cache()
        out = dict(row)
        out["config_generation"] = generation
        return out


# Backward-compatible name for call sites / tests during Phase 1 wiring.
MusicForgeConfigService = MusicForgeConfigGateway
