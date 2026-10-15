# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock: stack0-api dependency tree must not ship chromadb (Great Purge Wave 1).
# Invariants:
# - import chromadb raises ModuleNotFoundError in the stack0-api venv.
# - database_manager loads without attempting a chromadb import.
# Related:
# - docker/builders/stack0-api/requirements/locks/api.lock
# - api/core/database_manager.py
# ---
from __future__ import annotations

import importlib
import importlib.util
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[3]
_API_LOCK_CANDIDATES = (
    _REPO_ROOT / "docker/builders/stack0-api/requirements/locks/api.lock",
    Path("/app/docker/builders/stack0-api/requirements/locks/api.lock"),
)


def test_api_lock_excludes_chroma_transitive_rot() -> None:
    lock_path = next((p for p in _API_LOCK_CANDIDATES if p.is_file()), None)
    if lock_path is None:
        pytest.skip("api.lock not available in this runtime")
    lock_text = lock_path.read_text(encoding="utf-8")
    for banned in ("chromadb==", "pysqlite3-binary==", "kubernetes=="):
        assert banned not in lock_text, f"{banned} must be absent from api.lock"


def test_chromadb_package_not_installed() -> None:
    spec = importlib.util.find_spec("chromadb")
    assert spec is None, "chromadb must be absent from stack0-api venv"


def test_import_chromadb_raises_module_not_found() -> None:
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("chromadb")


def test_database_manager_does_not_soft_import_chromadb() -> None:
    from api.core.database_manager import CHROMADB_AVAILABLE, DatabaseFeatures

    assert DatabaseFeatures.ENABLE_CHROMADB is False
    assert CHROMADB_AVAILABLE is False


def test_get_chromadb_client_raises_removed_error() -> None:
    from api.core.database_manager import DatabaseConnectionError, DatabaseManager

    manager = DatabaseManager()
    with pytest.raises(DatabaseConnectionError, match="removed from stack0-api"):
        manager.get_chromadb_client()
