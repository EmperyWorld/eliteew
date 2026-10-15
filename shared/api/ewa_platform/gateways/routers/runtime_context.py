# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Authenticated HTTP read-side for **EWA Runtime Gateway**: server-derived context snapshot and paginated content
# inventory for EWA companion, orchestration, and desktop UI consumers.
# Invariants:
# - Principal/content scope comes only from OAuth + ``get_current_user_db_id`` dependencies.
# - Content inventory is capped at 200 rows per page and returns total/truncation metadata.
# Related:
# - api/ewa_platform/schemas/pydantic/runtime_context.py
# - api/ewa_platform/gateways/runtime_gateway/runtime_context.py
# ---
"""EWA Runtime Gateway context router."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.dependencies.user_context import get_current_user_db_id
from api.ewa_platform.gateways.runtime_gateway.catalog_preferences import catalog_preferences_from_profile
from api.ewa_platform.gateways.runtime_gateway.runtime_context import (
    build_runtime_content_page,
    build_runtime_context,
    normalize_catalog_filters,
)
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.schemas.pydantic.runtime_context import (
    EwaRuntimeContentPageOut,
    EwaRuntimeContextOut,
    EwaRuntimeSearchScope,
)
from api.routers.unified_content import get_content_query_service
from api.schemas.unified_content import ContentType, Visibility
from api.services.unified_content.content_query_service import ContentQueryService

router = APIRouter(tags=["EWA - Runtime Gateway"])


def _pool(request: Request) -> Any | None:
    return getattr(request.app.state, "ewa_orchestration_pool", None)


@router.get(
    "/runtime-context",
    response_model=EwaRuntimeContextOut,
    operation_id="ewa_runtime_context_get",
    summary="EWA runtime context: authenticated user snapshot + first content page",
)
async def get_ewa_runtime_context(
    request: Request,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str | None = Query(None, max_length=500),
    search_scope: EwaRuntimeSearchScope = Query("metadata"),
    content_type: list[str] | None = Query(None),
    mime_group: list[str] | None = Query(None),
    extension_include: list[str] | None = Query(None),
    extension_exclude: list[str] | None = Query(None),
    include_audio: bool | None = Query(None),
    exclude_audio: bool | None = Query(None),
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
    content_user_id: str = Depends(get_current_user_db_id),  # noqa: B008
    query_svc: ContentQueryService = Depends(get_content_query_service),  # noqa: B008
) -> EwaRuntimeContextOut:
    """Return EWA's server-derived read context for the current user."""

    return await build_runtime_context(
        auth_user=auth_user,
        content_user_id=content_user_id,
        query_svc=query_svc,
        companion_pool=_pool(request),
        content_offset=offset,
        content_limit=limit,
        content_search=search,
        content_search_scope=search_scope,
        filters=normalize_catalog_filters(
            content_types=content_type,
            mime_groups=mime_group,
            extension_include=extension_include,
            extension_exclude=extension_exclude,
            include_audio=include_audio,
            exclude_audio=exclude_audio,
        ),
    )


@router.get(
    "/runtime-context/content",
    response_model=EwaRuntimeContentPageOut,
    operation_id="ewa_runtime_context_content_get",
    summary="EWA runtime context: paginated Unified Content inventory",
)
async def get_ewa_runtime_context_content(
    request: Request,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str | None = Query(None, max_length=500),
    search_scope: EwaRuntimeSearchScope = Query("metadata"),
    content_type: ContentType | None = Query(None),
    content_types: list[str] | None = Query(None),
    mime_group: list[str] | None = Query(None),
    extension_include: list[str] | None = Query(None),
    extension_exclude: list[str] | None = Query(None),
    include_audio: bool | None = Query(None),
    exclude_audio: bool | None = Query(None),
    visibility: Visibility | None = Query(None),
    sort_field: str | None = Query(None, max_length=32),
    sort_order: str | None = Query(None, max_length=8),
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
    content_user_id: str = Depends(get_current_user_db_id),  # noqa: B008
    query_svc: ContentQueryService = Depends(get_content_query_service),  # noqa: B008
) -> EwaRuntimeContentPageOut:
    """Return a single, honest page of EWA-visible content inventory."""

    pool = _pool(request)
    profile = (
        await companion_pg.companion_profile_fetch(pool, principal_id=str(auth_user.id)) if pool is not None else None
    )
    prefs = catalog_preferences_from_profile(profile)
    requested_content_types = list(content_types or [])
    if content_type is not None:
        requested_content_types.append(content_type.value)
    return await build_runtime_content_page(
        query_svc,
        content_user_id=content_user_id,
        oauth2_sub=str(auth_user.id),
        visibility=visibility,
        search_query=search,
        search_scope=search_scope,
        offset=offset,
        limit=limit,
        sort_field=sort_field,
        sort_order=sort_order,
        filters=normalize_catalog_filters(
            content_types=requested_content_types,
            mime_groups=mime_group,
            extension_include=extension_include,
            extension_exclude=extension_exclude,
            include_audio=include_audio,
            exclude_audio=exclude_audio,
            preferences=prefs,
        ),
        preferences=prefs,
    )
