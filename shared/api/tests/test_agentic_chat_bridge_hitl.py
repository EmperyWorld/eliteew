# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression locks for chat text routed into agentic HITL gates.
# Invariants:
# - Ambiguous chat text must never be treated as a confirmation.
# Related:
# - api/ewa_platform/agentic/chat_bridge.py
# ---

from __future__ import annotations

from api.ewa_platform.agentic.chat_bridge import _chat_hitl_decision_from_text


def test_chat_hitl_decision_requires_explicit_confirm() -> None:
    assert _chat_hitl_decision_from_text("подтверждаю") == "confirm"
    assert _chat_hitl_decision_from_text(" yes ") == "confirm"


def test_chat_hitl_decision_detects_cancel_without_confirming() -> None:
    assert _chat_hitl_decision_from_text("отмена") == "cancel"
    assert _chat_hitl_decision_from_text("no") == "cancel"


def test_chat_hitl_decision_does_not_guess_ambiguous_text() -> None:
    assert _chat_hitl_decision_from_text("нет, подожди, измени план") is None
    assert _chat_hitl_decision_from_text("а почему нужен этот документ?") is None
