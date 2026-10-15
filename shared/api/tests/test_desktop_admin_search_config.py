# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for desktop admin search-config router payload validation and forwarding.
# Invariants:
# - Secret set/rotate operations require non-empty value.
# - Patch route forwards actor id and structured payload to service layer.
# Related:
# - api/routers/desktop_admin_search_config.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from api.routers import desktop_admin_search_config as mod


def test_search_secret_update_requires_value_for_set() -> None:
    with pytest.raises(ValidationError):
        mod.SearchSecretUpdate.model_validate({"action": "set", "value": "   "})


@pytest.mark.asyncio
async def test_patch_search_runtime_config_forwards_actor_and_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    actor = uuid4()
    body = mod.SearchConfigPatchBody.model_validate(
        {
            "settings": {"surfaces": {"ugs": False}, "cache_enabled": True},
            "secrets": {"yandex_api_key": {"action": "rotate", "value": "new-key"}},
            "note": "rotate test",
        }
    )
    service_mock = AsyncMock(
        return_value={
            "settings": {
                "provider": "yandex",
                "yandex_search_type": "auto",
                "yandex_search_l10n": "auto",
                "yandex_search_region": "225",
                "yandex_groups_on_page": 5,
                "cache_enabled": True,
                "cache_ttl_sec": 300,
                "cache_empty_ttl_sec": 60,
                "quota_enforced": True,
                "monthly_free_default": 50,
                "default_limit": 8,
                "surfaces": {
                    "desktop": True,
                    "ewa": True,
                    "marketing": True,
                    "imperorg": True,
                    "ugs": False,
                },
            },
            "secrets": {
                "yandex_api_key": {
                    "configured": True,
                    "configured_in_db": True,
                    "value_masked": True,
                },
                "yandex_folder_id": {
                    "configured": False,
                    "configured_in_db": False,
                    "value_masked": False,
                },
            },
            "source": "db",
            "updated_by": str(actor),
            "updated_at": None,
        }
    )
    monkeypatch.setattr(mod, "patch_search_runtime_admin_payload", service_mock)

    response = await mod.patch_search_runtime_config(
        body=body,
        db=object(),  # type: ignore[arg-type]
        admin=SimpleNamespace(id=actor),
    )

    assert response.settings.provider == "yandex"
    service_mock.assert_awaited_once()
    service_call = service_mock.await_args
    assert service_call is not None
    kwargs = service_call.kwargs
    assert kwargs["actor_user_id"] == actor
    assert kwargs["settings_patch"]["surfaces"]["ugs"] is False
    assert kwargs["secret_updates"]["yandex_api_key"]["action"] == "rotate"


@pytest.mark.asyncio
async def test_bootstrap_search_runtime_from_env_forwards_flags(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    actor = uuid4()
    body = mod.SearchConfigBootstrapBody.model_validate({"force": True, "note": "seed"})
    service_mock = AsyncMock(
        return_value={
            "settings": {
                "provider": "yandex",
                "yandex_search_type": "auto",
                "yandex_search_l10n": "auto",
                "yandex_search_region": "225",
                "yandex_groups_on_page": 5,
                "cache_enabled": True,
                "cache_ttl_sec": 300,
                "cache_empty_ttl_sec": 60,
                "quota_enforced": True,
                "monthly_free_default": 50,
                "default_limit": 8,
                "surfaces": {
                    "desktop": True,
                    "ewa": True,
                    "marketing": True,
                    "imperorg": True,
                    "ugs": True,
                },
            },
            "secrets": {
                "yandex_api_key": {
                    "configured": True,
                    "configured_in_db": True,
                    "value_masked": True,
                },
                "yandex_folder_id": {
                    "configured": True,
                    "configured_in_db": True,
                    "value_masked": True,
                },
            },
            "source": "db",
            "updated_by": str(actor),
            "updated_at": None,
        }
    )
    monkeypatch.setattr(mod, "bootstrap_search_runtime_config_from_env", service_mock)

    response = await mod.bootstrap_search_runtime_from_env(
        body=body,
        db=object(),  # type: ignore[arg-type]
        admin=SimpleNamespace(id=actor),
    )

    assert response.source == "db"
    service_mock.assert_awaited_once()
    service_call = service_mock.await_args
    assert service_call is not None
    kwargs = service_call.kwargs
    assert kwargs["actor_user_id"] == actor
    assert kwargs["force"] is True
    assert kwargs["audit_note"] == "seed"


def test_search_test_search_body_requires_user_when_consume_quota() -> None:
    with pytest.raises(ValidationError):
        mod.SearchTestSearchBody.model_validate({"query": "hello", "consume_quota": True})
