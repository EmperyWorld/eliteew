# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin admin service facade composing Professional Worlds admin mixins.
# Invariants:
# - Admin mutations are audit-logged with before/after payloads.
# - Normal runtime callers must not use this service to expose prompt templates.
# Related:
# - api/routers/professional_worlds_admin.py
# - documentation/product/PROFESSIONAL-WORLDS.md
# ---

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.admin_ai_presets import ProfessionalWorldsAdminAiPresetsMixin
from api.services.professional_worlds.admin_audit import ProfessionalWorldsAdminAuditMixin
from api.services.professional_worlds.admin_integrations_export import (
    ProfessionalWorldsAdminIntegrationsExportMixin,
)
from api.services.professional_worlds.admin_modules import ProfessionalWorldsAdminModulesMixin
from api.services.professional_worlds.admin_overview import ProfessionalWorldsAdminOverviewMixin
from api.services.professional_worlds.admin_schemas import ProfessionalWorldsAdminSchemasMixin
from api.services.professional_worlds.admin_verticals import ProfessionalWorldsAdminVerticalsMixin


class ProfessionalWorldsAdminService(
    ProfessionalWorldsAdminAuditMixin,
    ProfessionalWorldsAdminOverviewMixin,
    ProfessionalWorldsAdminVerticalsMixin,
    ProfessionalWorldsAdminModulesMixin,
    ProfessionalWorldsAdminSchemasMixin,
    ProfessionalWorldsAdminAiPresetsMixin,
    ProfessionalWorldsAdminIntegrationsExportMixin,
):
    """Admin CRUD service for Professional Worlds configuration."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
