# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Site Manager operator operations service: lifecycle overview/repair, DNS/TLS outbox, runtime reconcile,
# template registry, publish smoke and KIRS collaboration state.
# Invariants:
# - Public custom domains never grant admin access; this module only exposes authenticated operator data/actions.
# - Destructive repair is not automatic; reconcile and lifecycle jobs mutate only through explicit endpoints.
# - DNS/TLS controller actions are auditable DB state transitions, not direct CoreDNS/certificate file writes.
# Related:
# - api/routers/site_manager_ops.py
# - api/services/site_studio_lifecycle_jobs.py
# - api/services/site_studio_domain_bindings.py
# - documentation/product/SITE-STUDIO.md
# ---
from __future__ import annotations

import os
import re
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, status  # type: ignore[import-untyped]
from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.http_clients import get_httpx_client
from api.services.queue_features import QUEUE_FLAG_SITE_STUDIO, env_flag, is_queue_enabled
from api.services.rabbitmq_service import QUEUE_SITE_STUDIO, get_rabbitmq_service
from api.services.site_studio_lifecycle_jobs import (
    cancel_lifecycle_job,
    create_lifecycle_job,
    get_worker_readiness,
    mark_lifecycle_job_failed,
    mark_lifecycle_job_queued,
)
from api.services.site_studio_lifecycle_policy import validate_site_studio_lifecycle_action
from api.services.site_studio_runtime_service import (
    SITE_STUDIO_OLENTI_API_IMAGE,
    SITE_STUDIO_OLENTI_FRONTEND_IMAGE,
    SITE_STUDIO_RUNTIME_MODE,
    SiteStudioRuntimeError,
    execute_site_studio_runtime_task,
    get_site_studio_runtime_manager,
    normalize_site_studio_template_key,
    resolve_site_studio_template_profile,
    resolve_site_studio_template_profile_id,
)
from api.utils.datetime_helpers import utc_now_naive

SITE_MANAGER_OPS_TRANSITIONAL_STATUSES = {"provisioning", "starting", "redeploying", "stopping"}
SITE_MANAGER_OPS_RUNNING_STATUS = "running"
SITE_MANAGER_OPS_STALE_TRANSITION_SECONDS = int(
    (os.environ.get("SITE_MANAGER_OPS_STALE_TRANSITION_SECONDS") or "900").strip() or "900"
)
SITE_MANAGER_TEMPLATE_KEYS = ("olenti", "allenti", "aurelia")
SITE_MANAGER_OPS_RETRYABLE_TASK_TYPES = {
    "site_studio_provision",
    "site_studio_start",
    "site_studio_stop",
    "site_studio_redeploy",
}
SITE_MANAGER_OPS_OVERVIEW_LIMITS = {
    "jobs": 20,
    "domains": 20,
    "dns_outbox": 20,
    "instances": 40,
    "reconcile": 80,
    "audit_events": 20,
}


def _row_to_dict(row: Any) -> dict[str, Any]:
    data = dict(row or {})
    for key in ("metadata_json", "client_access_json", "brief_json", "ports_json"):
        if key in data and not isinstance(data.get(key), dict):
            data[key] = {}
    return data


def _jsonb_merge_expr(column: str) -> str:
    return f"COALESCE({column}, '{{}}'::jsonb) || CAST(:metadata_json AS jsonb)"


