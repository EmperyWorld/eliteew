#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Document Editor V2 adapter that creates, reads, saves and enriches documents in unified_content.
# It provides draft, import/export, structure, collaboration snapshot and EWA suggestion contracts without legacy write paths.
# Invariants:
# - unified_content is the only storage/write path for V2 documents.
# - Update refuses rows not marked as V2-managed to avoid accidental legacy document mutation.
# - Canonical saves update HTML, Markdown and plain-text projections together; draft/suggestions/collab metadata never replace the body silently.
# Related:
# - api/schemas/doc_editor_v2.py
# - api/routers/doc_editor_v2.py
# - documentation/product/DOCUMENT-EDITOR-V2.md
# ---
"""Unified Content-backed Document Editor V2 service."""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-not-found]

from api.schemas.doc_editor_v2 import (
    DocEditorV2Capabilities,
    DocEditorV2CollaborationParticipant,
    DocEditorV2CollaborationSnapshotRequest,
    DocEditorV2CollaborationSnapshotResponse,
    DocEditorV2CollaborationStateResponse,
    DocEditorV2CreateRequest,
    DocEditorV2DocumentResponse,
    DocEditorV2DraftRequest,
    DocEditorV2DraftResponse,
    DocEditorV2EditorFormat,
    DocEditorV2EwaAction,
    DocEditorV2EwaContextPacket,
    DocEditorV2EwaSuggestRequest,
    DocEditorV2ExportFormat,
    DocEditorV2ExportRequest,
    DocEditorV2ExportResponse,
    DocEditorV2ImportRequest,
    DocEditorV2ImportResponse,
    DocEditorV2SelectionRange,
    DocEditorV2SourceFormat,
    DocEditorV2StructureItem,
    DocEditorV2StructureResponse,
    DocEditorV2SuggestionApplyRequest,
    DocEditorV2SuggestionApplyResponse,
    DocEditorV2SuggestionResponse,
    DocEditorV2SuggestionStatus,
    DocEditorV2UpdateRequest,
)
from api.services.doc_editor_text_normalizer import normalize_text_document

logger = logging.getLogger(__name__)

DOC_EDITOR_V2_SOURCE_SERVICE = "doc_editor_v2"
DOC_EDITOR_V2_METADATA_VERSION = "v2"
DOC_EDITOR_V2_METADATA_KEY = "doc_editor_v2"
_HEADING_HTML_RE = re.compile(r"<h([1-6])[^>]*>(.*?)</h\1\s*>", re.IGNORECASE | re.DOTALL)
_HEADING_MD_RE = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)


class DocumentEditorV2VersionConflictError(Exception):
    """Raised when expected_version does not match the current unified_content version."""

    def __init__(
        self,
        *,
        expected_version: int,
        current_version: int,
        server_document: DocEditorV2DocumentResponse,
    ) -> None:
        super().__init__("Document Editor V2 version conflict")
        self.expected_version = expected_version
        self.current_version = current_version
        self.server_document = server_document


class DocumentEditorV2UnsupportedError(Exception):
    """Raised when a V2 write targets a row outside the V2-managed contour."""


@dataclass(frozen=True, slots=True)
class _Projection:
    """Normalized editable document body stored in unified_content."""

    editor_format: DocEditorV2EditorFormat
    editor_json: dict[str, Any] | None
    content_html: str
    content_markdown: str
    plain_text: str
    source_format: DocEditorV2SourceFormat
    parse_warnings: list[str]
    mime_type: str
    file_data: bytes
    file_hash: str
    word_count: int
    character_count: int


