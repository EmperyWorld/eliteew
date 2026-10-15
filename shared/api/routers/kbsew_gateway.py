# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stack0 gateway proxy for KBSEW microservice management API (barrels, search, ready).
# Typed response_model Out schemas for OpenAPI SSOT; admin search honors retrieval_mode.
# Invariants:
# - Admin auth enforced at gateway; Authorization forwarded to KBSEW.
# - Client-supplied X-KBSEW-Service-Token is never forwarded (strip); server injects token only in kbsew_client.
# - GET /api/v1/kbsew/ready proxies to KBSEW root GET /ready (not /api/v1/kbsew/ready).
# - Upstream non-2xx (including 404) is returned as-is for FE graceful degrade.
# - Force-reindex paths: POST …/reindex and …/assets/{id}/reindex.
# - Multipart ingest/upload stays raw Response; success shape documented via responses=.
# Related:
# - KBSEW/api/main.py
# - api/schemas/kbsew_gateway.py
# - api/services/kbsew/kbsew_client.py
# - documentation/product/KBSEW.md
# - documentation/api/FRONTEND-BACKEND-HTTP.md
# ---

from __future__ import annotations

import json
import logging
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.database_manager import get_postgres_session
from api.routers.admin_auth import require_admin_user
from api.schemas.kbsew_gateway import (
    AdminKbsewSearchBody,
    AdminKbsewSearchOut,
    KbsewBarrelCreateIn,
    KbsewBarrelOut,
    KbsewBarrelStatusOut,
    KbsewDriversOut,
    KbsewForceReindexAssetOut,
    KbsewForceReindexBarrelOut,
    KbsewIngestIn,
    KbsewIngestOut,
    KbsewReadyOut,
)
from api.services.desktop_chat.kbsew_search_settings import resolve_kbsew_search_settings
from api.services.desktop_chat.service import fetch_config_defaults
from api.services.kbsew.kbsew_client import (
    KbsewBarrelDisabledError,
    KbsewClientError,
    KbsewIndexStaleError,
    KbsewNotFoundError,
)
from api.services.kbsew.kbsew_retrieval import kbsew_search_with_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/kbsew", tags=["KBSEW Gateway"])

KBSEW_SERVICE_URL = os.getenv("KBSEW_SERVICE_URL", "http://stack-kbsew:8030").rstrip("/")
_TIMEOUT = 120.0

_INGEST_UPLOAD_RESPONSES = {
    200: {
        "description": "Queued ingest job (mirrors KbsewIngestOut)",
        "model": KbsewIngestOut,
    },
}


def _forward_headers(request: Request) -> dict[str, str]:
    """Forward Authorization only. Never forward client X-KBSEW-Service-Token."""
    headers: dict[str, str] = {}
    auth = request.headers.get("authorization")
    if auth:
        headers["authorization"] = auth
    if request.headers.get("x-kbsew-service-token"):
        logger.warning(
            "[STEP] kbsew_gateway_strip_client_service_token path=%s",
            request.url.path,
        )
    content_type = request.headers.get("content-type")
    if content_type:
        headers["content-type"] = content_type
    accept = request.headers.get("accept")
    if accept:
        headers["accept"] = accept
    return headers


async def _proxy_url(request: Request, target: str) -> Response:
    body = await request.body()
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            proxied = await client.request(
                request.method,
                target,
                content=body if body else None,
                params=dict(request.query_params),
                headers=_forward_headers(request),
            )
    except httpx.HTTPError as exc:
        logger.warning("[STEP] kbsew_gateway_upstream_fail url=%s reason=%s", target, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="KBSEW service unavailable",
        ) from exc

    response_headers: dict[str, str] = {}
    for header_name in ("content-type",):
        value = proxied.headers.get(header_name)
        if value:
            response_headers[header_name] = value
    return Response(
        content=proxied.content,
        status_code=proxied.status_code,
        headers=response_headers,
        media_type=proxied.headers.get("content-type"),
    )


async def _proxy(request: Request, subpath: str) -> Response:
    target = f"{KBSEW_SERVICE_URL}/api/v1/kbsew/{subpath.lstrip('/')}"
    return await _proxy_url(request, target)


def _validate_upstream_json[TModel: BaseModel](data: object, model: type[TModel], *, path: str) -> TModel:
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        logger.warning(
            "[STEP] kbsew_gateway_schema_mismatch path=%s reason=%s",
            path,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="KBSEW response schema mismatch",
        ) from exc


def _parse_2xx_json(proxied: Response, *, path: str) -> object | Response:
    """Return parsed JSON on 2xx; otherwise passthrough Response (404-as-is, etc.)."""
    if not (200 <= proxied.status_code < 300):
        return proxied
    try:
        return json.loads(proxied.body)
    except json.JSONDecodeError as exc:
        logger.warning("[STEP] kbsew_gateway_invalid_json path=%s reason=%s", path, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="KBSEW returned invalid JSON",
        ) from exc


