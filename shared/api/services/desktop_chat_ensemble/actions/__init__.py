# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Public exports for ensemble mid-turn action execution (Wave 1).
# Invariants:
# - Read-only probes only; capability gates before planning.
# Related:
# - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
# ---
"""Ensemble action execution package."""

from api.services.desktop_chat_ensemble.actions.capability import resolve_action_capabilities
from api.services.desktop_chat_ensemble.actions.gate import action_gate_enabled, resolve_action_mode
from api.services.desktop_chat_ensemble.actions.merge import merge_action_sources_into_rag_ctx
from api.services.desktop_chat_ensemble.actions.orchestrate import run_action_pack
from api.services.desktop_chat_ensemble.actions.stream_emit import sse_action_skipped
from api.services.desktop_chat_ensemble.actions.types import ActionPackResult, CapabilitySnapshot

__all__ = [
    "ActionPackResult",
    "CapabilitySnapshot",
    "action_gate_enabled",
    "merge_action_sources_into_rag_ctx",
    "resolve_action_capabilities",
    "resolve_action_mode",
    "run_action_pack",
    "sse_action_skipped",
]
