# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for nested expansion wire models in desktop shell-state OpenAPI surface.
# Invariants:
# - No DB; exercises Pydantic models and _shell_state_to_out coercion only.
# Related:
# - api/routers/desktop_shell_config.py
# ---
"""Desktop shell-state expansion wire schemas."""

from __future__ import annotations

import json

import pytest
from fastapi import HTTPException

from api.routers.desktop_shell_config import (
    MAX_WINDOWS_SNAPSHOT_WINDOWS,
    DesktopShellStateOut,
    DesktopShellStatePatch,
    _raise_if_shell_state_etag_conflict,
    _shell_state_field_etags,
    _shell_state_to_out,
    _weak_etag_for_pydantic_model,
)


def test_shell_state_to_out_coerces_workspace_profiles_wire() -> None:
    raw = {
        "workspace_profiles": {
            "profiles": [
                {
                    "id": "ws-1",
                    "name": "Focus",
                    "appIds": ["app-a"],
                    "folderItemIds": [],
                    "widgetIds": [],
                }
            ]
        }
    }
    out = _shell_state_to_out(raw)
    assert out.workspace_profiles is not None
    assert out.workspace_profiles.profiles[0].name == "Focus"
    assert out.workspace_profiles.profiles[0].appIds == ["app-a"]


def test_shell_state_to_out_skips_invalid_workspace_profiles() -> None:
    out = _shell_state_to_out({"workspace_profiles": "bad"})
    assert out.workspace_profiles is None


def test_patch_model_accepts_nested_workspace_profiles() -> None:
    patch = DesktopShellStatePatch(
        workspace_profiles={
            "profiles": [
                {
                    "id": "ws-2",
                    "name": "Dev",
                    "appIds": [],
                    "folderItemIds": [],
                    "widgetIds": [],
                }
            ]
        }
    )
    dumped = patch.model_dump(exclude_unset=True)
    assert dumped["workspace_profiles"]["profiles"][0]["id"] == "ws-2"


def test_shell_state_if_match_conflict_returns_precondition_failed() -> None:
    current_etag = _weak_etag_for_pydantic_model(_shell_state_to_out({"recent_app_ids": ["app-a"]}))

    _raise_if_shell_state_etag_conflict(current_etag, current_etag)
    with pytest.raises(HTTPException) as exc_info:
        _raise_if_shell_state_etag_conflict('"stale"', current_etag)

    assert exc_info.value.status_code == 412
    assert isinstance(exc_info.value.detail, dict)
    assert exc_info.value.detail["code"] == "desktop_shell_state_conflict"


def test_shell_state_stale_resource_etag_allows_unchanged_patch_fields() -> None:
    base = _shell_state_to_out({"windows_snapshot": {"windows": []}, "quiet_mode": False})
    current = _shell_state_to_out({"windows_snapshot": {"windows": []}, "quiet_mode": True})
    base_fields = _shell_state_field_etags(base)
    current_fields = _shell_state_field_etags(current)
    stale_resource_etag = _weak_etag_for_pydantic_model(base)
    current_resource_etag = _weak_etag_for_pydantic_model(current)

    assert stale_resource_etag != current_resource_etag
    assert base_fields["windows_snapshot"] == current_fields["windows_snapshot"]
    assert base_fields["quiet_mode"] != current_fields["quiet_mode"]

    _raise_if_shell_state_etag_conflict(
        stale_resource_etag,
        current_resource_etag,
        current_field_etags=current_fields,
        patch_keys={"windows_snapshot"},
        if_match_fields=json.dumps({"windows_snapshot": base_fields["windows_snapshot"]}),
    )


