# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Derive Poemma profit plan percent/status from plan/fact on server upsert.
# Invariants:
# - Client-supplied planPercent/planStatus are overwritten from plan/fact.
# - Empty fact → status empty; no plan with fact → ok without percent.
# Related:
# - api/services/poemma_service.py
# - documentation/product/desktop/DESKTOP-API-AND-APPS.md
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def compute_poemma_profit_plan_fields(
    *,
    target_profit: float | None,
    fact_profit: float | None,
) -> dict[str, Any]:
    plan = float(target_profit) if target_profit is not None and float(target_profit) > 0 else None
    fact = float(fact_profit) if fact_profit is not None and float(fact_profit) > 0 else None
    if fact is None:
        return {"planPercent": None, "planStatus": "empty"}
    if plan is None:
        return {"planPercent": None, "planStatus": "ok"}
    percent = int(round((fact / plan) * 100))
    status = "ok" if fact >= plan else "below"
    return {"planPercent": percent, "planStatus": status}


def enrich_poemma_finance_snapshots_in_payload(
    storage_payload: Mapping[str, Any],
) -> dict[str, Any]:
    """
    For each ``…:finance:{periodId}`` snapshot, set authoritative planPercent/planStatus
    from the matching ``…:goal:{periodId}`` targetProfit and snapshot.profit.
    """
    out = dict(storage_payload)
    for key, value in list(out.items()):
        if not isinstance(key, str) or not isinstance(value, Mapping):
            continue
        parts = key.split(":")
        # poemma:v1:{userId}:finance:{periodId}
        if len(parts) < 5 or parts[3] != "finance":
            continue
        period_id = parts[4]
        user_prefix = ":".join(parts[:3])
        goal_key = f"{user_prefix}:goal:{period_id}"
        goal = out.get(goal_key)
        target = None
        if isinstance(goal, Mapping):
            raw_target = goal.get("targetProfit")
            try:
                target = float(raw_target) if raw_target is not None else None
            except TypeError, ValueError:
                target = None
        raw_profit = value.get("profit")
        try:
            fact = float(raw_profit) if raw_profit is not None else None
        except TypeError, ValueError:
            fact = None
        derived = compute_poemma_profit_plan_fields(
            target_profit=target,
            fact_profit=fact,
        )
        snapshot = dict(value)
        snapshot["planPercent"] = derived["planPercent"]
        snapshot["planStatus"] = derived["planStatus"]
        # Drop any client-authored mirror keys that could confuse readers.
        snapshot.pop("percent", None)
        snapshot.pop("status", None)
        out[key] = snapshot
    return out
