# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for lightweight autofill draft normalizers that run before heavy router validation.
# Invariants:
# - Funnel aliases and numeric counters stay normalized without importing full API router dependencies.
# Related:
# - api/routers/marketing_cabinet/autofill_draft_normalize.py
# ---
"""Unit tests: нормализация черновиков autofill (без тяжёлых импортов роутера)."""

from __future__ import annotations

import pytest

from api.routers.marketing_cabinet.autofill_draft_normalize import (
    ensure_dict_name_from_aliases,
    normalize_funnel_draft_stages_field,
)


@pytest.mark.unit
def test_normalize_funnel_stages_single_dict_wrap() -> None:
    raw = {"name": "F", "stages": {"name": "Top", "stage_order": 1}}
    out = normalize_funnel_draft_stages_field(raw)
    assert isinstance(out, dict)
    assert out["stages"] == [
        {"name": "Top", "stage_order": 1, "stage_name": "Top", "visitors": 0, "conversions": 0},
    ]


@pytest.mark.unit
def test_normalize_funnel_stages_list_title_alias() -> None:
    raw = {"name": "F", "stages": [{"title": "Mid"}]}
    out = normalize_funnel_draft_stages_field(raw)
    assert out["stages"] == [
        {"title": "Mid", "stage_name": "Mid", "visitors": 0, "conversions": 0, "stage_order": 0},
    ]


@pytest.mark.unit
def test_normalize_funnel_stages_funnel_steps_alias() -> None:
    raw = {"name": "F", "funnel_steps": [{"label": "Lead", "visitors": "7"}]}
    out = normalize_funnel_draft_stages_field(raw)
    assert out["stages"] == [
        {"label": "Lead", "visitors": 7, "stage_name": "Lead", "conversions": 0, "stage_order": 0},
    ]


@pytest.mark.unit
def test_ensure_dict_name_from_title_alias() -> None:
    out = ensure_dict_name_from_aliases({"title": "  My funnel "}, alternate_keys=("title", "label"))
    assert out["name"] == "My funnel"


@pytest.mark.unit
def test_normalize_funnel_stages_null_counters_become_zero() -> None:
    raw = {
        "name": "F",
        "stages": [
            {"stage_name": "A", "visitors": None, "conversions": None},
            {"stage_name": "B", "visitors": "12", "conversions": ""},
        ],
    }
    out = normalize_funnel_draft_stages_field(raw)
    assert out["stages"][0]["visitors"] == 0
    assert out["stages"][0]["conversions"] == 0
    assert out["stages"][1]["visitors"] == 12
    assert out["stages"][1]["conversions"] == 0
