# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Task list and tray helpers for UGS Hub endpoints (compact previews, metadata whitelisting, DB queries).
# Invariants:
#   - GET /tasks list must not ship megabyte base64 blobs; image rows use content_id refs only.
#   - Hot list paths call ``maybe_cleanup_stale_request_states`` (throttled); heavy JSONB loaded in a second query.
# Related:
#   - api/routers/ugs/tasks_routes.py
#   - api/services/ugs/queue_manager_service.py
# ---
from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]
from sqlalchemy.orm import load_only  # type: ignore[import-not-found]

from api.models.database_models import GenerationRequest
from api.services.queue_features import derive_public_job_status

_UGS_TASK_LIST_COLUMNS = (
    GenerationRequest.id,
    GenerationRequest.user_id,
    GenerationRequest.type_id,
    GenerationRequest.status,
    GenerationRequest.priority,
    GenerationRequest.project_id,
    GenerationRequest.company_id,
    GenerationRequest.created_at,
    GenerationRequest.updated_at,
    GenerationRequest.started_at,
    GenerationRequest.error_message,
    GenerationRequest.request_metadata,
)


def _compact_image_result_for_task_list(output_data: Any, *, task_status: str) -> dict[str, Any]:
    """
    GET /tasks list must not ship megabyte base64 blobs.
    For completed image jobs, include only unified content refs so the Hub can preview (content_id).
    """
    placeholder: dict[str, Any] = {"message": "Image ready"}
    if task_status != "completed":
        return placeholder
    if not isinstance(output_data, dict):
        return placeholder
    inner = output_data.get("result")
    if not isinstance(inner, dict):
        return placeholder

    compact_images: list[dict[str, Any]] = []
    images = inner.get("images")
    if isinstance(images, list):
        for img in images[:12]:
            if not isinstance(img, dict):
                continue
            cid = img.get("content_id")
            if not cid:
                continue
            compact_images.append(
                {
                    "content_id": str(cid),
                    "storage": img.get("storage"),
                    "mime_type": img.get("mime_type") or "image/png",
                    "filename": img.get("filename") or img.get("name"),
                }
            )

    out = dict(placeholder)
    if compact_images:
        out["images"] = compact_images
        return out

    cid = inner.get("content_id")
    if cid:
        out["content_id"] = str(cid)
        out["mime_type"] = inner.get("mime_type") or "image/png"
        fn = inner.get("filename") or inner.get("image_filename")
        if fn:
            out["filename"] = fn
        return out

    return placeholder


def _compact_metadata_for_task_list(raw: dict[str, Any] | None) -> dict[str, Any]:
    """
    GET /tasks list must not ship full request_metadata (nested workflow state, lyrics, etc.).
    Top-level task fields already duplicate the main keys; this keeps a small JSON for Hub/debug.
    """
    if not isinstance(raw, dict) or not raw:
        return {}
    _max_total = 8192
    _max_nested = 512
    _max_str = 800

    whitelist = (
        "stage",
        "progress",
        "progress_message",
        "execution_backend",
        "provider_name",
        "provider_attempt",
        "retry_count",
        "queued_at",
        "last_heartbeat_at",
        "error_type",
        "type_key",
        "queue_status",
        "idempotency_key",
        "estimated_completion",
        "worker_started_at",
        "processing_started_at",
        "execution_mode",
        "pipeline_id",
        "celery_task_id",
    )
    out: dict[str, Any] = {}
    for key in whitelist:
        if key not in raw:
            continue
        val = raw[key]
        if val is None or isinstance(val, (bool, int, float)):
            out[key] = val
        elif isinstance(val, str):
            out[key] = val[:_max_str] + ("..." if len(val) > _max_str else "")
        elif isinstance(val, (dict, list)):
            try:
                nested = json.dumps(val)
            except (TypeError, ValueError):  # fmt: skip
                continue
            if len(nested) <= _max_nested:
                out[key] = val
            else:
                out[key] = {"_truncated": True, "_approx_bytes": len(nested)}
        else:
            out[key] = str(val)[:_max_str]

    for key, val in raw.items():
        if key in out:
            continue
        if isinstance(val, (dict, list)):
            continue
        if isinstance(val, str):
            out[key] = val[:400] + ("..." if len(val) > 400 else "")
        elif isinstance(val, (bool, int, float)) or val is None:
            out[key] = val
        try:
            if len(json.dumps(out)) > _max_total:
                break
        except (TypeError, ValueError):  # fmt: skip
            break

    try:
        if len(json.dumps(out)) > _max_total:
            return {k: out[k] for k in whitelist if k in out}
    except (TypeError, ValueError):  # fmt: skip
        return {k: out[k] for k in whitelist if k in out}
    return out


