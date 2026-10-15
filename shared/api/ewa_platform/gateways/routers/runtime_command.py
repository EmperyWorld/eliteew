# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Authenticated HTTP write-side for **EWA Runtime Gateway**: execute allowlisted typed commands for desktop actions,
# content reads/searches, and controlled DocEditor action payloads.
# Invariants:
# - Auth/user scope is server-derived; requests cannot spoof ``authorized_user_id`` or content owner.
# - Command dispatcher returns typed results/actions and rejects unsupported app/tool requests.
# Related:
# - api/ewa_platform/schemas/pydantic/runtime_command.py
# - api/ewa_platform/gateways/runtime_gateway/runtime_command.py
# ---
"""EWA Runtime Gateway command router."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.dependencies.user_context import get_current_user_db_id
from api.ewa_platform.gateways.runtime_gateway.catalog_preferences import (
    catalog_preferences_from_profile,
    catalog_preferences_to_mapping,
    parse_catalog_preference_intent,
    patch_catalog_preferences,
)
from api.ewa_platform.gateways.runtime_gateway.runtime_command import execute_runtime_command
from api.ewa_platform.gateways.runtime_gateway.runtime_context import build_runtime_context
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.schemas.pydantic.runtime_command import (
    EwaRuntimeCommandIn,
    EwaRuntimeCommandOut,
    EwaRuntimeTurnIn,
    EwaRuntimeTurnOut,
)
from api.routers.unified_content import get_content_query_service, get_content_service
from api.services.unified_content.content_query_service import ContentQueryService

router = APIRouter(tags=["EWA - Runtime Gateway"])


def _pool(request: Request) -> Any | None:
    return getattr(request.app.state, "ewa_orchestration_pool", None)


@router.post(
    "/runtime-command",
    response_model=EwaRuntimeCommandOut,
    operation_id="ewa_runtime_command_execute",
    summary="EWA runtime command: execute one allowlisted tool/action",
)
async def post_ewa_runtime_command(
    request: Request,
    body: EwaRuntimeCommandIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
    content_user_id: str = Depends(get_current_user_db_id),  # noqa: B008
    query_svc: ContentQueryService = Depends(get_content_query_service),  # noqa: B008
    storage_svc: Any = Depends(get_content_service),  # noqa: B008
) -> EwaRuntimeCommandOut:
    """Execute a typed EWA command under the authenticated user's scope."""

    return await execute_runtime_command(
        body,
        authorized_user_id=str(auth_user.id),
        content_user_id=content_user_id,
        oauth2_sub=str(auth_user.id),
        query_svc=query_svc,
        storage_svc=storage_svc,
        companion_pool=_pool(request),
    )


@router.post(
    "/runtime-turn",
    response_model=EwaRuntimeTurnOut,
    operation_id="ewa_runtime_turn_execute",
    summary="EWA runtime turn: context snapshot + typed command execution",
)
async def post_ewa_runtime_turn(
    request: Request,
    body: EwaRuntimeTurnIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
    content_user_id: str = Depends(get_current_user_db_id),  # noqa: B008
    query_svc: ContentQueryService = Depends(get_content_query_service),  # noqa: B008
    storage_svc: Any = Depends(get_content_service),  # noqa: B008
) -> EwaRuntimeTurnOut:
    """Execute a deterministic runtime turn; future LLM planners can target the same command contract."""

    commands = [
        cmd.model_copy(update={"dry_run": True}) if body.dry_run and not cmd.dry_run else cmd for cmd in body.commands
    ]
    results: list[EwaRuntimeCommandOut] = []
    pref_event = None
    pool = _pool(request)
    if body.message.strip():
        profile = (
            await companion_pg.companion_profile_fetch(pool, principal_id=str(auth_user.id))
            if pool is not None
            else None
        )
        pref_event = parse_catalog_preference_intent(body.message, catalog_preferences_from_profile(profile))
        if pref_event is not None:
            if body.dry_run:
                prefs, persisted = pref_event[0], False
            else:
                prefs, persisted = await patch_catalog_preferences(
                    pool,
                    principal_id=str(auth_user.id),
                    prefs=pref_event[0],
                    audit_action="runtime_turn_catalog_preferences",
                )
            results.append(
                EwaRuntimeCommandOut(
                    command_kind="catalog.preferences.update",
                    status="dry_run" if body.dry_run else "ok" if persisted else "rejected",
                    safety_tier="confirmed_mutation",
                    authorized_user_id=str(auth_user.id),
                    target={"principal_id": str(auth_user.id)},
                    result={"preferences": catalog_preferences_to_mapping(prefs), "parsed_from_message": True},
                    audit_skipped_reason=None if persisted else "no_companion_profile",
                    rejection_reason=None if persisted else "companion_profile_not_initialized",
                )
            )
    for cmd in commands:
        results.append(
            await execute_runtime_command(
                cmd,
                authorized_user_id=str(auth_user.id),
                content_user_id=content_user_id,
                oauth2_sub=str(auth_user.id),
                query_svc=query_svc,
                storage_svc=storage_svc,
                companion_pool=_pool(request),
            )
        )
    context = (
        await build_runtime_context(
            auth_user=auth_user,
            content_user_id=content_user_id,
            query_svc=query_svc,
            companion_pool=_pool(request),
        )
        if body.include_context
        else None
    )
    ok_count = sum(1 for row in results if row.status in {"ok", "dry_run"})
    blocked_count = len(results) - ok_count
    reply = (
        f"EWA runtime turn accepted {len(results)} command(s): {ok_count} ready, {blocked_count} blocked/awaiting confirmation."
        if results
        else "EWA runtime context is ready."
    )
    return EwaRuntimeTurnOut(
        reply=reply,
        context=context,
        command_results=results,
        events=[{"kind": "runtime_turn", "commands": len(results), "ok": ok_count, "blocked": blocked_count}],
    )
