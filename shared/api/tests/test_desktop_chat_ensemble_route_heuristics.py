# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for versioned ensemble route heuristics resolution and admin extras.
# Invariants:
# - Canonical hints remain available without admin config; extras are additive only.
# Related:
# - api/services/desktop_chat_ensemble/route_heuristics.py
# - api/services/desktop_chat_ensemble/conversational_route.py
# ---
"""Tests for ensemble route heuristics config."""

from __future__ import annotations

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat_ensemble.conversational_route import heuristic_ensemble_route_phase
from api.services.desktop_chat_ensemble.route_heuristics import resolve_ensemble_route_heuristics
from api.services.desktop_chat_ensemble.route_heuristics_data import ENSEMBLE_ROUTE_HEURISTICS_VERSION


def test_resolve_heuristics_default_version_and_canonical_hints() -> None:
    resolved = resolve_ensemble_route_heuristics({})
    assert resolved.version == ENSEMBLE_ROUTE_HEURISTICS_VERSION
    assert resolved.version >= 6
    assert resolved.extras_applied is False
    assert "техплан" in resolved.all_blueprint_needles
    assert "реестр" in resolved.all_blueprint_needles
    assert "список из" in resolved.all_blueprint_needles
    assert "протокол встречи" in resolved.all_blueprint_needles
    assert "ясно" in resolved.brief_acknowledgements


def test_admin_blueprint_hint_extra_triggers_blueprint_phase() -> None:
    phase = heuristic_ensemble_route_phase(
        user_text="Нужен кастомный артефакт для команды",
        defaults={"ensemble_route_blueprint_hints_extra": ["кастомный артефакт"]},
        history=None,
    )
    assert phase == "blueprint"
    resolved = resolve_ensemble_route_heuristics({"ensemble_route_blueprint_hints_extra": ["кастомный артефакт"]})
    assert resolved.extras_applied is True


def test_admin_brief_ack_extra_merges_into_set() -> None:
    resolved = resolve_ensemble_route_heuristics({"ensemble_route_brief_ack_extra": ["принял"]})
    assert "принял" in resolved.brief_acknowledgements
    assert resolved.extras_applied is True
