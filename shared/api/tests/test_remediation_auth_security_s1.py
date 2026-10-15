#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for the Phase 1 auth/security remediation gate.
# Invariants:
# - Site Studio public hosts are exact one-label wildcard matches, not arbitrary subdomains.
# - Keycloak introspection fallback enforces EliteEW audience/client allowlists before caching.
# Related:
# - api/services/site_studio_public_utils.py
# - api/services/keycloak_service.py
# - api/services/unified_content/semantic_search_service.py
# ---
"""Security regression tests for host auth bypass and introspection fallback."""

from __future__ import annotations

import asyncio
import importlib.util
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import HTTPException

from api.services import keycloak_service as keycloak_module
from api.services.site_studio_public_utils import (
    is_site_studio_public_gateway_path,
    is_site_studio_public_host,
)

_API_ROOT = Path(__file__).resolve().parents[1]
_SEMANTIC_SPEC = importlib.util.spec_from_file_location(
    "_semantic_search_service_under_test",
    _API_ROOT / "services" / "unified_content" / "semantic_search_service.py",
)
if _SEMANTIC_SPEC is None or _SEMANTIC_SPEC.loader is None:
    raise RuntimeError("semantic_search_service.py spec could not be loaded")
_semantic_module = importlib.util.module_from_spec(_SEMANTIC_SPEC)
_SEMANTIC_SPEC.loader.exec_module(_semantic_module)
SearchResult = _semantic_module.SearchResult
SemanticSearchService = _semantic_module.SemanticSearchService


@pytest.mark.unit
def test_site_studio_public_host_requires_single_slug_label() -> None:
    assert is_site_studio_public_host("demo-site.eliteew.ru") is True
    assert is_site_studio_public_host("demo-site.eliteew.ru:443") is True
    assert is_site_studio_public_host("app.eliteew.ru") is False
    assert is_site_studio_public_host("demo.eliteew.ru") is False
    assert is_site_studio_public_host("demo.sites.eliteew.ru") is False
    assert is_site_studio_public_host("a.b.eliteew.ru") is False
    assert is_site_studio_public_host("eliteew.ru") is False


@pytest.mark.unit
def test_site_studio_public_gateway_path_excludes_admin_and_desktop_api() -> None:
    assert is_site_studio_public_gateway_path("/") is True
    assert is_site_studio_public_gateway_path("/api/content") is True
    assert is_site_studio_public_gateway_path("/api/admin/users") is False
    assert is_site_studio_public_gateway_path("/api/v1/desktop/shell-state") is False


@pytest.mark.unit
def test_keycloak_introspection_fallback_rejects_wrong_audience(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = keycloak_module.unified_settings
    monkeypatch.setattr(settings, "keycloak_verify_audience", True)
    monkeypatch.setattr(settings, "jwt_audience", "empery-api")
    monkeypatch.setattr(settings, "keycloak_client_id", "empery-api")
    monkeypatch.setattr(settings, "keycloak_web_client_id", "empery-web")
    monkeypatch.setattr(settings, "keycloak_mobile_client_id", "empery-mobile")

    with pytest.raises(HTTPException):
        keycloak_module._validate_keycloak_introspection_claims(
            {"active": True, "aud": "other-api", "azp": "empery-web", "client_id": "empery-web"}
        )


@pytest.mark.unit
def test_keycloak_introspection_fallback_rejects_wrong_client(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = keycloak_module.unified_settings
    monkeypatch.setattr(settings, "keycloak_verify_audience", True)
    monkeypatch.setattr(settings, "jwt_audience", "empery-api")
    monkeypatch.setattr(settings, "keycloak_client_id", "empery-api")
    monkeypatch.setattr(settings, "keycloak_web_client_id", "empery-web")
    monkeypatch.setattr(settings, "keycloak_mobile_client_id", "empery-mobile")

    with pytest.raises(HTTPException):
        keycloak_module._validate_keycloak_introspection_claims(
            {"active": True, "aud": "empery-api", "azp": "unknown-client", "client_id": "unknown-client"}
        )


@pytest.mark.unit
def test_semantic_search_acl_missing_db_pool_fails_closed() -> None:
    async def _run() -> None:
        service = SemanticSearchService(db_pool=None)
        content_id = uuid4()
        results = [
            SearchResult(
                content_id=content_id,
                title="Private document",
                description=None,
                score=1.0,
                metadata={"visibility": "private"},
            )
        ]
        assert await service._apply_access_control(results, uuid4()) == []

    asyncio.run(_run())
