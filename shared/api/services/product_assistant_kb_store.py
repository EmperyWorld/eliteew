# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Upsert и индексация документов KB справочника по source_filename (скрипт sync + админка).
# Invariants:
# - Повторный upsert с тем же source_filename обновляет одну строку и переиндексирует Qdrant.
# Related:
# - api/services/product_assistant_rag_service.py
# - api/scripts/sync_handbook_kb_articles.py
# ---

from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.services.product_assistant_rag_service import (
    delete_product_assistant_chunks_for_document,
    index_product_assistant_document,
)

_MD_TITLE_RE = re.compile(r"^#\s+(.+)$")


def title_from_markdown_body(body: str, fallback: str) -> str:
    """Первая строка «# …» или fallback (имя файла без kb-)."""
    for line in (body or "").splitlines():
        m = _MD_TITLE_RE.match(line.strip())
        if m:
            return m.group(1).strip()[:500]
    fb = (fallback or "").strip()
    if fb.startswith("kb-"):
        fb = fb[3:].replace("-", " ")
    return fb[:500] or "Document"


async def run_assistant_kb_index_for_document(
    db: AsyncSession,
    *,
    doc_id: UUID,
    title: str,
    body: str,
) -> tuple[str, int, str | None]:
    """Индексировать документ и обновить status/chunk_count в Postgres."""
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
    return st, n_chunks, err


async def upsert_assistant_kb_markdown_document(
    db: AsyncSession,
    *,
    source_filename: str,
    title: str,
    body: str,
    mime: str = "text/markdown",
) -> tuple[UUID, str, int]:
    """Upsert по source_filename и переиндексация. Возвращает (doc_id, status, chunk_count)."""
    text_body = (body or "").strip()
    if len(text_body) < 20:
        raise ValueError("Body too short for indexing (minimum ~20 characters).")
    doc_title = (title or "").strip() or "Document"
    if len(doc_title) > 500:
        doc_title = doc_title[:500]
    sfn_key = (source_filename or "").strip()[:500]
    if not sfn_key:
        raise ValueError("source_filename is required")
    mime_s = (mime or "").strip() or "text/markdown"

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
                "smime": mime_s[:200],
            },
        )
        await db.commit()
        st, n_chunks, _ = await run_assistant_kb_index_for_document(db, doc_id=keep_id, title=doc_title, body=text_body)
        return keep_id, st, n_chunks

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
            "smime": mime_s[:200],
        },
    )
    await db.commit()
    doc_id = UUID(str(result.scalar_one()))
    st, n_chunks, _ = await run_assistant_kb_index_for_document(db, doc_id=doc_id, title=doc_title, body=text_body)
    return doc_id, st, n_chunks
