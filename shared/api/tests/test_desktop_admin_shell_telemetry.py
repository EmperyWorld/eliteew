# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for Unified Admin shell section-select telemetry ingest.
# Invariants:
# - Unknown section → 400; known section increments Prometheus helper.
# Related:
# - api/routers/desktop_admin_shell_telemetry.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from api.routers import desktop_admin_shell_telemetry as router_mod


@pytest.mark.asyncio
async def test_section_select_observes_known_section(monkeypatch: pytest.MonkeyPatch) -> None:
    observe = MagicMock()
    monkeypatch.setattr(router_mod, "observe_admin_shell_section_select", observe)

    response = await router_mod.post_admin_shell_section_select(
        body=router_mod.AdminShellSectionSelectBody(section="workers", embedded=True),
        _admin=SimpleNamespace(id=uuid4()),
    )

    assert response.status_code == 204
    observe.assert_called_once_with(section="workers", embedded=True)


@pytest.mark.asyncio
async def test_section_select_rejects_unknown_section(monkeypatch: pytest.MonkeyPatch) -> None:
    observe = MagicMock()
    monkeypatch.setattr(router_mod, "observe_admin_shell_section_select", observe)

    with pytest.raises(HTTPException) as exc:
        await router_mod.post_admin_shell_section_select(
            body=router_mod.AdminShellSectionSelectBody(section="notASection"),
            _admin=SimpleNamespace(id=uuid4()),
        )

    assert exc.value.status_code == 400
    observe.assert_not_called()


def test_admin_shell_section_ids_cover_core_nav() -> None:
    ids = router_mod.ADMIN_SHELL_SECTION_IDS
    for required in (
        "users",
        "workers",
        "platformOps",
        "topology",
        "factory",
        "docEditor",
        "musicForge",
        "ugsV2",
        "system",
    ):
        assert required in ids


@pytest.mark.asyncio
async def test_section_select_accepts_platform_ops(monkeypatch: pytest.MonkeyPatch) -> None:
    observe = MagicMock()
    monkeypatch.setattr(router_mod, "observe_admin_shell_section_select", observe)

    response = await router_mod.post_admin_shell_section_select(
        body=router_mod.AdminShellSectionSelectBody(section="platformOps", embedded=False),
        _admin=SimpleNamespace(id=uuid4()),
    )

    assert response.status_code == 204
    observe.assert_called_once_with(section="platformOps", embedded=False)
