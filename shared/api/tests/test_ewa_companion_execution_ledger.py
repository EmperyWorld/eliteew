# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.orchestration.execution_ledger import (
    attach_reports_to_response,
    derive_orchestration_outcome,
    record_fell_through,
    record_tool_result,
)


@pytest.fixture(autouse=True)
def enable_execution_reports(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_EXECUTION_REPORT_ENABLED", "1")


def test_skipped_tool_yields_not_started_report() -> None:
    report = record_tool_result("music_generation", None, branch="music_generation", user_line="привет")
    assert report is not None
    assert report.outcome == "not_started"
    assert report.reason_code == "tool_no_match"


def test_unavailable_tool_report() -> None:
    report = record_tool_result(
        "music_generation",
        {"status": "unavailable", "reply": "Сервис недоступен", "tool": "music_generation"},
        branch="music_generation",
        user_line="сгенерируй песню",
    )
    assert report is not None
    assert report.outcome == "unavailable"


def test_fell_through_orchestration_outcome() -> None:
    fell = record_fell_through()
    assert fell is not None
    outcome = derive_orchestration_outcome([fell], orchestrated=None)
    assert outcome == "fell_through"


def test_attach_reports_to_response() -> None:
    report = record_tool_result("theme_set", {"status": "ok", "reply": "ok", "tool": "theme_set"}, branch="theme_set")
    assert report is not None
    payload: dict = {"reply": "ok", "actions": []}
    out = attach_reports_to_response(payload, [report], orchestrated=payload)
    assert out["orchestration_outcome"] == "handled"
    assert len(out["execution_reports"]) >= 1


def test_disabled_flag_returns_none(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_EXECUTION_REPORT_ENABLED", "0")
    report = record_tool_result("x", None, branch="x")
    assert report is None
