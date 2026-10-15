# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Authenticated HTTP entry for **EWA** desktop orchestration (envelope in, ``EwaResponseV1`` out).
# Invariants:
# - Body is a raw JSON object (``EwaRequestV1``); ``payload.kind`` must be ``ewa_desktop_orchestration_v1``.
# - Auth via ``require_oauth2_user``; policy context is derived from ``User`` only (no secrets in payload).
# Related:
# - shared/api/ewa_platform/desktop/runtime.py
# - shared/api/ewa_platform/docs/DESKTOP-ORCHESTRATION.md
# - documentation/product/amka-seed-album/AMKA-ENTRYPOINTS.md
# ---
"""EWA desktop orchestration router."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request  # type: ignore[import-untyped]
from fastapi.responses import StreamingResponse  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.desktop.runtime import (
    execute_desktop_orchestration_turn,
    iter_desktop_orchestration_session_sse,
)
from api.ewa_platform.schemas.pydantic.desktop import (
    EwaDesktopOrchestrationSseEventOut,
    EwaDesktopOrchestrationTurnResponse,
)
from api.ewa_platform.schemas.pydantic.sse_openapi import event_stream_openapi_responses

router = APIRouter(tags=["EWA - Desktop orchestration"])


@router.post(
    "/desktop-orchestration/turn",
    response_model=EwaDesktopOrchestrationTurnResponse,
    operation_id="ewa_desktop_orchestration_turn",
    summary="Desktop orchestration: process one observation (envelope v1)",
)
async def post_desktop_orchestration_turn(
    request: Request,
    body: dict[str, Any],
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> EwaDesktopOrchestrationTurnResponse:
    """Run ``run_orchestration_turn`` for a validated desktop observation."""

    raw = await execute_desktop_orchestration_turn(request=request, body=body, auth_user=auth_user)
    return EwaDesktopOrchestrationTurnResponse.model_validate(raw)


@router.get(
    "/desktop-orchestration/sessions/{session_id}/events",
    operation_id="ewa_desktop_orchestration_session_events_sse",
    summary="SSE snapshot of orchestration events (+ optional keep-alive stream)",
    responses=event_stream_openapi_responses(
        model=EwaDesktopOrchestrationSseEventOut,
        description=(
            "`text/event-stream` — SSE ``data:`` lines with persisted session events "
            "(`EwaDesktopOrchestrationSseEventOut` honest bags) plus `: keep-alive`."
        ),
    ),
)
async def get_desktop_orchestration_session_events(
    request: Request,
    session_id: str,
    follow: bool = False,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> StreamingResponse:
    """Stream ``text/event-stream`` with persisted events; ``follow=true`` emits periodic keep-alive."""

    _ = auth_user
    return StreamingResponse(
        iter_desktop_orchestration_session_sse(request=request, session_id=session_id, follow=follow),
        media_type="text/event-stream",
    )
