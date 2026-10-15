# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Operator API for Site Manager operations across personal Site Studio and KIRS project sites.
# Aggregates lifecycle diagnostics/repair, domain DNS/TLS workflow, runtime reconcile, template registry and smoke checks.
# Invariants:
# - All endpoints require app admin privileges; public storefront hosts never expose this router.
# - Repair/apply endpoints are explicit operator actions; read endpoints do not mutate runtime state.
# Related:
# - api/services/site_manager_ops.py
# - api/routers/desktop_sites.py
# - api/routers/kirs.py
# ---
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status  # type: ignore[import-untyped]
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.routers.desktop_admin import require_admin_user
from api.services import site_manager_ops

router = APIRouter(prefix="/desktop/site-manager/ops", tags=["desktop-site-manager-ops"])


class SiteManagerOpsWorkerResponse(BaseModel):
    worker_ready: bool = False
    worker_id: str | None = None
    worker_last_seen_at: datetime | None = None
    worker_last_seen_age_seconds: int | None = None
    worker_ready_window_seconds: int | None = None


class SiteManagerOpsLifecycleJobResponse(BaseModel):
    id: UUID
    instance_scope: str
    instance_id: UUID
    site_slug: str | None = None
    task_type: str
    status: str
    stage: str | None = None
    queued: bool = False
    worker_id: str | None = None
    attempts: int = 0
    last_error: str | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    queued_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    updated_at: datetime
    duration_ms: int | None = None


class SiteManagerOpsDomainBindingResponse(BaseModel):
    id: UUID
    instance_scope: str
    instance_id: UUID
    hostname: str
    status: str
    verification_method: str
    verification_name: str
    verification_token_preview: str
    expected_cname: str | None = None
    verified_at: datetime | None = None
    last_checked_at: datetime | None = None
    route_ready_at: datetime | None = None
    tls_status: str
    last_error: str | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class SiteManagerOpsDnsOutboxResponse(BaseModel):
    id: UUID
    binding_id: UUID
    hostname: str
    target_hostname: str
    status: str
    requested_at: datetime
    applied_at: datetime | None = None
    last_error: str | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class SiteManagerOpsRuntimeInstanceResponse(BaseModel):
    instance_scope: str
    id: UUID
    site_slug: str
    site_title: str
    status: str
    publication_state: str
    public_hostname: str
    public_url: str | None = None
    api_base_url: str | None = None
    compose_project_name: str | None = None
    runtime_dir: str | None = None
    source_dir: str | None = None
    env_dir: str | None = None
    compose_file_path: str | None = None
    updated_at: datetime
    last_error: str | None = None
    marketing_project_id: UUID | None = None
    client_access_json: dict[str, Any] = Field(default_factory=dict)


class SiteManagerOpsRepairInstanceResponse(BaseModel):
    id: UUID
    site_slug: str
    status: str
    publication_state: str
    public_hostname: str
    last_error: str | None = None
    updated_at: datetime


class SiteManagerOpsActionResponse(BaseModel):
    status: str
    queued: bool
    detail: str
    job_id: UUID | None = None
    worker_ready: bool | None = None


class SiteManagerOpsReconcileIssueResponse(BaseModel):
    code: str
    severity: str
    next_action: str
    message: str
    age_seconds: int | None = None
    path: str | None = None
    compose_project_name: str | None = None


class SiteManagerOpsReconcileEntryResponse(BaseModel):
    instance: SiteManagerOpsRuntimeInstanceResponse
    issues: list[SiteManagerOpsReconcileIssueResponse]


class SiteManagerOpsReconcileReportResponse(BaseModel):
    entries: list[SiteManagerOpsReconcileEntryResponse]
    count: int
    generated_at: datetime


class SiteManagerOpsAuditEventResponse(BaseModel):
    id: UUID
    actor_user_id: UUID | None = None
    action: str
    target_type: str
    target_id: str | None = None
    before_json: dict[str, Any] | None = None
    after_json: dict[str, Any] | None = None
    result_json: dict[str, Any] | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class SiteManagerOpsOverviewLimitResponse(BaseModel):
    limit: int
    returned: int
    truncated: bool = False


class SiteManagerOpsOverviewResponse(BaseModel):
    worker: SiteManagerOpsWorkerResponse
    jobs: list[SiteManagerOpsLifecycleJobResponse]
    domains: list[SiteManagerOpsDomainBindingResponse]
    dns_outbox: list[SiteManagerOpsDnsOutboxResponse]
    instances: list[SiteManagerOpsRuntimeInstanceResponse]
    reconcile: SiteManagerOpsReconcileReportResponse
    audit_events: list[SiteManagerOpsAuditEventResponse] = Field(default_factory=list)
    overview_limits: dict[str, SiteManagerOpsOverviewLimitResponse] = Field(default_factory=dict)
    generated_at: datetime


