# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# FastAPI admin router for Professional Worlds vertical packs, modules, schemas, AI actions, playbooks,
# presets, integrations, and AI evaluation datasets/runs.
# Invariants:
# - Every endpoint requires existing EliteEW admin authorization.
# - Mutations are safe-upsert or safe-disable by default and write audit rows.
# Related:
# - api/services/professional_worlds/admin_service.py
# - api/services/professional_worlds/evaluation_service.py
# - documentation/product/PROFESSIONAL-WORLDS.md
# ---

from __future__ import annotations

from typing import NoReturn
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.routers.admin_auth import require_admin_user, require_emperyworld_admin
from api.routers.ugs import get_ugs_service
from api.schemas.professional_worlds import (
    AdminProfessionalPlaybookCreate,
    AdminProfessionalPlaybookOut,
    AdminProfessionalPlaybookUpdate,
    AdminProfessionVerticalCreate,
    AdminProfessionVerticalOut,
    AdminProfessionVerticalUpdate,
    ProfessionalAdminAuditLogOut,
    ProfessionalAiActionCreate,
    ProfessionalAiActionOut,
    ProfessionalAiActionPromptInspectOut,
    ProfessionalAiActionTestOut,
    ProfessionalAiActionUpdate,
    ProfessionalAiEvalDashboardOut,
    ProfessionalAiEvalDatasetCreate,
    ProfessionalAiEvalDatasetOut,
    ProfessionalAiEvalDatasetUpdate,
    ProfessionalAiEvalHumanNotesBody,
    ProfessionalAiEvalRunCreateBody,
    ProfessionalAiEvalRunOut,
    ProfessionalAiEvalRunSampleOut,
    ProfessionalIntegrationBindingOut,
    ProfessionalIntegrationBindingUpdate,
    ProfessionalModuleCreate,
    ProfessionalModuleOut,
    ProfessionalModuleUpdate,
    ProfessionalPackDiffOut,
    ProfessionalPackImportConfirmOut,
    ProfessionalPackImportJobCreateOut,
    ProfessionalPackImportJobOut,
    ProfessionalPackManifestSnapshotBody,
    ProfessionalPackReleaseApproveBody,
    ProfessionalPackReleaseCreateBody,
    ProfessionalPackReleaseOut,
    ProfessionalPackVersionCreateBody,
    ProfessionalPhotoPresetCreate,
    ProfessionalPhotoPresetOut,
    ProfessionalPhotoPresetPromptInspectOut,
    ProfessionalPhotoPresetTestOut,
    ProfessionalPhotoPresetUpdate,
    ProfessionalPlaybookDryRunOut,
    ProfessionalPlaybookDryRunRequest,
    ProfessionalRolloutCreateBody,
    ProfessionalRolloutPatchBody,
    ProfessionalVerticalModuleOut,
    ProfessionalVerticalModuleUpsert,
    ProfessionalVerticalPackExportOut,
    ProfessionalVerticalPackVersionOut,
    ProfessionalVerticalRolloutMutateOut,
    ProfessionalVerticalRolloutOut,
    ProfessionalVerticalSchemaCreate,
    ProfessionalVerticalSchemaOut,
    ProfessionalVerticalSchemaUpdate,
    ProfessionalWorldsAdminOverview,
    ProfessionalWorldsOpsMetricsOut,
    VerticalPackImportRequest,
    VerticalPackImportResult,
)
from api.services.professional_worlds import ProfessionalWorldsAdminService
from api.services.professional_worlds.evaluation_service import ProfessionalWorldsEvaluationService
from api.services.professional_worlds.ops_metrics_service import build_ops_metrics
from api.services.professional_worlds.pack_service import ProfessionalWorldsPackService
from api.services.professional_worlds.playbook_service import ProfessionalWorldsPlaybookService
from api.services.professional_worlds.service import ProfessionalWorldsService
from api.services.ugs.unified_generation_service import UnifiedGenerationService

router = APIRouter(prefix="/professional-worlds/admin", tags=["Professional Worlds Admin"])


def _admin_user_id(user: User) -> UUID | None:
    """Best-effort admin UUID for audit logs."""
    try:
        return UUID(str(user.id))
    except (TypeError, ValueError):  # fmt: skip
        return None


def _pack_service(db: AsyncSession) -> ProfessionalWorldsPackService:
    """Construct pack orchestration service."""
    return ProfessionalWorldsPackService(db)


def _service(db: AsyncSession) -> ProfessionalWorldsAdminService:
    """Construct admin service."""
    return ProfessionalWorldsAdminService(db)


def _playbook_service(db: AsyncSession) -> ProfessionalWorldsPlaybookService:
    """Construct playbook read/dry-run service."""
    return ProfessionalWorldsPlaybookService(db)