def test_shell_state_stale_resource_etag_rejects_changed_patch_fields() -> None:
    base = _shell_state_to_out({"windows_snapshot": {"windows": []}, "quiet_mode": False})
    current = _shell_state_to_out(
        {
            "windows_snapshot": {
                "windows": [
                    {
                        "type": "app",
                        "title": "A",
                        "position": {"x": 1, "y": 2},
                        "size": {"width": 320, "height": 240},
                    }
                ]
            },
            "quiet_mode": False,
        }
    )
    base_fields = _shell_state_field_etags(base)
    current_fields = _shell_state_field_etags(current)

    with pytest.raises(HTTPException) as exc_info:
        _raise_if_shell_state_etag_conflict(
            _weak_etag_for_pydantic_model(base),
            _weak_etag_for_pydantic_model(current),
            current_field_etags=current_fields,
            patch_keys={"windows_snapshot"},
            if_match_fields=json.dumps({"windows_snapshot": base_fields["windows_snapshot"]}),
        )

    assert exc_info.value.status_code == 412
    assert isinstance(exc_info.value.detail, dict)
    assert "current_field_etags" in exc_info.value.detail


def test_openapi_json_schema_exposes_nested_workspace_profiles() -> None:
    schema = DesktopShellStateOut.model_json_schema()
    props = schema.get("properties", {})
    wp = props.get("workspace_profiles")
    assert wp is not None
    ref = wp.get("$ref") or wp.get("anyOf", [{}])[0].get("$ref")
    assert ref is not None
    assert "DesktopWorkspaceProfilesWire" in ref


def test_patch_model_sanitizes_windows_snapshot() -> None:
    patch = DesktopShellStatePatch(
        windows_snapshot={
            "activeDesktopId": " desktop-1 ",
            "windows": [
                {
                    "type": "app",
                    "title": "UGS",
                    "appComponent": "UGS",
                    "position": {"x": 10, "y": 20},
                    "size": {"width": 800, "height": 600},
                    "zIndex": 42,
                    "initialPayload": {
                        "ugsView": "hub",
                        "nested": {"not": "stored"},
                    },
                },
                {
                    "type": "app",
                    "title": "bad",
                    "position": {"x": 0},
                    "size": {"width": 800, "height": 600},
                },
            ],
        }
    )

    payload = patch.model_dump(exclude_unset=True)["windows_snapshot"]
    assert payload["activeDesktopId"] == "desktop-1"
    assert len(payload["windows"]) == 1
    row = payload["windows"][0]
    assert row["zIndex"] == 42
    assert row["initialPayload"] == {"ugsView": "hub"}


def test_shell_state_to_out_caps_windows_snapshot() -> None:
    raw_window = {
        "type": "folder",
        "title": "Folder",
        "folderId": "folder-1",
        "position": {"x": 1, "y": 2},
        "size": {"width": 300, "height": 240},
    }

    out = _shell_state_to_out({"windows_snapshot": {"windows": [raw_window] * 80}})

    assert out.windows_snapshot is not None
    assert len(out.windows_snapshot["windows"]) == MAX_WINDOWS_SNAPSHOT_WINDOWS


def test_shell_state_to_out_coerces_music_playback_with_legacy_queue_ids() -> None:
    out = _shell_state_to_out(
        {
            "music_playback": {
                "playbackRate": 1.75,
                "shuffle": True,
                "repeat_mode": "all",
                "queue_track_ids": ["track-1", "track-2", "track-1"],
            }
        }
    )
    assert out.music_playback is not None
    assert out.music_playback["playback_rate"] == 1.75
    assert out.music_playback["shuffle"] is True
    assert out.music_playback["repeat"] == "all"
    assert [row["id"] for row in out.music_playback["queue"]] == [
        "track-1",
        "track-2",
    ]


def test_patch_model_sanitizes_music_playback_queue_rows() -> None:
    patch = DesktopShellStatePatch(
        music_playback={
            "playback_rate": 9,
            "repeat": "one",
            "queue": [
                {"id": "track-1", "name": "Track 1", "thumbnail_url": "https://x/y"},
                {"content_id": "track-2", "track_name": "Track 2"},
            ],
        }
    )
    dumped = patch.model_dump(exclude_unset=True)
    payload = dumped["music_playback"]
    assert payload["playback_rate"] == 2.0
    assert payload["repeat"] == "one"
    assert payload["queue"][0]["id"] == "track-1"
    assert payload["queue"][1]["id"] == "track-2"
