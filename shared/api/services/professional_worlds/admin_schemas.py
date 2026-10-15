# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Vertical schema version CRUD mixin for Professional Worlds admin.
# Invariants:
# - Activating one schema version deactivates sibling versions for the same schema_key.
# Related:
# - api/services/professional_worlds/admin_service.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]

from api.schemas.professional_worlds import (
    ProfessionalVerticalSchemaCreate,
    ProfessionalVerticalSchemaUpdate,
)
from api.services.professional_worlds.admin_common import _json, _row, _rows
from api.services.professional_worlds.admin_typing import ProfessionalWorldsAdminTypedMixin


class ProfessionalWorldsAdminSchemasMixin(ProfessionalWorldsAdminTypedMixin):
    """Admin CRUD for professional vertical schemas."""

    async def list_schemas(self, vertical_slug: str) -> list[dict[str, Any]]:
        """List schema versions for one vertical."""
        result = await self.db.execute(
            text(
                """
                SELECT id, vertical_slug, schema_key, version, title, schema_json, ui_schema,
                       is_active, created_at, updated_at
                FROM professional_vertical_schemas
                WHERE vertical_slug = :vertical_slug
                ORDER BY schema_key, version DESC
                """
            ),
            {"vertical_slug": vertical_slug},
        )
        return _rows(list(result.mappings().all()))

    async def create_schema(
        self, admin_user_id: UUID | None, vertical_slug: str, payload: ProfessionalVerticalSchemaCreate
    ) -> dict[str, Any]:
        """Create or update schema version."""
        if payload.is_active:
            await self.db.execute(
                text(
                    """
                    UPDATE professional_vertical_schemas
                    SET is_active = false, updated_at = now()
                    WHERE vertical_slug = :vertical_slug AND schema_key = :schema_key
                    """
                ),
                {"vertical_slug": vertical_slug, "schema_key": payload.schema_key},
            )
        result = await self.db.execute(
            text(
                """
                INSERT INTO professional_vertical_schemas (
                    vertical_slug, schema_key, version, title, schema_json, ui_schema, is_active
                )
                VALUES (
                    :vertical_slug, :schema_key, :version, :title,
                    CAST(:schema_json AS jsonb), CAST(:ui_schema AS jsonb), :is_active
                )
                ON CONFLICT (vertical_slug, schema_key, version) DO UPDATE SET
                    title = EXCLUDED.title,
                    schema_json = EXCLUDED.schema_json,
                    ui_schema = EXCLUDED.ui_schema,
                    is_active = EXCLUDED.is_active,
                    updated_at = now()
                RETURNING id, vertical_slug, schema_key, version, title, schema_json, ui_schema,
                          is_active, created_at, updated_at
                """
            ),
            {
                "vertical_slug": vertical_slug,
                **payload.model_dump(exclude={"schema_body", "ui_schema"}),
                "schema_json": _json(payload.schema_body),
                "ui_schema": _json(payload.ui_schema),
            },
        )
        row = dict(result.mappings().one())
        await self._audit(
            admin_user_id=admin_user_id,
            action="upsert",
            entity_type="schema",
            entity_key=f"{vertical_slug}:{payload.schema_key}:{payload.version}",
            before_data={},
            after_data=row,
        )
        await self.db.commit()
        return row

    async def update_schema(
        self, admin_user_id: UUID | None, schema_id: UUID, payload: ProfessionalVerticalSchemaUpdate
    ) -> dict[str, Any] | None:
        """Patch schema by id."""
        current_result = await self.db.execute(
            text(
                """
                SELECT id, vertical_slug, schema_key, version, title, schema_json, ui_schema,
                       is_active, created_at, updated_at
                FROM professional_vertical_schemas
                WHERE id = :schema_id
                """
            ),
            {"schema_id": schema_id},
        )
        before = _row(current_result.mappings().one_or_none())
        if before is None:
            return None
        current = {**before}
        # by_alias=True so wire key schema_json merges onto DB row shape (not schema_body).
        current.update(payload.model_dump(exclude_unset=True, by_alias=True, mode="json"))
        if bool(current.get("is_active")):
            await self.db.execute(
                text(
                    """
                    UPDATE professional_vertical_schemas
                    SET is_active = false, updated_at = now()
                    WHERE vertical_slug = :vertical_slug AND schema_key = :schema_key AND id <> :schema_id
                    """
                ),
                {
                    "vertical_slug": current["vertical_slug"],
                    "schema_key": current["schema_key"],
                    "schema_id": schema_id,
                },
            )
        result = await self.db.execute(
            text(
                """
                UPDATE professional_vertical_schemas
                SET title = :title,
                    schema_json = CAST(:schema_json AS jsonb),
                    ui_schema = CAST(:ui_schema AS jsonb),
                    is_active = :is_active,
                    updated_at = now()
                WHERE id = :schema_id
                RETURNING id, vertical_slug, schema_key, version, title, schema_json, ui_schema,
                          is_active, created_at, updated_at
                """
            ),
            {
                "schema_id": schema_id,
                "title": current["title"],
                "schema_json": _json(current.get("schema_json") or {}),
                "ui_schema": _json(current.get("ui_schema") or {}),
                "is_active": current["is_active"],
            },
        )
        row = _row(result.mappings().one_or_none())
        await self._audit(
            admin_user_id=admin_user_id,
            action="update",
            entity_type="schema",
            entity_key=str(schema_id),
            before_data=before,
            after_data=row,
        )
        await self.db.commit()
        return row

    async def activate_schema(self, admin_user_id: UUID | None, schema_id: UUID) -> dict[str, Any] | None:
        """Activate a schema version and deactivate sibling versions."""
        return await self.update_schema(
            admin_user_id, schema_id, ProfessionalVerticalSchemaUpdate.model_validate({"is_active": True})
        )
