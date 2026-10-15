# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral guards for Site Studio lifecycle action validation.
# Invariants:
# - Destroy remains allowed while status is a stuck pending transition.
# Related:
# - api/services/site_studio_lifecycle_policy.py
# ---
from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from api.services.site_studio_lifecycle_policy import validate_site_studio_lifecycle_action


def test_pending_blocks_start_but_allows_destroy() -> None:
    instance = SimpleNamespace(
        status="provisioning",
        compose_file_path="/tmp/compose.yml",
        compose_project_name="site-studio-demo",
    )
    with pytest.raises(HTTPException) as exc:
        validate_site_studio_lifecycle_action(instance, action="start")
    assert exc.value.status_code == 409
    assert "pending transition" in str(exc.value.detail)

    validate_site_studio_lifecycle_action(instance, action="destroy")


def test_running_stop_requires_compose_metadata() -> None:
    instance = SimpleNamespace(status="running", compose_file_path="", compose_project_name="")
    with pytest.raises(HTTPException) as exc:
        validate_site_studio_lifecycle_action(instance, action="stop")
    assert exc.value.status_code == 409
    assert "compose metadata" in str(exc.value.detail)
