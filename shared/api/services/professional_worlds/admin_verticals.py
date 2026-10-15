# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Vertical CRUD mixin for Professional Worlds admin configuration.
# Invariants:
# - Verticals are disabled, not hard-deleted, via disable_vertical.
# Related:
# - api/services/professional_worlds/admin_service.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]

from api.schemas.professional_worlds import (
    AdminProfessionVerticalCreate,
    AdminProfessionVerticalUpdate,
)
from api.services.professional_worlds.admin_common import _json, _row, _rows
from api.services.professional_worlds.admin_typing import ProfessionalWorldsAdminTypedMixin


class ProfessionalWorldsAdminVerticalsMixin(ProfessionalWorldsAdminTypedMixin):
    """Admin CRUD for profession verticals."""

    async def list_verticals(self) -> list[dict[str, Any]]:
        """List all verticals for admin."""
        result = await self.db.execute(
            text(
                """
                SELECT id, slug, name, description, icon_key, is_active, profile_schema, workspace_template,
                       created_at, updated_at
                FROM profession_verticals
                ORDER BY slug
                """
            )
        )
        return _rows(list(result.mappings().all()))

    async def get_vertical(self, slug: str) -> dict[str, Any] | None:
        """Return one vertical by slug."""
        result = await self.db.execute(
            text(
                """
                SELECT id, slug, name, description, icon_key, is_active, profile_schema, workspace_template,
                       created_at, updated_at
                FROM profession_verticals
                WHERE slug = :slug
                """
            ),
            {"slug": slug},
        )
        return _row(result.mappings().one_or_none())

    async def create_vertical(
        self, admin_user_id: UUID | None, payload: AdminProfessionVerticalCreate
    ) -> dict[str, Any]:
        """Create or update a vertical from admin."""
        before = await self.get_vertical(payload.slug)
        result = await self.db.execute(
            text(
                """
                INSERT INTO profession_verticals (
                    slug, name, description, icon_key, is_active, profile_schema, workspace_template
                )
                VALUES (
                    :slug, :name, :description, :icon_key, :is_active,
                    CAST(:profile_schema AS jsonb), CAST(:workspace_template AS jsonb)
                )
                ON CONFLICT (slug) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    icon_key = EXCLUDED.icon_key,
                    is_active = EXCLUDED.is_active,
                    profile_schema = EXCLUDED.profile_schema,
                    workspace_template = EXCLUDED.workspace_template,
                    updated_at = now()
                RETURNING id, slug, name, description, icon_key, is_active, profile_schema, workspace_template,
                          created_at, updated_at
                """
            ),
            {
                **payload.model_dump(exclude={"profile_schema", "workspace_template"}),
                "profile_schema": _json(payload.profile_schema),
                "workspace_template": _json(payload.workspace_template),
            },
        )
        row = dict(result.mappings().one())
        await self._audit(
            admin_user_id=admin_user_id,
            action="upsert",
            entity_type="vertical",
            entity_key=payload.slug,
            before_data=before,
            after_data=row,
        )
        await self.db.commit()
        return row

    async def update_vertical(
        self, admin_user_id: UUID | None, slug: str, payload: AdminProfessionVerticalUpdate
    ) -> dict[str, Any] | None:
        """Patch vertical metadata."""
        before = await self.get_vertical(slug)
        if before is None:
            return None
        current = {**before}
        current.update(payload.model_dump(exclude_unset=True, mode="json"))
        result = await self.db.execute(
            text(
                """
                UPDATE profession_verticals
                SET name = :name,
                    description = :description,
                    icon_key = :icon_key,
                    is_active = :is_active,
                    profile_schema = CAST(:profile_schema AS jsonb),
                    workspace_template = CAST(:workspace_template AS jsonb),
                    updated_at = now()
                WHERE slug = :slug
                RETURNING id, slug, name, description, icon_key, is_active, profile_schema, workspace_template,
                          created_at, updated_at
                """
            ),
            {
                "slug": slug,
                "name": current["name"],
                "description": current["description"],
                "icon_key": current["icon_key"],
                "is_active": current["is_active"],
                "profile_schema": _json(current.get("profile_schema") or {}),
                "workspace_template": _json(current.get("workspace_template") or {}),
            },
        )
        row = _row(result.mappings().one_or_none())
        await self._audit(
            admin_user_id=admin_user_id,
            action="update",
            entity_type="vertical",
            entity_key=slug,
            before_data=before,
            after_data=row,
        )
        await self.db.commit()
        return row

    async def disable_vertical(self, admin_user_id: UUID | None, slug: str) -> bool:
        """Safely disable a vertical instead of hard-deleting it."""
        row = await self.update_vertical(
            admin_user_id, slug, AdminProfessionVerticalUpdate.model_validate({"is_active": False})
        )
        return row is not None
