# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Runtime configuration resolver for enabled Professional Worlds modules, schemas, AI actions and integrations.
# Invariants:
# - Runtime config omits private prompt templates and admin-only configuration fields.
# - Resolution remains vertical-scoped and independent from desktop shell state.
# Related:
# - api/services/professional_worlds/runtime_config_service.py
# - api/routers/professional_worlds_core.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from api.services.professional_worlds import runtime_config_service
from api.services.professional_worlds.service import ProfessionalWorldsService


class ProfessionalWorldsRuntimeService:
    """Thin runtime facade over AsyncSession-scoped runtime config helpers."""

    def __init__(self, service: ProfessionalWorldsService) -> None:
        self.service = service

    async def get_config(self, vertical_slug: str, user_id: UUID | None = None) -> dict[str, Any]:
        """Return safe runtime config for a vertical."""
        return await runtime_config_service.get_runtime_config(
            self.service.db,
            vertical_slug,
            user_id=user_id,
        )
