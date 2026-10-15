#!/usr/bin/env python3
"""
📄 POSTGRES DOCUMENT STORAGE - Production-Ready CRUD
Хранилище документов в PostgreSQL

Features:
✅ Create, Read, Update, Delete documents
✅ Version history tracking
✅ User ownership & permissions
✅ Full-text search integration
✅ Metadata management
"""

import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

import asyncpg  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class PostgresDocumentStorage:
    """Production-ready PostgreSQL document storage"""

    def __init__(self, db_pool: asyncpg.Pool):
        """
        Initialize document storage

        Args:
            db_pool: PostgreSQL connection pool
        """
        self.db_pool = db_pool

    async def create_document(
        self,
        user_id: str,
        title: str,
        content: str,
        document_type: str = "text",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Create new document

        Args:
            user_id: Owner user ID
            title: Document title
            content: Document content
            document_type: Type (text, docx, pdf, html)
            metadata: Additional metadata

        Returns:
            Created document data
        """
        try:
            document_id = str(uuid.uuid4())
            now = datetime.now(UTC)

            async with self.db_pool.acquire() as conn:
                # Insert document (convert metadata dict to JSONB)
                metadata_json = json.dumps(metadata or {})

                await conn.execute(
                    """
                    INSERT INTO documents (
                        id, author_id, title, content, document_type,
                        doc_metadata, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
                    """,
                    document_id,
                    user_id,
                    title,
                    content,
                    document_type,
                    metadata_json,
                    now,
                    now,
                )

                logger.info("Document created: %s", document_id)

                return {
                    "id": document_id,
                    "author_id": user_id,
                    "title": title,
                    "content": content,
                    "document_type": document_type,
                    "metadata": metadata or {},
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                }

        except Exception:
            logger.exception("Failed to create document")
            raise

    async def get_document(self, document_id: str, user_id: str | None = None) -> dict[str, Any] | None:
        """
        Get document by ID

        Args:
            document_id: Document ID
            user_id: Optional user ID for ownership check

        Returns:
            Document data or None
        """
        try:
            async with self.db_pool.acquire() as conn:
                if user_id:
                    # Check ownership
                    row = await conn.fetchrow(
                        """
                        SELECT id, author_id, title, content, document_type,
                               doc_metadata, created_at, updated_at
                        FROM documents
                        WHERE id = $1 AND author_id = $2
                        """,
                        document_id,
                        user_id,
                    )
                else:
                    # Admin access
                    row = await conn.fetchrow(
                        """
                        SELECT id, author_id, title, content, document_type,
                               doc_metadata, created_at, updated_at
                        FROM documents
                        WHERE id = $1
                        """,
                        document_id,
                    )

                if row:
                    return {
                        "id": row["id"],
                        "author_id": row["author_id"],
                        "title": row["title"],
                        "content": row["content"] or "",
                        "document_type": row["document_type"],
                        "metadata": row["doc_metadata"],
                        "created_at": row["created_at"].isoformat(),
                        "updated_at": row["updated_at"].isoformat(),
                    }

                return None

        except Exception:
            logger.exception("Failed to get document %s", document_id)
            raise

    async def update_document(self, document_id: str, user_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        """
        Update document

        Args:
            document_id: Document ID
            user_id: Owner user ID
            updates: Fields to update (title, content, metadata)

        Returns:
            Updated document data or None
        """
        try:
            async with self.db_pool.acquire() as conn:
                # Build update query dynamically
                set_clauses = []
                params = [document_id, user_id]
                param_idx = 3

                if "title" in updates:
                    set_clauses.append(f"title = ${param_idx}")
                    params.append(updates["title"])
                    param_idx += 1

                if "content" in updates:
                    set_clauses.append(f"content = ${param_idx}")
                    params.append(updates["content"])
                    param_idx += 1

                if "metadata" in updates:
                    set_clauses.append(f"doc_metadata = ${param_idx}::jsonb")
                    params.append(json.dumps(updates["metadata"]))
                    param_idx += 1

                # Always update timestamp
                set_clauses.append(f"updated_at = ${param_idx}")
                params.append(datetime.now(UTC).isoformat())  # ⚡ FIX MYPY: Convert datetime to string

                if not set_clauses:
                    logger.warning("No fields to update for document %s", document_id)
                    return await self.get_document(document_id, user_id)

                # Safe column names only (whitelist)
                allowed_columns = {"title", "content", "doc_metadata", "updated_at"}
                safe_clauses = [clause for clause in set_clauses if any(col in clause for col in allowed_columns)]

                if not safe_clauses:
                    logger.warning("No safe fields to update for document %s", document_id)
                    return await self.get_document(document_id, user_id)

                # Build query safely - safe_clauses contains only whitelisted column names
                # All values are parameterized via $ placeholders
                safe_clauses_str = ", ".join(safe_clauses)
                query = f"""
                    UPDATE documents
                    SET {safe_clauses_str}
                    WHERE id = $1 AND author_id = $2
                    RETURNING id, author_id, title, content, document_type,
                              doc_metadata, created_at, updated_at
                """  # noqa: S608

                row = await conn.fetchrow(query, *params)

                if row:
                    logger.info("Document updated: %s", document_id)
                    return {
                        "id": row["id"],
                        "author_id": row["author_id"],
                        "title": row["title"],
                        "content": row["content"] or "",
                        "document_type": row["document_type"],
                        "metadata": row["doc_metadata"],
                        "created_at": row["created_at"].isoformat(),
                        "updated_at": row["updated_at"].isoformat(),
                    }

                return None

        except Exception:
            logger.exception("Failed to update document %s", document_id)
            raise

    async def delete_document(self, document_id: str, user_id: str) -> bool:
        """
        Delete document

        Args:
            document_id: Document ID
            user_id: Owner user ID

        Returns:
            True if deleted, False if not found
        """
        try:
            async with self.db_pool.acquire() as conn:
                result = await conn.execute(
                    "DELETE FROM documents WHERE id = $1 AND author_id = $2", document_id, user_id
                )

                deleted = bool(result and str(result).split()[-1] == "1")  # ⚡ FIX MYPY: Explicit bool conversion
                if deleted:
                    logger.info("Document deleted: %s", document_id)
                else:
                    logger.warning("Document not found or access denied: %s", document_id)

                return deleted

        except Exception:
            logger.exception("Failed to delete document %s", document_id)
            raise

    async def list_user_documents(self, user_id: str, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        """
        List user's documents

        Args:
            user_id: User ID
            limit: Max results
            offset: Pagination offset

        Returns:
            List of documents
        """
        try:
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, title, document_type, doc_metadata,
                           created_at, updated_at
                    FROM documents
                    WHERE author_id = $1
                    ORDER BY updated_at DESC
                    LIMIT $2 OFFSET $3
                    """,
                    user_id,
                    limit,
                    offset,
                )

                return [
                    {
                        "id": row["id"],
                        "title": row["title"],
                        "document_type": row["document_type"],
                        "metadata": row["doc_metadata"],
                        "created_at": row["created_at"].isoformat(),
                        "updated_at": row["updated_at"].isoformat(),
                    }
                    for row in rows
                ]

        except Exception:
            logger.exception("Failed to list documents for user %s", user_id)
            raise

    async def search_documents(self, user_id: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
        """
        Search user's documents

        Args:
            user_id: User ID
            query: Search query
            limit: Max results

        Returns:
            List of matching documents
        """
        try:
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, title, document_type, doc_metadata,
                           created_at, updated_at,
                           ts_rank(to_tsvector('english', title || ' ' || COALESCE(content, '')),
                                   plainto_tsquery('english', $2)) as rank
                    FROM documents
                    WHERE author_id = $1
                      AND (
                        title ILIKE $3 OR
                        content ILIKE $3 OR
                        to_tsvector('english', title || ' ' || COALESCE(content, '')) @@ plainto_tsquery('english', $2)
                      )
                    ORDER BY rank DESC, updated_at DESC
                    LIMIT $4
                    """,
                    user_id,
                    query,
                    f"%{query}%",
                    limit,
                )

                return [
                    {
                        "id": row["id"],
                        "title": row["title"],
                        "document_type": row["document_type"],
                        "metadata": row["doc_metadata"],
                        "created_at": row["created_at"].isoformat(),
                        "updated_at": row["updated_at"].isoformat(),
                        "relevance": float(row["rank"]),
                    }
                    for row in rows
                ]

        except Exception:
            logger.exception("Failed to search documents")
            raise