def _build_ugs_tray_task_row(task: Any, type_key: str | None) -> dict[str, Any]:
    """Minimal task payload for desktop tray polling and status transition notifications."""
    raw_meta = dict(task.request_metadata) if isinstance(task.request_metadata, dict) else {}
    metadata_compact = _compact_metadata_for_task_list(raw_meta)
    metadata_compact = {
        k: metadata_compact[k]
        for k in (
            "stage",
            "progress",
            "progress_message",
            "queue_status",
            "type_key",
            "processing_started_at",
            "worker_started_at",
        )
        if k in metadata_compact
    }
    return {
        "id": str(task.id),
        "type_key": type_key or raw_meta.get("type_key") or "unknown",
        "status": derive_public_job_status(task.status, raw_meta),
        "created_at": task.created_at.isoformat() if task.created_at is not None else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at is not None else None,
        "started_at": task.started_at.isoformat() if task.started_at is not None else None,
        "last_heartbeat_at": (
            raw_meta.get("last_heartbeat_at") if isinstance(raw_meta.get("last_heartbeat_at"), str) else None
        ),
        "metadata": metadata_compact,
        "stage": raw_meta.get("stage"),
        "progress": raw_meta.get("progress"),
        "progress_message": raw_meta.get("progress_message"),
    }


async def _fetch_ugs_tray_summary(
    db: AsyncSession,
    *,
    user_id: str,
) -> dict[str, Any]:
    """Lightweight payload for desktop tray: active count + short transition feed."""
    from sqlalchemy import func, or_, select  # noqa: PLC0415

    from api.models.database_models import GenerationRequest, GenerationType  # noqa: PLC0415
    from api.services.ugs.queue_manager_service import QueueManagerService  # noqa: PLC0415

    active_statuses = ("queued", "pending", "processing", "retrying")
    transition_statuses = active_statuses + ("completed", "failed", "cancelled")
    recent_window = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=6)

    queue_manager = QueueManagerService(db)
    await queue_manager.maybe_cleanup_stale_request_states()

    status_filter = or_(
        GenerationRequest.status.in_(("pending", "processing", "completed", "failed", "cancelled")),
        GenerationRequest.request_metadata.op("->>")("queue_status").in_(("queued", "retrying")),
    )

    active_filter = or_(
        GenerationRequest.status.in_(("pending", "processing")),
        GenerationRequest.request_metadata.op("->>")("queue_status").in_(("queued", "retrying")),
    )

    active_count_query = (
        select(func.count())
        .select_from(GenerationRequest)
        .where(
            GenerationRequest.deleted_at.is_(None),
            GenerationRequest.user_id == user_id,
            active_filter,
        )
    )
    active_count_result = await db.execute(active_count_query)
    active_count = int(active_count_result.scalar() or 0)

    active_query = (
        select(GenerationRequest, GenerationType.type_key.label("generation_type_key"))
        .outerjoin(GenerationType, GenerationRequest.type_id == GenerationType.id)
        .where(
            GenerationRequest.deleted_at.is_(None),
            GenerationRequest.user_id == user_id,
            active_filter,
        )
        .order_by(GenerationRequest.updated_at.desc(), GenerationRequest.created_at.desc())
        .limit(30)
    )
    active_rows = (await db.execute(active_query)).all()
    active_tasks: list[dict[str, Any]] = []
    for row in active_rows:
        item = _build_ugs_tray_task_row(task=row[0], type_key=row[1])
        if item.get("status") in active_statuses:
            active_tasks.append(item)

    recent_query = (
        select(GenerationRequest, GenerationType.type_key.label("generation_type_key"))
        .outerjoin(GenerationType, GenerationRequest.type_id == GenerationType.id)
        .where(
            GenerationRequest.deleted_at.is_(None),
            GenerationRequest.user_id == user_id,
            status_filter,
            GenerationRequest.updated_at >= recent_window,
        )
        .order_by(GenerationRequest.updated_at.desc(), GenerationRequest.created_at.desc())
        .limit(60)
    )
    recent_rows = (await db.execute(recent_query)).all()
    recent_transitions: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in recent_rows:
        item = _build_ugs_tray_task_row(task=row[0], type_key=row[1])
        task_id = str(item.get("id") or "")
        if not task_id or task_id in seen:
            continue
        if item.get("status") not in transition_statuses:
            continue
        seen.add(task_id)
        recent_transitions.append(item)

    return {
        "active_count": active_count,
        "active_tasks": active_tasks,
        "recent_transitions": recent_transitions,
        "server_time": datetime.now(UTC).isoformat(),
    }


# ========================================
# UGS HUB ENDPOINTS
# ========================================


