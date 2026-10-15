# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Operator/admin HTTP API for MusicForge stats, run inspection, config revisions, and Comfy probe.
# Invariants:
# - All routes require admin or emperyworld_admin via require_admin_user.
# - Admin run reads are cross-user; public user routes remain scoped in music_forge.py.
# Related:
# - api/schemas/music_forge_admin.py
# - api/services/music_forge/config/
# - documentation/product/MUSIC-FORGE-APP.md
# ---
"""MusicForge admin API router."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import NoReturn
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.routers.admin_auth import require_admin_user
from api.schemas.music_forge_admin import (
    MusicForgeAdminComfyProbeOut,
    MusicForgeAdminConfigActivateOut,
    MusicForgeAdminConfigDiffOut,
    MusicForgeAdminConfigDraftCreate,
    MusicForgeAdminConfigPurgeRetiredOut,
    MusicForgeAdminConfigRevisionDetailOut,
    MusicForgeAdminConfigRevisionListOut,
    MusicForgeAdminConfigRevisionOut,
    MusicForgeAdminConfigVersionPatchIn,
    MusicForgeAdminFailStageCount,
    MusicForgeAdminFeedbackReasonCount,
    MusicForgeAdminFeedbackStatsOut,
    MusicForgeAdminLaneOut,
    MusicForgeAdminLanePatchIn,
    MusicForgeAdminModeCreateIn,
    MusicForgeAdminModeDeleteOut,
    MusicForgeAdminModeOut,
    MusicForgeAdminModePatchIn,
    MusicForgeAdminOverviewOut,
    MusicForgeAdminPreviewAudioIn,
    MusicForgeAdminPreviewAudioOut,
    MusicForgeAdminProductOut,
    MusicForgeAdminProductPatchIn,
    MusicForgeAdminPromptOut,
    MusicForgeAdminPromptPatchIn,
    MusicForgeAdminRunDetailOut,
    MusicForgeAdminRunListOut,
    MusicForgeAdminStageCreateIn,
    MusicForgeAdminStageDeleteOut,
    MusicForgeAdminStageOut,
    MusicForgeAdminStagePatchIn,
    MusicForgeAdminStageTypesOut,
    MusicForgeAdminStyleOut,
    MusicForgeAdminStylePatchIn,
)
from api.services.music_forge.admin_runs_list import (
    admin_run_list_item_from_row,
    build_admin_runs_list_filters,
)
from api.services.music_forge.breaker import (
    get_breaker_state,
    record_upstream_failure,
    record_upstream_success,
)
from api.services.music_forge.config import (
    MusicForgeConfigActivationInvalidError,
    MusicForgeConfigService,
    MusicForgeConfigUnavailableError,
)
from api.services.music_forge.observability import music_forge_metrics_snapshot
from api.services.music_forge.pipeline_repository import run_out_from_rows
from api.services.ugs.provider_manager_service_v2 import ProviderManagerServiceV2

router = APIRouter(prefix="/music-forge/admin", tags=["MusicForge Admin"])


@router.get("/stats/overview", response_model=MusicForgeAdminOverviewOut)
async def music_forge_admin_stats_overview(
    window_hours: int = Query(default=24, ge=1, le=168),
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminOverviewOut:
    """Aggregate run status counts, failure stages, and feedback in a time window."""
    since = datetime.now(UTC) - timedelta(hours=window_hours)
    status_rows = (
        (
            await db.execute(
                text(
                    """
                SELECT status, COUNT(*) AS count
                FROM music_forge_runs
                WHERE created_at >= :since
                GROUP BY status
                ORDER BY status
                """
                ),
                {"since": since},
            )
        )
        .mappings()
        .all()
    )
    fail_rows = (
        (
            await db.execute(
                text(
                    """
                SELECT COALESCE(NULLIF(error_payload->>'stage', ''), NULLIF(error_payload->>'step', ''), 'unknown') AS stage,
                       COUNT(*) AS count
                FROM music_forge_runs
                WHERE status = 'failed'
                  AND created_at >= :since
                GROUP BY 1
                ORDER BY count DESC, stage ASC
                LIMIT 20
                """
                ),
                {"since": since},
            )
        )
        .mappings()
        .all()
    )
    feedback_rows = (
        (
            await db.execute(
                text(
                    """
                SELECT rating, COUNT(*) AS count
                FROM music_forge_feedback
                WHERE created_at >= :since
                GROUP BY rating
                """
                ),
                {"since": since},
            )
        )
        .mappings()
        .all()
    )
    rating_map = {str(row["rating"]): int(row["count"]) for row in feedback_rows}
    redis_counters = await music_forge_metrics_snapshot()
    comfy_breaker = await get_breaker_state("comfy")
    ugs_breaker = await get_breaker_state("ugs")
    return MusicForgeAdminOverviewOut(
        window_hours=window_hours,
        counts_by_status={str(row["status"]): int(row["count"]) for row in status_rows},
        fail_by_stage=[
            MusicForgeAdminFailStageCount(stage=str(row["stage"]), count=int(row["count"])) for row in fail_rows
        ],
        feedback_like=int(rating_map.get("like", 0)),
        feedback_dislike=int(rating_map.get("dislike", 0)),
        # Redis multi-worker counters (не process-local); SQL aggregates — source of truth for runs.
        in_process_counters={
            **redis_counters,
            "breaker_comfy_open": 1 if comfy_breaker.get("open") else 0,
            "breaker_ugs_open": 1 if ugs_breaker.get("open") else 0,
            "breaker_comfy_failures": int(comfy_breaker.get("failures") or 0),
            "breaker_ugs_failures": int(ugs_breaker.get("failures") or 0),
        },
    )


@router.get("/runs", response_model=MusicForgeAdminRunListOut)
async def music_forge_admin_list_runs(
    status: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=120),
    mode_key: str | None = Query(default=None, max_length=64),
    model_lane: str | None = Query(default=None, max_length=64),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminRunListOut:
    """List MusicForge runs across all users (admin operator view)."""
    filters, params = build_admin_runs_list_filters(
        status=status,
        q=q,
        mode_key=mode_key,
        model_lane=model_lane,
    )
    where_clause = " AND ".join(filters)
    params_with_page = {**params, "limit": limit, "offset": offset}
    total = int(
        (
            await db.execute(
                text(f"SELECT COUNT(*) AS count FROM music_forge_runs WHERE {where_clause}"),
                params,
            )
        ).scalar_one()
    )
    rows = (
        (
            await db.execute(
                text(
                    f"""
                SELECT id, user_id, status, idea, language, style_hint, duration_seconds,
                       normalized_input, result_payload, progress_current, progress_total,
                       created_at, updated_at
                FROM music_forge_runs
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
                """
                ),
                params_with_page,
            )
        )
        .mappings()
        .all()
    )
    items = [admin_run_list_item_from_row(row) for row in rows]
    return MusicForgeAdminRunListOut(items=items, total=total, limit=limit, offset=offset)


@router.get("/runs/{run_id}", response_model=MusicForgeAdminRunDetailOut)
async def music_forge_admin_get_run(
    run_id: str,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminRunDetailOut:
    """Return full run state and steps for any user."""
    run = (
        (
            await db.execute(
                text("SELECT * FROM music_forge_runs WHERE id = CAST(:run_id AS uuid)"),
                {"run_id": run_id},
            )
        )
        .mappings()
        .first()
    )
    if run is None:
        raise HTTPException(status_code=404, detail="music forge run not found")
    steps = (
        (
            await db.execute(
                text(
                    """
                SELECT *
                FROM music_forge_run_steps
                WHERE run_id = CAST(:run_id AS uuid)
                ORDER BY step_index ASC
                """
                ),
                {"run_id": run_id},
            )
        )
        .mappings()
        .all()
    )
    payload = run_out_from_rows(dict(run), [dict(step) for step in steps])
    return MusicForgeAdminRunDetailOut(**payload.model_dump(), user_id=UUID(str(run["user_id"])))


@router.get("/feedback/stats", response_model=MusicForgeAdminFeedbackStatsOut)
async def music_forge_admin_feedback_stats(
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminFeedbackStatsOut:
    """Return global like/dislike histogram and top dislike reason codes."""
    rating_rows = (
        (
            await db.execute(
                text(
                    """
                SELECT rating, COUNT(*) AS count
                FROM music_forge_feedback
                GROUP BY rating
                ORDER BY rating
                """
                )
            )
        )
        .mappings()
        .all()
    )
    reason_rows = (
        (
            await db.execute(
                text(
                    """
                SELECT COALESCE(NULLIF(reason_code, ''), 'unspecified') AS reason_code,
                       COUNT(*) AS count
                FROM music_forge_feedback
                WHERE rating = 'dislike'
                GROUP BY 1
                ORDER BY count DESC, reason_code ASC
                LIMIT 15
                """
                )
            )
        )
        .mappings()
        .all()
    )
    return MusicForgeAdminFeedbackStatsOut(
        rating_histogram={str(row["rating"]): int(row["count"]) for row in rating_rows},
        top_reason_codes=[
            MusicForgeAdminFeedbackReasonCount(reason_code=str(row["reason_code"]), count=int(row["count"]))
            for row in reason_rows
        ],
    )


@router.get("/probe/comfy", response_model=MusicForgeAdminComfyProbeOut)
async def music_forge_admin_probe_comfy(
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminComfyProbeOut:
    """Probe ComfyUI provider health using the same path as UGS execution."""
    manager = ProviderManagerServiceV2(db)
    try:
        status_payload = await manager.check_provider_status("comfyui")
    finally:
        await manager.close()
    if not isinstance(status_payload, dict):
        raise HTTPException(status_code=503, detail="comfyui probe returned invalid payload")
    available = bool(status_payload.get("available"))
    if available:
        await record_upstream_success("comfy")
    else:
        await record_upstream_failure("comfy")
    return MusicForgeAdminComfyProbeOut(
        available=available,
        response_time=status_payload.get("response_time"),
        last_checked=status_payload.get("last_checked"),
        status_code=status_payload.get("status_code"),
        error=status_payload.get("error"),
        details={
            key: value
            for key, value in status_payload.items()
            if key not in {"available", "response_time", "last_checked", "status_code", "error"}
        },
    )


@router.get("/config/revisions", response_model=MusicForgeAdminConfigRevisionListOut)
async def music_forge_admin_list_config_revisions(
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminConfigRevisionListOut:
    """Список ревизий конфигурации (строго envelope `{ items, total }`)."""
    rows = await MusicForgeConfigService(db).list_revisions()
    items = [
        MusicForgeAdminConfigRevisionOut(
            id=UUID(str(row["id"])),
            version=str(row["version"]),
            status=str(row["status"]),
            notes=row.get("notes"),
            activated_at=row.get("activated_at"),
            created_by=UUID(str(row["created_by"])) if row.get("created_by") else None,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        for row in rows
    ]
    return MusicForgeAdminConfigRevisionListOut(items=items, total=len(items))


@router.post(
    "/config/revisions/draft",
    response_model=MusicForgeAdminConfigRevisionOut,
    status_code=status.HTTP_201_CREATED,
)
async def music_forge_admin_create_config_draft(
    body: MusicForgeAdminConfigDraftCreate,
    admin: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicForgeAdminConfigRevisionOut:
    """Create draft revision by copying the active bundle (does not activate)."""
    service = MusicForgeConfigService(db)
    try:
        row = await service.create_draft_from_active(
            UUID(str(admin.id)),
            version=body.version,
            notes=body.notes,
        )
    except MusicForgeConfigUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=exc.detail) from exc
    return MusicForgeAdminConfigRevisionOut(
        id=UUID(str(row["id"])),
        version=str(row["version"]),
        status=str(row["status"]),
        notes=row.get("notes"),
        activated_at=row.get("activated_at"),
        created_by=UUID(str(row["created_by"])) if row.get("created_by") else None,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.post(
    "/config/revisions/purge-retired",
    response_model=MusicForgeAdminConfigPurgeRetiredOut,
)
async def music_forge_admin_purge_retired_config_revisions(
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminConfigPurgeRetiredOut:
    """Hard-delete all retired config revisions (CASCADE; does not touch active/draft)."""
    result = await MusicForgeConfigService(db).purge_retired_revisions()
    return MusicForgeAdminConfigPurgeRetiredOut(
        deleted=int(result["deleted"]),
        versions=list(result.get("versions") or []),
    )


@router.patch(
    "/config/revisions/{revision_id}/version",
    response_model=MusicForgeAdminConfigRevisionOut,
)
async def music_forge_admin_rename_config_revision(
    revision_id: UUID,
    body: MusicForgeAdminConfigVersionPatchIn,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminConfigRevisionOut:
    """Rename a revision label (active/draft/retired). UNIQUE version required."""
    service = MusicForgeConfigService(db)
    try:
        row = await service.rename_revision_version(
            revision_id,
            version=body.version,
            notes=body.notes,
        )
    except ValueError as exc:
        detail = str(exc)
        if detail.startswith("music_forge_config_revision_not_found:"):
            raise HTTPException(status_code=404, detail=detail) from exc
        if detail.startswith("music_forge_config_version_conflict:"):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail) from exc
    return MusicForgeAdminConfigRevisionOut(
        id=UUID(str(row["id"])),
        version=str(row["version"]),
        status=str(row["status"]),
        notes=row.get("notes"),
        activated_at=row.get("activated_at"),
        created_by=UUID(str(row["created_by"])) if row.get("created_by") else None,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("/config/revisions/{revision_id}", response_model=MusicForgeAdminConfigRevisionDetailOut)
async def music_forge_admin_get_config_revision(
    revision_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminConfigRevisionDetailOut:
    """Return full config bundle for one revision."""
    service = MusicForgeConfigService(db)
    try:
        bundle = await service.get_revision_bundle(revision_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    revision = bundle["revision"]
    return MusicForgeAdminConfigRevisionDetailOut(
        revision=MusicForgeAdminConfigRevisionOut(
            id=UUID(str(revision["id"])),
            version=str(revision["version"]),
            status=str(revision["status"]),
            notes=revision.get("notes"),
            activated_at=revision.get("activated_at"),
            created_by=UUID(str(revision["created_by"])) if revision.get("created_by") else None,
            created_at=revision["created_at"],
            updated_at=revision["updated_at"],
        ),
        lanes=bundle["lanes"],
        styles=bundle["styles"],
        prompts=bundle["prompts"],
        product=bundle["product"],
        modes=bundle.get("modes") or {},
        pipelines=bundle.get("pipelines") or {},
    )


@router.get("/config/revisions/{revision_id}/diff", response_model=MusicForgeAdminConfigDiffOut)
async def music_forge_admin_diff_config_revision(
    revision_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminConfigDiffOut:
    """Diff target revision against the active revision."""
    service = MusicForgeConfigService(db)
    try:
        payload = await service.diff_revision_against_active(revision_id)
    except MusicForgeConfigUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=exc.detail) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return MusicForgeAdminConfigDiffOut(**payload)


def _raise_config_patch_error(exc: ValueError) -> NoReturn:
    message = str(exc)
    if (
        message.startswith("music_forge_config_revision_not_draft:")
        or message.startswith("music_forge_config_lane_ugs_workflow_invalid:")
        or message.startswith("music_forge_config_lane_workflow_file_empty")
        or message.startswith("music_forge_config_lane_patch_invalid_fields:")
        or message.startswith("music_forge_config_prompt_kind_invalid:")
        or message.startswith("music_forge_config_prompt_patch_invalid_fields:")
        or message.startswith("music_forge_config_style_patch_invalid_fields:")
        or message.startswith("music_forge_config_product_patch_invalid_fields:")
        or message.startswith("music_forge_config_mode_patch_invalid_fields:")
        or message.startswith("music_forge_config_mode_lane_key_")
        or message.startswith("music_forge_config_mode_key_")
        or message.startswith("music_forge_config_mode_labels_required")
        or message.startswith("music_forge_config_mode_delete_last")
        or message.startswith("music_forge_config_stage_patch_invalid_fields:")
        or message.startswith("music_forge_config_stage_settings_invalid")
        or message.startswith("music_forge_config_stage_key_")
        or message.startswith("music_forge_config_stage_type_invalid:")
        or message.startswith("music_forge_config_stage_delete_last_audio_comfy:")
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message) from exc
    raise HTTPException(status_code=404, detail=message) from exc


@router.patch(
    "/config/revisions/{revision_id}/product",
    response_model=MusicForgeAdminProductOut,
)
async def music_forge_admin_patch_config_product(
    revision_id: UUID,
    body: MusicForgeAdminProductPatchIn,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminProductOut:
    """Patch product_settings on a draft revision."""
    service = MusicForgeConfigService(db)
    patch = body.model_dump(exclude_unset=True)
    try:
        row = await service.patch_product_settings(revision_id, patch)
        return MusicForgeAdminProductOut.model_validate(row)
    except ValueError as exc:
        _raise_config_patch_error(exc)


@router.patch(
    "/config/revisions/{revision_id}/lanes/{lane_key}",
    response_model=MusicForgeAdminLaneOut,
)
async def music_forge_admin_patch_config_lane(
    revision_id: UUID,
    lane_key: str,
    body: MusicForgeAdminLanePatchIn,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminLaneOut:
    """Patch one lane (ugs_workflow/sampler/…) on a draft revision."""
    service = MusicForgeConfigService(db)
    patch = body.model_dump(exclude_unset=True)
    try:
        row = await service.patch_lane_settings(revision_id, lane_key, patch)
        return MusicForgeAdminLaneOut.model_validate(row)
    except ValueError as exc:
        _raise_config_patch_error(exc)


@router.patch(
    "/config/revisions/{revision_id}/prompts/{kind}",
    response_model=MusicForgeAdminPromptOut,
)
async def music_forge_admin_patch_config_prompt(
    revision_id: UUID,
    kind: str,
    body: MusicForgeAdminPromptPatchIn,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminPromptOut:
    """Patch one prompt template on a draft revision."""
    service = MusicForgeConfigService(db)
    patch = body.model_dump(exclude_unset=True)
    try:
        row = await service.patch_prompt_settings(revision_id, kind, patch)
        return MusicForgeAdminPromptOut.model_validate(row)
    except ValueError as exc:
        _raise_config_patch_error(exc)


@router.patch(
    "/config/revisions/{revision_id}/styles/{style_key}",
    response_model=MusicForgeAdminStyleOut,
)
async def music_forge_admin_patch_config_style(
    revision_id: UUID,
    style_key: str,
    body: MusicForgeAdminStylePatchIn,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminStyleOut:
    """Patch one style profile on a draft revision."""
    service = MusicForgeConfigService(db)
    patch = body.model_dump(exclude_unset=True)
    try:
        row = await service.patch_style_settings(revision_id, style_key, patch)
        return MusicForgeAdminStyleOut.model_validate(row)
    except ValueError as exc:
        _raise_config_patch_error(exc)


@router.get("/config/stage-types", response_model=MusicForgeAdminStageTypesOut)
async def music_forge_admin_list_stage_types(
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminStageTypesOut:
    """Closed stage-type catalog for Pipeline Builder (Wave C)."""
    from api.services.music_forge.config.admin_ops_pipeline import stage_types_catalog

    return MusicForgeAdminStageTypesOut(**stage_types_catalog())


@router.post(
    "/config/revisions/{revision_id}/modes",
    response_model=MusicForgeAdminModeOut,
    status_code=status.HTTP_201_CREATED,
)
async def music_forge_admin_create_config_mode(
    revision_id: UUID,
    body: MusicForgeAdminModeCreateIn,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminModeOut:
    """Add a Mode on a draft revision with the canonical seeded pipeline."""
    service = MusicForgeConfigService(db)
    try:
        row = await service.create_mode(
            revision_id,
            mode_key=body.mode_key,
            label_ru=body.label_ru,
            label_en=body.label_en,
            lane_key=body.lane_key,
            description=body.description,
            enabled=body.enabled,
            is_default=body.is_default,
            sort_order=body.sort_order,
            style_hint_default=body.style_hint_default,
        )
        return MusicForgeAdminModeOut.model_validate(row)
    except ValueError as exc:
        _raise_config_patch_error(exc)


@router.patch(
    "/config/revisions/{revision_id}/modes/{mode_key}",
    response_model=MusicForgeAdminModeOut,
)
async def music_forge_admin_patch_config_mode(
    revision_id: UUID,
    mode_key: str,
    body: MusicForgeAdminModePatchIn,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminModeOut:
    """Patch one Mode on a draft revision."""
    service = MusicForgeConfigService(db)
    patch = body.model_dump(exclude_unset=True)
    try:
        row = await service.patch_mode_settings(revision_id, mode_key, patch)
        return MusicForgeAdminModeOut.model_validate(row)
    except ValueError as exc:
        _raise_config_patch_error(exc)


@router.delete(
    "/config/revisions/{revision_id}/modes/{mode_key}",
    response_model=MusicForgeAdminModeDeleteOut,
)
async def music_forge_admin_delete_config_mode(
    revision_id: UUID,
    mode_key: str,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminModeDeleteOut:
    """Delete a Mode (blocked when it is the last Mode on the revision)."""
    service = MusicForgeConfigService(db)
    try:
        row = await service.delete_mode(revision_id, mode_key)
        return MusicForgeAdminModeDeleteOut.model_validate(row)
    except ValueError as exc:
        _raise_config_patch_error(exc)


@router.patch(
    "/config/revisions/{revision_id}/modes/{mode_key}/stages/{stage_key}",
    response_model=MusicForgeAdminStageOut,
)
async def music_forge_admin_patch_config_stage(
    revision_id: UUID,
    mode_key: str,
    stage_key: str,
    body: MusicForgeAdminStagePatchIn,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminStageOut:
    """Patch one pipeline stage instance on a draft Mode."""
    service = MusicForgeConfigService(db)
    patch = body.model_dump(exclude_unset=True)
    try:
        row = await service.patch_stage_settings(revision_id, mode_key, stage_key, patch)
        return MusicForgeAdminStageOut.model_validate(row)
    except ValueError as exc:
        _raise_config_patch_error(exc)


@router.post(
    "/config/revisions/{revision_id}/modes/{mode_key}/stages",
    response_model=MusicForgeAdminStageOut,
    status_code=status.HTTP_201_CREATED,
)
async def music_forge_admin_create_config_stage(
    revision_id: UUID,
    mode_key: str,
    body: MusicForgeAdminStageCreateIn,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminStageOut:
    """Add a stage instance from the closed stage-type registry."""
    service = MusicForgeConfigService(db)
    try:
        row = await service.create_stage(
            revision_id,
            mode_key,
            stage_key=body.stage_key,
            stage_type=body.stage_type,
            title_ru=body.title_ru,
            sort_order=body.sort_order,
            enabled=body.enabled,
            settings=body.settings,
        )
        return MusicForgeAdminStageOut.model_validate(row)
    except ValueError as exc:
        _raise_config_patch_error(exc)


@router.delete(
    "/config/revisions/{revision_id}/modes/{mode_key}/stages/{stage_key}",
    response_model=MusicForgeAdminStageDeleteOut,
)
async def music_forge_admin_delete_config_stage(
    revision_id: UUID,
    mode_key: str,
    stage_key: str,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminStageDeleteOut:
    """Delete a stage instance (blocked if last enabled audio_comfy)."""
    service = MusicForgeConfigService(db)
    try:
        row = await service.delete_stage(revision_id, mode_key, stage_key)
        return MusicForgeAdminStageDeleteOut.model_validate(row)
    except ValueError as exc:
        _raise_config_patch_error(exc)


@router.post(
    "/config/revisions/{revision_id}/preview-audio-payload",
    response_model=MusicForgeAdminPreviewAudioOut,
)
async def music_forge_admin_preview_audio_payload(
    revision_id: UUID,
    body: MusicForgeAdminPreviewAudioIn,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: User = Depends(require_admin_user),
) -> MusicForgeAdminPreviewAudioOut:
    """Dry-run UGS→Comfy input_data for a revision (no enqueue)."""
    service = MusicForgeConfigService(db)
    try:
        payload = await service.preview_audio_payload(
            revision_id,
            idea=body.idea,
            style_hint=body.style_hint,
            constraints=body.constraints,
            language=body.language,
            duration_seconds=body.duration_seconds,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return MusicForgeAdminPreviewAudioOut(**payload)


@router.post(
    "/config/revisions/{revision_id}/activate",
    response_model=MusicForgeAdminConfigActivateOut,
    status_code=status.HTTP_200_OK,
)
async def music_forge_admin_activate_config_revision(
    revision_id: UUID,
    admin: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicForgeAdminConfigActivateOut:
    """Активировать ревизию после hard-gate валидации bundle."""
    service = MusicForgeConfigService(db)
    try:
        row = await service.activate_revision(revision_id, UUID(str(admin.id)))
    except MusicForgeConfigActivationInvalidError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "music_forge_config_activation_invalid", "reasons": list(exc.reasons)},
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return MusicForgeAdminConfigActivateOut(
        id=UUID(str(row["id"])),
        version=str(row["version"]),
        status=str(row["status"]),
        activated_at=row.get("activated_at"),
        config_generation=row.get("config_generation"),
    )
