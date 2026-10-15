# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 4.6 contract: every quick-intent ``route_hint`` maps to registry, workflow, or chat-only wiring.
# Invariants:
# - Registry hints must exist in ``tool_registry.REGISTRY`` and appear in bypass probe set.
# - Workflow hints map to a known chat workflow id.
# Related:
# - api/ewa_platform/companion/ux/quick_intents.py
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.orchestration import task_orchestrator
from api.ewa_platform.companion.orchestration.tool_registry import REGISTRY
from api.ewa_platform.companion.orchestration.workflow_registry import match_chat_workflow_from_line
from api.ewa_platform.companion.ux.quick_intents import (
    QuickIntentRouteKind,
    all_quick_intent_specs,
    quick_intent_registry_bypass_route_hints,
    quick_intent_route_kind,
    quick_intent_workflow_id_for_route_hint,
)


@pytest.mark.parametrize("spec", all_quick_intent_specs(), ids=lambda s: s.intent_id.value)
def test_quick_intent_route_hint_kind_is_known(spec) -> None:
    kind = quick_intent_route_kind(spec.route_hint)
    assert kind in QuickIntentRouteKind


def test_all_registry_route_hints_exist_in_tool_registry() -> None:
    registry_hints = {
        spec.route_hint.strip()
        for spec in all_quick_intent_specs()
        if quick_intent_route_kind(spec.route_hint) == QuickIntentRouteKind.REGISTRY
    }
    missing = sorted(registry_hints - set(REGISTRY.keys()))
    assert missing == []


def test_registry_route_hints_match_bypass_probe_set() -> None:
    registry_hints = {
        spec.route_hint.strip()
        for spec in all_quick_intent_specs()
        if quick_intent_route_kind(spec.route_hint) == QuickIntentRouteKind.REGISTRY
    }
    assert quick_intent_registry_bypass_route_hints() == frozenset(registry_hints)


def test_task_orchestrator_bypass_set_derived_from_quick_intents() -> None:
    assert task_orchestrator._QUICK_INTENT_BYPASS_ROUTE_HINTS == quick_intent_registry_bypass_route_hints()


def test_file_rewrite_in_registry_bypass_set() -> None:
    assert "file_rewrite" in quick_intent_registry_bypass_route_hints()


def test_workflow_reflect_week_maps_to_reflect_week_catalog() -> None:
    workflow_id = quick_intent_workflow_id_for_route_hint("workflow_reflect_week")
    assert workflow_id == "reflect_week"
    assert match_chat_workflow_from_line("Подведи итоги недели") == workflow_id


@pytest.mark.parametrize(
    ("route_hint", "expected_kind"),
    [
        ("chat_only", QuickIntentRouteKind.CHAT_ONLY),
        ("desk_context", QuickIntentRouteKind.CHAT_ONLY),
        ("workflow_reflect_week", QuickIntentRouteKind.WORKFLOW),
        ("catalog_list", QuickIntentRouteKind.REGISTRY),
        ("file_rewrite", QuickIntentRouteKind.REGISTRY),
    ],
)
def test_route_kind_examples(route_hint: str, expected_kind: QuickIntentRouteKind) -> None:
    assert quick_intent_route_kind(route_hint) == expected_kind