def _worlds_service(db: AsyncSession) -> ProfessionalWorldsService:
    """Construct user-facing worlds service (shared DB pool; evaluation uses it for action resolution)."""
    return ProfessionalWorldsService(db)


def _evaluation_service(db: AsyncSession) -> ProfessionalWorldsEvaluationService:
    """Construct Professional Worlds AI evaluation persistence service."""
    return ProfessionalWorldsEvaluationService(db)


def _not_found(message: str) -> NoReturn:
    """Raise admin 404."""
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)


@router.get("/overview", response_model=ProfessionalWorldsAdminOverview)
async def admin_overview(
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalWorldsAdminOverview:
    """Return Professional Worlds admin overview."""
    return ProfessionalWorldsAdminOverview.model_validate(await _service(db).overview())


@router.get("/ops/metrics", response_model=ProfessionalWorldsOpsMetricsOut)
async def admin_ops_metrics(
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalWorldsOpsMetricsOut:
    """Return Professional Worlds ops probes and 24h usage aggregates."""
    return ProfessionalWorldsOpsMetricsOut.model_validate(await build_ops_metrics(db))


@router.get("/verticals", response_model=list[AdminProfessionVerticalOut])
async def admin_list_verticals(
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[AdminProfessionVerticalOut]:
    """List profession verticals."""
    return [AdminProfessionVerticalOut.model_validate(_row) for _row in (await _service(db).list_verticals())]


@router.post("/verticals", response_model=AdminProfessionVerticalOut, status_code=status.HTTP_201_CREATED)
async def admin_create_vertical(
    payload: AdminProfessionVerticalCreate,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> AdminProfessionVerticalOut:
    """Create or upsert profession vertical."""
    return AdminProfessionVerticalOut.model_validate(await _service(db).create_vertical(_admin_user_id(admin), payload))


@router.patch("/verticals/{slug}", response_model=AdminProfessionVerticalOut)
async def admin_update_vertical(
    slug: str,
    payload: AdminProfessionVerticalUpdate,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> AdminProfessionVerticalOut:
    """Patch profession vertical."""
    row = await _service(db).update_vertical(_admin_user_id(admin), slug, payload)
    if row is None:
        _not_found("Vertical not found")
    return AdminProfessionVerticalOut.model_validate(row)


@router.delete("/verticals/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_disable_vertical(
    slug: str,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> None:
    """Safe-disable vertical."""
    ok = await _service(db).disable_vertical(_admin_user_id(admin), slug)
    if not ok:
        _not_found("Vertical not found")


@router.get("/modules", response_model=list[ProfessionalModuleOut])
async def admin_list_modules(
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[ProfessionalModuleOut]:
    """List module catalog."""
    return [ProfessionalModuleOut.model_validate(_row) for _row in (await _service(db).list_modules())]


@router.post("/modules", response_model=ProfessionalModuleOut, status_code=status.HTTP_201_CREATED)
async def admin_create_module(
    payload: ProfessionalModuleCreate,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalModuleOut:
    """Create or upsert module."""
    return ProfessionalModuleOut.model_validate(await _service(db).create_module(_admin_user_id(admin), payload))


@router.patch("/modules/{module_key}", response_model=ProfessionalModuleOut)
async def admin_update_module(
    module_key: str,
    payload: ProfessionalModuleUpdate,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalModuleOut:
    """Patch module."""
    row = await _service(db).update_module(_admin_user_id(admin), module_key, payload)
    if row is None:
        _not_found("Module not found")
    return ProfessionalModuleOut.model_validate(row)


@router.get("/verticals/{slug}/modules", response_model=list[ProfessionalVerticalModuleOut])
async def admin_list_vertical_modules(
    slug: str,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[ProfessionalVerticalModuleOut]:
    """List module assignments."""
    return [
        ProfessionalVerticalModuleOut.model_validate(_row) for _row in (await _service(db).list_vertical_modules(slug))
    ]


@router.post("/verticals/{slug}/modules/{module_key}", response_model=ProfessionalVerticalModuleOut)
async def admin_assign_module(
    slug: str,
    module_key: str,
    payload: ProfessionalVerticalModuleUpsert,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalVerticalModuleOut:
    """Assign module to vertical."""
    row = await _service(db).assign_module(_admin_user_id(admin), slug, module_key, payload)
    if row is None:
        _not_found(f"Module {module_key!r} not found in catalog")
    return ProfessionalVerticalModuleOut.model_validate(row)


@router.delete("/verticals/{slug}/modules/{module_key}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_disable_module_assignment(
    slug: str,
    module_key: str,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> None:
    """Disable module assignment."""
    ok = await _service(db).disable_module_assignment(_admin_user_id(admin), slug, module_key)
    if not ok:
        _not_found("Module assignment not found")


@router.get("/verticals/{slug}/schemas", response_model=list[ProfessionalVerticalSchemaOut])
async def admin_list_schemas(
    slug: str,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[ProfessionalVerticalSchemaOut]:
    """List vertical schemas."""
    return [ProfessionalVerticalSchemaOut.model_validate(_row) for _row in (await _service(db).list_schemas(slug))]


@router.post(
    "/verticals/{slug}/schemas", response_model=ProfessionalVerticalSchemaOut, status_code=status.HTTP_201_CREATED
)
async def admin_create_schema(
    slug: str,
    payload: ProfessionalVerticalSchemaCreate,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalVerticalSchemaOut:
    """Create schema version."""
    return ProfessionalVerticalSchemaOut.model_validate(
        await _service(db).create_schema(_admin_user_id(admin), slug, payload)
    )


@router.patch("/schemas/{schema_id}", response_model=ProfessionalVerticalSchemaOut)
async def admin_update_schema(
    schema_id: UUID,
    payload: ProfessionalVerticalSchemaUpdate,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalVerticalSchemaOut:
    """Patch schema version."""
    row = await _service(db).update_schema(_admin_user_id(admin), schema_id, payload)
    if row is None:
        _not_found("Schema not found")
    return ProfessionalVerticalSchemaOut.model_validate(row)


@router.post("/schemas/{schema_id}/activate", response_model=ProfessionalVerticalSchemaOut)
async def admin_activate_schema(
    schema_id: UUID,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalVerticalSchemaOut:
    """Activate schema version."""
    row = await _service(db).activate_schema(_admin_user_id(admin), schema_id)
    if row is None:
        _not_found("Schema not found")
    return ProfessionalVerticalSchemaOut.model_validate(row)


@router.get("/ai-actions", response_model=list[ProfessionalAiActionOut])
async def admin_list_ai_actions(
    vertical_slug: str | None = None,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[ProfessionalAiActionOut]:
    """List AI action catalog."""
    return [
        ProfessionalAiActionOut.model_validate(_row) for _row in (await _service(db).list_ai_actions(vertical_slug))
    ]


@router.post("/ai-actions", response_model=ProfessionalAiActionOut, status_code=status.HTTP_201_CREATED)
async def admin_create_ai_action(
    payload: ProfessionalAiActionCreate,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalAiActionOut:
    """Create AI action."""
    return ProfessionalAiActionOut.model_validate(await _service(db).create_ai_action(_admin_user_id(admin), payload))


@router.patch("/ai-actions/{action_key}", response_model=ProfessionalAiActionOut)
async def admin_update_ai_action(
    action_key: str,
    payload: ProfessionalAiActionUpdate,
    vertical_slug: str = Query("realtor"),
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalAiActionOut:
    """Patch AI action."""
    row = await _service(db).update_ai_action(_admin_user_id(admin), vertical_slug, action_key, payload)
    if row is None:
        _not_found("AI action not found")
    return ProfessionalAiActionOut.model_validate(row)


@router.post("/ai-actions/{action_key}/test", response_model=ProfessionalAiActionTestOut)
async def admin_test_ai_action(
    action_key: str,
    vertical_slug: str = Query("realtor"),
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalAiActionTestOut:
    """Dry-run action validation without persisting a user artifact."""
    action = await _service(db).get_ai_action(vertical_slug, action_key)
    if action is None:
        _not_found("AI action not found")
    return ProfessionalAiActionTestOut.model_validate(
        {
            "ok": True,
            "action_key": action_key,
            "vertical_slug": vertical_slug,
            "ugs_type_key": action["ugs_type_key"],
            "requires_prompt": bool(action["prompt_template"]),
            "output_schema_keys": sorted((action.get("output_schema") or {}).keys()),
        }
    )


@router.get("/photo-presets", response_model=list[ProfessionalPhotoPresetOut])
async def admin_list_photo_presets(
    vertical_slug: str | None = None,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[ProfessionalPhotoPresetOut]:
    """List photo presets."""
    return [
        ProfessionalPhotoPresetOut.model_validate(_row)
        for _row in (await _service(db).list_photo_presets(vertical_slug))
    ]


@router.post("/photo-presets", response_model=ProfessionalPhotoPresetOut, status_code=status.HTTP_201_CREATED)
async def admin_create_photo_preset(
    payload: ProfessionalPhotoPresetCreate,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPhotoPresetOut:
    """Create photo preset."""
    return ProfessionalPhotoPresetOut.model_validate(
        await _service(db).create_photo_preset(_admin_user_id(admin), payload)
    )


@router.patch("/photo-presets/{preset_key}", response_model=ProfessionalPhotoPresetOut)
async def admin_update_photo_preset(
    preset_key: str,
    payload: ProfessionalPhotoPresetUpdate,
    vertical_slug: str = Query("realtor"),
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPhotoPresetOut:
    """Patch photo preset."""
    row = await _service(db).update_photo_preset(_admin_user_id(admin), vertical_slug, preset_key, payload)
    if row is None:
        _not_found("Photo preset not found")
    return ProfessionalPhotoPresetOut.model_validate(row)


@router.post("/photo-presets/{preset_key}/test", response_model=ProfessionalPhotoPresetTestOut)
async def admin_test_photo_preset(
    preset_key: str,
    vertical_slug: str = Query("realtor"),
    sample_content_id: UUID | None = None,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPhotoPresetTestOut:
    """Dry-run preset resolution with optional sample Unified Content id."""
    preset = await _service(db).get_photo_preset(vertical_slug, preset_key)
    if preset is None:
        _not_found("Photo preset not found")
    return ProfessionalPhotoPresetTestOut.model_validate(
        {
            "ok": True,
            "preset_key": preset_key,
            "vertical_slug": vertical_slug,
            "sample_content_id": sample_content_id,
            "ugs_type_key": preset["ugs_type_key"],
            "action_type": preset["action_type"],
            "parameters": preset.get("parameters") or {},
        }
    )


@router.get("/integrations", response_model=list[ProfessionalIntegrationBindingOut])
async def admin_list_integrations(
    vertical_slug: str | None = None,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[ProfessionalIntegrationBindingOut]:
    """List integration bindings."""
    return [
        ProfessionalIntegrationBindingOut.model_validate(_row)
        for _row in (await _service(db).list_integrations(vertical_slug))
    ]


@router.patch("/integrations/{integration_key}", response_model=ProfessionalIntegrationBindingOut)
async def admin_update_integration(
    integration_key: str,
    payload: ProfessionalIntegrationBindingUpdate,
    vertical_slug: str = Query("realtor"),
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalIntegrationBindingOut:
    """Patch integration binding."""
    row = await _service(db).update_integration(_admin_user_id(admin), vertical_slug, integration_key, payload)
    if row is None:
        _not_found("Integration binding not found")
    return ProfessionalIntegrationBindingOut.model_validate(row)


@router.get("/audit", response_model=list[ProfessionalAdminAuditLogOut])
async def admin_list_audit(
    entity_type: str | None = None,
    risk_level: str | None = None,
    admin_user_id: UUID | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[ProfessionalAdminAuditLogOut]:
    """List Professional Worlds admin audit events."""
    return [
        ProfessionalAdminAuditLogOut.model_validate(_row)
        for _row in (await _service(db).list_audit(entity_type, risk_level, admin_user_id, limit))
    ]


@router.get("/verticals/{slug}/export", response_model=ProfessionalVerticalPackExportOut)
async def admin_export_vertical_pack(
    slug: str,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalVerticalPackExportOut:
    """Export one vertical pack as JSON."""
    pack = await _service(db).export_vertical_pack(slug)
    if pack.get("vertical") is None:
        _not_found("Vertical not found")
    return ProfessionalVerticalPackExportOut.model_validate(pack)


@router.post("/verticals/import/dry-run", response_model=VerticalPackImportResult)
async def admin_import_vertical_pack_dry_run(
    payload: VerticalPackImportRequest,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> VerticalPackImportResult:
    """Validate vertical pack import without mutation; persists a dry-run import job."""
    vertical = payload.pack.vertical or {}
    slug = str(vertical.get("slug") or "realtor")
    manifest = payload.pack.model_dump()
    result = await _pack_service(db).create_import_job(
        _admin_user_id(_admin),
        slug,
        manifest,
        dry_run=True,
        admin=_service(db),
    )
    return VerticalPackImportResult.model_validate(
        {
            "dry_run": True,
            "valid": result["valid"],
            "messages": result["messages"],
            "pack": payload.pack,
            "job_id": result["job"]["id"],
        }
    )


@router.post("/verticals/import", response_model=VerticalPackImportResult)
async def admin_import_vertical_pack(
    payload: VerticalPackImportRequest,
    admin: User = Depends(require_emperyworld_admin),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> VerticalPackImportResult:
    """Apply a validated import job (requires emperyworld admin and confirm=true)."""
    if not payload.confirm:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Import requires confirm=true")
    if payload.job_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Import requires job_id from dry-run")
    apply = await _pack_service(db).confirm_import_job(payload.job_id, _admin_user_id(admin), _service(db))
    if not apply.get("ok"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=apply.get("error", "import failed"))
    return VerticalPackImportResult.model_validate(
        {
            "dry_run": False,
            "valid": True,
            "messages": [f"Import applied; runtime epoch {apply.get('epoch')}"],
            "pack": payload.pack,
            "job_id": payload.job_id,
        }
    )


@router.get("/packs/{vertical_slug}/versions", response_model=list[ProfessionalVerticalPackVersionOut])
async def admin_list_pack_versions(
    vertical_slug: str,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[ProfessionalVerticalPackVersionOut]:
    """List saved pack versions for a vertical."""
    return [
        ProfessionalVerticalPackVersionOut.model_validate(_row)
        for _row in (await _pack_service(db).list_pack_versions(vertical_slug))
    ]


@router.post("/packs/{vertical_slug}/versions", response_model=ProfessionalVerticalPackVersionOut)
async def admin_create_pack_version(
    vertical_slug: str,
    body: ProfessionalPackVersionCreateBody,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalVerticalPackVersionOut:
    """Persist a manifest snapshot as a pack version."""
    row = await _pack_service(db).create_pack_version(
        _admin_user_id(admin),
        vertical_slug,
        body.version_label,
        body.manifest.model_dump(),
        body.changelog_md,
    )
    return ProfessionalVerticalPackVersionOut.model_validate(row)


@router.post("/packs/{vertical_slug}/diff", response_model=ProfessionalPackDiffOut)
async def admin_pack_diff_vs_manifest(
    vertical_slug: str,
    manifest: ProfessionalPackManifestSnapshotBody,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPackDiffOut:
    """Compare live export with a candidate manifest."""
    raw = await _pack_service(db).diff_manifest_vs_live(_service(db), vertical_slug, manifest.model_dump())
    return ProfessionalPackDiffOut.model_validate(raw)


@router.post("/packs/import/jobs", response_model=ProfessionalPackImportJobCreateOut)
async def admin_create_pack_import_job(
    vertical_slug: str = Query("realtor"),
    body: ProfessionalPackManifestSnapshotBody = Body(default_factory=ProfessionalPackManifestSnapshotBody),
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPackImportJobCreateOut:
    """Create import job from raw manifest (dry-run)."""
    vertical = body.vertical or {}
    slug = str(vertical.get("slug") or vertical_slug)
    raw = await _pack_service(db).create_import_job(
        _admin_user_id(_admin), slug, body.model_dump(), dry_run=True, admin=_service(db)
    )
    return ProfessionalPackImportJobCreateOut.model_validate(raw)


@router.get("/packs/import/jobs/{job_id}", response_model=ProfessionalPackImportJobOut)
async def admin_get_pack_import_job(
    job_id: UUID,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPackImportJobOut:
    """Fetch one pack import job."""
    row = await _pack_service(db).get_import_job(job_id)
    if row is None:
        _not_found("Import job not found")
    return ProfessionalPackImportJobOut.model_validate(row)


@router.post("/packs/import/jobs/{job_id}/confirm", response_model=ProfessionalPackImportConfirmOut)
async def admin_confirm_pack_import_job(
    job_id: UUID,
    admin: User = Depends(require_emperyworld_admin),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPackImportConfirmOut:
    """Apply import job (emperyworld admin only)."""
    raw = await _pack_service(db).confirm_import_job(job_id, _admin_user_id(admin), _service(db))
    return ProfessionalPackImportConfirmOut.model_validate(raw)


@router.post("/packs/{vertical_slug}/releases", response_model=ProfessionalPackReleaseOut)
async def admin_create_pack_release(
    vertical_slug: str,
    body: ProfessionalPackReleaseCreateBody,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPackReleaseOut:
    """Create draft release."""
    raw = await _pack_service(db).create_release(_admin_user_id(admin), vertical_slug, body.pack_version_id, body.notes)
    return ProfessionalPackReleaseOut.model_validate(raw)


@router.post("/packs/releases/{release_id}/approve", response_model=ProfessionalPackReleaseOut)
async def admin_approve_pack_release(
    release_id: UUID,
    admin: User = Depends(require_admin_user),  # noqa: B008
    body: ProfessionalPackReleaseApproveBody = Body(default_factory=ProfessionalPackReleaseApproveBody),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPackReleaseOut:
    row = await _pack_service(db).approve_release(_admin_user_id(admin), release_id, comment=body.comment)
    if row is None:
        _not_found("Release not found")
    return ProfessionalPackReleaseOut.model_validate(row)


@router.post("/packs/releases/{release_id}/publish", response_model=ProfessionalPackReleaseOut)
async def admin_publish_pack_release(
    release_id: UUID,
    admin: User = Depends(require_emperyworld_admin),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPackReleaseOut:
    row = await _pack_service(db).publish_release(_admin_user_id(admin), _service(db), release_id)
    if row is None:
        _not_found("Release not found or not approved")
    return ProfessionalPackReleaseOut.model_validate(row)


@router.post("/packs/releases/{release_id}/rollback", response_model=ProfessionalPackReleaseOut)
async def admin_rollback_pack_release(
    release_id: UUID,
    admin: User = Depends(require_emperyworld_admin),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPackReleaseOut:
    row = await _pack_service(db).rollback_release(_admin_user_id(admin), _service(db), release_id)
    if row is None:
        _not_found("Release not found")
    return ProfessionalPackReleaseOut.model_validate(row)


@router.get("/rollouts", response_model=list[ProfessionalVerticalRolloutOut])
async def admin_list_rollouts(
    vertical_slug: str | None = None,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[ProfessionalVerticalRolloutOut]:
    rows = await _pack_service(db).list_rollouts(vertical_slug)
    return [ProfessionalVerticalRolloutOut.model_validate(r) for r in rows]


@router.post("/rollouts", response_model=ProfessionalVerticalRolloutMutateOut)
async def admin_create_rollout(
    vertical_slug: str = Query("realtor"),
    body: ProfessionalRolloutCreateBody = Body(...),  # noqa: B008
    _admin: User = Depends(require_emperyworld_admin),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalVerticalRolloutMutateOut:
    raw = await _pack_service(db).create_rollout(vertical_slug, body.release_id, body.mode, body.percentage)
    return ProfessionalVerticalRolloutMutateOut.model_validate(raw)


@router.patch("/rollouts/{rollout_id}", response_model=ProfessionalVerticalRolloutMutateOut)
async def admin_patch_rollout(
    rollout_id: UUID,
    body: ProfessionalRolloutPatchBody,
    _admin: User = Depends(require_emperyworld_admin),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalVerticalRolloutMutateOut:
    row = await _pack_service(db).patch_rollout(rollout_id, mode=body.mode, percentage=body.percentage)
    if row is None:
        _not_found("Rollout not found")
    return ProfessionalVerticalRolloutMutateOut.model_validate(row)


@router.post("/rollouts/{rollout_id}/pause", response_model=ProfessionalVerticalRolloutMutateOut)
async def admin_pause_rollout(
    rollout_id: UUID,
    _admin: User = Depends(require_emperyworld_admin),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalVerticalRolloutMutateOut:
    row = await _pack_service(db).set_rollout_paused(rollout_id, True)
    if row is None:
        _not_found("Rollout not found")
    return ProfessionalVerticalRolloutMutateOut.model_validate(row)


@router.post("/rollouts/{rollout_id}/resume", response_model=ProfessionalVerticalRolloutMutateOut)
async def admin_resume_rollout(
    rollout_id: UUID,
    _admin: User = Depends(require_emperyworld_admin),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalVerticalRolloutMutateOut:
    row = await _pack_service(db).set_rollout_paused(rollout_id, False)
    if row is None:
        _not_found("Rollout not found")
    return ProfessionalVerticalRolloutMutateOut.model_validate(row)


@router.get(
    "/ai-actions/{vertical_slug}/{action_key}/prompt-inspect",
    response_model=ProfessionalAiActionPromptInspectOut,
)
async def admin_inspect_ai_action_prompt(
    vertical_slug: str,
    action_key: str,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalAiActionPromptInspectOut:
    """Return internal prompt template for an AI action (admin only, never exposed on user runtime)."""
    row = await _service(db).get_ai_action(vertical_slug, action_key)
    if row is None:
        _not_found("AI action not found")
    return ProfessionalAiActionPromptInspectOut.model_validate(
        {
            "vertical_slug": vertical_slug,
            "action_key": action_key,
            "prompt_template": row.get("prompt_template"),
            "workflow_slug": row.get("workflow_slug"),
            "ugs_type_key": row.get("ugs_type_key"),
        }
    )


@router.get(
    "/photo-presets/{vertical_slug}/{preset_key}/prompt-inspect",
    response_model=ProfessionalPhotoPresetPromptInspectOut,
)
async def admin_inspect_photo_preset_prompt(
    vertical_slug: str,
    preset_key: str,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPhotoPresetPromptInspectOut:
    """Return internal preset prompt template (admin only)."""
    row = await _service(db).get_photo_preset(vertical_slug, preset_key)
    if row is None:
        _not_found("Photo preset not found")
    return ProfessionalPhotoPresetPromptInspectOut.model_validate(
        {
            "vertical_slug": vertical_slug,
            "preset_key": preset_key,
            "prompt_template": row.get("prompt_template"),
            "ugs_type_key": row.get("ugs_type_key"),
        }
    )


@router.get("/playbooks/{vertical_slug}", response_model=list[AdminProfessionalPlaybookOut])
async def admin_list_professional_playbooks(
    vertical_slug: str,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[AdminProfessionalPlaybookOut]:
    """List configured AI playbooks and steps for a vertical."""
    return [
        AdminProfessionalPlaybookOut.model_validate(_row)
        for _row in (await _playbook_service(db).admin_list_playbooks(vertical_slug))
    ]


@router.get(
    "/playbooks/{vertical_slug}/{playbook_key}/dry-run",
    response_model=ProfessionalPlaybookDryRunOut,
)
async def admin_dry_run_professional_playbook(
    vertical_slug: str,
    playbook_key: str,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPlaybookDryRunOut:
    """Resolve playbook steps to UGS action metadata without invoking generation."""
    row = await _playbook_service(db).admin_dry_run_playbook(vertical_slug, playbook_key)
    if row is None:
        _not_found("Playbook not found")
    return ProfessionalPlaybookDryRunOut.model_validate(row)


@router.post(
    "/playbooks/{vertical_slug}/{playbook_key}/dry-run",
    response_model=ProfessionalPlaybookDryRunOut,
)
async def admin_dry_run_professional_playbook_with_body(
    vertical_slug: str,
    playbook_key: str,
    payload: ProfessionalPlaybookDryRunRequest | None = Body(default=None),
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalPlaybookDryRunOut:
    """Dry-run persisted playbook or preview a draft step list without saving."""
    steps_override = [step.model_dump() for step in payload.steps] if payload and payload.steps else None
    row = await _playbook_service(db).admin_dry_run_playbook(vertical_slug, playbook_key, steps_override=steps_override)
    if row is None:
        _not_found("Playbook not found")
    return ProfessionalPlaybookDryRunOut.model_validate(row)


@router.post(
    "/playbooks/{vertical_slug}",
    response_model=AdminProfessionalPlaybookOut,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_professional_playbook(
    vertical_slug: str,
    payload: AdminProfessionalPlaybookCreate,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> AdminProfessionalPlaybookOut:
    """Create a multi-step AI playbook for a vertical."""
    try:
        return AdminProfessionalPlaybookOut.model_validate(
            await _playbook_service(db).admin_create_playbook(
                admin_user_id=_admin_user_id(admin),
                vertical_slug=vertical_slug,
                playbook_key=payload.playbook_key,
                display_name=payload.display_name,
                description=payload.description,
                sort_order=payload.sort_order,
                is_active=payload.is_active,
                steps=[step.model_dump() for step in payload.steps],
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.patch(
    "/playbooks/{vertical_slug}/{playbook_key}",
    response_model=AdminProfessionalPlaybookOut,
)
async def admin_update_professional_playbook(
    vertical_slug: str,
    playbook_key: str,
    payload: AdminProfessionalPlaybookUpdate,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> AdminProfessionalPlaybookOut:
    """Update playbook metadata and optionally replace all steps."""
    row = await _playbook_service(db).admin_update_playbook(
        admin_user_id=_admin_user_id(admin),
        vertical_slug=vertical_slug,
        playbook_key=playbook_key,
        display_name=payload.display_name,
        description=payload.description,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
        steps=[step.model_dump() for step in payload.steps] if payload.steps is not None else None,
    )
    if row is None:
        _not_found("Playbook not found")
    return AdminProfessionalPlaybookOut.model_validate(row)


@router.get("/evaluation/dashboard", response_model=ProfessionalAiEvalDashboardOut)
async def admin_evaluation_dashboard(
    vertical_slug: str | None = Query(None),
    run_limit: int = Query(25, ge=1, le=100),
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalAiEvalDashboardOut:
    """Summarize evaluation datasets and recent rubric runs for the admin UI."""
    ev = _evaluation_service(db)
    datasets_raw = await ev.list_datasets(vertical_slug)
    runs_raw = await ev.list_runs(vertical_slug, limit=run_limit)
    datasets = [ProfessionalAiEvalDatasetOut.model_validate(d) for d in datasets_raw]
    recent_runs = [ProfessionalAiEvalRunOut.model_validate({**r, "samples": []}) for r in runs_raw]
    return ProfessionalAiEvalDashboardOut(datasets=datasets, recent_runs=recent_runs)


@router.get("/evaluation/datasets", response_model=list[ProfessionalAiEvalDatasetOut])
async def admin_list_evaluation_datasets(
    vertical_slug: str | None = Query(None),
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[ProfessionalAiEvalDatasetOut]:
    """List AI evaluation datasets."""
    return [
        ProfessionalAiEvalDatasetOut.model_validate(_row)
        for _row in (await _evaluation_service(db).list_datasets(vertical_slug))
    ]


@router.post("/evaluation/datasets", response_model=ProfessionalAiEvalDatasetOut, status_code=status.HTTP_201_CREATED)
async def admin_create_evaluation_dataset(
    payload: ProfessionalAiEvalDatasetCreate,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalAiEvalDatasetOut:
    """Create a dataset of variable payloads used to exercise actions or playbooks."""
    try:
        return ProfessionalAiEvalDatasetOut.model_validate(
            await _evaluation_service(db).create_dataset(
                vertical_slug=payload.vertical_slug,
                name=payload.name,
                description=payload.description,
                cases=list(payload.cases),
                is_active=payload.is_active,
            )
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.patch("/evaluation/datasets/{dataset_id}", response_model=ProfessionalAiEvalDatasetOut)
async def admin_patch_evaluation_dataset(
    dataset_id: UUID,
    payload: ProfessionalAiEvalDatasetUpdate,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalAiEvalDatasetOut:
    """Patch dataset metadata or replace cases."""
    row = await _evaluation_service(db).update_dataset(
        dataset_id,
        name=payload.name,
        description=payload.description,
        cases=list(payload.cases) if payload.cases is not None else None,
        is_active=payload.is_active,
    )
    if row is None:
        _not_found("Dataset not found")
    return ProfessionalAiEvalDatasetOut.model_validate(row)


@router.delete("/evaluation/datasets/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_evaluation_dataset(
    dataset_id: UUID,
    _admin: User = Depends(require_emperyworld_admin),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> None:
    """Remove a dataset (operator-only; cascades evaluation runs)."""
    deleted = await _evaluation_service(db).delete_dataset(dataset_id)
    if not deleted:
        _not_found("Dataset not found")


@router.get("/evaluation/runs", response_model=list[ProfessionalAiEvalRunOut])
async def admin_list_evaluation_runs(
    vertical_slug: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> list[ProfessionalAiEvalRunOut]:
    """List evaluation runs without per-sample payloads."""
    rows = await _evaluation_service(db).list_runs(vertical_slug, limit=limit)
    return [ProfessionalAiEvalRunOut.model_validate(item) for item in ([{**r, "samples": []} for r in rows])]


@router.get("/evaluation/runs/{run_id}", response_model=ProfessionalAiEvalRunOut)
async def admin_get_evaluation_run(
    run_id: UUID,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalAiEvalRunOut:
    """Return one run including rubric samples and redacted snapshots."""
    row = await _evaluation_service(db).get_run(run_id)
    if row is None:
        _not_found("Run not found")
    samples = [ProfessionalAiEvalRunSampleOut.model_validate(s) for s in row.pop("samples", [])]
    return ProfessionalAiEvalRunOut.model_validate({**row, "samples": samples})


@router.post("/evaluation/runs", response_model=ProfessionalAiEvalRunOut)
async def admin_execute_evaluation_run(
    body: ProfessionalAiEvalRunCreateBody,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
) -> ProfessionalAiEvalRunOut:
    """Execute evaluation for a dataset against one AI action or playbook (blocking)."""
    admin_id = _admin_user_id(admin)
    if not body.simulate and admin_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="admin_user_required_for_live_eval",
        )
    ev = _evaluation_service(db)
    try:
        raw = await ev.execute_run(
            worlds=_worlds_service(db),
            playbook_svc=_playbook_service(db),
            ugs_service=None if body.simulate else ugs_service,
            admin_user_id=admin_id,
            dataset_id=body.dataset_id,
            target_type=body.target_type,
            target_key=body.target_key,
            simulate=body.simulate,
            notes=body.notes,
            idempotency_prefix=body.idempotency_prefix,
        )
    except ValueError as exc:
        detail = str(exc)
        code = status.HTTP_404_NOT_FOUND if detail == "dataset_not_found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc

    raw.pop("execution_error", None)
    samples = [ProfessionalAiEvalRunSampleOut.model_validate(s) for s in raw.pop("samples", [])]
    return ProfessionalAiEvalRunOut.model_validate({**raw, "samples": samples})


@router.patch("/evaluation/runs/{run_id}/human-notes", response_model=ProfessionalAiEvalRunOut)
async def admin_patch_evaluation_run_human_notes(
    run_id: UUID,
    body: ProfessionalAiEvalHumanNotesBody,
    _admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalAiEvalRunOut:
    """Attach human review notes to the whole run."""
    patched = await _evaluation_service(db).patch_run_human_notes(run_id, body.human_review_notes)
    if patched is None:
        _not_found("Run not found")
    full = await _evaluation_service(db).get_run(run_id)
    assert full is not None
    samples = [ProfessionalAiEvalRunSampleOut.model_validate(s) for s in full.pop("samples", [])]
    return ProfessionalAiEvalRunOut.model_validate({**full, "samples": samples})


@router.patch("/evaluation/runs/samples/{sample_id}/human-notes", response_model=ProfessionalAiEvalRunSampleOut)
async def admin_patch_evaluation_sample_human_notes(
    sample_id: UUID,
    body: ProfessionalAiEvalHumanNotesBody,
    admin: User = Depends(require_admin_user),  # noqa: B008
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ProfessionalAiEvalRunSampleOut:
    """Attach human review notes to a single evaluated case."""
    row = await _evaluation_service(db).patch_sample_human_notes(
        sample_id, notes=body.human_review_notes, admin_user_id=_admin_user_id(admin)
    )
    if row is None:
        _not_found("Sample not found")
    return ProfessionalAiEvalRunSampleOut.model_validate(row)
