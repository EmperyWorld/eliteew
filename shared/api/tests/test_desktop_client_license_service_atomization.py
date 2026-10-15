#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Structural lock for desktop-client license_service atomization (audit #022).
# Invariants:
# - Facade ≤200 LOC; models/enroll/ops/runtime each ≤800 LOC.
# - Public import path api.services.desktop_client.license_service re-exports symbols.
# Related:
# - api.services.desktop_client.license_*; documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---
"""Desktop-client license service atomization contract."""

from __future__ import annotations

from pathlib import Path

from api.services.desktop_client import license_service as facade

SERVICES = Path(__file__).resolve().parents[1] / "services" / "desktop_client"


def _loc(name: str) -> int:
    return len((SERVICES / name).read_text(encoding="utf-8").splitlines())


def test_license_service_modules_under_loc_caps() -> None:
    assert _loc("license_service.py") <= 200
    assert _loc("license_mixin_host.py") <= 80
    for name in (
        "license_models.py",
        "license_enroll.py",
        "license_ops.py",
        "license_runtime.py",
    ):
        assert _loc(name) <= 800, name


def test_facade_reexports_public_symbols() -> None:
    for symbol in (
        "BoundLicenseView",
        "DesktopClientError",
        "DesktopClientLicenseService",
        "IssuedLicenseView",
        "LicenseCapabilitiesView",
        "LicenseDeviceItem",
        "LicenseInventoryItem",
        "LicensePreflightView",
        "SessionAssertView",
        "challenge_proof",
        "hash_license_key",
    ):
        assert hasattr(facade, symbol), symbol
    from api.services.desktop_client.license_enroll import LicenseEnrollMixin
    from api.services.desktop_client.license_mixin_host import LicenseMixinHost
    from api.services.desktop_client.license_ops import LicenseOpsMixin
    from api.services.desktop_client.license_runtime import LicenseRuntimeMixin

    assert issubclass(LicenseEnrollMixin, LicenseMixinHost)
    assert issubclass(LicenseOpsMixin, LicenseMixinHost)
    assert issubclass(LicenseRuntimeMixin, LicenseMixinHost)
    assert issubclass(facade.DesktopClientLicenseService, LicenseEnrollMixin)
    assert issubclass(facade.DesktopClientLicenseService, LicenseOpsMixin)
    assert issubclass(facade.DesktopClientLicenseService, LicenseRuntimeMixin)
