# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock: Wave 2 Task 0.S zombie deps must be absent from stack0-api lock tree.
# Invariants:
# - api.lock excludes passlib, python-keycloak, telethon, pypdfium2, requests (+ telethon transitives).
# - import of removed packages raises ModuleNotFoundError in stack0-api venv.
# Related:
# - docker/builders/stack0-api/requirements/locks/api.lock
# - documentation/worklog/WAVE1-EXHAUSTIVE-DEPENDENCY-AUDIT-2026-07-04.md
# ---
from __future__ import annotations

import importlib
import importlib.util
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[3]
_API_LOCK = _REPO_ROOT / "docker/builders/stack0-api/requirements/locks/api.lock"

_ZOMBIE_LOCK_PREFIXES = (
    "passlib==",
    "python-keycloak==",
    "telethon==",
    "pypdfium2==",
    "requests==",
    "requests-toolbelt==",
    "pyaes==",
)

_ZOMBIE_IMPORT_MODULES = (
    "passlib",
    "keycloak",
    "telethon",
    "pypdfium2",
    "requests",
)


def test_api_lock_excludes_wave2_zombie_packages() -> None:
    if not _API_LOCK.is_file():
        pytest.skip(f"api.lock not mounted in this runtime ({_API_LOCK})")
    lock_text = _API_LOCK.read_text(encoding="utf-8")
    for banned in _ZOMBIE_LOCK_PREFIXES:
        assert banned not in lock_text, f"{banned} must be absent from api.lock"


@pytest.mark.parametrize("module_name", _ZOMBIE_IMPORT_MODULES)
def test_zombie_package_not_installed(module_name: str) -> None:
    spec = importlib.util.find_spec(module_name)
    assert spec is None, f"{module_name} must be absent from stack0-api venv"


@pytest.mark.parametrize("module_name", _ZOMBIE_IMPORT_MODULES)
def test_import_zombie_raises_module_not_found(module_name: str) -> None:
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module(module_name)
