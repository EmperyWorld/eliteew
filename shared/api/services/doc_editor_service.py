#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Business logic for DocEditor documents stored in unified_content, including CRUD, imports, versions, drafts, and AI transforms.
# It exposes stable HTML/Markdown/plain-text document projections for EWA and the web editor.
# Invariants:
# - unified_content.extracted_text remains plain text used for search and counts.
# - The legacy response field content remains rendered HTML; explicit content_markdown/content_html carry the structured contract.
# Related:
# - api/services/doc_editor_text_normalizer.py
# - api/routers/doc_editor.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-PIPELINE-2026-05.md
# ---
"""
🔥💎 ULTIMATE DOCUMENT EDITOR SERVICE 💎🔥

Business logic layer for document editor using asyncpg and unified_content table.

Architecture:
- Service Layer: Business logic (this file)
- Infrastructure: External services (Llama, Tika, ComfyUI, etc.)
- Database: asyncpg direct queries (NO SQLAlchemy ORM)

REFACTORED: 2025-10-19
- Migrated from SQLAlchemy ORM to asyncpg
- Using unified_content table (NOT ultimate_documents)
- Using content_versions table (NOT ultimate_document_versions)
- Automatic versioning via DB trigger (trigger_unified_content_versioning)
- Document content stored in extracted_text field (TEXT column)

Author: React UI God (Claude) + Empery World Development Team
"""

import asyncio
import base64
import hashlib
import json
import logging
import mimetypes
import os
import random
import re
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-not-found]
import httpx  # type: ignore[import-not-found]

from api.core.http_clients import get_httpx_client
from api.services.stack4 import Stack4ServiceUnavailable, get_stack4_document_gateway

try:
    from docx import Document  # type: ignore[import-not-found]
except ImportError:
    Document = None  # type: ignore[assignment, misc]

from api.core.unified_config import unified_settings
from api.services.doc_editor_text_normalizer import (
    default_rendered_html,
    html_to_markdown,
    html_to_plain_text,
    normalize_text_document,
)
from api.services.redis_service import RedisService
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.utils.json_safe import json_safe_api_detail
from api.utils.llama_keep_alive import llama_keep_alive_from_settings
from api.utils.llama_models import DEFAULT_MODEL
from api.utils.llm_openai_compat_http import httpx_compat_generate_json, httpx_compat_generate_text_stream

logger = logging.getLogger(__name__)

# Constants
HTTP_BAD_REQUEST = 400
HTTP_NOT_FOUND = 404


