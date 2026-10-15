# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AIS performance guard — cursor_move validation overhead vs committed baseline (AIS-PERF-01).
# Invariants:
# - Baseline update only via AIS_UPDATE_BASELINE=1 (false-positive escape hatch).
# Related:
# - tests/architecture/baseline/cursor_move_validation_baseline.json
# ---

from __future__ import annotations

import json
import os
import time
from pathlib import Path

import pytest

from api.routers.socketio_event_schemas import CursorMoveEvent, parse_socket_event

BASELINE_PATH = Path(__file__).resolve().parent / "baseline" / "cursor_move_validation_baseline.json"

VALID_CURSOR_MOVE = {"cursor_position": {"line": 4, "column": 12}}


def _load_baseline() -> dict:
    with BASELINE_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def _measure_cursor_move_validation_ms(*, iterations: int) -> float:
    start = time.perf_counter()
    for _ in range(iterations):
        parsed, errors = parse_socket_event(CursorMoveEvent, VALID_CURSOR_MOVE)
        assert parsed is not None and errors is None
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    return elapsed_ms


def test_cursor_move_validation_within_baseline_sla() -> None:
    baseline = _load_baseline()
    iterations = int(baseline["iterations"])
    measured_ms = _measure_cursor_move_validation_ms(iterations=iterations)

    if os.environ.get("AIS_UPDATE_BASELINE") == "1":
        baseline["max_ms_per_1000_validations"] = round(measured_ms, 3)
        with BASELINE_PATH.open("w", encoding="utf-8") as handle:
            json.dump(baseline, handle, indent=2)
            handle.write("\n")
        pytest.skip(f"baseline updated: {measured_ms:.3f} ms / {iterations} validations")

    limit_ms = float(baseline["max_ms_per_1000_validations"])
    slack = float(baseline.get("ci_slack_ratio", 1.1))
    assert measured_ms <= limit_ms * slack, (
        f"cursor_move validation SLA exceeded: {measured_ms:.3f}ms > {limit_ms * slack:.3f}ms "
        f"(baseline {limit_ms}ms × slack {slack}). "
        "If intentional, run AIS_UPDATE_BASELINE=1 bash docker/scripts/run-ais-sentinel.sh"
    )
