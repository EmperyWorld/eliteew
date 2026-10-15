# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **EWA Atom layer** package boundary: deterministic classification + pure graph transforms (no heavy optional deps).
# Invariants:
# - This ``__init__`` must **not** import ``ingest`` (pulls asyncpg); callers that persist atoms import
#   ``api.ewa_platform.atoms.ingest`` explicitly (e.g. ``episodic.record_user_turn``).
# Related:
# - documentation/product/ewa/EWA-ATOM-LAYER.md
# - api/ewa_platform/contracts/atoms_v1.py
# ---
"""EWA Atom layer (classifier, graph helpers)."""

from __future__ import annotations

from api.ewa_platform.atoms.classifier import (
    atom_layer_enabled,
    classify_raw_text_llm_v1,
    classify_raw_text_v0,
)
from api.ewa_platform.atoms.graph import build_atom_graph_edges

__all__ = [
    "atom_layer_enabled",
    "build_atom_graph_edges",
    "classify_raw_text_llm_v1",
    "classify_raw_text_v0",
]
