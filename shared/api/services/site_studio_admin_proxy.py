# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared authenticated admin-proxy implementation for personal Site Studio and KIRS project sites.
# Deduplicates runtime admin login, token refresh, password sync, and proxied response shaping.
# Invariants:
# - This module never authorizes a user; routers must validate owner/project/client access before calling it.
# - Direct `/admin/login` remains blocked; callers must use the Desktop admin-session bridge.
# Related:
# - api/routers/desktop_sites.py
# - api/routers/kirs.py
# - api/routers/site_studio_public.py
# ---
from __future__ import annotations

import json
from typing import Any

import httpx  # type: ignore[import-not-found]
from fastapi import HTTPException, Request, Response, status  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.site_studio_runtime_service import (
    SiteStudioRuntimeInstance,
    build_site_studio_internal_api_base_url,
    encrypt_site_studio_secret,
    get_site_studio_runtime_manager,
    rewrite_site_studio_internal_url,
)


def _build_admin_proxy_headers(request: Request, *, site_admin_token: str) -> dict[str, str]:
    headers: dict[str, str] = {}
    for header_name in ("content-type", "accept"):
        value = request.headers.get(header_name)
        if value:
            headers[header_name] = value
    headers["authorization"] = f"Bearer {site_admin_token}"
    return headers


def _build_admin_proxy_response_headers(proxied_response: httpx.Response) -> dict[str, str]:
    response_headers: dict[str, str] = {}
    for header_name in ("content-type", "content-disposition", "cache-control"):
        header_value = proxied_response.headers.get(header_name)
        if header_value:
            response_headers[header_name] = header_value
    return response_headers


async def proxy_site_studio_admin_request(
    *,
    instance: SiteStudioRuntimeInstance,
    path: str,
    request: Request,
    db: AsyncSession,
) -> Response:
    if not instance.api_base_url:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Site runtime API URL is not configured",
        )

    clean_path = "/" + path.lstrip("/")
    if clean_path == "/admin/login":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Use proxied admin-session endpoint instead of direct admin login",
        )

    runtime_manager = get_site_studio_runtime_manager()
    try:
        site_admin_token = await runtime_manager.login_admin(instance)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to authenticate against site runtime: {exc}",
        ) from exc

    raw_body = await request.body()
    internal_api_base_url = (
        build_site_studio_internal_api_base_url(instance.compose_project_name)
        or rewrite_site_studio_internal_url(instance.api_base_url)
        or instance.api_base_url
    )
    target_url = f"{internal_api_base_url}{clean_path}"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            proxied_response = await client.request(
                request.method,
                target_url,
                content=raw_body if raw_body else None,
                params=dict(request.query_params),
                headers=_build_admin_proxy_headers(request, site_admin_token=site_admin_token),
            )
            if proxied_response.status_code in {401, 403}:
                site_admin_token = await runtime_manager.login_admin(instance, force_refresh=True)
                proxied_response = await client.request(
                    request.method,
                    target_url,
                    content=raw_body if raw_body else None,
                    params=dict(request.query_params),
                    headers=_build_admin_proxy_headers(request, site_admin_token=site_admin_token),
                )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Proxy request failed: {exc}") from exc

    if clean_path == "/auth/change-password" and proxied_response.status_code < 400:
        try:
            payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except Exception:  # noqa: BLE001
            payload = {}
        new_password = str(payload.get("newPassword") or "").strip()
        if new_password:
            inst_mut: Any = instance
            inst_mut.admin_password_encrypted = encrypt_site_studio_secret(new_password)
            runtime_manager.invalidate_admin_token(instance)
            await db.commit()

    return Response(
        content=proxied_response.content,
        status_code=proxied_response.status_code,
        headers=_build_admin_proxy_response_headers(proxied_response),
    )
