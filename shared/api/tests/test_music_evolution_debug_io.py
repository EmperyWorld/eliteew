# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for Music Evolution debug JSON persistence under generated_files.
# Invariants:
# - Saves are best-effort and must not raise when the debug root is writable.
# Related:
# - api/services/music_evolution_debug_io.py
# ---

from __future__ import annotations

import json

import pytest

from api.services.music_evolution_debug_io import (
    resolve_music_evolution_debug_root,
    save_music_evolution_comfy_prompt,
    save_music_evolution_ugs_payload,
)


@pytest.fixture
def debug_root(tmp_path, monkeypatch):
    monkeypatch.delenv("MUSIC_EVOLUTION_DEBUG_JSON_DISABLE", raising=False)
    monkeypatch.setenv("MUSIC_EVOLUTION_DEBUG_JSON_DIR", str(tmp_path / "music_evolution_debug_json"))
    return tmp_path / "music_evolution_debug_json"


def test_resolve_music_evolution_debug_root_honors_disable(monkeypatch) -> None:
    monkeypatch.setenv("MUSIC_EVOLUTION_DEBUG_JSON_DIR", "/tmp/should-not-use")
    monkeypatch.setenv("MUSIC_EVOLUTION_DEBUG_JSON_DISABLE", "1")
    assert resolve_music_evolution_debug_root() is None


def test_save_music_evolution_ugs_payload_writes_run_scoped_file(debug_root) -> None:
    path = save_music_evolution_ugs_payload(
        run_id="run-abc-123",
        step="audio_generation",
        type_key="music_generator_evolution_xl_base",
        input_data={"lyrics": "[Verse 1]\nTest", "tags": "storm, dnb"},
        user_id="user-1",
    )
    assert path is not None
    assert path.exists()
    assert "ugs_input/run-abc-123/audio_generation" in str(path)
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["eliteew_meta"]["run_id"] == "run-abc-123"
    assert data["ugs_input_data"]["tags"] == "storm, dnb"


def test_save_music_evolution_comfy_prompt_writes_prompt_body(debug_root) -> None:
    workflow = {"94": {"inputs": {"tags": "storm", "lyrics": "test"}}, "109": {"inputs": {"value": 42}}}
    path = save_music_evolution_comfy_prompt(
        run_id="run-xyz",
        workflow=workflow,
        input_data={"music_evolution_run_id": "run-xyz"},
        generation_type="music_generator_evolution_xl_base",
    )
    assert path is not None
    assert path.exists()
    assert "comfy_prompt/run-xyz" in str(path)
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["version"] == "1.0"
    assert data["prompt"]["94"]["inputs"]["tags"] == "storm"
    assert data["eliteew_meta"]["seed_applied"] == 42
    assert data["ugs_input_data"]["music_evolution_run_id"] == "run-xyz"


def test_save_returns_none_when_disabled(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MUSIC_EVOLUTION_DEBUG_JSON_DISABLE", "true")
    monkeypatch.setenv("MUSIC_EVOLUTION_DEBUG_JSON_DIR", str(tmp_path))
    assert (
        save_music_evolution_ugs_payload(
            run_id="r1",
            step="lyrics_generation",
            type_key="music_generator_evolution_lyrics",
            input_data={"messages": []},
        )
        is None
    )
