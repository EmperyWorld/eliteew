# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared fixtures for AIS architecture tests.
# Invariants:
# - Read-only load of canonical socketio_handler.py source.
# Related:
# - tests/architecture/
# ---

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def socketio_handler_path() -> Path:
    return Path(__file__).resolve().parents[2] / "routers" / "socketio_handler.py"


@pytest.fixture(scope="session")
def socketio_handler_source(socketio_handler_path: Path) -> str:
    return socketio_handler_path.read_text(encoding="utf-8")
