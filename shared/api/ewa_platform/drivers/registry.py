# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# In-process driver registry for tests and future gateway bootstrap (no global side effects on import).
# Invariants:
# - Registry is opt-in: nothing registers drivers until callers invoke register_driver.
# Related:
# - api/ewa_platform/drivers/protocol.py
# - api/ewa_platform/drivers/desktop_shell.py (reserved driver_id ``eliteew_desktop`` for HTTP adapter)
# - api/ewa_platform/docs/DRIVERS-ROADMAP.md
# ---
from __future__ import annotations

from api.ewa_platform.drivers.protocol import AmkaDriver

_REGISTRY: dict[str, AmkaDriver] = {}


def register_driver(driver: AmkaDriver) -> None:
    """Store a driver instance under driver.driver_id."""

    _REGISTRY[driver.driver_id] = driver


def get_driver(driver_id: str) -> AmkaDriver | None:
    return _REGISTRY.get(driver_id)


def clear_driver_registry() -> None:
    """Reset registry (testing helper)."""

    _REGISTRY.clear()


def registered_driver_ids() -> frozenset[str]:
    return frozenset(_REGISTRY.keys())


# Reserved registry keys (see docs/DRIVERS-ROADMAP.md); register implementations only from composition roots.
ELITEEW_DESKTOP_DRIVER_ID = "eliteew_desktop"
UGS_CONTROL_DRIVER_ID = "ugs_control"
DOCUMENTS_WORKSPACE_DRIVER_ID = "documents_workspace"
CONTENT_MANAGER_DRIVER_ID = "content_manager"
EWA_COMPANION_AMBIENT_DRIVER_ID = "ewa_companion_ambient"
