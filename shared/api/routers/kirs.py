# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T && TZBrand
# ------------------------------------------------------------------------------
# Purpose:
#   KIRS (курирование сайта): project-scoped Site Studio runtime, custom domains,
#   operator console and client access context.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - api/services/site_studio_domain_bindings.py
#   - documentation/product/KIRS-SITE-CURATION.md
# ------------------------------------------------------------------------------
"""
KIRS (курирование сайта): project-scoped Site Studio — оператор агентства и клиент (представитель).
"""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from fastapi import (  # type: ignore[import-untyped]
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import select  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-untyped]

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.core.user_identity import resolve_db_user_uuid_with_session
from api.models.desktop import (
    ProjectSiteInstance,
    SiteStudioPublicationState,
    SiteStudioStatus,
)
from api.routers.desktop_sites import (
    SiteStudioActionResponse,
    SiteStudioAdminSessionResponse,
    SiteStudioDomainBindingCreate,
    SiteStudioDomainBindingResponse,
    SiteStudioHealthResponse,
    SiteStudioInstanceResponse,
    SiteStudioLifecycleJobResponse,
    _set_publication_state,
)
from api.routers.marketing_cabinet.common import get_accessible_project, get_marketing_db_pool
from api.services.queue_features import (
    QUEUE_FLAG_SITE_STUDIO,
    env_flag,
    is_queue_enabled,
)
from api.services.rabbitmq_service import QUEUE_SITE_STUDIO, get_rabbitmq_service
from api.services.site_studio_admin_proxy import proxy_site_studio_admin_request
from api.services.site_studio_domain_bindings import (
    activate_domain_binding,
    create_domain_binding,
    disable_domain_binding,
    list_domain_bindings,
    request_domain_route,
    verify_domain_binding,
)
from api.services.site_studio_lifecycle_jobs import (
    cancel_lifecycle_job,
    create_lifecycle_job,
    get_lifecycle_diagnostics,
    get_lifecycle_job,
    get_worker_readiness,
    mark_lifecycle_job_failed,
    mark_lifecycle_job_queued,
    mark_lifecycle_job_succeeded,
    reap_stale_lifecycle_jobs,
)
from api.services.site_studio_lifecycle_policy import validate_site_studio_lifecycle_action
from api.services.site_studio_public_utils import build_site_studio_public_hostname
from api.services.site_studio_runtime_service import (
    SiteStudioRuntimeError,
    build_kirs_site_slug,
    build_site_studio_public_urls,
    execute_site_studio_runtime_task,
    get_site_studio_runtime_manager,
    is_supported_site_studio_template,
    normalize_site_studio_template_key,
)

router = APIRouter(prefix="/desktop/kirs", tags=["desktop-kirs"])
PROXYABLE_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
RUNTIME_ACTIVE_STATUSES = {
    SiteStudioStatus.RUNNING.value,
    SiteStudioStatus.STARTING.value,
    SiteStudioStatus.REDEPLOYING.value,
}


def _pending_status_for_task_type(task_type: str) -> str:
    if task_type.endswith("_start"):
        return SiteStudioStatus.STARTING.value
    if task_type.endswith("_stop"):
        return SiteStudioStatus.STOPPING.value
    if task_type.endswith("_redeploy"):
        return SiteStudioStatus.REDEPLOYING.value
    return SiteStudioStatus.PROVISIONING.value


def _serialize_project_instance(instance: ProjectSiteInstance) -> SiteStudioInstanceResponse:
    ca = instance.client_access_json if isinstance(instance.client_access_json, dict) else {}
    return SiteStudioInstanceResponse(
        id=instance.id,
        user_id=instance.owner_user_id,
        template_key=instance.template_key,
        site_slug=instance.site_slug,
        site_title=instance.site_title,
        site_topic=instance.site_topic,
        brief_json=instance.brief_json if isinstance(instance.brief_json, dict) else {},
        status=instance.status,
        public_hostname=instance.public_hostname,
        publication_state=instance.publication_state,
        public_url=instance.public_url,
        api_base_url=instance.api_base_url,
        opened_at=instance.opened_at,
        closed_at=instance.closed_at,
        admin_email=instance.admin_email,
        runtime_dir=instance.runtime_dir,
        source_dir=instance.source_dir,
        env_dir=instance.env_dir,
        compose_file_path=instance.compose_file_path,
        compose_project_name=instance.compose_project_name,
        ports_json=instance.ports_json if isinstance(instance.ports_json, dict) else {},
        db_name=instance.db_name,
        last_error=instance.last_error,
        last_provisioned_at=instance.last_provisioned_at,
        created_at=instance.created_at,
        updated_at=instance.updated_at,
        marketing_project_id=instance.marketing_project_id,
        client_access_json=ca,
    )


