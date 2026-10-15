# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin JWT routes for one-code Air enrollment issuance and history.
# ---

from __future__ import annotations

from typing import NoReturn
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool
from api.routers.admin_auth import require_admin_user
from api.schemas.desktop_client.air_enroll import (
    AirEnrollCreateRequest,
    AirEnrollEventResponse,
    AirEnrollReissueRequest,
    AirEnrollRevealResponse,
    AirEnrollSessionListResponse,
    AirEnrollSessionResponse,
)
from api.services.desktop_client.air_enroll_service import AirEnrollService
from api.services.desktop_client.air_enroll_store import (
    AirEvent,
    AirSession,
)
from api.services.desktop_client.license_models import DesktopClientError

router = APIRouter(prefix="/air-enroll", tags=["desktop-admin-air-enroll"])


async def get_air_enroll_service(
    pool=Depends(get_asyncpg_pool),  # noqa: B008
) -> AirEnrollService:
    return AirEnrollService(pool)


def _actor(admin: AuthUser) -> str:
    actor = str(getattr(admin, "sub", None) or getattr(admin, "id", None) or "").strip()
    if not actor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "admin_identity_missing", "message": "Admin identity is missing"},
        )
    return actor


def _event_response(event: AirEvent) -> AirEnrollEventResponse:
    return AirEnrollEventResponse(
        sequence=event.sequence,
        event=event.event,
        lifecycle=event.lifecycle,
        cleanup_state=event.cleanup_state,
        reason=event.reason,
        detail=event.detail,
        created_at=event.created_at,
    )


def _session_response(
    session: AirSession,
    *,
    events: list[AirEvent] | None = None,
) -> AirEnrollSessionResponse:
    return AirEnrollSessionResponse(
        id=session.id,
        mode=session.mode,
        label=session.label,
        slug=session.slug,
        allowed_email=session.allowed_email,
        allow_fofline=session.allow_fofline,
        seat_expires_at=session.seat_expires_at,
        created_by=session.created_by,
        port=session.port,
        lifecycle=session.lifecycle,
        cleanup_state=session.cleanup_state,
        attempt_count=session.attempt_count,
        license_id=session.license_id,
        request_id=session.request_id,
        ecap_sha256=session.ecap_sha256,
        ecap_size=session.ecap_size,
        reissue_of=session.reissue_of,
        delivery_generation=session.delivery_generation,
        provision_expires_at=session.provision_expires_at,
        code_expires_at=session.code_expires_at,
        ready_at=session.ready_at,
        revealed_at=session.revealed_at,
        claimed_at=session.claimed_at,
        sealed_at=session.sealed_at,
        activation_acked_at=session.activation_acked_at,
        terminal_at=session.terminal_at,
        local_closed_at=session.local_closed_at,
        sg_closed_at=session.sg_closed_at,
        last_error_code=session.last_error_code,
        created_at=session.created_at,
        updated_at=session.updated_at,
        events=[_event_response(event) for event in events or []],
    )


def _raise_http(error: DesktopClientError) -> NoReturn:
    raise HTTPException(
        status_code=error.http_status,
        detail={"code": error.code, "message": error.message},
    ) from error


@router.post(
    "/sessions",
    response_model=AirEnrollSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_air_enroll_session(
    body: AirEnrollCreateRequest,
    admin: AuthUser = Depends(require_admin_user),
    service: AirEnrollService = Depends(get_air_enroll_service),  # noqa: B008
) -> AirEnrollSessionResponse:
    try:
        session = await service.create_intent(
            mode=body.mode,
            label=body.label,
            slug=body.slug,
            allowed_email=body.allowed_email,
            allow_fofline=body.allow_fofline,
            seat_expires_at=body.expires_at,
            created_by=_actor(admin),
            idempotency_key=body.idempotency_key,
        )
        events = await service.store.get_events(session.id)
    except DesktopClientError as exc:
        _raise_http(exc)
    return _session_response(session, events=events)


@router.get("/sessions", response_model=AirEnrollSessionListResponse)
async def list_air_enroll_sessions(
    _admin: AuthUser = Depends(require_admin_user),
    service: AirEnrollService = Depends(get_air_enroll_service),  # noqa: B008
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AirEnrollSessionListResponse:
    sessions, total = await service.list_sessions(limit=limit, offset=offset)
    return AirEnrollSessionListResponse(
        sessions=[_session_response(session) for session in sessions],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/sessions/{session_id}",
    response_model=AirEnrollSessionResponse,
)
async def get_air_enroll_session(
    session_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    service: AirEnrollService = Depends(get_air_enroll_service),  # noqa: B008
) -> AirEnrollSessionResponse:
    try:
        session, events = await service.get_session(session_id)
    except DesktopClientError as exc:
        _raise_http(exc)
    return _session_response(session, events=events)


@router.post(
    "/sessions/{session_id}/reveal",
    response_model=AirEnrollRevealResponse,
)
async def reveal_air_enroll_code(
    session_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    service: AirEnrollService = Depends(get_air_enroll_service),  # noqa: B008
) -> AirEnrollRevealResponse:
    try:
        session, code = await service.reveal(session_id=session_id)
        events = await service.store.get_events(session.id)
    except DesktopClientError as exc:
        _raise_http(exc)
    return AirEnrollRevealResponse(
        session=_session_response(session, events=events),
        access_code=code.render(),
    )


@router.post(
    "/sessions/{session_id}/cancel",
    response_model=AirEnrollSessionResponse,
)
async def cancel_air_enroll_session(
    session_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    service: AirEnrollService = Depends(get_air_enroll_service),  # noqa: B008
) -> AirEnrollSessionResponse:
    try:
        session = await service.cancel(session_id=session_id)
        events = await service.store.get_events(session.id)
    except DesktopClientError as exc:
        _raise_http(exc)
    return _session_response(session, events=events)


@router.post(
    "/sessions/{session_id}/reissue",
    response_model=AirEnrollSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def reissue_air_enroll_session(
    session_id: UUID,
    body: AirEnrollReissueRequest,
    admin: AuthUser = Depends(require_admin_user),
    service: AirEnrollService = Depends(get_air_enroll_service),  # noqa: B008
) -> AirEnrollSessionResponse:
    try:
        session = await service.reissue(
            source_session_id=session_id,
            created_by=_actor(admin),
            idempotency_key=body.idempotency_key,
        )
        events = await service.store.get_events(session.id)
    except DesktopClientError as exc:
        _raise_http(exc)
    return _session_response(session, events=events)