class DocumentEditorV2Service:
    """Create/read/save V2 documents through the unified_content table."""

    def __init__(self, db_pool: asyncpg.Pool) -> None:
        self.db_pool = db_pool

    async def create_document(self, user_id: str, request: DocEditorV2CreateRequest) -> DocEditorV2DocumentResponse:
        """Create a V2-owned document row in unified_content."""

        projection = self._projection_from_create(request)
        metadata = self._metadata_for_projection(projection)
        document_id = uuid4()
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO unified_content (
                    id, user_id, name, title, extracted_text, content_type, mime_type,
                    tags, visibility, metadata, word_count, character_count,
                    file_data, file_size, file_hash, storage_backend, original_filename,
                    source_service, processing_status, created_at, updated_at, updated_by, version
                )
                VALUES (
                    $1, $2::uuid, $3, $4, $5, 'document', $6,
                    $7, 'private', $8::jsonb, $9, $10,
                    $11, $12, $13, 'postgresql', $14,
                    $15, 'completed', NOW(), NOW(), $2::uuid, 1
                )
                """,
                document_id,
                user_id,
                request.title,
                request.title,
                projection.plain_text,
                projection.mime_type,
                request.tags,
                json.dumps(metadata),
                projection.word_count,
                projection.character_count,
                projection.file_data,
                len(projection.file_data),
                projection.file_hash,
                request.title,
                DOC_EDITOR_V2_SOURCE_SERVICE,
            )
        return await self.get_document(document_id, user_id)

    async def get_document(self, document_id: UUID, user_id: str) -> DocEditorV2DocumentResponse:
        """Return one readable unified_content document with V2 capabilities."""

        row = await self._fetch_readable_row(document_id, user_id)
        return self._response_from_row(row, user_id)

    async def update_document(
        self,
        document_id: UUID,
        user_id: str,
        request: DocEditorV2UpdateRequest,
    ) -> DocEditorV2DocumentResponse:
        """Save a V2-owned document with optimistic version checking."""

        current_row = await self._fetch_readable_row(document_id, user_id)
        if str(current_row["user_id"]) != str(user_id):
            raise PermissionError("Only the owner can update this document")
        if not self._is_v2_managed_row(current_row):
            raise DocumentEditorV2UnsupportedError("document_not_managed_by_doc_editor_v2")

        current_document = self._response_from_row(current_row, user_id)
        projection = self._projection_from_update(request, current_document)
        metadata = self._metadata_for_projection(projection, self._metadata_from_row(current_row))

        update_fields: list[str] = [
            "metadata = $1::jsonb",
            "extracted_text = $2",
            "mime_type = $3",
            "word_count = $4",
            "character_count = $5",
            "file_data = $6",
            "file_size = $7",
            "file_hash = $8",
            "source_service = $9",
            "updated_by = $10::uuid",
            "updated_at = NOW()",
            "version = COALESCE(version, 0) + 1",
        ]
        params: list[Any] = [
            json.dumps(metadata),
            projection.plain_text,
            projection.mime_type,
            projection.word_count,
            projection.character_count,
            projection.file_data,
            len(projection.file_data),
            projection.file_hash,
            DOC_EDITOR_V2_SOURCE_SERVICE,
            user_id,
        ]
        if request.title is not None:
            update_fields.extend(["name = $11", "title = $11", "original_filename = $11"])
            params.append(request.title)
        if request.tags is not None:
            update_fields.append(f"tags = ${len(params) + 1}")
            params.append(request.tags)

        id_param = len(params) + 1
        params.append(document_id)
        user_param = len(params) + 1
        params.append(user_id)
        where_sql = f"WHERE id = ${id_param} AND (user_id)::text = ${user_param} AND deleted_at IS NULL"
        if not request.force_save:
            expected_param = len(params) + 1
            params.append(request.expected_version)
            where_sql = f"{where_sql} AND version = ${expected_param}"

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

        if row is None and not request.force_save:
            server_document = await self.get_document(document_id, user_id)
            raise DocumentEditorV2VersionConflictError(
                expected_version=request.expected_version,
                current_version=server_document.version,
                server_document=server_document,
            )
        if row is None:
            raise PermissionError("Only the owner can update this document")
        return await self.get_document(document_id, user_id)

    async def get_draft(self, document_id: UUID, user_id: str) -> DocEditorV2DraftResponse:
        """Return the stored server draft, if any."""

        row = await self._fetch_readable_row(document_id, user_id)
        metadata = self._metadata_from_row(row)
        draft = self._v2_metadata(metadata).get("draft")
        if not isinstance(draft, dict):
            return DocEditorV2DraftResponse(
                document_id=document_id,
                status="empty",
                base_document_version=int(row["version"] or 0),
                draft_version=0,
            )
        return DocEditorV2DraftResponse(
            document_id=document_id,
            status="stored",
            base_document_version=int(draft.get("base_document_version") or 0),
            draft_version=int(draft.get("draft_version") or 0),
            title=str(draft.get("title") or "") or None,
            editor_format=self._editor_format_from_value(draft.get("editor_format")),
            editor_json=draft.get("editor_json") if isinstance(draft.get("editor_json"), dict) else None,
            content_html=str(draft.get("content_html") or ""),
            content_markdown=str(draft.get("content_markdown") or ""),
            plain_text=str(draft.get("plain_text") or ""),
            source_session_id=str(draft.get("source_session_id") or "") or None,
            updated_at=self._datetime_from_metadata(draft.get("updated_at")),
        )

    async def put_draft(
        self,
        document_id: UUID,
        user_id: str,
        request: DocEditorV2DraftRequest,
    ) -> DocEditorV2DraftResponse:
        """Persist a server draft without changing canonical document content."""

        row = await self._fetch_readable_row(document_id, user_id)
        if not self._row_can_edit(row, user_id):
            raise PermissionError("No permission to write draft")
        current = self._response_from_row(row, user_id)
        projection = self._projection_from_draft(request, current)
        metadata = self._metadata_from_row(row)
        v2_meta = self._v2_metadata(metadata)
        raw_previous = v2_meta.get("draft")
        previous: dict[str, Any] = raw_previous if isinstance(raw_previous, dict) else {}
        draft_version = (
            request.draft_version if request.draft_version is not None else int(previous.get("draft_version") or 0) + 1
        )
        now = datetime.now(UTC)
        v2_meta["draft"] = {
            "base_document_version": request.base_document_version,
            "draft_version": draft_version,
            "title": request.title or current.title,
            "editor_format": projection.editor_format.value,
            "editor_json": projection.editor_json,
            "content_html": projection.content_html,
            "content_markdown": projection.content_markdown,
            "plain_text": projection.plain_text,
            "source_session_id": request.source_session_id,
            "updated_by": user_id,
            "updated_at": now.isoformat(),
        }
        await self._save_metadata(document_id, metadata)
        return DocEditorV2DraftResponse(
            document_id=document_id,
            status="stored",
            base_document_version=request.base_document_version,
            draft_version=draft_version,
            title=request.title or current.title,
            editor_format=projection.editor_format,
            editor_json=projection.editor_json,
            content_html=projection.content_html,
            content_markdown=projection.content_markdown,
            plain_text=projection.plain_text,
            source_session_id=request.source_session_id,
            updated_at=now,
        )

    async def delete_draft(self, document_id: UUID, user_id: str) -> DocEditorV2DraftResponse:
        """Delete the stored server draft metadata."""

        row = await self._fetch_readable_row(document_id, user_id)
        if not self._row_can_edit(row, user_id):
            raise PermissionError("No permission to delete draft")
        metadata = self._metadata_from_row(row)
        v2_meta = self._v2_metadata(metadata)
        previous = v2_meta.pop("draft", None)
        await self._save_metadata(document_id, metadata)
        return DocEditorV2DraftResponse(
            document_id=document_id,
            status="deleted",
            base_document_version=int(row["version"] or 0),
            draft_version=int(previous.get("draft_version") or 0) if isinstance(previous, dict) else 0,
        )

    async def import_document(self, user_id: str, request: DocEditorV2ImportRequest) -> DocEditorV2ImportResponse:
        """Import a file/body into a V2-owned editable document."""

        source_format = request.source_format or self._source_format_from_filename(request.filename, request.mime_type)
        raw_text, warnings = await self._import_text_from_request(request, source_format)
        create_request = DocEditorV2CreateRequest(
            title=request.title or request.filename,
            plain_text=raw_text
            if source_format not in {DocEditorV2SourceFormat.HTML, DocEditorV2SourceFormat.MARKDOWN}
            else None,
            content_html=raw_text if source_format == DocEditorV2SourceFormat.HTML else None,
            content_markdown=raw_text if source_format == DocEditorV2SourceFormat.MARKDOWN else None,
            source_format=source_format,
            tags=request.tags,
        )
        document = await self.create_document(user_id, create_request)
        if warnings:
            row = await self._fetch_readable_row(document.document_id, user_id)
            metadata = self._metadata_from_row(row)
            metadata["parse_warnings"] = [*document.parse_warnings, *warnings]
            await self._save_metadata(document.document_id, metadata)
            document = await self.get_document(document.document_id, user_id)
        return DocEditorV2ImportResponse(document=document, parse_warnings=document.parse_warnings)

    async def export_document(
        self,
        document_id: UUID,
        user_id: str,
        request: DocEditorV2ExportRequest,
    ) -> DocEditorV2ExportResponse:
        """Export a readable document as encoded bytes."""

        document = await self.get_document(document_id, user_id)
        content, mime_type, warnings = self._export_content(document, request.export_format)
        return DocEditorV2ExportResponse(
            document_id=document_id,
            export_format=request.export_format,
            filename=f"{document.title}.{request.export_format.value}",
            mime_type=mime_type,
            content_base64=base64.b64encode(content.encode("utf-8")).decode("ascii"),
            warnings=warnings,
        )

    async def get_structure(self, document_id: UUID, user_id: str) -> DocEditorV2StructureResponse:
        """Return a backend-derived outline and short summary."""

        document = await self.get_document(document_id, user_id)
        items = self._structure_items(document)
        summary = document.plain_text.strip().replace("\n", " ")[:280]
        return DocEditorV2StructureResponse(
            document_id=document_id,
            version=document.version,
            items=items,
            summary=summary,
        )

    async def create_ewa_suggestion(
        self,
        document_id: UUID,
        user_id: str,
        request: DocEditorV2EwaSuggestRequest,
    ) -> DocEditorV2SuggestionResponse:
        """Store an EWA suggestion without mutating the document."""

        row = await self._fetch_readable_row(document_id, user_id)
        document = self._response_from_row(row, user_id)
        if not document.capabilities.can_apply_ewa:
            raise PermissionError("No permission to request EWA document suggestions")
        context_packet = self._build_ewa_context_packet(document, request)
        suggestion = self._suggestion_from_request(document, user_id, request, context_packet)
        metadata = self._metadata_from_row(row)
        v2_meta = self._v2_metadata(metadata)
        suggestions = v2_meta.setdefault("suggestions", [])
        if not isinstance(suggestions, list):
            suggestions = []
            v2_meta["suggestions"] = suggestions
        suggestions.append(suggestion.model_dump(mode="json"))
        await self._save_metadata(document_id, metadata)
        return suggestion

    async def apply_ewa_suggestion(
        self,
        document_id: UUID,
        suggestion_id: str,
        user_id: str,
        request: DocEditorV2SuggestionApplyRequest,
    ) -> DocEditorV2SuggestionApplyResponse:
        """Apply one approved EWA suggestion with normal version checks."""

        row = await self._fetch_readable_row(document_id, user_id)
        metadata = self._metadata_from_row(row)
        suggestion = self._find_suggestion(metadata, suggestion_id)
        if suggestion.status != DocEditorV2SuggestionStatus.NEEDS_APPROVAL:
            raise ValueError("Suggestion is not pending approval")
        if suggestion.base_document_version != request.expected_version and not request.force_save:
            raise DocumentEditorV2VersionConflictError(
                expected_version=request.expected_version,
                current_version=int(row["version"] or 0),
                server_document=self._response_from_row(row, user_id),
            )
        document = self._response_from_row(row, user_id)
        new_plain_text = self._apply_suggestion_to_plain_text(document.plain_text, suggestion)
        updated_document = await self.update_document(
            document_id,
            user_id,
            DocEditorV2UpdateRequest(
                expected_version=request.expected_version,
                force_save=request.force_save,
                plain_text=new_plain_text,
                source_format=DocEditorV2SourceFormat.TEXT,
            ),
        )
        applied_at = datetime.now(UTC)
        updated_suggestion = suggestion.model_copy(
            update={
                "status": DocEditorV2SuggestionStatus.APPLIED,
                "applied_at": applied_at,
                "applied_by": user_id,
            }
        )
        updated_metadata = self._metadata_from_row(await self._fetch_readable_row(document_id, user_id))
        self._replace_suggestion(updated_metadata, updated_suggestion)
        v2_meta = self._v2_metadata(updated_metadata)
        audit = v2_meta.setdefault("suggestion_audit", [])
        if isinstance(audit, list):
            audit.append(
                {
                    "suggestion_id": suggestion_id,
                    "action": "apply",
                    "applied_by": user_id,
                    "applied_at": applied_at.isoformat(),
                    "base_document_version": request.expected_version,
                    "result_document_version": updated_document.version,
                }
            )
        await self._save_metadata(document_id, updated_metadata)
        return DocEditorV2SuggestionApplyResponse(suggestion=updated_suggestion, document=updated_document)

    async def get_collaboration_state(
        self,
        document_id: UUID,
        user_id: str,
    ) -> DocEditorV2CollaborationStateResponse:
        """Return collaboration room metadata and participants known to the backend."""

        row = await self._fetch_readable_row(document_id, user_id)
        metadata = self._metadata_from_row(row)
        v2_meta = self._v2_metadata(metadata)
        raw_collab = v2_meta.get("collaboration")
        collab: dict[str, Any] = raw_collab if isinstance(raw_collab, dict) else {}
        participants = self._collaboration_participants(row, user_id)
        return DocEditorV2CollaborationStateResponse(
            document_id=document_id,
            room_id=f"doc-editor-v2:{document_id}",
            participants=participants,
            snapshot_version=int(collab.get("snapshot_version") or 0),
            last_snapshot_at=self._datetime_from_metadata(collab.get("last_snapshot_at")),
        )

    async def put_collaboration_snapshot(
        self,
        document_id: UUID,
        user_id: str,
        request: DocEditorV2CollaborationSnapshotRequest,
    ) -> DocEditorV2CollaborationSnapshotResponse:
        """Persist a compact collaboration snapshot in metadata for reconnect/cold start."""

        row = await self._fetch_readable_row(document_id, user_id)
        if not self._row_can_edit(row, user_id):
            raise PermissionError("No permission to persist collaboration snapshot")
        metadata = self._metadata_from_row(row)
        v2_meta = self._v2_metadata(metadata)
        raw_collab = v2_meta.get("collaboration")
        collab: dict[str, Any] = raw_collab if isinstance(raw_collab, dict) else {}
        snapshot_version = int(collab.get("snapshot_version") or 0) + 1
        now = datetime.now(UTC)
        v2_meta["collaboration"] = {
            "snapshot_version": snapshot_version,
            "last_snapshot_at": now.isoformat(),
            "base_document_version": request.base_document_version,
            "snapshot_base64": request.snapshot_base64,
            "awareness": request.awareness,
            "source_session_id": request.source_session_id,
            "updated_by": user_id,
        }
        await self._save_metadata(document_id, metadata)
        return DocEditorV2CollaborationSnapshotResponse(
            document_id=document_id,
            snapshot_version=snapshot_version,
            last_snapshot_at=now,
        )

    async def _fetch_readable_row(self, document_id: UUID, user_id: str) -> asyncpg.Record:
        async with self.db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT
                    uc.id, uc.user_id, uc.name, uc.title, uc.content_type, uc.mime_type, uc.tags,
                    uc.visibility, uc.shared_with_user_ids, uc.metadata, uc.extracted_text,
                    uc.word_count, uc.character_count, uc.version, uc.created_at, uc.updated_at,
                    uc.source_service, uc.deleted_at,
                    (
                        SELECT cs.permission
                        FROM content_shares cs
                        WHERE cs.content_id = uc.id
                          AND cs.shared_with_user_id = $2
                          AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
                        LIMIT 1
                    ) AS share_permission,
                    (
                        SELECT i.allow_collaborators_save
                        FROM doc_collaboration_invites i
                        WHERE i.document_id = uc.id
                          AND i.to_user_id = $2::uuid
                          AND i.status = 'accepted'
                        LIMIT 1
                    ) AS invite_can_save
                FROM unified_content uc
                WHERE uc.id = $1 AND uc.deleted_at IS NULL
                """,
                document_id,
                user_id,
            )
            if row is None:
                raise ValueError(f"Document {document_id} not found")
            if str(row["content_type"]) != "document":
                raise DocumentEditorV2UnsupportedError("content_is_not_a_document")
            if self._row_is_readable(row, user_id):
                return row
        raise PermissionError("No permission to read this document")

    @staticmethod
    def _row_is_readable(row: asyncpg.Record, user_id: str) -> bool:
        if str(row["user_id"]) == str(user_id):
            return True
        if str(row["visibility"] or "") == "public":
            return True
        if str(user_id) in {str(item) for item in (row["shared_with_user_ids"] or [])}:
            return True
        return bool(row["share_permission"] or row["invite_can_save"] is not None)

    @staticmethod
    def _projection_from_create(request: DocEditorV2CreateRequest) -> _Projection:
        return DocumentEditorV2Service._normalize_projection(
            title=request.title,
            editor_format=request.editor_format,
            editor_json=request.editor_json,
            content_html=request.content_html,
            content_markdown=request.content_markdown,
            plain_text=request.plain_text,
            source_format=request.source_format,
        )

    @staticmethod
    def _projection_from_update(request: DocEditorV2UpdateRequest, current: DocEditorV2DocumentResponse) -> _Projection:
        if (
            request.content_html is None
            and request.content_markdown is None
            and request.plain_text is None
            and request.source_format is None
        ):
            return DocumentEditorV2Service._projection_from_response(
                current,
                editor_format=request.editor_format or current.editor_format,
                editor_json=request.editor_json if request.editor_json is not None else current.editor_json,
            )
        return DocumentEditorV2Service._normalize_projection(
            title=request.title or current.title,
            editor_format=request.editor_format or current.editor_format,
            editor_json=request.editor_json if request.editor_json is not None else current.editor_json,
            content_html=request.content_html,
            content_markdown=request.content_markdown,
            plain_text=request.plain_text,
            source_format=request.source_format or current.source_format,
        )

    @staticmethod
    def _projection_from_draft(request: DocEditorV2DraftRequest, current: DocEditorV2DocumentResponse) -> _Projection:
        if request.content_html is None and request.content_markdown is None and request.plain_text is None:
            return DocumentEditorV2Service._projection_from_response(
                current,
                editor_format=request.editor_format or current.editor_format,
                editor_json=request.editor_json if request.editor_json is not None else current.editor_json,
            )
        return DocumentEditorV2Service._normalize_projection(
            title=request.title or current.title,
            editor_format=request.editor_format or current.editor_format,
            editor_json=request.editor_json if request.editor_json is not None else current.editor_json,
            content_html=request.content_html,
            content_markdown=request.content_markdown,
            plain_text=request.plain_text,
            source_format=current.source_format,
        )

    @staticmethod
    def _projection_from_response(
        response: DocEditorV2DocumentResponse,
        *,
        editor_format: DocEditorV2EditorFormat,
        editor_json: dict[str, Any] | None,
    ) -> _Projection:
        file_data = DocumentEditorV2Service._file_data_for_source(
            source_format=response.source_format,
            content_html=response.content_html,
            content_markdown=response.content_markdown,
            plain_text=response.plain_text,
        )
        return _Projection(
            editor_format=editor_format,
            editor_json=editor_json,
            content_html=response.content_html,
            content_markdown=response.content_markdown,
            plain_text=response.plain_text,
            source_format=response.source_format,
            parse_warnings=list(response.parse_warnings),
            mime_type=DocumentEditorV2Service._mime_type_for_source(response.source_format),
            file_data=file_data,
            file_hash=hashlib.sha256(file_data).hexdigest(),
            word_count=len(response.plain_text.split()) if response.plain_text else 0,
            character_count=len(response.plain_text or ""),
        )

    @staticmethod
    def _normalize_projection(
        *,
        title: str,
        editor_format: DocEditorV2EditorFormat,
        editor_json: dict[str, Any] | None,
        content_html: str | None,
        content_markdown: str | None,
        plain_text: str | None,
        source_format: DocEditorV2SourceFormat | None,
    ) -> _Projection:
        if content_markdown is not None:
            seed = content_markdown
            preferred_format = DocEditorV2SourceFormat.MARKDOWN
        elif content_html is not None:
            seed = content_html
            preferred_format = DocEditorV2SourceFormat.HTML
        else:
            seed = plain_text or ""
            preferred_format = DocEditorV2SourceFormat.TEXT
        normalized = normalize_text_document(
            seed,
            filename=title,
            mime_type=DocumentEditorV2Service._mime_type_for_source(preferred_format),
            preferred_format=preferred_format.value,
        )
        resolved_source_format = source_format or preferred_format
        file_data = DocumentEditorV2Service._file_data_for_source(
            source_format=resolved_source_format,
            content_html=normalized.rendered_html,
            content_markdown=normalized.markdown,
            plain_text=normalized.plain_text,
        )
        return _Projection(
            editor_format=editor_format,
            editor_json=editor_json,
            content_html=normalized.rendered_html,
            content_markdown=normalized.markdown,
            plain_text=normalized.plain_text,
            source_format=resolved_source_format,
            parse_warnings=list(normalized.warnings),
            mime_type=DocumentEditorV2Service._mime_type_for_source(resolved_source_format),
            file_data=file_data,
            file_hash=hashlib.sha256(file_data).hexdigest(),
            word_count=len(normalized.plain_text.split()) if normalized.plain_text else 0,
            character_count=len(normalized.plain_text or ""),
        )

    @staticmethod
    def _file_data_for_source(
        *,
        source_format: DocEditorV2SourceFormat,
        content_html: str,
        content_markdown: str,
        plain_text: str,
    ) -> bytes:
        if source_format == DocEditorV2SourceFormat.MARKDOWN:
            text = content_markdown
        elif source_format == DocEditorV2SourceFormat.HTML:
            text = content_html
        else:
            text = plain_text
        return text.encode("utf-8")

    @staticmethod
    def _metadata_for_projection(
        projection: _Projection,
        base_metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        metadata = dict(base_metadata or {})
        v2_meta = DocumentEditorV2Service._v2_metadata(metadata)
        v2_meta.update(
            {
                "version": DOC_EDITOR_V2_METADATA_VERSION,
                "editor_format": projection.editor_format.value,
                "source_format": projection.source_format.value,
                "updated_at": datetime.now(UTC).isoformat(),
            }
        )
        metadata.update(
            {
                "document_editor_version": DOC_EDITOR_V2_METADATA_VERSION,
                "editor_format": projection.editor_format.value,
                "editor_json": projection.editor_json,
                "rendered_html": projection.content_html,
                "content_html": projection.content_html,
                "content_markdown": projection.content_markdown,
                "plain_text": projection.plain_text,
                "source_format": projection.source_format.value,
                "parse_warnings": projection.parse_warnings,
                "content_type": projection.source_format.value,
            }
        )
        return metadata

    @staticmethod
    def _v2_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
        raw = metadata.get(DOC_EDITOR_V2_METADATA_KEY)
        if isinstance(raw, dict):
            return raw
        metadata[DOC_EDITOR_V2_METADATA_KEY] = {}
        return metadata[DOC_EDITOR_V2_METADATA_KEY]

    @staticmethod
    def _metadata_from_row(row: asyncpg.Record) -> dict[str, Any]:
        raw = row["metadata"]
        if isinstance(raw, dict):
            return dict(raw)
        if isinstance(raw, str) and raw.strip():
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                return {}
            return parsed if isinstance(parsed, dict) else {}
        return {}

    @staticmethod
    def _response_from_row(row: asyncpg.Record, requester_user_id: str) -> DocEditorV2DocumentResponse:
        metadata = DocumentEditorV2Service._metadata_from_row(row)
        source_format = DocumentEditorV2Service._source_format_from_metadata(metadata, row["mime_type"])
        editor_format = DocumentEditorV2Service._editor_format_from_metadata(metadata)
        title = str(row["title"] or row["name"] or "Untitled document")
        plain_text = str(metadata.get("plain_text") or row["extracted_text"] or "")
        content_html = str(metadata.get("content_html") or metadata.get("rendered_html") or "")
        content_markdown = str(metadata.get("content_markdown") or "")
        if not (content_html and content_markdown):
            normalized = normalize_text_document(
                content_markdown or content_html or plain_text,
                filename=title,
                mime_type=str(row["mime_type"] or DocumentEditorV2Service._mime_type_for_source(source_format)),
                preferred_format=source_format.value,
            )
            content_html = content_html or normalized.rendered_html
            content_markdown = content_markdown or normalized.markdown
            plain_text = plain_text or normalized.plain_text
        parse_warnings_raw = metadata.get("parse_warnings")
        parse_warnings = (
            [str(item).strip() for item in parse_warnings_raw if str(item).strip()]
            if isinstance(parse_warnings_raw, list)
            else []
        )
        is_owner = str(row["user_id"]) == str(requester_user_id)
        is_v2_managed = DocumentEditorV2Service._is_v2_managed_row(row)
        can_edit = DocumentEditorV2Service._row_can_edit(row, requester_user_id)
        can_comment = DocumentEditorV2Service._row_can_comment(row, requester_user_id)
        return DocEditorV2DocumentResponse(
            document_id=row["id"],
            owner_user_id=str(row["user_id"]),
            title=title,
            editor_format=editor_format,
            editor_json=metadata.get("editor_json") if isinstance(metadata.get("editor_json"), dict) else None,
            content_html=content_html,
            content_markdown=content_markdown,
            plain_text=plain_text,
            source_format=source_format,
            parse_warnings=parse_warnings,
            version=int(row["version"] or 0),
            capabilities=DocEditorV2Capabilities(
                can_read=True,
                can_edit=can_edit,
                can_comment=can_comment,
                can_collaborate=is_v2_managed and (is_owner or can_edit),
                can_apply_ewa=can_edit,
                can_export=True,
            ),
            tags=list(row["tags"] or []),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    @staticmethod
    def _source_format_from_metadata(metadata: dict[str, Any], mime_type: str | None) -> DocEditorV2SourceFormat:
        raw = str(metadata.get("source_format") or metadata.get("content_type") or "").strip().lower()
        if not raw:
            mime = str(mime_type or "").lower()
            if "markdown" in mime:
                raw = "markdown"
            elif "html" in mime:
                raw = "html"
            else:
                raw = "text"
        try:
            return DocEditorV2SourceFormat(raw)
        except ValueError:
            return DocEditorV2SourceFormat.TEXT

    @staticmethod
    def _editor_format_from_metadata(metadata: dict[str, Any]) -> DocEditorV2EditorFormat:
        raw = str(metadata.get("editor_format") or "").strip().lower()
        try:
            return DocEditorV2EditorFormat(raw)
        except ValueError:
            return DocEditorV2EditorFormat.MARKDOWN

    @staticmethod
    def _mime_type_for_source(source_format: DocEditorV2SourceFormat) -> str:
        if source_format == DocEditorV2SourceFormat.HTML:
            return "text/html"
        if source_format == DocEditorV2SourceFormat.MARKDOWN:
            return "text/markdown"
        return "text/plain"

    @staticmethod
    def _is_v2_managed_row(row: asyncpg.Record) -> bool:
        metadata = DocumentEditorV2Service._metadata_from_row(row)
        return (
            str(row["source_service"] or "") == DOC_EDITOR_V2_SOURCE_SERVICE
            or str(metadata.get("document_editor_version") or "") == DOC_EDITOR_V2_METADATA_VERSION
        )

    @staticmethod
    def _row_can_edit(row: asyncpg.Record, user_id: str) -> bool:
        if not DocumentEditorV2Service._is_v2_managed_row(row):
            return False
        if str(row["user_id"]) == str(user_id):
            return True
        share_permission = str(row["share_permission"] or "").lower()
        if share_permission in {"edit", "admin"}:
            return True
        return bool(row["invite_can_save"])

    @staticmethod
    def _row_can_comment(row: asyncpg.Record, user_id: str) -> bool:
        if DocumentEditorV2Service._row_can_edit(row, user_id):
            return True
        share_permission = str(row["share_permission"] or "").lower()
        return share_permission in {"comment", "review", "edit", "admin"} or row["invite_can_save"] is not None

    async def _save_metadata(self, document_id: UUID, metadata: dict[str, Any]) -> None:
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                "UPDATE unified_content SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2",
                json.dumps(metadata),
                document_id,
            )

    @staticmethod
    def _datetime_from_metadata(value: object) -> datetime | None:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str) and value.strip():
            try:
                return datetime.fromisoformat(value)
            except ValueError:
                return None
        return None

    @staticmethod
    def _editor_format_from_value(value: object) -> DocEditorV2EditorFormat | None:
        if value is None:
            return None
        try:
            return DocEditorV2EditorFormat(str(value))
        except ValueError:
            return None

    @staticmethod
    def _source_format_from_filename(filename: str, mime_type: str | None) -> DocEditorV2SourceFormat:
        suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if suffix in {"md", "markdown"}:
            return DocEditorV2SourceFormat.MARKDOWN
        if suffix in {"html", "htm"} or str(mime_type or "").lower() == "text/html":
            return DocEditorV2SourceFormat.HTML
        if suffix in {"docx", "doc", "odt", "rtf", "pdf"}:
            return DocEditorV2SourceFormat(suffix)
        return DocEditorV2SourceFormat.TEXT

    async def _import_text_from_request(
        self,
        request: DocEditorV2ImportRequest,
        source_format: DocEditorV2SourceFormat,
    ) -> tuple[str, list[str]]:
        warnings: list[str] = []
        if request.content_text is not None:
            raw_text = request.content_text
        elif request.content_base64:
            try:
                raw_bytes = base64.b64decode(request.content_base64, validate=True)
            except ValueError:
                raise ValueError("Invalid base64 import payload") from None
            if source_format in {
                DocEditorV2SourceFormat.DOCX,
                DocEditorV2SourceFormat.DOC,
                DocEditorV2SourceFormat.ODT,
                DocEditorV2SourceFormat.RTF,
                DocEditorV2SourceFormat.PDF,
            }:
                raw_text, stack4_warnings = await self._extract_text_via_stack4(
                    raw_bytes, request.filename, source_format
                )
                warnings.extend(stack4_warnings)
            else:
                raw_text = raw_bytes.decode("utf-8", errors="replace")
        else:
            raw_text = ""
            warnings.append("empty_import_body")

        if not raw_text.strip() and source_format in {
            DocEditorV2SourceFormat.DOCX,
            DocEditorV2SourceFormat.DOC,
            DocEditorV2SourceFormat.ODT,
            DocEditorV2SourceFormat.RTF,
            DocEditorV2SourceFormat.PDF,
        }:
            warnings.append(f"{source_format.value}_stack4_empty_extraction")
            raw_text = f"Imported {request.filename} as an editable placeholder. Stack4 extraction returned no text."
        return raw_text, warnings

    @staticmethod
    async def _extract_text_via_stack4(
        raw_bytes: bytes,
        filename: str,
        source_format: DocEditorV2SourceFormat,
    ) -> tuple[str, list[str]]:
        from api.services.stack4.document_gateway import (
            Stack4GatewayError,
            Stack4ServiceUnavailable,
            get_stack4_document_gateway,
        )

        warnings: list[str] = []
        gateway = get_stack4_document_gateway()
        try:
            if source_format == DocEditorV2SourceFormat.PDF:
                text = await gateway.ocr_pdf_to_text(raw_bytes, filename)
            elif source_format == DocEditorV2SourceFormat.HTML:
                text = await gateway.extract_plain(raw_bytes, filename)
            else:
                text = await gateway.extract_plain(raw_bytes, filename)
            return text.strip(), warnings
        except Stack4ServiceUnavailable as exc:
            warnings.append(f"{source_format.value}_stack4_unavailable")
            logger.warning("doc_editor_v2 stack4 unavailable for %s: %s", filename, exc)
        except Stack4GatewayError as exc:
            warnings.append(f"{source_format.value}_stack4_extraction_failed")
            logger.warning("doc_editor_v2 stack4 extraction failed for %s: %s", filename, exc)
        return "", warnings

    @staticmethod
    def _export_content(
        document: DocEditorV2DocumentResponse,
        export_format: DocEditorV2ExportFormat,
    ) -> tuple[str, str, list[str]]:
        if export_format == DocEditorV2ExportFormat.HTML:
            return document.content_html, "text/html", []
        if export_format == DocEditorV2ExportFormat.MARKDOWN:
            return document.content_markdown, "text/markdown", []
        if export_format == DocEditorV2ExportFormat.TEXT:
            return document.plain_text, "text/plain", []
        if export_format == DocEditorV2ExportFormat.PDF:
            return document.plain_text, "application/pdf", ["pdf_export_adapter_pending"]
        return (
            document.content_html or document.content_markdown or document.plain_text,
            ("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            ["docx_export_adapter_pending"],
        )

    @staticmethod
    def _strip_html(value: str) -> str:
        return re.sub(r"<[^>]+>", "", value).strip()

    @staticmethod
    def _structure_items(document: DocEditorV2DocumentResponse) -> list[DocEditorV2StructureItem]:
        items: list[DocEditorV2StructureItem] = []
        for idx, match in enumerate(_HEADING_HTML_RE.finditer(document.content_html or "")):
            title = DocumentEditorV2Service._strip_html(match.group(2)) or f"Section {idx + 1}"
            items.append(
                DocEditorV2StructureItem(
                    id=f"h-{idx + 1}",
                    title=title,
                    level=int(match.group(1)),
                    start_offset=match.start(),
                    end_offset=match.end(),
                )
            )
        if items:
            return items
        for idx, match in enumerate(_HEADING_MD_RE.finditer(document.content_markdown or "")):
            items.append(
                DocEditorV2StructureItem(
                    id=f"md-{idx + 1}",
                    title=match.group(2).strip(),
                    level=len(match.group(1)),
                    start_offset=match.start(),
                    end_offset=match.end(),
                )
            )
        if items:
            return items
        title = document.title.strip() or "Document"
        return [
            DocEditorV2StructureItem(
                id="document",
                title=title,
                level=1,
                start_offset=0,
                end_offset=len(document.plain_text or ""),
            )
        ]

    def _build_ewa_context_packet(
        self,
        document: DocEditorV2DocumentResponse,
        request: DocEditorV2EwaSuggestRequest,
    ) -> DocEditorV2EwaContextPacket:
        selected_text = request.selected_text or self._selected_text(document.plain_text, request.selected_range)
        return DocEditorV2EwaContextPacket(
            document_id=document.document_id,
            title=document.title,
            version=document.version,
            capabilities=document.capabilities,
            selected_range=request.selected_range,
            selected_text=selected_text,
            nearby_excerpt=self._nearby_excerpt(document.plain_text, request.selected_range),
            outline=self._structure_items(document),
            source_format=document.source_format,
            parse_warnings=document.parse_warnings,
        )

    @staticmethod
    def _selected_text(plain_text: str, selected_range: DocEditorV2SelectionRange | None) -> str:
        if selected_range is None:
            return ""
        return plain_text[selected_range.start : selected_range.end]

    @staticmethod
    def _nearby_excerpt(plain_text: str, selected_range: DocEditorV2SelectionRange | None) -> str:
        if selected_range is None:
            return plain_text[:1000]
        start = max(0, selected_range.start - 400)
        end = min(len(plain_text), selected_range.end + 400)
        return plain_text[start:end]

    @staticmethod
    def _suggestion_from_request(
        document: DocEditorV2DocumentResponse,
        user_id: str,
        request: DocEditorV2EwaSuggestRequest,
        context_packet: DocEditorV2EwaContextPacket,
    ) -> DocEditorV2SuggestionResponse:
        title_by_action = {
            DocEditorV2EwaAction.DISCUSS: "EWA discussion note",
            DocEditorV2EwaAction.REWRITE_SELECTION: "Rewrite selected text",
            DocEditorV2EwaAction.SUMMARIZE_SECTION: "Summarize section",
            DocEditorV2EwaAction.TRANSLATE_SELECTION: "Translate selection",
            DocEditorV2EwaAction.MAKE_OUTLINE: "Outline proposal",
            DocEditorV2EwaAction.CREATE_COMMENT: "Review comment",
        }
        selected = context_packet.selected_text.strip()
        if request.action == DocEditorV2EwaAction.REWRITE_SELECTION:
            replacement = f"{request.instruction.strip()}: {selected or document.title}"
            comment = None
        elif request.action == DocEditorV2EwaAction.TRANSLATE_SELECTION:
            target = f" to {request.language}" if request.language else ""
            replacement = f"Translate{target}: {selected}"
            comment = None
        elif request.action == DocEditorV2EwaAction.MAKE_OUTLINE:
            replacement = "\n".join(f"- {item.title}" for item in context_packet.outline)
            comment = None
        else:
            replacement = None
            comment = request.instruction.strip()
        return DocEditorV2SuggestionResponse(
            id=str(uuid4()),
            document_id=document.document_id,
            action=request.action,
            status=DocEditorV2SuggestionStatus.NEEDS_APPROVAL,
            title=title_by_action[request.action],
            explanation=request.instruction.strip(),
            replacement_text=replacement,
            comment_text=comment,
            selected_range=request.selected_range,
            base_document_version=document.version,
            context_packet=context_packet,
            created_at=datetime.now(UTC),
            created_by=user_id,
        )

    @staticmethod
    def _find_suggestion(metadata: dict[str, Any], suggestion_id: str) -> DocEditorV2SuggestionResponse:
        raw_suggestions = DocumentEditorV2Service._v2_metadata(metadata).get("suggestions")
        if not isinstance(raw_suggestions, list):
            raise ValueError("Suggestion not found")
        for raw in raw_suggestions:
            if isinstance(raw, dict) and str(raw.get("id")) == suggestion_id:
                return DocEditorV2SuggestionResponse.model_validate(raw)
        raise ValueError("Suggestion not found")

    @staticmethod
    def _replace_suggestion(metadata: dict[str, Any], suggestion: DocEditorV2SuggestionResponse) -> None:
        v2_meta = DocumentEditorV2Service._v2_metadata(metadata)
        raw_suggestions = v2_meta.get("suggestions")
        if not isinstance(raw_suggestions, list):
            v2_meta["suggestions"] = [suggestion.model_dump(mode="json")]
            return
        v2_meta["suggestions"] = [
            suggestion.model_dump(mode="json") if isinstance(raw, dict) and str(raw.get("id")) == suggestion.id else raw
            for raw in raw_suggestions
        ]

    @staticmethod
    def _apply_suggestion_to_plain_text(
        plain_text: str,
        suggestion: DocEditorV2SuggestionResponse,
    ) -> str:
        replacement = suggestion.replacement_text
        if replacement is None:
            note = suggestion.comment_text or suggestion.explanation
            return f"{plain_text.rstrip()}\n\n[EWA note] {note}\n".strip()
        selected_range = suggestion.selected_range
        if selected_range is None:
            return f"{plain_text.rstrip()}\n\n{replacement}\n".strip()
        start = min(selected_range.start, len(plain_text))
        end = min(selected_range.end, len(plain_text))
        return f"{plain_text[:start]}{replacement}{plain_text[end:]}"

    @staticmethod
    def _collaboration_participants(
        row: asyncpg.Record,
        user_id: str,
    ) -> list[DocEditorV2CollaborationParticipant]:
        is_owner = str(row["user_id"]) == str(user_id)
        role = "owner" if is_owner else "editor" if DocumentEditorV2Service._row_can_edit(row, user_id) else "viewer"
        return [
            DocEditorV2CollaborationParticipant(
                user_id=str(row["user_id"]),
                role="owner",
                can_save=True,
                is_active=is_owner,
            ),
            DocEditorV2CollaborationParticipant(
                user_id=str(user_id),
                role=role,
                can_save=DocumentEditorV2Service._row_can_edit(row, user_id),
                is_active=True,
            ),
        ]
