# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for stack0_preflight_lib.py (imports, fail-on matrix, guards).
# Invariants:
# - No network in default unit tests (TCP/HTTP mocked).
# Related:
# - docker/builders/stack0-api/scripts/lib/stack0_preflight_lib.py
# - docker/builders/stack0-api/scripts/start_all.sh
# ---
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[3]
_LIB_DIR = _REPO_ROOT / "docker/builders/stack0-api/scripts/lib"


def _load_preflight_lib():
    spec = importlib.util.spec_from_file_location(
        "stack0_preflight_lib",
        _LIB_DIR / "stack0_preflight_lib.py",
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    assert spec.name
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def pf():
    return _load_preflight_lib()


@pytest.mark.unit
def test_parse_fail_on_keys_normalizes_csv(pf) -> None:
    assert pf.parse_fail_on_keys(" postgres, Redis ,ewa_postgres ") == {
        "postgres",
        "redis",
        "ewa_postgres",
    }


@pytest.mark.unit
def test_llama_probe_path_openai_compat(pf) -> None:
    assert pf.llama_probe_path("/api/tags", "true") == "/health"
    assert pf.llama_probe_path("/api/tags", "0") == "/api/tags"
    assert pf.llama_probe_path("/health", "true") == "/health"


@pytest.mark.unit
def test_redis_host_forbidden(pf) -> None:
    assert pf.redis_host_forbidden("127.0.0.1", "localhost,127.0.0.1")
    assert not pf.redis_host_forbidden("redis-stack1", "localhost,127.0.0.1")


@pytest.mark.unit
def test_parse_ewa_database_url_no_secrets(pf) -> None:
    target = pf.parse_ewa_database_url("postgresql://ewa_user:secret@192.168.1.50:5433/ewa_orchestration")
    assert target is not None
    assert target.host == "192.168.1.50"
    assert target.port == 5433
    assert target.database == "ewa_orchestration"


@pytest.mark.unit
def test_run_preflight_missing_required_env_fails(pf) -> None:
    with patch.dict("os.environ", {}, clear=True):
        report = pf.run_preflight(python_executable=sys.executable)
    assert report.exit_code == 1
    assert any(c.key == "env" for c in report.checks)


@pytest.mark.unit
def test_run_preflight_redis_forbidden_is_fail_closed(pf) -> None:
    env = {
        "STACK0_PACKAGE_IMPORT_CHECKLIST": "httpx:httpx",
        "STACK0_TCP_PROBE_TIMEOUT_SEC": "1",
        "STACK0_REDIS_FORBIDDEN_HOSTS": "localhost,127.0.0.1",
        "STACK0_LL_HTTP_HEALTH_SUFFIX": "/health",
        "STACK0_TIKA_HTTP_HEALTH_SUFFIX": "/tika",
        "STACK0_FFMPEG_BIN": "/usr/bin/ffmpeg",
        "STACK0_PREFLIGHT_FAIL_ON": "postgres,redis",
        "REDIS_HOST": "127.0.0.1",
        "REDIS_PORT": "6379",
    }
    with patch.dict("os.environ", env, clear=True):
        with patch.object(pf, "probe_tcp", return_value=True):
            with patch.object(pf, "probe_http", return_value=True):
                with patch.object(pf, "check_import_checklist", return_value=(1, 0, [])):
                    with patch.object(pf, "resolve_ffmpeg_bin", return_value="/usr/bin/ffmpeg"):
                        report = pf.run_preflight(python_executable=sys.executable)
    assert report.exit_code == 1
    forbidden = [c for c in report.checks if c.key == "redis_forbidden"]
    assert forbidden and forbidden[0].status == "fail"


@pytest.mark.unit
def test_run_preflight_postgres_tcp_warn_when_not_in_fail_on(pf) -> None:
    env = {
        "STACK0_PACKAGE_IMPORT_CHECKLIST": "httpx:httpx",
        "STACK0_TCP_PROBE_TIMEOUT_SEC": "1",
        "STACK0_REDIS_FORBIDDEN_HOSTS": "localhost,127.0.0.1",
        "STACK0_LL_HTTP_HEALTH_SUFFIX": "/health",
        "STACK0_TIKA_HTTP_HEALTH_SUFFIX": "/tika",
        "STACK0_FFMPEG_BIN": "/usr/bin/ffmpeg",
        "STACK0_PREFLIGHT_FAIL_ON": "redis",
        "POSTGRES_HOST": "10.0.0.1",
        "POSTGRES_PORT": "5432",
        "REDIS_HOST": "redis-stack1",
        "REDIS_PORT": "6379",
    }

    def fake_tcp(host, port, timeout_sec):  # noqa: ANN001
        if host == "10.0.0.1":
            raise OSError("connection refused")
        return True

    with patch.dict("os.environ", env, clear=True):
        with patch.object(pf, "probe_tcp", side_effect=fake_tcp):
            with patch.object(pf, "probe_http", return_value=True):
                with patch.object(pf, "check_import_checklist", return_value=(1, 0, [])):
                    with patch.object(pf, "resolve_ffmpeg_bin", return_value="/usr/bin/ffmpeg"):
                        report = pf.run_preflight(python_executable=sys.executable)
    pg = [c for c in report.checks if c.key == "postgres"]
    assert pg and pg[0].status == "warn"
    assert report.exit_code == 0


@pytest.mark.unit
def test_run_preflight_import_missing_fail_closed(pf) -> None:
    env = {
        "STACK0_PACKAGE_IMPORT_CHECKLIST": "missing-pkg:definitely_not_a_real_module_xyz",
        "STACK0_TCP_PROBE_TIMEOUT_SEC": "1",
        "STACK0_REDIS_FORBIDDEN_HOSTS": "localhost,127.0.0.1",
        "STACK0_LL_HTTP_HEALTH_SUFFIX": "/health",
        "STACK0_TIKA_HTTP_HEALTH_SUFFIX": "/tika",
        "STACK0_FFMPEG_BIN": "/usr/bin/ffmpeg",
    }
    with patch.dict("os.environ", env, clear=True):
        with patch.object(pf, "probe_tcp", return_value=True):
            with patch.object(pf, "probe_http", return_value=True):
                with patch.object(pf, "resolve_ffmpeg_bin", return_value="/usr/bin/ffmpeg"):
                    report = pf.run_preflight(python_executable=sys.executable)
    assert report.exit_code == 1
    imports = [c for c in report.checks if c.key == "imports"]
    assert imports and imports[0].status == "fail"


@pytest.mark.unit
def test_site_studio_delegated_to_lifespan(pf) -> None:
    env = {
        "STACK0_PACKAGE_IMPORT_CHECKLIST": "httpx:httpx",
        "STACK0_TCP_PROBE_TIMEOUT_SEC": "1",
        "STACK0_REDIS_FORBIDDEN_HOSTS": "localhost,127.0.0.1",
        "STACK0_LL_HTTP_HEALTH_SUFFIX": "/health",
        "STACK0_TIKA_HTTP_HEALTH_SUFFIX": "/tika",
        "STACK0_FFMPEG_BIN": "/usr/bin/ffmpeg",
    }
    with patch.dict("os.environ", env, clear=True):
        with patch.object(pf, "probe_tcp", return_value=True):
            with patch.object(pf, "probe_http", return_value=True):
                with patch.object(pf, "check_import_checklist", return_value=(1, 0, [])):
                    with patch.object(pf, "resolve_ffmpeg_bin", return_value="/usr/bin/ffmpeg"):
                        report = pf.run_preflight(python_executable=sys.executable)
    ss = [c for c in report.checks if c.key == "site_studio"]
    assert ss and ss[0].status == "skip"
    assert "lifespan" in ss[0].detail
