# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Professional Worlds AI playbook HTTP routes (list/run/resume multi-step flows).
# Invariants:
# - Routes mount on the main Professional Worlds router without a path prefix change.
# - Playbook streams emit explicit SSE errors; no empty success when steps fail.
# - OpenAPI documents named text/event-stream payloads (Wave B5b residual) via shared SSE helper.
# Related:
# - api/routers/professional_worlds_deps.py
# - api/services/professional_worlds/playbook_service.py
# - api/ewa_platform/schemas/pydantic/sse_openapi.py
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md (B5b)
# ---

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status  # type: ignore[import-untyped]
from fastapi.responses import StreamingResponse  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.schemas.pydantic.sse_openapi import event_stream_openapi_responses
from api.routers.professional_worlds_deps import (
    _current_user_id,
    _idempotency_key,
    _playbook_service,
    _sse,
)
from api.routers.ugs import get_ugs_service
from api.schemas.professional_worlds import (
    ProfessionalPlaybookCostEstimateOut,
    ProfessionalPlaybookLaunchBody,
    ProfessionalPlaybookRunOut,
    ProfessionalWorldsPlaybookStreamSsePayloadDoc,
)
from api.services.ugs.unified_generation_service import UnifiedGenerationService

playbooks_router = APIRouter()

_PW_PLAYBOOK_STREAM_RESPONSES = event_stream_openapi_responses(
    model=ProfessionalWorldsPlaybookStreamSsePayloadDoc,
    description=(
        "`text/event-stream` — SSE `event: run_started|step_start|step_result|step_skipped|"
        "warning|done|error` with named JSON `data:` "
        "(`ProfessionalWorldsPlaybookStreamSsePayloadDoc`); keep-alive comments while waiting."
    ),
)


@playbooks_router.get("/playbook-runs", response_model=list[ProfessionalPlaybookRunOut])
async def list_professional_playbook_runs(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List current-user AI playbook execution history."""
    rows = await _playbook_service(db).list_runs(_current_user_id(user))
    return [{**row, "artifacts": []} for row in rows]


@playbooks_router.get("/playbook-runs/{run_id}", response_model=ProfessionalPlaybookRunOut)
async def get_professional_playbook_run(
    run_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Return a single playbook run with linked artifacts."""
    row = await _playbook_service(db).get_run(_current_user_id(user), run_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook run not found")
    return row


@playbooks_router.get(
    "/playbooks/{vertical_slug}/{playbook_key}/estimate-cost",
    response_model=ProfessionalPlaybookCostEstimateOut,
)
async def estimate_professional_playbook_cost_route(
    vertical_slug: str,
    playbook_key: str,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    _user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Hint-only credit/unit rollup from billing_hint metadata before launching a playbook."""
    row = await _playbook_service(db).estimate_playbook_execution_cost(vertical_slug, playbook_key)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playbook not found")
    return row


@playbooks_router.post(
    "/playbooks/{vertical_slug}/{playbook_key}/stream",
    responses=_PW_PLAYBOOK_STREAM_RESPONSES,
)
async def stream_professional_playbook(
    vertical_slug: str,
    playbook_key: str,
    payload: ProfessionalPlaybookLaunchBody,
    request: Request,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
) -> StreamingResponse:
    """Execute a configured multi-step playbook; streams step and UGS lifecycle events."""
    user_id = _current_user_id(user)
    idem = payload.idempotency_key or _idempotency_key(None, request)

    async def event_stream() -> AsyncGenerator[str]:
        async def _disconnect() -> bool:
            return await request.is_disconnected()

        async for event, data in _playbook_service(db).stream_playbook(
            user_id=user_id,
            vertical_slug=vertical_slug,
            playbook_key=playbook_key,
            variables=payload.variables,
            idempotency_key=idem,
            ugs_service=ugs_service,
            cancel_checker=_disconnect,
        ):
            yield _sse(event, data)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@playbooks_router.post(
    "/playbook-runs/{run_id}/resume/stream",
    responses=_PW_PLAYBOOK_STREAM_RESPONSES,
)
async def resume_professional_playbook_stream(
    run_id: UUID,
    payload: ProfessionalPlaybookLaunchBody,
    request: Request,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
) -> StreamingResponse:
    """Resume a failed/cancelled playbook without redoing completed steps."""
    user_id = _current_user_id(user)

    async def event_stream() -> AsyncGenerator[str]:
        async def _disconnect() -> bool:
            return await request.is_disconnected()

        async for event, data in _playbook_service(db).stream_playbook_resume(
            user_id=user_id,
            run_id=run_id,
            variables=payload.variables,
            ugs_service=ugs_service,
            cancel_checker=_disconnect,
        ):
            yield _sse(event, data)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
