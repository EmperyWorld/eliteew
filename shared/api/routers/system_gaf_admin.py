# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Admin API: system GAF instruction template and manual sends (require admin role).
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""Admin API: system GAF instruction template and manual sends (require admin role)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool
from api.gaf_chat.constants import is_gaf_system_user_id
from api.gaf_chat.service import GafChatService
from api.gaf_chat.system_gaf_instruction import (
    build_instruction_body_and_metadata,
    fetch_instruction_row,
    normalize_instruction_locale,
    upsert_instruction,
)
from api.routers.desktop_admin import require_admin_user

router = APIRouter(prefix="/desktop/admin", tags=["desktop-admin"])


class InstructionStepIn(BaseModel):
    title: str = ""
    body: str = ""
    open_app_component: str | None = None
    button_label: str | None = None


class SystemGafInstructionPutBody(BaseModel):
    locale: str = Field(default="ru", max_length=16)
    welcome_text: str = ""
    thanks_text: str = ""
    steps: list[InstructionStepIn] = Field(default_factory=list)


class SystemGafInstructionResponse(BaseModel):
    locale: str
    welcome_text: str
    thanks_text: str
    steps: list[dict[str, Any]]
    updated_at: str | None = None
    updated_by: str | None = None


class SystemGafSendBody(BaseModel):
    user_id: UUID | None = None
    user_ids: list[UUID] | None = None
    use_template: bool = True
    dry_run: bool = False
    locale: str = Field(default="ru", max_length=16)


# Anti-misfire: exact string required in POST body.
BROADCAST_CONFIRM_PHRASE = "SEND_INSTRUCTION_TO_ALL_USERS"


class SystemGafBroadcastBody(BaseModel):
    confirm: str = Field(..., min_length=1, description="Must match server constant (see API docs).")
    locale: str = Field(default="ru", max_length=16)


@router.get("/system-gaf/instruction", response_model=SystemGafInstructionResponse)
async def get_system_gaf_instruction(
    locale: str = "ru",
    _admin: AuthUser = Depends(require_admin_user),
) -> SystemGafInstructionResponse:
    loc = normalize_instruction_locale(locale)
    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        row = await fetch_instruction_row(conn, loc)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instruction template not found")
    ua = row.get("updated_at")
    return SystemGafInstructionResponse(
        locale=row["locale"],
        welcome_text=row["welcome_text"],
        thanks_text=row["thanks_text"],
        steps=list(row["steps"] or []),
        updated_at=ua.isoformat() if ua else None,
        updated_by=row.get("updated_by"),
    )


@router.put("/system-gaf/instruction", response_model=SystemGafInstructionResponse)
async def put_system_gaf_instruction(
    body: SystemGafInstructionPutBody,
    admin: AuthUser = Depends(require_admin_user),
) -> SystemGafInstructionResponse:
    try:
        steps_dicts = [s.model_dump(exclude_none=True) for s in body.steps]
        row = await upsert_instruction(
            await get_asyncpg_pool(),
            locale=normalize_instruction_locale(body.locale),
            welcome_text=body.welcome_text,
            thanks_text=body.thanks_text,
            steps=steps_dicts,
            admin_user_id=str(admin.id),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    ua = row.get("updated_at")
    return SystemGafInstructionResponse(
        locale=row["locale"],
        welcome_text=row["welcome_text"],
        thanks_text=row["thanks_text"],
        steps=list(row["steps"] or []),
        updated_at=ua.isoformat() if ua else None,
        updated_by=row.get("updated_by"),
    )


@router.post("/system-gaf/send-test", status_code=status.HTTP_200_OK)
async def post_system_gaf_send_test(
    locale: str = Query(default="ru", max_length=16),
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    loc = normalize_instruction_locale(locale)
    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        row = await fetch_instruction_row(conn, loc)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instruction template not found")
    body_text, meta = build_instruction_body_and_metadata(
        row["welcome_text"],
        row["thanks_text"],
        list(row["steps"] or []),
    )
    if not body_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template is empty; fill welcome/thanks/steps first",
        )
    svc = GafChatService(pool)
    msg = await svc.send_service_message_to_user(str(admin.id), body_text, metadata=meta)
    if msg is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send")
    return {"ok": True, "message_id": msg.get("id")}


@router.post("/system-gaf/send", status_code=status.HTTP_200_OK)
async def post_system_gaf_send(
    body: SystemGafSendBody,
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    if not body.use_template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only use_template=true is supported for bulk send",
        )

    pool = await get_asyncpg_pool()
    ids: list[UUID] = []
    if body.user_ids:
        ids.extend(body.user_ids)
    if body.user_id:
        ids.append(body.user_id)
    uniq = list(dict.fromkeys(ids))
    if not uniq:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id or user_ids required")
    for uid in uniq:
        if is_gaf_system_user_id(str(uid)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot target system GAF user")

    loc = normalize_instruction_locale(body.locale)
    async with pool.acquire() as conn:
        template_row = await fetch_instruction_row(conn, loc)
    if template_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instruction template not found for locale={loc}",
        )

    body_text, meta = build_instruction_body_and_metadata(
        template_row["welcome_text"],
        template_row["thanks_text"],
        list(template_row["steps"] or []),
    )
    if not body_text.strip():
        return {
            "sent": [],
            "skipped": [str(u) for u in uniq],
            "dry_run": body.dry_run,
            "locale": loc,
        }

    svc = GafChatService(pool)
    sent: list[str] = []
    skipped: list[str] = []
    for uid in uniq:
        uid_s = str(uid)
        if body.dry_run:
            sent.append(uid_s)
            continue
        msg = await svc.send_service_message_to_user(uid_s, body_text, metadata=meta)
        if msg:
            sent.append(uid_s)
        else:
            skipped.append(uid_s)

    return {"sent": sent, "skipped": skipped, "dry_run": body.dry_run, "locale": loc}


@router.get("/system-gaf/broadcast-preview", status_code=status.HTTP_200_OK)
async def get_system_gaf_broadcast_preview(
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """How many users would receive a broadcast (excludes system accounts and GAF system user)."""
    from api.gaf_chat.constants import get_gaf_system_user_id

    pool = await get_asyncpg_pool()
    gaf_uid = get_gaf_system_user_id()
    async with pool.acquire() as conn:
        n = await conn.fetchval(
            """
            SELECT COUNT(*)::bigint
            FROM users
            WHERE COALESCE(is_system_account, false) = false
              AND id <> $1::uuid
            """,
            gaf_uid,
        )
    return {"recipient_count": int(n or 0)}


@router.post("/system-gaf/send-broadcast", status_code=status.HTTP_202_ACCEPTED)
async def post_system_gaf_send_broadcast(
    body: SystemGafBroadcastBody,
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """Queue Celery task: send current instruction template to all eligible users."""
    if (body.confirm or "").strip() != BROADCAST_CONFIRM_PHRASE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Invalid confirm. Send JSON {{"confirm": "{BROADCAST_CONFIRM_PHRASE}"}} exactly.',
        )
    try:
        from api.tasks.system_gaf_broadcast import broadcast_instruction_to_all_users
    except ImportError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Broadcast task module not available",
        ) from e

    loc = normalize_instruction_locale(body.locale)
    async_result = broadcast_instruction_to_all_users.delay(
        admin_user_id=str(admin.id),
        locale=loc,
    )
    return {
        "queued": True,
        "task_id": str(async_result.id),
        "confirm_phrase": BROADCAST_CONFIRM_PHRASE,
        "hint": "Track Celery worker logs for progress; task name api.tasks.system_gaf_broadcast.broadcast_instruction_to_all_users",
    }