class SiteManagerOpsRuntimeInstancesPageResponse(BaseModel):
    items: list[SiteManagerOpsRuntimeInstanceResponse]
    limit: int
    offset: int
    returned: int
    has_more: bool = False


class SiteManagerOpsDnsPreviewRecord(BaseModel):
    outbox_id: UUID
    hostname: str
    target_hostname: str
    record: str


class SiteManagerOpsDnsPreviewResponse(BaseModel):
    mode: Literal["dry_run"]
    records: list[SiteManagerOpsDnsPreviewRecord]
    count: int


class SiteManagerOpsTlsReadyBody(BaseModel):
    certificate_summary: str | None = Field(default=None, max_length=500)


class SiteManagerOpsRepairFailedBody(BaseModel):
    reason: str = Field(default="Marked failed by Site Manager operator reconcile action", max_length=2000)


class SiteManagerOpsSmokeBody(BaseModel):
    instance_scope: Literal["user", "project"] = "user"
    instance_id: UUID
    run_live: bool = False


class SiteManagerOpsKirsCollaborationBody(BaseModel):
    readiness_status: Literal["preparing", "ready_for_review", "published", "paused"] | None = None
    approval_status: Literal["not_requested", "requested", "approved", "changes_requested"] | None = None
    operator_notes: str | None = Field(default=None, max_length=2000)
    handoff_checklist: dict[str, Any] | None = None


class SiteManagerOpsTemplateItemResponse(BaseModel):
    template_key: str
    profile_id: str | None = None
    profile_loaded: bool
    block_count: int
    has_site_settings: bool
    runtime_mode: str
    api_image: str | None = None
    frontend_image: str | None = None
    images_ready: bool


class SiteManagerOpsTemplateRegistryResponse(BaseModel):
    templates: list[SiteManagerOpsTemplateItemResponse]
    runtime_mode: str


class SiteManagerOpsSmokeCheckResponse(BaseModel):
    key: str
    ok: bool
    severity: str
    message: str


class SiteManagerOpsSmokeResponse(BaseModel):
    instance_scope: Literal["user", "project"]
    instance_id: UUID
    status: str
    checks: list[SiteManagerOpsSmokeCheckResponse]
    hard_failure_count: int
    generated_at: datetime


class SiteManagerOpsKirsCollaborationResponse(BaseModel):
    instance_id: UUID | None = None
    marketing_project_id: UUID | None = None
    readiness_status: str
    approval_status: str
    operator_notes: str
    handoff_checklist: dict[str, Any] = Field(default_factory=dict)


