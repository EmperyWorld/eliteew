# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://empery.world
#  Author: po&T && TZBrand
# ------------------------------------------------------------------------------
# Purpose:
#   Voice commands API: durable audit trail (Postgres) and static command catalog.
# Invariants:
#   - GET/POST audit scoped to authenticated user_id only (no admin-wide list in MVP).
# Related:
#   - api/services/voice_command_audit_service.py
#   - documentation/product/VOICE-CONTROL-STUDIO.md
# ------------------------------------------------------------------------------
"""
Voice commands API: audit trail and command catalog.

- POST /audit - record command execution (authenticated user)
- GET /audit - list own audit entries only
- GET /catalog - static command catalog mirror
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.services import voice_command_audit_service as audit_svc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/voice-commands", tags=["Voice Commands - Audit & Policy"])


class AuditEntryCreate(BaseModel):
    command_id: str = Field(..., min_length=1, max_length=128)
    transcript: str = Field("", max_length=2000)
    status: str = Field(..., pattern="^(success|error|cancelled)$")


class AuditEntryResponse(BaseModel):
    id: str
    user_id: str
    command_id: str
    transcript: str
    status: str
    created_at: str


@router.post("/audit", response_model=AuditEntryResponse)
async def create_audit_entry(
    body: AuditEntryCreate,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> AuditEntryResponse:
    """Record a voice command execution for audit trail (Postgres)."""
    entry = await audit_svc.create_audit_entry(
        db,
        user_id=uuid.UUID(str(user.id)),
        command_id=body.command_id,
        transcript=body.transcript,
        status=body.status,
    )
    logger.info(
        "[STEP] voice_command_audit_created command_id=%s status=%s",
        body.command_id,
        body.status,
        extra={"stage": "voice_command_audit", "command_id": body.command_id, "status": body.status},
    )
    return AuditEntryResponse(**entry)


# Static catalog (mirrors frontend COMMAND_CATALOG for admin/API consumers)
COMMAND_CATALOG_API = [
    {"id": "open_gaf_chat", "command": "открой чат", "description": "Открыть GAF Chat", "category": "apps"},
    {"id": "open_content", "command": "открой контент", "description": "Открыть Файловый менеджер", "category": "apps"},
    {
        "id": "open_ugs_analytics",
        "command": "открой аналитику",
        "description": "Открыть UGS Аналитику",
        "category": "apps",
    },
    {
        "id": "open_presentations",
        "command": "открой презентации",
        "description": "Открыть Presentations",
        "category": "apps",
    },
    {"id": "open_doc_editor", "command": "открой документы", "description": "Открыть Doc Editor", "category": "apps"},
    {"id": "create_folder", "command": "создай папку", "description": "Создать новую папку", "category": "desktop"},
    {"id": "minimize_all", "command": "сверни всё", "description": "Свернуть все окна", "category": "desktop"},
    {
        "id": "show_desktop",
        "command": "покажи рабочий стол",
        "description": "Показать рабочий стол",
        "category": "desktop",
    },
    {"id": "close_window", "command": "закрой окно", "description": "Закрыть активное окно", "category": "desktop"},
    {"id": "time", "command": "который час", "description": "Узнать время", "category": "info"},
    {"id": "date", "command": "какое сегодня число", "description": "Узнать дату", "category": "info"},
    {"id": "weather", "command": "какая погода", "description": "Узнать погоду", "category": "info"},
    {"id": "help", "command": "помощь", "description": "Показать команды", "category": "system"},
    {"id": "clear_history", "command": "очисти историю", "description": "Очистить чат", "category": "system"},
    {"id": "thanks", "command": "спасибо", "description": "Благодарность", "category": "system"},
    {"id": "greeting", "command": "привет", "description": "Приветствие", "category": "system"},
]


@router.get("/catalog")
async def get_catalog(
    user: User = Depends(require_oauth2_user),
) -> list[dict[str, Any]]:
    """Return voice command catalog (read-only for admin/UI)."""
    return list(COMMAND_CATALOG_API)


@router.get("/audit", response_model=list[AuditEntryResponse])
async def list_audit_entries(
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[AuditEntryResponse]:
    """List audit entries for the current user only (own executions)."""
    rows = await audit_svc.list_audit_entries(
        db,
        user_id=uuid.UUID(str(user.id)),
        limit=limit,
        offset=offset,
    )
    return [AuditEntryResponse(**e) for e in rows]
