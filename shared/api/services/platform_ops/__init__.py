# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Read-only platform ops probes for Unified Admin (stack0 deploy line + Podman egress).
# Invariants:
# - No mutate / apply / set-mode from this package — CLI remains the mutation surface.
# Related:
# - api/routers/desktop_admin_platform_ops.py
# - documentation/platform/docker-re_doc/ADMIN-PLATFORM-OPS.md
# ---
"""Platform ops status builders for desktop admin."""

from api.services.platform_ops.egress_status import build_egress_status
from api.services.platform_ops.stack0_status import build_stack0_status

__all__ = ["build_egress_status", "build_stack0_status"]
