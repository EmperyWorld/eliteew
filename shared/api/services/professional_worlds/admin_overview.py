# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin dashboard overview mixin for Professional Worlds configuration.
# Invariants:
# - Runtime metrics degrade gracefully when ops metrics service fails.
# Related:
# - api/services/professional_worlds/admin_service.py
# - api/services/professional_worlds/ops_metrics_service.py
# ---

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class ProfessionalWorldsAdminOverviewMixin:
    """Admin dashboard counters and broken assignment hints."""

    db: AsyncSession

    async def overview(self) -> dict[str, Any]:
        """Return admin dashboard counters and broken assignment hints."""
        result = await self.db.execute(
            text(
                """
                SELECT
                    (SELECT count(*) FROM profession_verticals) AS verticals_count,
                    (SELECT count(*) FROM professional_modules) AS modules_count,
                    (SELECT count(*) FROM professional_ai_actions) AS ai_actions_count,
                    (SELECT count(*) FROM professional_photo_presets) AS photo_presets_count,
                    (SELECT count(*) FROM professional_integration_bindings WHERE is_enabled = true) AS enabled_integrations_count,
                    (SELECT count(*) FROM professional_vertical_pack_versions) AS pack_versions_count,
                    (SELECT count(*) FROM professional_vertical_pack_releases) AS pack_releases_count,
                    (SELECT count(*) FROM professional_vertical_pack_releases WHERE status = 'published') AS published_releases_count,
                    (SELECT count(*) FROM professional_vertical_rollouts WHERE is_paused = false) AS active_rollouts_count
                """
            )
        )
        row = dict(result.mappings().one())
        broken = await self.db.execute(
            text(
                """
                SELECT vm.vertical_slug || ':' || vm.module_key AS binding
                FROM professional_vertical_modules vm
                LEFT JOIN professional_modules m ON m.module_key = vm.module_key
                WHERE m.id IS NULL
                ORDER BY vm.vertical_slug, vm.module_key
                """
            )
        )
        row["broken_bindings"] = [item["binding"] for item in broken.mappings().all()]
        from api.services.professional_worlds.ops_metrics_service import load_runtime_overview

        try:
            row["runtime"] = await load_runtime_overview(self.db)
        except Exception:
            logger.warning("professional_worlds.admin_overview_runtime_failed", exc_info=True)
            row["runtime"] = None
        return row
