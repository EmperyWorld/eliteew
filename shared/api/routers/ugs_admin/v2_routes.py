# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   UGS Admin v2 snapshot, validate, and bulk-apply HTTP routes.
# Invariants:
#   - All routes require ``require_ugs_admin_user``.
# Related:
#   - api/services/ugs/admin_v2_service.py
#   - api/schemas/ugs_admin.py
# ---

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends  # type: ignore[import-untyped]

from api.core.database_manager import get_postgres_session
from api.schemas.ugs_admin import (
    UgsAdminV2BulkApplyRequest,
    UgsAdminV2BulkApplyResult,
    UgsAdminV2SnapshotResponse,
    UgsAdminV2ValidateRequest,
    UgsAdminV2ValidationIssue,
)
from api.services.ugs.admin_access import require_ugs_admin_user
from api.services.ugs.admin_v2_service import (
    apply_operations as ugs_admin_v2_apply_operations,
)
from api.services.ugs.admin_v2_service import (
    build_snapshot as ugs_admin_v2_build_snapshot,
)
from api.services.ugs.admin_v2_service import (
    validate_operations as ugs_admin_v2_validate_operations,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

    from api.core.auth import User as AuthUser

logger = logging.getLogger(__name__)


def register_v2_routes(router: APIRouter) -> None:
    @router.get("/v2/snapshot", response_model=UgsAdminV2SnapshotResponse)
    async def ugs_admin_v2_get_snapshot(
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> UgsAdminV2SnapshotResponse:
        return await ugs_admin_v2_build_snapshot(db)

    @router.post("/v2/validate", response_model=list[UgsAdminV2ValidationIssue])
    async def ugs_admin_v2_validate(
        payload: UgsAdminV2ValidateRequest,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> list[UgsAdminV2ValidationIssue]:
        issues = await ugs_admin_v2_validate_operations(db, payload.operations)
        return issues

    @router.post("/v2/bulk", response_model=UgsAdminV2BulkApplyResult)
    async def ugs_admin_v2_bulk_apply(
        payload: UgsAdminV2BulkApplyRequest,
        current_admin: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> UgsAdminV2BulkApplyResult:
        issues = await ugs_admin_v2_validate_operations(db, payload.operations)
        has_errors = any(it.severity == "error" for it in issues)
        has_warnings = any(it.severity == "warning" for it in issues)

        if has_errors:
            return UgsAdminV2BulkApplyResult(issues=issues, applied=0, skipped=0, failed=0)
        if has_warnings and not payload.allow_warnings:
            return UgsAdminV2BulkApplyResult(issues=issues, applied=0, skipped=0, failed=0)
        if payload.validate_only:
            return UgsAdminV2BulkApplyResult(issues=issues, applied=0, skipped=0, failed=0)

        apply_result = await ugs_admin_v2_apply_operations(db, payload.operations)
        await db.commit()

        logger.info(
            "UGS admin v2 bulk applied: admin=%s applied=%s skipped=%s failed=%s ops=%s",
            getattr(current_admin, "email", None),
            apply_result.applied,
            apply_result.skipped,
            apply_result.failed,
            len(payload.operations),
        )
        return UgsAdminV2BulkApplyResult(
            issues=issues,
            applied=apply_result.applied,
            skipped=apply_result.skipped,
            failed=apply_result.failed,
            operation_results=apply_result.operation_results or [],
        )
