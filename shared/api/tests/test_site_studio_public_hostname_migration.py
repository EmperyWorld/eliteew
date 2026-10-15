# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Ensure legacy Site Studio wildcard hosts migrate to {slug}-site.eliteew.ru.
# Invariants:
# - Custom domains outside product wildcards are preserved.
# Related:
# - api/services/site_studio_runtime/helpers.py
# ---
from __future__ import annotations

from types import SimpleNamespace

from api.services.site_studio_runtime.helpers import (
    resolve_site_studio_public_hostname,
    resolve_site_studio_runtime_health_urls,
)


def test_legacy_empery_world_hostname_migrates_to_eliteew_ru() -> None:
    instance = SimpleNamespace(
        site_slug="demo-site",
        public_hostname="demo-site.sites.empery.world",
    )
    assert resolve_site_studio_public_hostname(instance) == "demo-site.eliteew.ru"


def test_legacy_eliteew_sites_hostname_migrates_to_interim_shape() -> None:
    instance = SimpleNamespace(
        site_slug="demo-site",
        public_hostname="demo-site.sites.eliteew.ru",
    )
    assert resolve_site_studio_public_hostname(instance) == "demo-site.eliteew.ru"


def test_current_eliteew_hostname_is_kept() -> None:
    instance = SimpleNamespace(
        site_slug="demo-site",
        public_hostname="demo-site.eliteew.ru",
    )
    assert resolve_site_studio_public_hostname(instance) == "demo-site.eliteew.ru"


def test_custom_domain_is_preserved() -> None:
    instance = SimpleNamespace(
        site_slug="demo-site",
        public_hostname="shop.example.com",
    )
    assert resolve_site_studio_public_hostname(instance) == "shop.example.com"


def test_runtime_health_skips_public_https_without_compose() -> None:
    instance = SimpleNamespace(
        site_slug="demo-site",
        compose_project_name=None,
        api_base_url="https://demo-site.eliteew.ru/api",
        public_url="https://demo-site.eliteew.ru",
    )
    api_probe, public_probe, skip_reason = resolve_site_studio_runtime_health_urls(instance)
    assert api_probe is None
    assert public_probe is None
    assert skip_reason is not None
    assert "public HTTPS probe skipped" in skip_reason


def test_runtime_health_uses_compose_internal_http() -> None:
    instance = SimpleNamespace(
        site_slug="demo-site",
        compose_project_name="site-studio-demo",
        api_base_url="https://demo-site.eliteew.ru/api",
        public_url="https://demo-site.eliteew.ru",
    )
    api_probe, public_probe, skip_reason = resolve_site_studio_runtime_health_urls(instance)
    assert skip_reason is None
    assert api_probe == "http://site-studio-demo-api-1:3000/api"
    assert public_probe == "http://site-studio-demo-frontend-1:4173"
