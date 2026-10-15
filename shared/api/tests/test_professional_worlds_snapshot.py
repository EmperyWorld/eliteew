# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Focused unit tests for Professional Worlds aggregate snapshot loading without importing the FastAPI router.
# Invariants:
# - Module-aware snapshot slices must not call disabled list/get helpers.
# Related:
# - api/services/professional_worlds/service.py
# - tests/test_professional_worlds.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

import pytest

from api.services.professional_worlds.service import ProfessionalWorldsService


@pytest.mark.anyio
async def test_load_user_snapshot_skips_disabled_snapshot_slices(monkeypatch) -> None:
    """Module-aware snapshot must not call list/get helpers for disabled slices."""
    user_id = uuid4()
    service = ProfessionalWorldsService(None)  # type: ignore[arg-type]

    async def fake_list_verticals() -> list[dict[str, Any]]:
        return [{"slug": "realtor", "name": "Realtor"}]

    async def fake_list_user_vertical_activations(uid: UUID) -> list[dict[str, Any]]:
        assert uid == user_id
        return [
            {
                "vertical_slug": "realtor",
                "is_active": True,
                "onboarding": {},
                "entitlements": {},
            }
        ]

    async def fake_get_runtime_config(slug: str, user_id: UUID | None = None) -> dict[str, Any]:
        return {
            "vertical_slug": slug,
            "modules": [{"module_key": "overview", "is_enabled": True}],
        }

    async def fail_if_called(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("unexpected snapshot slice fetch")

    monkeypatch.setattr(service, "list_verticals", fake_list_verticals)
    monkeypatch.setattr(service, "list_user_vertical_activations", fake_list_user_vertical_activations)
    monkeypatch.setattr(service, "get_runtime_config", fake_get_runtime_config)
    monkeypatch.setattr(service, "get_profile", fail_if_called)
    monkeypatch.setattr(service, "list_clients", fail_if_called)
    monkeypatch.setattr(service, "list_deals", fail_if_called)
    monkeypatch.setattr(service, "list_courses", fail_if_called)
    monkeypatch.setattr(service, "list_artifacts", fail_if_called)
    monkeypatch.setattr(service, "list_properties", fail_if_called)

    snapshot = await service.load_user_snapshot(user_id, "realtor")
    assert snapshot["clients"] == []
    assert snapshot["properties"] == []
    assert snapshot["profile"] is None


@pytest.mark.asyncio
async def test_load_user_snapshot_consultant_skips_realtor_properties(monkeypatch) -> None:
    """Consultant vertical must not fetch realtor listing catalog."""
    user_id = uuid4()
    service = ProfessionalWorldsService(None)  # type: ignore[arg-type]

    async def fake_list_verticals() -> list[dict[str, Any]]:
        return [{"slug": "consultant", "name": "Consultant"}]

    async def fake_list_user_vertical_activations(uid: UUID) -> list[dict[str, Any]]:
        assert uid == user_id
        return [{"vertical_slug": "consultant", "is_active": True, "onboarding": {}, "entitlements": {}}]

    async def fake_get_runtime_config(slug: str, user_id: UUID | None = None) -> dict[str, Any]:
        return {
            "vertical_slug": slug,
            "modules": [
                {"module_key": "profile", "is_enabled": True},
                {"module_key": "clients", "is_enabled": True},
            ],
        }

    async def fake_get_profile(uid: UUID, vertical_slug: str) -> dict[str, Any] | None:
        return {"vertical_slug": vertical_slug, "display_name": "Test"}

    async def fake_list_clients(uid: UUID, vertical_slug: str) -> list[dict[str, Any]]:
        return [{"id": str(uuid4()), "name": "Client", "vertical_slug": vertical_slug}]

    async def fake_list_deals(*_a: Any, **_k: Any) -> list[dict[str, Any]]:
        return []

    async def fake_list_courses(*_a: Any, **_k: Any) -> list[dict[str, Any]]:
        return []

    async def fake_list_artifacts(*_a: Any, **_k: Any) -> list[dict[str, Any]]:
        return []

    async def fail_list_properties(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("consultant snapshot must not list realtor properties")

    monkeypatch.setattr(service, "list_verticals", fake_list_verticals)
    monkeypatch.setattr(service, "list_user_vertical_activations", fake_list_user_vertical_activations)
    monkeypatch.setattr(service, "get_runtime_config", fake_get_runtime_config)
    monkeypatch.setattr(service, "get_profile", fake_get_profile)
    monkeypatch.setattr(service, "list_clients", fake_list_clients)
    monkeypatch.setattr(service, "list_deals", fake_list_deals)
    monkeypatch.setattr(service, "list_courses", fake_list_courses)
    monkeypatch.setattr(service, "list_artifacts", fake_list_artifacts)
    monkeypatch.setattr(service, "list_properties", fail_list_properties)

    snapshot = await service.load_user_snapshot(user_id, "consultant")
    assert snapshot["properties"] == []
    assert snapshot["clients"]
    assert snapshot["profile"]["vertical_slug"] == "consultant"
