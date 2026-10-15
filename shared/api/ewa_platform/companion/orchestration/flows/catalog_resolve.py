# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shared catalog phrase parsing and unified_content resolution for companion file tools (rename, delete, insert).
# Invariants:
# - Read-only; no storage mutations — proposals create task runs elsewhere.
# - Returns ``None`` from resolve helpers when query service is unavailable (caller may fall through).
# - ``CatalogPhraseMatch`` resolves rows only inside folder **EwaFile** (``companion_list_content_kwargs``).
# Related:
# - api/ewa_platform/companion/orchestration/flows/file_rename.py
# - api/ewa_platform/companion/orchestration/flows/file_delete.py
# - api/ewa_platform/companion/orchestration/flows/doc_insert.py
# ---

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.ewa_platform.companion.sidecar.file_focus import file_focus_stack_from_profile

logger = logging.getLogger(__name__)
from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    companion_catalog_search_variants,
    is_deictic_doc_reference,
    pick_content_row_for_doc_open,
)
from api.utils.ewa_companion_folder import companion_list_content_kwargs

_FILE_RENAME_RU = re.compile(r"(?is)(?:переименуй|переименовать)\s+(?:файл|документ)?\s*(.+?)\s+в\s+(.+)$")
_FILE_RENAME_EN = re.compile(r"(?is)\brename\s+(?:file|document)?\s*(.+?)\s+to\s+(.+)$")
_FILE_DELETE_RU = re.compile(r"(?is)(?:удали|удалить)\s+(?:файл|документ)?\s*(.+)$")
_FILE_DELETE_EN = re.compile(r"(?is)\b(?:delete|remove)\s+(?:file|document)?\s*(.+)$")


def strip_file_phrase(raw: str) -> str:
    return (raw or "").strip().strip("«»\"'.,:;!?")[:255]


def parse_rename_pair(user_line: str) -> tuple[str, str] | None:
    m = _FILE_RENAME_RU.search(user_line.strip()) or _FILE_RENAME_EN.search(user_line.strip())
    if not m:
        return None
    old_p = strip_file_phrase(m.group(1))
    new_p = strip_file_phrase(m.group(2))
    if len(old_p) < 1 or len(new_p) < 1:
        return None
    return old_p, new_p


def parse_delete_phrase(user_line: str) -> str | None:
    m = _FILE_DELETE_RU.search(user_line.strip()) or _FILE_DELETE_EN.search(user_line.strip())
    if not m:
        return None
    p = strip_file_phrase(m.group(1))
    return p if len(p) >= 2 else None


async def query_service_or_none() -> Any | None:
    try:
        from api.ewa_platform.companion.storage.doceditor_content_resolve import (
            companion_content_query_service_optional,
        )
    except Exception as exc:
        companion_degrade_debug(
            logger,
            "query_service_import",
            "content query import failed",
            exc=exc,
        )
        return None
    try:
        query_svc = await companion_content_query_service_optional()
    except Exception as exc:
        companion_degrade_debug(
            logger,
            "query_service_build",
            "content query build failed",
            exc=exc,
        )
        return None
    if query_svc is None:
        companion_degrade_debug(
            logger,
            "query_service_unavailable",
            "content query service unavailable",
        )
    return query_svc


@dataclass(frozen=True)
class CatalogPhraseMatch:
    """One unified_content row resolved from a catalogue phrase search."""

    unified_content_id: str
    label: str
    can_delete: bool = True
    can_edit: bool = True


def _catalog_row_permission_flags(row: Any) -> tuple[bool, bool]:
    can_del = getattr(row, "can_delete", None)
    can_edit = getattr(row, "can_edit", None)
    return (
        True if can_del is None else bool(can_del),
        True if can_edit is None else bool(can_edit),
    )


async def resolve_uc_by_phrase(
    query_svc: Any,
    *,
    content_user_id: str,
    oauth2_sub: str | None,
    phrase: str,
) -> CatalogPhraseMatch | None:
    for variant in companion_catalog_search_variants(phrase.strip()):
        vn = variant.strip()
        if len(vn) < 2:
            continue
        rows, _total = await query_svc.list_content(
            user_id=content_user_id,
            search_query=vn,
            search_scope="hybrid",
            alternate_user_id=oauth2_sub if oauth2_sub and oauth2_sub != content_user_id else None,
            limit=20,
            offset=0,
            list_profile="compact",
            **companion_list_content_kwargs(),
        )
        picked = pick_content_row_for_doc_open(list(rows or []), vn)
        if picked is None:
            continue
        uc = str(getattr(picked, "id", "") or "").strip()
        nm = str(getattr(picked, "name", "") or getattr(picked, "title", "") or "").strip() or "file"
        if uc:
            can_delete, can_edit = _catalog_row_permission_flags(picked)
            return CatalogPhraseMatch(
                unified_content_id=uc,
                label=nm[:220],
                can_delete=can_delete,
                can_edit=can_edit,
            )
    return None


async def resolve_file_target(
    query_svc: Any,
    *,
    content_user_id: str,
    oauth2_sub: str | None,
    phrase: str | None = None,
    unified_content_id: str | None = None,
    profile: Mapping[str, Any] | None = None,
) -> CatalogPhraseMatch | None:
    """Resolve one EwaFile row by explicit ``uc``, deictic phrase (file-focus ring), or name search."""

    uc_raw = strip_file_phrase(unified_content_id or "")
    if uc_raw and len(uc_raw) >= 8:
        return CatalogPhraseMatch(unified_content_id=uc_raw, label=uc_raw[:80])

    ph = strip_file_phrase(phrase or "")
    if ph and is_deictic_doc_reference(ph):
        stack = file_focus_stack_from_profile(profile)
        if stack:
            nm, uc = stack[-1]
            if uc:
                return CatalogPhraseMatch(
                    unified_content_id=uc,
                    label=(nm or "file")[:220],
                )
        return None

    if ph and len(ph) >= 2:
        return await resolve_uc_by_phrase(
            query_svc,
            content_user_id=content_user_id,
            oauth2_sub=oauth2_sub,
            phrase=ph,
        )
    return None


__all__ = (
    "CatalogPhraseMatch",
    "parse_delete_phrase",
    "parse_rename_pair",
    "query_service_or_none",
    "resolve_file_target",
    "resolve_uc_by_phrase",
    "strip_file_phrase",
)
