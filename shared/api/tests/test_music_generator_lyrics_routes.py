# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Layer E guards for music_generator_lyrics_routes child router (Phase C.4 wave 5):
# URL path stability, no parent import cycle, parent mount/re-export chain.
# Invariants:
# - Child must not import api.routers.music_generator.
# - Public paths stay /lyrics and /improve-lyrics on the child router (parent adds prefix).
# Related:
# - api/routers/music_generator_lyrics_routes.py
# - api/routers/music_generator.py
# - documentation/platform/ATOMIC-ROUTER-DECOMPOSITION-CANON.md
# ---
"""Structural contract tests for music lyrics/improve-lyrics router extraction."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi.routing import APIRoute


def test_lyrics_routes_module_does_not_import_parent_router() -> None:
    parent = "api.routers.music_generator"
    parent_was = parent in sys.modules
    import api.routers.music_generator_lyrics_routes as lyrics_mod  # noqa: PLC0415

    assert lyrics_mod is not None
    assert lyrics_mod.__file__ is not None
    src = Path(lyrics_mod.__file__).read_text(encoding="utf-8")
    assert "from api.routers.music_generator import" not in src
    assert "import api.routers.music_generator\n" not in src
    if not parent_was:
        # Importing the child alone must not load the parent.
        assert parent not in sys.modules


def test_lyrics_improve_route_paths_stable_on_child() -> None:
    from api.routers.music_generator_lyrics_routes import router as lyrics_router  # noqa: PLC0415

    paths = {
        (route.path, tuple(sorted(route.methods or [])))
        for route in lyrics_router.routes
        if isinstance(route, APIRoute)
    }
    assert ("/lyrics", ("POST",)) in paths
    assert ("/improve-lyrics", ("POST",)) in paths
    # Child must not carry the parent prefix (would double-prefix on mount).
    assert getattr(lyrics_router, "prefix", "") in ("", None)


def test_parent_mounts_lyrics_child_and_reexports_handlers() -> None:
    from api.routers import music_generator as parent  # noqa: PLC0415
    from api.routers import music_generator_lyrics_routes as child  # noqa: PLC0415

    assert parent.router.prefix == "/music-generator"
    assert parent.generate_lyrics is child.generate_lyrics
    assert parent.improve_lyrics is child.improve_lyrics

    mounted_paths = {
        (getattr(r, "path", None), tuple(sorted(getattr(r, "methods", None) or []))) for r in parent.router.routes
    }
    assert ("/music-generator/lyrics", ("POST",)) in mounted_paths
    assert ("/music-generator/improve-lyrics", ("POST",)) in mounted_paths
