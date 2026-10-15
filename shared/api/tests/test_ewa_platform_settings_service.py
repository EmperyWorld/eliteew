# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for EWA platform settings service (DB cache + os.getenv shim).
# Related:
# - api/ewa_platform/settings/service.py
# ---

from __future__ import annotations

import os

import pytest

from api.ewa_platform.settings import service as settings_service


@pytest.mark.unit
def test_validate_setting_value_bool() -> None:
    assert settings_service.validate_setting_value("EWA_COMPANION_ADMIN_ENABLED", "1") is None
    assert settings_service.validate_setting_value("EWA_COMPANION_ADMIN_ENABLED", "maybe") == "invalid_bool"


@pytest.mark.unit
def test_validate_reactive_chrome_setting_in_catalog() -> None:
    """PUT admin settings must not 422 unknown_setting_key for reactive chrome."""
    from api.ewa_platform.settings.catalog_entries import GENERATED_CATALOG

    key = "EWA_COMPANION_REACTIVE_CHROME_ENABLED"
    assert key in GENERATED_CATALOG
    assert GENERATED_CATALOG[key].value_type == "bool"
    assert settings_service.validate_setting_value(key, "0") is None
    assert settings_service.validate_setting_value(key, "1") is None
    assert settings_service.validate_setting_value(key, "maybe") == "invalid_bool"
    assert settings_service.validate_setting_value("EWA_COMPANION_NOT_A_REAL_KEY", "1") == "unknown_setting_key"


@pytest.mark.unit
def test_getenv_shim_reads_cache_not_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_VOICE_ENABLED", "0")
    monkeypatch.setenv("EWA_DATABASE_URL", "postgres://x")
    settings_service._apply_cache({"EWA_COMPANION_VOICE_ENABLED": "1"})
    settings_service.install_ewa_settings_getenv_shim()
    assert os.getenv("EWA_COMPANION_VOICE_ENABLED") == "1"
    assert os.getenv("EWA_DATABASE_URL", "postgres://x") == "postgres://x"


@pytest.mark.unit
def test_getenv_shim_falls_through_for_uncached_ewa_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    """Compose/Config Plane gates must survive PG settings bootstrap when not catalogued."""

    monkeypatch.setenv("EWA_DEEP_LLM_ENABLED", "1")
    monkeypatch.setenv("EWA_DATABASE_URL", "postgres://x")
    # Cache loaded, but deep gate absent from catalog/DB seed.
    settings_service._apply_cache({"EWA_COMPANION_VOICE_ENABLED": "1"})
    settings_service.install_ewa_settings_getenv_shim()
    assert os.getenv("EWA_DEEP_LLM_ENABLED") == "1"
    from api.services.llm_runtime.deep_client import deep_llm_enabled

    assert deep_llm_enabled() is True


@pytest.mark.unit
def test_bootstrap_env_only_database_url() -> None:
    assert "EWA_DATABASE_URL" in settings_service._BOOTSTRAP_ENV_ONLY
    assert "EWA_COMPANION_ADMIN_ENABLED" not in settings_service._BOOTSTRAP_ENV_ONLY
