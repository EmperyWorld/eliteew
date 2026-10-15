# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shared **main-DB** catalogue + ``ContentStorageService`` helpers for server-first and classic orchestrator doc-create
# (confirmed ``doc_create`` tasks use the same ``create_unified_companion_document`` primitive as server-first autocreate).
# Invariants:
# - ``catalog_pick_owner_row`` / ``make_content_storage_service`` require the **application** asyncpg pool (``DATABASE_URL`` / ``unified_content``), **not** ``EWA_DATABASE_URL``.
# - Exact-name match in EwaFile reuses the existing row via versioned ``replace_file_content`` (no silent second file).
# Related:
# - api/ewa_platform/companion/server_first/v2.py
# - documentation/product/ewa/EWA-COMPANION-FILE-CATALOG.md
# - api/ewa_platform/docs/EWA-COMPANION-PACKAGE-MIGRATION.md
# ---
"""Catalogue resolution and storage service factory for companion storage-first flows."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

import asyncpg

from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    companion_catalog_search_variants,
    companion_content_query_service_optional,
    dedupe_catalog_rows_by_id,
    extract_doc_search_phrase,
    normalize_doc_open_phrase_after_extract,
    pick_content_row_for_doc_open,
)
from api.utils.ewa_companion_folder import EWA_COMPANION_FOLDER_ITEM_ID, companion_list_content_kwargs

_ALLOWED_NEW_DOC_EXT = (".md", ".txt", ".html")


def _fallback_companion_new_filename() -> str:
    stamp = datetime.now().astimezone().strftime("%d.%m.%H.%M")
    return f"file-{stamp}.md"


def sanitize_companion_new_filename(raw: str) -> str:
    """Normalize companion-proposed new document names to md/txt/html only."""

    n = (raw or "").strip().strip("«»\"'")
    if not n:
        return _fallback_companion_new_filename()
    if "." not in n:
        n = f"{n}.md"
    low = n.lower()
    if not any(low.endswith(ext) for ext in _ALLOWED_NEW_DOC_EXT):
        n = f"{n}.md"
    return n[:255]


async def resolve_companion_create_folder_item_id(
    *,
    content_user_id: str,
    task_key: str | None = None,
    folder_label: str | None = None,
) -> str:
    """Ensure per-task folder under EwaFile when ``task_key`` is set; else EwaFile root."""

    key = (task_key or "").strip()
    if not key:
        return EWA_COMPANION_FOLDER_ITEM_ID
    from api.services.ewa_task_folder_service import ensure_ewa_task_folder_for_user

    label = (folder_label or key[:48]).strip() or "Task"
    ensured = await ensure_ewa_task_folder_for_user(
        user_id=content_user_id,
        task_key=key,
        folder_label=label,
    )
    return ensured or EWA_COMPANION_FOLDER_ITEM_ID


def _row_exact_name_match(row: Any, want_casefold: str) -> bool:
    for attr in ("name", "original_filename", "title"):
        cand = getattr(row, attr, None)
        if isinstance(row, dict):
            cand = row.get(attr) if cand is None else cand
        if str(cand or "").strip().casefold() == want_casefold:
            return True
    return False


async def find_owner_ewa_file_by_exact_name(
    *,
    content_user_id: str,
    name: str,
    query_svc: Any | None = None,
) -> Any | None:
    """Return the owner's EwaFile row whose name/title/original_filename matches ``name`` (casefold)."""

    want = (name or "").strip().casefold()
    if not want:
        return None
    uid = (content_user_id or "").strip()
    if not uid:
        return None
    svc = query_svc
    if svc is None:
        svc = await companion_content_query_service_optional()
    if svc is None:
        return None
    search = (name or "").strip()[:120]
    batch, _total = await svc.list_content(
        user_id=uid,
        search_query=search if len(search) >= 2 else None,
        limit=80,
        offset=0,
        list_profile="compact",
        **companion_list_content_kwargs(),
    )
    for row in batch or []:
        if _row_exact_name_match(row, want):
            return row
    if search and len(search) >= 2:
        # Fallback: list recent EwaFile docs without search (name may not hit ES/metadata search).
        batch2, _t2 = await svc.list_content(
            user_id=uid,
            limit=120,
            offset=0,
            list_profile="compact",
            **companion_list_content_kwargs(),
        )
        for row in batch2 or []:
            if _row_exact_name_match(row, want):
                return row
    return None


