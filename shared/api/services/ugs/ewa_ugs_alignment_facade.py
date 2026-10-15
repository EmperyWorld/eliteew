# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Thin HTTP-facing facade for EWA UGS core-alignment and driver-catalog metadata: delegates to ``amka_core``
#   bridges/catalog without importing ``amka_core`` from ``ewa_platform`` packages.
# Invariants:
#   - ``ewa_platform`` routers import only this module (or re-exports here), not ``api.services.amka_core`` directly.
# Related:
#   - api/ewa_platform/gateways/routers/standalone_facade.py
#   - api/services/amka_core/ugs_amka_bridge.py
#   - api/services/amka_core/driver_catalog.py
# ---
"""EWA-facing UGS alignment helpers (dependency direction boundary for ``ewa_platform``)."""

from __future__ import annotations

import hashlib
from typing import Any

from sqlalchemy import func, select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.models.database_models import ComfyUIWorkflow, GenerationProvider, GenerationType, UGSSetting
from api.services.amka_core.driver_catalog import serialize_amka_driver_catalog
from api.services.amka_core.ugs_amka_bridge import (
    build_ugs_generation_inventory_core_alignment,
    build_ugs_model_routing_core_alignment,
)
from api.services.ugs.model_routing_service import MODEL_ROUTES_SETTING_KEY


def serialize_ewa_ugs_driver_catalog() -> list[dict[str, Any]]:
    """Return static driver/profile catalog metadata (same payload as marketing catalog serializer)."""

    return serialize_amka_driver_catalog()


async def ugs_model_routing_core_alignment_weak_etag(db: AsyncSession) -> str:
    """Weak ETag for model-routing alignment; shifts when global ``model_routes`` setting row changes."""

    res = await db.execute(
        select(UGSSetting.id, UGSSetting.updated_at).where(
            UGSSetting.key == MODEL_ROUTES_SETTING_KEY,
            UGSSetting.scope == "global",
        )
    )
    row = res.first()
    if row is None:
        return 'W/"ugs-mr:missing"'
    sid, updated_at = row[0], row[1]
    return f'W/"ugs-mr:{sid}:{updated_at}"'


async def ugs_generation_inventory_core_alignment_weak_etag(db: AsyncSession) -> str:
    """Weak ETag for generation-inventory alignment; cheap aggregate over snapshot-driving tables."""

    t_row = (
        await db.execute(
            select(func.count(), func.max(GenerationType.updated_at)).where(GenerationType.deleted_at.is_(None))
        )
    ).one()
    p_row = (await db.execute(select(func.count(), func.max(GenerationProvider.updated_at)))).one()
    w_row = (await db.execute(select(func.count(), func.max(ComfyUIWorkflow.updated_at)))).one()
    s_max = await db.scalar(select(func.max(UGSSetting.updated_at)))
    raw = (
        f"gt:{int(t_row[0] or 0)}:{t_row[1]}"
        f"|gp:{int(p_row[0] or 0)}:{p_row[1]}"
        f"|cw:{int(w_row[0] or 0)}:{w_row[1]}"
        f"|us:{s_max}"
    )
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f'W/"ugs-gi:{digest}"'


__all__ = [
    "build_ugs_generation_inventory_core_alignment",
    "build_ugs_model_routing_core_alignment",
    "serialize_ewa_ugs_driver_catalog",
    "ugs_generation_inventory_core_alignment_weak_etag",
    "ugs_model_routing_core_alignment_weak_etag",
]
