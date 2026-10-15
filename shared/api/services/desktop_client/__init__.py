# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Package exports for desktop_client services.
# Invariants:
# - — (нет)
# Related:
# - —
# ---

from __future__ import annotations

from api.services.desktop_client.license_service import (
    BoundLicenseView,
    DesktopClientError,
    DesktopClientLicenseService,
)

__all__ = [
    "BoundLicenseView",
    "DesktopClientError",
    "DesktopClientLicenseService",
]
