# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# EWA desktop driver protocols and catalogue registration (shell, documents, content, UGS hints).
# Invariants:
# - Driver implementations must not import marketing or UGS domains at registry import time.
# Related:
# - api/ewa_platform/drivers/protocol.py
# - api/ewa_platform/drivers/registry.py
# - api/ewa_platform/docs/DRIVERS-ROADMAP.md
# ---
from __future__ import annotations

from api.ewa_platform.drivers.content_manager import ContentManagerDriver
from api.ewa_platform.drivers.desktop_shell import DesktopShellDriver
from api.ewa_platform.drivers.documents_workspace import DocumentsWorkspaceDriver
from api.ewa_platform.drivers.protocol import AmkaDriver
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
from api.ewa_platform.drivers.ugs_control import UgsControlDriver

__all__ = [
    "CONTENT_MANAGER_DRIVER_ID",
    "ContentManagerDriver",
    "DOCUMENTS_WORKSPACE_DRIVER_ID",
    "DocumentsWorkspaceDriver",
    "ELITEEW_DESKTOP_DRIVER_ID",
    "UGS_CONTROL_DRIVER_ID",
    "UgsControlDriver",
    "AmkaDriver",
    "DesktopShellDriver",
    "clear_driver_registry",
    "get_driver",
    "register_driver",
    "registered_driver_ids",
]
