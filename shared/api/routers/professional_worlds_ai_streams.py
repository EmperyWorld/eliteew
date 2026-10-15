# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Professional Worlds text AI HTTP routes (property description/content pack, coach simulate).
# Invariants:
# - Routes mount on the main Professional Worlds router without a path prefix change.
# - Text AI streams use each action's `ugs_type_key` (professional_worlds_*), not generic `text_chat`.
# - OpenAPI documents named text/event-stream payloads (Wave B5b) via shared SSE helper.
# Related:
# - api/routers/professional_worlds_ai_runtime.py
# - api/routers/professional_worlds_deps.py
# - api/ewa_platform/schemas/pydantic/sse_openapi.py
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md (B5b)
# ---

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status  # type: ignore[import-untyped]
from fastapi.responses import StreamingResponse  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.schemas.pydantic.sse_openapi import event_stream_openapi_responses
from api.routers.professional_worlds_ai_runtime import _stream_ugs_text_artifact
from api.routers.professional_worlds_deps import _current_user_id, _idempotency_key, _service
from api.routers.ugs import get_ugs_service
from api.schemas.professional_worlds import (
    CoachSimulationBody,
    ProfessionalWorldsAiTextStreamSsePayloadDoc,
    RealtorGenerationBody,
)
from api.services.professional_worlds import ProfessionalWorldsAiActionService
from api.services.professional_worlds.snapshot_helpers import resolve_pw_ugs_type_key
from api.services.ugs.unified_generation_service import UnifiedGenerationService

ai_streams_router = APIRouter()

_PW_AI_TEXT_STREAM_RESPONSES = event_stream_openapi_responses(
    model=ProfessionalWorldsAiTextStreamSsePayloadDoc,
    description=(
        "`text/event-stream` — SSE `event: started|result|error` with named JSON "
        "`data:` (`ProfessionalWorldsAiTextStreamSsePayloadDoc`); UGS progress/queued "
        "may also appear; keep-alive comments while waiting."
    ),
)


@ai_streams_router.post(
    "/realtor/properties/{property_id}/generate-description/stream",
    responses=_PW_AI_TEXT_STREAM_RESPONSES,
)
async def generate_property_description_stream(
    property_id: UUID,
    payload: RealtorGenerationBody,
    request: Request,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
) -> StreamingResponse:
    """Generate JTBD realtor property description and persist it as an artifact."""
    user_id = _current_user_id(user)
    service = _service(db)
    property_row = await service.get_property(user_id, property_id)
    if property_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    recipe_key, prompt = service.build_realtor_prompt(property_row, payload, content_pack=False)
    action, prompt = await ProfessionalWorldsAiActionService(service).build_prompt(
        vertical_slug="realtor",
        action_key="sales_copy",
        variables={"property": property_row, "tone": payload.tone, "instruction": payload.instruction or ""},
        fallback_prompt=prompt,
    )
    recipe_key = str((action or {}).get("action_key") or recipe_key)
    return StreamingResponse(
        _stream_ugs_text_artifact(
            user_id=user_id,
            service=service,
            ugs_service=ugs_service,
            type_key=resolve_pw_ugs_type_key(action),
            prompt=prompt,
            recipe_key=recipe_key,
            artifact_title=f"Описание: {property_row['title']}",
            source_type="realtor_property",
            source_id=property_id,
            idempotency_key=_idempotency_key(payload.idempotency_key, request),
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@ai_streams_router.post(
    "/realtor/properties/{property_id}/generate-content-pack/stream",
    responses=_PW_AI_TEXT_STREAM_RESPONSES,
)
async def generate_property_content_pack_stream(
    property_id: UUID,
    payload: RealtorGenerationBody,
    request: Request,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
) -> StreamingResponse:
    """Generate a realtor content pack and persist it as an artifact."""
    user_id = _current_user_id(user)
    service = _service(db)
    property_row = await service.get_property(user_id, property_id)
    if property_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    recipe_key, prompt = service.build_realtor_prompt(property_row, payload, content_pack=True)
    action, prompt = await ProfessionalWorldsAiActionService(service).build_prompt(
        vertical_slug="realtor",
        action_key="sales_copy",
        variables={"property": property_row, "tone": payload.tone, "instruction": payload.instruction or ""},
        fallback_prompt=prompt,
    )
    recipe_key = str((action or {}).get("action_key") or recipe_key)
    return StreamingResponse(
        _stream_ugs_text_artifact(
            user_id=user_id,
            service=service,
            ugs_service=ugs_service,
            type_key=resolve_pw_ugs_type_key(action),
            prompt=prompt,
            recipe_key=recipe_key,
            artifact_title=f"Контент-пак: {property_row['title']}",
            source_type="realtor_property",
            source_id=property_id,
            idempotency_key=_idempotency_key(payload.idempotency_key, request),
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@ai_streams_router.post(
    "/coach/simulate/stream",
    responses=_PW_AI_TEXT_STREAM_RESPONSES,
)
async def coach_simulation_stream(
    payload: CoachSimulationBody,
    request: Request,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
) -> StreamingResponse:
    """Run a realtor role-play coach simulation through UGS."""
    user_id = _current_user_id(user)
    service = _service(db)
    recipe_key, prompt = service.build_coach_prompt(payload)
    action, prompt = await ProfessionalWorldsAiActionService(service).build_prompt(
        vertical_slug="realtor",
        action_key="safety_rewrite",
        variables={"scenario": payload.scenario, "user_message": payload.user_message},
        fallback_prompt=prompt,
    )
    recipe_key = str((action or {}).get("action_key") or recipe_key)
    return StreamingResponse(
        _stream_ugs_text_artifact(
            user_id=user_id,
            service=service,
            ugs_service=ugs_service,
            type_key=resolve_pw_ugs_type_key(action),
            prompt=prompt,
            recipe_key=recipe_key,
            artifact_title=f"Тренажер: {payload.scenario}",
            source_type="learning_roleplay",
            source_id=None,
            idempotency_key=_idempotency_key(payload.idempotency_key, request),
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
