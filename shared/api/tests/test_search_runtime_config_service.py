# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for global search runtime config service (DB-first resolver, secret status, patch semantics).
# Invariants:
# - Tests avoid live DB and external crypto services by stubbing session/encryption boundaries.
# Related:
# - api/services/search_runtime_config_service.py
# ---

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from api.models.search_runtime_config import SearchRuntimeConfig, SearchRuntimeConfigAudit
from api.services import search_runtime_config_service as src
from api.services import search_service as search_svc


@dataclass
class _FakeDb:
    row: SearchRuntimeConfig | None = None
    audit_rows: list[SearchRuntimeConfigAudit] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.audit_rows is None:
            self.audit_rows = []

    async def get(self, model: Any, key: Any) -> Any:  # noqa: ANN401
        if model is SearchRuntimeConfig and int(key) == 1:
            return self.row
        return None

    def add(self, obj: Any) -> None:  # noqa: ANN401
        if isinstance(obj, SearchRuntimeConfig):
            self.row = obj
            return
        if isinstance(obj, SearchRuntimeConfigAudit):
            self.audit_rows.append(obj)

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        return None


def _env_settings_stub() -> dict[str, Any]:
    return {
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
    }


def _env_secret_stub() -> dict[str, str]:
    return {"yandex_api_key": "env-key", "yandex_folder_id": "env-folder"}


@pytest.mark.asyncio
async def test_patch_search_runtime_admin_payload_updates_settings_and_secret_status(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _FakeDb()
    monkeypatch.setattr(src, "_env_settings_defaults", _env_settings_stub)
    monkeypatch.setattr(src, "_env_secret_defaults", _env_secret_stub)
    monkeypatch.setattr(src, "encrypt_search_secret", lambda value: f"enc::{value}")
    monkeypatch.setattr(src, "decrypt_search_secret", lambda value: value.replace("enc::", "", 1))
    monkeypatch.setattr(search_svc, "invalidate_web_search_cache", AsyncMock())

    payload = await src.patch_search_runtime_admin_payload(
        db,  # type: ignore[arg-type]
        actor_user_id=uuid4(),
        settings_patch={"surfaces": {"ugs": False}, "cache_enabled": False},
        secret_updates={"yandex_api_key": {"action": "rotate", "value": "db-key"}},
        audit_note="test patch",
    )

    assert payload["settings"]["provider"] == "yandex"
    assert payload["settings"]["surfaces"]["ugs"] is False
    assert payload["settings"]["cache_enabled"] is False
    assert payload["secrets"]["yandex_api_key"]["configured_in_db"] is True
    assert payload["secrets"]["yandex_folder_id"]["configured"] is True  # env fallback
    assert db.row is not None
    assert db.row.secrets_encrypted_json["yandex_api_key"] == "enc::db-key"
    assert len(db.audit_rows) == 1


@pytest.mark.asyncio
async def test_resolve_effective_search_runtime_config_uses_db_and_env_secret_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(src, "_env_settings_defaults", _env_settings_stub)
    monkeypatch.setattr(src, "_env_secret_defaults", _env_secret_stub)
    monkeypatch.setattr(src, "decrypt_search_secret", lambda value: value.replace("enc::", "", 1))

    db = _FakeDb(
        row=SearchRuntimeConfig(
            id=1,
            settings_json={**_env_settings_stub(), "surfaces": {"marketing": False}},
            secrets_encrypted_json={"yandex_api_key": "enc::db-key"},
        )
    )

    runtime = await src.resolve_effective_search_runtime_config(db, surface="marketing")  # type: ignore[arg-type]

    assert runtime.provider_mode == "yandex"
    assert runtime.yandex_api_key == "db-key"
    assert runtime.yandex_folder_id == "env-folder"
    assert runtime.surface_enabled is False


@pytest.mark.asyncio
async def test_resolve_effective_search_runtime_config_falls_back_to_env_without_db(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(src, "_env_settings_defaults", _env_settings_stub)
    monkeypatch.setattr(src, "_env_secret_defaults", _env_secret_stub)

    runtime = await src.resolve_effective_search_runtime_config(None, surface="desktop")

    assert runtime.source == "env"
    assert runtime.provider_mode == "yandex"
    assert runtime.yandex_api_key == "env-key"


@pytest.mark.asyncio
async def test_resolve_effective_search_runtime_config_treats_empty_db_row_as_env_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(src, "_env_settings_defaults", _env_settings_stub)
    monkeypatch.setattr(src, "_env_secret_defaults", _env_secret_stub)
    db = _FakeDb(row=SearchRuntimeConfig(id=1, settings_json={}, secrets_encrypted_json={}))

    runtime = await src.resolve_effective_search_runtime_config(db, surface="desktop")  # type: ignore[arg-type]

    assert runtime.source == "env"
    assert runtime.provider_mode == "yandex"
    assert runtime.yandex_api_key == "env-key"


@pytest.mark.asyncio
async def test_bootstrap_search_runtime_config_from_env_writes_seed_and_audit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(src, "_env_settings_defaults", _env_settings_stub)
    monkeypatch.setattr(src, "_env_secret_defaults", _env_secret_stub)
    monkeypatch.setattr(src, "encrypt_search_secret", lambda value: f"enc::{value}")
    monkeypatch.setattr(src, "decrypt_search_secret", lambda value: value.replace("enc::", "", 1))
    db = _FakeDb()

    payload = await src.bootstrap_search_runtime_config_from_env(
        db,  # type: ignore[arg-type]
        actor_user_id=uuid4(),
        force=False,
        audit_note="seed",
    )

    assert payload["source"] == "db"
    assert payload["secrets"]["yandex_api_key"]["configured_in_db"] is True
    assert db.row is not None
    assert db.row.secrets_encrypted_json["yandex_api_key"] == "enc::env-key"
    assert any(row.action == "bootstrap_env" for row in db.audit_rows)
