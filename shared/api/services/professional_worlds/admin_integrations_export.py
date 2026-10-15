# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Integration bindings and vertical pack export mixin for Professional Worlds admin.
# Invariants:
# - export_vertical_pack aggregates catalog data without mutating configuration.
# Related:
# - api/services/professional_worlds/admin_service.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]

from api.schemas.professional_worlds import ProfessionalIntegrationBindingUpdate
from api.services.professional_worlds.admin_common import _json, _row, _rows
from api.services.professional_worlds.admin_typing import ProfessionalWorldsAdminTypedMixin


class ProfessionalWorldsAdminIntegrationsExportMixin(ProfessionalWorldsAdminTypedMixin):
    """Admin integration bindings and vertical pack export."""

    async def list_integrations(self, vertical_slug: str | None = None) -> list[dict[str, Any]]:
        """List integration bindings."""
        where = "WHERE vertical_slug = :vertical_slug" if vertical_slug else ""
        result = await self.db.execute(
            text(
                f"""
                SELECT id, vertical_slug, integration_key, display_name, config, is_enabled, created_at, updated_at
                FROM professional_integration_bindings
                {where}
                ORDER BY vertical_slug, integration_key
                """
            ),
            {"vertical_slug": vertical_slug} if vertical_slug else {},
        )
        return _rows(list(result.mappings().all()))

    async def update_integration(
        self,
        admin_user_id: UUID | None,
        vertical_slug: str,
        integration_key: str,
        payload: ProfessionalIntegrationBindingUpdate,
    ) -> dict[str, Any] | None:
        """Patch integration binding."""
        current_result = await self.db.execute(
            text(
                """
                SELECT id, vertical_slug, integration_key, display_name, config, is_enabled, created_at, updated_at
                FROM professional_integration_bindings
                WHERE vertical_slug = :vertical_slug AND integration_key = :integration_key
                """
            ),
            {"vertical_slug": vertical_slug, "integration_key": integration_key},
        )
        before = _row(current_result.mappings().one_or_none())
        if before is None:
            return None
        current = {**before}
        current.update(payload.model_dump(exclude_unset=True, mode="json"))
        result = await self.db.execute(
            text(
                """
                UPDATE professional_integration_bindings
                SET display_name = :display_name,
                    config = CAST(:config AS jsonb),
                    is_enabled = :is_enabled,
                    updated_at = now()
                WHERE vertical_slug = :vertical_slug AND integration_key = :integration_key
                RETURNING id, vertical_slug, integration_key, display_name, config, is_enabled, created_at, updated_at
                """
            ),
            {
                "vertical_slug": vertical_slug,
                "integration_key": integration_key,
                "display_name": current["display_name"],
                "config": _json(current.get("config") or {}),
                "is_enabled": current["is_enabled"],
            },
        )
        row = _row(result.mappings().one_or_none())
        await self._audit(
            admin_user_id=admin_user_id,
            action="update",
            entity_type="integration",
            entity_key=f"{vertical_slug}:{integration_key}",
            before_data=before,
            after_data=row,
        )
        await self.db.commit()
        return row

    async def export_vertical_pack(self, vertical_slug: str) -> dict[str, Any]:
        """Export one vertical pack as JSON-compatible data."""
        vertical = await self.get_vertical(vertical_slug)
        return {
            "vertical": vertical,
            "module_catalog": await self.list_modules(),
            "modules": await self.list_vertical_modules(vertical_slug),
            "schemas": await self.list_schemas(vertical_slug),
            "ai_actions": await self.list_ai_actions(vertical_slug),
            "photo_presets": await self.list_photo_presets(vertical_slug),
            "integrations": await self.list_integrations(vertical_slug),
        }
