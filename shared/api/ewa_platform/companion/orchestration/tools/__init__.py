# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Package marker for split EWA companion tool registry handlers. Public API remains
# ``api.ewa_platform.companion.orchestration.tool_registry`` (thin re-export shim).
# Invariants:
# - No eager imports here — avoids circular import with ``companion_music_xl_base``.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# ---
"""EWA companion tool registry handler package (implementation split)."""

from __future__ import annotations
