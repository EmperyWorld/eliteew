# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Describes known AMKA drivers and profiles without importing domain-heavy adapters.
# The catalog gives the standalone component a stable map of current and planned entrypoints.
# Invariants:
# - Entries are metadata only; this module must not instantiate drivers or open database connections.
# - `driver_key` + `domain_profile` pairs stay unique.
# Related:
# - shared/api/services/amka_core/contracts.py
# - documentation/product/amka-seed-album/AMKA-ENTRYPOINTS.md
# ---
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class AmkaDriverCatalogEntry:
    """Metadata for one known AMKA driver/profile pair."""

    driver_key: str
    domain_profile: str
    title: str
    status: str
    entrypoint: str
    supports_write_actions: bool = False
    risk_posture: str = "unknown"
    capabilities: Sequence[str] = field(default_factory=tuple)
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-ready driver catalog entry."""

        return {
            "driver_key": self.driver_key,
            "domain_profile": self.domain_profile,
            "title": self.title,
            "status": self.status,
            "entrypoint": self.entrypoint,
            "supports_write_actions": self.supports_write_actions,
            "risk_posture": self.risk_posture,
            "capabilities": list(self.capabilities),
            "notes": self.notes,
        }


KNOWN_AMKA_DRIVER_CATALOG: tuple[AmkaDriverCatalogEntry, ...] = (
    AmkaDriverCatalogEntry(
        driver_key="marketing_cabinet",
        domain_profile="marketing",
        title="Marketing Cabinet AMKA",
        status="production_adapter",
        entrypoint="Marketing Cabinet -> project -> AMKA tab",
        supports_write_actions=True,
        risk_posture="operator_gated",
        capabilities=("snapshot", "plan", "approval", "execute", "pulse", "export"),
        notes="Current user-facing AMKA entrypoint; standalone core projection is additive.",
    ),
    AmkaDriverCatalogEntry(
        driver_key="reference_mock",
        domain_profile="mock",
        title="Reference Mock AMKA",
        status="contract_test",
        entrypoint="Internal tests and driver examples",
        supports_write_actions=False,
        risk_posture="deterministic_mock",
        capabilities=("snapshot", "plan", "policy", "execute", "pulse"),
        notes="Lightweight reference implementation with no domain storage.",
    ),
    AmkaDriverCatalogEntry(
        driver_key="static_read_only",
        domain_profile="read_only_audit",
        title="Static Read-Only AMKA",
        status="prototype",
        entrypoint="Internal read-only audit scenarios",
        supports_write_actions=False,
        risk_posture="read_only",
        capabilities=("snapshot", "plan", "policy", "pulse"),
        notes="Second non-marketing profile proving AMKA can inspect subjects without mutations.",
    ),
    AmkaDriverCatalogEntry(
        driver_key="ugs_admin",
        domain_profile="model_routing",
        title="UGS Admin — model routing alignment",
        status="production_read_only",
        entrypoint="GET /api/v1/ewa/ugs/model-routing/core-alignment (UGS admin JWT)",
        supports_write_actions=False,
        risk_posture="read_only_audit",
        capabilities=("snapshot", "plan", "policy", "pulse"),
        notes=(
            "Non-marketing production read-only profile over live `UGSSetting.model_routes`; "
            "mutations remain in UGS Admin v2 APIs."
        ),
    ),
    AmkaDriverCatalogEntry(
        driver_key="ugs_admin",
        domain_profile="generation_inventory",
        title="UGS Admin — generation inventory alignment",
        status="production_read_only",
        entrypoint="GET /api/v1/ewa/ugs/generation-inventory/core-alignment (UGS admin JWT)",
        supports_write_actions=False,
        risk_posture="read_only_audit",
        capabilities=("snapshot", "plan", "policy", "pulse"),
        notes=(
            "Read-only alignment over `build_snapshot` (providers, types, workflows, validation issues); "
            "mutations remain in UGS Admin v2 APIs."
        ),
    ),
)


def list_amka_driver_catalog() -> tuple[AmkaDriverCatalogEntry, ...]:
    """Return the known AMKA driver/profile catalog."""

    return KNOWN_AMKA_DRIVER_CATALOG


def serialize_amka_driver_catalog() -> list[dict[str, Any]]:
    """Return the known driver/profile catalog in a JSON-ready shape."""

    return [entry.to_dict() for entry in KNOWN_AMKA_DRIVER_CATALOG]


def get_amka_driver_catalog_entry(
    driver_key: str,
    domain_profile: str,
) -> AmkaDriverCatalogEntry | None:
    """Find one AMKA driver/profile entry by its stable contract keys."""

    return next(
        (
            entry
            for entry in KNOWN_AMKA_DRIVER_CATALOG
            if entry.driver_key == driver_key and entry.domain_profile == domain_profile
        ),
        None,
    )
