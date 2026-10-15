# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP API for POEMMA server-first workspace snapshot, backup import and role resolution.
# Invariants:
# - All operations are bound to authenticated OAuth2 user and resolved PostgreSQL users.id.
# - Writes go through service ACL and reject unauthorized mutations with 403.
# - Response payload always returns current role + full storage snapshot.
# Related:
# - api/services/poemma_service.py
# - api/models/poemma.py
# ---

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.core.user_identity import resolve_db_user_uuid_with_session
from api.services.poemma_service import (
    PoemmaWorkspaceState,
    extract_poemma_org_id_from_payload,
    resolve_poemma_workspace_state,
    update_poemma_actor_role,
    upsert_poemma_workspace_payload,
    validate_poemma_backup_payload,
)

router = APIRouter(prefix="/desktop/poemma", tags=["desktop-poemma"])


class PoemmaWorkspaceUpsertRequest(BaseModel):
    storage_payload: dict[str, Any] = Field(default_factory=dict)
    payload_version: str = Field(default="v1", max_length=32)
    org_id: str | None = Field(default=None, max_length=120)
    mutation: str | None = Field(default=None, max_length=120)
    migrated_from_local: bool = False


class PoemmaImportLocalBackupRequest(BaseModel):
    backup: dict[str, Any]


class PoemmaRoleUpdateRequest(BaseModel):
    role: str = Field(min_length=1, max_length=32)


class PoemmaWorkspaceResponse(BaseModel):
    exists: bool
    workspace_id: str | None = None
    owner_user_id: str | None = None
    role: str
    org_id: str | None = None
    payload_version: str = "v1"
    storage_payload: dict[str, Any] = Field(default_factory=dict)
    migrated_from_local: bool = False
    updated_at: str | None = None


def _workspace_response_from_state(state: PoemmaWorkspaceState) -> PoemmaWorkspaceResponse:
    workspace = state.workspace
    if workspace is None:
        return PoemmaWorkspaceResponse(
            exists=False,
            role=state.role,
            payload_version="v1",
            storage_payload={},
            migrated_from_local=False,
        )
    return PoemmaWorkspaceResponse(
        exists=True,
        workspace_id=str(workspace.id),
        owner_user_id=str(workspace.owner_user_id),
        role=state.role,
        org_id=workspace.org_id,
        payload_version=workspace.payload_version,
        storage_payload=workspace.storage_payload or {},
        migrated_from_local=bool(workspace.migrated_from_local),
        updated_at=workspace.updated_at.isoformat() if workspace.updated_at else None,
    )


@router.get("/workspace", response_model=PoemmaWorkspaceResponse)
async def get_poemma_workspace(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> PoemmaWorkspaceResponse:
    actor_user_id = await resolve_db_user_uuid_with_session(current_user, db)
    state = await resolve_poemma_workspace_state(db, actor_user_id, current_user.role)
    return _workspace_response_from_state(state)


@router.put("/workspace", response_model=PoemmaWorkspaceResponse)
async def put_poemma_workspace(
    body: PoemmaWorkspaceUpsertRequest,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> PoemmaWorkspaceResponse:
    actor_user_id = await resolve_db_user_uuid_with_session(current_user, db)
    try:
        state = await upsert_poemma_workspace_payload(
            db=db,
            actor_user_id=actor_user_id,
            platform_role=current_user.role,
            storage_payload=body.storage_payload,
            payload_version=body.payload_version,
            org_id=body.org_id,
            mutation=body.mutation,
            migrated_from_local=body.migrated_from_local,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    return _workspace_response_from_state(state)


@router.post("/workspace/import-local-backup", response_model=PoemmaWorkspaceResponse)
async def import_poemma_local_backup(
    body: PoemmaImportLocalBackupRequest,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> PoemmaWorkspaceResponse:
    actor_user_id = await resolve_db_user_uuid_with_session(current_user, db)
    try:
        entries = validate_poemma_backup_payload(body.backup, actor_user_id)
        state = await upsert_poemma_workspace_payload(
            db=db,
            actor_user_id=actor_user_id,
            platform_role=current_user.role,
            storage_payload=entries,
            payload_version=str(body.backup.get("version", "v1")),
            org_id=extract_poemma_org_id_from_payload(entries),
            mutation="importStorageBackup",
            migrated_from_local=True,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    return _workspace_response_from_state(state)


@router.patch("/workspace/role", response_model=PoemmaWorkspaceResponse)
async def patch_poemma_workspace_role(
    body: PoemmaRoleUpdateRequest,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> PoemmaWorkspaceResponse:
    actor_user_id = await resolve_db_user_uuid_with_session(current_user, db)
    try:
        state = await update_poemma_actor_role(
            db=db,
            actor_user_id=actor_user_id,
            platform_role=current_user.role,
            next_role=body.role,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    return _workspace_response_from_state(state)
