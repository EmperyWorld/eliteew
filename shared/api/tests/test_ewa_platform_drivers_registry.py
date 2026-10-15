# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for ``ewa_platform`` in-process driver registry and reserved ``driver_id`` constants.
# Invariants:
# - No network; no ``api.services.amka_core``; ``clear_driver_registry`` isolates tests.
# Related:
# - shared/api/ewa_platform/drivers/registry.py
# - shared/api/ewa_platform/docs/DRIVERS-ROADMAP.md
# ---
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.drivers.registry import (
    CONTENT_MANAGER_DRIVER_ID,
    DOCUMENTS_WORKSPACE_DRIVER_ID,
    ELITEEW_DESKTOP_DRIVER_ID,
    UGS_CONTROL_DRIVER_ID,
    clear_driver_registry,
    get_driver,
    register_driver,
    registered_driver_ids,
)


class _TestNoopDriver:
    """Minimal duck-typed driver for registry API tests."""

    @property
    def driver_id(self) -> str:
        return "noop_test_ewa_platform"

    async def ping(self) -> Mapping[str, Any]:
        return {"ok": True}


def test_reserved_driver_id_constants() -> None:
    assert ELITEEW_DESKTOP_DRIVER_ID == "eliteew_desktop"
    assert UGS_CONTROL_DRIVER_ID == "ugs_control"
    assert DOCUMENTS_WORKSPACE_DRIVER_ID == "documents_workspace"
    assert CONTENT_MANAGER_DRIVER_ID == "content_manager"


def test_register_get_and_clear_driver_registry() -> None:
    clear_driver_registry()
    d = _TestNoopDriver()
    register_driver(d)
    assert get_driver("noop_test_ewa_platform") is d
    assert registered_driver_ids() == frozenset({"noop_test_ewa_platform"})
    clear_driver_registry()
    assert registered_driver_ids() == frozenset()
    assert get_driver("noop_test_ewa_platform") is None
