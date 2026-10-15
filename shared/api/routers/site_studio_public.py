# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T && TZBrand
# ------------------------------------------------------------------------------
# Purpose:
#   Internal-only public storefront gateway for canonical Site Studio hosts and active custom domains.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - api/services/site_studio_domain_bindings.py
#   - documentation/platform/docker-re_doc/INTERNAL-SITES-ACCESS.md
# ------------------------------------------------------------------------------
from __future__ import annotations

from collections.abc import Iterable

from fastapi import Depends, FastAPI, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.database_manager import get_postgres_session
from api.core.http_clients import get_httpx_client
from api.models.desktop import ProjectSiteInstance, SiteStudioPublicationState, UserSiteInstance
from api.services.site_studio_domain_bindings import resolve_domain_binding_instance
from api.services.site_studio_public_utils import (
    SITE_STUDIO_PUBLIC_BLOCKED_PATH_PREFIXES,
    normalize_site_studio_request_host,
)
from api.services.site_studio_runtime_service import (
    SITE_STUDIO_ADMIN_APP_URL,
    SiteStudioRuntimeInstance,
    build_site_studio_internal_api_base_url,
    build_site_studio_internal_public_url,
)

PUBLIC_SITE_BLOCKED_PATHS = SITE_STUDIO_PUBLIC_BLOCKED_PATH_PREFIXES
HOP_BY_HOP_HEADERS = {
    "connection",
    "content-length",
    "host",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}
FORWARDED_RESPONSE_HEADERS = {
    "cache-control",
    "content-disposition",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
    "location",
    "set-cookie",
    "vary",
}

# Forwarded to Vite preview / nginx; must not be forwarded for SPA document routes or stale
# index.html + 304 keeps broken hashed chunk URLs until cache is cleared (worse on LAN clients).
_CONDITIONAL_REQUEST_HEADER_NAMES = frozenset(
    {
        "if-none-match",
        "if-modified-since",
        "if-match",
        "if-unmodified-since",
    }
)

