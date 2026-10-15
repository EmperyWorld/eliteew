# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin API for global web-search runtime settings stored in DB with encrypted secrets.
# Invariants:
# - Plaintext secrets are write-only and never returned by responses.
# - RBAC is enforced through require_admin_user.
# Related:
# - api/services/search_runtime_config_service.py
# - api/routers/desktop_admin.py
# ---

from __future__ import annotations

import logging
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.routers.admin_auth import require_admin_user
from api.services.search_admin_ops_service import (
    AdminTestSearchRequest,
    SearchAdminTestRateLimitError,
    admin_run_test_search,
    build_query_preview,
    build_search_admin_meta,
    list_search_runtime_audit,
    probe_search_providers,
)
from api.services.search_runtime_config_service import (
    SEARCH_PROVIDER_ID,
    SEARCH_SURFACES,
    bootstrap_search_runtime_config_from_env,
    get_search_runtime_admin_payload,
    patch_search_runtime_admin_payload,
    resolve_effective_search_runtime_config,
)
from api.services.web_search_events_service import get_web_search_stats

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/search-config", tags=["desktop-admin-search-config"])


class SearchSurfacesState(BaseModel):
    desktop: bool
    ewa: bool
    marketing: bool
    imperorg: bool
    ugs: bool


class SearchSettingsState(BaseModel):
    provider: Literal["yandex"] = "yandex"
    yandex_search_type: str
    yandex_search_l10n: str
    yandex_search_region: str
    yandex_groups_on_page: int
    cache_enabled: bool = True
    cache_ttl_sec: int = Field(default=300, ge=0, le=3600)
    cache_empty_ttl_sec: int = Field(default=60, ge=0, le=3600)
    quota_enforced: bool
    monthly_free_default: int
    default_limit: int
    surfaces: SearchSurfacesState


class SearchSecretStatusState(BaseModel):
    configured: bool
    configured_in_db: bool
    value_masked: bool


class SearchSecretsState(BaseModel):
    yandex_api_key: SearchSecretStatusState
    yandex_folder_id: SearchSecretStatusState


class SearchConfigResponse(BaseModel):
    settings: SearchSettingsState
    secrets: SearchSecretsState
    source: Literal["db", "env"]
    updated_by: str | None
    updated_at: str | None


class SearchSurfacesPatch(BaseModel):
    desktop: bool | None = None
    ewa: bool | None = None
    marketing: bool | None = None
    imperorg: bool | None = None
    ugs: bool | None = None


class SearchSettingsPatch(BaseModel):
    yandex_search_type: str | None = None
    yandex_search_l10n: str | None = None
    yandex_search_region: str | None = None
    yandex_groups_on_page: int | None = Field(default=None, ge=1, le=20)
    cache_enabled: bool | None = None
    cache_ttl_sec: int | None = Field(default=None, ge=0, le=3600)
    cache_empty_ttl_sec: int | None = Field(default=None, ge=0, le=3600)
    quota_enforced: bool | None = None
    monthly_free_default: int | None = Field(default=None, ge=0, le=10_000)
    default_limit: int | None = Field(default=None, ge=1, le=20)
    surfaces: SearchSurfacesPatch | None = None


class SearchSecretUpdate(BaseModel):
    action: Literal["keep", "set", "rotate", "clear"] = "keep"
    value: str | None = None

    @model_validator(mode="after")
    def _validate_action_payload(self) -> SearchSecretUpdate:
        if self.action in {"set", "rotate"} and not str(self.value or "").strip():
            msg = "value is required for set/rotate actions"
            raise ValueError(msg)
        return self


class SearchSecretsPatch(BaseModel):
    yandex_api_key: SearchSecretUpdate | None = None
    yandex_folder_id: SearchSecretUpdate | None = None


class SearchConfigPatchBody(BaseModel):
    settings: SearchSettingsPatch | None = None
    secrets: SearchSecretsPatch | None = None
    note: str | None = Field(default=None, max_length=400)


class SearchConfigBootstrapBody(BaseModel):
    force: bool = False
    note: str | None = Field(default=None, max_length=400)


class SearchEffectiveResponse(BaseModel):
    surface: Literal["desktop", "ewa", "marketing", "imperorg", "ugs"] | None
    surface_enabled: bool
    source: Literal["db", "env"]
    provider: Literal["yandex"] = "yandex"
    quota_enforced: bool
    monthly_free_default: int
    default_limit: int
    cache_enabled: bool
    yandex_search_configured: bool
    yandex_folder_configured: bool
    updated_by: str | None
    updated_at: str | None


def _to_response(payload: dict) -> SearchConfigResponse:
    return SearchConfigResponse.model_validate(payload)