async def create_unified_companion_document(
    storage: Any,
    *,
    content_user_id: str,
    name: str,
    body: str,
    source_service: str = "ewa_companion",
    metadata_source: str | None = None,
    task_key: str | None = None,
    folder_label: str | None = None,
    folder_item_id: str | None = None,
) -> Any:
    """Create owner document bytes in unified storage (orchestrator ``doc_create`` and server-first autocreate).

    When ``task_key`` is provided, creates/uses ``EwaFile/<task folder>`` and stores the file there.
    If an EwaFile row with the same exact name already exists, reuses that id and writes the new body
    via versioned ``replace_file_content`` (sets ``deduplicated_reused=True`` on the returned Content).
    """

    from api.schemas.unified_content import ContentType, Visibility, build_content_create

    name_s = (name or "").strip() or _fallback_companion_new_filename()
    meta_src = metadata_source if metadata_source is not None else "ewa_companion_task_orchestrator"
    mime = (
        "text/html"
        if name_s.lower().endswith(".html")
        else "text/markdown"
        if name_s.lower().endswith(".md")
        else "text/plain"
    )
    existing = await find_owner_ewa_file_by_exact_name(
        content_user_id=content_user_id,
        name=name_s,
    )
    if existing is not None:
        raw_id = getattr(existing, "id", None)
        if raw_id is not None:
            from uuid import UUID as _UUID

            content_id = raw_id if isinstance(raw_id, _UUID) else _UUID(str(raw_id).strip())
            await storage.replace_file_content(
                content_id,
                content_user_id,
                (body or "").encode("utf-8"),
                mime_type=mime,
                original_filename=name_s,
                change_description="EWA companion reused existing filename (previous body snapshot)",
            )
            updated = await storage.get_content(content_id, content_user_id)
            if hasattr(updated, "model_copy"):
                return updated.model_copy(update={"deduplicated_reused": True})
            return updated

    target_folder = (folder_item_id or "").strip() or await resolve_companion_create_folder_item_id(
        content_user_id=content_user_id,
        task_key=task_key,
        folder_label=folder_label,
    )
    return await storage.create_content(
        content_data=build_content_create(
            user_id=content_user_id,
            name=name_s,
            title=name_s,
            description="Создано EWA companion по подтверждённой команде пользователя.",
            tags=["ewa-companion"],
            content_type=ContentType.DOCUMENT,
            mime_type=mime,
            visibility=Visibility.PRIVATE,
            metadata={"source": meta_src, "folder_item_id": target_folder},
            original_filename=name_s,
            source_service=source_service,
            folder_item_id=target_folder,
        ),
        file_data=(body or "").encode("utf-8"),
        user_id=content_user_id,
    )


_DOCISH_TYPES: frozenset[str] = frozenset({"document", "presentation", "spreadsheet", "other"})

FILE_EXT_IN_LINE_RE = re.compile(
    r"\b[\w\-.][\w\-. ]{0,118}\.(?:docx?|rtf|md|txt|html?|pdf|odt|pptx?|xlsx?)\b",
    re.IGNORECASE,
)


def reply_unified_content_schema_missing(*, ru: bool) -> str:
    """Short user-facing message when ``unified_content`` (or related catalogue schema) is missing in the API DB."""

    if ru:
        return (
            "Каталог файлов недоступен: в базе нет таблицы unified_content. "
            "Нужно применить миграции EliteEW к PostgreSQL из настроек API (см. shared/api/migrations/README.md)."
        )
    return (
        "File catalogue unavailable: the database has no unified_content table. "
        "Apply EliteEW migrations to the API's PostgreSQL (see shared/api/migrations/README.md)."
    )


def _content_type_str(obj: Any) -> str:
    ct = getattr(obj, "content_type", None)
    if ct is None:
        return ""
    if hasattr(ct, "value"):
        return str(ct.value)
    return str(ct)


def _docish_subset(items: list[Any]) -> list[Any]:
    typed = [c for c in items if _content_type_str(c) in _DOCISH_TYPES]
    return typed if typed else list(items)


