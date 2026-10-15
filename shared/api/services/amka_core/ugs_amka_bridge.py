# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Bridge AmkaCoreEngine to a UGS AsyncSession for read-only alignments (model routing and generation inventory).
# Invariants:
# - Uses UGS admin drivers + `serialize_amka_core_alignment_payload`; no Marketing Cabinet imports.
# Related:
# - shared/api/services/amka_core/ugs_admin_amka_driver.py
# - shared/api/services/amka_core/ugs_generation_inventory_amka_driver.py
# - shared/api/services/amka_core/engine.py
# - shared/api/ewa_platform/gateways/routers/standalone_facade.py
# ---
from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.amka_core.alignment_payload import serialize_amka_core_alignment_payload
from api.services.amka_core.contracts import AmkaSubjectRef
from api.services.amka_core.engine import AmkaCoreEngine
from api.services.amka_core.ugs_admin_amka_driver import UgsAdminAmkaDriver
from api.services.amka_core.ugs_generation_inventory_amka_driver import UgsAdminGenerationInventoryAmkaDriver
from api.services.ugs.model_routing_service import UGSModelRoutingService


def ugs_amka_subject(*, subject_id: str = "global") -> AmkaSubjectRef:
    """Stable subject for singleton UGS model-routing profile."""

    return AmkaSubjectRef(
        driver_key=UgsAdminAmkaDriver.driver_key,
        domain_profile=UgsAdminAmkaDriver.domain_profile,
        subject_id=subject_id,
        display_name="UGS model routing",
        metadata={"scope": "ugs_settings"},
    )


async def build_ugs_model_routing_core_alignment(db: AsyncSession) -> dict[str, Any]:
    """Run AmkaCoreEngine read-only alignment over live `model_routes` from UGS settings."""

    routing = UGSModelRoutingService(db)
    driver = UgsAdminAmkaDriver(routing)
    subject = ugs_amka_subject()
    result = await AmkaCoreEngine(driver).run_once(subject, execute=False)
    return serialize_amka_core_alignment_payload(result)


def ugs_generation_inventory_amka_subject(*, subject_id: str = "global") -> AmkaSubjectRef:
    """Stable subject for UGS Admin v2 generation-inventory profile."""

    return AmkaSubjectRef(
        driver_key=UgsAdminGenerationInventoryAmkaDriver.driver_key,
        domain_profile=UgsAdminGenerationInventoryAmkaDriver.domain_profile,
        subject_id=subject_id,
        display_name="UGS generation inventory",
        metadata={"scope": "ugs_admin_v2_snapshot"},
    )


async def build_ugs_generation_inventory_core_alignment(db: AsyncSession) -> dict[str, Any]:
    """Run AmkaCoreEngine read-only alignment over the UGS Admin v2 aggregate snapshot."""

    driver = UgsAdminGenerationInventoryAmkaDriver(db)
    subject = ugs_generation_inventory_amka_subject()
    result = await AmkaCoreEngine(driver).run_once(subject, execute=False)
    return serialize_amka_core_alignment_payload(result)