@router.get("/overview", response_model=SiteManagerOpsOverviewResponse)
async def site_manager_ops_overview(
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> dict[str, Any]:
    return await site_manager_ops.get_operator_overview(db)


@router.get("/jobs", response_model=list[SiteManagerOpsLifecycleJobResponse])
async def site_manager_ops_jobs(
    status_filter: str | None = Query(default=None, alias="status"),
    scope: Literal["user", "project"] | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[dict[str, Any]]:
    return await site_manager_ops.list_lifecycle_jobs(db, status_filter=status_filter, scope=scope, limit=limit)


@router.post(
    "/jobs/{job_id}/cancel",
    response_model=SiteManagerOpsLifecycleJobResponse,
    status_code=status.HTTP_200_OK,
)
async def site_manager_ops_cancel_lifecycle_job(
    job_id: UUID,
    admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> dict[str, Any]:
    return await site_manager_ops.cancel_lifecycle_job_for_repair(
        db,
        job_id=job_id,
        actor_user_id=admin.id,
    )


@router.post(
    "/jobs/{job_id}/retry",
    response_model=SiteManagerOpsActionResponse,
    status_code=status.HTTP_200_OK,
)
async def site_manager_ops_retry_lifecycle_job(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> dict[str, Any]:
    return await site_manager_ops.retry_lifecycle_job_for_repair(
        db,
        job_id=job_id,
        background_tasks=background_tasks,
        actor_user_id=admin.id,
    )


@router.get("/domains", response_model=list[SiteManagerOpsDomainBindingResponse])
async def site_manager_ops_domains(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[dict[str, Any]]:
    return await site_manager_ops.list_domain_bindings_overview(db, status_filter=status_filter, limit=limit)


@router.get("/instances", response_model=SiteManagerOpsRuntimeInstancesPageResponse)
async def site_manager_ops_instances(
    q: str | None = Query(default=None, max_length=200),
    scope: Literal["user", "project"] | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> dict[str, Any]:
    rows = await site_manager_ops.list_runtime_instances(
        db,
        q=q,
        scope=scope,
        status_filter=status_filter,
        limit=limit + 1,
        offset=offset,
    )
    return {
        "items": rows[:limit],
        "limit": limit,
        "offset": offset,
        "returned": min(len(rows), limit),
        "has_more": len(rows) > limit,
    }


@router.get("/dns-outbox", response_model=list[SiteManagerOpsDnsOutboxResponse])
async def site_manager_ops_dns_outbox(
    status_filter: str | None = Query(default="pending", alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[dict[str, Any]]:
    return await site_manager_ops.list_dns_outbox(db, status_filter=status_filter, limit=limit)


@router.get("/dns-outbox/preview", response_model=SiteManagerOpsDnsPreviewResponse)
async def site_manager_ops_dns_outbox_preview(
    limit: int = Query(default=100, ge=1, le=500),
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> dict[str, Any]:
    return await site_manager_ops.preview_dns_outbox_records(db, limit=limit)


@router.post(
    "/dns-outbox/{outbox_id}/mark-applied",
    response_model=SiteManagerOpsDnsOutboxResponse,
    status_code=status.HTTP_200_OK,
)
async def site_manager_ops_mark_dns_applied(
    outbox_id: UUID,
    admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> dict[str, Any]:
    data = await site_manager_ops.mark_dns_outbox_applied(db, outbox_id=outbox_id, actor_user_id=admin.id)
    await db.commit()
    return data


@router.post(
    "/domains/{binding_id}/mark-tls-ready",
    response_model=SiteManagerOpsDomainBindingResponse,
    status_code=status.HTTP_200_OK,
)
async def site_manager_ops_mark_tls_ready(
    binding_id: UUID,
    body: SiteManagerOpsTlsReadyBody | None = None,
    admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> dict[str, Any]:
    data = await site_manager_ops.mark_domain_tls_ready(
        db,
        binding_id=binding_id,
        actor_user_id=admin.id,
        certificate_summary=(body.certificate_summary if body else None),
    )
    await db.commit()
    return data


@router.get("/reconcile", response_model=SiteManagerOpsReconcileReportResponse)
async def site_manager_ops_reconcile(
    limit: int = Query(default=100, ge=1, le=500),
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> dict[str, Any]:
    return await site_manager_ops.build_runtime_reconcile_report(db, limit=limit)


@router.post(
    "/reconcile/{instance_scope}/{instance_id}/mark-failed", response_model=SiteManagerOpsRepairInstanceResponse
)
async def site_manager_ops_reconcile_mark_failed(
    instance_scope: Literal["user", "project"],
    instance_id: UUID,
    body: SiteManagerOpsRepairFailedBody | None = None,
    admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> dict[str, Any]:
    data = await site_manager_ops.mark_instance_failed_for_repair(
        db,
        instance_scope=instance_scope,
        instance_id=instance_id,
        reason=(body.reason if body else "Marked failed by Site Manager operator reconcile action"),
        actor_user_id=admin.id,
    )
    await db.commit()
    return data


@router.get("/templates", response_model=SiteManagerOpsTemplateRegistryResponse)
async def site_manager_ops_templates(
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    return site_manager_ops.get_template_registry()


@router.post("/smoke/publish", response_model=SiteManagerOpsSmokeResponse)
async def site_manager_ops_publish_smoke(
    body: SiteManagerOpsSmokeBody,
    admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> dict[str, Any]:
    return await site_manager_ops.run_publish_quality_smoke(
        db,
        instance_scope=body.instance_scope,
        instance_id=body.instance_id,
        run_live=body.run_live,
        actor_user_id=admin.id,
    )


@router.get("/audit-events", response_model=list[SiteManagerOpsAuditEventResponse])
async def site_manager_ops_audit_events(
    target_type: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[dict[str, Any]]:
    return await site_manager_ops.list_ops_audit_events(db, target_type=target_type, limit=limit)


@router.get("/kirs/projects/{project_id}/collaboration", response_model=SiteManagerOpsKirsCollaborationResponse)
async def site_manager_ops_kirs_collaboration(
    project_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> dict[str, Any]:
    return await site_manager_ops.get_kirs_collaboration_state(db, project_id=project_id)


@router.patch("/kirs/projects/{project_id}/collaboration", response_model=SiteManagerOpsKirsCollaborationResponse)
async def site_manager_ops_update_kirs_collaboration(
    project_id: UUID,
    body: SiteManagerOpsKirsCollaborationBody,
    admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> dict[str, Any]:
    data = await site_manager_ops.update_kirs_collaboration_state(
        db,
        project_id=project_id,
        payload=body.model_dump(exclude_none=True),
        actor_user_id=admin.id,
    )
    await db.commit()
    return data