def _sync_project_public_fields(instance: ProjectSiteInstance) -> bool:
    public_hostname, public_url, api_base_url = build_site_studio_public_urls(instance)
    changed = False
    for field_name, value in (
        ("public_hostname", public_hostname),
        ("public_url", public_url),
        ("api_base_url", api_base_url),
    ):
        if getattr(instance, field_name) != value:
            setattr(instance, field_name, value)
            changed = True
    return changed


def _kirs_is_lead_row(row: Any, user_id: UUID) -> bool:
    uid = str(user_id)
    company_owner = str(row["company_user_id"]) if row.get("company_user_id") is not None else ""
    rep = row.get("company_representative_user_id")
    rep_s = str(rep) if rep is not None else ""
    lead = row.get("created_by")
    lead_s = str(lead) if lead is not None else ""
    return (
        company_owner == uid
        or lead_s == uid
        or (row.get("active_member_id") is not None and not (rep_s == uid and company_owner != uid))
    )


async def _ensure_kirs_runtime_active(instance: ProjectSiteInstance, db: AsyncSession) -> None:
    if instance.status in RUNTIME_ACTIVE_STATUSES:
        return
    if not instance.api_base_url:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Site runtime API URL is not configured",
        )

    health = await get_site_studio_runtime_manager().health(instance)
    if health["status"] != SiteStudioStatus.RUNNING.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Site runtime is not active",
        )

    inst: Any = instance
    inst.status = SiteStudioStatus.RUNNING.value
    inst.last_error = None
    await db.commit()
    await db.refresh(instance)


async def _require_kirs_project_for_admin_proxy(
    project_id: UUID,
    current_user: AuthUser,
    db: AsyncSession,
    db_pool,
) -> ProjectSiteInstance:
    user_id = await resolve_db_user_uuid_with_session(current_user, db)
    row = await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    result = await db.execute(select(ProjectSiteInstance).where(ProjectSiteInstance.marketing_project_id == project_id))
    inst = result.scalar_one_or_none()
    if inst is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project site instance not found",
        )
    if _sync_project_public_fields(inst):
        await db.commit()
        await db.refresh(inst)
    is_lead = _kirs_is_lead_row(row, user_id)
    access = inst.client_access_json if isinstance(inst.client_access_json, dict) else {}
    allow_admin = bool(access.get("allow_admin_embed", False))
    if not (is_lead or allow_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="KIRS admin access is not enabled for this user",
        )
    if not inst.api_base_url:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Site runtime API URL is not configured",
        )
    return inst


