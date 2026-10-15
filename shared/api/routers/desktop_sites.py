# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T && TZBrand
# ------------------------------------------------------------------------------
# Purpose:
#   API Site Studio на desktop: инстансы сайтов, custom domains, прокси, provisioning hooks.
# Invariants:
#   - Экземпляры и служебные даты — UTC naive где задано через datetime_helpers.
# Related:
#   - api/services/site_studio_runtime_service.py, api/services/site_studio_domain_bindings.py
# ------------------------------------------------------------------------------
"""
Desktop Site Studio router: per-user local website runtime management and proxying.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
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
from sqlalchemy import select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.core.user_identity import resolve_db_user_uuid_with_session
from api.models.desktop import SiteStudioPublicationState, SiteStudioStatus, UserSiteInstance
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
from api.services.site_studio_edge_carrier import (
    build_edge_health_snapshot,
    execute_site_studio_edge_task,
    site_edge_carrier_enabled,
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
    build_site_slug,
    build_site_studio_public_urls,
    execute_site_studio_runtime_task,
    get_site_studio_runtime_manager,
    is_supported_site_studio_template,
    normalize_site_studio_template_key,
)
from api.utils.datetime_helpers import utc_now_naive

router = APIRouter(prefix="/desktop/site-studio", tags=["desktop-site-studio"])
PROXYABLE_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
RUNTIME_ACTIVE_STATUSES = {
    SiteStudioStatus.RUNNING.value,
    SiteStudioStatus.STARTING.value,
    SiteStudioStatus.REDEPLOYING.value,
}


class SiteStudioInstanceCreate(BaseModel):
    site_title: str = Field(min_length=1, max_length=255)
    site_topic: str = Field(default="", max_length=255)
    brief_json: dict[str, Any] = Field(default_factory=dict)
    template_key: str = Field(default="olenti", max_length=100)


class SiteStudioInstanceUpdate(BaseModel):
    site_title: str | None = Field(default=None, min_length=1, max_length=255)
    site_topic: str | None = Field(default=None, max_length=255)
    brief_json: dict[str, Any] | None = None


class SiteStudioInstanceResponse(BaseModel):
    id: UUID
    user_id: UUID
    template_key: str
    site_slug: str
    site_title: str
    site_topic: str
    brief_json: dict[str, Any] = Field(default_factory=dict)
    status: str
    public_hostname: str
    publication_state: str
    public_url: str | None = None
    api_base_url: str | None = None
    opened_at: datetime | None = None
    closed_at: datetime | None = None
    admin_email: str | None = None
    runtime_dir: str | None = None
    source_dir: str | None = None
    env_dir: str | None = None
    compose_file_path: str | None = None
    compose_project_name: str | None = None
    ports_json: dict[str, Any] = Field(default_factory=dict)
    db_name: str | None = None
    last_error: str | None = None
    last_provisioned_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    marketing_project_id: UUID | None = None
    client_access_json: dict[str, Any] | None = None


class SiteStudioActionResponse(BaseModel):
    status: str
    queued: bool
    detail: str
    job_id: UUID | None = None
    worker_ready: bool | None = None


class SiteStudioLifecycleJobResponse(BaseModel):
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


class SiteStudioHealthResponse(BaseModel):
    status: str
    api_ok: bool
    public_ok: bool
    api_error: str | None = None
    public_error: str | None = None
    ports: dict[str, Any] = Field(default_factory=dict)
    public_hostname: str | None = None
    publication_state: str | None = None
    public_url: str | None = None
    api_base_url: str | None = None
    worker_ready: bool = False
    worker_id: str | None = None
    worker_last_seen_at: datetime | None = None
    worker_last_seen_age_seconds: int | None = None
    worker_ready_window_seconds: int | None = None
    last_job: SiteStudioLifecycleJobResponse | None = None
    pending_job: SiteStudioLifecycleJobResponse | None = None
    edge: dict[str, Any] | None = None


class SiteStudioAdminSessionResponse(BaseModel):
    authenticated: bool
    proxied: bool
    status: str
    public_url: str | None = None
    api_base_url: str | None = None


class SiteStudioDomainBindingCreate(BaseModel):
    hostname: str = Field(min_length=1, max_length=255)


class SiteStudioDomainBindingResponse(BaseModel):
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


def _serialize_instance(instance: UserSiteInstance) -> SiteStudioInstanceResponse:
    return SiteStudioInstanceResponse(
        id=instance.id,
        user_id=instance.user_id,
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
        marketing_project_id=None,
        client_access_json=None,
    )


def _sync_public_site_fields(instance: UserSiteInstance) -> bool:
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


def _set_publication_state(instance: UserSiteInstance, publication_state: SiteStudioPublicationState) -> bool:
    inst: Any = instance
    normalized_state = publication_state.value
    now = utc_now_naive()
    changed = False
    if inst.publication_state != normalized_state:
        inst.publication_state = normalized_state
        changed = True

    if publication_state == SiteStudioPublicationState.OPEN:
        if inst.opened_at is None or inst.closed_at is not None:
            inst.opened_at = now
            changed = True
        if inst.closed_at is not None:
            inst.closed_at = None
            changed = True
    else:
        if inst.closed_at is None:
            inst.closed_at = now
            changed = True

    return changed


async def _current_db_user_id(
    current_user: AuthUser,
    db: AsyncSession,
) -> UUID:
    return await resolve_db_user_uuid_with_session(current_user, db)


async def _get_instance_for_current_user(
    current_user: AuthUser,
    db: AsyncSession,
) -> UserSiteInstance | None:
    user_id = await _current_db_user_id(current_user, db)
    result = await db.execute(select(UserSiteInstance).where(UserSiteInstance.user_id == user_id))
    return result.scalar_one_or_none()


async def _require_instance_for_current_user(
    current_user: AuthUser,
    db: AsyncSession,
) -> UserSiteInstance:
    instance = await _get_instance_for_current_user(current_user, db)
    if instance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site Studio instance not found",
        )
    return instance


def _queue_task_payload(
    instance: UserSiteInstance, task_type: str, *, job_id: UUID | str | None = None
) -> dict[str, Any]:
    return {
        "task_type": task_type,
        "instance_id": str(instance.id),
        "user_id": str(instance.user_id),
        "instance_scope": "user",
        "job_id": str(job_id) if job_id else None,
    }


def _pending_status_for_task_type(task_type: str) -> str:
    if task_type.endswith("_start"):
        return SiteStudioStatus.STARTING.value
    if task_type.endswith("_stop"):
        return SiteStudioStatus.STOPPING.value
    if task_type.endswith("_redeploy"):
        return SiteStudioStatus.REDEPLOYING.value
    return SiteStudioStatus.PROVISIONING.value


async def _queue_or_background_runtime_task(
    *,
    instance: UserSiteInstance,
    task_type: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession,
    previous_status: str,
) -> tuple[bool, UUID]:
    job_id = await create_lifecycle_job(db, instance=instance, instance_scope="user", task_type=task_type)
    payload = _queue_task_payload(instance, task_type, job_id=job_id)
    edge_task = task_type in {"site_studio_edge_publish", "site_studio_edge_unpublish"}
    inline_target = execute_site_studio_edge_task if edge_task else execute_site_studio_runtime_task
    if not is_queue_enabled(QUEUE_FLAG_SITE_STUDIO, default=True):
        await mark_lifecycle_job_queued(db, job_id, queued=False)
        await db.commit()
        background_tasks.add_task(
            inline_target,
            instance.id,
            task_type,
            instance_scope="user",
            job_id=job_id,
        )
        return False, job_id

    published = await get_rabbitmq_service().publish(QUEUE_SITE_STUDIO, payload)
    if published:
        await mark_lifecycle_job_queued(db, job_id, queued=True)
        await db.commit()
        return True, job_id

    if env_flag("ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK", default=False):
        await mark_lifecycle_job_queued(db, job_id, queued=False)
        await db.commit()
        background_tasks.add_task(
            inline_target,
            instance.id,
            task_type,
            instance_scope="user",
            job_id=job_id,
        )
        return False, job_id

    inst: Any = instance
    if not edge_task:
        inst.status = previous_status
    inst.last_error = "Site Studio task queue unavailable"
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


async def _enqueue_edge_carrier_task(
    *,
    instance: UserSiteInstance,
    task_type: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession,
) -> tuple[bool, UUID | None]:
    """Enqueue edge publish/unpublish when Carrier mode is enabled; no-op otherwise."""
    if not site_edge_carrier_enabled():
        return False, None
    worker = await get_worker_readiness(db)
    require_worker = is_queue_enabled(QUEUE_FLAG_SITE_STUDIO, default=True) and not env_flag(
        "ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK",
        default=False,
    )
    if require_worker and not bool(worker.get("worker_ready")):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Site Studio worker is not ready for Edge Carrier deploy. "
                "Start site-studio-worker on the build host (.136) with SITE_EDGE_SSH configured."
            ),
        )
    queued, job_id = await _queue_or_background_runtime_task(
        instance=instance,
        task_type=task_type,
        background_tasks=background_tasks,
        db=db,
        previous_status=instance.status,
    )
    return queued, job_id


async def _validate_runtime_action_or_raise(
    db: AsyncSession,
    instance: UserSiteInstance,
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


async def _ensure_runtime_active(instance: UserSiteInstance, db: AsyncSession) -> None:
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


@router.get("/instance", response_model=SiteStudioInstanceResponse | None)
async def get_site_studio_instance(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioInstanceResponse | None:
    instance = await _get_instance_for_current_user(current_user, db)
    if instance is None:
        return None
    if _sync_public_site_fields(instance):
        await db.commit()
        await db.refresh(instance)
    return _serialize_instance(instance)


@router.post(
    "/instance",
    response_model=SiteStudioInstanceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_site_studio_instance(
    body: SiteStudioInstanceCreate,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioInstanceResponse:
    normalized_template_key = normalize_site_studio_template_key(body.template_key)
    if not is_supported_site_studio_template(normalized_template_key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported Site Studio template key: {normalized_template_key}",
        )

    existing = await _get_instance_for_current_user(current_user, db)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Site Studio instance already exists",
        )

    user_id = await _current_db_user_id(current_user, db)
    site_slug = build_site_slug(user_id, body.site_title)
    instance = UserSiteInstance(
        user_id=user_id,
        template_key=normalized_template_key,
        site_slug=site_slug,
        site_title=body.site_title.strip(),
        site_topic=body.site_topic.strip(),
        brief_json=body.brief_json,
        status=SiteStudioStatus.DRAFT.value,
        public_hostname=build_site_studio_public_hostname(site_slug),
        publication_state=SiteStudioPublicationState.OPEN.value,
    )
    _sync_public_site_fields(instance)
    _set_publication_state(instance, SiteStudioPublicationState.OPEN)
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return _serialize_instance(instance)


@router.patch("/instance", response_model=SiteStudioInstanceResponse)
async def update_site_studio_instance(
    body: SiteStudioInstanceUpdate,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioInstanceResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    inst: Any = instance

    if body.site_title is not None:
        inst.site_title = body.site_title.strip()
    if body.site_topic is not None:
        inst.site_topic = body.site_topic.strip()
    if body.brief_json is not None:
        inst.brief_json = body.brief_json

    _sync_public_site_fields(instance)
    await db.commit()
    await db.refresh(instance)
    return _serialize_instance(instance)


@router.delete("/instance", responses={204: {"description": "Removed"}, 202: {"description": "Teardown queued"}})
async def delete_site_studio_instance(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    preserve_runtime_data: bool = Query(False, description="Keep bind-mounted runtime on disk"),
) -> Response:
    instance = await _get_instance_for_current_user(current_user, db)
    if instance is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    runtime_manager = get_site_studio_runtime_manager()
    await _validate_runtime_action_or_raise(db, instance, action="destroy")
    job_id = await create_lifecycle_job(
        db,
        instance=instance,
        instance_scope="user",
        task_type="site_studio_destroy",
        metadata={"preserve_runtime_data": preserve_runtime_data},
    )

    queued = False
    if is_queue_enabled(QUEUE_FLAG_SITE_STUDIO, default=True):
        payload = dict(_queue_task_payload(instance, "site_studio_destroy", job_id=job_id))
        payload["preserve_runtime_data"] = preserve_runtime_data
        queued = await get_rabbitmq_service().publish(QUEUE_SITE_STUDIO, payload)
    if queued:
        await mark_lifecycle_job_queued(db, job_id, queued=True)
        await db.commit()
        return Response(status_code=status.HTTP_202_ACCEPTED)

    if env_flag("ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK", default=False):
        await mark_lifecycle_job_queued(db, job_id, queued=False)
        await db.commit()
        try:
            async with runtime_manager.runtime_operation_lock(instance):
                runtime_manager.invalidate_admin_token(instance)
                await runtime_manager.destroy(instance, preserve_runtime_data=preserve_runtime_data)
        except Exception as exc:  # noqa: BLE001
            await mark_lifecycle_job_failed(db, job_id, stage="destroy_failed", error=str(exc))
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to delete Site Studio instance: {exc}",
            ) from exc
        await mark_lifecycle_job_succeeded(db, job_id, stage="destroyed")
        await db.delete(instance)
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


@router.post("/instance/publish", response_model=SiteStudioInstanceResponse)
async def publish_site_studio_instance(
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioInstanceResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    validate_site_studio_lifecycle_action(instance, action="publish")
    _sync_public_site_fields(instance)
    _set_publication_state(instance, SiteStudioPublicationState.OPEN)
    await db.commit()
    await db.refresh(instance)
    await _enqueue_edge_carrier_task(
        instance=instance,
        task_type="site_studio_edge_publish",
        background_tasks=background_tasks,
        db=db,
    )
    await db.refresh(instance)
    return _serialize_instance(instance)


@router.post("/instance/unpublish", response_model=SiteStudioInstanceResponse)
async def unpublish_site_studio_instance(
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioInstanceResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    validate_site_studio_lifecycle_action(instance, action="unpublish")
    _sync_public_site_fields(instance)
    _set_publication_state(instance, SiteStudioPublicationState.CLOSED)
    await db.commit()
    await db.refresh(instance)
    await _enqueue_edge_carrier_task(
        instance=instance,
        task_type="site_studio_edge_unpublish",
        background_tasks=background_tasks,
        db=db,
    )
    await db.refresh(instance)
    return _serialize_instance(instance)


@router.post("/instance/provision", response_model=SiteStudioActionResponse)
async def provision_site_studio_instance(
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioActionResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    worker = await _validate_runtime_action_or_raise(db, instance, action="provision")
    inst: Any = instance
    previous_status = instance.status
    inst.status = SiteStudioStatus.PROVISIONING.value
    inst.last_error = None
    await db.commit()
    queued, job_id = await _queue_or_background_runtime_task(
        instance=instance,
        task_type="site_studio_provision",
        background_tasks=background_tasks,
        db=db,
        previous_status=previous_status,
    )
    return SiteStudioActionResponse(
        status=instance.status,
        queued=queued,
        detail="Provisioning started",
        job_id=job_id,
        worker_ready=bool(worker.get("worker_ready")),
    )


@router.post("/instance/start", response_model=SiteStudioActionResponse)
async def start_site_studio_instance(
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioActionResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    worker = await _validate_runtime_action_or_raise(db, instance, action="start")
    inst: Any = instance
    previous_status = instance.status
    inst.status = SiteStudioStatus.STARTING.value
    inst.last_error = None
    await db.commit()
    queued, job_id = await _queue_or_background_runtime_task(
        instance=instance,
        task_type="site_studio_start",
        background_tasks=background_tasks,
        db=db,
        previous_status=previous_status,
    )
    return SiteStudioActionResponse(
        status=instance.status,
        queued=queued,
        detail="Start queued",
        job_id=job_id,
        worker_ready=bool(worker.get("worker_ready")),
    )


@router.post("/instance/stop", response_model=SiteStudioActionResponse)
async def stop_site_studio_instance(
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioActionResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    worker = await _validate_runtime_action_or_raise(db, instance, action="stop")
    inst: Any = instance
    previous_status = instance.status
    inst.status = SiteStudioStatus.STOPPING.value
    inst.last_error = None
    await db.commit()
    queued, job_id = await _queue_or_background_runtime_task(
        instance=instance,
        task_type="site_studio_stop",
        background_tasks=background_tasks,
        db=db,
        previous_status=previous_status,
    )
    return SiteStudioActionResponse(
        status=instance.status,
        queued=queued,
        detail="Stop queued",
        job_id=job_id,
        worker_ready=bool(worker.get("worker_ready")),
    )


@router.post("/instance/redeploy", response_model=SiteStudioActionResponse)
async def redeploy_site_studio_instance(
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioActionResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    worker = await _validate_runtime_action_or_raise(db, instance, action="redeploy")
    inst: Any = instance
    previous_status = instance.status
    inst.status = SiteStudioStatus.REDEPLOYING.value
    inst.last_error = None
    await db.commit()
    queued, job_id = await _queue_or_background_runtime_task(
        instance=instance,
        task_type="site_studio_redeploy",
        background_tasks=background_tasks,
        db=db,
        previous_status=previous_status,
    )
    return SiteStudioActionResponse(
        status=instance.status,
        queued=queued,
        detail="Redeploy queued",
        job_id=job_id,
        worker_ready=bool(worker.get("worker_ready")),
    )


@router.get("/instance/health", response_model=SiteStudioHealthResponse)
async def get_site_studio_health(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioHealthResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    await reap_stale_lifecycle_jobs(db)
    canonical_fields_changed = _sync_public_site_fields(instance)
    health = await get_site_studio_runtime_manager().health(instance)
    if health["status"] == SiteStudioStatus.RUNNING.value and instance.status != SiteStudioStatus.RUNNING.value:
        inst: Any = instance
        inst.status = SiteStudioStatus.RUNNING.value
        inst.last_error = None
        canonical_fields_changed = True
    if canonical_fields_changed:
        await db.commit()
        await db.refresh(instance)
    health["public_hostname"] = instance.public_hostname
    health["publication_state"] = instance.publication_state
    health["edge"] = build_edge_health_snapshot(instance)
    health.update(await get_lifecycle_diagnostics(db, instance_scope="user", instance_id=instance.id))
    return SiteStudioHealthResponse(**health)


@router.post("/instance/jobs/{job_id}/cancel", response_model=SiteStudioLifecycleJobResponse)
async def cancel_site_studio_lifecycle_job(
    job_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioLifecycleJobResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    row = await cancel_lifecycle_job(db, job_id=job_id, instance_scope="user", instance_id=instance.id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending lifecycle job not found")
    await db.commit()
    return SiteStudioLifecycleJobResponse(**row)


@router.post("/instance/jobs/{job_id}/retry", response_model=SiteStudioActionResponse)
async def retry_site_studio_lifecycle_job(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioActionResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    job = await get_lifecycle_job(db, job_id=job_id, instance_scope="user", instance_id=instance.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lifecycle job not found")
    task_type = str(job["task_type"])
    if task_type == "site_studio_destroy":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Destroy jobs are not retried from UI")
    previous_status = instance.status
    inst: Any = instance
    if task_type in {"site_studio_edge_publish", "site_studio_edge_unpublish"}:
        if not site_edge_carrier_enabled():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="SITE_EDGE_CARRIER_ENABLED is off; cannot retry Edge Carrier jobs",
            )
        worker = await get_worker_readiness(db)
        require_worker = is_queue_enabled(QUEUE_FLAG_SITE_STUDIO, default=True) and not env_flag(
            "ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK",
            default=False,
        )
        if require_worker and not bool(worker.get("worker_ready")):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Site Studio worker is not ready for Edge Carrier retry",
            )
    else:
        action = task_type.removeprefix("site_studio_")
        worker = await _validate_runtime_action_or_raise(db, instance, action=action)
        inst.status = _pending_status_for_task_type(task_type)
    inst.last_error = None
    await cancel_lifecycle_job(
        db, job_id=job_id, instance_scope="user", instance_id=instance.id, reason="retry_superseded"
    )
    await db.commit()
    queued, new_job_id = await _queue_or_background_runtime_task(
        instance=instance,
        task_type=task_type,
        background_tasks=background_tasks,
        db=db,
        previous_status=previous_status,
    )
    return SiteStudioActionResponse(
        status=instance.status,
        queued=queued,
        detail="Retry queued",
        job_id=new_job_id,
        worker_ready=bool(worker.get("worker_ready")),
    )


@router.get("/instance/domains", response_model=list[SiteStudioDomainBindingResponse])
async def list_site_studio_domain_bindings(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> list[SiteStudioDomainBindingResponse]:
    instance = await _require_instance_for_current_user(current_user, db)
    rows = await list_domain_bindings(db, instance_scope="user", instance_id=instance.id)
    return [SiteStudioDomainBindingResponse(**row) for row in rows]


@router.post("/instance/domains", response_model=SiteStudioDomainBindingResponse, status_code=status.HTTP_201_CREATED)
async def create_site_studio_domain_binding(
    body: SiteStudioDomainBindingCreate,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioDomainBindingResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    actor_user_id = await _current_db_user_id(current_user, db)
    row = await create_domain_binding(
        db,
        instance_scope="user",
        instance_id=instance.id,
        hostname=body.hostname,
        actor_user_id=actor_user_id,
    )
    await db.commit()
    return SiteStudioDomainBindingResponse(**row)


@router.post("/instance/domains/{binding_id}/verify", response_model=SiteStudioDomainBindingResponse)
async def verify_site_studio_domain_binding(
    binding_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioDomainBindingResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    actor_user_id = await _current_db_user_id(current_user, db)
    row = await verify_domain_binding(
        db,
        binding_id=binding_id,
        instance_scope="user",
        instance_id=instance.id,
        actor_user_id=actor_user_id,
    )
    await db.commit()
    return SiteStudioDomainBindingResponse(**row)


@router.post("/instance/domains/{binding_id}/request-route", response_model=SiteStudioDomainBindingResponse)
async def request_site_studio_domain_route(
    binding_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioDomainBindingResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    actor_user_id = await _current_db_user_id(current_user, db)
    row = await request_domain_route(
        db,
        binding_id=binding_id,
        instance_scope="user",
        instance_id=instance.id,
        actor_user_id=actor_user_id,
    )
    await db.commit()
    return SiteStudioDomainBindingResponse(**row)


@router.post("/instance/domains/{binding_id}/activate", response_model=SiteStudioDomainBindingResponse)
async def activate_site_studio_domain_binding(
    binding_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioDomainBindingResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    actor_user_id = await _current_db_user_id(current_user, db)
    row = await activate_domain_binding(
        db,
        binding_id=binding_id,
        instance_scope="user",
        instance_id=instance.id,
        actor_user_id=actor_user_id,
    )
    await db.commit()
    return SiteStudioDomainBindingResponse(**row)


@router.post("/instance/domains/{binding_id}/disable", response_model=SiteStudioDomainBindingResponse)
async def disable_site_studio_domain_binding(
    binding_id: UUID,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioDomainBindingResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    actor_user_id = await _current_db_user_id(current_user, db)
    row = await disable_domain_binding(
        db,
        binding_id=binding_id,
        instance_scope="user",
        instance_id=instance.id,
        actor_user_id=actor_user_id,
    )
    await db.commit()
    return SiteStudioDomainBindingResponse(**row)


@router.post("/instance/admin-session", response_model=SiteStudioAdminSessionResponse)
async def create_site_studio_admin_session(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> SiteStudioAdminSessionResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    if _sync_public_site_fields(instance):
        await db.commit()
        await db.refresh(instance)
    await _ensure_runtime_active(instance, db)
    try:
        await get_site_studio_runtime_manager().login_admin(instance)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to establish proxied admin session: {exc}",
        ) from exc
    return SiteStudioAdminSessionResponse(
        authenticated=True,
        proxied=True,
        status=instance.status,
        public_url=instance.public_url,
        api_base_url=instance.api_base_url,
    )


async def proxy_site_studio_request(
    path: str,
    request: Request,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> Response:
    instance = await _require_instance_for_current_user(current_user, db)
    if _sync_public_site_fields(instance):
        await db.commit()
        await db.refresh(instance)
    await _ensure_runtime_active(instance, db)
    return await proxy_site_studio_admin_request(instance=instance, path=path, request=request, db=db)


for _http_method in PROXYABLE_METHODS:
    router.add_api_route(
        "/proxy/{path:path}",
        proxy_site_studio_request,
        methods=[_http_method],
        operation_id=f"proxy_site_studio_{_http_method.lower()}",
    )
