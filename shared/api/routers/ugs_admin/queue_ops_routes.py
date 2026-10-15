# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   UGS Admin queue operations snapshot route (operator read-only diagnostics).
# Invariants:
#   - Route requires ``require_ugs_admin_user``; no mutating side effects.
# Related:
#   - api/services/ugs/queue_ops_snapshot.py
#   - documentation/platform/docker-re_doc/UGS-QUEUE-OPERATOR-ENV.md
# ---

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends  # type: ignore[import-untyped]

from api.core.database_manager import get_postgres_session
from api.schemas.ugs import UGSQueueOpsSnapshotResponse
from api.services.ugs.admin_access import require_ugs_admin_user

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

    from api.core.auth import User as AuthUser


def register_queue_ops_routes(router: APIRouter) -> None:
    @router.get(
        "/queue-ops",
        response_model=UGSQueueOpsSnapshotResponse,
        summary="UGS queue operations snapshot",
        description=(
            "Read-only snapshot: Postgres queue stats, stale candidates, RabbitMQ depths "
            "(management API), Redis worker leases, env tuning, and operator hints."
        ),
    )
    async def get_ugs_queue_ops_snapshot(
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> UGSQueueOpsSnapshotResponse | dict[str, Any]:
        from api.services.ugs.queue_ops_snapshot import build_queue_ops_snapshot  # noqa: PLC0415

        return await build_queue_ops_snapshot(db)
