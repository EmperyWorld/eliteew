# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Guard for MusicForge live random-song script: refuse without gate; keep random pools non-empty.
# Invariants:
# - Live render never runs unless MUSIC_FORGE_LIVE=1.
# Related:
# - api/scripts/music_forge_live_random_song.py
# ---

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

_SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "music_forge_live_random_song.py"


def _load_script_module():
    spec = importlib.util.spec_from_file_location("music_forge_live_random_song", _SCRIPT)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_live_random_song_script_refuses_without_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    mod = _load_script_module()
    monkeypatch.delenv("MUSIC_FORGE_LIVE", raising=False)
    monkeypatch.setattr("sys.argv", ["music_forge_live_random_song.py"])

    async def _go():
        return await mod._run(mod._parse_args())

    import asyncio

    assert asyncio.run(_go()) == 2


def test_live_random_song_pools_non_empty() -> None:
    mod = _load_script_module()
    assert len(mod._RANDOM_THEMES_RU) >= 5
    assert len(mod._RANDOM_STYLES) >= 5
