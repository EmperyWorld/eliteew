# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Взаимодействие с представителем заказчика: мост к GAF-чату, согласование документов,
#   шаринг EWRP. JSON responses — Pydantic Out в schemas/marketing_cabinet/client_interaction.py.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
#   - File/HTML/PDF endpoints remain StreamingResponse/FileResponse (not JSON response_model).
# Related:
#   - api/schemas/marketing_cabinet/client_interaction.py
#   - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# ------------------------------------------------------------------------------
"""
Взаимодействие с представителем заказчика: мост к GAF-чату, согласование документов, шаринг EWRP.
"""

from __future__ import annotations

import io
import json
import os
from pathlib import Path
from urllib.parse import quote
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]
import structlog  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from fastapi.responses import FileResponse, StreamingResponse  # type: ignore[import-untyped]

from api.gaf_chat.service import GafChatService
from api.routers.marketing_cabinet.common import (
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
)
from api.routers.unified_content import get_content_service
from api.schemas.marketing_cabinet.client_interaction import (
    ClientChatBridgeOut,
    ClientEwrpJobListItemOut,
    ClientInteractionContextOut,
    ClientPresShareOut,
    CustomerFacingSummaryBody,
    CustomerFacingSummaryGetOut,
    CustomerFacingSummaryPayloadOut,
    CustomerFacingSummaryRecordOut,
    MarketingClientApprovalActionOut,
    MarketingClientDocApprovalOut,
    MarketingClientDocCountOut,
    MarketingClientDocPendingRemovalOut,
    MarketingClientRemovalIdOut,
    MarketingClientShareIdOut,
    MarketingOkOut,
    SendDocumentsBody,
    SharePresentationBody,
)
from api.services.friends_service import FriendsService
from api.services.unified_content.content_storage_service import ContentStorageService
from api.services.unified_content.storage_backends.minio_storage import SeaweedFileCorruptedError

logger = structlog.get_logger("api.routers.marketing_cabinet.client_interaction")

router = APIRouter(prefix="/client-interaction", tags=["Marketing Cabinet - Client interaction"])