def _limited_overview_rows(rows: list[dict[str, Any]], *, limit: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    visible = rows[:limit]
    return visible, {
        "limit": limit,
        "returned": len(visible),
        "truncated": len(rows) > limit,
    }


async def _get_table_row(
    db: AsyncSession,
    *,
    table: str,
    row_id: UUID | str,
) -> dict[str, Any]:
    if table not in {
        "site_studio_domain_dns_outbox",
        "site_studio_domain_bindings",
        "user_site_instances",
        "project_site_instances",
    }:
        raise ValueError(f"Unsupported audit table: {table}")
    row = (
        (
            await db.execute(
                text(f"SELECT * FROM {table} WHERE id = :row_id LIMIT 1"),
                {"row_id": str(row_id)},
            )
        )
        .mappings()
        .first()
    )
    return _row_to_dict(row)


async def record_ops_audit_event(
    db: AsyncSession,
    *,
    action: str,
    target_type: str,
    target_id: UUID | str | None = None,
    actor_user_id: UUID | str | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    result: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    row = (
        (
            await db.execute(
                text(
                    """
                    INSERT INTO site_manager_ops_audit_events (
                        actor_user_id, action, target_type, target_id,
                        before_json, after_json, result_json, metadata_json
                    )
                    VALUES (
                        :actor_user_id, :action, :target_type, :target_id,
                        CAST(:before_json AS jsonb), CAST(:after_json AS jsonb),
                        CAST(:result_json AS jsonb), CAST(:metadata_json AS jsonb)
                    )
                    RETURNING *
                    """
                ),
                {
                    "actor_user_id": str(actor_user_id) if actor_user_id else None,
                    "action": action,
                    "target_type": target_type,
                    "target_id": str(target_id) if target_id else None,
                    "before_json": _safe_json(before) if before is not None else None,
                    "after_json": _safe_json(after) if after is not None else None,
                    "result_json": _safe_json(result) if result is not None else None,
                    "metadata_json": _safe_json(metadata),
                },
            )
        )
        .mappings()
        .first()
    )
    return _row_to_dict(row)


async def list_ops_audit_events(
    db: AsyncSession,
    *,
    target_type: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"limit": limit}
    where = ""
    if target_type:
        where = "WHERE target_type = :target_type"
        params["target_type"] = target_type
    rows = (
        (
            await db.execute(
                text(
                    f"""
                    SELECT *
                    FROM site_manager_ops_audit_events
                    {where}
                    ORDER BY created_at DESC
                    LIMIT :limit
                    """
                ),
                params,
            )
        )
        .mappings()
        .all()
    )
    return [_row_to_dict(row) for row in rows]


async def get_operator_overview(db: AsyncSession) -> dict[str, Any]:
    worker = await get_worker_readiness(db)
    jobs, jobs_limit = _limited_overview_rows(
        await list_lifecycle_jobs(db, limit=SITE_MANAGER_OPS_OVERVIEW_LIMITS["jobs"] + 1),
        limit=SITE_MANAGER_OPS_OVERVIEW_LIMITS["jobs"],
    )
    domains, domains_limit = _limited_overview_rows(
        await list_domain_bindings_overview(db, limit=SITE_MANAGER_OPS_OVERVIEW_LIMITS["domains"] + 1),
        limit=SITE_MANAGER_OPS_OVERVIEW_LIMITS["domains"],
    )
    outbox, outbox_limit = _limited_overview_rows(
        await list_dns_outbox(db, status_filter=None, limit=SITE_MANAGER_OPS_OVERVIEW_LIMITS["dns_outbox"] + 1),
        limit=SITE_MANAGER_OPS_OVERVIEW_LIMITS["dns_outbox"],
    )
    instances, instances_limit = _limited_overview_rows(
        await list_runtime_instances(db, limit=SITE_MANAGER_OPS_OVERVIEW_LIMITS["instances"] + 1),
        limit=SITE_MANAGER_OPS_OVERVIEW_LIMITS["instances"],
    )
    issues = await build_runtime_reconcile_report(db, limit=SITE_MANAGER_OPS_OVERVIEW_LIMITS["reconcile"] + 1)
    issue_entries, reconcile_limit = _limited_overview_rows(
        issues["entries"],
        limit=SITE_MANAGER_OPS_OVERVIEW_LIMITS["reconcile"],
    )
    issues = {**issues, "entries": issue_entries, "count": len(issue_entries)}
    audit, audit_limit = _limited_overview_rows(
        await list_ops_audit_events(db, limit=SITE_MANAGER_OPS_OVERVIEW_LIMITS["audit_events"] + 1),
        limit=SITE_MANAGER_OPS_OVERVIEW_LIMITS["audit_events"],
    )
    return {
        "worker": worker,
        "jobs": jobs,
        "domains": domains,
        "dns_outbox": outbox,
        "instances": instances,
        "reconcile": issues,
        "audit_events": audit,
        "overview_limits": {
            "jobs": jobs_limit,
            "domains": domains_limit,
            "dns_outbox": outbox_limit,
            "instances": instances_limit,
            "reconcile": reconcile_limit,
            "audit_events": audit_limit,
        },
        "generated_at": utc_now_naive(),
    }


async def list_lifecycle_jobs(
    db: AsyncSession,
    *,
    status_filter: str | None = None,
    scope: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    filters = []
    params: dict[str, Any] = {"limit": limit}
    if status_filter:
        filters.append("status = :status")
        params["status"] = status_filter
    if scope:
        filters.append("instance_scope = :scope")
        params["scope"] = scope
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    rows = (
        (
            await db.execute(
                text(
                    f"""
                    SELECT *
                    FROM site_studio_lifecycle_jobs
                    {where}
                    ORDER BY updated_at DESC
                    LIMIT :limit
                    """
                ),
                params,
            )
        )
        .mappings()
        .all()
    )
    return [_row_to_dict(row) for row in rows]


async def _get_lifecycle_job_by_id(db: AsyncSession, *, job_id: UUID | str) -> dict[str, Any] | None:
    row = (
        (
            await db.execute(
                text(
                    """
                    SELECT *
                    FROM site_studio_lifecycle_jobs
                    WHERE id = :job_id
                    LIMIT 1
                    """
                ),
                {"job_id": str(job_id)},
            )
        )
        .mappings()
        .first()
    )
    data = _row_to_dict(row)
    return data or None


def _instance_table_for_scope(instance_scope: str) -> str:
    return "project_site_instances" if instance_scope == "project" else "user_site_instances"


def _pending_status_for_task_type(task_type: str) -> str:
    if task_type.endswith("_start"):
        return "starting"
    if task_type.endswith("_stop"):
        return "stopping"
    if task_type.endswith("_redeploy"):
        return "redeploying"
    return "provisioning"


def _instance_actor_id(instance_scope: str, instance: dict[str, Any]) -> str | None:
    key = "owner_user_id" if instance_scope == "project" else "user_id"
    value = instance.get(key)
    return str(value) if value else None


def _queue_task_payload(
    *,
    instance_scope: str,
    instance: dict[str, Any],
    task_type: str,
    job_id: UUID | str,
) -> dict[str, Any]:
    return {
        "task_type": task_type,
        "instance_id": str(instance["id"]),
        "user_id": _instance_actor_id(instance_scope, instance),
        "instance_scope": instance_scope,
        "job_id": str(job_id),
    }


def _instance_namespace(instance: dict[str, Any]) -> SimpleNamespace:
    return SimpleNamespace(**instance)


async def _validate_retry_or_raise(
    db: AsyncSession,
    *,
    instance: dict[str, Any],
    task_type: str,
) -> dict[str, Any]:
    action = task_type.removeprefix("site_studio_")
    worker = await get_worker_readiness(db)
    require_worker = is_queue_enabled(QUEUE_FLAG_SITE_STUDIO, default=True) and not env_flag(
        "ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK",
        default=False,
    )
    instance_obj = _instance_namespace(instance)
    validate_site_studio_lifecycle_action(
        instance_obj,
        action=action,
        worker_ready=bool(worker.get("worker_ready")),
        require_worker=require_worker,
    )
    if action in {"provision", "start", "redeploy"}:
        try:
            get_site_studio_runtime_manager().validate_runtime_preflight(str(instance.get("template_key") or ""))
        except SiteStudioRuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return worker


async def _queue_or_background_retry_task(
    db: AsyncSession,
    *,
    background_tasks: BackgroundTasks,
    instance_scope: str,
    instance: dict[str, Any],
    task_type: str,
    previous_status: str,
) -> tuple[bool, UUID]:
    job_id = await create_lifecycle_job(
        db,
        instance=_instance_namespace(instance),
        instance_scope=instance_scope,
        task_type=task_type,
    )
    payload = _queue_task_payload(
        instance_scope=instance_scope,
        instance=instance,
        task_type=task_type,
        job_id=job_id,
    )
    if not is_queue_enabled(QUEUE_FLAG_SITE_STUDIO, default=True):
        await mark_lifecycle_job_queued(db, job_id, queued=False)
        background_tasks.add_task(
            execute_site_studio_runtime_task,
            instance["id"],
            task_type,
            instance_scope=instance_scope,
            job_id=job_id,
        )
        return False, job_id

    published = await get_rabbitmq_service().publish(QUEUE_SITE_STUDIO, payload)
    if published:
        await mark_lifecycle_job_queued(db, job_id, queued=True)
        return True, job_id

    if env_flag("ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK", default=False):
        await mark_lifecycle_job_queued(db, job_id, queued=False)
        background_tasks.add_task(
            execute_site_studio_runtime_task,
            instance["id"],
            task_type,
            instance_scope=instance_scope,
            job_id=job_id,
        )
        return False, job_id

    table = _instance_table_for_scope(instance_scope)
    await db.execute(
        text(
            f"""
            UPDATE {table}
            SET status = :previous_status,
                last_error = :last_error,
                updated_at = :now
            WHERE id = :instance_id
            """
        ),
        {
            "instance_id": str(instance["id"]),
            "previous_status": previous_status,
            "last_error": "Site Studio task queue unavailable",
            "now": utc_now_naive(),
        },
    )
    await mark_lifecycle_job_failed(
        db,
        job_id,
        stage="queue_publish_failed",
        error="RabbitMQ publish failed",
    )
    await db.commit()
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Site Studio task queue unavailable (RabbitMQ publish failed).",
    )


async def cancel_lifecycle_job_for_repair(
    db: AsyncSession,
    *,
    job_id: UUID | str,
    actor_user_id: UUID | str | None = None,
    reason: str = "cancelled_by_site_manager_operator",
) -> dict[str, Any]:
    before = await _get_lifecycle_job_by_id(db, job_id=job_id)
    if before is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lifecycle job not found")
    row = await cancel_lifecycle_job(
        db,
        job_id=job_id,
        instance_scope=str(before["instance_scope"]),
        instance_id=before["instance_id"],
        reason=reason,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending lifecycle job not found")
    await record_ops_audit_event(
        db,
        action="lifecycle_job_cancel",
        target_type="site_studio_lifecycle_job",
        target_id=job_id,
        actor_user_id=actor_user_id,
        before=before,
        after=row,
        result={"reason": reason},
        metadata={
            "instance_scope": before.get("instance_scope"),
            "instance_id": str(before.get("instance_id")),
            "site_slug": before.get("site_slug"),
        },
    )
    await db.commit()
    return row


async def retry_lifecycle_job_for_repair(
    db: AsyncSession,
    *,
    job_id: UUID | str,
    background_tasks: BackgroundTasks,
    actor_user_id: UUID | str | None = None,
) -> dict[str, Any]:
    before_job = await _get_lifecycle_job_by_id(db, job_id=job_id)
    if before_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lifecycle job not found")

    task_type = str(before_job.get("task_type") or "")
    if task_type not in SITE_MANAGER_OPS_RETRYABLE_TASK_TYPES:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Lifecycle job type is not retried from UI")

    instance_scope = "project" if before_job.get("instance_scope") == "project" else "user"
    table = _instance_table_for_scope(instance_scope)
    before_instance = await _get_table_row(db, table=table, row_id=before_job["instance_id"])
    if not before_instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site instance not found")

    worker = await _validate_retry_or_raise(db, instance=before_instance, task_type=task_type)
    previous_status = str(before_instance.get("status") or "")
    pending_status = _pending_status_for_task_type(task_type)
    await db.execute(
        text(
            f"""
            UPDATE {table}
            SET status = :status,
                last_error = NULL,
                updated_at = :now
            WHERE id = :instance_id
            """
        ),
        {
            "instance_id": str(before_instance["id"]),
            "status": pending_status,
            "now": utc_now_naive(),
        },
    )
    await cancel_lifecycle_job(
        db,
        job_id=job_id,
        instance_scope=instance_scope,
        instance_id=before_instance["id"],
        reason="retry_superseded",
    )
    queued, new_job_id = await _queue_or_background_retry_task(
        db,
        background_tasks=background_tasks,
        instance_scope=instance_scope,
        instance={**before_instance, "status": pending_status, "last_error": None},
        task_type=task_type,
        previous_status=previous_status,
    )
    result = {
        "status": pending_status,
        "queued": queued,
        "detail": "Retry queued",
        "job_id": new_job_id,
        "worker_ready": bool(worker.get("worker_ready")),
    }
    await record_ops_audit_event(
        db,
        action="lifecycle_job_retry",
        target_type="site_studio_lifecycle_job",
        target_id=job_id,
        actor_user_id=actor_user_id,
        before=before_job,
        after={"new_job_id": str(new_job_id), "instance_status": pending_status},
        result={**result, "job_id": str(new_job_id)},
        metadata={
            "instance_scope": instance_scope,
            "instance_id": str(before_instance["id"]),
            "site_slug": before_instance.get("site_slug"),
            "task_type": task_type,
        },
    )
    await db.commit()
    return result


async def list_domain_bindings_overview(
    db: AsyncSession,
    *,
    status_filter: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"limit": limit}
    where = ""
    if status_filter:
        where = "WHERE status = :status"
        params["status"] = status_filter
    rows = (
        (
            await db.execute(
                text(
                    f"""
                    SELECT *
                    FROM site_studio_domain_bindings
                    {where}
                    ORDER BY updated_at DESC
                    LIMIT :limit
                    """
                ),
                params,
            )
        )
        .mappings()
        .all()
    )
    return [_row_to_dict(row) for row in rows]


async def list_dns_outbox(
    db: AsyncSession,
    *,
    status_filter: str | None = "pending",
    limit: int = 50,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"limit": limit}
    where = ""
    if status_filter:
        where = "WHERE status = :status"
        params["status"] = status_filter
    rows = (
        (
            await db.execute(
                text(
                    f"""
                    SELECT *
                    FROM site_studio_domain_dns_outbox
                    {where}
                    ORDER BY requested_at ASC
                    LIMIT :limit
                    """
                ),
                params,
            )
        )
        .mappings()
        .all()
    )
    return [_row_to_dict(row) for row in rows]


async def preview_dns_outbox_records(db: AsyncSession, *, limit: int = 100) -> dict[str, Any]:
    rows = await list_dns_outbox(db, status_filter="pending", limit=limit)
    records = [
        {
            "outbox_id": row["id"],
            "hostname": row["hostname"],
            "target_hostname": row["target_hostname"],
            "record": f"{row['hostname'].rstrip('.')} CNAME {row['target_hostname'].rstrip('.')}.",
        }
        for row in rows
    ]
    return {"mode": "dry_run", "records": records, "count": len(records)}


async def mark_dns_outbox_applied(
    db: AsyncSession,
    *,
    outbox_id: UUID | str,
    actor_user_id: UUID | str,
) -> dict[str, Any]:
    now = utc_now_naive()
    before = await _get_table_row(db, table="site_studio_domain_dns_outbox", row_id=outbox_id)
    row = (
        (
            await db.execute(
                text(
                    """
                    UPDATE site_studio_domain_dns_outbox
                    SET status = 'applied',
                        applied_at = :now,
                        metadata_json = metadata_json || CAST(:metadata_json AS jsonb)
                    WHERE id = :outbox_id
                    RETURNING *
                    """
                ),
                {
                    "outbox_id": str(outbox_id),
                    "now": now,
                    "metadata_json": _safe_json({"applied_by_user_id": str(actor_user_id)}),
                },
            )
        )
        .mappings()
        .first()
    )
    data = _row_to_dict(row)
    if data.get("binding_id"):
        await db.execute(
            text(
                """
                UPDATE site_studio_domain_bindings
                SET status = CASE WHEN status = 'verified' THEN 'route_pending' ELSE status END,
                    route_ready_at = COALESCE(route_ready_at, :now),
                    metadata_json = metadata_json || CAST(:metadata_json AS jsonb),
                    updated_at = :now
                WHERE id = :binding_id
                """
            ),
            {
                "binding_id": str(data["binding_id"]),
                "now": now,
                "metadata_json": _safe_json({"dns_outbox_applied_at": now, "applied_by_user_id": str(actor_user_id)}),
            },
        )
    await record_ops_audit_event(
        db,
        action="dns_outbox_mark_applied",
        target_type="site_studio_domain_dns_outbox",
        target_id=outbox_id,
        actor_user_id=actor_user_id,
        before=before,
        after=data,
        metadata={"binding_id": str(data.get("binding_id") or "")},
    )
    return data


async def mark_domain_tls_ready(
    db: AsyncSession,
    *,
    binding_id: UUID | str,
    actor_user_id: UUID | str,
    certificate_summary: str | None = None,
) -> dict[str, Any]:
    now = utc_now_naive()
    before = await _get_table_row(db, table="site_studio_domain_bindings", row_id=binding_id)
    row = (
        (
            await db.execute(
                text(
                    """
                    UPDATE site_studio_domain_bindings
                    SET tls_status = 'ready',
                        last_error = NULL,
                        metadata_json = metadata_json || CAST(:metadata_json AS jsonb),
                        updated_at = :now
                    WHERE id = :binding_id
                    RETURNING *
                    """
                ),
                {
                    "binding_id": str(binding_id),
                    "now": now,
                    "metadata_json": _safe_json(
                        {
                            "tls_ready_at": now,
                            "tls_marked_by_user_id": str(actor_user_id),
                            "certificate_summary": certificate_summary,
                        }
                    ),
                },
            )
        )
        .mappings()
        .first()
    )
    data = _row_to_dict(row)
    if data:
        await db.execute(
            text(
                """
                INSERT INTO site_studio_domain_binding_audit (
                    binding_id, action, actor_user_id, before_json, after_json
                )
                VALUES (:binding_id, 'mark_tls_ready', :actor_user_id, NULL, CAST(:after_json AS jsonb))
                """
            ),
            {"binding_id": str(binding_id), "actor_user_id": str(actor_user_id), "after_json": _safe_json(data)},
        )
        await record_ops_audit_event(
            db,
            action="domain_mark_tls_ready",
            target_type="site_studio_domain_bindings",
            target_id=binding_id,
            actor_user_id=actor_user_id,
            before=before,
            after=data,
        )
    return data


async def list_runtime_instances(
    db: AsyncSession,
    *,
    limit: int = 80,
    offset: int = 0,
    q: str | None = None,
    scope: str | None = None,
    status_filter: str | None = None,
) -> list[dict[str, Any]]:
    filters: list[str] = []
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    if scope:
        filters.append("instance_scope = :scope")
        params["scope"] = scope
    if status_filter:
        filters.append("status = :status")
        params["status"] = status_filter
    if q and q.strip():
        filters.append(
            """
            (
                site_slug ILIKE :q OR site_title ILIKE :q OR public_hostname ILIKE :q
                OR CAST(id AS TEXT) ILIKE :q
            )
            """
        )
        params["q"] = f"%{q.strip()}%"
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    rows = (
        (
            await db.execute(
                text(
                    f"""
                    SELECT *
                    FROM (
                        SELECT 'user' AS instance_scope, id, site_slug, site_title, status, publication_state,
                               public_hostname, public_url, api_base_url, compose_project_name,
                               runtime_dir, source_dir, env_dir, compose_file_path, updated_at,
                               last_error, NULL::uuid AS marketing_project_id,
                               NULL::jsonb AS client_access_json
                        FROM user_site_instances
                        UNION ALL
                        SELECT 'project' AS instance_scope, id, site_slug, site_title, status, publication_state,
                               public_hostname, public_url, api_base_url, compose_project_name,
                               runtime_dir, source_dir, env_dir, compose_file_path, updated_at,
                               last_error, marketing_project_id,
                               client_access_json
                        FROM project_site_instances
                    ) AS site_manager_instances
                    {where}
                    ORDER BY updated_at DESC
                    LIMIT :limit OFFSET :offset
                    """
                ),
                params,
            )
        )
        .mappings()
        .all()
    )
    return [_row_to_dict(row) for row in rows]


def classify_runtime_instance_issue(instance: dict[str, Any], *, now: Any | None = None) -> list[dict[str, Any]]:
    now = now or utc_now_naive()
    issues: list[dict[str, Any]] = []
    status = str(instance.get("status") or "")
    publication = str(instance.get("publication_state") or "")
    compose_project = str(instance.get("compose_project_name") or "").strip()
    updated_at = instance.get("updated_at")
    age_seconds = None
    if updated_at is not None:
        age_seconds = max(0, int((now - updated_at).total_seconds()))
    if publication == "open" and not compose_project:
        issues.append(
            {
                "code": "open_without_runtime_metadata",
                "severity": "critical",
                "next_action": "provision_or_start",
                "message": "Open site has no compose_project_name and will return public 503.",
            }
        )
    if status in SITE_MANAGER_OPS_TRANSITIONAL_STATUSES and (
        age_seconds is None or age_seconds > SITE_MANAGER_OPS_STALE_TRANSITION_SECONDS
    ):
        issues.append(
            {
                "code": "stale_transition_status",
                "severity": "warning",
                "next_action": "inspect_last_job_or_retry",
                "message": f"Instance is stuck in {status}; inspect lifecycle job and retry/cancel.",
                "age_seconds": age_seconds,
            }
        )
    if status == SITE_MANAGER_OPS_RUNNING_STATUS and not compose_project:
        issues.append(
            {
                "code": "running_without_runtime_metadata",
                "severity": "critical",
                "next_action": "reconcile_runtime_metadata",
                "message": "Instance is running in DB but runtime metadata is missing.",
            }
        )
    for field_name in ("runtime_dir", "source_dir", "env_dir", "compose_file_path"):
        raw_path = str(instance.get(field_name) or "").strip()
        if raw_path and not Path(raw_path).exists():
            issues.append(
                {
                    "code": f"missing_{field_name}",
                    "severity": "warning",
                    "next_action": "rebuild_or_reprovision_runtime_files",
                    "message": f"{field_name} points to a missing filesystem path.",
                    "path": raw_path,
                }
            )
    if compose_project:
        issues.append(
            {
                "code": "container_runtime_check_required",
                "severity": "info",
                "next_action": "run_operator_podman_check",
                "message": (
                    "Container presence is not mutated by API reconcile. Operator should compare compose_project_name "
                    "against podman ps before running repair actions."
                ),
                "compose_project_name": compose_project,
            }
        )
    if str(instance.get("last_error") or "").strip():
        issues.append(
            {
                "code": "last_error_present",
                "severity": "info",
                "next_action": "review_error",
                "message": str(instance.get("last_error")),
            }
        )
    return issues


async def build_runtime_reconcile_report(db: AsyncSession, *, limit: int = 100) -> dict[str, Any]:
    instances = await list_runtime_instances(db, limit=limit)
    entries = []
    for instance in instances:
        issues = classify_runtime_instance_issue(instance)
        if issues:
            entries.append({"instance": instance, "issues": issues})
    return {"entries": entries, "count": len(entries), "generated_at": utc_now_naive()}


async def mark_instance_failed_for_repair(
    db: AsyncSession,
    *,
    instance_scope: str,
    instance_id: UUID | str,
    reason: str,
    actor_user_id: UUID | str | None = None,
) -> dict[str, Any]:
    table = "project_site_instances" if instance_scope == "project" else "user_site_instances"
    before = await _get_table_row(db, table=table, row_id=instance_id)
    row = (
        (
            await db.execute(
                text(
                    f"""
                    UPDATE {table}
                    SET status = 'failed',
                        last_error = :reason,
                        updated_at = :now
                    WHERE id = :instance_id
                    RETURNING id, site_slug, status, publication_state, public_hostname, last_error, updated_at
                    """
                ),
                {"instance_id": str(instance_id), "reason": reason[:2000], "now": utc_now_naive()},
            )
        )
        .mappings()
        .first()
    )
    data = _row_to_dict(row)
    await record_ops_audit_event(
        db,
        action="reconcile_mark_failed",
        target_type=f"{instance_scope}_site_instance",
        target_id=instance_id,
        actor_user_id=actor_user_id,
        before=before,
        after=data,
        result={"reason": reason[:2000]},
    )
    return data


def get_template_registry() -> dict[str, Any]:
    templates = []
    for key in SITE_MANAGER_TEMPLATE_KEYS:
        normalized = normalize_site_studio_template_key(key)
        profile = resolve_site_studio_template_profile(normalized) or {}
        profile_id = resolve_site_studio_template_profile_id(normalized)
        blocks = profile.get("blocks")
        site_settings = profile.get("site_settings")
        templates.append(
            {
                "template_key": normalized,
                "profile_id": profile_id,
                "profile_loaded": bool(profile),
                "block_count": len(blocks) if isinstance(blocks, list) else 0,
                "has_site_settings": isinstance(site_settings, dict),
                "runtime_mode": SITE_STUDIO_RUNTIME_MODE,
                "api_image": SITE_STUDIO_OLENTI_API_IMAGE or None,
                "frontend_image": SITE_STUDIO_OLENTI_FRONTEND_IMAGE or None,
                "images_ready": bool(SITE_STUDIO_OLENTI_API_IMAGE and SITE_STUDIO_OLENTI_FRONTEND_IMAGE),
            }
        )
    return {"templates": templates, "runtime_mode": SITE_STUDIO_RUNTIME_MODE}


async def run_publish_quality_smoke(
    db: AsyncSession,
    *,
    instance_scope: str,
    instance_id: UUID | str,
    run_live: bool = False,
    actor_user_id: UUID | str | None = None,
) -> dict[str, Any]:
    table = "project_site_instances" if instance_scope == "project" else "user_site_instances"
    row = (
        (
            await db.execute(
                text(
                    f"""
                    SELECT id, site_slug, status, publication_state, public_hostname, public_url,
                           api_base_url, compose_project_name, last_error
                    FROM {table}
                    WHERE id = :instance_id
                    LIMIT 1
                    """
                ),
                {"instance_id": str(instance_id)},
            )
        )
        .mappings()
        .first()
    )
    instance = _row_to_dict(row)
    checks = _structural_publish_checks(instance)
    if run_live and instance.get("public_url"):
        checks.extend(
            await _live_public_checks(
                str(instance["public_url"]),
                api_base_url=str(instance.get("api_base_url") or "") or None,
            )
        )
    hard_failures = [check for check in checks if check["severity"] == "hard" and not check["ok"]]
    result = {
        "instance_scope": instance_scope,
        "instance_id": str(instance_id),
        "status": "failed" if hard_failures else "passed",
        "checks": checks,
        "hard_failure_count": len(hard_failures),
        "generated_at": utc_now_naive(),
    }
    if actor_user_id:
        await record_ops_audit_event(
            db,
            action="publish_quality_smoke",
            target_type=f"{instance_scope}_site_instance",
            target_id=instance_id,
            actor_user_id=actor_user_id,
            result=result,
        )
    return result


def _structural_publish_checks(instance: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "key": "instance_exists",
            "ok": bool(instance),
            "severity": "hard",
            "message": "Instance row exists.",
        },
        {
            "key": "runtime_metadata",
            "ok": bool(instance.get("compose_project_name")),
            "severity": "hard",
            "message": "Runtime compose metadata is present.",
        },
        {
            "key": "public_url",
            "ok": bool(instance.get("public_url")),
            "severity": "hard",
            "message": "Public storefront URL is present.",
        },
        {
            "key": "not_closed",
            "ok": instance.get("publication_state") != "closed",
            "severity": "soft",
            "message": "Publication state is not closed.",
        },
        {
            "key": "no_last_error",
            "ok": not bool(str(instance.get("last_error") or "").strip()),
            "severity": "soft",
            "message": "Instance has no stored last_error.",
        },
    ]


async def _live_public_checks(public_url: str, *, api_base_url: str | None = None) -> list[dict[str, Any]]:
    client = get_httpx_client()
    out = []
    html = ""
    try:
        response = await client.get(public_url, timeout=8.0)
        html = response.text if "text/html" in response.headers.get("content-type", "") else ""
        out.append(
            {
                "key": "storefront_http",
                "ok": 200 <= response.status_code < 400,
                "severity": "hard",
                "message": f"Storefront returned HTTP {response.status_code}.",
            }
        )
    except Exception as exc:  # noqa: BLE001
        out.append({"key": "storefront_http", "ok": False, "severity": "hard", "message": str(exc)})
    if api_base_url:
        try:
            response = await client.get(f"{api_base_url.rstrip('/')}/health", timeout=8.0)
            out.append(
                {
                    "key": "runtime_api_health",
                    "ok": 200 <= response.status_code < 400,
                    "severity": "hard",
                    "message": f"Runtime /api/health returned HTTP {response.status_code}.",
                }
            )
        except Exception as exc:  # noqa: BLE001
            out.append({"key": "runtime_api_health", "ok": False, "severity": "hard", "message": str(exc)})
    try:
        response = await client.get(f"{public_url.rstrip('/')}/admin/", timeout=8.0)
        out.append(
            {
                "key": "admin_blocked",
                "ok": response.status_code == 404,
                "severity": "hard",
                "message": f"Public /admin returned HTTP {response.status_code}.",
            }
        )
    except Exception as exc:  # noqa: BLE001
        out.append({"key": "admin_blocked", "ok": False, "severity": "hard", "message": str(exc)})
    if html:
        title_ok = bool(re.search(r"<title>\s*[^<]{3,}\s*</title>", html, flags=re.IGNORECASE))
        description_ok = bool(
            re.search(
                r'<meta\s+[^>]*name=["\']description["\'][^>]*content=["\'][^"\']{10,}["\']',
                html,
                flags=re.IGNORECASE,
            )
        )
        out.extend(
            [
                {
                    "key": "seo_title",
                    "ok": title_ok,
                    "severity": "soft",
                    "message": "HTML title is present." if title_ok else "HTML title is missing or too short.",
                },
                {
                    "key": "seo_description",
                    "ok": description_ok,
                    "severity": "soft",
                    "message": (
                        "Meta description is present."
                        if description_ok
                        else "Meta description is missing or too short."
                    ),
                },
            ]
        )
        asset_urls = _extract_public_urls(
            html,
            public_url,
            pattern=r"""(?:src|href)=["']([^"']+\.(?:js|css|png|jpg|jpeg|webp|svg)(?:\?[^"']*)?)["']""",
            limit=5,
        )
        out.append(await _check_urls(client, key="basic_assets", urls=asset_urls, severity="hard"))
        link_urls = _extract_public_urls(
            html,
            public_url,
            pattern=r"""href=["'](/(?!admin|api)[^"'#?]{1,120})["']""",
            limit=5,
        )
        out.append(await _check_urls(client, key="first_level_links", urls=link_urls, severity="soft"))
    return out


def _extract_public_urls(html: str, public_url: str, *, pattern: str, limit: int) -> list[str]:
    origin = public_url.rstrip("/")
    urls: list[str] = []
    for match in re.finditer(pattern, html, flags=re.IGNORECASE):
        raw = match.group(1).strip()
        if raw.startswith("http://") or raw.startswith("https://"):
            url = raw
        elif raw.startswith("/"):
            url = f"{origin}{raw}"
        else:
            continue
        if url not in urls:
            urls.append(url)
        if len(urls) >= limit:
            break
    return urls


async def _check_urls(client: Any, *, key: str, urls: list[str], severity: str) -> dict[str, Any]:
    if not urls:
        return {"key": key, "ok": False, "severity": severity, "message": "No URLs found to check."}
    failures = []
    for url in urls:
        try:
            response = await client.get(url, timeout=8.0)
            if response.status_code >= 400:
                failures.append(f"{url} -> {response.status_code}")
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{url} -> {exc}")
    return {
        "key": key,
        "ok": not failures,
        "severity": severity,
        "message": "OK" if not failures else "; ".join(failures[:3]),
    }


async def get_kirs_collaboration_state(
    db: AsyncSession,
    *,
    project_id: UUID | str,
) -> dict[str, Any]:
    row = (
        (
            await db.execute(
                text(
                    """
                    SELECT id, marketing_project_id, client_access_json
                    FROM project_site_instances
                    WHERE marketing_project_id = :project_id
                    LIMIT 1
                    """
                ),
                {"project_id": str(project_id)},
            )
        )
        .mappings()
        .first()
    )
    data = _row_to_dict(row)
    raw_access = data.get("client_access_json")
    access: dict[str, Any] = raw_access if isinstance(raw_access, dict) else {}
    return {
        "instance_id": data.get("id"),
        "marketing_project_id": data.get("marketing_project_id"),
        "readiness_status": access.get("site_readiness_status", "preparing"),
        "approval_status": access.get("site_approval_status", "not_requested"),
        "operator_notes": access.get("site_operator_notes", ""),
        "handoff_checklist": access.get("site_handoff_checklist", {}),
    }


async def update_kirs_collaboration_state(
    db: AsyncSession,
    *,
    project_id: UUID | str,
    payload: dict[str, Any],
    actor_user_id: UUID | str | None = None,
) -> dict[str, Any]:
    allowed = {
        "site_readiness_status": payload.get("readiness_status"),
        "site_approval_status": payload.get("approval_status"),
        "site_operator_notes": payload.get("operator_notes"),
        "site_handoff_checklist": payload.get("handoff_checklist"),
    }
    clean = {key: value for key, value in allowed.items() if value is not None}
    before = await get_kirs_collaboration_state(db, project_id=project_id)
    row = (
        (
            await db.execute(
                text(
                    f"""
                    UPDATE project_site_instances
                    SET client_access_json = {_jsonb_merge_expr("client_access_json")},
                        updated_at = :now
                    WHERE marketing_project_id = :project_id
                    RETURNING id, marketing_project_id, client_access_json
                    """
                ),
                {"project_id": str(project_id), "metadata_json": _safe_json(clean), "now": utc_now_naive()},
            )
        )
        .mappings()
        .first()
    )
    data = _row_to_dict(row)
    raw_access = data.get("client_access_json")
    access: dict[str, Any] = raw_access if isinstance(raw_access, dict) else {}
    result = {
        "instance_id": data.get("id"),
        "marketing_project_id": data.get("marketing_project_id"),
        "readiness_status": access.get("site_readiness_status", "preparing"),
        "approval_status": access.get("site_approval_status", "not_requested"),
        "operator_notes": access.get("site_operator_notes", ""),
        "handoff_checklist": access.get("site_handoff_checklist", {}),
    }
    await record_ops_audit_event(
        db,
        action="kirs_collaboration_update",
        target_type="kirs_project",
        target_id=project_id,
        actor_user_id=actor_user_id,
        before=before,
        after=result,
    )
    return result


def _safe_json(value: Any) -> str:
    import json

    return json.dumps(value or {}, ensure_ascii=False, default=str)