async def _queue_kirs_task_async(
    instance: ProjectSiteInstance,
    task_type: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession,
    previous_status: str,
) -> tuple[bool, UUID]:
    job_id = await create_lifecycle_job(db, instance=instance, instance_scope="project", task_type=task_type)
    payload = {
        "task_type": task_type,
        "instance_id": str(instance.id),
        "user_id": str(instance.owner_user_id),
        "instance_scope": "project",
        "job_id": str(job_id),
    }
    if not is_queue_enabled(QUEUE_FLAG_SITE_STUDIO, default=True):
        await mark_lifecycle_job_queued(db, job_id, queued=False)
        await db.commit()
        background_tasks.add_task(
            execute_site_studio_runtime_task,
            instance.id,
            task_type,
            instance_scope="project",
            job_id=job_id,
        )
        return False, job_id

    published = False
    if is_queue_enabled(QUEUE_FLAG_SITE_STUDIO, default=True):
        published = await get_rabbitmq_service().publish(QUEUE_SITE_STUDIO, payload)
    if published:
        await mark_lifecycle_job_queued(db, job_id, queued=True)
        await db.commit()
        return True, job_id
    if env_flag("ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK", default=False):
        await mark_lifecycle_job_queued(db, job_id, queued=False)
        await db.commit()
        background_tasks.add_task(
            execute_site_studio_runtime_task,
            instance.id,
            task_type,
            instance_scope="project",
            job_id=job_id,
        )
        return False, job_id
    inst_mut: Any = instance
    inst_mut.status = previous_status
    inst_mut.last_error = "Site Studio task queue unavailable"
    from api.monitoring.metrics import record_site_studio_queue_publish_failure

    record_site_studio_queue_publish_failure(task_type=task_type)
    await mark_lifecycle_job_failed(
        db,
        job_id,
        stage="queue_publish_failed",
        error="RabbitMQ publish failed",
    )
    await db.commit()
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "Site Studio task queue unavailable (RabbitMQ publish failed). "
            "Fix broker/worker or set ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK=1 for dev-only inline execution "
            "in the API process."
        ),
    )


async def _validate_kirs_runtime_action_or_raise(
    db: AsyncSession,
    instance: ProjectSiteInstance,
    *,
    action: str,
) -> dict[str, Any]:
    worker = await get_worker_readiness(db)
    require_worker = is_queue_enabled(QUEUE_FLAG_SITE_STUDIO, default=True) and not env_flag(
        "ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK",
        default=False,
    )
    validate_site_studio_lifecycle_action(
        instance,
        action=action,
        worker_ready=bool(worker.get("worker_ready")),
        require_worker=require_worker,
    )
    if action in {"provision", "start", "redeploy"}:
        try:
            get_site_studio_runtime_manager().validate_runtime_preflight(instance.template_key)
        except SiteStudioRuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return worker


class KirsOperatorProjectRow(BaseModel):
    project_id: UUID
    project_name: str
    company_name: str


class KirsInstanceCreate(BaseModel):
    site_title: str = Field(min_length=1, max_length=255)
    site_topic: str = Field(default="", max_length=255)
    brief_json: dict[str, Any] = Field(default_factory=dict)
    template_key: str = Field(default="olenti", max_length=100)


class KirsInstanceUpdate(BaseModel):
    site_title: str | None = Field(default=None, min_length=1, max_length=255)
    site_topic: str | None = Field(default=None, max_length=255)
    brief_json: dict[str, Any] | None = None


class KirsClientAccessUpdate(BaseModel):
    allow_public_site: bool = True
    allow_admin_embed: bool = False


class KirsClientSiteContext(BaseModel):
    project_id: UUID
    has_instance: bool
    status: str | None = None
    public_url: str | None = None
    allow_public_site: bool = False
    allow_admin_embed: bool = False
    admin_embed_available: bool = False
    readiness_status: str = "preparing"
    approval_status: str = "not_requested"
    client_feedback: str = ""


class KirsClientApprovalAction(BaseModel):
    action: Literal["approve", "request_changes"]
    message: str | None = Field(default=None, max_length=2000)


