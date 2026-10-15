# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral locks for Music Player shell_state music_playlists sanitize
# (favorites-first, camelCase wire, per-playlist / total caps, merge).
# Invariants:
# - No DB; pure sanitizer + DesktopShellStatePatch validator.
# Related:
# - api/routers/desktop_shell_state_sanitize.py
# - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
# ---
"""Desktop shell-state music_playlists sanitize contract."""

from __future__ import annotations

import pytest

from api.routers import desktop_shell_state_sanitize as sanitize_mod
from api.routers.desktop_shell_config import DesktopShellStatePatch, _shell_state_to_out
from api.routers.desktop_shell_state_sanitize import _sanitize_music_playlists_shell

FAV_ID = "eliteew-music-favorites"


def test_sanitize_empty_injects_favorites_first() -> None:
    out = _sanitize_music_playlists_shell([])
    assert len(out) == 1
    assert out[0]["id"] == FAV_ID
    assert out[0]["name"] == "Любимые"
    assert out[0]["track_ids"] == []


def test_sanitize_non_list_injects_favorites() -> None:
    out = _sanitize_music_playlists_shell("not-a-list")
    assert out[0]["id"] == FAV_ID
    assert out[0]["track_ids"] == []


def test_sanitize_forces_favorites_name_and_order() -> None:
    out = _sanitize_music_playlists_shell(
        [
            {"id": "pl-user", "name": "Road", "track_ids": ["a1"]},
            {
                "id": FAV_ID,
                "name": "Favorites rename attempt",
                "track_ids": ["f1", "f1", "  ", "f2"],
            },
        ]
    )
    assert out[0]["id"] == FAV_ID
    assert out[0]["name"] == "Любимые"
    assert out[0]["track_ids"] == ["f1", "f2"]
    assert out[1]["id"] == "pl-user"
    assert out[1]["name"] == "Road"


def test_sanitize_accepts_legacy_camel_case_track_ids() -> None:
    out = _sanitize_music_playlists_shell([{"id": "pl-1", "name": "Mix", "trackIds": ["t1", "t2"]}])
    user = next(p for p in out if p["id"] == "pl-1")
    assert user["track_ids"] == ["t1", "t2"]


def test_sanitize_merges_duplicate_playlist_ids() -> None:
    out = _sanitize_music_playlists_shell(
        [
            {"id": "pl-1", "name": "A", "track_ids": ["t1"]},
            {"id": "pl-1", "name": "B", "track_ids": ["t2", "t1"]},
        ]
    )
    user = next(p for p in out if p["id"] == "pl-1")
    assert user["name"] == "B"
    assert user["track_ids"] == ["t1", "t2"]


def test_sanitize_caps_playlists_and_track_ids(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sanitize_mod, "_MAX_MUSIC_PLAYLISTS", 3)
    monkeypatch.setattr(sanitize_mod, "_MAX_TRACK_IDS_PER_PLAYLIST", 4)
    monkeypatch.setattr(sanitize_mod, "_MAX_TOTAL_TRACK_ID_ENTRIES", 6)

    raw = [
        {"id": FAV_ID, "name": "x", "track_ids": [f"f{i}" for i in range(10)]},
        {"id": "pl-a", "name": "A", "track_ids": [f"a{i}" for i in range(10)]},
        {"id": "pl-b", "name": "B", "track_ids": [f"b{i}" for i in range(10)]},
        {"id": "pl-c", "name": "C", "track_ids": ["c0"]},
    ]
    out = _sanitize_music_playlists_shell(raw)
    # favorites + 2 user playlists (cap 3 total including favorites)
    assert len(out) == 3
    assert out[0]["id"] == FAV_ID
    assert len(out[0]["track_ids"]) == 4
    assert out[1]["id"] == "pl-a"
    assert len(out[1]["track_ids"]) == 2  # total budget 6 → 4 fav + 2 left
    assert out[2]["id"] == "pl-b"
    assert out[2]["track_ids"] == []


def test_patch_validator_runs_sanitize() -> None:
    p = DesktopShellStatePatch.model_validate(
        {
            "music_playlists": [
                {"id": "pl-1", "name": "Mix", "trackIds": ["t1"]},
            ]
        }
    )
    assert p.music_playlists is not None
    assert p.music_playlists[0]["id"] == FAV_ID
    user = next(x for x in p.music_playlists if x["id"] == "pl-1")
    assert user["track_ids"] == ["t1"]


def test_shell_state_to_out_normalizes_music_playlists() -> None:
    out = _shell_state_to_out({"music_playlists": []})
    assert out.music_playlists[0]["id"] == FAV_ID
    assert out.music_playlists[0]["name"] == "Любимые"