async def _fetch_ugs_hub_tasks_list(
    db: AsyncSession,
    *,
    filter_user_id: str | None,
    status: str | None,
    limit: int,
    offset: int,
    compact_list: bool = False,
) -> list[dict[str, Any]]:
    """Shared list payload for /tasks and /admin/tasks (same shape, truncated previews).

    compact_list: для опроса tray / мобильных клиентов — без input_data и без тяжёлых превью
    (только id, статусы, type_key, тайминги, короткие метаданные).
    """
    from sqlalchemy import select  # noqa: PLC0415

    from api.models.database_models import GenerationRequest, GenerationType  # noqa: PLC0415
    from api.services.ugs.queue_manager_service import QueueManagerService  # noqa: PLC0415

    queue_manager = QueueManagerService(db)
    await queue_manager.maybe_cleanup_stale_request_states()

    query = (
        select(GenerationRequest, GenerationType.type_key.label("generation_type_key"))
        .outerjoin(GenerationType, GenerationRequest.type_id == GenerationType.id)
        .where(GenerationRequest.deleted_at.is_(None))
        .options(load_only(*_UGS_TASK_LIST_COLUMNS))
    )
    if filter_user_id is not None:
        query = query.where(GenerationRequest.user_id == filter_user_id)

    if status:
        normalized_status = status.lower().strip()
        if normalized_status in {"queued", "retrying"}:
            query = query.where(GenerationRequest.request_metadata.op("->>")("queue_status") == normalized_status)
        else:
            query = query.where(GenerationRequest.status == normalized_status)

    query = query.order_by(GenerationRequest.created_at.desc()).offset(offset).limit(min(limit, 500))

    result = await db.execute(query)
    rows = result.all()

    heavy_payloads: dict[Any, tuple[Any, Any]] = {}
    if rows and not compact_list:
        request_ids = [row[0].id for row in rows]
        heavy_result = await db.execute(
            select(
                GenerationRequest.id,
                GenerationRequest.input_data,
                GenerationRequest.output_data,
            ).where(GenerationRequest.id.in_(request_ids))
        )
        heavy_payloads = {row.id: (row.input_data, row.output_data) for row in heavy_result}

    task_list: list[dict[str, Any]] = []
    _max_input_preview = 2048  # list view: never return huge payloads
    _max_error_list = 800 if compact_list else 12000

    def _truncate_input(data: Any) -> Any:
        if data is None:
            return None
        if isinstance(data, dict):
            return {k: _truncate_input(v) for k, v in list(data.items())[:20]}
        if isinstance(data, list):
            return [_truncate_input(x) for x in data[:10]]
        if isinstance(data, str) and len(data) > 500:
            return data[:500] + "..."
        return data

    for row in rows:
        task = row[0]
        type_key = row[1]
        input_data, output_data = heavy_payloads.get(task.id, (None, None))

        tk_lower = (type_key or "").lower()
        if compact_list:
            preview_payload = {"_preview": "available"}
        elif "image" in tk_lower:
            preview_payload = _compact_image_result_for_task_list(
                output_data,
                task_status=str(task.status or ""),
            )
        else:
            preview_payload = {"_preview": "available"}

        input_preview: Any = None
        if not compact_list:
            input_preview = input_data
            if input_preview is not None:
                try:
                    import json as _json

                    s = _json.dumps(input_preview)
                    if len(s) > _max_input_preview:
                        input_preview = _truncate_input(input_preview)
                        s2 = _json.dumps(input_preview)
                        if len(s2) > _max_input_preview:
                            input_preview = {
                                "_truncated": True,
                                "_keys": list(input_preview.keys())[:15] if isinstance(input_preview, dict) else [],
                            }
                except Exception:
                    input_preview = {}

        raw_meta = dict(task.request_metadata) if isinstance(task.request_metadata, dict) else {}
        metadata_compact = _compact_metadata_for_task_list(raw_meta)
        if compact_list:
            metadata_compact = {
                k: metadata_compact[k]
                for k in (
                    "stage",
                    "progress",
                    "progress_message",
                    "queue_status",
                    "type_key",
                    "processing_started_at",
                    "worker_started_at",
                )
                if k in metadata_compact
            }

        err_raw = task.error_message or ""
        err_out = err_raw if len(err_raw) <= _max_error_list else err_raw[:_max_error_list] + "..."

        task_dict = {
            "id": str(task.id),
            "type_key": type_key or raw_meta.get("type_key") or "unknown",
            "status": derive_public_job_status(task.status, raw_meta),
            "created_at": task.created_at.isoformat() if task.created_at is not None else None,
            "updated_at": task.updated_at.isoformat() if task.updated_at is not None else None,
            "started_at": task.started_at.isoformat() if task.started_at is not None else None,
            "result": preview_payload,
            "result_preview": preview_payload,
            "metadata": metadata_compact,
            "stage": raw_meta.get("stage"),
            "progress": raw_meta.get("progress"),
            "progress_message": raw_meta.get("progress_message"),
            "execution_backend": None if compact_list else raw_meta.get("execution_backend"),
            "provider_name": None if compact_list else raw_meta.get("provider_name"),
            "provider_attempt": None if compact_list else raw_meta.get("provider_attempt"),
            "retry_count": raw_meta.get("retry_count"),
            "queued_at": None if compact_list else raw_meta.get("queued_at"),
            "last_heartbeat_at": None if compact_list else raw_meta.get("last_heartbeat_at"),
            "error": err_out,
            "error_type": raw_meta.get("error_type"),
            "user_id": str(task.user_id),
            "priority": task.priority,
            "input_data": input_preview,
        }
        if compact_list:
            task_dict["compact"] = True

        if task.project_id is not None:
            task_dict["project_id"] = str(task.project_id)
        else:
            task_dict["project_id"] = None

        if task.company_id is not None:
            task_dict["company_id"] = str(task.company_id)
        else:
            task_dict["company_id"] = None

        task_list.append(task_dict)

    return task_list
