#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# E7 regression locks for the dry-run EWA capacity model and safe script entrypoint.
# Invariants:
# - Tests must not contact Redis, Postgres, Celery, or HTTP services.
# - 100-principal projection may be at_risk, but should not raise a high bottleneck under defaults.
# Related:
# - api/ewa_platform/capacity/model.py
# - docker/scripts/ewa-capacity-model.py
# - documentation/product/ewa/EWA-CAPACITY-MODEL-E7-2026-07-09.md
# ---

from __future__ import annotations

from pathlib import Path

import pytest

from api.ewa_platform.capacity.model import evaluate_capacity, evaluate_capacity_matrix

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parents[1]


@pytest.mark.unit
def test_capacity_model_100_principals_has_no_high_bottleneck() -> None:
    report = evaluate_capacity(100)

    assert report["principals"] == 100
    assert report["verdict"] in {"ok", "at_risk"}
    assert all(item["severity"] != "high" for item in report["bottlenecks"])


@pytest.mark.unit
def test_capacity_model_1000_principals_detects_e7_bottleneck() -> None:
    report = evaluate_capacity(1000)
    bottlenecks = {item["id"]: item for item in report["bottlenecks"]}

    assert report["verdict"] == "blocked"
    assert any(
        bottlenecks[item]["severity"] in {"medium", "high"}
        for item in ("rate_limit", "companion_slots", "reaper_clearance")
    )
    assert bottlenecks["companion_slots"]["severity"] == "high"


@pytest.mark.unit
def test_capacity_model_matrix_default_length_is_three() -> None:
    reports = evaluate_capacity_matrix()

    assert [report["principals"] for report in reports] == [100, 500, 1000]


@pytest.mark.unit
def test_capacity_model_script_mentions_dry_run_and_capacity_model() -> None:
    script_path = REPO_ROOT / "docker" / "scripts" / "ewa-capacity-model.py"
    if not script_path.exists():
        pytest.skip("docker/scripts is not mounted in immutable API test image")

    source = script_path.read_text(encoding="utf-8").lower()
    assert "dry-run" in source
    assert "capacity model" in source