async def _project_company_party(conn: asyncpg.Connection, project_id: UUID) -> asyncpg.Record:
    row = await conn.fetchrow(
        """
        SELECT
            p.id AS project_id,
            p.company_id,
            p.created_by AS project_created_by,
            c.user_id AS company_user_id,
            c.representative_user_id
        FROM projects p
        INNER JOIN companies c ON c.id = p.company_id AND c.deleted_at IS NULL
        WHERE p.id = $1 AND p.deleted_at IS NULL
        """,
        project_id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Проект не найден")
    return row


def _is_marketing_lead(viewer: UUID, party: asyncpg.Record) -> bool:
    uid = viewer
    owner = party["company_user_id"]
    lead = party["project_created_by"]
    if owner is not None and uid == owner:
        return True
    return lead is not None and uid == lead


def _is_customer_rep(viewer: UUID, party: asyncpg.Record) -> bool:
    rep = party["representative_user_id"]
    if rep is None:
        return False
    return viewer == rep


def _ewrp_owner_ids(party: asyncpg.Record) -> list[UUID]:
    out: list[UUID] = []
    for k in ("company_user_id", "project_created_by"):
        v = party[k]
        if v is not None and v not in out:
            out.append(v)
    return out


def _ewrp_job_has_servable_html(job_id: UUID, html_path: str | None) -> bool:
    """Есть ли index.html для показа заказчику: путь в БД или каталог EWRP по convention."""
    raw = (html_path or "").strip()
    if raw and os.path.isfile(raw):
        return True
    base = os.environ.get("GENERATED_FILES_BASE", "").strip()
    if base:
        alt = Path(base) / "generated_files" / "ewrp" / str(job_id) / "index.html"
        if alt.is_file():
            return True
    return False


@router.get("/context", response_model=ClientInteractionContextOut)
async def get_interaction_context(
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> ClientInteractionContextOut:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        rep_uid = party["representative_user_id"]
        if rep_uid is None:
            return ClientInteractionContextOut(
                project_id=str(project_id),
                has_representative=False,
                is_lead=_is_marketing_lead(user_id, party),
                is_customer_representative=False,
                lead_user_ids=[str(x) for x in _ewrp_owner_ids(party)],
            )
        lead_ids = _ewrp_owner_ids(party)
        is_lead = _is_marketing_lead(user_id, party)
        is_rep = _is_customer_rep(user_id, party)
        other_id = str(rep_uid) if is_lead else (str(lead_ids[0]) if lead_ids else None)
        partner = None
        if other_id is not None:
            partner = await FriendsService(db_pool).find_user_by_id(other_id)
        return ClientInteractionContextOut(
            project_id=str(project_id),
            has_representative=True,
            is_lead=is_lead,
            is_customer_representative=is_rep,
            representative_user_id=str(rep_uid),
            partner=partner,
            lead_user_ids=[str(x) for x in lead_ids],
        )


@router.get("/chat-bridge", response_model=ClientChatBridgeOut)
async def get_chat_bridge(
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> ClientChatBridgeOut:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        rep_uid = party["representative_user_id"]
        if rep_uid is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Для чата назначьте представителя заказчика в карточке компании",
            )
        is_lead = _is_marketing_lead(user_id, party)
        is_rep = _is_customer_rep(user_id, party)
        if not is_lead and not is_rep:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Чат доступен руководителю и представителю заказчика",
            )
        lead_ids = _ewrp_owner_ids(party)
        if not lead_ids:
            raise HTTPException(status_code=400, detail="Нет владельца проекта для чата")
        if is_lead:
            uid1, uid2 = str(user_id), str(rep_uid)
        else:
            uid1, uid2 = str(user_id), str(lead_ids[0])
        svc = GafChatService(db_pool)
        try:
            row = await svc.get_or_create_chat(uid1, uid2)
        except ValueError as e:
            logger.warning("gaf_chat_bridge_failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e) or "Не удалось открыть чат (проверьте дружбу между пользователями)",
            ) from e
        cid = row.get("id") or row.get("chat_id")
        partner_other = uid2 if str(user_id) == uid1 else uid1
        partner = await FriendsService(db_pool).find_user_by_id(partner_other)
        return ClientChatBridgeOut(
            chat_id=str(cid),
            partner=partner,
        )


@router.get("/customer-facing-summary", response_model=CustomerFacingSummaryGetOut)
async def get_customer_facing_summary(
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> CustomerFacingSummaryGetOut:
    """Сводка для заказчика: любой с доступом к проекту (в т.ч. представитель)."""
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT payload, updated_at, updated_by_user_id
            FROM marketing_customer_facing_summary
            WHERE project_id = $1
            """,
            project_id,
        )
    if row is None:
        return CustomerFacingSummaryGetOut(summary=None)
    pl = row["payload"]
    if isinstance(pl, str):
        try:
            pl = json.loads(pl)
        except json.JSONDecodeError:
            pl = {}
    if not isinstance(pl, dict):
        pl = {}
    return CustomerFacingSummaryGetOut(
        summary=CustomerFacingSummaryRecordOut(
            payload=CustomerFacingSummaryPayloadOut.model_validate(pl),
            updated_at=row["updated_at"],
            updated_by_user_id=(str(row["updated_by_user_id"]) if row["updated_by_user_id"] is not None else None),
        )
    )


@router.put("/customer-facing-summary", response_model=MarketingOkOut)
async def put_customer_facing_summary(
    project_id: UUID = Query(...),
    body: CustomerFacingSummaryBody = ...,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingOkOut:
    await get_accessible_project(
        db_pool, project_id, user_id, for_mutation=True, required_mc_module="client_interaction"
    )
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        if not _is_marketing_lead(user_id, party):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только руководитель задаёт сводку для кабинета заказчика",
            )
        payload_dict = body.model_dump(mode="json")
        await conn.execute(
            """
            INSERT INTO marketing_customer_facing_summary (
                project_id, payload, updated_by_user_id, updated_at
            ) VALUES ($1, $2::jsonb, $3, NOW())
            ON CONFLICT (project_id) DO UPDATE SET
                payload = EXCLUDED.payload,
                updated_by_user_id = EXCLUDED.updated_by_user_id,
                updated_at = NOW()
            """,
            project_id,
            json.dumps(payload_dict),
            user_id,
        )
    return MarketingOkOut(ok=True)


@router.get("/documents", response_model=list[MarketingClientDocApprovalOut])
async def list_document_approvals(
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> list[MarketingClientDocApprovalOut]:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                a.id,
                a.project_id,
                a.content_id,
                a.status,
                a.approved_at,
                a.created_at,
                a.sent_by_user_id,
                uc.name AS content_name,
                uc.title AS content_title
            FROM marketing_client_doc_approvals a
            INNER JOIN unified_content uc
              ON uc.id = a.content_id AND uc.deleted_at IS NULL
            WHERE a.project_id = $1
              AND a.status IN ('pending', 'approved')
            ORDER BY a.created_at DESC
            """,
            project_id,
        )
        removals = await conn.fetch(
            """
            SELECT r.id, r.approval_id, r.status, r.confirmed_at, r.created_at
            FROM marketing_client_doc_removal_requests r
            INNER JOIN marketing_client_doc_approvals a ON a.id = r.approval_id
            WHERE a.project_id = $1 AND r.status = 'pending'
            """,
            project_id,
        )
        rem_by_approval = {str(r["approval_id"]): dict(r) for r in removals}
    out: list[MarketingClientDocApprovalOut] = []
    for r in rows:
        aid = str(r["id"])
        rem = rem_by_approval.get(aid)
        pending = None
        if rem is not None:
            pending = MarketingClientDocPendingRemovalOut(
                id=str(rem["id"]),
                approval_id=str(rem["approval_id"]),
                status=str(rem["status"]),
                confirmed_at=rem.get("confirmed_at"),
                created_at=rem.get("created_at"),
            )
        out.append(
            MarketingClientDocApprovalOut(
                id=aid,
                project_id=str(r["project_id"]),
                content_id=str(r["content_id"]),
                status=str(r["status"]),
                approved_at=r["approved_at"],
                created_at=r["created_at"],
                sent_by_user_id=str(r["sent_by_user_id"]),
                content_name=r["content_name"],
                content_title=r["content_title"],
                pending_removal=pending,
            )
        )
    return out


@router.post(
    "/documents",
    status_code=status.HTTP_201_CREATED,
    response_model=MarketingClientDocCountOut,
)
async def send_documents_for_approval(
    project_id: UUID = Query(...),
    body: SendDocumentsBody = ...,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingClientDocCountOut:
    await get_accessible_project(
        db_pool, project_id, user_id, for_mutation=True, required_mc_module="client_interaction"
    )
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        if not _is_marketing_lead(user_id, party):
            raise HTTPException(status_code=403, detail="Только руководитель может выставлять документы")
        rep = party["representative_user_id"]
        if rep is None:
            raise HTTPException(status_code=400, detail="Нет представителя заказчика")
        company_id = party["company_id"]
        inserted = 0
        for cid in body.content_ids:
            ok = await conn.fetchval(
                """
                SELECT id FROM unified_content WHERE id = $1 AND deleted_at IS NULL
                """,
                cid,
            )
            if ok is None:
                continue
            await conn.execute(
                """
                INSERT INTO marketing_client_doc_approvals (
                    project_id, company_id, content_id, sent_by_user_id, status
                ) VALUES ($1, $2, $3, $4, 'pending')
                ON CONFLICT (project_id, content_id) DO UPDATE SET
                    sent_by_user_id = EXCLUDED.sent_by_user_id,
                    updated_at = NOW()
                WHERE marketing_client_doc_approvals.status = 'pending'
                """,
                project_id,
                company_id,
                cid,
                user_id,
            )
            inserted += 1
    return MarketingClientDocCountOut(count=inserted)


@router.post("/documents/{approval_id}/approve", response_model=MarketingClientApprovalActionOut)
async def approve_document(
    approval_id: UUID,
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingClientApprovalActionOut:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        if not _is_customer_rep(user_id, party):
            raise HTTPException(status_code=403, detail="Утверждает представитель заказчика")
        row = await conn.fetchrow(
            """
            UPDATE marketing_client_doc_approvals
            SET status = 'approved', approved_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND project_id = $2 AND status = 'pending'
            RETURNING id
            """,
            approval_id,
            project_id,
        )
    if row is None:
        raise HTTPException(status_code=409, detail="Документ не в статусе «на согласовании»")
    return MarketingClientApprovalActionOut(ok=True, id=str(approval_id))


@router.get("/documents/{approval_id}/file")
async def download_approval_document_for_review(
    approval_id: UUID,
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    service: ContentStorageService = Depends(get_content_service),  # noqa: B008
):
    """Файл материала на согласовании: представитель или руководитель (без обхода ACL контент-сервиса вручную)."""
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        if not (_is_customer_rep(user_id, party) or _is_marketing_lead(user_id, party)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Просмотр доступен представителю заказчика или руководителю",
            )
        row = await conn.fetchrow(
            """
            SELECT a.content_id, a.status
            FROM marketing_client_doc_approvals a
            INNER JOIN unified_content uc
              ON uc.id = a.content_id AND uc.deleted_at IS NULL
            WHERE a.id = $1 AND a.project_id = $2
              AND a.status IN ('pending', 'approved')
            """,
            approval_id,
            project_id,
        )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Документ не найден",
        )
    content_id: UUID = row["content_id"]
    try:
        content = await service.get_content(content_id, str(user_id), check_permissions=False)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        ) from e

    if content.storage_backend is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У материала не задан storage_backend",
        )
    backend = service.storage_factory.get_backend_by_name(content.storage_backend.value)
    try:
        file_data = await backend.retrieve(content.file_path or "", content_id)
    except ValueError as storage_error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Файл в хранилище не найден: {storage_error!s}",
        ) from storage_error
    except FileNotFoundError as storage_error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Файл в хранилище не найден: {storage_error!s}",
        ) from storage_error
    except SeaweedFileCorruptedError as storage_error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Файл в хранилище не найден: {storage_error!s}",
        ) from storage_error
    except Exception as storage_error:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка хранилища: {storage_error!s}",
        ) from storage_error

    if not file_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пустой файл",
        )

    await service.audit_logger.log(
        content_id=content_id,
        user_id=str(user_id),
        action="accessed_download",
        details={
            "via": "marketing_client_doc_approval",
            "approval_id": str(approval_id),
            "project_id": str(project_id),
        },
    )

    raw_name = content.original_filename or content.name or "document"
    try:
        encoded_name = quote(raw_name, safe="")
        content_disp = f"inline; filename*=UTF-8''{encoded_name}"
    except Exception:
        content_disp = 'inline; filename="document"'
    return StreamingResponse(
        io.BytesIO(file_data),
        media_type=content.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": content_disp,
            "Content-Length": str(len(file_data)),
        },
    )


