# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Public entrypoint for the standalone AMKA core package.
# Re-exports the driver contract, engine, reference drivers, UGS admin drivers, and HTTP marketing act helper.
# Invariants:
# - Imports here must stay lightweight enough for tests and non-marketing drivers.
# - Production marketing behavior remains behind the existing marketing-cabinet API facade.
# Related:
# - shared/api/services/amka_core/contracts.py
# - documentation/product/amka-seed-album/RFC-001-amka-driver-contract.md
# ---
from __future__ import annotations

from api.services.amka_core.contracts import (
    AmkaCoreRunStatus,
    AmkaCoreStage,
    AmkaDriver,
    AmkaPlanOperation,
    AmkaPlanTask,
    AmkaPolicyDecision,
    AmkaPulseArtifact,
    AmkaRiskLevel,
    AmkaRunResult,
    AmkaSnapshot,
    AmkaSubjectRef,
    AmkaTraceEvent,
)
from api.services.amka_core.driver_catalog import (
    AmkaDriverCatalogEntry,
    get_amka_driver_catalog_entry,
    list_amka_driver_catalog,
    serialize_amka_driver_catalog,
)
from api.services.amka_core.engine import AmkaCoreEngine
from api.services.amka_core.marketing_driver_http import marketing_amka_driver_act_for_http
from api.services.amka_core.mock_driver import ReferenceMockAmkaDriver
from api.services.amka_core.projection import build_amka_core_run_projection
from api.services.amka_core.read_only_driver import StaticReadOnlyAmkaDriver
from api.services.amka_core.run_store import (
    AmkaRunStore,
    AmkaStoredRun,
    InMemoryAmkaRunStore,
)
from api.services.amka_core.trace_serialization import serialize_amka_trace_events
from api.services.amka_core.ugs_admin_amka_driver import UgsAdminAmkaDriver
from api.services.amka_core.ugs_amka_bridge import (
    build_ugs_generation_inventory_core_alignment,
    build_ugs_model_routing_core_alignment,
    ugs_amka_subject,
    ugs_generation_inventory_amka_subject,
)
from api.services.amka_core.ugs_generation_inventory_amka_driver import UgsAdminGenerationInventoryAmkaDriver

__all__ = [
    "UgsAdminAmkaDriver",
    "UgsAdminGenerationInventoryAmkaDriver",
    "AmkaCoreEngine",
    "AmkaCoreRunStatus",
    "AmkaCoreStage",
    "AmkaDriver",
    "AmkaDriverCatalogEntry",
    "AmkaPlanOperation",
    "AmkaPlanTask",
    "AmkaPolicyDecision",
    "AmkaPulseArtifact",
    "AmkaRiskLevel",
    "AmkaRunResult",
    "AmkaRunStore",
    "AmkaSnapshot",
    "AmkaStoredRun",
    "AmkaSubjectRef",
    "AmkaTraceEvent",
    "InMemoryAmkaRunStore",
    "ReferenceMockAmkaDriver",
    "StaticReadOnlyAmkaDriver",
    "build_amka_core_run_projection",
    "build_ugs_generation_inventory_core_alignment",
    "build_ugs_model_routing_core_alignment",
    "get_amka_driver_catalog_entry",
    "list_amka_driver_catalog",
    "serialize_amka_driver_catalog",
    "marketing_amka_driver_act_for_http",
    "serialize_amka_trace_events",
    "ugs_amka_subject",
    "ugs_generation_inventory_amka_subject",
]
