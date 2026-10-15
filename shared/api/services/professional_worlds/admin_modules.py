# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Module catalog and vertical assignment mixin for Professional Worlds admin.
# Invariants:
# - Module keys resolve hyphen/underscore aliases before assignment mutations.
# Related:
# - api/services/professional_worlds/admin_service.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]

from api.schemas.professional_worlds import (
    ProfessionalModuleCreate,
    ProfessionalModuleUpdate,
    ProfessionalVerticalModuleUpsert,
)
from api.services.professional_worlds.admin_common import _json, _row, _rows
from api.services.professional_worlds.admin_typing import ProfessionalWorldsAdminTypedMixin


class ProfessionalWorldsAdminModulesMixin(ProfessionalWorldsAdminTypedMixin):
    """Admin module catalog and vertical module assignments."""

    async def list_modules(self) -> list[dict[str, Any]]:
        """List module catalog."""
        result = await self.db.execute(
            text(
                """
                SELECT id, module_key, name, description, category, icon_key, default_config, is_active,
                       created_at, updated_at
                FROM professional_modules
                ORDER BY category, module_key
                """
            )
        )
        return _rows(list(result.mappings().all()))

    async def get_module(self, module_key: str) -> dict[str, Any] | None:
        """Return one module."""
        result = await self.db.execute(
            text(
                """
                SELECT id, module_key, name, description, category, icon_key, default_config, is_active,
                       created_at, updated_at
                FROM professional_modules
                WHERE module_key = :module_key
                """
            ),
            {"module_key": module_key},
        )
        return _row(result.mappings().one_or_none())

    async def _resolve_catalog_module_key(self, module_key: str) -> str | None:
        """Map request path key to a catalog row (handles legacy hyphenated clients)."""
        requested = module_key.strip()
        if not requested:
            return None
        row = await self.get_module(requested)
        if row is not None:
            return str(row["module_key"])
        if "-" in requested:
            row = await self.get_module(requested.replace("-", "_"))
            if row is not None:
                return str(row["module_key"])
        if "_" in requested:
            row = await self.get_module(requested.replace("_", "-"))
            if row is not None:
                return str(row["module_key"])
        return None

    async def create_module(self, admin_user_id: UUID | None, payload: ProfessionalModuleCreate) -> dict[str, Any]:
        """Create or update module catalog entry."""
        before = await self.get_module(payload.module_key)
        result = await self.db.execute(
            text(
                """
                INSERT INTO professional_modules (
                    module_key, name, description, category, icon_key, default_config, is_active
                )
                VALUES (
                    :module_key, :name, :description, :category, :icon_key,
                    CAST(:default_config AS jsonb), :is_active
                )
                ON CONFLICT (module_key) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    category = EXCLUDED.category,
                    icon_key = EXCLUDED.icon_key,
                    default_config = EXCLUDED.default_config,
                    is_active = EXCLUDED.is_active,
                    updated_at = now()
                RETURNING id, module_key, name, description, category, icon_key, default_config, is_active,
                          created_at, updated_at
                """
            ),
            {
                **payload.model_dump(exclude={"default_config"}),
                "default_config": _json(payload.default_config),
            },
        )
        row = dict(result.mappings().one())
        await self._audit(
            admin_user_id=admin_user_id,
            action="upsert",
            entity_type="module",
            entity_key=payload.module_key,
            before_data=before,
            after_data=row,
        )
        await self.db.commit()
        return row

    async def update_module(
        self, admin_user_id: UUID | None, module_key: str, payload: ProfessionalModuleUpdate
    ) -> dict[str, Any] | None:
        """Patch module catalog entry."""
        before = await self.get_module(module_key)
        if before is None:
            return None
        current = {**before}
        current.update(payload.model_dump(exclude_unset=True, mode="json"))
        result = await self.db.execute(
            text(
                """
                UPDATE professional_modules
                SET name = :name,
                    description = :description,
                    category = :category,
                    icon_key = :icon_key,
                    default_config = CAST(:default_config AS jsonb),
                    is_active = :is_active,
                    updated_at = now()
                WHERE module_key = :module_key
                RETURNING id, module_key, name, description, category, icon_key, default_config, is_active,
                          created_at, updated_at
                """
            ),
            {
                "module_key": module_key,
                "name": current["name"],
                "description": current["description"],
                "category": current["category"],
                "icon_key": current["icon_key"],
                "default_config": _json(current.get("default_config") or {}),
                "is_active": current["is_active"],
            },
        )
        row = _row(result.mappings().one_or_none())
        await self._audit(
            admin_user_id=admin_user_id,
            action="update",
            entity_type="module",
            entity_key=module_key,
            before_data=before,
            after_data=row,
        )
        await self.db.commit()
        return row

    async def list_vertical_modules(self, vertical_slug: str) -> list[dict[str, Any]]:
        """List module assignments for one vertical."""
        result = await self.db.execute(
            text(
                """
                SELECT vm.id, vm.vertical_slug, vm.module_key, m.name AS module_name,
                       m.category AS module_category, m.icon_key, vm.config, vm.sort_order,
                       vm.is_enabled, vm.created_at, vm.updated_at
                FROM professional_vertical_modules vm
                LEFT JOIN professional_modules m ON m.module_key = vm.module_key
                WHERE vm.vertical_slug = :vertical_slug
                ORDER BY vm.sort_order, vm.module_key
                """
            ),
            {"vertical_slug": vertical_slug},
        )
        return _rows(list(result.mappings().all()))

    async def assign_module(
        self,
        admin_user_id: UUID | None,
        vertical_slug: str,
        module_key: str,
        payload: ProfessionalVerticalModuleUpsert,
    ) -> dict[str, Any] | None:
        """Assign or update a module on a vertical."""
        catalog_module_key = await self._resolve_catalog_module_key(module_key)
        if catalog_module_key is None:
            return None
        before_result = await self.db.execute(
            text(
                """
                SELECT id, vertical_slug, module_key, config, sort_order, is_enabled, created_at, updated_at
                FROM professional_vertical_modules
                WHERE vertical_slug = :vertical_slug AND module_key = :module_key
                """
            ),
            {"vertical_slug": vertical_slug, "module_key": catalog_module_key},
        )
        before = _row(before_result.mappings().one_or_none())
        result = await self.db.execute(
            text(
                """
                INSERT INTO professional_vertical_modules (vertical_slug, module_key, config, sort_order, is_enabled)
                VALUES (:vertical_slug, :module_key, CAST(:config AS jsonb), :sort_order, :is_enabled)
                ON CONFLICT (vertical_slug, module_key) DO UPDATE SET
                    config = EXCLUDED.config,
                    sort_order = EXCLUDED.sort_order,
                    is_enabled = EXCLUDED.is_enabled,
                    updated_at = now()
                RETURNING id, vertical_slug, module_key, config, sort_order, is_enabled, created_at, updated_at
                """
            ),
            {
                "vertical_slug": vertical_slug,
                "module_key": catalog_module_key,
                "config": _json(payload.config),
                "sort_order": payload.sort_order,
                "is_enabled": payload.is_enabled,
            },
        )
        row = dict(result.mappings().one())
        await self._audit(
            admin_user_id=admin_user_id,
            action="assign",
            entity_type="vertical_module",
            entity_key=f"{vertical_slug}:{catalog_module_key}",
            before_data=before,
            after_data=row,
        )
        await self.db.commit()
        return row

    async def disable_module_assignment(self, admin_user_id: UUID | None, vertical_slug: str, module_key: str) -> bool:
        """Disable module assignment without deleting history."""
        catalog_module_key = await self._resolve_catalog_module_key(module_key)
        if catalog_module_key is None:
            return False
        result = await self.db.execute(
            text(
                """
                UPDATE professional_vertical_modules
                SET is_enabled = false, updated_at = now()
                WHERE vertical_slug = :vertical_slug AND module_key = :module_key
                RETURNING id, vertical_slug, module_key, config, sort_order, is_enabled
                """
            ),
            {"vertical_slug": vertical_slug, "module_key": catalog_module_key},
        )
        row = _row(result.mappings().one_or_none())
        if row is None:
            return False
        await self._audit(
            admin_user_id=admin_user_id,
            action="disable",
            entity_type="vertical_module",
            entity_key=f"{vertical_slug}:{module_key}",
            before_data={},
            after_data=row,
        )
        await self.db.commit()
        return True
