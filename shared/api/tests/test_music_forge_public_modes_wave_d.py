# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave D locks: public modes catalog, mode_key normalize, create-time validation.
# Invariants:
# - Unknown mode_key fails closed before run insert; explicit mode_key wins markers.
# Related:
# - api/services/music_forge/pipeline_mode.py
# - api/schemas/music_forge.py
# ---

from __future__ import annotations

import pytest

from api.schemas.music_forge import MusicForgeRunCreate
from api.services.music_forge.algorithm.lanes import normalize_music_forge_input
from api.services.music_forge.config.seed import code_default_bundle
from api.services.music_forge.pipeline_mode import (
    public_modes_catalog,
    resolve_create_mode,
    resolve_mode_for_intent,
)


def test_public_modes_catalog_from_code_bundle() -> None:
    bundle = code_default_bundle()
    modes = public_modes_catalog(bundle)
    assert modes
    assert all(m["mode_key"] and m["lane_key"] for m in modes)
    assert any(m["is_default"] for m in modes)


def test_normalize_passes_mode_key() -> None:
    body = MusicForgeRunCreate(idea="Night drive", language="en", mode_key="turbo_xl")
    normalized = normalize_music_forge_input(body)
    assert normalized["mode_key"] == "turbo_xl"


def test_normalize_omits_empty_mode_key() -> None:
    body = MusicForgeRunCreate(idea="Night drive", language="en", mode_key=None)
    normalized = normalize_music_forge_input(body)
    assert "mode_key" not in normalized


def test_resolve_create_mode_rejects_unknown() -> None:
    bundle = code_default_bundle()
    with pytest.raises(ValueError, match="music_forge_mode_key_invalid"):
        resolve_create_mode(bundle, {"idea": "x", "mode_key": "does_not_exist"})


def test_resolve_create_mode_honors_explicit_over_markers() -> None:
    bundle = code_default_bundle()
    turbo = next(m for m in bundle.modes.values() if "turbo" in str(m["mode_key"]))
    mode, stages = resolve_create_mode(
        bundle,
        {
            "idea": "Night drive",
            "language": "en",
            "style_hint": "use base xl",
            "mode_key": turbo["mode_key"],
        },
    )
    assert mode["mode_key"] == turbo["mode_key"]
    assert stages
    # Interpreter path agrees
    mode2, lane2, _ = resolve_mode_for_intent(
        bundle,
        {"idea": "Night drive", "mode_key": turbo["mode_key"], "style_hint": "use base xl"},
        corpus=None,
    )
    assert mode2["mode_key"] == turbo["mode_key"]
    assert str(lane2.get("lane") or lane2.get("lane_key")) == str(turbo["lane_key"])
    assert lane2.get("model_scope") == "xl_turbo"
    assert "temperature" in (lane2.get("sampler") or {})
