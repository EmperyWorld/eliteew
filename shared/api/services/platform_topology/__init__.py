# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Read-only platform topology graph for Unified Admin (Wave G1 — honest catalog).
# Invariants:
# - Edges only from catalog JSON — no synthetic complete mesh.
# - Health overlay may be unknown without a local probe; never fake ok.
# Related:
# - documentation/platform/docker-re_doc/ADMIN-TOPOLOGY-MAP.md
# - documentation/platform/PRODUCTION-TOPOLOGY-STATE.md §Current
# ---
"""Platform topology graph builders for desktop admin."""

from api.services.platform_topology.graph_builder import build_topology_graph

__all__ = ["build_topology_graph"]
