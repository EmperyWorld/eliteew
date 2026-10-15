# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock for stack0 role-split env materialize classification.
# Invariants:
# - UnifiedConfig required-without-default keys must not be API-only.
# Related:
# - docker/scripts/stack0-env-materialize-roles.sh
# - documentation/platform/PROD-CORE-CONFIG-PLANE.md
# ---

from __future__ import annotations

import re
from pathlib import Path

import pytest

_REPO = Path(__file__).resolve().parents[3]
_SCRIPT = _REPO / "docker" / "scripts" / "stack0-env-materialize-roles.sh"


def _api_exact_block(src: str) -> str:
    m = re.search(r"API_EXACT\s*=\s*\{(.*?)\n\}", src, flags=re.S)
    assert m is not None, "API_EXACT block missing in materialize script"
    return m.group(1)


@pytest.mark.unit
def test_marketing_cabinet_router_model_not_api_only() -> None:
    """Workers mount shared+jobs; Field(...) key must stay shared (default class)."""
    src = _SCRIPT.read_text(encoding="utf-8")
    api_exact = _api_exact_block(src)
    assert "MARKETING_CABINET_ROUTER_MODEL" not in api_exact
    assert "UnifiedConfig required-without-default" in src
    assert "KEYCLOAK_CLIENT_SECRET" in src
    assert "SHARED_FORCE" in src


@pytest.mark.unit
def test_materialize_places_router_model_in_shared(tmp_path: Path) -> None:
    ssot = tmp_path / ".env.stack0.backend"
    ssot.write_text(
        "\n".join(
            [
                "DEBUG=false",
                "MARKETING_CABINET_ROUTER_MODEL=functiongemma:latest",
                "KEYCLOAK_CLIENT_ID=empery-api",
                "KEYCLOAK_CLIENT_SECRET=test-secret",
                "JWT_SECRET_KEY=test-jwt",
                "OIDC_PROVIDER_CLIENT_SECRET=test-oidc",
                "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    out_shared = tmp_path / ".env.stack0.shared"
    out_api = tmp_path / ".env.stack0.api"
    out_jobs = tmp_path / ".env.stack0.jobs"
    # Invoke embedded classifier via the script with overridden paths.
    import os
    import subprocess

    env = os.environ.copy()
    env["ELITEEW_STACK0_ENV_DIR"] = str(tmp_path)
    subprocess.run(
        ["bash", str(_SCRIPT)],
        check=True,
        cwd=str(_REPO),
        env=env,
        capture_output=True,
        text=True,
    )
    shared = out_shared.read_text(encoding="utf-8")
    api = out_api.read_text(encoding="utf-8")
    jobs = out_jobs.read_text(encoding="utf-8")
    assert "MARKETING_CABINET_ROUTER_MODEL=" in shared
    assert "KEYCLOAK_CLIENT_SECRET=" in shared
    assert "JWT_SECRET_KEY=" in shared
    assert "OIDC_PROVIDER_CLIENT_SECRET=" in shared
    assert "MARKETING_CABINET_ROUTER_MODEL=" not in api
    assert "KEYCLOAK_CLIENT_SECRET=" not in api
    assert "MARKETING_CABINET_ROUTER_MODEL=" not in jobs
    assert "KEYCLOAK_CLIENT_ID=" in api
    assert "PLAYWRIGHT_BROWSERS_PATH=" in jobs
