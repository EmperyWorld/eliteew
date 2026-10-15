# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Idempotent reward spec normalization contract (no DB/Gaf imports in host venv).
# Related:
#   - api/services/surveys/survey_reward_service.py
# ---

from __future__ import annotations


def normalize_reward_spec(raw: dict[str, int] | None) -> dict[str, int]:
    data = raw or {}
    return {
        "ugs_credits": max(0, int(data.get("ugs_credits") or 0)),
        "ew_balance": max(0, int(data.get("ew_balance") or 0)),
        "web_search_coins": max(0, int(data.get("web_search_coins") or 0)),
    }


def test_normalize_reward_spec_clamps_negative() -> None:
    assert normalize_reward_spec({"ugs_credits": -5, "ew_balance": 3}) == {
        "ugs_credits": 0,
        "ew_balance": 3,
        "web_search_coins": 0,
    }


def test_reward_service_idempotent_spec_guard() -> None:
    granted = normalize_reward_spec({"ugs_credits": 10, "ew_balance": 0, "web_search_coins": 0})
    assert granted["ugs_credits"] == 10
    assert normalize_reward_spec({"ugs_credits": 99})["ugs_credits"] == 99