async def _proxy_as_model[TModel: BaseModel](
    request: Request,
    subpath: str,
    model: type[TModel],
) -> TModel | Response:
    proxied = await _proxy(request, subpath)
    parsed = _parse_2xx_json(proxied, path=request.url.path)
    if isinstance(parsed, Response):
        return parsed
    return _validate_upstream_json(parsed, model, path=request.url.path)


async def _proxy_as_model_list[TModel: BaseModel](
    request: Request,
    subpath: str,
    model: type[TModel],
) -> list[TModel] | Response:
    proxied = await _proxy(request, subpath)
    parsed = _parse_2xx_json(proxied, path=request.url.path)
    if isinstance(parsed, Response):
        return parsed
    if not isinstance(parsed, list):
        logger.warning(
            "[STEP] kbsew_gateway_schema_mismatch path=%s reason=expected_list",
            request.url.path,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="KBSEW response schema mismatch",
        )
    return [_validate_upstream_json(item, model, path=request.url.path) for item in parsed]


async def _proxy_json_model[TModel: BaseModel](
    request: Request,
    subpath: str,
    *,
    method: str,
    payload: dict[str, object] | None,
    model: type[TModel],
) -> TModel | Response:
    """POST/PATCH JSON to upstream, validate 2xx body as model; passthrough non-2xx."""
    target = f"{KBSEW_SERVICE_URL}/api/v1/kbsew/{subpath.lstrip('/')}"
    headers = _forward_headers(request)
    headers.pop("content-type", None)
    if payload is not None:
        headers["content-type"] = "application/json"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            proxied = await client.request(
                method,
                target,
                json=payload,
                params=dict(request.query_params),
                headers=headers,
            )
    except httpx.HTTPError as exc:
        logger.warning("[STEP] kbsew_gateway_upstream_fail url=%s reason=%s", target, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="KBSEW service unavailable",
        ) from exc
    passthrough = Response(
        content=proxied.content,
        status_code=proxied.status_code,
        media_type=proxied.headers.get("content-type"),
    )
    parsed = _parse_2xx_json(passthrough, path=request.url.path)
    if isinstance(parsed, Response):
        return parsed
    return _validate_upstream_json(parsed, model, path=request.url.path)


@router.get(
    "/drivers",
    response_model=KbsewDriversOut,
    operation_id="proxy_kbsew_drivers",
)
async def proxy_drivers(
    request: Request,
    _admin=Depends(require_admin_user),
) -> KbsewDriversOut | Response:
    return await _proxy_as_model(request, "drivers", KbsewDriversOut)


@router.get(
    "/ready",
    response_model=KbsewReadyOut,
    operation_id="proxy_kbsew_ready",
)
async def proxy_ready(
    request: Request,
    _admin=Depends(require_admin_user),
) -> KbsewReadyOut | Response:
    """Proxy KBSEW readiness. Service exposes root GET /ready (ops/liveness sibling of /health)."""
    proxied = await _proxy_url(request, f"{KBSEW_SERVICE_URL}/ready")
    parsed = _parse_2xx_json(proxied, path=request.url.path)
    if isinstance(parsed, Response):
        return parsed
    return _validate_upstream_json(parsed, KbsewReadyOut, path=request.url.path)


@router.get(
    "/barrels",
    response_model=list[KbsewBarrelOut],
    operation_id="proxy_kbsew_barrels_list",
)
async def proxy_barrels_list(
    request: Request,
    _admin=Depends(require_admin_user),
) -> list[KbsewBarrelOut] | Response:
    return await _proxy_as_model_list(request, "barrels", KbsewBarrelOut)


@router.post(
    "/barrels",
    response_model=KbsewBarrelOut,
    operation_id="proxy_kbsew_barrels_create",
)
async def proxy_barrels_create(
    body: KbsewBarrelCreateIn,
    request: Request,
    _admin=Depends(require_admin_user),
) -> KbsewBarrelOut | Response:
    return await _proxy_json_model(
        request,
        "barrels",
        method="POST",
        payload=body.model_dump(mode="json"),
        model=KbsewBarrelOut,
    )


@router.delete(
    "/barrels/{barrel_id}",
    operation_id="proxy_kbsew_barrel_delete",
)
async def proxy_barrel_delete(
    barrel_id: str,
    request: Request,
    _admin=Depends(require_admin_user),
) -> Response:
    return await _proxy(request, f"barrels/{barrel_id}")


@router.patch(
    "/barrels/{barrel_id}/enabled",
    response_model=KbsewBarrelOut,
    operation_id="proxy_kbsew_barrel_enabled",
)
async def proxy_barrel_enabled(
    barrel_id: str,
    request: Request,
    _admin=Depends(require_admin_user),
) -> KbsewBarrelOut | Response:
    return await _proxy_as_model(request, f"barrels/{barrel_id}/enabled", KbsewBarrelOut)


