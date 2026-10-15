# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Product assistant KB (RAG documents): CRUD, upload, sync, reindex for Справочник admin.
# Invariants:
# - Static /kb/* paths (summary, upload-limits) registered before /kb/{doc_id:uuid}.
# Related:
# - api/routers/product_desktop.py (parent router include)
# - documentation/product/PRODUCT-ASSISTANT-KB-INDEXING.md
# ---
"""Assistant knowledge-base routes for product desktop API."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Literal, Self
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_database_manager, get_postgres_session
from api.core.unified_config import unified_settings
from api.routers.desktop_admin import require_admin_user
from api.services.business_intelligence.tika_service import TikaService
from api.services.product_assistant_rag_service import (
    delete_product_assistant_chunks_for_document,
    delete_product_assistant_collection_if_exists,
    index_product_assistant_document,
)

logger = logging.getLogger(__name__)

_ASSISTANT_KB_UPLOAD_MAX_BYTES = int(os.environ.get("ASSISTANT_KB_UPLOAD_MAX_BYTES", str(20 * 1024 * 1024)))
_ASSISTANT_KB_ALLOWED_EXTENSIONS: frozenset[str] = frozenset(
    TikaService(unified_settings.tika_url or "http://stack4-tika:9998").SUPPORTED_EXTENSIONS
) | frozenset({".md", ".markdown"})
_raw_kb_bulk_files = int(os.environ.get("ASSISTANT_KB_BULK_MAX_FILES", "256"))
_ASSISTANT_KB_BULK_MAX_FILES: int = max(1, min(_raw_kb_bulk_files, 500))

kb_router = APIRouter(tags=["product-desktop"])


class AssistantKbDocumentOut(BaseModel):
    id: UUID
    title: str
    status: str
    chunk_count: int
    last_error: str | None
    created_at: datetime
    updated_at: datetime
    source_filename: str | None = None
    source_mime: str | None = None


class AssistantKbDocumentDetailOut(AssistantKbDocumentOut):
    body: str


class AssistantKbCreateBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=1)


class AssistantKbPatchBody(BaseModel):
    title: str | None = Field(None, max_length=500)
    body: str | None = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> Self:
        if self.title is None and self.body is None:
            raise ValueError("At least one of title, body is required")
        return self


class AssistantKbUploadFailureItem(BaseModel):
    filename: str
    detail: str


class AssistantKbBulkUploadOut(BaseModel):
    ok: list[AssistantKbDocumentOut]
    failed: list[AssistantKbUploadFailureItem]


class AssistantKbUploadLimitsOut(BaseModel):
    max_files: int
    max_bytes_per_file: int


class AssistantKbSummaryOut(BaseModel):
    total: int
    indexed: int
    indexing: int
    error: int
    total_chunks: int


class AssistantKbSyncHandbookOut(BaseModel):
    status: str
    message: str | None = None
    files: int | None = None
    ok: int | None = None
    fail: int | None = None
    dry_run: bool | None = None
    handbook_dir: str | None = None


class AssistantKbReindexAllOut(BaseModel):
    status: str
    message: str | None = None


class AssistantKbPurgeOut(BaseModel):
    status: str
    message: str
    removed_documents: str


class AssistantKbPurgeBody(BaseModel):
    confirm: Literal["purge"]


_KB_SELECT_FIELDS = "id, title, status, chunk_count, last_error, created_at, updated_at, source_filename, source_mime"


async def _kb_fetch_by_id(db: AsyncSession, doc_id: UUID) -> AssistantKbDocumentOut:
    r = await db.execute(
        text(f"SELECT {_KB_SELECT_FIELDS} FROM assistant_kb_documents WHERE id = :id"),
        {"id": str(doc_id)},
    )
    return AssistantKbDocumentOut.model_validate(dict(r.mappings().one()))


async def _kb_run_index_and_update_status(
    db: AsyncSession,
    *,
    doc_id: UUID,
    title: str,
    body: str,
) -> AssistantKbDocumentOut:
    ok, n_chunks, err = await index_product_assistant_document(
        document_id=doc_id,
        title=title,
        body=body,
    )
    st = "indexed" if ok else "error"
    await db.execute(
        text(
            """
            UPDATE assistant_kb_documents
            SET status = :st, chunk_count = :cc, last_error = :err, updated_at = NOW()
            WHERE id = :id
            """
        ),
        {"id": str(doc_id), "st": st, "cc": n_chunks, "err": err},
    )
    await db.commit()
    return await _kb_fetch_by_id(db, doc_id)


def _http_exc_detail(exc: HTTPException) -> str:
    d = exc.detail
    if isinstance(d, str):
        return d
    try:
        return json.dumps(d, ensure_ascii=False)
    except Exception:
        return str(d)


async def _kb_upload_kb_from_bytes(
    db: AsyncSession,
    *,
    raw: bytes,
    filename: str,
    title_override: str | None,
    mime: str | None,
) -> AssistantKbDocumentOut:
    if len(raw) > _ASSISTANT_KB_UPLOAD_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large",
        )
    fn = filename.strip() or "upload.bin"
    ext = Path(fn).suffix.lower()
    if ext not in _ASSISTANT_KB_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type",
        )
    tika_url = (unified_settings.tika_url or "http://stack4-tika:9998").rstrip("/")
    tika = TikaService(tika_url)
    extracted = await tika.extract_text_from_bytes(raw, filename=fn)
    if not extracted.get("success"):
        err = extracted.get("error") or "Text extraction failed"
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=err)
    text_body = str(extracted.get("text") or "").strip()
    if len(text_body) < 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Extracted text is too short for indexing (minimum ~20 characters).",
        )
    doc_title = (title_override or "").strip() or Path(fn).stem or "Document"
    if len(doc_title) > 500:
        doc_title = doc_title[:500]
    mime_s = (mime or "").strip() or None
    sfn_key = fn[:500]

    # Повторная загрузка того же имени файла: обновляем существующий документ (created_at не трогаем),
    # дубликаты строк с тем же source_filename удаляем вместе с их чанками в Qdrant.
    dup_rows = await db.execute(
        text(
            """
            SELECT id FROM assistant_kb_documents
            WHERE source_filename = :sfn
            ORDER BY created_at ASC
            """
        ),
        {"sfn": sfn_key},
    )
    dup_ids = [UUID(str(r["id"])) for r in dup_rows.mappings().all()]
    if dup_ids:
        keep_id = dup_ids[0]
        for drop_id in dup_ids[1:]:
            await delete_product_assistant_chunks_for_document(drop_id)
            await db.execute(
                text("DELETE FROM assistant_kb_documents WHERE id = :id"),
                {"id": str(drop_id)},
            )
        await db.execute(
            text(
                """
                UPDATE assistant_kb_documents
                SET title = :title,
                    body = :body,
                    status = 'indexing',
                    last_error = NULL,
                    source_mime = :smime,
                    updated_at = NOW()
                WHERE id = :id
                """
            ),
            {
                "id": str(keep_id),
                "title": doc_title,
                "body": text_body,
                "smime": mime_s[:200] if mime_s else None,
            },
        )
        await db.commit()
        return await _kb_run_index_and_update_status(db, doc_id=keep_id, title=doc_title, body=text_body)

    result = await db.execute(
        text(
            """
            INSERT INTO assistant_kb_documents (
                title, body, status, source_filename, source_mime, created_at, updated_at
            )
            VALUES (:title, :body, 'indexing', :sfn, :smime, NOW(), NOW())
            RETURNING id
            """
        ),
        {
            "title": doc_title,
            "body": text_body,
            "sfn": sfn_key,
            "smime": mime_s[:200] if mime_s else None,
        },
    )
    await db.commit()
    doc_id = UUID(str(result.scalar_one()))
    return await _kb_run_index_and_update_status(db, doc_id=doc_id, title=doc_title, body=text_body)


@kb_router.get("/admin/assistant/kb/summary", response_model=AssistantKbSummaryOut)
async def admin_kb_summary(
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantKbSummaryOut:
    """Сводка по статусам документов KB для панели админки."""
    result = await db.execute(
        text(
            """
            SELECT
              count(*)::int AS total,
              count(*) FILTER (WHERE status = 'indexed')::int AS indexed,
              count(*) FILTER (WHERE status = 'indexing')::int AS indexing,
              count(*) FILTER (WHERE status = 'error')::int AS error,
              coalesce(sum(chunk_count), 0)::int AS total_chunks
            FROM assistant_kb_documents
            """
        )
    )
    row = dict(result.mappings().one())
    return AssistantKbSummaryOut.model_validate(row)


async def _assistant_kb_sync_handbook_background(*, limit: int | None) -> None:
    from api.services.product_assistant_kb_sync import sync_handbook_kb_articles

    try:
        await sync_handbook_kb_articles(dry_run=False, limit=limit)
    except Exception:
        logger.exception("[STEP] assistant_kb sync-handbook background failed")


@kb_router.post("/admin/assistant/kb/sync-handbook", response_model=AssistantKbSyncHandbookOut)
async def admin_sync_handbook_kb(
    background_tasks: BackgroundTasks,
    response: Response,
    dry_run: bool = Query(False),
    limit: int | None = Query(None, ge=1, le=500),
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantKbSyncHandbookOut:
    """Синхронизация kb-*.md из documentation/product/handbook-kb-articles."""
    from api.services.product_assistant_kb_sync import sync_handbook_kb_articles

    if dry_run:
        try:
            result = await sync_handbook_kb_articles(dry_run=True, limit=limit)
        except FileNotFoundError as e:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
        return AssistantKbSyncHandbookOut(
            status="dry_run",
            message="Dry run complete; no documents written.",
            files=result.files,
            ok=result.ok,
            fail=result.fail,
            dry_run=True,
            handbook_dir=result.handbook_dir,
        )
    background_tasks.add_task(_assistant_kb_sync_handbook_background, limit=limit)
    response.status_code = status.HTTP_202_ACCEPTED
    return AssistantKbSyncHandbookOut(
        status="started",
        message="Handbook KB sync started in background.",
    )


@kb_router.get("/admin/assistant/kb", response_model=list[AssistantKbDocumentOut])
async def admin_list_kb_documents(
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> list[AssistantKbDocumentOut]:
    result = await db.execute(
        text(
            f"""
            SELECT {_KB_SELECT_FIELDS}
            FROM assistant_kb_documents
            ORDER BY created_at DESC
            LIMIT 2000
            """
        )
    )
    return [AssistantKbDocumentOut.model_validate(dict(r)) for r in result.mappings().all()]


@kb_router.get("/admin/assistant/kb/upload-limits", response_model=AssistantKbUploadLimitsOut)
async def admin_kb_upload_limits(
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantKbUploadLimitsOut:
    return AssistantKbUploadLimitsOut(
        max_files=_ASSISTANT_KB_BULK_MAX_FILES,
        max_bytes_per_file=_ASSISTANT_KB_UPLOAD_MAX_BYTES,
    )


@kb_router.get("/admin/assistant/kb/{doc_id:uuid}", response_model=AssistantKbDocumentDetailOut)
async def admin_get_kb_document(
    doc_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantKbDocumentDetailOut:
    r = await db.execute(
        text(
            f"""
            SELECT {_KB_SELECT_FIELDS}, body
            FROM assistant_kb_documents WHERE id = :id
            """
        ),
        {"id": str(doc_id)},
    )
    row = r.mappings().first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return AssistantKbDocumentDetailOut.model_validate(dict(row))


@kb_router.post("/admin/assistant/kb", response_model=AssistantKbDocumentOut)
async def admin_create_kb_document(
    body: AssistantKbCreateBody,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantKbDocumentOut:
    result = await db.execute(
        text(
            """
            INSERT INTO assistant_kb_documents (
                title, body, status, source_filename, source_mime, created_at, updated_at
            )
            VALUES (:title, :body, 'indexing', NULL, NULL, NOW(), NOW())
            RETURNING id
            """
        ),
        {"title": body.title.strip(), "body": body.body},
    )
    await db.commit()
    doc_id = UUID(str(result.scalar_one()))
    return await _kb_run_index_and_update_status(db, doc_id=doc_id, title=body.title.strip(), body=body.body)


@kb_router.post("/admin/assistant/kb/upload", response_model=AssistantKbDocumentOut)
async def admin_upload_kb_document(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantKbDocumentOut:
    raw = await file.read()
    filename = (file.filename or "upload.bin").strip() or "upload.bin"
    mime = (file.content_type or "").strip() or None
    return await _kb_upload_kb_from_bytes(
        db,
        raw=raw,
        filename=filename,
        title_override=title,
        mime=mime,
    )


@kb_router.post("/admin/assistant/kb/uploads", response_model=AssistantKbBulkUploadOut)
async def admin_upload_kb_documents_bulk(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantKbBulkUploadOut:
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files",
        )
    if len(files) > _ASSISTANT_KB_BULK_MAX_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many files (max {_ASSISTANT_KB_BULK_MAX_FILES})",
        )
    ok: list[AssistantKbDocumentOut] = []
    failed: list[AssistantKbUploadFailureItem] = []
    for file in files:
        name_for_err = (file.filename or "?").strip() or "?"
        try:
            raw = await file.read()
            filename = (file.filename or "upload.bin").strip() or "upload.bin"
            mime = (file.content_type or "").strip() or None
            out = await _kb_upload_kb_from_bytes(
                db,
                raw=raw,
                filename=filename,
                title_override=None,
                mime=mime,
            )
            ok.append(out)
        except HTTPException as e:
            failed.append(
                AssistantKbUploadFailureItem(
                    filename=name_for_err[:500],
                    detail=_http_exc_detail(e),
                )
            )
        except Exception:
            logger.exception("assistant KB bulk upload failed for %s", name_for_err)
            failed.append(
                AssistantKbUploadFailureItem(
                    filename=name_for_err[:500],
                    detail="Internal error",
                )
            )
    return AssistantKbBulkUploadOut(ok=ok, failed=failed)


@kb_router.patch("/admin/assistant/kb/{doc_id:uuid}", response_model=AssistantKbDocumentOut)
async def admin_patch_kb_document(
    doc_id: UUID,
    body: AssistantKbPatchBody,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantKbDocumentOut:
    r0 = await db.execute(
        text("SELECT id, title, body FROM assistant_kb_documents WHERE id = :id"),
        {"id": str(doc_id)},
    )
    row0 = r0.mappings().first()
    if not row0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    cur_title = str(row0["title"])
    cur_body = str(row0["body"])
    if body.title is not None:
        nt = body.title.strip()
        if not nt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="title must not be empty",
            )
        cur_title = nt[:500]
    if body.body is not None:
        nb = body.body.strip()
        if not nb:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="body must not be empty",
            )
        cur_body = nb
    await db.execute(
        text(
            """
            UPDATE assistant_kb_documents
            SET title = :title, body = :body, status = 'indexing', last_error = NULL, updated_at = NOW()
            WHERE id = :id
            """
        ),
        {"id": str(doc_id), "title": cur_title, "body": cur_body},
    )
    await db.commit()
    return await _kb_run_index_and_update_status(db, doc_id=doc_id, title=cur_title, body=cur_body)


@kb_router.post("/admin/assistant/kb/{doc_id:uuid}/reindex", response_model=AssistantKbDocumentOut)
async def admin_reindex_kb_document(
    doc_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantKbDocumentOut:
    r0 = await db.execute(
        text("SELECT id, title, body FROM assistant_kb_documents WHERE id = :id"),
        {"id": str(doc_id)},
    )
    row0 = r0.mappings().first()
    if not row0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    title = str(row0["title"])
    body = str(row0["body"])
    await db.execute(
        text("UPDATE assistant_kb_documents SET status = 'indexing', updated_at = NOW() WHERE id = :id"),
        {"id": str(doc_id)},
    )
    await db.commit()
    return await _kb_run_index_and_update_status(db, doc_id=doc_id, title=title, body=body)


@kb_router.delete("/admin/assistant/kb/{doc_id:uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_kb_document(
    doc_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> None:
    await delete_product_assistant_chunks_for_document(doc_id)
    await db.execute(text("DELETE FROM assistant_kb_documents WHERE id = :id"), {"id": str(doc_id)})
    await db.commit()


@kb_router.post("/admin/assistant/kb/purge", response_model=AssistantKbPurgeOut)
async def admin_purge_kb_documents_and_rag(
    _body: AssistantKbPurgeBody,
    db: AsyncSession = Depends(get_postgres_session),
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantKbPurgeOut:
    """
    Удаляет все строки assistant_kb_documents и сбрасывает коллекцию Qdrant product_assistant_kb.
    """
    result = await db.execute(text("SELECT COUNT(*) AS n FROM assistant_kb_documents"))
    n_before = int(result.scalar_one())
    await db.execute(text("DELETE FROM assistant_kb_documents"))
    await db.commit()
    await delete_product_assistant_collection_if_exists()
    logger.warning(
        "[STEP] assistant_kb purge by admin: removed %s postgres rows; qdrant collection dropped if existed",
        n_before,
    )
    return AssistantKbPurgeOut(
        status="ok",
        message="Handbook KB documents removed and RAG collection cleared.",
        removed_documents=str(n_before),
    )


async def _assistant_kb_reindex_all_background() -> None:
    manager = await get_database_manager()
    async with manager.get_postgres_session() as session:
        result = await session.execute(
            text("SELECT id, title, body FROM assistant_kb_documents ORDER BY created_at ASC")
        )
        rows = list(result.mappings().all())
    total = len(rows)
    logger.info("[STEP] assistant_kb reindex-all started total=%s", total)
    ok_n = 0
    fail_n = 0
    for i, row in enumerate(rows):
        doc_id = UUID(str(row["id"]))
        title = str(row["title"])
        body = str(row["body"])
        try:
            async with manager.get_postgres_session() as db:
                await db.execute(
                    text(
                        """
                        UPDATE assistant_kb_documents
                        SET status = 'indexing', last_error = NULL, updated_at = NOW()
                        WHERE id = :id
                        """
                    ),
                    {"id": str(doc_id)},
                )
                await db.commit()
            async with manager.get_postgres_session() as db:
                await _kb_run_index_and_update_status(db, doc_id=doc_id, title=title, body=body)
            ok_n += 1
        except Exception:
            logger.exception("[STEP] assistant_kb reindex-all failed doc_id=%s", doc_id)
            fail_n += 1
        if total and (i + 1) % 25 == 0:
            logger.info("[STEP] assistant_kb reindex-all progress %s/%s", i + 1, total)
    logger.info(
        "[STEP] assistant_kb reindex-all finished ok=%s failed=%s total=%s",
        ok_n,
        fail_n,
        total,
    )


@kb_router.post("/admin/assistant/kb/reindex-all", response_model=AssistantKbReindexAllOut)
async def admin_reindex_all_kb_documents(
    background_tasks: BackgroundTasks,
    response: Response,
    _admin: AuthUser = Depends(require_admin_user),
) -> AssistantKbReindexAllOut:
    background_tasks.add_task(_assistant_kb_reindex_all_background)
    response.status_code = status.HTTP_202_ACCEPTED
    return AssistantKbReindexAllOut(
        status="started",
        message="Handbook KB reindex started in background. Check API logs for progress.",
    )
