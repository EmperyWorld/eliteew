# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared typing host for Professional Worlds admin mixin composition (pyright).
# Invariants:
# - Runtime methods live on sibling mixins; this base only declares the composed surface.
# Related:
# - api/services/professional_worlds/admin_service.py
# ---

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]


class ProfessionalWorldsAdminTypedMixin:
    """Typing hub so sibling mixins can call `_audit` / catalog helpers under pyright."""

    db: AsyncSession

    if TYPE_CHECKING:

        async def _audit(
            self,
            *,
            admin_user_id: UUID | None,
            action: str,
            entity_type: str,
            entity_key: str,
            before_data: dict[str, Any] | None,
            after_data: dict[str, Any] | None,
            risk_level: str | None = None,
        ) -> None: ...

        async def get_vertical(self, slug: str) -> dict[str, Any] | None: ...

        async def list_modules(self) -> list[dict[str, Any]]: ...

        async def list_vertical_modules(self, vertical_slug: str) -> list[dict[str, Any]]: ...

        async def list_schemas(self, vertical_slug: str) -> list[dict[str, Any]]: ...

        async def list_ai_actions(self, vertical_slug: str | None = None) -> list[dict[str, Any]]: ...

        async def list_photo_presets(self, vertical_slug: str | None = None) -> list[dict[str, Any]]: ...

        async def list_integrations(self, vertical_slug: str | None = None) -> list[dict[str, Any]]: ...
