# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Layer E guards for music_generator_generate child router (Phase C.4 wave 3+4):
# URL path stability, no parent import cycle, parent mount/re-export chain,
# support module must not import the generate router.
# Invariants:
# - Child must not import api.routers.music_generator.
# - Support must not import music_generator_generate (no cycle).
# - Public paths stay /generate and /edit on the child router (parent adds prefix).
# Related:
# - api/routers/music_generator_generate.py
# - api/routers/music_generator_generate_support.py
# - api/routers/music_generator.py
# - documentation/platform/ATOMIC-ROUTER-DECOMPOSITION-CANON.md
# ---
"""Structural contract tests for music generate/edit router extraction."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi.routing import APIRoute


def test_generate_module_does_not_import_parent_router() -> None:
    parent = "api.routers.music_generator"
    parent_was = parent in sys.modules
    import api.routers.music_generator_generate as generate_mod  # noqa: PLC0415

    assert generate_mod is not None
    assert generate_mod.__file__ is not None
    src = Path(generate_mod.__file__).read_text(encoding="utf-8")
    assert "from api.routers.music_generator import" not in src
    assert "import api.routers.music_generator\n" not in src
    if not parent_was:
        # Importing the child alone must not load the parent.
        assert parent not in sys.modules


def test_support_module_does_not_import_generate_router() -> None:
    generate_mod_name = "api.routers.music_generator_generate"
    was_loaded = generate_mod_name in sys.modules
    import api.routers.music_generator_generate_support as support_mod  # noqa: PLC0415

    assert support_mod.__file__ is not None
    src = Path(support_mod.__file__).read_text(encoding="utf-8")
    assert "from api.routers.music_generator_generate import" not in src
    assert "import api.routers.music_generator_generate\n" not in src
    assert "from api.routers.music_generator import" not in src
    if not was_loaded:
        assert generate_mod_name not in sys.modules


def test_generate_edit_route_paths_stable_on_child() -> None:
    from api.routers.music_generator_generate import router as generate_router  # noqa: PLC0415

    paths = {
        (route.path, tuple(sorted(route.methods or [])))
        for route in generate_router.routes
        if isinstance(route, APIRoute)
    }
    assert ("/generate", ("POST",)) in paths
    assert ("/edit", ("POST",)) in paths
    # Child must not carry the parent prefix (would double-prefix on mount).
    assert getattr(generate_router, "prefix", "") in ("", None)


def test_parent_mounts_generate_child_and_reexports_handlers() -> None:
    from api.routers import music_generator as parent  # noqa: PLC0415
    from api.routers import music_generator_generate as child  # noqa: PLC0415

    assert parent.router.prefix == "/music-generator"
    assert parent.generate_music is child.generate_music
    assert parent.edit_music is child.edit_music

    mounted_paths = {
        (getattr(r, "path", None), tuple(sorted(getattr(r, "methods", None) or []))) for r in parent.router.routes
    }
    assert ("/music-generator/generate", ("POST",)) in mounted_paths
    assert ("/music-generator/edit", ("POST",)) in mounted_paths
