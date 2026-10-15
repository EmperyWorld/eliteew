# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for virtual_desktops sanitization against windows_snapshot ids.
# Invariants:
# - No DB; exercises sanitize helpers and _shell_state_to_out only.
# Related:
# - api/routers/desktop_shell_state_sanitize.py
# ---
"""Desktop shell-state virtual_desktops sanitizer."""

from __future__ import annotations

from api.routers.desktop_shell_config import (
    DesktopShellStatePatch,
    _shell_state_to_out,
)
from api.routers.desktop_shell_state_sanitize import _sanitize_virtual_desktops


def test_sanitize_virtual_desktops_prunes_orphans_against_snapshot_ids() -> None:
    ws = {
        "windows": [
            {
                "id": "w-live-1",
                "type": "app",
                "title": "A",
                "position": {"x": 0, "y": 0},
                "size": {"width": 400, "height": 300},
                "path": [],
                "isMinimized": False,
                "isMaximized": False,
                "zIndex": 1,
            }
        ]
    }
    raw_vd = {
        "activeDesktopId": "desktop-1",
        "desktops": [
            {
                "id": "desktop-1",
                "name": "Main",
                "isActive": True,
                "windows": ["w-live-1", "w-dead-orphan", "w-dead-orphan"],
            }
        ],
    }
    out = _sanitize_virtual_desktops(raw_vd, ws)
    assert out is not None
    assert out["desktops"][0]["windows"] == ["w-live-1"]


def test_sanitize_virtual_desktops_keeps_membership_when_snapshot_has_no_ids() -> None:
    ws = {
        "windows": [
            {
                "type": "app",
                "title": "Legacy",
                "position": {"x": 0, "y": 0},
                "size": {"width": 400, "height": 300},
                "path": [],
                "isMinimized": False,
                "isMaximized": False,
                "zIndex": 1,
            }
        ]
    }
    raw_vd = {
        "activeDesktopId": "desktop-1",
        "desktops": [
            {
                "id": "desktop-1",
                "name": "Main",
                "isActive": True,
                "windows": ["w-legacy-a", "w-legacy-b"],
            }
        ],
    }
    out = _sanitize_virtual_desktops(raw_vd, ws)
    assert out is not None
    assert out["desktops"][0]["windows"] == ["w-legacy-a", "w-legacy-b"]


def test_shell_state_to_out_sanitizes_virtual_desktops_with_snapshot() -> None:
    raw = {
        "windows_snapshot": {
            "windows": [
                {
                    "id": "w-keep",
                    "type": "app",
                    "title": "Keep",
                    "position": {"x": 1, "y": 2},
                    "size": {"width": 640, "height": 480},
                    "path": ["Keep"],
                    "isMinimized": False,
                    "isMaximized": False,
                    "zIndex": 2,
                }
            ]
        },
        "virtual_desktops": {
            "activeDesktopId": "desktop-1",
            "desktops": [
                {
                    "id": "desktop-1",
                    "name": "Main",
                    "isActive": True,
                    "windows": ["w-keep", "w-drop"],
                }
            ],
        },
    }
    out = _shell_state_to_out(raw)
    assert out.virtual_desktops is not None
    assert out.virtual_desktops["desktops"][0]["windows"] == ["w-keep"]


def test_patch_model_sanitizes_virtual_desktops_structure() -> None:
    patch = DesktopShellStatePatch(
        virtual_desktops={
            "activeDesktopId": "desktop-1",
            "desktops": [
                {
                    "id": "desktop-1",
                    "name": "Main",
                    "isActive": True,
                    "windows": ["w-a", "", 42, "w-a"],
                }
            ],
        }
    )
    dumped = patch.model_dump(exclude_unset=True)
    assert dumped["virtual_desktops"]["desktops"][0]["windows"] == ["w-a"]
