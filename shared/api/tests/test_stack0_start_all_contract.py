# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock for start_all.sh entrypoint contracts (Wave 3).
# Invariants:
# - Required :? env keys stay fail-closed; := defaults are an explicit allowlist.
# - Site Studio startup env names stay aligned with site_studio_lifecycle_jobs.py.
# - Shell must not reintroduce asyncpg Site Studio poll or deps-celery-beat.
# Related:
# - docker/builders/stack0-api/scripts/start_all.sh
# - docker/builders/stack0-api/scripts/start_all_selftest.sh
# - documentation/platform/docker-re_doc/STACK0-API-STARTUP.md
# ---
from __future__ import annotations

import re
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[3]
_STACK0 = _REPO_ROOT / "docker/builders/stack0-api"
_START_ALL = _STACK0 / "scripts/start_all.sh"
_SELFTEST = _STACK0 / "scripts/start_all_selftest.sh"
_LIB_DIR = _STACK0 / "scripts/lib"
_DOCKERFILE = _STACK0 / "Dockerfile"
_COMPOSE = _REPO_ROOT / "docker/stack/stack0_b.yml"
_LIFECYCLE = _REPO_ROOT / "shared/api/services/site_studio_lifecycle_jobs.py"
_STARTUP_DOC = _REPO_ROOT / "documentation/platform/docker-re_doc/STACK0-API-STARTUP.md"

# Fail-closed keys required before uvicorn (must appear as ${VAR:?…} or : "${VAR:?…}").
_REQUIRED_ENV_KEYS = (
    "STACK0_RUNTIME_HOME",
    "STACK0_CACHE_DIR",
    "STACK0_PYTHON_VENV",
    "STACK0_UVICORN_TIMEOUT_KEEP_ALIVE",
    "STACK0_UVICORN_TIMEOUT_GRACEFUL_SHUTDOWN",
    "STACK0_REMOVE_PYC_ON_START",
    "STACK0_REDIS_FLUSHALL_ON_START",
    "GENERATED_FILES_BASE",
    "API_HOST",
    "API_PORT",
    "API_WORKERS",
    "LOG_LEVEL",
)

# Preflight-only keys validated in stack0_preflight_lib.py (not shell :?).
_PREFLIGHT_ENV_KEYS = (
    "STACK0_PACKAGE_IMPORT_CHECKLIST",
    "STACK0_TCP_PROBE_TIMEOUT_SEC",
    "STACK0_REDIS_FORBIDDEN_HOSTS",
    "STACK0_LL_HTTP_HEALTH_SUFFIX",
    "STACK0_TIKA_HTTP_HEALTH_SUFFIX",
    "STACK0_FFMPEG_BIN",
    "STACK0_PREFLIGHT_FAIL_ON",
)

# Explicit := allowlist in start_all.sh (documented in STACK0-API-STARTUP.md).
_ALLOWED_DEFAULT_ASSIGNS = {
    "STACK0_ENABLE_LEGACY_ML_CACHE_DIRS:=0",
    "STACK0_PREFLIGHT_VERBOSE:=0",
}

# Env names owned by site_studio_lifecycle_jobs.py (must stay in compose eliteew-api-prod).
_SITE_STUDIO_ENV_NAMES = (
    "ELITEEW_REQUIRE_SITE_STUDIO_WORKER_AT_STARTUP",
    "ENABLE_QUEUE_SITE_STUDIO",
    "ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK",
    "STACK0_SITE_STUDIO_STARTUP_WAIT_SECONDS",
    "STACK0_SITE_STUDIO_STARTUP_POLL_SECONDS",
    "SITE_STUDIO_WORKER_READY_WINDOW_SECONDS",
)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


@pytest.mark.unit
def test_start_all_required_env_keys_are_fail_closed() -> None:
    script = _read(_START_ALL)
    for key in _REQUIRED_ENV_KEYS:
        needle = f"{key}:?"
        assert needle in script, f"missing fail-closed env gate for {key}"


@pytest.mark.unit
def test_start_all_default_assigns_are_explicit_allowlist() -> None:
    script = _read(_START_ALL)
    assign_lines = {line.strip() for line in script.splitlines() if re.search(r': "\$\{[A-Z0-9_]+:=', line)}
    assert len(assign_lines) == len(_ALLOWED_DEFAULT_ASSIGNS), f"unexpected := count: {sorted(assign_lines)}"
    for expected in _ALLOWED_DEFAULT_ASSIGNS:
        assert any(expected in line for line in assign_lines), f"missing default assign {expected}"
    # PYTHONPYCACHEPREFIX may use :- in a conditional branch — not a top-level : "${…:=…}" assign.
    assert "PYTHONPYCACHEPREFIX:=" not in script