class DocumentVersionConflictError(Exception):
    def __init__(
        self,
        *,
        expected_version: int,
        current_version: int,
        server_document: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(f"Document version conflict: expected={expected_version}, current={current_version}")
        self.expected_version = expected_version
        self.current_version = current_version
        self.server_document = server_document


class CollaborationSaveForbiddenError(Exception):
    """Соавтор пытается записать канонический документ или серверный черновик без allow_collaborators_save."""

    def __init__(self, message: str = "Сохранение документа доступно только владельцу") -> None:
        super().__init__(message)


def _service_url(env_key: str, default: str) -> str:
    return (os.environ.get(env_key) or default).strip().rstrip("/")


def _resolve_llama_url() -> str:
    """
    Resolve Llama URL with graceful fallback:
    1) LLAMA_BASE_URL env (highest priority)
    2) unified_settings.llama_url (global config)
    """
    env_url = (os.environ.get("LLAMA_BASE_URL") or "").strip().rstrip("/")
    if env_url:
        return env_url

    cfg_url = getattr(unified_settings, "llama_url", None) or ""
    return cfg_url.strip().rstrip("/")


# Service URLs
# Llama: сначала берём LLAMA_BASE_URL из окружения, иначе — глобальный конфиг unified_settings.llama_url
LLAMA_URL = _resolve_llama_url()
COMFYUI_URL = _service_url("COMFYUI_URL", "")
TIKA_URL = _service_url("TIKA_URL", "")
GOTENBERG_URL = _service_url("GOTENBERG_URL", "")

# Per-request overrides on shared httpx client (default in http_clients is 60s total).
_HTTP_TIMEOUT_COMFYUI = 30.0
_HTTP_TIMEOUT_LLAMA_STREAM = 120.0
_HTTP_TIMEOUT_TIKA_OCR = 120.0

# Импорт через Tika для этих типов даёт «плоский» HTML (мало блоков). Читаем байты сами.
_DOC_EDITOR_NATIVE_TEXT_SUFFIXES = frozenset(
    {
        ".txt",
        ".md",
        ".markdown",
        ".log",
        ".csv",
        ".json",
        ".xml",
        ".html",
        ".htm",
        ".css",
        ".js",
        ".ts",
        ".mjs",
        ".cjs",
        ".py",
        ".sh",
        ".yaml",
        ".yml",
        ".ini",
        ".conf",
        ".cfg",
        ".rst",
    }
)
_DOC_EDITOR_MARKDOWN_SUFFIXES = frozenset({".md", ".markdown"})
_OCR_IMAGE_SUFFIXES = frozenset({".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".tif", ".tiff"})


def _decode_utf8_plain_file(file_content: bytes) -> str:
    if file_content.startswith(b"\xef\xbb\xbf"):
        file_content = file_content[3:]
    return file_content.decode("utf-8", errors="replace")


class DocEditorService:
    """Service layer for Ultimate Document Editor with asyncpg"""

    _BREAK_TAG_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)
    _PARAGRAPH_CLOSE_RE = re.compile(r"</p\s*>", re.IGNORECASE)
    _TAG_RE = re.compile(r"<[^>]+>")

    def __init__(
        self,
        db_pool: asyncpg.Pool,
        ugs_service: UnifiedGenerationService | None = None,
        redis_service: RedisService | None = None,
    ):
        self.db_pool = db_pool
        self.ugs_service = ugs_service
        self.redis_service = redis_service
        # In-memory cache for ComfyUI job metadata (job_id -> prompt)
        self._comfyui_jobs: dict[str, str] = {}
        # Cache TTL for documents (5 minutes)
        self._cache_ttl = 300

    # ----------------------------------------
    # Helpers
    # ----------------------------------------

    @classmethod
    def _html_to_markdown(cls, html: str) -> str:
        """Convert editor HTML (TipTap/ProseMirror) to Markdown with real line breaks."""
        return html_to_markdown(html)

    @classmethod
    def _html_to_plain_text(cls, html: str) -> str:
        return html_to_plain_text(html)

    @staticmethod
    def _default_rendered_html(plain_text: str) -> str:
        return default_rendered_html(plain_text)

    @staticmethod
    def _metadata_content_format(metadata: dict[str, Any], fallback_mime_type: str = "") -> str:
        raw = (
            metadata.get("source_format")
            or metadata.get("content_type")
            or metadata.get("format")
            or fallback_mime_type
        )
        return str(raw or "").strip().lower()

    @classmethod
    def _enrich_text_projection(
        cls,
        document: dict[str, Any],
        *,
        raw_content: str | None = None,
        filename: str | None = None,
        mime_type: str | None = None,
    ) -> None:
        raw_metadata = document.get("metadata")
        metadata: dict[str, Any] = raw_metadata if isinstance(raw_metadata, dict) else {}
        if metadata is not raw_metadata:
            document["metadata"] = metadata

        rendered_html = str(metadata.get("rendered_html") or document.get("content") or "")
        content_markdown = str(metadata.get("content_markdown") or "")
        plain_text = str(document.get("plain_text") or raw_content or "")
        source_format = cls._metadata_content_format(metadata, str(mime_type or document.get("mime_type") or ""))

        if content_markdown and rendered_html:
            normalized = normalize_text_document(
                content_markdown,
                filename=filename or str(document.get("title") or ""),
                mime_type=str(mime_type or document.get("mime_type") or ""),
                preferred_format=source_format or "markdown",
            )
        else:
            seed = rendered_html or raw_content or plain_text
            normalized = normalize_text_document(
                seed,
                filename=filename or str(document.get("title") or ""),
                mime_type=str(mime_type or document.get("mime_type") or ""),
                preferred_format=source_format or ("html" if rendered_html else None),
            )

        document["plain_text"] = plain_text or normalized.plain_text
        document["content"] = rendered_html or normalized.rendered_html
        document["content_html"] = rendered_html or normalized.rendered_html
        document["content_markdown"] = content_markdown or normalized.markdown
        document["source_format"] = source_format or normalized.source_format
        document["parse_warnings"] = list(metadata.get("parse_warnings") or normalized.warnings)
        metadata["rendered_html"] = document["content_html"]
        metadata["content_markdown"] = document["content_markdown"]
        metadata["plain_text"] = document["plain_text"]
        metadata["source_format"] = document["source_format"]
        metadata["parse_warnings"] = document["parse_warnings"]

    # ========================================
    # DOCUMENT CRUD OPERATIONS
    # ========================================

    async def create_document(
        self,
        user_id: str,
        title: str,
        content: str = "",
        content_type: str = "html",
        metadata: dict[str, Any] | None = None,
        tags: list[str] | None = None,
        *,
        is_public: bool = False,
    ) -> dict[str, Any]:
        """
        Create new document in unified_content table.

        Fields mapping:
        - title → title (VARCHAR 500)
        - content → extracted_text (TEXT)
        - content_type → mime_type (e.g., 'text/html', 'text/markdown')
        - tags → tags (TEXT[])
        - is_public → visibility ('public' or 'private')
        """
        # Map content_type to mime_type
        mime_type_mapping = {
            "html": "text/html",
            "markdown": "text/markdown",
            "text": "text/plain",
        }
        normalized_content_type = (content_type or "html").strip().lower()
        mime_type = mime_type_mapping.get(normalized_content_type, "text/html")
        normalized = normalize_text_document(
            content or "",
            filename=title,
            mime_type=mime_type,
            preferred_format=normalized_content_type,
        )
        rendered_html = normalized.rendered_html
        plain_text = normalized.plain_text

        # Calculate stats based on plain text content
        word_count = len(plain_text.split()) if plain_text else 0
        character_count = len(plain_text) if plain_text else 0

        # Map is_public to visibility
        visibility = "public" if is_public else "private"

        # Merge metadata
        full_metadata = metadata or {}
        full_metadata["content_type"] = normalized_content_type  # Store original type in metadata
        full_metadata["rendered_html"] = rendered_html
        full_metadata["content_markdown"] = normalized.markdown
        full_metadata["plain_text"] = plain_text
        full_metadata["source_format"] = normalized.source_format
        full_metadata["parse_warnings"] = list(normalized.warnings)

        # Store content as file_data (bytea) for download capability
        if normalized.source_format == "markdown":
            file_data_text = normalized.markdown
        elif normalized.source_format == "text":
            file_data_text = normalized.plain_text
        else:
            file_data_text = rendered_html
        file_data = file_data_text.encode("utf-8") if file_data_text else b""
        file_size = len(file_data)
        file_hash = hashlib.sha256(file_data).hexdigest()

        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO unified_content (
                    id, user_id, name, title, extracted_text, content_type, mime_type,
                    tags, visibility, metadata, word_count, character_count,
                    file_data, file_size, file_hash, storage_backend,
                    created_at, updated_at, version
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12,
                    $13, $14, $15, $16,
                    NOW(), NOW(), 1
                )
                RETURNING *
                """,
                uuid4(),
                user_id,
                title,  # name
                title,  # title column (same as display name for Doc Editor)
                plain_text,  # extracted_text (plain text for search)
                "document",  # content_type enum
                mime_type,
                tags or [],
                visibility,
                json.dumps(full_metadata),
                word_count,
                character_count,
                file_data,
                file_size,
                file_hash,
                "postgresql",  # storage_backend
            )

            # Update tag usage
            if tags:
                for tag in tags:
                    await conn.execute("SELECT increment_tag_usage($1::uuid, $2)", user_id, tag)

            if row is None:
                msg = "Failed to create document"
                raise RuntimeError(msg)
            logger.info("Document created: %s (unified_content)", row["id"])

            # Map database fields to response format
            result = {
                "id": row["id"],
                "user_id": row["user_id"],
                "title": row["name"] or "",  # name field is title
                "content": rendered_html,
                "plain_text": plain_text,
                "mime_type": row["mime_type"],
                "tags": row["tags"] or [],
                "is_public": row["visibility"] == "public",
                "word_count": row["word_count"],
                "character_count": row["character_count"],
                "version": row["version"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "metadata": row["metadata"]
                if isinstance(row["metadata"], dict)
                else (json.loads(row["metadata"]) if row["metadata"] else {}),
            }
            self._enrich_text_projection(result, raw_content=plain_text, filename=title, mime_type=row["mime_type"])

            # Cache new document
            if self.redis_service:
                try:
                    cache_key = self._get_cache_key(result["id"], user_id)
                    # Convert UUIDs and datetimes to strings for JSON serialization
                    cache_data = {
                        **result,
                        "id": str(result["id"]),
                        "user_id": str(result["user_id"]),
                        "created_at": result["created_at"].isoformat() if result["created_at"] else None,
                        "updated_at": result["updated_at"].isoformat() if result["updated_at"] else None,
                    }
                    async with self.redis_service.get_redis_client() as redis:
                        if redis:
                            await redis.setex(
                                cache_key,
                                self._cache_ttl,
                                json.dumps(cache_data, default=str),
                            )
                except (ConnectionError, TimeoutError, ValueError) as e:
                    logger.warning("Redis cache write failed: %s", e)

            return result

    def _get_cache_key(self, document_id: UUID, user_id: str) -> str:
        """Generate Redis cache key for document"""
        return f"doc_editor:document:{user_id}:{document_id}"

    async def _enrich_document_access(self, document_id: UUID, user_id: str, result: dict[str, Any]) -> None:
        """Владелец всегда может сохранять; соавтор — только если allow_collaborators_save в принятом приглашении."""
        owner_id = str(result.get("user_id"))
        if str(user_id) == owner_id:
            result["document_access_role"] = "owner"
            result["collaboration_can_save"] = True
            return
        result["document_access_role"] = "collaborator"
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT allow_collaborators_save FROM doc_collaboration_invites
                WHERE document_id = $1 AND to_user_id = $2::uuid AND status = 'accepted'
                """,
                document_id,
                user_id,
            )
        result["collaboration_can_save"] = bool(row and row["allow_collaborators_save"])

    def _can_persist_canonical_document(self, document_id: UUID, user_id: str, document: dict[str, Any]) -> bool:
        """PUT document / server draft: только владелец или соавтор с явным разрешением."""
        if str(document.get("user_id")) == str(user_id):
            return True
        if document.get("document_access_role") == "owner":
            return True
        return bool(document.get("collaboration_can_save"))

    async def _assert_collaboration_interaction_allowed(
        self,
        current_user_id: str,
        other_user_id: str,
        *,
        action_label: str,
    ) -> None:
        from api.services.friends_service import FriendsService

        await FriendsService(self.db_pool).assert_can_interact(
            current_user_id,
            other_user_id,
            action_label=action_label,
        )

    async def get_document(self, document_id: UUID, user_id: str) -> dict[str, Any] | None:
        """
        Get document by ID with ownership check and Redis caching.

        Returns document data as dict with:
        - id, user_id, title
        - content (from extracted_text)
        - mime_type, tags, is_public, word_count, character_count
        - version, created_at, updated_at
        """
        cache_key = self._get_cache_key(document_id, user_id)

        # Try Redis cache first
        if self.redis_service:
            try:
                async with self.redis_service.get_redis_client() as redis:
                    if redis:
                        cached = await redis.get(cache_key)
                        if cached:
                            logger.debug("Cache hit for document %s", document_id)
                            cached_str = cached.decode() if isinstance(cached, bytes) else cached
                            parsed: dict[str, Any] = json.loads(cached_str)
                            self._enrich_text_projection(parsed, raw_content=str(parsed.get("plain_text") or ""))
                            await self._enrich_document_access(document_id, user_id, parsed)
                            return parsed
            except (ConnectionError, TimeoutError, ValueError, json.JSONDecodeError) as e:
                logger.warning("Redis cache read failed: %s", e)

        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT
                    id, user_id, name as title, extracted_text as content, mime_type,
                    tags, visibility, word_count, character_count, version,
                    created_at, updated_at, last_accessed_at, metadata
                FROM unified_content
                WHERE id = $1 AND user_id = $2::uuid AND deleted_at IS NULL
                AND content_type = 'document'
                """,
                document_id,
                user_id,
            )

            # If not owner, allow access if user has accepted a collaboration invite for this document
            if not row:
                invite_ok = await conn.fetchrow(
                    """
                    SELECT 1 FROM doc_collaboration_invites
                    WHERE document_id = $1 AND to_user_id = $2 AND status = 'accepted'
                    """,
                    document_id,
                    user_id,
                )
                if invite_ok:
                    row = await conn.fetchrow(
                        """
                        SELECT
                            id, user_id, name as title, extracted_text as content, mime_type,
                            tags, visibility, word_count, character_count, version,
                            created_at, updated_at, last_accessed_at, metadata
                        FROM unified_content
                        WHERE id = $1 AND deleted_at IS NULL AND content_type = 'document'
                        """,
                        document_id,
                    )

            if not row:
                return None

            # Update last_accessed_at
            await conn.execute("UPDATE unified_content SET last_accessed_at = NOW() WHERE id = $1", document_id)

            # Convert to dict and add is_public field
            result = dict(row)
            result["is_public"] = row["visibility"] == "public"

            plain_text = result.get("content", "") or ""

            # Parse JSONB metadata
            if isinstance(result.get("metadata"), str):
                try:
                    result["metadata"] = json.loads(result["metadata"])
                except (json.JSONDecodeError, TypeError):  # fmt: skip
                    result["metadata"] = {}
            elif result.get("metadata") is None:
                result["metadata"] = {}

            rendered_html = (
                result["metadata"].get("rendered_html") if isinstance(result.get("metadata"), dict) else None
            )
            if not rendered_html:
                rendered_html = self._default_rendered_html(plain_text)
                result["metadata"]["rendered_html"] = rendered_html

            result["plain_text"] = plain_text
            result["content"] = rendered_html
            self._enrich_text_projection(
                result,
                raw_content=plain_text,
                filename=str(result.get("title") or ""),
                mime_type=str(result.get("mime_type") or ""),
            )

        await self._enrich_document_access(document_id, user_id, result)

        # Cache result in Redis (после enrich — в кэше роль и collaboration_can_save)
        if self.redis_service:
            try:
                async with self.redis_service.get_redis_client() as redis:
                    if redis:
                        await redis.setex(
                            cache_key,
                            self._cache_ttl,
                            json.dumps(result, default=str),
                        )
                        logger.debug("Cached document %s", document_id)
            except (ConnectionError, TimeoutError, ValueError) as e:
                logger.warning("Redis cache write failed: %s", e)

        return result

    async def list_documents(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 50,
        search: str | None = None,
        tags: list[str] | None = None,
        *,
        list_profile: str = "full",
    ) -> tuple[list[dict[str, Any]], int]:
        """
        List user's documents with filtering.

        Uses unified_content table filtered by content_type = 'document'.
        """
        conditions = ["user_id = $1::uuid", "deleted_at IS NULL", "content_type = 'document'"]
        params = [user_id]
        param_count = 1

        # Full-text search (if search provided)
        if search:
            param_count += 1
            conditions.append(f"(name ILIKE ${param_count} OR extracted_text ILIKE ${param_count})")
            params.append(f"%{search}%")

        # Tags filter
        if tags:
            param_count += 1
            conditions.append(f"tags @> ${param_count}")
            params.append(tags)  # type: ignore[arg-type]  # asyncpg accepts list[str] for array columns

        where_clause = " AND ".join(conditions)

        async with self.db_pool.acquire() as conn:
            # Get total count
            # Note: where_clause is built from validated inputs, params are passed separately
            total = await conn.fetchval(
                f"SELECT COUNT(*) FROM unified_content WHERE {where_clause}",
                *params,  # noqa: S608
            )

            # Get paginated results
            # Note: where_clause is built from validated inputs, params are passed separately
            rows = await conn.fetch(
                f"""
                SELECT
                    id, user_id, name as title, extracted_text as content, mime_type,
                    tags, visibility, word_count, character_count, version,
                    created_at, updated_at, last_accessed_at, metadata
                FROM unified_content
                WHERE {where_clause}
                ORDER BY updated_at DESC
                OFFSET ${param_count + 1} LIMIT ${param_count + 2}
                """,  # noqa: S608
                *params,
                skip,
                limit,
            )

            documents = []
            profile = (list_profile or "full").strip().lower()
            for row in rows:
                doc = dict(row)
                doc["is_public"] = row["visibility"] == "public"
                plain_text = doc.get("content", "") or ""

                if profile == "compact":
                    preview_cap = 280
                    preview_txt = plain_text if len(plain_text) <= preview_cap else f"{plain_text[: preview_cap - 1]}…"
                    doc["plain_text"] = plain_text
                    doc["preview_text"] = preview_txt
                    doc["content"] = ""
                    doc["metadata"] = {}
                    documents.append(doc)
                    continue

                # Parse JSONB metadata field (asyncpg returns it as string)
                if "metadata" in doc:
                    if isinstance(doc["metadata"], str):
                        try:
                            doc["metadata"] = json.loads(doc["metadata"])
                        except (json.JSONDecodeError, TypeError):  # fmt: skip
                            doc["metadata"] = {}
                    elif doc["metadata"] is None:
                        doc["metadata"] = {}
                else:
                    doc["metadata"] = {}

                rendered_html = doc["metadata"].get("rendered_html") if isinstance(doc["metadata"], dict) else None
                if not rendered_html:
                    rendered_html = self._default_rendered_html(plain_text)
                    doc["metadata"]["rendered_html"] = rendered_html

                doc["plain_text"] = plain_text
                doc["content"] = rendered_html
                self._enrich_text_projection(
                    doc,
                    raw_content=plain_text,
                    filename=str(doc.get("title") or ""),
                    mime_type=str(doc.get("mime_type") or ""),
                )
                documents.append(doc)

            return documents, total

    async def update_document(self, document_id: UUID, user_id: str, **updates) -> dict[str, Any] | None:
        """
        Update document.

        DB trigger 'trigger_unified_content_versioning' automatically:
        - Creates version snapshot before title/content changes
        - Increments version number

        No need for Python-side versioning logic!
        """
        # Check ownership / соавтор с правом сохранения
        document = await self.get_document(document_id, user_id)
        if not document:
            return None
        if not self._can_persist_canonical_document(document_id, user_id, document):
            raise CollaborationSaveForbiddenError(
                "Нет прав сохранять этот документ. Владелец может разрешить сохранение соавторам при отправке приглашения."
            )
        expected_version_raw = updates.pop("expected_version", None)
        force_save = bool(updates.pop("force_save", False))
        expected_for_where: int | None = None
        if expected_version_raw is not None and not force_save:
            try:
                expected_for_where = int(expected_version_raw)
            except (TypeError, ValueError) as exc:
                raise ValueError("expected_version must be integer") from exc

        # Build update fields
        update_fields = []
        params = []
        param_count = 0

        if "title" in updates:
            param_count += 1
            update_fields.append(f"name = ${param_count}")
            params.append(updates["title"])
            param_count += 1
            update_fields.append(f"title = ${param_count}")
            params.append(updates["title"])

        rendered_html = None
        plain_text = None
        if "content" in updates:
            requested_content_type = updates.pop("content_type", None)
            metadata_updates = {
                **(document.get("metadata") if isinstance(document.get("metadata"), dict) else {}),
                **(updates.get("metadata") or {}),
            }
            preferred_format = requested_content_type or self._metadata_content_format(
                metadata_updates,
                str(document.get("mime_type") or ""),
            )
            normalized = normalize_text_document(
                updates["content"] or "",
                filename=str(updates.get("title") or document.get("title") or ""),
                mime_type=str(document.get("mime_type") or ""),
                preferred_format=preferred_format,
            )
            rendered_html = normalized.rendered_html
            plain_text = normalized.plain_text

            param_count += 1
            update_fields.append(f"extracted_text = ${param_count}")
            params.append(plain_text)

            # Recalculate stats based on plain text
            word_count = len(plain_text.split()) if plain_text else 0
            character_count = len(plain_text) if plain_text else 0

            param_count += 1
            update_fields.append(f"word_count = ${param_count}")
            params.append(word_count)

            param_count += 1
            update_fields.append(f"character_count = ${param_count}")
            params.append(character_count)

            if normalized.source_format == "markdown":
                file_data_text = normalized.markdown
                next_mime_type = "text/markdown"
            elif normalized.source_format == "text":
                file_data_text = normalized.plain_text
                next_mime_type = "text/plain"
            else:
                file_data_text = rendered_html
                next_mime_type = "text/html"

            # Update file_data for download capability using the source-like representation.
            file_data = file_data_text.encode("utf-8") if file_data_text else b""
            file_size = len(file_data)
            file_hash = hashlib.sha256(file_data).hexdigest()

            param_count += 1
            update_fields.append(f"mime_type = ${param_count}")
            params.append(next_mime_type)

            param_count += 1
            update_fields.append(f"file_data = ${param_count}")
            params.append(file_data)

            param_count += 1
            update_fields.append(f"file_size = ${param_count}")
            params.append(file_size)

            param_count += 1
            update_fields.append(f"file_hash = ${param_count}")
            params.append(file_hash)

            metadata_updates["rendered_html"] = rendered_html
            metadata_updates["content_markdown"] = normalized.markdown
            metadata_updates["plain_text"] = plain_text
            metadata_updates["source_format"] = normalized.source_format
            metadata_updates["parse_warnings"] = list(normalized.warnings)
            metadata_updates["content_type"] = normalized.source_format
            updates["metadata"] = metadata_updates
        else:
            updates.pop("content_type", None)

        if "metadata" in updates:
            param_count += 1
            update_fields.append(f"metadata = ${param_count}::jsonb")
            params.append(json.dumps(updates["metadata"]))

        if "tags" in updates:
            param_count += 1
            update_fields.append(f"tags = ${param_count}")
            params.append(updates["tags"])

        if "is_public" in updates:
            param_count += 1
            update_fields.append(f"visibility = ${param_count}")
            params.append("public" if updates["is_public"] else "private")

        if not update_fields:
            return document  # Nothing to update

        # Add updated_at
        update_fields.append("updated_at = NOW()")

        if expected_for_where is not None:
            param_count += 1
            ver_param = param_count
            params.append(expected_for_where)
            param_count += 1
            id_param = param_count
            params.append(document_id)
            where_sql = f"WHERE id = ${id_param} AND version = ${ver_param}"
        else:
            param_count += 1
            id_param = param_count
            params.append(document_id)
            where_sql = f"WHERE id = ${id_param}"

        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                UPDATE unified_content
                SET {", ".join(update_fields)}
                {where_sql}
                RETURNING id
                """,  # noqa: S608
                *params,
            )
            if not row:
                if expected_for_where is not None:
                    fresh = await self.get_document(document_id, user_id)
                    if not fresh:
                        return None
                    raise DocumentVersionConflictError(
                        expected_version=expected_for_where,
                        current_version=int(fresh.get("version") or 0),
                        server_document=json_safe_api_detail(fresh),
                    )
                return None

            # Update tag usage if tags changed
            if "tags" in updates:
                for tag in updates["tags"]:
                    await conn.execute("SELECT increment_tag_usage($1::uuid, $2)", user_id, tag)

        if self.redis_service:
            try:
                cache_key = self._get_cache_key(document_id, user_id)
                async with self.redis_service.get_redis_client() as redis:
                    if redis:
                        await redis.delete(cache_key)
            except (ConnectionError, TimeoutError, ValueError) as e:
                logger.warning("Redis cache delete failed after document update: %s", e)

        logger.info("Document updated: %s", document_id)
        return await self.get_document(document_id, user_id)

    async def get_server_draft(self, document_id: UUID, user_id: str) -> dict[str, Any] | None:
        document = await self.get_document(document_id, user_id)
        if not document:
            return None
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT
                    document_id,
                    draft_version,
                    base_document_version,
                    content,
                    source_session_id,
                    updated_by,
                    created_at,
                    updated_at
                FROM doc_editor_document_drafts
                WHERE document_id = $1
                """,
                document_id,
            )
            if not row:
                return None
            return {
                "documentId": str(row["document_id"]),
                "draftVersion": int(row["draft_version"] or 0),
                "baseDocumentVersion": int(row["base_document_version"] or 0),
                "content": str(row["content"] or ""),
                "sourceSessionId": str(row["source_session_id"] or ""),
                "updatedBy": str(row["updated_by"] or ""),
                "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
                "updatedAt": row["updated_at"].isoformat() if row["updated_at"] else None,
            }

    async def save_server_draft(
        self,
        document_id: UUID,
        user_id: str,
        *,
        content: str,
        base_document_version: int,
        expected_draft_version: int | None,
        source_session_id: str | None,
    ) -> dict[str, Any]:
        document = await self.get_document(document_id, user_id)
        if not document:
            raise ValueError("Document not found")
        if not self._can_persist_canonical_document(document_id, user_id, document):
            raise CollaborationSaveForbiddenError(
                "Нет прав сохранять черновик на сервере для этого документа. Владелец может разрешить сохранение соавторам при приглашении."
            )
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT draft_version FROM doc_editor_document_drafts WHERE document_id = $1",
                document_id,
            )
            current_draft_version = int(row["draft_version"]) if row else 0
            if expected_draft_version is not None and expected_draft_version != current_draft_version:
                current = await self.get_server_draft(document_id, user_id)
                return {
                    "status": "conflict",
                    "expectedDraftVersion": expected_draft_version,
                    "currentDraftVersion": current_draft_version,
                    "serverDraft": current,
                }
            next_draft_version = current_draft_version + 1
            await conn.execute(
                """
                INSERT INTO doc_editor_document_drafts (
                    document_id,
                    owner_user_id,
                    content,
                    base_document_version,
                    draft_version,
                    source_session_id,
                    updated_by,
                    created_at,
                    updated_at
                )
                VALUES ($1, $2::uuid, $3, $4, $5, $6, $2::uuid, NOW(), NOW())
                ON CONFLICT (document_id) DO UPDATE
                SET
                    content = EXCLUDED.content,
                    base_document_version = EXCLUDED.base_document_version,
                    draft_version = EXCLUDED.draft_version,
                    source_session_id = EXCLUDED.source_session_id,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = NOW()
                """,
                document_id,
                str(document["user_id"]),
                content,
                base_document_version,
                next_draft_version,
                source_session_id or "",
            )
        saved = await self.get_server_draft(document_id, user_id)
        return {"status": "ok", "draft": saved}

    async def delete_server_draft(self, document_id: UUID, user_id: str) -> bool:
        document = await self.get_document(document_id, user_id)
        if not document:
            return False
        if not self._can_persist_canonical_document(document_id, user_id, document):
            return False
        async with self.db_pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM doc_editor_document_drafts WHERE document_id = $1",
                document_id,
            )
        return str(result).upper().endswith("1")

    async def delete_document(self, document_id: UUID, user_id: str) -> bool:
        """Soft delete document"""
        document = await self.get_document(document_id, user_id)
        if not document:
            return False
        if str(document.get("user_id")) != str(user_id):
            return False

        async with self.db_pool.acquire() as conn:
            await conn.execute("UPDATE unified_content SET deleted_at = NOW() WHERE id = $1", document_id)

        if self.redis_service:
            try:
                cache_key = self._get_cache_key(document_id, user_id)
                async with self.redis_service.get_redis_client() as redis:
                    if redis:
                        await redis.delete(cache_key)
            except (ConnectionError, TimeoutError, ValueError) as e:
                logger.warning("Redis cache delete failed after document delete: %s", e)

        logger.info("Document deleted: %s", document_id)
        return True

    # ========================================
    # COLLABORATION INVITES (friends only)
    # ========================================

    async def _are_friends(self, user_id_1: str, user_id_2: str) -> bool:
        """Check if two users are friends (mutual friendship)."""
        try:
            uid1 = UUID(str(user_id_1).strip())
            uid2 = UUID(str(user_id_2).strip())
        except (ValueError, TypeError):  # fmt: skip
            return False
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT check_mutual_friendship($1::uuid, $2::uuid) AS ok",
                str(uid1),
                str(uid2),
            )
        return bool(row and row["ok"])

    async def create_collaboration_invite(
        self,
        document_id: UUID,
        from_user_id: str,
        to_user_id: str,
        *,
        allow_collaborators_save: bool = False,
    ) -> dict[str, Any]:
        """
        Create a collaboration invite: document owner invites a friend.
        Raises ValueError if document not found, not owner, or to_user is not a friend.
        """
        doc = await self.get_document(document_id, from_user_id)
        if not doc:
            raise ValueError("Документ не найден или нет прав")
        # Collaborators can read via accepted invite, but only the content owner may invite.
        if str(doc.get("user_id") or "").strip() != str(from_user_id).strip():
            raise ValueError("Приглашать к совместной работе может только владелец документа")
        if not await self._are_friends(from_user_id, to_user_id):
            raise ValueError("Приглашать можно только друзей")
        await self._assert_collaboration_interaction_allowed(
            from_user_id,
            to_user_id,
            action_label="отправить приглашение к совместной работе",
        )
        try:
            from_user_uuid = UUID(str(from_user_id).strip())
            to_user_uuid = UUID(str(to_user_id).strip())
        except (ValueError, TypeError):  # fmt: skip
            raise ValueError("Некорректный ID пользователя") from None
        doc_title = (doc.get("title") or "").strip() or "Документ"
        async with self.db_pool.acquire() as conn:
            existing = await conn.fetchrow(
                """
                SELECT id FROM doc_collaboration_invites
                WHERE document_id = $1 AND from_user_id = $2 AND to_user_id = $3 AND status = 'pending'
                """,
                document_id,
                from_user_uuid,
                to_user_uuid,
            )
            if existing:
                raise ValueError("Приглашение уже отправлено")
            invite_id = uuid4()
            await conn.execute(
                """
                INSERT INTO doc_collaboration_invites (
                    id, document_id, from_user_id, to_user_id, status, allow_collaborators_save
                )
                VALUES ($1, $2, $3, $4, 'pending', $5)
                """,
                invite_id,
                document_id,
                from_user_uuid,
                to_user_uuid,
                allow_collaborators_save,
            )
            urow = await conn.fetchrow(
                "SELECT username, full_name FROM users WHERE id = $1::uuid",
                from_user_uuid,
            )
        from_display = "Пользователь"
        if urow:
            from_display = (urow["full_name"] or urow["username"] or "Пользователь").strip() or "Пользователь"
        return {
            "id": str(invite_id),
            "document_id": str(document_id),
            "from_user_id": from_user_id,
            "to_user_id": to_user_id,
            "status": "pending",
            "document_title": doc_title,
            "from_display_name": from_display,
            "allow_collaborators_save": allow_collaborators_save,
        }

    async def _emit_doc_collab_invite_dismiss(self, to_user_id: str, invite_id: UUID) -> None:
        """Remove in-app notification row for this invite (Socket.IO)."""
        try:
            from api.services.notification_service import get_notification_service

            nid = f"doc_collab_invite_{invite_id}"
            await get_notification_service().emit_dismiss_for_user(to_user_id, nid)
        except Exception as e:
            logger.warning("doc collab invite dismiss notification failed: %s", e)

    async def list_pending_invites_for_user(self, to_user_id: str) -> list[dict[str, Any]]:
        """List pending collaboration invites for the given user (incoming)."""
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT i.id, i.document_id, i.from_user_id, i.to_user_id, i.status, i.created_at,
                       uc.name AS document_title,
                       u.username AS from_username, u.full_name AS from_full_name, u.avatar_url AS from_avatar_url
                FROM doc_collaboration_invites i
                JOIN unified_content uc ON uc.id = i.document_id AND uc.deleted_at IS NULL
                JOIN users u ON u.id = i.from_user_id
                WHERE i.to_user_id = $1 AND i.status = 'pending'
                ORDER BY i.created_at DESC
                """,
                to_user_id,
            )
        return [
            {
                "id": str(r["id"]),
                "document_id": str(r["document_id"]),
                "document_title": r["document_title"],
                "from_user_id": str(r["from_user_id"]),
                "from_username": r["from_username"],
                "from_full_name": r["from_full_name"],
                "from_avatar_url": r["from_avatar_url"],
                "status": r["status"],
                "created_at": r["created_at"].isoformat()
                if hasattr(r["created_at"], "isoformat")
                else str(r["created_at"]),
            }
            for r in rows
        ]

    async def list_sent_invites_for_document(self, document_id: UUID, from_user_id: str) -> list[dict[str, Any]]:
        """List pending invites sent by the current user for this document.
        Uses LEFT JOIN users so missing user rows don't fail; returns [] on any DB error.
        """
        try:
            doc = await self.get_document(document_id, from_user_id)
            if not doc:
                return []
            if str(doc.get("user_id") or "").strip() != str(from_user_id).strip():
                # Collaborator can open the doc; sent-invite list is owner-only (matches create invite).
                return []
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT i.id, i.to_user_id, i.status, i.created_at, i.allow_collaborators_save,
                           u.username AS to_username, u.full_name AS to_full_name, u.avatar_url AS to_avatar_url
                    FROM doc_collaboration_invites i
                    LEFT JOIN users u ON u.id = i.to_user_id
                    WHERE i.document_id = $1 AND i.from_user_id = $2 AND i.status = 'pending'
                    ORDER BY i.created_at DESC
                    """,
                    document_id,
                    from_user_id,
                )
            return [
                {
                    "id": str(r["id"]),
                    "to_user_id": str(r["to_user_id"]),
                    "to_username": r["to_username"],
                    "to_full_name": r["to_full_name"],
                    "to_avatar_url": r["to_avatar_url"],
                    "status": r["status"],
                    "allow_collaborators_save": bool(r.get("allow_collaborators_save")),
                    "created_at": r["created_at"].isoformat()
                    if hasattr(r["created_at"], "isoformat")
                    else str(r["created_at"]),
                }
                for r in rows
            ]
        except Exception as e:
            logger.warning("list_sent_invites_for_document failed (returning []): %s", e)
            return []

    async def accept_collaboration_invite(self, invite_id: UUID, to_user_id: str) -> dict[str, Any]:
        """
        Accept an invite. Only to_user can accept.
        Returns invite + document_id for client to open the document.
        """
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, document_id, from_user_id, to_user_id, status
                FROM doc_collaboration_invites
                WHERE id = $1
                """,
                invite_id,
            )
            if not row:
                raise ValueError("Приглашение не найдено")
            if str(row["to_user_id"]) != str(to_user_id):
                raise ValueError("Нет прав принять это приглашение")
            if row["status"] != "pending":
                raise ValueError("Приглашение уже обработано")
            await self._assert_collaboration_interaction_allowed(
                to_user_id,
                str(row["from_user_id"]),
                action_label="принять приглашение к совместной работе",
            )
            await conn.execute(
                """
                UPDATE doc_collaboration_invites SET status = 'accepted', updated_at = NOW() WHERE id = $1
                """,
                invite_id,
            )
        await self._emit_doc_collab_invite_dismiss(to_user_id, invite_id)
        return {
            "id": str(row["id"]),
            "document_id": str(row["document_id"]),
            "status": "accepted",
        }

    async def decline_collaboration_invite(self, invite_id: UUID, to_user_id: str) -> None:
        """Decline an invite. Only to_user can decline."""
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT to_user_id, status FROM doc_collaboration_invites WHERE id = $1",
                invite_id,
            )
            if not row:
                raise ValueError("Приглашение не найдено")
            if str(row["to_user_id"]) != str(to_user_id):
                raise ValueError("Нет прав отклонить это приглашение")
            if row["status"] != "pending":
                raise ValueError("Приглашение уже обработано")
            await conn.execute(
                "UPDATE doc_collaboration_invites SET status = 'declined', updated_at = NOW() WHERE id = $1",
                invite_id,
            )
        await self._emit_doc_collab_invite_dismiss(to_user_id, invite_id)

    async def revoke_collaboration_invite(self, invite_id: UUID, from_user_id: str) -> None:
        """Revoke an invite. Only from_user (sender) can revoke."""
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT from_user_id, to_user_id, status FROM doc_collaboration_invites WHERE id = $1",
                invite_id,
            )
            if not row:
                raise ValueError("Приглашение не найдено")
            if str(row["from_user_id"]) != str(from_user_id):
                raise ValueError("Только отправитель может отозвать приглашение")
            if row["status"] != "pending":
                raise ValueError("Приглашение уже обработано")
            to_uid = str(row["to_user_id"])
            await conn.execute(
                "UPDATE doc_collaboration_invites SET status = 'revoked', updated_at = NOW() WHERE id = $1",
                invite_id,
            )
        await self._emit_doc_collab_invite_dismiss(to_uid, invite_id)

    # ========================================
    # VERSION HISTORY
    # ========================================

    async def get_versions(self, document_id: UUID, user_id: str, limit: int = 10) -> list[dict[str, Any]]:
        """
        Get document version history from content_versions table.

        DB trigger creates versions automatically on title/content changes.
        """
        # First check document ownership
        document = await self.get_document(document_id, user_id)
        if not document:
            return []  # Return empty list instead of dict

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    id, content_id, version as version_number, title, content as plain_text,
                    word_count, character_count, changed_by, change_type,
                    created_at, metadata
                FROM content_versions
                WHERE content_id = $1
                ORDER BY version DESC
                LIMIT $2
                """,
                document_id,
                limit,
            )

            versions = []
            for row in rows:
                version = dict(row)
                metadata = version.get("metadata")
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except (json.JSONDecodeError, TypeError):  # fmt: skip
                        metadata = {}
                elif metadata is None:
                    metadata = {}

                rendered_html = metadata.get("rendered_html")
                plain_text = version.get("plain_text", "") or ""

                if not rendered_html:
                    rendered_html = self._default_rendered_html(plain_text)
                    metadata["rendered_html"] = rendered_html

                version["metadata"] = metadata
                version["plain_text"] = plain_text
                version["rendered_html"] = rendered_html
                versions.append(version)

            return versions

    async def restore_version(self, document_id: UUID, version_number: int, user_id: str) -> dict[str, Any] | None:
        """Restore document to specific version"""
        async with self.db_pool.acquire() as conn:
            # Get version
            version = await conn.fetchrow(
                """
                SELECT title, content as plain_text, metadata
                FROM content_versions
                WHERE content_id = $1 AND version = $2
                """,
                document_id,
                version_number,
            )

            if not version:
                return None

            metadata = version.get("metadata")
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except (json.JSONDecodeError, TypeError):  # fmt: skip
                    metadata = {}
            elif metadata is None:
                metadata = {}

            rendered_html = metadata.get("rendered_html")
            plain_text = version.get("plain_text") or ""

            content_to_restore = rendered_html or plain_text

            # Update document with version content (triggers new version creation)
            return await self.update_document(document_id, user_id, title=version["title"], content=content_to_restore)

    # ========================================
    # AI INTEGRATION - LLAMA
    # ========================================

    @staticmethod
    def _extract_generation_text(payload: Any) -> str:
        """Extract text from normalized UGS/provider payloads."""

        if isinstance(payload, dict):
            nested_payload = payload.get("result")
            if nested_payload is not None and nested_payload is not payload:
                nested_text = DocEditorService._extract_generation_text(nested_payload)
                if nested_text:
                    return nested_text

            preview_payload = payload.get("result_preview")
            if preview_payload is not None and preview_payload is not payload:
                preview_text = DocEditorService._extract_generation_text(preview_payload)
                if preview_text:
                    return preview_text

            return (
                payload.get("response")
                or payload.get("content")
                or payload.get("text")
                or payload.get("result_text")
                or ""
            )

        if isinstance(payload, str):
            return payload

        return ""

    async def _call_ugs_text_generation(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int | None,
        user_id: str | None = None,
        *,
        json_format: bool = False,
    ) -> dict[str, Any]:
        """Call UGS hub for text generation and normalize the response."""

        if not self.ugs_service:
            msg = "UGS service is not configured for DocEditorService"
            raise RuntimeError(msg)

        safe_temperature = max(0.0, min(float(temperature), 2.0))
        num_predict = int(max_tokens) if max_tokens else 1024
        if num_predict <= 0:
            num_predict = 512

        input_data: dict[str, Any] = {
            "prompt": prompt,
            "model": model,
            "options": {"temperature": safe_temperature, "num_predict": num_predict},
        }
        if json_format:
            input_data["json_format"] = True

        generation = await self.ugs_service.generate_and_wait(
            user_id=user_id or "doc_editor_system",
            type_key="text_chat",
            input_data=input_data,
            priority=5,
            timeout_seconds=120.0,
            poll_interval=1.0,
        )

        payload: Any = generation.get("result")
        if payload is None:
            payload = generation.get("result_preview")
        if payload is None:
            payload = generation

        response_text = self._extract_generation_text(payload).strip()
        usage: dict[str, Any] = {}

        if isinstance(payload, dict):
            usage = payload.get("usage") or {}

        if not response_text:
            msg = "AI provider returned empty response"
            raise RuntimeError(msg)

        return {"text": response_text, "payload": payload, "raw": generation, "usage": usage}

    async def ai_complete(
        self,
        prompt: str,
        context: str | None = None,
        model: str = DEFAULT_MODEL,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        user_id: str | None = None,
        action_mode: str | None = None,
        context_scope: str | None = None,
        json_format: bool = False,
    ) -> str:
        """Complete AI request (non-streaming) via UGS with Llama fallback."""

        full_prompt = f"{context}\n\n{prompt}" if context else prompt

        if self.ugs_service:
            try:
                ugs_result = await self._call_ugs_text_generation(
                    prompt=full_prompt,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    user_id=user_id,
                    json_format=json_format,
                )
                return ugs_result.get("text", "")
            except Exception as ugs_error:
                # Не fallback на env Llama: настройки админки UGS — источник истины
                logger.warning("UGS text generation failed (using admin provider config): %s", ugs_error)
                raise

        if not (LLAMA_URL and LLAMA_URL.strip()):
            raise ValueError("LLAMA_BASE_URL is not set. Set the environment variable or configure UGS.") from None

        client = get_httpx_client()
        data = await httpx_compat_generate_json(
            client,
            LLAMA_URL.rstrip("/"),
            model=model,
            prompt=full_prompt,
            system=None,
            options={"temperature": temperature, "num_predict": max_tokens},
            json_format=json_format,
            keep_alive=llama_keep_alive_from_settings(),
            timeout=client.timeout,
        )
        return str(data.get("response") or "")

    async def ai_complete_streaming(
        self,
        prompt: str,
        context: str | None = None,
        model: str = DEFAULT_MODEL,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        user_id: str | None = None,
        action_mode: str | None = None,
        context_scope: str | None = None,
        request_id: str | None = None,
        document_id: str | None = None,
        prompt_hash: str | None = None,
        context_hash: str | None = None,
    ) -> AsyncGenerator[str]:
        """Stream AI completion for real-time UI updates via UGS or direct Llama."""

        full_prompt = f"{context}\n\n{prompt}" if context else prompt
        request_id = request_id or str(uuid4())
        generated_at = datetime.now(UTC).isoformat()

        if self.ugs_service:
            try:
                yield (
                    "data: "
                    + json.dumps(
                        {
                            "meta": {
                                "requestId": request_id,
                                "model": model,
                                "actionMode": action_mode or "free",
                                "contextScope": context_scope or "selection",
                                "provider": "ugs",
                                "generatedAt": generated_at,
                                "documentId": document_id,
                                "promptHash": prompt_hash,
                                "contextHash": context_hash,
                            }
                        }
                    )
                    + "\n\n"
                )
                ugs_task = asyncio.create_task(
                    self._call_ugs_text_generation(
                        prompt=full_prompt,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        user_id=user_id,
                    )
                )

                while True:
                    try:
                        async with asyncio.timeout(8.0):
                            ugs_result = await asyncio.shield(ugs_task)
                        break
                    except TimeoutError:
                        yield ": keep-alive\n\n"

                yield f"data: {json.dumps({'text': ugs_result.get('text', '')})}\n\n"
                yield "data: [DONE]\n\n"
                return
            except Exception as ugs_error:
                logger.warning(
                    "UGS streaming generation failed (using admin provider config): %s",
                    ugs_error,
                )
                yield f"data: {json.dumps({'error': str(ugs_error)})}\n\n"
                yield "data: [DONE]\n\n"
                return

        if not (LLAMA_URL and LLAMA_URL.strip()):
            raise ValueError("LLAMA_BASE_URL is not set. Set the environment variable or configure UGS.") from None

        client = get_httpx_client()
        yield (
            "data: "
            + json.dumps(
                {
                    "meta": {
                        "requestId": request_id,
                        "model": model,
                        "actionMode": action_mode or "free",
                        "contextScope": context_scope or "selection",
                        "provider": "llama_direct",
                        "generatedAt": generated_at,
                        "documentId": document_id,
                        "promptHash": prompt_hash,
                        "contextHash": context_hash,
                    }
                }
            )
            + "\n\n"
        )

        async for piece in httpx_compat_generate_text_stream(
            client,
            LLAMA_URL.rstrip("/"),
            model=model,
            prompt=full_prompt,
            system=None,
            options={"temperature": temperature, "num_predict": max_tokens},
            timeout=_HTTP_TIMEOUT_LLAMA_STREAM,
        ):
            yield f"data: {json.dumps({'text': piece})}\n\n"
        yield "data: [DONE]\n\n"

    async def ai_analyze(
        self, document_id: UUID, analysis_type: str, user_id: str, custom_prompt: str | None = None
    ) -> dict[str, Any]:
        """Analyze document with AI"""
        # Get document
        document = await self.get_document(document_id, user_id)
        if not document:
            msg = "Document not found"
            raise ValueError(msg)

        content = document.get("content", "")

        # Build analysis prompt based on type
        prompts = {
            "summary": f"Создай краткое резюме следующего документа (3-5 предложений):\n\n{content}",
            "keywords": f"Извлеки 10 ключевых слов/фраз из следующего документа:\n\n{content}",
            "questions": f"Создай 5 вопросов для проверки понимания следующего документа:\n\n{content}",
            "structure": f"Проанализируй структуру следующего документа (разделы, подразделы, логика):\n\n{content}",
            "sentiment": f"Проанализируй тональность следующего текста (позитивная, негативная, нейтральная):\n\n{content}",
        }

        prompt = custom_prompt or prompts.get(analysis_type, prompts["summary"])

        # Get AI response
        result = await self.ai_complete(
            prompt=prompt, model=DEFAULT_MODEL, temperature=0.7, max_tokens=2000, user_id=user_id
        )

        return {"analysis_type": analysis_type, "result": result, "document_id": document_id}

    # ========================================
    # AI INTEGRATION - COMFYUI
    # ========================================

    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str = "blurry, low quality",
        workflow_type: str = "text2img",
        width: int = 1024,
        height: int = 1024,
        steps: int = 20,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        """Generate image via UGS (Unified Generation System) or fallback to ComfyUI"""

        # Generate random seed for reproducibility
        seed = random.randint(1, 1000000000000)

        # Try UGS first if available
        if self.ugs_service and user_id:
            try:
                logger.info("🎨 Using UGS for image generation")

                wt = str(workflow_type or "text2img").strip().lower()
                input_data: dict[str, Any] = {
                    "prompt": prompt,
                    "negative_prompt": negative_prompt,
                    "width": width,
                    "height": height,
                    "steps": steps,
                    "cfg_scale": 7.5,
                    "sampler": "dpmpp_2m_sde",
                    "model": "epicrealismXL_vxviiCrystalclear.safetensors",
                    "workflow_type": workflow_type,
                    "seed": seed,
                }
                if wt in ("text2img", "txt2img", ""):
                    input_data["workflow_key"] = "text_to_image"

                ugs_result = await self.ugs_service.generate(
                    user_id=user_id,
                    type_key="image_generation_comfyui",
                    input_data=input_data,
                    priority=5,
                )

                request_id = ugs_result["request_id"]
                logger.info("UGS generation started: %s", request_id)

                # Cache request_id for later status checking
                self._comfyui_jobs[request_id] = prompt

                return {
                    "job_id": request_id,
                    "status": "queued",
                    "workflow_type": workflow_type,
                    "prompt": prompt,
                    "seed": seed,
                    "using_ugs": True,
                }

            except Exception as e:
                logger.exception("UGS generation failed")
                msg = f"Failed to generate image via UGS: {e}"
                raise RuntimeError(msg) from e

        # UGS is required - no fallback to direct ComfyUI
        if not self.ugs_service or not user_id:
            msg = "UGS service is required for image generation. Please ensure UGS is properly configured."
            raise RuntimeError(msg)
        return {}  # type: ignore[return-value]  # Never reached due to raise above

    async def download_comfyui_image(self, filename: str, subfolder: str = "", image_type: str = "output") -> bytes:
        """
        Download image from ComfyUI server.

        Args:
            filename: Image filename
            subfolder: Subfolder path (optional)
            image_type: Image type (output/input/temp)

        Returns:
            Image binary data
        """
        client = get_httpx_client()
        params = {"filename": filename, "type": image_type}
        if subfolder:
            params["subfolder"] = subfolder

        response = await client.get(
            f"{COMFYUI_URL}/view",
            params=params,
            timeout=_HTTP_TIMEOUT_COMFYUI,
        )
        response.raise_for_status()
        return response.content

    async def check_image_status(
        self, job_id: str, user_id: str, prompt: str = "", *, save_to_content: bool = True
    ) -> dict[str, Any]:
        """
        Check UGS or ComfyUI job status and optionally save to unified_content when ready.

        Args:
            job_id: UGS request ID or ComfyUI prompt ID
            user_id: User ID for content ownership
            prompt: Original prompt for metadata
            save_to_content: Whether to save to unified_content (default: True)

        Returns:
            Status dict with content_id if completed and saved
        """
        # Check if this is a UGS job (stored in our cache)
        using_ugs = job_id in self._comfyui_jobs and self.ugs_service
        image_data_bytes: bytes | None = None

        if using_ugs and self.ugs_service:
            try:
                # Use UGS status checking
                status_result = await self.ugs_service.get_status(job_id)  # type: ignore[union-attr]
                status = status_result["status"]

                if status == "success":
                    # Get the result
                    result_data = await self.ugs_service.get_result(job_id)  # type: ignore[union-attr]
                    generation_result = result_data.get("result", {})

                    # Normalize image structure (support dict or list)
                    image_entries: list[dict[str, Any]] = []
                    images_payload = generation_result.get("images") if isinstance(generation_result, dict) else None

                    if isinstance(images_payload, dict):
                        for node_data in images_payload.values():
                            if isinstance(node_data, dict) and isinstance(node_data.get("images"), list):
                                image_entries.extend(node_data["images"])
                    elif isinstance(images_payload, list):
                        image_entries.extend(images_payload)

                    if not image_entries:
                        return {
                            "status": "failed",
                            "error": "No images found in UGS ComfyUI result",
                            "content_id": None,
                        }

                    first_image = image_entries[0] if image_entries else None
                    if not isinstance(first_image, dict):
                        return {
                            "status": "failed",
                            "error": "Invalid image payload received from UGS",
                            "content_id": None,
                        }

                    filename = first_image.get("filename") or first_image.get("name")
                    if not filename:
                        storage_ref = first_image.get("storage_reference")
                        if isinstance(storage_ref, dict):
                            filename = storage_ref.get("filename")

                    if not filename:
                        return {
                            "status": "failed",
                            "error": "Image filename not provided in UGS result",
                            "content_id": None,
                        }

                    image_data_b64 = first_image.get("data") or first_image.get("image_data")
                    subfolder = ""
                    image_type = first_image.get("type", "output")

                    storage_ref = first_image.get("storage_reference")
                    if isinstance(storage_ref, dict):
                        subfolder = storage_ref.get("subfolder", "")
                        image_type = storage_ref.get("type", image_type)

                    if not image_data_b64:
                        try:
                            raw_bytes = await self.download_comfyui_image(filename, subfolder, image_type or "output")
                            image_data_b64 = base64.b64encode(raw_bytes).decode("utf-8")
                        except Exception as e:
                            logger.exception("Failed to download image from ComfyUI")
                            return {
                                "status": "failed",
                                "error": f"Failed to download image: {e}",
                                "content_id": None,
                            }
                    else:
                        raw_bytes = base64.b64decode(image_data_b64)

                    data_uri = first_image.get("data_uri")
                    if not data_uri and image_data_b64:
                        data_uri = f"data:{first_image.get('format', 'image/png')};base64,{image_data_b64}"

                    image_data_bytes = raw_bytes

                    result = {
                        "status": "completed",
                        "filename": filename,
                        "width": first_image.get("width"),
                        "height": first_image.get("height"),
                        "image_url": data_uri,
                        "subfolder": subfolder,
                        "type": image_type or "output",
                    }

                elif status == "failed":
                    error_msg = status_result.get("error_message", "UGS generation failed")
                    return {"status": "failed", "error": error_msg, "content_id": None}
                else:
                    return {"status": "processing", "image_url": None, "content_id": None}

            except Exception as e:
                logger.exception("UGS status check failed")
                return {"status": "failed", "error": f"UGS error: {e}", "content_id": None}
        else:
            # Fallback to direct ComfyUI status checking
            client = get_httpx_client()
            try:
                # Get job history
                response = await client.get(
                    f"{COMFYUI_URL}/history/{job_id}",
                    timeout=_HTTP_TIMEOUT_COMFYUI,
                )
                response.raise_for_status()
                history = response.json()

                # Check if job exists
                if job_id not in history:
                    return {"status": "processing", "image_url": None, "content_id": None}

                job_data = history[job_id]

                # Check if completed
                if "outputs" not in job_data:
                    return {"status": "processing", "image_url": None, "content_id": None}

                # Extract image info
                outputs = job_data.get("outputs", {})
                save_image_node = outputs.get("9", {})

                if "images" not in save_image_node:
                    return {"status": "processing", "image_url": None, "content_id": None}

                images = save_image_node["images"]
                if not images:
                    return {
                        "status": "failed",
                        "error": "No images generated",
                        "content_id": None,
                    }

                # Get first image
                first_image = images[0]
                if not isinstance(first_image, dict):
                    return {
                        "status": "failed",
                        "error": "Invalid image data format",
                        "content_id": None,
                    }
                filename = first_image.get("filename")
                if not filename:
                    return {
                        "status": "failed",
                        "error": "Image filename not found",
                        "content_id": None,
                    }
                subfolder = first_image.get("subfolder", "")
                image_type = first_image.get("type", "output")

                try:
                    image_data_bytes = await self.download_comfyui_image(filename, subfolder, image_type or "output")
                except Exception as e:
                    return {
                        "status": "failed",
                        "error": f"Failed to download image: {e}",
                        "content_id": None,
                    }

                image_data_b64 = base64.b64encode(image_data_bytes).decode("utf-8")
                data_uri = f"data:image/png;base64,{image_data_b64}"

                result = {
                    "status": "completed",
                    "filename": filename,
                    "width": first_image.get("width"),
                    "height": first_image.get("height"),
                    "subfolder": subfolder,
                    "type": image_type or "output",
                    "image_url": data_uri,
                }

            except httpx.HTTPStatusError as e:
                if e.response.status_code == HTTP_NOT_FOUND:
                    return {"status": "queued", "image_url": None, "content_id": None}
                raise
            except Exception as e:
                return {"status": "failed", "error": str(e), "content_id": None}

        # Save to unified_content if requested and completed
        if result.get("status") == "completed" and save_to_content:
            try:
                if image_data_bytes is None:
                    image_data_bytes = await self.download_comfyui_image(
                        result["filename"],
                        result.get("subfolder", ""),
                        result.get("type", "output"),
                    )

                # Import services

                # Initialize content service - ContentStorageService requires storage_factory and audit_logger
                # For now, skip saving to unified_content if ContentStorageService is not properly initialized
                # This is a temporary workaround - proper initialization should be done at service creation
                logger.warning(
                    "ContentStorageService requires storage_factory and audit_logger - skipping save to unified_content"
                )
                result["content_id"] = None
                result["image_url"] = (
                    f"/api/doc-editor/ai/image/view?filename={result['filename']}&subfolder={result.get('subfolder', '')}&type={result.get('type', 'output')}"
                )

                # Content saving skipped - see warning above

            except Exception:
                logger.exception("Failed to save image to unified_content")
                # Fallback to proxy URL
                result["image_url"] = (
                    f"/api/doc-editor/ai/image/view?filename={result['filename']}&subfolder={result.get('subfolder', '')}&type={result.get('type', 'output')}"
                )
                result["content_id"] = None
        elif result.get("status") == "completed":
            # Legacy: return proxy URL when not saving to content
            result["image_url"] = (
                f"/api/doc-editor/ai/image/view?filename={result['filename']}&subfolder={result.get('subfolder', '')}&type={result.get('type', 'output')}"
            )
            result["content_id"] = None

        return result

    # ========================================
    # OCR OPERATIONS
    # ========================================

    async def perform_ocr(
        self, file_data: bytes, language: str, filename: str, content_type: str | None = None
    ) -> dict[str, Any]:
        """
        Perform OCR using Stack4 Tesseract (images) with Tika / OCRmyPDF fallbacks.

        Supported formats: PNG, JPG, JPEG, GIF, BMP, WEBP, PDF, TIFF
        """
        detected_content_type = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
        ext = Path(filename).suffix.lower()
        is_image = ext in _OCR_IMAGE_SUFFIXES or detected_content_type.startswith("image/")
        is_pdf = ext == ".pdf" or detected_content_type == "application/pdf"
        gateway = get_stack4_document_gateway()

        if is_image:
            try:
                tesseract_text = await gateway.ocr_image_to_text(file_data, filename, lang=language)
                if tesseract_text.strip():
                    return {
                        "success": True,
                        "text": tesseract_text,
                        "confidence": None,
                        "language": language,
                        "processing_time": 0.0,
                        "filename": filename,
                        "ocr_engine": "tesseract",
                    }
            except Stack4ServiceUnavailable:
                logger.debug("[STEP] doc_editor_ocr_tesseract_skip not configured")
            except Exception:
                logger.exception("Tesseract OCR failed for %s", filename)

        try:
            client = get_httpx_client()
            response = await client.put(
                f"{TIKA_URL}/tika",
                content=file_data,
                headers={
                    "Accept": "text/plain",
                    "Content-Type": detected_content_type,
                    "X-Tika-OCRLanguage": language,
                    "X-Tika-PDFextractInlineImages": "true",
                },
                timeout=_HTTP_TIMEOUT_TIKA_OCR,
            )

            if response.status_code == HTTP_BAD_REQUEST:
                error_text = response.text if hasattr(response, "text") else "Bad request"
                logger.warning("Tika OCR HTTP 400 error: %s", error_text)
                return {
                    "success": False,
                    "text": "",
                    "error": f"Tika OCR rejected request: {error_text[:200]}",
                    "language": language,
                    "processing_time": 0.0,
                    "filename": filename,
                }

            response.raise_for_status()
            ocr_text = response.text.strip()
            if ocr_text:
                processing_time = response.headers.get("X-Tika-OCR-Processing-Time", "0")
                return {
                    "success": True,
                    "text": ocr_text,
                    "confidence": None,
                    "language": language,
                    "processing_time": float(processing_time) if str(processing_time).isdigit() else 0.0,
                    "filename": filename,
                    "ocr_engine": "tika",
                }
        except httpx.HTTPStatusError as e:
            if e.response.status_code == HTTP_BAD_REQUEST:
                logger.warning(
                    "Tika OCR HTTP 400 error: %s",
                    e.response.text[:200] if hasattr(e.response, "text") else "Bad request",
                )
                return {
                    "success": False,
                    "text": "",
                    "error": f"Tika OCR rejected request (400): {e!s}",
                    "language": language,
                    "processing_time": 0.0,
                    "filename": filename,
                }
            logger.exception("Tika OCR HTTP error: %s - %s", e.response.status_code, e.response.text)
        except Exception:
            logger.exception("Tika OCR processing error for %s", filename)

        if is_pdf:
            try:
                pdf_text = await gateway.ocr_pdf_to_text(file_data, filename, ocr_lang=language)
                if pdf_text.strip():
                    return {
                        "success": True,
                        "text": pdf_text,
                        "confidence": None,
                        "language": language,
                        "processing_time": 0.0,
                        "filename": filename,
                        "ocr_engine": "ocrmypdf",
                    }
            except Stack4ServiceUnavailable:
                logger.debug("[STEP] doc_editor_ocr_ocrmypdf_skip not configured")
            except Exception:
                logger.exception("OCRmyPDF fallback failed for %s", filename)

        return {
            "success": False,
            "text": "",
            "error": (
                "OCR не нашёл распознаваемый текст. Проверьте, что на изображении есть "
                "чёткий текст, выберите подходящий язык (русский / английский / оба) "
                "и попробуйте более контрастный скан или фото."
            ),
            "language": language,
            "processing_time": 0.0,
            "filename": filename,
        }

    # ========================================
    # TABLE EDITOR OPERATIONS
    # ========================================

    async def insert_table(self, document_id: UUID, table_html: str, position: str, user_id: str) -> dict[str, Any]:
        """
        Insert table into document content.
        """
        # Get current document
        document = await self.get_document(document_id, user_id)
        if not document:
            msg = "Document not found"
            raise ValueError(msg)

        current_content = document.get("content", "")

        # Insert table at position
        if position == "cursor":
            # For now, append to end (cursor position not implemented)
            new_content = current_content + "\n\n" + table_html
        else:
            new_content = current_content + "\n\n" + table_html

        # Update document
        await self.update_document(document_id, user_id, content=new_content)

        return {"success": True, "document_id": str(document_id), "table_inserted": True}

    # ========================================
    # CHARTS & DIAGRAMS OPERATIONS
    # ========================================

    async def generate_chart(
        self, chart_type: str, chart_data: dict[str, Any], config: dict[str, Any], user_id: str
    ) -> dict[str, Any]:
        """
        Generate chart/diagram HTML.
        """
        if chart_type == "mermaid":
            # Generate Mermaid diagram
            mermaid_code = chart_data.get("code", "")
            html = f'<div class="mermaid">{mermaid_code}</div>'
        else:
            # Simple chart using Chart.js or similar
            html = f'<div class="chart" data-type="{chart_type}" data-data="{json.dumps(chart_data)}" data-config="{json.dumps(config)}">Chart placeholder</div>'

        return {"success": True, "html": html, "type": chart_type}

    # ========================================
    # FILE OPERATIONS
    # ========================================

    async def parse_file_with_tika(self, file_content: bytes, filename: str) -> dict[str, Any]:
        """
        Parse document for editor HTML.

        Plain text / Markdown / HTML: decode locally (Tika сжимает .md в несколько блоков).
        Остальное: Apache Tika (DOC, DOCX, PDF, RTF, …).
        """
        suffix = Path(filename).suffix.lower()
        if suffix in _DOC_EDITOR_NATIVE_TEXT_SUFFIXES:
            text = _decode_utf8_plain_file(file_content)
            normalized = normalize_text_document(
                text,
                filename=filename,
                mime_type=mimetypes.guess_type(filename)[0] or "",
                preferred_format="markdown"
                if suffix in _DOC_EDITOR_MARKDOWN_SUFFIXES
                else ("html" if suffix in (".html", ".htm") else "text"),
            )
            return {
                "content": normalized.rendered_html,
                "metadata": {
                    "parsed_via": "native",
                    "source_extension": suffix,
                    "format": normalized.source_format,
                    "content_markdown": normalized.markdown,
                    "rendered_html": normalized.rendered_html,
                    "plain_text": normalized.plain_text,
                    "source_format": normalized.source_format,
                    "parse_warnings": list(normalized.warnings),
                },
                "original_filename": filename,
            }

        client = get_httpx_client()
        # Send to Tika for parsing (shared client default 60s matches prior behavior)
        response = await client.put(
            f"{TIKA_URL}/tika",
            content=file_content,
            headers={
                "Accept": "text/html",
                "X-Tika-OCRLanguage": "rus+eng",
                "X-Tika-PDFextractInlineImages": "true",
            },
        )

        response.raise_for_status()
        html_content = response.text

        # Get metadata (Tika may return 200 with empty body → json() raises Expecting value)
        meta_response = await client.put(f"{TIKA_URL}/meta", content=file_content)
        metadata: dict[str, Any] = {}
        if meta_response.status_code == 200:
            try:
                data = meta_response.json()
            except (ValueError, json.JSONDecodeError):  # fmt: skip
                logger.warning(
                    "[STEP] Tika /meta not valid JSON or empty (status=%s content_type=%s body_len=%s)",
                    meta_response.status_code,
                    meta_response.headers.get("content-type"),
                    len(meta_response.content or b""),
                )
            else:
                if isinstance(data, dict):
                    metadata = data
                elif isinstance(data, list) and data and isinstance(data[0], dict):
                    metadata = data[0]

        # Enhanced metadata for Word documents
        file_ext = filename.lower().split(".")[-1]
        if file_ext in ["doc", "docx"]:
            metadata["word_document"] = True
            metadata["format_type"] = "legacy" if file_ext == "doc" else "modern"
            logger.info("Parsed Word document: %s (format: %s)", filename, metadata["format_type"])

        return {"content": html_content, "metadata": metadata, "original_filename": filename}

    async def export_document(self, document: dict[str, Any], format: str) -> bytes:
        """Export document to various formats"""
        content = document.get("content", "")
        title = document.get("title", "Untitled")

        if format == "pdf":
            html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 2cm; }}
        h1 {{ color: #333; }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    {content}
</body>
</html>"""
            gateway = get_stack4_document_gateway()
            return await gateway.html_to_pdf(html_content, title=title)

        elif format == "docx":
            html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 2cm; }}
        h1 {{ color: #333; }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    {content}
</body>
</html>"""
            gateway = get_stack4_document_gateway()
            try:
                return await gateway.html_to_docx(html_content, title=title)
            except Stack4ServiceUnavailable:
                raise
            except Exception as exc:
                logger.warning("Gotenberg DOCX export failed, fallback to python-docx: %s", exc)
                if Document is None:
                    msg = "python-docx is not installed"
                    raise ImportError(msg) from exc

                doc = Document()
                doc.add_heading(title, level=1)
                text = re.sub("<[^<]+?>", "", content)
                for para in text.split("\n"):
                    if para.strip():
                        doc.add_paragraph(para.strip())
                buffer = BytesIO()
                doc.save(buffer)
                buffer.seek(0)
                return buffer.getvalue()

        elif format == "html":
            return content.encode("utf-8")

        elif format == "txt":
            text = self._html_to_plain_text(content)
            return text.encode("utf-8")

        elif format == "md":
            md = self._html_to_markdown(content)
            return md.encode("utf-8")

        else:
            msg = f"Unsupported format: {format}"
            raise ValueError(msg)

    # ========================================
    # SEARCH
    # ========================================

    async def search_fulltext(self, query: str, user_id: str, limit: int = 20) -> list[dict[str, Any]]:
        """Full-text search using PostgreSQL"""
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    id, user_id, name as title, extracted_text as content, mime_type,
                    tags, visibility, word_count, character_count, version,
                    created_at, updated_at
                FROM unified_content
                WHERE user_id = $1::uuid
                AND deleted_at IS NULL
                AND content_type = 'document'
                AND (name ILIKE $2 OR extracted_text ILIKE $2)
                ORDER BY updated_at DESC
                LIMIT $3
                """,
                user_id,
                f"%{query}%",
                limit,
            )

            results = []
            for row in rows:
                doc = dict(row)
                doc["is_public"] = row["visibility"] == "public"
                results.append(doc)

            return results

    # ========================================
    # PROMPTS LIBRARY
    # ========================================

    async def save_prompt(
        self,
        user_id: str,
        name: str,
        prompt: str,
        category: str = "general",
        model: str | None = None,
        temperature: float = 0.7,
        is_public: bool = False,
    ) -> dict[str, Any]:
        """Save AI prompt to user library"""
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO ai_prompts (
                    id, user_id, name, prompt, category, model,
                    temperature, is_public, usage_count, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, NOW())
                RETURNING *
                """,
                uuid4(),
                user_id,
                name,
                prompt,
                category,
                model,
                temperature,
                is_public,
            )

            if row is None:
                msg = "Failed to create prompt"
                raise RuntimeError(msg)
            return dict(row)  # type: ignore[arg-type]  # asyncpg Record can be converted to dict

    async def list_prompts(
        self, user_id: str, category: str | None = None, include_public: bool = True
    ) -> list[dict[str, Any]]:
        """List user's prompts + public prompts"""
        async with self.db_pool.acquire() as conn:
            if include_public:
                query = """
                    SELECT * FROM ai_prompts
                    WHERE (user_id = $1 OR is_public = true)
                """
                params = [user_id]
            else:
                query = """
                    SELECT * FROM ai_prompts
                    WHERE user_id = $1
                """
                params = [user_id]

            if category:
                query += " AND category = $2"
                params.append(category)

            query += " ORDER BY usage_count DESC"

            rows = await conn.fetch(query, *params)
            # Convert UUID user_id to string for Pydantic validation
            prompts = []
            for row in rows:
                prompt = dict(row)
                if isinstance(prompt.get("user_id"), UUID):
                    prompt["user_id"] = str(prompt["user_id"])
                prompts.append(prompt)
            return prompts

    async def delete_prompt(self, prompt_id: UUID, user_id: str) -> bool:
        """Delete user's prompt"""
        async with self.db_pool.acquire() as conn:
            result = await conn.execute("DELETE FROM ai_prompts WHERE id = $1 AND user_id = $2", prompt_id, user_id)

            # Check if any row was deleted
            return result.split()[-1] == "1"
