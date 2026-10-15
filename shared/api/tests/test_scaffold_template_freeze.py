# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock Gate T lite scaffold template freeze (Wave F3/F7).
# ---

from __future__ import annotations

from pathlib import Path

import pytest

from api.services.desktop_app_manifests.scaffold_template_freeze import (
    verify_template_freeze,
)


def test_scaffold_template_freeze_passes() -> None:
    status, detail = verify_template_freeze()
    assert status == "PASSED", detail


def test_packaged_gate_t_fallback_without_cursor(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """Baked runtime has no monorepo .cursor — packaged mirror must pass Gate T."""

    apps = tmp_path / "apps"
    apps.mkdir()
    monkeypatch.setattr(
        "api.services.desktop_app_manifests.scaffold_template_freeze.apps_root",
        lambda: apps,
    )
    monkeypatch.setattr(
        "api.services.desktop_app_manifests.scaffold_template_freeze.monorepo_root_from_apps",
        lambda _apps: tmp_path,
    )
    status, detail = verify_template_freeze()
    assert status == "PASSED", detail
    assert "source=packaged" in detail


def test_packaged_fallback_when_explicit_root_has_no_cursor(tmp_path: Path) -> None:
    """assembly_gates passes monorepo_root — must still use packaged freeze."""

    status, detail = verify_template_freeze(tmp_path)
    assert status == "PASSED", detail
    assert "source=packaged" in detail