public_site_studio_app = FastAPI(
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def _is_blocked_public_path(path: str) -> bool:
    normalized_path = path.rstrip("/") or "/"
    for blocked in PUBLIC_SITE_BLOCKED_PATHS:
        if normalized_path == blocked or normalized_path.startswith(f"{blocked}/"):
            return True
    return False


def _build_public_gateway_request_headers(request: Request) -> dict[str, str]:
    headers: dict[str, str] = {}
    for header_name, header_value in request.headers.items():
        if header_name.lower() in HOP_BY_HOP_HEADERS:
            continue
        headers[header_name] = header_value

    request_host = normalize_site_studio_request_host(request.headers.get("host"))
    if request_host:
        headers["x-forwarded-host"] = request_host
    headers["x-forwarded-proto"] = request.headers.get("x-forwarded-proto", request.url.scheme)

    client_host = request.client.host if request.client else ""
    if client_host:
        existing_forwarded_for = request.headers.get("x-forwarded-for", "").strip()
        headers["x-forwarded-for"] = (
            f"{existing_forwarded_for}, {client_host}" if existing_forwarded_for else client_host
        )

    return headers


def _build_public_gateway_target_url(instance: SiteStudioRuntimeInstance, path: str) -> str:
    normalized_path = path if path.startswith("/") else f"/{path}"
    if normalized_path == "/api":
        normalized_path = "/api/"

    if normalized_path.startswith("/api/"):
        internal_api_base_url = build_site_studio_internal_api_base_url(instance.compose_project_name)
        if not internal_api_base_url:
            raise RuntimeError("Site Studio internal API URL is not configured")
        return f"{internal_api_base_url}{normalized_path.removeprefix('/api')}"

    internal_public_url = build_site_studio_internal_public_url(instance.compose_project_name)
    if not internal_public_url:
        raise RuntimeError("Site Studio internal public URL is not configured")
    suffix = normalized_path if normalized_path != "/" else ""
    return f"{internal_public_url}{suffix}"


def _apply_public_gateway_response_headers(
    response: Response,
    proxied_headers: Iterable[tuple[str, str]],
) -> None:
    for header_name, header_value in proxied_headers:
        if header_name.lower() not in FORWARDED_RESPONSE_HEADERS:
            continue
        response.headers.append(header_name, header_value)


def _normalize_public_gateway_path(path: str) -> str:
    return path if path.startswith("/") else f"/{path}"


def _strip_upstream_conditional_headers(headers: dict[str, str]) -> None:
    for key in list(headers.keys()):
        if key.lower() in _CONDITIONAL_REQUEST_HEADER_NAMES:
            del headers[key]


def _should_strip_conditional_headers_for_path(path: str) -> bool:
    normalized = _normalize_public_gateway_path(path)
    if normalized.startswith("/api/"):
        return False
    return not normalized.startswith("/assets/")


async def _resolve_public_site_instance(
    request: Request,
    db: AsyncSession,
) -> SiteStudioRuntimeInstance | None:
    request_host = normalize_site_studio_request_host(request.headers.get("host"))
    if not request_host:
        return None
    custom_domain_instance = await resolve_domain_binding_instance(db, hostname=request_host)
    if custom_domain_instance is not None:
        return custom_domain_instance
    result = await db.execute(select(UserSiteInstance).where(UserSiteInstance.public_hostname == request_host))
    row = result.scalar_one_or_none()
    if row is not None:
        return row
    result = await db.execute(select(ProjectSiteInstance).where(ProjectSiteInstance.public_hostname == request_host))
    return result.scalar_one_or_none()


async def _handle_public_site_request(
    request: Request,
    db: AsyncSession,
) -> Response:
    path = request.url.path or "/"
    if _is_blocked_public_path(path):
        return Response(status_code=status.HTTP_404_NOT_FOUND, content="Not Found", media_type="text/plain")

    instance = await _resolve_public_site_instance(request, db)
    if instance is None or instance.publication_state != SiteStudioPublicationState.OPEN.value:
        return Response(status_code=status.HTTP_404_NOT_FOUND, content="Not Found", media_type="text/plain")

    try:
        target_url = _build_public_gateway_target_url(instance, path)
    except RuntimeError:
        return Response(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content="Site temporarily unavailable",
            media_type="text/plain",
        )
    raw_body = await request.body()
    client = get_httpx_client()

    gateway_headers = _build_public_gateway_request_headers(request)
    if request.method in {"GET", "HEAD"} and _should_strip_conditional_headers_for_path(path):
        _strip_upstream_conditional_headers(gateway_headers)

    try:
        proxied_response = await client.request(
            request.method,
            target_url,
            content=raw_body if raw_body else None,
            params=dict(request.query_params),
            headers=gateway_headers,
            follow_redirects=False,
        )
    except Exception:
        return Response(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content="Site temporarily unavailable",
            media_type="text/plain",
        )

    out_status = proxied_response.status_code
    out_content = b"" if out_status == 304 else proxied_response.content
    response = Response(content=out_content, status_code=out_status)
    _apply_public_gateway_response_headers(response, proxied_response.headers.multi_items())

    if out_status < 400:
        content_type = proxied_response.headers.get("content-type", "").lower()
        if "text/html" in content_type:
            response.headers["cache-control"] = "no-cache, no-store, must-revalidate"
            response.headers["pragma"] = "no-cache"
            # Parent shell is app.eliteew.ru (or USER_SITE_STUDIO_ADMIN_APP_URL), not *.sites — allow iframe.
            response.headers["Content-Security-Policy"] = f"frame-ancestors 'self' {SITE_STUDIO_ADMIN_APP_URL}"

    return response


@public_site_studio_app.api_route("/", methods=["GET", "HEAD", "OPTIONS"], include_in_schema=False)
async def site_studio_public_root(
    request: Request,
    db: AsyncSession = Depends(get_postgres_session),
) -> Response:
    return await _handle_public_site_request(request, db)


@public_site_studio_app.api_route(
    "/{path:path}",
    methods=["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
async def site_studio_public_catch_all(
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_postgres_session),
) -> Response:
    return await _handle_public_site_request(request, db)
