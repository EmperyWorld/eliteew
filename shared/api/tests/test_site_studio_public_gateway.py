# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for the Site Studio public wildcard gateway security and routing contract.
# Invariants:
# - Public gateway never exposes admin/Desktop paths.
# - HTML storefront responses strip conditional request headers and attach frame-ancestor CSP.
# Related:
# - api/routers/site_studio_public.py
# - api/services/site_studio_public_utils.py
# ---
from __future__ import annotations

from types import SimpleNamespace

from fastapi.testclient import TestClient

from api.core.database_manager import get_postgres_session
from api.models.desktop import SiteStudioPublicationState
from api.routers import site_studio_public


class _FakePublicGatewayResponse:
    status_code = 200
    content = b"<html>ok</html>"

    class _Headers:
        @staticmethod
        def get(key: str, default: str = "") -> str:
            if key.lower() == "content-type":
                return "text/html; charset=utf-8"
            return default

        @staticmethod
        def multi_items() -> list[tuple[str, str]]:
            return [("content-type", "text/html; charset=utf-8")]

    headers = _Headers()


class _FakePublicGatewayClient:
    def __init__(self) -> None:
        self.last_headers: dict[str, str] = {}
        self.last_url = ""

    async def request(self, _method: str, url: str, **kwargs):
        self.last_url = url
        self.last_headers = dict(kwargs.get("headers") or {})
        return _FakePublicGatewayResponse()


async def _fake_db_dependency():
    return object()


def _open_instance(**overrides):
    values = {
        "publication_state": SiteStudioPublicationState.OPEN.value,
        "compose_project_name": "site-studio-demo",
        "public_hostname": "demo-site.eliteew.ru",
        "public_url": "https://demo-site.eliteew.ru",
        "api_base_url": "https://demo-site.eliteew.ru/api",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _client() -> TestClient:
    site_studio_public.public_site_studio_app.dependency_overrides[get_postgres_session] = _fake_db_dependency
    return TestClient(site_studio_public.public_site_studio_app)


def test_public_gateway_blocks_admin_paths(monkeypatch) -> None:
    async def _resolve(_request, _db):
        raise AssertionError("blocked public paths must not resolve instances")

    monkeypatch.setattr(site_studio_public, "_resolve_public_site_instance", _resolve)
    with _client() as client:
        response = client.get("/admin/login", headers={"host": "demo-site.eliteew.ru"})

    assert response.status_code == 404


def test_public_gateway_blocks_desktop_ops_paths(monkeypatch) -> None:
    async def _resolve(_request, _db):
        raise AssertionError("blocked desktop paths must not resolve instances")

    monkeypatch.setattr(site_studio_public, "_resolve_public_site_instance", _resolve)
    with _client() as client:
        response = client.get(
            "/api/v1/desktop/site-manager/ops/overview",
            headers={"host": "demo-site.eliteew.ru"},
        )

    assert response.status_code == 404


def test_public_gateway_closed_publication_returns_404(monkeypatch) -> None:
    async def _resolve(_request, _db):
        return _open_instance(publication_state=SiteStudioPublicationState.CLOSED.value)

    monkeypatch.setattr(site_studio_public, "_resolve_public_site_instance", _resolve)
    with _client() as client:
        response = client.get("/", headers={"host": "demo-site.eliteew.ru"})

    assert response.status_code == 404


def test_public_gateway_missing_runtime_metadata_returns_503(monkeypatch) -> None:
    async def _resolve(_request, _db):
        return _open_instance(compose_project_name=None)

    monkeypatch.setattr(site_studio_public, "_resolve_public_site_instance", _resolve)
    with _client() as client:
        response = client.get("/", headers={"host": "demo-site.eliteew.ru"})

    assert response.status_code == 503


def test_public_gateway_custom_domain_resolution_keeps_blocklist(monkeypatch) -> None:
    fake_client = _FakePublicGatewayClient()

    async def _resolve_binding(_db, *, hostname: str):
        assert hostname == "custom.example.com"
        return _open_instance(public_hostname="demo-site.eliteew.ru")

    monkeypatch.setattr(site_studio_public, "resolve_domain_binding_instance", _resolve_binding)
    monkeypatch.setattr(site_studio_public, "get_httpx_client", lambda: fake_client)

    with _client() as client:
        storefront = client.get("/", headers={"host": "custom.example.com"})
        blocked = client.get("/admin/login", headers={"host": "custom.example.com"})

    assert storefront.status_code == 200
    assert blocked.status_code == 404
    assert fake_client.last_url == "http://site-studio-demo-frontend-1:4173"


def test_public_gateway_html_strips_conditional_headers_and_sets_csp(monkeypatch) -> None:
    fake_client = _FakePublicGatewayClient()

    async def _resolve(_request, _db):
        return _open_instance()

    monkeypatch.setattr(site_studio_public, "_resolve_public_site_instance", _resolve)
    monkeypatch.setattr(site_studio_public, "get_httpx_client", lambda: fake_client)

    with _client() as client:
        response = client.get(
            "/",
            headers={
                "host": "demo-site.eliteew.ru",
                "if-none-match": '"stale"',
                "if-modified-since": "Fri, 01 Jan 2026 00:00:00 GMT",
            },
        )

    assert response.status_code == 200
    assert "if-none-match" not in {key.lower() for key in fake_client.last_headers}
    assert "if-modified-since" not in {key.lower() for key in fake_client.last_headers}
    assert "frame-ancestors" in response.headers["content-security-policy"]
    assert fake_client.last_url == "http://site-studio-demo-frontend-1:4173"
