#!/usr/bin/env python3
"""
PostgreSQL Storage Backend
Stores small files (< 1MB) in PostgreSQL BYTEA column
"""

from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from .base import StorageBackend


class PostgreSQLStorage(StorageBackend):
    """PostgreSQL BYTEA storage for small files"""

    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool

    async def store(
        self,
        content_id: UUID,
        file_data: bytes,
        filename: str,
        mime_type: str | None = None,
        conn=None,  # Accept external connection for transaction support
    ) -> str:
        """
        Store file in PostgreSQL file_data column

        Returns empty string as storage_path (data is in file_data column)
        """
        if conn:
            # Use provided connection (for transactions)
            await conn.execute(
                """
                UPDATE unified_content
                SET file_data = $1,
                    storage_backend = 'postgresql',
                    file_path = NULL
                WHERE id = $2
                """,
                file_data,
                content_id,
            )
        else:
            # Use pool connection (standalone mode)
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE unified_content
                    SET file_data = $1,
                        storage_backend = 'postgresql',
                        file_path = NULL
                    WHERE id = $2
                    """,
                    file_data,
                    content_id,
                )
        return ""  # PostgreSQL storage uses file_data column, not file_path

    async def retrieve(
        self,
        storage_path: str,
        content_id: UUID,
        *,
        fail_fast: bool = False,
    ) -> bytes:
        """
        Retrieve file from PostgreSQL file_data column
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT file_data FROM unified_content WHERE id = $1", content_id)
            if not row or not row["file_data"]:
                msg = f"Content {content_id} not found in PostgreSQL"
                raise FileNotFoundError(msg)
            return bytes(row["file_data"])

    async def delete(self, storage_path: str, content_id: UUID) -> bool:
        """
        Delete file data from PostgreSQL (set to NULL)
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute("UPDATE unified_content SET file_data = NULL WHERE id = $1", content_id)
        return True

    async def exists(self, storage_path: str, content_id: UUID) -> bool:
        """
        Check if file data exists in PostgreSQL
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT file_data IS NOT NULL as exists FROM unified_content WHERE id = $1",
                content_id,
            )
            return row["exists"] if row else False

    def get_backend_name(self) -> str:
        return "postgresql"
