# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock outbound send authorization: router bypass ≠ confirm; DAG flag / auto-accept only.
# Related:
# - api/ewa_platform/companion/orchestration/tools/handlers_comms.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.tools import handlers_comms as hc


def test_outbound_router_bypass_does_not_authorize_send() -> None:
    assert hc._outbound_may_send_now({"_tool_router_bypass_line_match": True}) is False


def test_outbound_dag_flag_authorizes_send() -> None:
    assert hc._outbound_may_send_now({"_dag_outbound_authorized": True}) is True


def test_outbound_confirmed_authorizes_send() -> None:
    assert hc._outbound_may_send_now({"confirmed": True}) is True
    assert hc._outbound_may_send_now({"outbound_confirmed": "yes"}) is True


def test_outbound_default_requires_hitl() -> None:
    assert hc._outbound_may_send_now({}) is False