def make_content_storage_service(pool: asyncpg.Pool) -> Any:
    from api.services.unified_content.audit_logger import AuditLogger
    from api.services.unified_content.content_storage_service import ContentStorageService
    from api.services.unified_content.storage_backends.factory import get_storage_factory

    storage_factory = get_storage_factory(pool)
    return ContentStorageService(pool, storage_factory, AuditLogger(pool))


def env_int_clamped(raw: str | None, default: int, *, lo: int, hi: int) -> int:
    try:
        v = int((raw or "").strip() or str(default))
    except ValueError:
        return default
    return max(lo, min(hi, v))


def server_first_target_filename(
    *,
    created_fresh_name: str | None,
    picked: Any,
    search_phrase: str | None,
) -> str:
    for cand in (created_fresh_name, getattr(picked, "name", None), search_phrase):
        s = (cand or "").strip()
        if s:
            return s
    return ""


def server_first_body_format(filename: str) -> str:
    low = (filename or "").lower().strip()
    if low.endswith(".txt"):
        return "plaintext"
    if low.endswith(".md"):
        return "markdown"
    if low.endswith(".html") or low.endswith(".htm"):
        return "html"
    return "html"


async def catalog_pick_owner_row(
    *,
    content_catalog_user_id: str,
    oauth2_sub_for_content_alternate: str | None,
    user_line: str,
) -> tuple[Any | None, str | None, list[Any]]:
    """Return ``(picked_row | None, search_phrase, merged_hits)`` for owner catalogue search."""

    uid_ctx = (content_catalog_user_id or "").strip()
    if not uid_ctx:
        return None, None, []

    query_svc = await companion_content_query_service_optional()
    if query_svc is None:
        return None, None, []

    raw_extract = extract_doc_search_phrase(user_line)
    phrase_norm = normalize_doc_open_phrase_after_extract(raw_extract)
    if phrase_norm and len(phrase_norm.strip()) >= 2:
        search_phrase = phrase_norm.strip()
    else:
        m = FILE_EXT_IN_LINE_RE.search(user_line)
        search_phrase = (m.group(0).strip() if m else "").strip() or None

    if not search_phrase or len(search_phrase) < 2:
        return None, search_phrase, []

    variants: list[str] = []
    for v in companion_catalog_search_variants(search_phrase):
        if v and v not in variants:
            variants.append(v)
    sp_low = search_phrase.strip()
    if re.match(r"^\d+\.(?:md|txt|html?|htm|docx?|rtf|pdf)$", sp_low, re.IGNORECASE):
        stem = sp_low.rsplit(".", 1)[0].strip()
        if stem and stem not in variants:
            variants.append(stem)
    else:
        base, _, extn = sp_low.rpartition(".")
        if (
            extn
            and 2 <= len(base) <= 80
            and extn.lower()
            in {
                "md",
                "txt",
                "html",
                "htm",
                "pdf",
                "doc",
                "docx",
            }
            and base.strip()
            and base.strip() not in variants
        ):
            variants.append(base.strip())

    alternate = (oauth2_sub_for_content_alternate or "").strip()
    if alternate == uid_ctx:
        alternate = None

    merged_items: list[Any] = []
    picked_row: Any | None = None
    for q_variant in variants:
        v = q_variant.strip()
        if len(v) < 2:
            continue
        batch, _ignored_total = await query_svc.list_content(
            user_id=uid_ctx,
            search_query=v,
            limit=45,
            offset=0,
            alternate_user_id=alternate,
            list_profile="compact",
            **companion_list_content_kwargs(),
        )
        merged_items = dedupe_catalog_rows_by_id(list(merged_items) + list(batch or []))
        poolish = _docish_subset(merged_items)
        picked_row = pick_content_row_for_doc_open(poolish, search_phrase)
        if picked_row is not None:
            break

    return picked_row, search_phrase, merged_items


__all__ = (
    "FILE_EXT_IN_LINE_RE",
    "catalog_pick_owner_row",
    "create_unified_companion_document",
    "env_int_clamped",
    "find_owner_ewa_file_by_exact_name",
    "make_content_storage_service",
    "reply_unified_content_schema_missing",
    "resolve_companion_create_folder_item_id",
    "sanitize_companion_new_filename",
    "server_first_body_format",
    "server_first_target_filename",
)
