# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: Podman CLI env gets a writable XDG dir even when HOME is Carrier SSH /home/owned.
# Invariants:
# - Does not bind or create host ~/.config.
# - Does not fall back to /tmp.
# Related:
# - api/services/site_studio_runtime/helpers.py
# - documentation/product/SITE-STUDIO.md
# ---
from __future__ import annotations

import os
from pathlib import Path

import pytest

from api.services.site_studio_runtime import helpers as site_studio_helpers
from api.services.site_studio_runtime.helpers import (
    SITE_STUDIO_PODMAN_XDG_CONFIG_HOME_CANONICAL,
    SiteStudioRuntimeError,
    ensure_podman_xdg_config_home,
)


def test_ensure_podman_xdg_prefers_configured_writable_dir(tmp_path: Path) -> None:
    xdg = tmp_path / "xdg-config"
    env = {"HOME": str(tmp_path / "owned-home"), "XDG_CONFIG_HOME": str(xdg)}
    resolved = ensure_podman_xdg_config_home(env)
    assert resolved == str(xdg)
    assert xdg.is_dir()
    assert env["XDG_CONFIG_HOME"] == str(xdg)
    assert not (tmp_path / "owned-home" / ".config").exists()


def test_ensure_podman_xdg_skips_file_and_uses_canonical(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    blocked = tmp_path / "blocked-xdg"
    blocked.write_text("not-a-dir", encoding="utf-8")
    canonical = tmp_path / "canonical-xdg"
    monkeypatch.setattr(
        "api.services.site_studio_runtime.helpers.SITE_STUDIO_PODMAN_XDG_CONFIG_HOME_CANONICAL",
        str(canonical),
    )
    env = {"XDG_CONFIG_HOME": str(blocked)}
    resolved = ensure_podman_xdg_config_home(env)
    assert resolved == str(canonical)
    assert canonical.is_dir()


def test_ensure_podman_xdg_raises_when_nothing_writable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.site_studio_runtime.helpers.SITE_STUDIO_PODMAN_XDG_CONFIG_HOME_CANONICAL",
        "/proc/1/xdg-cannot-create",
    )
    with pytest.raises(SiteStudioRuntimeError, match="XDG_CONFIG_HOME"):
        ensure_podman_xdg_config_home({"XDG_CONFIG_HOME": "/proc/1/also-blocked"})


def test_ensure_podman_xdg_does_not_fall_back_to_tmp(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.site_studio_runtime.helpers.SITE_STUDIO_PODMAN_XDG_CONFIG_HOME_CANONICAL",
        "/proc/1/xdg-cannot-create",
    )
    env = {"XDG_CONFIG_HOME": "/proc/1/also-blocked"}
    with pytest.raises(SiteStudioRuntimeError, match="do not use /tmp") as exc_info:
        ensure_podman_xdg_config_home(env)
    message = str(exc_info.value)
    assert "/tmp/eliteew-xdg-config" not in message
    assert env["XDG_CONFIG_HOME"] == "/proc/1/also-blocked"


def test_ensure_podman_xdg_constants_are_split_from_ssh_home() -> None:
    assert SITE_STUDIO_PODMAN_XDG_CONFIG_HOME_CANONICAL == "/var/lib/eliteew/xdg-config"
    assert not hasattr(site_studio_helpers, "SITE_STUDIO_PODMAN_XDG_CONFIG_HOME_FALLBACK")
    assert os.path.dirname(SITE_STUDIO_PODMAN_XDG_CONFIG_HOME_CANONICAL) != "/home/owned"


def test_prod_baked_thin_layer_creates_writable_xdg_dir() -> None:
    baked = Path(__file__).resolve().parents[3] / "docker" / "builders" / "stack0-api" / "Dockerfile.prod-baked"
    text = baked.read_text(encoding="utf-8")
    stage = text.split("AS site-studio-worker-baked", 1)[1]
    assert "mkdir -p /var/lib/eliteew/xdg-config" in stage
    assert "chown -R 1000:1000 /var/lib/eliteew" in stage
    assert "XDG_CONFIG_HOME=/var/lib/eliteew/xdg-config" in stage
