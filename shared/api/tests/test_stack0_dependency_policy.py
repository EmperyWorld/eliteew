# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock: single source of truth for stack0 backend dependencies (Wave P0).
# Invariants:
# - Prod installs from docker/builders/stack0-api requirements + locks only.
# - constraints.txt has no orphan ML caps; base.in has no dead marshmallow/cerberus pins.
# - Host shared/api/requirements.txt re-exports api.in (no torch/spacy drift).
# Related:
# - docker/builders/stack0-api/scripts/recompile-locks.sh
# - scripts/eliteew/sync-host-api-venv.sh
# - documentation/platform/docker-re_doc/STACK0-BACKEND-IMAGES.md
# ---
from __future__ import annotations

import re
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[3]
_STACK0 = _REPO_ROOT / "docker/builders/stack0-api"
_START_ALL = _STACK0 / "scripts/start_all.sh"
_START_ALL_SELFTEST = _STACK0 / "scripts/start_all_selftest.sh"
_LIB_DIR = _STACK0 / "scripts/lib"
_COMPOSE = _REPO_ROOT / "docker/stack/stack0_b.yml"
_CONSTRAINTS = _STACK0 / "constraints.txt"
_BASE_IN = _STACK0 / "requirements/base.in"
_HOST_REQ = _REPO_ROOT / "shared/api/requirements.txt"
_DOCKERFILE = _STACK0 / "Dockerfile"
_LOCKS_DIR = _STACK0 / "requirements/locks"

_FORBIDDEN_HOST_PINS = (
    "torch",
    "torchvision",
    "torchaudio",
    "transformers",
    "sentence-transformers",
    "spacy",
    "opencv-python",
)


@pytest.mark.unit
def test_constraints_has_no_orphan_ml_caps() -> None:
    text = _CONSTRAINTS.read_text(encoding="utf-8")
    for orphan in ("huggingface-hub", "sentence-transformers", "spacy"):
        assert orphan not in text, f"orphan ML cap still in constraints.txt: {orphan}"


@pytest.mark.unit
def test_base_in_has_no_dead_validation_pins() -> None:
    text = _BASE_IN.read_text(encoding="utf-8").lower()
    assert "marshmallow" not in text
    assert "cerberus" not in text


@pytest.mark.unit
def test_host_requirements_reexports_stack0_api_in() -> None:
    text = _HOST_REQ.read_text(encoding="utf-8")
    assert "../../docker/builders/stack0-api/requirements/api.in" in text
    requirement_lines = [
        line.strip().lower() for line in text.splitlines() if line.strip() and not line.strip().startswith("#")
    ]
    joined = "\n".join(requirement_lines)
    for forbidden in _FORBIDDEN_HOST_PINS:
        assert forbidden not in joined, f"legacy host pin must not return: {forbidden}"


@pytest.mark.unit
def test_stack0_lock_gate_targets_only_install_locks() -> None:
    gate = (_REPO_ROOT / "docker/scripts/stack0-backend-lock-integrity.sh").read_text(encoding="utf-8")
    assert "celery-worker.lock" not in gate
    assert "celery-beat.lock" not in gate
    assert "site-studio-worker.lock" in gate


@pytest.mark.unit
def test_dockerfile_has_no_dead_celery_beat_deps_stage() -> None:
    dockerfile = _DOCKERFILE.read_text(encoding="utf-8")
    assert "deps-celery-beat" not in dockerfile
    assert "COPY --from=deps-api /opt/venv /opt/venv" in dockerfile


@pytest.mark.unit
def test_required_lock_files_exist() -> None:
    for name in ("api.lock", "queue-worker.lock", "site-studio-worker.lock"):
        path = _LOCKS_DIR / name
        assert path.is_file(), f"missing required lock: {path}"


@pytest.mark.unit
def test_api_lock_has_no_marshmallow_or_cerberus() -> None:
    lock_text = (_LOCKS_DIR / "api.lock").read_text(encoding="utf-8").lower()
    assert "marshmallow" not in lock_text
    assert "cerberus" not in lock_text
    match = re.search(r"^fastapi==(\S+)", lock_text, re.MULTILINE)
    assert match is not None


@pytest.mark.unit
def test_api_lock_httptools_has_py314_compatible_floor() -> None:
    """httptools 0.6.x has no cp314 wheels — host sync would compile and need Python.h."""
    base = _BASE_IN.read_text(encoding="utf-8")
    lock_text = (_LOCKS_DIR / "api.lock").read_text(encoding="utf-8")
    assert "httptools>=0.8.0" in base or "httptools>=0.8" in base
    match = re.search(r"^httptools==(\S+)", lock_text, re.MULTILINE)
    assert match is not None
    major, minor, *_ = (int(p) for p in match.group(1).split("."))
    assert (major, minor) >= (0, 8), f"httptools too old for py314 wheels: {match.group(1)}"


@pytest.mark.unit
def test_start_all_wave1_preflight_contract() -> None:
    """Wave 1: shell Site Studio poll removed; fail-closed imports + STACK0_PREFLIGHT_FAIL_ON."""
    script = _START_ALL.read_text(encoding="utf-8")
    preflight_lib = (_LIB_DIR / "stack0_preflight_lib.py").read_text(encoding="utf-8")
    assert "stack0_site_studio_startup_preflight" not in script
    assert "asyncpg.connect" not in script
    assert "stack0_preflight.py" in script
    assert "STACK0_PREFLIGHT_FAIL_ON" in preflight_lib
    assert "Import checklist fail-closed" not in script
    assert "wait_for_site_studio_worker_ready_at_startup" in preflight_lib

    compose = _COMPOSE.read_text(encoding="utf-8")
    assert "STACK0_PREFLIGHT_FAIL_ON=${STACK0_PREFLIGHT_FAIL_ON:-postgres,redis,ewa_postgres}" in compose


@pytest.mark.unit
def test_start_all_wave2_cleanup_contract() -> None:
    """Wave 2: optional legacy ML cache, single-pass TCP, lib helpers extracted."""
    script = _START_ALL.read_text(encoding="utf-8")
    dockerfile = _DOCKERFILE.read_text(encoding="utf-8")
    compose = _COMPOSE.read_text(encoding="utf-8")

    assert "STACK0_ENABLE_LEGACY_ML_CACHE_DIRS" in script
    assert "STACK0_ONNX_HOME:?STACK0_ONNX_HOME is required" not in script.split("STACK0_ENABLE_LEGACY_ML_CACHE_DIRS")[0]
    assert "Финальная проверка зависимостей" not in script
    assert "peek_tcp()" not in script
    assert "STACK0_PREFLIGHT_PY" in script
    assert "REDIS_FLUSHALL_ON_START_PY" in script
    assert "/dev/tcp" not in script
    assert "asyncpg.connect" not in script

    assert (_LIB_DIR / "parse_ewa_database_url.py").is_file()
    assert (_LIB_DIR / "redis_flushall_on_start.py").is_file()
    assert (_LIB_DIR / "stack0_preflight.py").is_file()
    assert (_LIB_DIR / "stack0_preflight_lib.py").is_file()
    assert _START_ALL_SELFTEST.is_file()

    assert "COPY scripts/lib/" in dockerfile
    assert "scripts/lib:/app/docker/scripts/lib" in compose
    assert "STACK0_ENABLE_LEGACY_ML_CACHE_DIRS=${STACK0_ENABLE_LEGACY_ML_CACHE_DIRS:-0}" in compose
    assert "STACK0_PREFLIGHT_VERBOSE=${STACK0_PREFLIGHT_VERBOSE:-0}" in compose
