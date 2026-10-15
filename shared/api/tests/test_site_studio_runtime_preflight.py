# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Site Studio olenti runtime preflight — template copy + compose generation without compose up.
# Invariants:
# - Neutral baseline markers (shop routes, value_block alias) survive template staging.
# Related:
# - api/services/site_studio_runtime_service.py
# - site-templates/olenti/
# ---
from __future__ import annotations

import sys
import types
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest


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

from api.services.site_studio_runtime_service import (  # noqa: E402
    SiteStudioRuntimeManager,
    resolve_site_studio_template_root,
)


def _resolve_template_root() -> Path | None:
    root = resolve_site_studio_template_root("olenti")
    if root.exists() and (root / "server" / "products.json").is_file():
        return root
    here = Path(__file__).resolve()
    for candidate in (
        here.parents[3] / "site-templates" / "olenti",
        here.parents[2].parent / "site-templates" / "olenti",
    ):
        if (candidate / "server" / "products.json").is_file():
            return candidate
    return None


TEMPLATE_ROOT = _resolve_template_root()


@pytest.mark.skipif(TEMPLATE_ROOT is None, reason="site-templates/olenti not available")
def test_prepare_runtime_files_stages_neutral_olenti(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    assert TEMPLATE_ROOT is not None
    monkeypatch.delenv("SITE_STUDIO_OLENTI_API_IMAGE", raising=False)
    monkeypatch.delenv("SITE_STUDIO_OLENTI_FRONTEND_IMAGE", raising=False)

    slug = f"pytest-neutral-{uuid4().hex[:8]}"
    instance = SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        site_slug=slug,
        template_key="olenti",
        site_title="Neutral Smoke",
        public_hostname=f"{slug}-site.eliteew.ru",
        admin_email=f"admin+{slug}@site-studio.local",
        admin_password_encrypted=None,
        compose_project_name=None,
        api_base_url=None,
        public_url=None,
        ports_json={},
        db_name=None,
    )

    manager = SiteStudioRuntimeManager(
        template_root=TEMPLATE_ROOT,
        runtime_base_dir=tmp_path,
    )
    monkeypatch.setattr(
        manager,
        "_run_runtime",
        lambda *args: __import__("subprocess").CompletedProcess(
            args, 1 if args[:2] == ("network", "inspect") else 0, "", "network not found"
        ),
    )
    metadata, _admin_password = manager._prepare_runtime_files(instance, force_refresh_source=True)

    compose_text = Path(metadata["compose_file_path"]).read_text(encoding="utf-8")
    assert "networks:" in compose_text
    assert "ru.eliteew.site-studio.instance" in compose_text
    assert "eliteew-shared:" in compose_text
    # FQIN required: short-names hang rootless podman without TTY (short-name resolution).
    assert "docker.io/library/postgres:16-alpine" in compose_text
    assert "docker.io/library/node:20-alpine" in compose_text
    assert "image: postgres:16-alpine" not in compose_text
    assert "image: node:20-alpine" not in compose_text

    routes = (Path(metadata["source_dir"]) / "src" / "constants" / "routes.ts").read_text(encoding="utf-8")
    assert "SHOP_CATALOG" in routes
    assert "/shop/catalog" in routes
    assert "LEGACY_SHOP_PERFUMES" in routes

    content_routes = (Path(metadata["source_dir"]) / "server" / "src" / "routes" / "content.ts").read_text(
        encoding="utf-8"
    )
    assert "value_block" in content_routes
    assert "aromatherapy" in content_routes

    products = (Path(metadata["source_dir"]) / "server" / "products.json").read_text(encoding="utf-8")
    assert "starter" in products
    assert "signature" in products
    assert "perfume" not in products.lower()
