# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for start_all.sh lib helpers (Wave 2).
# Invariants:
# - parse_ewa_database_url.py never prints credentials.
# Related:
# - docker/builders/stack0-api/scripts/lib/parse_ewa_database_url.py
# ---
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[3]
_PARSE_EWA = _REPO_ROOT / "docker/builders/stack0-api/scripts/lib/parse_ewa_database_url.py"


def _run_parse_ewa(env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(_PARSE_EWA)],
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )


@pytest.mark.unit
def test_parse_ewa_database_url_missing_env_exits_2() -> None:
    result = _run_parse_ewa({})
    assert result.returncode == 2


@pytest.mark.unit
def test_parse_ewa_database_url_parses_host_port_db() -> None:
    dsn = "postgresql://ewa_user:secret@192.168.1.50:5433/ewa_orchestration"
    result = _run_parse_ewa({"EWA_DATABASE_URL": dsn})
    assert result.returncode == 0
    assert result.stdout.strip() == "192.168.1.50\t5433\tewa_orchestration"
    assert "secret" not in result.stdout
    assert "secret" not in result.stderr


@pytest.mark.unit
def test_parse_ewa_database_url_malformed_exits_3() -> None:
    result = _run_parse_ewa({"EWA_DATABASE_URL": "not-a-valid-url"})
    assert result.returncode == 3