@router.post(
    "/barrels/{barrel_id}/ingest",
    response_model=KbsewIngestOut,
    operation_id="proxy_kbsew_barrel_ingest",
)
async def proxy_barrel_ingest(
    barrel_id: str,
    body: KbsewIngestIn,
    request: Request,
    _admin=Depends(require_admin_user),
) -> KbsewIngestOut | Response:
    return await _proxy_json_model(
        request,
        f"barrels/{barrel_id}/ingest",
        method="POST",
        payload=body.model_dump(mode="json"),
        model=KbsewIngestOut,
    )


@router.post(
    "/barrels/{barrel_id}/ingest/upload",
    operation_id="proxy_kbsew_barrel_ingest_upload",
    responses=_INGEST_UPLOAD_RESPONSES,
)
async def proxy_barrel_ingest_upload(
    barrel_id: str,
    request: Request,
    _admin=Depends(require_admin_user),
) -> Response:
    """Multipart upload — raw proxy; success body matches KbsewIngestOut when 2xx."""
    return await _proxy(request, f"barrels/{barrel_id}/ingest/upload")


@router.get(
    "/barrels/{barrel_id}/status",
    response_model=KbsewBarrelStatusOut,
    operation_id="proxy_kbsew_barrel_status",
)
async def proxy_barrel_status(
    barrel_id: str,
    request: Request,
    _admin=Depends(require_admin_user),
) -> KbsewBarrelStatusOut | Response:
    return await _proxy_as_model(request, f"barrels/{barrel_id}/status", KbsewBarrelStatusOut)


@router.post(
    "/barrels/{barrel_id}/reindex",
    response_model=KbsewForceReindexBarrelOut,
    operation_id="proxy_kbsew_barrel_reindex",
)
async def proxy_barrel_reindex(
    barrel_id: str,
    request: Request,
    _admin=Depends(require_admin_user),
) -> KbsewForceReindexBarrelOut | Response:
    return await _proxy_as_model(request, f"barrels/{barrel_id}/reindex", KbsewForceReindexBarrelOut)


@router.post(
    "/barrels/{barrel_id}/assets/{asset_id}/reindex",
    response_model=KbsewForceReindexAssetOut,
    operation_id="proxy_kbsew_asset_reindex",
)
async def proxy_asset_reindex(
    barrel_id: str,
    asset_id: str,
    request: Request,
    _admin=Depends(require_admin_user),
) -> KbsewForceReindexAssetOut | Response:
    return await _proxy_as_model(
        request,
        f"barrels/{barrel_id}/assets/{asset_id}/reindex",
        KbsewForceReindexAssetOut,
    )


@router.post(
    "/search",
    response_model=AdminKbsewSearchOut,
    operation_id="admin_kbsew_search",
)
async def admin_kbsew_search(
    body: AdminKbsewSearchBody,
    request: Request,
    db: AsyncSession = Depends(get_postgres_session),
    _admin=Depends(require_admin_user),
) -> AdminKbsewSearchOut | Response:
    if not body.apply_admin_settings:
        target = f"{KBSEW_SERVICE_URL}/api/v1/kbsew/search"
        payload = body.model_dump(mode="json")
        headers = _forward_headers(request)
        # Re-posted JSON — drop client content-type; set application/json.
        headers.pop("content-type", None)
        headers["content-type"] = "application/json"
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                proxied = await client.post(
                    target,
                    json=payload,
                    headers=headers,
                )
        except httpx.HTTPError as exc:
            logger.warning("[STEP] kbsew_gateway_upstream_fail url=%s reason=%s", target, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="KBSEW service unavailable",
            ) from exc
        error_passthrough = Response(
            content=proxied.content,
            status_code=proxied.status_code,
            media_type=proxied.headers.get("content-type"),
        )
        parsed = _parse_2xx_json(error_passthrough, path=request.url.path)
        if isinstance(parsed, Response):
            return parsed
        return _validate_upstream_json(parsed, AdminKbsewSearchOut, path=request.url.path)

    defaults = await fetch_config_defaults(db)
    settings = resolve_kbsew_search_settings(defaults)
    if body.limit is not None:
        settings = settings.model_copy(update={"chunks_per_barrel": body.limit})
    if body.retrieval_mode is not None:
        settings = settings.model_copy(update={"retrieval_mode": body.retrieval_mode})

    try:
        chunks = await kbsew_search_with_settings(
            query=body.query,
            barrel_id=str(body.barrel_id),
            settings=settings,
            retrieval_mode=body.retrieval_mode,
            authorization=request.headers.get("authorization"),
        )
    except KbsewNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except KbsewIndexStaleError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "index_stale",
                "message": str(exc),
                "stale_assets": exc.stale_assets,
                "required_pipeline": exc.required_pipeline,
            },
        ) from exc
    except KbsewBarrelDisabledError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except KbsewClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return AdminKbsewSearchOut(barrel_id=body.barrel_id, chunks=chunks)
