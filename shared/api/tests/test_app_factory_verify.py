# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral locks for app factory DoD gates (Wave F2).
# ---

from __future__ import annotations

from api.services.desktop_app_manifests.factory_verify import (
    _d1_stub_or_fake,
    format_report,
    verify_app_factory,
)


def test_gold_project_about_passes() -> None:
    report = verify_app_factory("project_about")
    assert report.status == "PASSED", format_report(report)
    assert report.app_component == "ProjectAboutApp"
    assert all(g.ok for g in report.gates)


def test_gold_notifications_passes() -> None:
    report = verify_app_factory("notifications")
    assert report.status == "PASSED", format_report(report)
    assert report.app_component == "NotificationsApp"


def test_calendar_app_passes_factory_gates() -> None:
    report = verify_app_factory("calendar")
    assert report.status == "PASSED", format_report(report)
    assert report.app_component == "CalendarApp"


def test_stub_phrase_detector_fails_scaffold_copy() -> None:
    bad = _d1_stub_or_fake("Scaffold stub — replace with product UI.")
    assert bad is not None
    assert "Scaffold stub" in bad
    assert _d1_stub_or_fake("Real product panel with content") is None


def test_missing_manifest_fails() -> None:
    report = verify_app_factory("no_such_app_zzz")
    assert report.status == "FAILED"
    assert any(g.gate == "D3" and not g.ok for g in report.gates)