@router.post(
    "/documents/{approval_id}/request-removal",
    response_model=MarketingClientRemovalIdOut,
)
async def request_document_removal(
    approval_id: UUID,
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingClientRemovalIdOut:
    await get_accessible_project(
        db_pool, project_id, user_id, for_mutation=True, required_mc_module="client_interaction"
    )
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        if not _is_marketing_lead(user_id, party):
            raise HTTPException(
                status_code=403,
                detail="Инициировать удаление может только руководитель",
            )
        exists = await conn.fetchval(
            """
            SELECT id FROM marketing_client_doc_approvals
            WHERE id = $1 AND project_id = $2
            """,
            approval_id,
            project_id,
        )
        if exists is None:
            raise HTTPException(status_code=404, detail="Запись не найдена")
        existing = await conn.fetchval(
            """
            SELECT id FROM marketing_client_doc_removal_requests
            WHERE approval_id = $1 AND status = 'pending'
            """,
            approval_id,
        )
        if existing is not None:
            raise HTTPException(status_code=409, detail="Запрос на удаление уже есть")
        rid = await conn.fetchval(
            """
            INSERT INTO marketing_client_doc_removal_requests (
                approval_id, initiated_by_user_id, status
            ) VALUES ($1, $2, 'pending')
            RETURNING id
            """,
            approval_id,
            user_id,
        )
    return MarketingClientRemovalIdOut(removal_id=str(rid))


@router.post("/removal-requests/{removal_id}/confirm", response_model=MarketingOkOut)
async def confirm_removal(
    removal_id: UUID,
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingOkOut:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        if not _is_customer_rep(user_id, party):
            raise HTTPException(status_code=403, detail="Подтверждает представитель заказчика")
        row = await conn.fetchrow(
            """
            UPDATE marketing_client_doc_removal_requests r
            SET status = 'confirmed', confirmed_at = NOW()
            FROM marketing_client_doc_approvals a
            WHERE r.id = $1 AND r.approval_id = a.id AND a.project_id = $2
              AND r.status = 'pending'
            RETURNING r.approval_id
            """,
            removal_id,
            project_id,
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Запрос не найден")
        aid = row["approval_id"]
        await conn.execute(
            "DELETE FROM marketing_client_doc_approvals WHERE id = $1",
            aid,
        )
    return MarketingOkOut(ok=True)


@router.post("/removal-requests/{removal_id}/cancel", response_model=MarketingOkOut)
async def cancel_removal(
    removal_id: UUID,
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingOkOut:
    await get_accessible_project(
        db_pool, project_id, user_id, for_mutation=True, required_mc_module="client_interaction"
    )
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        if not _is_marketing_lead(user_id, party):
            raise HTTPException(status_code=403, detail="Отменить может руководитель")
        cancelled = await conn.fetchval(
            """
            UPDATE marketing_client_doc_removal_requests r
            SET status = 'cancelled'
            FROM marketing_client_doc_approvals a
            WHERE r.id = $1 AND r.approval_id = a.id AND a.project_id = $2
              AND r.status = 'pending' AND r.initiated_by_user_id = $3
            RETURNING r.id
            """,
            removal_id,
            project_id,
            user_id,
        )
        if cancelled is None:
            raise HTTPException(status_code=404, detail="Запрос не найден")
    return MarketingOkOut(ok=True)


@router.get("/ewrp-jobs", response_model=list[ClientEwrpJobListItemOut])
async def list_ewrp_jobs_for_project(
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> list[ClientEwrpJobListItemOut]:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        if not _is_marketing_lead(user_id, party):
            return []
        owners = _ewrp_owner_ids(party)
        if not owners:
            return []
        rows = await conn.fetch(
            """
            SELECT id, title, status, html_path, pdf_path, created_at, completed_at
            FROM ewrp_jobs
            WHERE user_id = ANY($1::uuid[]) AND status = 'completed'
            ORDER BY completed_at DESC NULLS LAST
            LIMIT 80
            """,
            owners,
        )
    return [
        ClientEwrpJobListItemOut(
            id=str(r["id"]),
            title=r["title"],
            status=str(r["status"]),
            has_html=_ewrp_job_has_servable_html(r["id"], r["html_path"]),
            has_pdf=bool(r["pdf_path"] and str(r["pdf_path"]).strip()),
        )
        for r in rows
    ]


@router.post("/presentations/share", response_model=MarketingClientShareIdOut)
async def share_presentation(
    project_id: UUID = Query(...),
    body: SharePresentationBody = ...,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingClientShareIdOut:
    await get_accessible_project(
        db_pool, project_id, user_id, for_mutation=True, required_mc_module="client_interaction"
    )
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        if not _is_marketing_lead(user_id, party):
            raise HTTPException(status_code=403, detail="Только руководитель публикует презентацию")
        if party["representative_user_id"] is None:
            raise HTTPException(status_code=400, detail="Нет представителя заказчика")
        owners = _ewrp_owner_ids(party)
        job = await conn.fetchrow(
            """
            SELECT id, user_id, status, html_path FROM ewrp_jobs
            WHERE id = $1 AND user_id = ANY($2::uuid[])
            """,
            body.ewrp_job_id,
            owners,
        )
        if job is None or job["status"] != "completed":
            raise HTTPException(status_code=404, detail="Презентация не найдена или не готова")
        if not _ewrp_job_has_servable_html(job["id"], job["html_path"]):
            raise HTTPException(status_code=400, detail="Нет HTML-версии презентации")
        company_id = party["company_id"]
        sid = await conn.fetchval(
            """
            INSERT INTO marketing_client_pres_shares (
                project_id, company_id, ewrp_job_id, shared_by_user_id
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (project_id, ewrp_job_id) DO UPDATE SET
                shared_by_user_id = EXCLUDED.shared_by_user_id,
                created_at = NOW()
            RETURNING id
            """,
            project_id,
            company_id,
            body.ewrp_job_id,
            user_id,
        )
    return MarketingClientShareIdOut(share_id=str(sid))


@router.get("/presentations", response_model=list[ClientPresShareOut])
async def list_presentation_shares(
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> list[ClientPresShareOut]:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT s.id, s.ewrp_job_id, s.created_at, j.title, j.status
            FROM marketing_client_pres_shares s
            INNER JOIN ewrp_jobs j ON j.id = s.ewrp_job_id
            WHERE s.project_id = $1
            ORDER BY s.created_at DESC
            """,
            project_id,
        )
    return [
        ClientPresShareOut(
            share_id=str(r["id"]),
            ewrp_job_id=str(r["ewrp_job_id"]),
            title=r["title"],
            created_at=r["created_at"],
        )
        for r in rows
    ]


@router.delete("/presentations/{share_id}", response_model=MarketingOkOut)
async def revoke_presentation_share(
    share_id: UUID,
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingOkOut:
    """Снять публикацию презентации для заказчика (только руководитель)."""
    await get_accessible_project(
        db_pool, project_id, user_id, for_mutation=True, required_mc_module="client_interaction"
    )
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        if not _is_marketing_lead(user_id, party):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только руководитель отзывает публикацию для заказчика",
            )
        row = await conn.fetchrow(
            """
            DELETE FROM marketing_client_pres_shares
            WHERE id = $1 AND project_id = $2
            RETURNING id
            """,
            share_id,
            project_id,
        )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Публикация не найдена",
        )
    return MarketingOkOut(ok=True)


@router.get("/presentations/{share_id}/html")
async def get_shared_presentation_html(
    share_id: UUID,
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
):
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT s.id AS share_id, s.project_id, j.html_path, j.pdf_path, j.id AS job_id
            FROM marketing_client_pres_shares s
            INNER JOIN ewrp_jobs j ON j.id = s.ewrp_job_id
            WHERE s.id = $1 AND s.project_id = $2
            """,
            share_id,
            project_id,
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Публикация не найдена")
        path = row["html_path"]
        job_id = row["job_id"]
    if not path or not os.path.isfile(path):
        base = os.environ.get("GENERATED_FILES_BASE", "").strip()
        if base:
            alt = Path(base) / "generated_files" / "ewrp" / str(job_id) / "index.html"
            if alt.is_file():
                path = str(alt)
        if not path or not os.path.isfile(path):
            raise HTTPException(status_code=404, detail="HTML не найден на сервере")
    return FileResponse(path, media_type="text/html")


@router.get("/presentations/{share_id}/pdf")
async def get_shared_presentation_pdf(
    share_id: UUID,
    project_id: UUID = Query(...),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
):
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT s.id AS share_id, s.project_id, j.html_path, j.pdf_path, j.id AS job_id
            FROM marketing_client_pres_shares s
            INNER JOIN ewrp_jobs j ON j.id = s.ewrp_job_id
            WHERE s.id = $1 AND s.project_id = $2
            """,
            share_id,
            project_id,
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Публикация не найдена")
        path = row["pdf_path"]
        job_id = row["job_id"]
    if not path or not os.path.isfile(path):
        base = os.environ.get("GENERATED_FILES_BASE", "").strip()
        if base:
            alt = Path(base) / "generated_files" / "ewrp" / str(job_id) / "presentation.pdf"
            if alt.is_file():
                path = str(alt)
    if not path or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="PDF не найден")
    return FileResponse(path, media_type="application/pdf", filename=f"presentation_{job_id}.pdf")
