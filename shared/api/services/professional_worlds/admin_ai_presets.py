# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AI actions and photo presets mixin for Professional Worlds admin configuration.
# Invariants:
# - Normal runtime callers must not use this service to expose prompt templates.
# Related:
# - api/services/professional_worlds/admin_service.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]

from api.schemas.professional_worlds import (
    ProfessionalAiActionCreate,
    ProfessionalAiActionUpdate,
    ProfessionalPhotoPresetCreate,
    ProfessionalPhotoPresetUpdate,
)
from api.services.professional_worlds.admin_common import _json, _row, _rows
from api.services.professional_worlds.admin_typing import ProfessionalWorldsAdminTypedMixin


class ProfessionalWorldsAdminAiPresetsMixin(ProfessionalWorldsAdminTypedMixin):
    """Admin CRUD for AI actions and photo presets."""

    async def list_ai_actions(self, vertical_slug: str | None = None) -> list[dict[str, Any]]:
        """List admin AI actions."""
        where = "WHERE vertical_slug = :vertical_slug" if vertical_slug else ""
        result = await self.db.execute(
            text(
                f"""
                SELECT id, vertical_slug, module_key, action_key, display_name, description, ugs_type_key,
                       workflow_slug, prompt_template, input_schema, output_schema, safety_rules, artifact_kind,
                       billing_hint, is_active, sort_order, created_at, updated_at
                FROM professional_ai_actions
                {where}
                ORDER BY vertical_slug, sort_order, action_key
                """
            ),
            {"vertical_slug": vertical_slug} if vertical_slug else {},
        )
        return _rows(list(result.mappings().all()))

    async def get_ai_action(self, vertical_slug: str, action_key: str) -> dict[str, Any] | None:
        """Return one admin AI action."""
        result = await self.db.execute(
            text(
                """
                SELECT id, vertical_slug, module_key, action_key, display_name, description, ugs_type_key,
                       workflow_slug, prompt_template, input_schema, output_schema, safety_rules, artifact_kind,
                       billing_hint, is_active, sort_order, created_at, updated_at
                FROM professional_ai_actions
                WHERE vertical_slug = :vertical_slug AND action_key = :action_key
                """
            ),
            {"vertical_slug": vertical_slug, "action_key": action_key},
        )
        return _row(result.mappings().one_or_none())

    async def create_ai_action(self, admin_user_id: UUID | None, payload: ProfessionalAiActionCreate) -> dict[str, Any]:
        """Create or update an admin AI action."""
        before = await self.get_ai_action(payload.vertical_slug, payload.action_key)
        result = await self.db.execute(
            text(
                """
                INSERT INTO professional_ai_actions (
                    vertical_slug, module_key, action_key, display_name, description, ugs_type_key, workflow_slug,
                    prompt_template, input_schema, output_schema, safety_rules, artifact_kind, billing_hint,
                    is_active, sort_order
                )
                VALUES (
                    :vertical_slug, :module_key, :action_key, :display_name, :description, :ugs_type_key, :workflow_slug,
                    :prompt_template, CAST(:input_schema AS jsonb), CAST(:output_schema AS jsonb),
                    CAST(:safety_rules AS jsonb), :artifact_kind, CAST(:billing_hint AS jsonb), :is_active, :sort_order
                )
                ON CONFLICT (vertical_slug, action_key) DO UPDATE SET
                    module_key = EXCLUDED.module_key,
                    display_name = EXCLUDED.display_name,
                    description = EXCLUDED.description,
                    ugs_type_key = EXCLUDED.ugs_type_key,
                    workflow_slug = EXCLUDED.workflow_slug,
                    prompt_template = EXCLUDED.prompt_template,
                    input_schema = EXCLUDED.input_schema,
                    output_schema = EXCLUDED.output_schema,
                    safety_rules = EXCLUDED.safety_rules,
                    artifact_kind = EXCLUDED.artifact_kind,
                    billing_hint = EXCLUDED.billing_hint,
                    is_active = EXCLUDED.is_active,
                    sort_order = EXCLUDED.sort_order,
                    updated_at = now()
                RETURNING id, vertical_slug, module_key, action_key, display_name, description, ugs_type_key,
                          workflow_slug, prompt_template, input_schema, output_schema, safety_rules, artifact_kind,
                          billing_hint, is_active, sort_order, created_at, updated_at
                """
            ),
            {
                **payload.model_dump(
                    exclude={"input_schema", "output_schema", "safety_rules", "billing_hint"},
                    mode="json",
                ),
                "input_schema": _json(payload.input_schema),
                "output_schema": _json(payload.output_schema),
                "safety_rules": _json(payload.safety_rules),
                "billing_hint": _json(payload.billing_hint),
            },
        )
        row = dict(result.mappings().one())
        await self._audit(
            admin_user_id=admin_user_id,
            action="upsert",
            entity_type="ai_action",
            entity_key=f"{payload.vertical_slug}:{payload.action_key}",
            before_data=before,
            after_data=row,
        )
        await self.db.commit()
        return row

    async def update_ai_action(
        self, admin_user_id: UUID | None, vertical_slug: str, action_key: str, payload: ProfessionalAiActionUpdate
    ) -> dict[str, Any] | None:
        """Patch admin AI action."""
        before = await self.get_ai_action(vertical_slug, action_key)
        if before is None:
            return None
        current = {**before}
        current.update(payload.model_dump(exclude_unset=True, mode="json"))
        return await self.create_ai_action(
            admin_user_id,
            ProfessionalAiActionCreate(
                vertical_slug=vertical_slug,
                module_key=current["module_key"],
                action_key=action_key,
                display_name=current["display_name"],
                description=current["description"],
                ugs_type_key=current["ugs_type_key"],
                workflow_slug=current["workflow_slug"],
                prompt_template=current["prompt_template"],
                input_schema=current.get("input_schema") or {},
                output_schema=current.get("output_schema") or {},
                safety_rules=current.get("safety_rules") or [],
                artifact_kind=current["artifact_kind"],
                billing_hint=current.get("billing_hint") or {},
                is_active=current["is_active"],
                sort_order=current["sort_order"],
            ),
        )

    async def list_photo_presets(self, vertical_slug: str | None = None) -> list[dict[str, Any]]:
        """List photo presets."""
        where = "WHERE vertical_slug = :vertical_slug" if vertical_slug else ""
        result = await self.db.execute(
            text(
                f"""
                SELECT id, vertical_slug, preset_key, display_name, description, category, action_type,
                       ugs_type_key, prompt_template, parameters, is_active, sort_order, created_at, updated_at
                FROM professional_photo_presets
                {where}
                ORDER BY vertical_slug, category, sort_order, preset_key
                """
            ),
            {"vertical_slug": vertical_slug} if vertical_slug else {},
        )
        return _rows(list(result.mappings().all()))

    async def get_photo_preset(self, vertical_slug: str, preset_key: str) -> dict[str, Any] | None:
        """Return one photo preset."""
        result = await self.db.execute(
            text(
                """
                SELECT id, vertical_slug, preset_key, display_name, description, category, action_type,
                       ugs_type_key, prompt_template, parameters, is_active, sort_order, created_at, updated_at
                FROM professional_photo_presets
                WHERE vertical_slug = :vertical_slug AND preset_key = :preset_key
                """
            ),
            {"vertical_slug": vertical_slug, "preset_key": preset_key},
        )
        return _row(result.mappings().one_or_none())

    async def create_photo_preset(
        self, admin_user_id: UUID | None, payload: ProfessionalPhotoPresetCreate
    ) -> dict[str, Any]:
        """Create or update photo preset."""
        before = await self.get_photo_preset(payload.vertical_slug, payload.preset_key)
        result = await self.db.execute(
            text(
                """
                INSERT INTO professional_photo_presets (
                    vertical_slug, preset_key, display_name, description, category, action_type,
                    ugs_type_key, prompt_template, parameters, is_active, sort_order
                )
                VALUES (
                    :vertical_slug, :preset_key, :display_name, :description, :category, :action_type,
                    :ugs_type_key, :prompt_template, CAST(:parameters AS jsonb), :is_active, :sort_order
                )
                ON CONFLICT (vertical_slug, preset_key) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    description = EXCLUDED.description,
                    category = EXCLUDED.category,
                    action_type = EXCLUDED.action_type,
                    ugs_type_key = EXCLUDED.ugs_type_key,
                    prompt_template = EXCLUDED.prompt_template,
                    parameters = EXCLUDED.parameters,
                    is_active = EXCLUDED.is_active,
                    sort_order = EXCLUDED.sort_order,
                    updated_at = now()
                RETURNING id, vertical_slug, preset_key, display_name, description, category, action_type,
                          ugs_type_key, prompt_template, parameters, is_active, sort_order, created_at, updated_at
                """
            ),
            {
                **payload.model_dump(exclude={"parameters"}, mode="json"),
                "parameters": _json(payload.parameters),
            },
        )
        row = dict(result.mappings().one())
        await self._audit(
            admin_user_id=admin_user_id,
            action="upsert",
            entity_type="photo_preset",
            entity_key=f"{payload.vertical_slug}:{payload.preset_key}",
            before_data=before,
            after_data=row,
        )
        await self.db.commit()
        return row

    async def update_photo_preset(
        self, admin_user_id: UUID | None, vertical_slug: str, preset_key: str, payload: ProfessionalPhotoPresetUpdate
    ) -> dict[str, Any] | None:
        """Patch photo preset."""
        before = await self.get_photo_preset(vertical_slug, preset_key)
        if before is None:
            return None
        current = {**before}
        current.update(payload.model_dump(exclude_unset=True, mode="json"))
        return await self.create_photo_preset(
            admin_user_id,
            ProfessionalPhotoPresetCreate(
                vertical_slug=vertical_slug,
                preset_key=preset_key,
                display_name=current["display_name"],
                description=current["description"],
                category=current["category"],
                action_type=current["action_type"],
                ugs_type_key=current["ugs_type_key"],
                prompt_template=current["prompt_template"],
                parameters=current.get("parameters") or {},
                is_active=current["is_active"],
                sort_order=current["sort_order"],
            ),
        )