@router.get("/operator-projects", response_model=list[KirsOperatorProjectRow])
async def list_kirs_operator_projects(
    current_user: AuthUser = Depends(require_oauth2_user),
    db_pool=Depends(get_marketing_db_pool),
    db: AsyncSession = Depends(get_postgres_session),
) -> list[KirsOperatorProjectRow]:
    user_id = await resolve_db_user_uuid_with_session(current_user, db)
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT p.id AS project_id, p.name AS project_name, c.name AS company_name
            FROM projects p
            INNER JOIN companies c ON c.id = p.company_id AND c.deleted_at IS NULL
            WHERE p.deleted_at IS NULL
              AND (
                c.user_id = $1::uuid
                OR p.created_by = $1::uuid
                OR (
                  EXISTS (
                    SELECT 1 FROM project_members pm
                    WHERE pm.project_id = p.id AND pm.user_id = $1::uuid AND pm.status::text = 'active'
                  )
                  AND NOT (
                    c.representative_user_id IS NOT NULL
                    AND c.representative_user_id = $1::uuid
                    AND c.user_id IS DISTINCT FROM $1::uuid
                  )
                )
              )
            ORDER BY c.name ASC, p.name ASC
            """,
            user_id,
        )
    return [
        KirsOperatorProjectRow(
            project_id=row["project_id"],
            project_name=row["project_name"],
            company_name=row["company_name"],
        )
        for row in rows
    ]


async def _require_project_instance_for_operator(
    project_id: UUID,
    current_user: AuthUser,
    db: AsyncSession,
    db_pool,
) -> ProjectSiteInstance:
    user_id = await resolve_db_user_uuid_with_session(current_user, db)
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    result = await db.execute(select(ProjectSiteInstance).where(ProjectSiteInstance.marketing_project_id == project_id))
    inst = result.scalar_one_or_none()
    if inst is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project site instance not found")
    return inst


@router.get("/projects/{project_id}/instance", response_model=SiteStudioInstanceResponse | None)
async def get_kirs_project_instance(
    project_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioInstanceResponse | None:
    user_id = await resolve_db_user_uuid_with_session(current_user, db)
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)
    result = await db.execute(select(ProjectSiteInstance).where(ProjectSiteInstance.marketing_project_id == project_id))
    inst = result.scalar_one_or_none()
    if inst is None:
        return None
    if _sync_project_public_fields(inst):
        await db.commit()
        await db.refresh(inst)
    return _serialize_project_instance(inst)


@router.post("/projects/{project_id}/instance", response_model=SiteStudioInstanceResponse, status_code=201)
async def create_kirs_project_instance(
    project_id: UUID,
    body: KirsInstanceCreate,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioInstanceResponse:
    user_id = await resolve_db_user_uuid_with_session(current_user, db)
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True)

    existing = await db.execute(
        select(ProjectSiteInstance).where(ProjectSiteInstance.marketing_project_id == project_id)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project already has a KIRS site instance")

    normalized_template_key = normalize_site_studio_template_key(body.template_key)
    if not is_supported_site_studio_template(normalized_template_key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported Site Studio template key: {normalized_template_key}",
        )

    site_slug = build_kirs_site_slug(project_id, body.site_title)
    public_hostname = build_site_studio_public_hostname(site_slug)
    instance = ProjectSiteInstance(
        owner_user_id=user_id,
        marketing_project_id=project_id,
        template_key=normalized_template_key,
        site_slug=site_slug,
        site_title=body.site_title.strip(),
        site_topic=body.site_topic.strip(),
        brief_json=body.brief_json,
        status=SiteStudioStatus.DRAFT.value,
        public_hostname=public_hostname,
        publication_state=SiteStudioPublicationState.OPEN.value,
        client_access_json={"allow_public_site": True, "allow_admin_embed": False},
    )
    _sync_project_public_fields(instance)
    _set_publication_state(instance, SiteStudioPublicationState.OPEN)
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return _serialize_project_instance(instance)


@router.patch("/projects/{project_id}/instance", response_model=SiteStudioInstanceResponse)
async def update_kirs_project_instance(
    project_id: UUID,
    body: KirsInstanceUpdate,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioInstanceResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    inst_mut: Any = inst
    if body.site_title is not None:
        inst_mut.site_title = body.site_title.strip()
    if body.site_topic is not None:
        inst_mut.site_topic = body.site_topic.strip()
    if body.brief_json is not None:
        inst_mut.brief_json = body.brief_json
    _sync_project_public_fields(inst)
    await db.commit()
    await db.refresh(inst)
    return _serialize_project_instance(inst)


@router.patch("/projects/{project_id}/instance/client-access", response_model=SiteStudioInstanceResponse)
async def update_kirs_client_access(
    project_id: UUID,
    body: KirsClientAccessUpdate,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioInstanceResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    existing_access = inst.client_access_json if isinstance(inst.client_access_json, dict) else {}
    checklist = existing_access.get("site_handoff_checklist")
    if body.allow_admin_embed and (
        not isinstance(checklist, dict) or not checklist or not all(bool(value) for value in checklist.values())
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Admin embed can be granted only after the Site Manager handoff checklist is complete.",
        )
    inst_mut: Any = inst
    inst_mut.client_access_json = {
        **existing_access,
        "allow_public_site": body.allow_public_site,
        "allow_admin_embed": body.allow_admin_embed,
    }
    await db.commit()
    await db.refresh(inst)
    return _serialize_project_instance(inst)


@router.delete(
    "/projects/{project_id}/instance",
    responses={204: {"description": "Removed"}, 202: {"description": "Teardown queued"}},
)
async def delete_kirs_project_instance(
    project_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
    preserve_runtime_data: bool = Query(False, description="Keep bind-mounted runtime on disk"),
) -> Response:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    runtime_manager = get_site_studio_runtime_manager()
    await _validate_kirs_runtime_action_or_raise(db, inst, action="destroy")

    job_id = await create_lifecycle_job(
        db,
        instance=inst,
        instance_scope="project",
        task_type="site_studio_destroy",
        metadata={"preserve_runtime_data": preserve_runtime_data},
    )
    payload = {
        "task_type": "site_studio_destroy",
        "instance_id": str(inst.id),
        "user_id": str(inst.owner_user_id),
        "instance_scope": "project",
        "preserve_runtime_data": preserve_runtime_data,
        "job_id": str(job_id),
    }
    queued = False
    if is_queue_enabled(QUEUE_FLAG_SITE_STUDIO, default=True):
        queued = await get_rabbitmq_service().publish(QUEUE_SITE_STUDIO, payload)
    if queued:
        await mark_lifecycle_job_queued(db, job_id, queued=True)
        await db.commit()
        return Response(status_code=status.HTTP_202_ACCEPTED)

    if env_flag("ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK", default=False):
        await mark_lifecycle_job_queued(db, job_id, queued=False)
        await db.commit()
        try:
            async with runtime_manager.runtime_operation_lock(inst):
                runtime_manager.invalidate_admin_token(inst)
                await runtime_manager.destroy(inst, preserve_runtime_data=preserve_runtime_data)
        except Exception as exc:  # noqa: BLE001
            await mark_lifecycle_job_failed(db, job_id, stage="destroy_failed", error=str(exc))
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to delete KIRS site instance: {exc}",
            ) from exc
        await mark_lifecycle_job_succeeded(db, job_id, stage="destroyed")
        await db.delete(inst)
        await db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    await mark_lifecycle_job_failed(
        db,
        job_id,
        stage="queue_publish_failed",
        error="RabbitMQ publish failed",
    )
    from api.monitoring.metrics import record_site_studio_queue_publish_failure

    record_site_studio_queue_publish_failure(task_type="site_studio_destroy")
    await db.commit()
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "Site Studio teardown queue unavailable. Fix RabbitMQ/site-studio-worker or "
            "set ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK=1 on the API (legacy inline docker path)."
        ),
    )


@router.post("/projects/{project_id}/instance/provision", response_model=SiteStudioActionResponse)
async def provision_kirs_instance(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioActionResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    worker = await _validate_kirs_runtime_action_or_raise(db, inst, action="provision")
    inst_mut: Any = inst
    previous_status = inst.status
    inst_mut.status = SiteStudioStatus.PROVISIONING.value
    inst_mut.last_error = None
    await db.commit()
    queued, job_id = await _queue_kirs_task_async(inst, "site_studio_provision", background_tasks, db, previous_status)
    return SiteStudioActionResponse(
        status=inst.status,
        queued=queued,
        detail="Provisioning started",
        job_id=job_id,
        worker_ready=bool(worker.get("worker_ready")),
    )


@router.post("/projects/{project_id}/instance/start", response_model=SiteStudioActionResponse)
async def start_kirs_instance(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioActionResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    worker = await _validate_kirs_runtime_action_or_raise(db, inst, action="start")
    inst_mut: Any = inst
    previous_status = inst.status
    inst_mut.status = SiteStudioStatus.STARTING.value
    inst_mut.last_error = None
    await db.commit()
    queued, job_id = await _queue_kirs_task_async(inst, "site_studio_start", background_tasks, db, previous_status)
    return SiteStudioActionResponse(
        status=inst.status,
        queued=queued,
        detail="Start queued",
        job_id=job_id,
        worker_ready=bool(worker.get("worker_ready")),
    )


@router.post("/projects/{project_id}/instance/stop", response_model=SiteStudioActionResponse)
async def stop_kirs_instance(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioActionResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    worker = await _validate_kirs_runtime_action_or_raise(db, inst, action="stop")
    inst_mut: Any = inst
    previous_status = inst.status
    inst_mut.status = SiteStudioStatus.STOPPING.value
    inst_mut.last_error = None
    await db.commit()
    queued, job_id = await _queue_kirs_task_async(inst, "site_studio_stop", background_tasks, db, previous_status)
    return SiteStudioActionResponse(
        status=inst.status,
        queued=queued,
        detail="Stop queued",
        job_id=job_id,
        worker_ready=bool(worker.get("worker_ready")),
    )


@router.post("/projects/{project_id}/instance/redeploy", response_model=SiteStudioActionResponse)
async def redeploy_kirs_instance(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioActionResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    worker = await _validate_kirs_runtime_action_or_raise(db, inst, action="redeploy")
    inst_mut: Any = inst
    previous_status = inst.status
    inst_mut.status = SiteStudioStatus.REDEPLOYING.value
    inst_mut.last_error = None
    await db.commit()
    queued, job_id = await _queue_kirs_task_async(inst, "site_studio_redeploy", background_tasks, db, previous_status)
    return SiteStudioActionResponse(
        status=inst.status,
        queued=queued,
        detail="Redeploy queued",
        job_id=job_id,
        worker_ready=bool(worker.get("worker_ready")),
    )


@router.get("/projects/{project_id}/instance/health", response_model=SiteStudioHealthResponse)
async def kirs_instance_health(
    project_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioHealthResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    await reap_stale_lifecycle_jobs(db)
    canonical = _sync_project_public_fields(inst)
    health = await get_site_studio_runtime_manager().health(inst)
    if health["status"] == SiteStudioStatus.RUNNING.value and inst.status != SiteStudioStatus.RUNNING.value:
        inst_mut: Any = inst
        inst_mut.status = SiteStudioStatus.RUNNING.value
        inst_mut.last_error = None
        canonical = True
    if canonical:
        await db.commit()
        await db.refresh(inst)
    health["public_hostname"] = inst.public_hostname
    health["publication_state"] = inst.publication_state
    health.update(await get_lifecycle_diagnostics(db, instance_scope="project", instance_id=inst.id))
    return SiteStudioHealthResponse(**health)


@router.post("/projects/{project_id}/instance/jobs/{job_id}/cancel", response_model=SiteStudioLifecycleJobResponse)
async def cancel_kirs_lifecycle_job(
    project_id: UUID,
    job_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioLifecycleJobResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    row = await cancel_lifecycle_job(db, job_id=job_id, instance_scope="project", instance_id=inst.id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending lifecycle job not found")
    await db.commit()
    return SiteStudioLifecycleJobResponse(**row)


@router.post("/projects/{project_id}/instance/jobs/{job_id}/retry", response_model=SiteStudioActionResponse)
async def retry_kirs_lifecycle_job(
    project_id: UUID,
    job_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioActionResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    job = await get_lifecycle_job(db, job_id=job_id, instance_scope="project", instance_id=inst.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lifecycle job not found")
    task_type = str(job["task_type"])
    if task_type == "site_studio_destroy":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Destroy jobs are not retried from UI")
    action = task_type.removeprefix("site_studio_")
    worker = await _validate_kirs_runtime_action_or_raise(db, inst, action=action)
    previous_status = inst.status
    inst_mut: Any = inst
    inst_mut.status = _pending_status_for_task_type(task_type)
    inst_mut.last_error = None
    await cancel_lifecycle_job(
        db, job_id=job_id, instance_scope="project", instance_id=inst.id, reason="retry_superseded"
    )
    await db.commit()
    queued, new_job_id = await _queue_kirs_task_async(inst, task_type, background_tasks, db, previous_status)
    return SiteStudioActionResponse(
        status=inst.status,
        queued=queued,
        detail="Retry queued",
        job_id=new_job_id,
        worker_ready=bool(worker.get("worker_ready")),
    )


@router.get("/projects/{project_id}/instance/domains", response_model=list[SiteStudioDomainBindingResponse])
async def list_kirs_domain_bindings(
    project_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> list[SiteStudioDomainBindingResponse]:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    rows = await list_domain_bindings(db, instance_scope="project", instance_id=inst.id)
    return [SiteStudioDomainBindingResponse(**row) for row in rows]


@router.post(
    "/projects/{project_id}/instance/domains",
    response_model=SiteStudioDomainBindingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_kirs_domain_binding(
    project_id: UUID,
    body: SiteStudioDomainBindingCreate,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioDomainBindingResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    actor_user_id = await resolve_db_user_uuid_with_session(current_user, db)
    row = await create_domain_binding(
        db,
        instance_scope="project",
        instance_id=inst.id,
        hostname=body.hostname,
        actor_user_id=actor_user_id,
    )
    await db.commit()
    return SiteStudioDomainBindingResponse(**row)


@router.post(
    "/projects/{project_id}/instance/domains/{binding_id}/verify", response_model=SiteStudioDomainBindingResponse
)
async def verify_kirs_domain_binding(
    project_id: UUID,
    binding_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioDomainBindingResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    actor_user_id = await resolve_db_user_uuid_with_session(current_user, db)
    row = await verify_domain_binding(
        db,
        binding_id=binding_id,
        instance_scope="project",
        instance_id=inst.id,
        actor_user_id=actor_user_id,
    )
    await db.commit()
    return SiteStudioDomainBindingResponse(**row)


@router.post(
    "/projects/{project_id}/instance/domains/{binding_id}/request-route",
    response_model=SiteStudioDomainBindingResponse,
)
async def request_kirs_domain_route(
    project_id: UUID,
    binding_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioDomainBindingResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    actor_user_id = await resolve_db_user_uuid_with_session(current_user, db)
    row = await request_domain_route(
        db,
        binding_id=binding_id,
        instance_scope="project",
        instance_id=inst.id,
        actor_user_id=actor_user_id,
    )
    await db.commit()
    return SiteStudioDomainBindingResponse(**row)


@router.post(
    "/projects/{project_id}/instance/domains/{binding_id}/activate",
    response_model=SiteStudioDomainBindingResponse,
)
async def activate_kirs_domain_binding(
    project_id: UUID,
    binding_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioDomainBindingResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    actor_user_id = await resolve_db_user_uuid_with_session(current_user, db)
    row = await activate_domain_binding(
        db,
        binding_id=binding_id,
        instance_scope="project",
        instance_id=inst.id,
        actor_user_id=actor_user_id,
    )
    await db.commit()
    return SiteStudioDomainBindingResponse(**row)


@router.post(
    "/projects/{project_id}/instance/domains/{binding_id}/disable",
    response_model=SiteStudioDomainBindingResponse,
)
async def disable_kirs_domain_binding(
    project_id: UUID,
    binding_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioDomainBindingResponse:
    inst = await _require_project_instance_for_operator(project_id, current_user, db, db_pool)
    actor_user_id = await resolve_db_user_uuid_with_session(current_user, db)
    row = await disable_domain_binding(
        db,
        binding_id=binding_id,
        instance_scope="project",
        instance_id=inst.id,
        actor_user_id=actor_user_id,
    )
    await db.commit()
    return SiteStudioDomainBindingResponse(**row)


@router.post(
    "/projects/{project_id}/instance/admin-session",
    response_model=SiteStudioAdminSessionResponse,
)
async def kirs_create_admin_session(
    project_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> SiteStudioAdminSessionResponse:
    inst = await _require_kirs_project_for_admin_proxy(project_id, current_user, db, db_pool)
    await _ensure_kirs_runtime_active(inst, db)
    runtime_manager = get_site_studio_runtime_manager()
    try:
        await runtime_manager.login_admin(inst)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to establish proxied admin session: {exc}",
        ) from exc
    return SiteStudioAdminSessionResponse(
        authenticated=True,
        proxied=True,
        status=inst.status,
        public_url=inst.public_url,
        api_base_url=inst.api_base_url,
    )


async def kirs_proxy_site_studio_request(
    project_id: UUID,
    path: str,
    request: Request,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> Response:
    inst = await _require_kirs_project_for_admin_proxy(project_id, current_user, db, db_pool)
    if _sync_project_public_fields(inst):
        await db.commit()
        await db.refresh(inst)
    await _ensure_kirs_runtime_active(inst, db)
    return await proxy_site_studio_admin_request(instance=inst, path=path, request=request, db=db)


for _http_method in PROXYABLE_METHODS:
    router.add_api_route(
        "/projects/{project_id}/proxy/{path:path}",
        kirs_proxy_site_studio_request,
        methods=[_http_method],
        operation_id=f"kirs_proxy_site_studio_{_http_method.lower()}",
    )


@router.get("/client/projects/{project_id}/site", response_model=KirsClientSiteContext)
async def get_kirs_client_site_context(
    project_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> KirsClientSiteContext:
    user_id = await resolve_db_user_uuid_with_session(current_user, db)
    row = await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)

    is_lead = _kirs_is_lead_row(row, user_id)

    result = await db.execute(select(ProjectSiteInstance).where(ProjectSiteInstance.marketing_project_id == project_id))
    inst = result.scalar_one_or_none()
    if inst is None:
        return KirsClientSiteContext(
            project_id=project_id,
            has_instance=False,
        )

    if _sync_project_public_fields(inst):
        await db.commit()
        await db.refresh(inst)

    access = inst.client_access_json if isinstance(inst.client_access_json, dict) else {}
    allow_public = bool(access.get("allow_public_site", True))
    allow_admin = bool(access.get("allow_admin_embed", False))
    readiness_status = str(access.get("site_readiness_status") or "preparing")
    approval_status = str(access.get("site_approval_status") or "not_requested")
    client_feedback = str(access.get("site_client_feedback") or "")

    public_url = inst.public_url if allow_public or is_lead else None
    admin_ok = (allow_admin or is_lead) and bool(inst.api_base_url)

    return KirsClientSiteContext(
        project_id=project_id,
        has_instance=True,
        status=inst.status,
        public_url=public_url,
        allow_public_site=allow_public,
        allow_admin_embed=allow_admin if not is_lead else True,
        admin_embed_available=admin_ok,
        readiness_status=readiness_status,
        approval_status=approval_status,
        client_feedback=client_feedback,
    )


@router.post("/client/projects/{project_id}/site/approval", response_model=KirsClientSiteContext)
async def update_kirs_client_site_approval(
    project_id: UUID,
    body: KirsClientApprovalAction,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool=Depends(get_marketing_db_pool),
) -> KirsClientSiteContext:
    user_id = await resolve_db_user_uuid_with_session(current_user, db)
    row = await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    is_lead = _kirs_is_lead_row(row, user_id)
    result = await db.execute(select(ProjectSiteInstance).where(ProjectSiteInstance.marketing_project_id == project_id))
    inst = result.scalar_one_or_none()
    if inst is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="KIRS site instance not found")
    access = dict(inst.client_access_json if isinstance(inst.client_access_json, dict) else {})
    access["site_approval_status"] = "approved" if body.action == "approve" else "changes_requested"
    if body.message is not None:
        access["site_client_feedback"] = body.message
    access["site_client_decision_by_user_id"] = str(user_id)
    inst_mut: Any = inst
    inst_mut.client_access_json = access
    await db.commit()
    await db.refresh(inst)
    allow_public = bool(access.get("allow_public_site", True))
    allow_admin = bool(access.get("allow_admin_embed", False))
    public_url = inst.public_url if allow_public or is_lead else None
    admin_ok = (allow_admin or is_lead) and bool(inst.api_base_url)
    return KirsClientSiteContext(
        project_id=project_id,
        has_instance=True,
        status=inst.status,
        public_url=public_url,
        allow_public_site=allow_public,
        allow_admin_embed=allow_admin if not is_lead else True,
        admin_embed_available=admin_ok,
        readiness_status=str(access.get("site_readiness_status") or "preparing"),
        approval_status=str(access.get("site_approval_status") or "not_requested"),
        client_feedback=str(access.get("site_client_feedback") or ""),
    )
