#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared SQL fragments, upload placement helpers, and row normalizers for Unified Content storage modules.
# Invariants:
# - List ACL SQL fragments must stay aligned with ContentStorageService access rules.
# Related:
# - api/services/unified_content/content_storage_service.py
# ---
"""Shared constants and helpers for content storage modules."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from api.gaf_chat.constants import CONTENT_SUBTYPE_GAF_CHAT_VOICE
from api.schemas.unified_content import ContentCreate, ContentType, StorageBackendType
from api.services.unified_content.content_access_policy import PUBLIC_VISIBILITY_EXCLUDES_PROFILE_SQL
from api.utils.content_mime_normalization import normalized_mime_type
from api.utils.ewa_companion_folder import EWA_COMPANION_FOLDER_ITEM_ID
from api.utils.project_desktop_folder import project_desktop_folder_item_id


class ContentVersionConflictError(Exception):
    """Raised when ``expected_version`` does not match the current unified_content row."""

    def __init__(
        self,
        *,
        expected_version: int,
        current_version: int,
        content_id: UUID | None = None,
    ) -> None:
        super().__init__(f"Content version conflict: expected={expected_version}, current={current_version}")
        self.expected_version = expected_version
        self.current_version = current_version
        self.content_id = content_id


def _mime_supports_extracted_text_sync(mime_type: str) -> bool:
    mt = (mime_type or "").strip().lower()
    return mt.startswith("text/") or mt in {"application/json", "application/xml"}


def extracted_text_from_file_data(file_data: bytes, mime_type: str) -> str | None:
    """Decode text payloads so DB versioning trigger sees ``extracted_text`` changes."""
    if not _mime_supports_extracted_text_sync(mime_type):
        return None
    try:
        return file_data.decode("utf-8")
    except UnicodeDecodeError:
        return file_data.decode("utf-8", errors="replace")


def upload_requests_folder_placement(content_data: ContentCreate) -> bool:
    """True when the upload caller explicitly scoped folder or project desktop folder."""
    if content_data.folder_item_id is not None:
        return True
    return bool(content_data.project_id is not None and content_data.apply_project_desktop_folder)


def resolve_upload_folder_item_id(content_data: ContentCreate) -> str | None:
    """Resolve target desktop folder for upload (mirrors create_content INSERT path)."""
    folder_item_id_val = content_data.folder_item_id
    if (
        content_data.project_id is not None
        and content_data.apply_project_desktop_folder
        and not (folder_item_id_val and str(folder_item_id_val).strip())
    ):
        folder_item_id_val = project_desktop_folder_item_id(content_data.project_id)
    if not (folder_item_id_val and str(folder_item_id_val).strip()) and content_data.content_type == ContentType.IMAGE:
        folder_item_id_val = "images"
    if folder_item_id_val is None:
        return None
    stripped = str(folder_item_id_val).strip()
    return stripped or None


def resolve_dedup_folder_relocation(
    content_data: ContentCreate,
    current_folder_item_id: str | None,
) -> str | None:
    """When hash-dedup returns a row in EwaFile, move it per upload intent (default: Documents)."""
    if str(current_folder_item_id or "").strip() != EWA_COMPANION_FOLDER_ITEM_ID:
        return None
    if upload_requests_folder_placement(content_data):
        return resolve_upload_folder_item_id(content_data)
    if content_data.project_id is not None:
        return resolve_upload_folder_item_id(content_data)
    return "documents"


# Скрыть голосовые вложения GAF из списков Content Manager (unified_content.sub_type)
SQL_LIST_EXCLUDE_GAF_CHAT_VOICE = f"(COALESCE(sub_type, '') <> '{CONTENT_SUBTYPE_GAF_CHAT_VOICE}')"

# List/batch: те же поля, что у get_content, без extracted_text (не тянуть большие тексты в ленту).
SQL_UNIFIED_CONTENT_LIST_COLUMNS = """
                id, name, title, content_type, file_size, mime_type,
                thumbnail_path, tags, created_at, updated_at,
                processing_status, visibility, user_id,
                original_filename, description, metadata,
                storage_backend, file_path, shared_with_user_ids,
                file_hash, version, is_public,
                company_id, project_id, friend_visibility,
                folder_item_id,
                sub_type, source_service, source_id, related_content,
                word_count, character_count
"""

# Ещё уже: без metadata, путей хранения, related_content, счётчиков документа (list_profile=compact).
SQL_UNIFIED_CONTENT_LIST_COLUMNS_COMPACT = """
                id, name, content_type, file_size, mime_type,
                thumbnail_path, tags, created_at, updated_at,
                processing_status, visibility, user_id,
                original_filename, description,
                file_hash, folder_item_id,
                company_id, project_id, friend_visibility
"""

_SEARCH_SCOPES = frozenset({"metadata", "content", "hybrid"})

# Те же поля, что в списке, с префиксом uc — для JOIN-запросов (версии, история просмотров).
SQL_UNIFIED_CONTENT_UC_LIST_SELECT = """
                uc.id, uc.name, uc.title, uc.content_type, uc.file_size, uc.mime_type,
                uc.thumbnail_path, uc.tags, uc.created_at, uc.updated_at,
                uc.processing_status, uc.visibility, uc.user_id,
                uc.original_filename, uc.description, uc.metadata,
                uc.storage_backend, uc.file_path, uc.shared_with_user_ids,
                uc.file_hash, uc.version, uc.is_public,
                uc.company_id, uc.project_id, uc.friend_visibility,
                uc.folder_item_id,
                uc.sub_type, uc.source_service, uc.source_id, uc.related_content,
                uc.word_count, uc.character_count
"""


def normalize_row_mime(row_dict: dict[str, Any]) -> None:
    r = row_dict.get("mime_type")
    o = row_dict.get("original_filename")
    rs = r if isinstance(r, str) else None
    os_ = o if isinstance(o, str) else None
    fixed = normalized_mime_type(rs, os_)
    if fixed != rs:
        row_dict["mime_type"] = fixed


def storage_backend_name_for_factory(sb: StorageBackendType | None) -> str:
    """Map DB/storage enum to StorageBackendFactory.get_backend_by_name."""
    if sb is None:
        return "postgresql"
    raw = sb.value if hasattr(sb, "value") else str(sb)
    if raw == "minio":
        return "seaweedfs"
    return raw


LIST_PUBLIC_FROM_OTHERS_EXCLUDES_PROFILE = PUBLIC_VISIBILITY_EXCLUDES_PROFILE_SQL

LIBRARY_REMOVAL_FILTER_SQL = """
        NOT EXISTS (
            SELECT 1 FROM content_user_library_removals r
            WHERE r.content_id = unified_content.id
              AND (r.user_id)::text = $1
        )
"""

SQL_INDEXED_BODY_CORPUS = "TRIM(COALESCE(extracted_text, '')) <> ''"


async def verify_storage_object_after_write(
    backend: Any,
    storage_path: str,
    content_id: UUID,
) -> None:
    """
    Fail closed when blob is not readable immediately after store.

    SeaweedFS filer/S3 metadata can exist without a volume needle; ``stat_object`` (exists)
    is insufficient — prefer ``verify_object_readable`` (1-byte read probe).
    """
    verify = getattr(backend, "verify_object_readable", None)
    if callable(verify):
        readable = await verify(storage_path, content_id)
    else:
        readable = await backend.exists(storage_path, content_id)
    if not readable:
        msg = "Post-upload storage verification failed: object not readable in backend"
        raise RuntimeError(msg)