@router.get("/config", response_model=SearchConfigResponse)
async def get_search_runtime_config(
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> SearchConfigResponse:
    _ = admin
    payload = await get_search_runtime_admin_payload(db)
    return _to_response(payload)


@router.patch("/config", response_model=SearchConfigResponse)
async def patch_search_runtime_config(
    body: SearchConfigPatchBody,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> SearchConfigResponse:
    settings_patch = body.settings.model_dump(exclude_unset=True) if body.settings else None
    if settings_patch and isinstance(settings_patch.get("surfaces"), dict):
        settings_patch["surfaces"] = {
            key: value for key, value in settings_patch["surfaces"].items() if value is not None
        }
    secrets_patch = body.secrets.model_dump(exclude_unset=True) if body.secrets else None
    payload = await patch_search_runtime_admin_payload(
        db,
        actor_user_id=admin.id,
        settings_patch=settings_patch,
        secret_updates=secrets_patch,
        audit_note=body.note,
    )
    logger.info(
        "[STEP] search.admin_config_patch actor=%s settings_keys=%s secret_keys=%s",
        admin.id,
        sorted((settings_patch or {}).keys()),
        sorted((secrets_patch or {}).keys()),
    )
    return _to_response(payload)


@router.post("/config/bootstrap-env", response_model=SearchConfigResponse)
async def bootstrap_search_runtime_from_env(
    body: SearchConfigBootstrapBody,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> SearchConfigResponse:
    payload = await bootstrap_search_runtime_config_from_env(
        db,
        actor_user_id=admin.id,
        force=body.force,
        audit_note=body.note,
    )
    logger.info(
        "[STEP] search.admin_config_bootstrap_env actor=%s force=%s",
        admin.id,
        body.force,
    )
    return _to_response(payload)


@router.get("/effective", response_model=SearchEffectiveResponse)
async def get_search_runtime_effective(
    surface: Literal["desktop", "ewa", "marketing", "imperorg", "ugs"] | None = Query(default=None),
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> SearchEffectiveResponse:
    _ = admin
    safe_surface = surface if surface in SEARCH_SURFACES else None
    runtime = await resolve_effective_search_runtime_config(db, surface=safe_surface)
    return SearchEffectiveResponse(
        surface=safe_surface,
        surface_enabled=runtime.surface_enabled,
        source=runtime.source,  # type: ignore[arg-type]
        provider=SEARCH_PROVIDER_ID,  # type: ignore[arg-type]
        quota_enforced=runtime.quota_enforced,
        monthly_free_default=runtime.monthly_free_default,
        default_limit=runtime.default_limit,
        cache_enabled=runtime.cache_enabled,
        yandex_search_configured=bool(runtime.yandex_api_key.strip()),
        yandex_folder_configured=bool(runtime.yandex_folder_id.strip()),
        updated_by=runtime.updated_by,
        updated_at=runtime.updated_at_iso,
    )


class SearchMetaSurface(BaseModel):
    id: Literal["desktop", "ewa", "marketing", "imperorg", "ugs"]
    enabled: bool
    resolved_provider: str | None
    source: Literal["db", "env"]
    blockers: list[str]


class SearchMetaProviderYandex(BaseModel):
    api_key_configured: bool
    folder_configured: bool
    credentials_ready: bool


class SearchMetaCache(BaseModel):
    enabled: bool
    ttl_sec: int
    empty_ttl_sec: int


class SearchMetaHealth(BaseModel):
    last_success_at: str | None
    error_streak: int
    errors_last_hour: int
    probe_recommended: bool


class SearchMetaProviders(BaseModel):
    yandex: SearchMetaProviderYandex


class SearchMetaQuota(BaseModel):
    enforced: bool
    monthly_free_default: int
    default_limit: int


class SearchMetaCapabilities(BaseModel):
    test_search: bool
    probe: bool
    audit: bool
    stats: bool


class SearchMetaResponse(BaseModel):
    config_source: Literal["db", "env"]
    updated_by: str | None
    updated_at: str | None
    provider: Literal["yandex"]
    resolved_provider: str | None
    providers: SearchMetaProviders
    cache: SearchMetaCache
    quota: SearchMetaQuota
    health: SearchMetaHealth
    surfaces: list[SearchMetaSurface]
    capabilities: SearchMetaCapabilities


class SearchProbeBody(BaseModel):
    smoke_query: str | None = Field(default=None, max_length=200)


class SearchProbeResult(BaseModel):
    target: str
    ok: bool
    latency_ms: int
    http_status: int | None
    error_code: str | None
    message: str
    hit_count: int = 0


class SearchProbeResponse(BaseModel):
    smoke_query: str
    results: list[SearchProbeResult]


class SearchTestSearchBody(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    surface: Literal["desktop", "ewa", "marketing", "imperorg", "ugs"] | None = None
    limit: int = Field(default=8, ge=1, le=20)
    consume_quota: bool = False
    simulate_chat_query: bool = True
    preview_only: bool = False
    user_id: UUID | None = None

    @model_validator(mode="after")
    def _validate_quota_user(self) -> SearchTestSearchBody:
        if self.consume_quota and self.user_id is None:
            msg = "user_id is required when consume_quota is true"
            raise ValueError(msg)
        return self


class SearchHitRow(BaseModel):
    title: str
    content: str
    url: str


class SearchTestSearchResponse(BaseModel):
    status: Literal["ok", "blocked", "empty", "error"]
    blockers: list[str]
    surface: Literal["desktop", "ewa", "marketing", "imperorg", "ugs"] | None
    provider: str | None
    query_original: str
    query_effective: str
    latency_ms: int
    hits: list[SearchHitRow]
    prompt_preview: str
    quota: dict[str, int | str] | None


class SearchAuditItem(BaseModel):
    id: str
    actor_user_id: str | None
    action: str
    note: str | None
    created_at: str | None
    settings_changed: list[str]
    secrets_changed: list[str]
    before_settings: dict
    after_settings: dict
    before_secrets_status: dict
    after_secrets_status: dict


class SearchAuditListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[SearchAuditItem]


class SearchStatsSurfaceRow(BaseModel):
    surface: str
    total: int


class SearchStatsResponse(BaseModel):
    period: Literal["24h", "7d"]
    since: str
    total: int
    ok: int
    empty: int
    error: int
    blocked: int
    quota_denied: int
    empty_rate: float
    error_rate: float
    cache_hits: int
    cache_hit_rate: float
    latency_ms_p50: int
    latency_ms_p95: int
    by_surface: list[SearchStatsSurfaceRow]


class SearchQueryPreviewBody(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    simulate_chat_query: bool = True


class SearchQueryPreviewResponse(BaseModel):
    query_original: str
    query_effective: str


@router.get("/meta")
async def get_search_admin_meta(
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> SearchMetaResponse:
    _ = admin
    payload = await build_search_admin_meta(db)
    return SearchMetaResponse.model_validate(payload)


@router.post("/probe", response_model=SearchProbeResponse)
async def post_search_admin_probe(
    body: SearchProbeBody,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> SearchProbeResponse:
    _ = admin
    payload = await probe_search_providers(
        db,
        smoke_query=body.smoke_query,
    )
    logger.info("[STEP] search.admin_probe actor=%s", admin.id)
    return SearchProbeResponse.model_validate(payload)


@router.post("/test-search", response_model=SearchTestSearchResponse)
async def post_search_admin_test_search(
    body: SearchTestSearchBody,
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> SearchTestSearchResponse:
    try:
        payload = await admin_run_test_search(
            db,
            actor_user_id=admin.id,
            request=AdminTestSearchRequest(
                query=body.query,
                surface=body.surface,
                limit=body.limit,
                consume_quota=body.consume_quota,
                simulate_chat_query=body.simulate_chat_query,
                user_id=body.user_id,
                preview_only=body.preview_only,
            ),
        )
    except SearchAdminTestRateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded; retry after {int(exc.retry_after)}s",
            headers={"Retry-After": str(int(exc.retry_after))},
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return SearchTestSearchResponse.model_validate(payload)


@router.get("/audit", response_model=SearchAuditListResponse)
async def get_search_admin_audit(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    actor_user_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> SearchAuditListResponse:
    _ = admin
    payload = await list_search_runtime_audit(
        db,
        limit=limit,
        offset=offset,
        actor_user_id=actor_user_id,
    )
    return SearchAuditListResponse.model_validate(payload)


@router.get("/stats", response_model=SearchStatsResponse)
async def get_search_admin_stats(
    period: Literal["24h", "7d"] = Query(default="24h"),
    db: AsyncSession = Depends(get_postgres_session),
    admin: AuthUser = Depends(require_admin_user),
) -> SearchStatsResponse:
    _ = admin
    payload = await get_web_search_stats(db, period=period)
    return SearchStatsResponse.model_validate(payload)


@router.post("/query-preview", response_model=SearchQueryPreviewResponse)
async def post_search_query_preview(
    body: SearchQueryPreviewBody,
    admin: AuthUser = Depends(require_admin_user),
) -> SearchQueryPreviewResponse:
    _ = admin
    preview = build_query_preview(body.query, simulate_chat_query=body.simulate_chat_query)
    return SearchQueryPreviewResponse.model_validate(preview)
