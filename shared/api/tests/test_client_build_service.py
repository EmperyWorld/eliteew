# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
"""Tests for SPA client build gate helpers."""

from __future__ import annotations

from pathlib import Path

import pytest

from api.services import client_build_service as cbs


@pytest.fixture(autouse=True)
def reset_client_build_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    cbs._cached_build_id = None
    cbs._cached_mtime = 0.0
    cbs._cached_at = 0.0
    monkeypatch.setenv("ELITEEW_CLIENT_BUILD_GATE", "1")


def test_gate_off_when_file_missing(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("ELITEEW_APP_BUILD_VERSION_FILE", str(tmp_path / "missing.txt"))
    ok, reason = cbs.validate_client_build(None, user_agent="Mozilla/5.0")
    assert ok is True
    assert reason is None


def test_reject_missing_app_build_for_browser(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    build_file = tmp_path / "app-build-version.txt"
    build_file.write_text("deploy-abc\n", encoding="utf-8")
    monkeypatch.setenv("ELITEEW_APP_BUILD_VERSION_FILE", str(build_file))

    ok, reason = cbs.validate_client_build("", user_agent="Mozilla/5.0 Chrome")
    assert ok is False
    assert reason == "missing_app_build"


def test_missing_allowed_when_reject_missing_false(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    build_file = tmp_path / "app-build-version.txt"
    build_file.write_text("deploy-abc\n", encoding="utf-8")
    monkeypatch.setenv("ELITEEW_APP_BUILD_VERSION_FILE", str(build_file))

    ok, reason = cbs.validate_client_build("", user_agent="Mozilla/5.0 Chrome", reject_missing=False)
    assert ok is True
    assert reason is None


def test_reject_mismatch(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    build_file = tmp_path / "app-build-version.txt"
    build_file.write_text("deploy-new\n", encoding="utf-8")
    monkeypatch.setenv("ELITEEW_APP_BUILD_VERSION_FILE", str(build_file))

    ok, reason = cbs.validate_client_build("deploy-old", user_agent="Mozilla/5.0")
    assert ok is False
    assert reason == "app_build_mismatch"


def test_ok_when_match(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    build_file = tmp_path / "app-build-version.txt"
    build_file.write_text("deploy-xyz\n", encoding="utf-8")
    monkeypatch.setenv("ELITEEW_APP_BUILD_VERSION_FILE", str(build_file))

    ok, reason = cbs.validate_client_build("deploy-xyz", user_agent="Mozilla/5.0")
    assert ok is True
    assert reason is None


def test_mobile_okhttp_skipped(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    build_file = tmp_path / "app-build-version.txt"
    build_file.write_text("deploy-xyz\n", encoding="utf-8")
    monkeypatch.setenv("ELITEEW_APP_BUILD_VERSION_FILE", str(build_file))

    ok, reason = cbs.validate_client_build(None, user_agent="okhttp/4.12.0")
    assert ok is True
    assert reason is None