@pytest.mark.unit
def test_site_studio_env_names_aligned_across_lifecycle_compose_doc() -> None:
    lifecycle = _read(_LIFECYCLE)
    compose = _read(_COMPOSE)
    doc = _read(_STARTUP_DOC)

    for name in _SITE_STUDIO_ENV_NAMES:
        assert name in lifecycle, f"lifecycle module missing env constant usage: {name}"
        assert name in compose, f"stack0_b.yml eliteew-api-prod missing env: {name}"
        assert name in doc, f"STACK0-API-STARTUP.md missing env: {name}"

    # Shell must not own Site Studio wait/poll — those are lifespan-only after Wave 1.
    script = _read(_START_ALL)
    preflight_lib = _read(_LIB_DIR / "stack0_preflight_lib.py")
    assert "STACK0_SITE_STUDIO_STARTUP_WAIT_SECONDS" not in script
    assert "stack0_site_studio_startup_preflight" not in script
    assert "asyncpg.connect" not in script
    assert "wait_for_site_studio_worker_ready_at_startup" in preflight_lib


@pytest.mark.unit
def test_dockerfile_and_start_all_have_no_retired_patterns() -> None:
    dockerfile = _read(_DOCKERFILE)
    script = _read(_START_ALL)

    assert "deps-celery-beat" not in dockerfile
    assert "COPY scripts/lib/" in dockerfile
    assert "scripts/lib:/app/docker/scripts/lib" in _read(_COMPOSE)

    assert "peek_tcp()" not in script
    assert "Финальная проверка зависимостей" not in script
    assert "stack0_preflight.py" in script
    assert "STACK0_PREFLIGHT_PY" in script
    assert "STACK0_ENABLE_LEGACY_ML_CACHE_DIRS" in script
    assert '--workers "${WORKERS}"' in script
    assert "Socket.IO ASGIApp requires single worker" in script
    assert "ПРЕДЗАГРУЗКА МОДЕЛЕЙ" not in script
    assert "Встроенные redis-server" not in script
    # Preflight moved to Python — shell must not reintroduce probes.
    assert "/dev/tcp" not in script
    assert re.search(r"\bcurl[\s-]", script) is None
    assert "Import checklist fail-closed" not in script
    assert "redis_host_matches_forbidden_csv" not in script


@pytest.mark.unit
def test_preflight_module_present_and_env_keys_documented() -> None:
    preflight_lib = _LIB_DIR / "stack0_preflight_lib.py"
    preflight_cli = _LIB_DIR / "stack0_preflight.py"
    assert preflight_lib.is_file()
    assert preflight_cli.is_file()
    lib_src = _read(preflight_lib)
    for key in _PREFLIGHT_ENV_KEYS:
        assert key in lib_src, f"preflight lib should reference {key}"


@pytest.mark.unit
def test_start_all_lib_and_selftest_present() -> None:
    assert (_LIB_DIR / "parse_ewa_database_url.py").is_file()
    assert (_LIB_DIR / "redis_flushall_on_start.py").is_file()
    assert (_LIB_DIR / "stack0_preflight.py").is_file()
    assert _SELFTEST.is_file()
    selftest = _read(_SELFTEST)
    assert "STACK0_ENABLE_LEGACY_ML_CACHE_DIRS" in selftest
    assert "stack0_site_studio_startup_preflight" in selftest
    assert "Финальная проверка зависимостей" in selftest
    assert "stack0_preflight.py" in selftest
    assert "/dev/tcp" in selftest


@pytest.mark.unit
def test_compose_preflight_profile_service_is_operator_oneshot() -> None:
    compose = _read(_COMPOSE)
    baked = _read(_REPO_ROOT / "docker/stack/stack0_b.prod-baked.override.yml")
    helper = _REPO_ROOT / "docker/scripts/stack0-api-preflight-run.sh"
    doc = _read(_STARTUP_DOC)

    assert "eliteew-api-preflight:" in compose
    assert 'profiles: ["stack0-api-preflight"]' in compose
    assert 'restart: "no"' in compose
    assert "stack0_preflight.py" in compose
    # Authoritative gate stays in start_all; no compose depends_on hang trap.
    assert "condition: service_completed_successfully" not in compose
    api_block = compose.split("eliteew-api-prod:")[1].split("eliteew-api-preflight:")[0]
    assert "depends_on:" not in api_block
    assert "eliteew-api-preflight:" in baked
    api_baked_block = baked.split("eliteew-api-prod:")[1].split("eliteew-api-preflight:")[0]
    assert "scripts/start_all.sh:/app/docker/scripts/start_all.sh" in api_baked_block
    assert "scripts/lib:/app/docker/scripts/lib" in api_baked_block
    assert helper.is_file()
    assert "stack0-api-preflight" in doc
    assert "podman-compose 1.5" in doc


@pytest.mark.unit
def test_startup_doc_lists_default_assign_exceptions() -> None:
    doc = _read(_STARTUP_DOC)
    assert "STACK0_PREFLIGHT_FAIL_ON" in doc
    assert "STACK0_ENABLE_LEGACY_ML_CACHE_DIRS" in doc
    assert "STACK0_PREFLIGHT_VERBOSE" in doc
    assert "stack0_preflight" in doc.lower()
    flattened = doc.lower().replace("`", "")
    assert "postgres,redis,ewa_postgres" in flattened
    assert "workers 1" in flattened or "workers=1" in flattened or "--workers 1" in flattened
