# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Gen/Forge factory Intention package (Wave F5–F6): FSM + store + atoms + admin.
# Invariants:
# - Parallel to companion agentic — does not mutate ewa_agentic_sessions.
# - ELITEEW_FACTORY_AUTONOMOUS=0 skips implement writes (plan/verify only).
# Related:
# - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md
# ---

from api.ewa_platform.factory.atoms import (
    FactoryAtom,
    FactoryAtomKind,
    get_factory_atom_store,
    record_factory_atom,
)
from api.ewa_platform.factory.config import (
    factory_assembly_enabled,
    factory_async_jobs_enabled,
    factory_autonomous_enabled,
    factory_enabled,
    factory_max_fix_loops,
)
from api.ewa_platform.factory.context_pack import build_context_pack
from api.ewa_platform.factory.models import FactoryStage, FactoryStatus, IntentionRecord
from api.ewa_platform.factory.service import FactoryIntentionService, get_factory_service

__all__ = [
    "FactoryAtom",
    "FactoryAtomKind",
    "FactoryIntentionService",
    "FactoryStage",
    "FactoryStatus",
    "IntentionRecord",
    "build_context_pack",
    "factory_assembly_enabled",
    "factory_async_jobs_enabled",
    "factory_autonomous_enabled",
    "factory_enabled",
    "factory_max_fix_loops",
    "get_factory_atom_store",
    "get_factory_service",
    "record_factory_atom",
]
