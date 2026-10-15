# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Product desktop feedback tickets: user submissions and admin queue.
# Invariants:
# - admin_notes is user-visible team reply; no internal-only notes in this field.
# Related:
# - api/routers/product_desktop.py (parent router include)
# - documentation/product/FEEDBACK-HUB.md
# ---
"""Feedback tickets for product desktop API."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool, get_postgres_session
from api.core.unified_config import unified_settings
from api.gaf_chat.system_notifications import notify_user_energy_credits_changed
from api.models.database_models import User as DBUser
from api.routers.desktop import get_desktop_user_id
from api.routers.desktop_admin import require_admin_user
from api.services.rate_limiter import RateLimiter, get_feedback_ticket_rate_limiter
from api.services.ugs.billing_service import BillingService

logger = logging.getLogger(__name__)

_FEEDBACK_META_MAX_BYTES = 4096

feedback_router = APIRouter(tags=["product-desktop"])


class FeedbackTicketCreateBody(BaseModel):
    kind: str = Field(..., description="wish or bug")
    body: str = Field(..., min_length=1, max_length=20000)
    client_meta: dict[str, Any] | None = Field(
        None,
        description="Optional client context (build, UA) for triage",
    )

    @field_validator("kind")
    @classmethod
    def _kind_ok(cls, v: str) -> str:
        if v not in ("wish", "bug"):
            msg = "kind must be wish or bug"
            raise ValueError(msg)
        return v

    @field_validator("client_meta")
    @classmethod
    def _meta_size(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        if v is None:
            return None
        raw = json.dumps(v, ensure_ascii=False)
        if len(raw.encode("utf-8")) > _FEEDBACK_META_MAX_BYTES:
            msg = f"client_meta exceeds {_FEEDBACK_META_MAX_BYTES} bytes"
            raise ValueError(msg)
        return v


class FeedbackTicketOut(BaseModel):
    id: UUID
    kind: str
    body: str
    status: str
    admin_notes: str | None
    reward_credits: float | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    client_meta: dict[str, Any] | None = None


class FeedbackSubmitterOut(BaseModel):
    """Кто отправил обращение (для админ-очереди)."""

    id: UUID
    username: str
    email: str
    full_name: str | None = None
    avatar_url: str | None = None


class FeedbackTicketAdminOut(FeedbackTicketOut):
    user_id: UUID
    submitter: FeedbackSubmitterOut | None = None


class FeedbackTicketListOut(BaseModel):
    items: list[FeedbackTicketOut]
    total: int


class FeedbackTicketAdminListOut(BaseModel):
    items: list[FeedbackTicketAdminOut]
    total: int


class FeedbackSummaryOut(BaseModel):
    """Сводка для UI: лимиты по типам и сумма «признания» (не денежное)."""

    is_trusted: bool
    wish_count: int = Field(
        ...,
        description="Число активных (незакрытых) обращений kind=wish для лимита",
    )
    wish_limit: int
    bug_count: int = Field(
        ...,
        description="Число активных (незакрытых) обращений kind=bug для лимита",
    )
    bug_limit: int
    team_recognition_total: float = Field(
        ...,
        description="Сумма внутренних отметок за закрытые обращения (reward_credits), не валюта",
    )


class FeedbackPatchBody(BaseModel):
    status: str | None = None
    admin_notes: str | None = None


class FeedbackCloseBody(BaseModel):
    reward_credits: float | None = Field(None, ge=0)
    admin_notes: str | None = None


VALID_FEEDBACK_STATUS = frozenset({"open", "in_progress", "resolved", "closed"})
VALID_FEEDBACK_KIND = frozenset({"wish", "bug"})

# --- Assistant ---


def _parse_client_meta(val: Any) -> dict[str, Any] | None:
    if val is None:
        return None
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        try:
            parsed: Any = json.loads(val)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None
    return None


def _ticket_out(row: Any) -> FeedbackTicketOut:
    d = dict(row)
    rc = d.get("reward_credits")
    if rc is not None:
        d["reward_credits"] = float(rc)
    if "client_meta" in d:
        d["client_meta"] = _parse_client_meta(d.get("client_meta"))
    return FeedbackTicketOut.model_validate(d)


def _admin_ticket_out(row: Any) -> FeedbackTicketAdminOut:
    d = dict(row)
    rc = d.get("reward_credits")
    if rc is not None:
        d["reward_credits"] = float(rc)
    if "client_meta" in d:
        d["client_meta"] = _parse_client_meta(d.get("client_meta"))
    submitter_username = d.pop("submitter_username", None)
    submitter_email = d.pop("submitter_email", None)
    submitter_full_name = d.pop("submitter_full_name", None)
    submitter_avatar_url = d.pop("submitter_avatar_url", None)
    submitter: FeedbackSubmitterOut | None = None
    if submitter_username:
        submitter = FeedbackSubmitterOut(
            id=d["user_id"],
            username=str(submitter_username),
            email=str(submitter_email or ""),
            full_name=submitter_full_name,
            avatar_url=submitter_avatar_url,
        )
    d["submitter"] = submitter
    return FeedbackTicketAdminOut.model_validate(d)


async def _build_feedback_summary(db: AsyncSession, user_id: UUID) -> FeedbackSummaryOut:
    uid = str(user_id)
    tr = await db.execute(
        text("SELECT COALESCE(is_trusted, false) AS t FROM users WHERE id = CAST(:id AS uuid)"),
        {"id": uid},
    )
    trow = tr.mappings().first()
    is_trusted = bool(trow["t"]) if trow else False

    wish_limit = (
        unified_settings.feedback_wish_limit_trusted if is_trusted else unified_settings.feedback_wish_limit_default
    )
    bug_limit = (
        unified_settings.feedback_bug_limit_trusted if is_trusted else unified_settings.feedback_bug_limit_default
    )

    cw = await db.execute(
        text(
            """
            SELECT COUNT(*)::int AS c FROM feedback_tickets
            WHERE user_id = CAST(:uid AS uuid) AND kind = 'wish' AND status <> 'closed'
            """
        ),
        {"uid": uid},
    )
    wish_count = int(cw.scalar_one())

    cb = await db.execute(
        text(
            """
            SELECT COUNT(*)::int AS c FROM feedback_tickets
            WHERE user_id = CAST(:uid AS uuid) AND kind = 'bug' AND status <> 'closed'
            """
        ),
        {"uid": uid},
    )
    bug_count = int(cb.scalar_one())

    rs = await db.execute(
        text(
            """
            SELECT COALESCE(SUM(reward_credits), 0)::double precision AS s
            FROM feedback_tickets
            WHERE user_id = CAST(:uid AS uuid)
              AND closed_at IS NOT NULL
              AND reward_credits IS NOT NULL
              AND reward_credits > 0
            """
        ),
        {"uid": uid},
    )
    raw_s = rs.scalar_one()
    team_recognition_total = float(raw_s) if raw_s is not None else 0.0

    return FeedbackSummaryOut(
        is_trusted=is_trusted,
        wish_count=wish_count,
        wish_limit=wish_limit,
        bug_count=bug_count,
        bug_limit=bug_limit,
        team_recognition_total=team_recognition_total,
    )


@feedback_router.get("/feedback/summary", response_model=FeedbackSummaryOut)
async def get_feedback_summary(
    db: AsyncSession = Depends(get_postgres_session),
    user_id: UUID = Depends(get_desktop_user_id),
) -> FeedbackSummaryOut:
    return await _build_feedback_summary(db, user_id)


@feedback_router.post("/feedback/tickets", response_model=FeedbackTicketOut)
async def create_feedback_ticket(
    body: FeedbackTicketCreateBody,
    db: AsyncSession = Depends(get_postgres_session),
    user_id: UUID = Depends(get_desktop_user_id),
    rate_limiter: RateLimiter = Depends(get_feedback_ticket_rate_limiter),
) -> FeedbackTicketOut:
    if unified_settings.rate_limit_enabled:
        allowed, retry_after = rate_limiter.check_rate_limit(str(user_id))
        if not allowed:
            ra = int(retry_after) if retry_after is not None else 60
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Слишком много обращений. Подождите и попробуйте снова.",
                headers={"Retry-After": str(max(1, ra))},
            )

    summary = await _build_feedback_summary(db, user_id)
    if body.kind == "wish" and summary.wish_count >= summary.wish_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Достигнут лимит пожеланий ({summary.wish_limit}).",
        )
    if body.kind == "bug" and summary.bug_count >= summary.bug_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Достигнут лимит сообщений об ошибках ({summary.bug_limit}).",
        )

    meta_param: str | None = None
    if body.client_meta is not None:
        meta_param = json.dumps(body.client_meta, ensure_ascii=False)

    result = await db.execute(
        text(
            """
            INSERT INTO feedback_tickets (user_id, kind, body, client_meta)
            VALUES (:user_id, :kind, :body, CAST(:client_meta AS jsonb))
            RETURNING id, kind, body, status, admin_notes, reward_credits, closed_at, created_at, updated_at, client_meta
            """
        ),
        {
            "user_id": str(user_id),
            "kind": body.kind,
            "body": body.body,
            "client_meta": meta_param,
        },
    )
    await db.commit()
    row = result.mappings().one()
    return _ticket_out(row)


@feedback_router.get("/feedback/tickets", response_model=FeedbackTicketListOut)
async def list_my_feedback(
    db: AsyncSession = Depends(get_postgres_session),
    user_id: UUID = Depends(get_desktop_user_id),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    kind_filter: str | None = Query(None, alias="kind"),
) -> FeedbackTicketListOut:
    if kind_filter is not None and kind_filter not in VALID_FEEDBACK_KIND:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid kind")

    uid = str(user_id)
    if kind_filter:
        count_r = await db.execute(
            text("SELECT COUNT(*)::int AS c FROM feedback_tickets WHERE user_id = :uid AND kind = :kind"),
            {"uid": uid, "kind": kind_filter},
        )
        total = int(count_r.scalar_one())
        result = await db.execute(
            text(
                """
                SELECT id, kind, body, status, admin_notes, reward_credits, closed_at, created_at, updated_at, client_meta
                FROM feedback_tickets
                WHERE user_id = :uid AND kind = :kind
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            {"uid": uid, "kind": kind_filter, "limit": limit, "offset": offset},
        )
    else:
        count_r = await db.execute(
            text("SELECT COUNT(*)::int AS c FROM feedback_tickets WHERE user_id = :uid"),
            {"uid": uid},
        )
        total = int(count_r.scalar_one())
        result = await db.execute(
            text(
                """
                SELECT id, kind, body, status, admin_notes, reward_credits, closed_at, created_at, updated_at, client_meta
                FROM feedback_tickets
                WHERE user_id = :uid
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            {"uid": uid, "limit": limit, "offset": offset},
        )
    items = [_ticket_out(r) for r in result.mappings().all()]
    return FeedbackTicketListOut(items=items, total=total)


@feedback_router.get("/admin/feedback/tickets", response_model=FeedbackTicketAdminListOut)
async def admin_list_feedback(
    status_filter: str | None = Query(None, alias="status"),
    kind_filter: str | None = Query(None, alias="kind"),
    q: str | None = Query(None, max_length=200),
    include_closed: bool = Query(False, alias="include_closed"),
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> FeedbackTicketAdminListOut:
    if status_filter and status_filter not in VALID_FEEDBACK_STATUS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    if kind_filter is not None and kind_filter not in VALID_FEEDBACK_KIND:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid kind")

    q_norm = (q or "").strip() or None

    where_parts: list[str] = []
    filter_params: dict[str, Any] = {}
    if status_filter:
        where_parts.append("ft.status = :st")
        filter_params["st"] = status_filter
    elif not include_closed:
        where_parts.append("ft.status <> 'closed'")
    if kind_filter:
        where_parts.append("ft.kind = :kind")
        filter_params["kind"] = kind_filter
    if q_norm:
        where_parts.append("(ft.body ILIKE :qq OR CAST(ft.id AS text) ILIKE :qq)")
        filter_params["qq"] = f"%{q_norm}%"

    where_sql = " AND ".join(where_parts) if where_parts else "TRUE"
    order_sql = "ORDER BY ft.created_at ASC" if status_filter else "ORDER BY ft.created_at DESC"

    count_r = await db.execute(
        text(f"SELECT COUNT(*)::int AS c FROM feedback_tickets ft WHERE {where_sql}"),
        filter_params,
    )
    total = int(count_r.scalar_one())

    list_params: dict[str, Any] = {
        **filter_params,
        "limit": limit,
        "offset": offset,
    }
    result = await db.execute(
        text(
            f"""
            SELECT ft.id, ft.user_id, ft.kind, ft.body, ft.status, ft.admin_notes, ft.reward_credits,
                   ft.closed_at, ft.created_at, ft.updated_at, ft.client_meta,
                   u.username AS submitter_username,
                   COALESCE(u.email, '') AS submitter_email,
                   u.full_name AS submitter_full_name,
                   u.avatar_url AS submitter_avatar_url
            FROM feedback_tickets ft
            LEFT JOIN users u ON u.id = ft.user_id
            WHERE {where_sql}
            {order_sql}
            LIMIT :limit OFFSET :offset
            """
        ),
        list_params,
    )
    items = [_admin_ticket_out(r) for r in result.mappings().all()]
    return FeedbackTicketAdminListOut(items=items, total=total)


@feedback_router.patch("/admin/feedback/tickets/{ticket_id}", response_model=FeedbackTicketAdminOut)
async def admin_patch_feedback(
    ticket_id: UUID,
    body: FeedbackPatchBody,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> FeedbackTicketAdminOut:
    if body.status is not None and body.status not in VALID_FEEDBACK_STATUS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    if body.status is None and body.admin_notes is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields")
    sets: list[str] = []
    params: dict[str, Any] = {"id": str(ticket_id), "updated_at": datetime.now(UTC)}
    if body.status is not None:
        sets.append("status = :status")
        params["status"] = body.status
    if body.admin_notes is not None:
        sets.append("admin_notes = :admin_notes")
        params["admin_notes"] = body.admin_notes
    sets.append("updated_at = :updated_at")
    await db.execute(
        text(f"UPDATE feedback_tickets SET {', '.join(sets)} WHERE id = :id"),
        params,
    )
    await db.commit()
    r = await db.execute(
        text(
            """
            SELECT ft.id, ft.user_id, ft.kind, ft.body, ft.status, ft.admin_notes, ft.reward_credits,
                   ft.closed_at, ft.created_at, ft.updated_at, ft.client_meta,
                   u.username AS submitter_username,
                   COALESCE(u.email, '') AS submitter_email,
                   u.full_name AS submitter_full_name,
                   u.avatar_url AS submitter_avatar_url
            FROM feedback_tickets ft
            LEFT JOIN users u ON u.id = ft.user_id
            WHERE ft.id = :id
            """
        ),
        {"id": str(ticket_id)},
    )
    row = r.mappings().first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return _admin_ticket_out(row)


@feedback_router.post("/admin/feedback/tickets/{ticket_id}/close", response_model=FeedbackTicketAdminOut)
async def admin_close_feedback(
    ticket_id: UUID,
    body: FeedbackCloseBody,
    db: AsyncSession = Depends(get_postgres_session),
    db_pool: Any = Depends(get_asyncpg_pool),
    _admin: AuthUser = Depends(require_admin_user),
) -> FeedbackTicketAdminOut:
    r0 = await db.execute(
        text("SELECT id, user_id, status FROM feedback_tickets WHERE id = :id"),
        {"id": str(ticket_id)},
    )
    trow = r0.mappings().first()
    if not trow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    if str(trow["status"]) == "closed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ticket already closed")
    uid = UUID(str(trow["user_id"]))

    reward = body.reward_credits
    reward_int = int(round(float(reward))) if reward is not None and float(reward) > 0 else 0

    if reward_int > 0:
        billing = BillingService(db)
        ok = await billing.add_credits(str(uid), reward_int)
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not add credits",
            )
        bal_row = await db.execute(select(DBUser.credits).where(DBUser.id == uid))
        new_bal = float(bal_row.scalar_one() or 0)
        msg = f"Спасибо за обращение! Начислено {reward_int} кредитов UGS. Текущий баланс: {new_bal:.2f}."
        await notify_user_energy_credits_changed(
            db_pool,
            str(uid),
            new_balance=new_bal,
            delta=float(reward_int),
            message_override=msg,
        )

    notes_sql = body.admin_notes
    await db.execute(
        text(
            """
            UPDATE feedback_tickets
            SET status = 'closed',
                closed_at = COALESCE(closed_at, NOW()),
                reward_credits = CASE WHEN :has_reward THEN :reward ELSE reward_credits END,
                admin_notes = COALESCE(:notes, admin_notes),
                updated_at = NOW()
            WHERE id = :id
            """
        ),
        {
            "id": str(ticket_id),
            "has_reward": reward_int > 0,
            "reward": Decimal(str(reward_int)),
            "notes": notes_sql,
        },
    )
    await db.commit()

    r = await db.execute(
        text(
            """
            SELECT ft.id, ft.user_id, ft.kind, ft.body, ft.status, ft.admin_notes, ft.reward_credits,
                   ft.closed_at, ft.created_at, ft.updated_at, ft.client_meta,
                   u.username AS submitter_username,
                   COALESCE(u.email, '') AS submitter_email,
                   u.full_name AS submitter_full_name,
                   u.avatar_url AS submitter_avatar_url
            FROM feedback_tickets ft
            LEFT JOIN users u ON u.id = ft.user_id
            WHERE ft.id = :id
            """
        ),
        {"id": str(ticket_id)},
    )
    row = r.mappings().first()
    assert row
    return _admin_ticket_out(row)
