# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Site Studio template runtime profile resolution for olenti/allenti aliases.
# Invariants:
# - Import chain must not require optional MinIO at collection time.
# Related:
# - api/services/site_studio_runtime_service.py
# ---
from __future__ import annotations

import sys
import types


def _stub_minio_module() -> None:
    if "minio" in sys.modules:
        return
    module = types.ModuleType("minio")
    module.__path__ = []  # type: ignore[attr-defined]
    error_module = types.ModuleType("minio.error")
    sseconfig_module = types.ModuleType("minio.sseconfig")

    class _DummyMinio:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

    class _DummyS3Error(Exception):
        pass

    class _DummyRule:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

    class _DummySSEConfig:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

    setattr(module, "Minio", _DummyMinio)
    setattr(error_module, "S3Error", _DummyS3Error)
    setattr(sseconfig_module, "Rule", _DummyRule)
    setattr(sseconfig_module, "SSEConfig", _DummySSEConfig)
    sys.modules["minio"] = module
    sys.modules["minio.error"] = error_module
    sys.modules["minio.sseconfig"] = sseconfig_module


_stub_minio_module()

from api.services.site_studio_runtime_service import (
    SiteStudioRuntimeError,
    SiteStudioRuntimeManager,
    resolve_site_studio_template_profile,
    resolve_site_studio_template_profile_id,
)


def test_olenti_resolves_shared_storefront_profile() -> None:
    profile = resolve_site_studio_template_profile("olenti")
    assert profile is not None
    assert profile.get("profile_id") == "olenti-v1"
    assert isinstance(profile.get("blocks"), list)
    assert len(profile.get("blocks") or []) > 0


def test_allenti_resolves_allenti_profile_id() -> None:
    assert resolve_site_studio_template_profile_id("allenti") == "allenti-v1"


def test_aurelia_profile_loads_from_manifest() -> None:
    profile = resolve_site_studio_template_profile("aurelia")
    assert profile is not None
    assert profile.get("profile_id") == "aurelia-v1"
    assert isinstance(profile.get("site_settings"), dict)
    assert len(profile.get("blocks") or []) > 0


def test_images_runtime_mode_requires_template_images(monkeypatch) -> None:
    import api.services.site_studio_runtime.helpers as runtime_helpers
    import api.services.site_studio_runtime.manager_compose as runtime_compose

    monkeypatch.setattr(runtime_helpers, "SITE_STUDIO_RUNTIME_MODE", "images")
    monkeypatch.setattr(runtime_helpers, "SITE_STUDIO_OLENTI_API_IMAGE", "")
    monkeypatch.setattr(runtime_helpers, "SITE_STUDIO_OLENTI_FRONTEND_IMAGE", "")
    monkeypatch.setattr(runtime_compose, "SITE_STUDIO_RUNTIME_MODE", "images")
    monkeypatch.setattr(runtime_compose, "SITE_STUDIO_OLENTI_API_IMAGE", "")
    monkeypatch.setattr(runtime_compose, "SITE_STUDIO_OLENTI_FRONTEND_IMAGE", "")
    manager = SiteStudioRuntimeManager()

    try:
        manager.validate_runtime_preflight("olenti")
    except SiteStudioRuntimeError as exc:
        assert "SITE_STUDIO_OLENTI_API_IMAGE" in str(exc)
    else:
        raise AssertionError("images runtime mode must fail preflight when image vars are missing")
