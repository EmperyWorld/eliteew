# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# When the user asks to **read / discuss / summarize** a **named catalogue file** (without DocEditor open), resolve the
# document via the same catalogue search as server-first, **read** bytes from unified storage, and append a bounded
# excerpt to the companion **memory** prompt block for this turn — so the main chat LLM can answer from real file text.
# Invariants:
# - Never runs if ``companion_user_intent_server_first_v2_full_replace`` matches (rewrite path keeps ownership).
# - Owner-only read via ``ContentStorageService``; text-like bytes are normalized through DocEditor projection helpers.
# - Injected block includes a **CRITICAL** preface; ``chat_turn`` may append ``FINAL_REMINDER__catalogue_body_in_memory``
#   after shell snapshot when the memory section contains this heading. Default body cap stays below merged HCM+discuss
#   pressure on llama KV; raise ``EWA_COMPANION_CATALOG_DISCUSS_MAX_CHARS`` only when the host has headroom.
# Related:
# - api/ewa_platform/companion/server_first/v2.py (intent gates)
# - api/ewa_platform/companion/storage/catalog_pipeline.py (catalog pick, storage factory)
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""Catalogue file body injection for discuss / summarize companion turns."""

from __future__ import annotations

import logging
import os
import re
from collections.abc import Mapping
from typing import Any, Final
from uuid import UUID

import asyncpg

from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.ewa_platform.companion.server_first.v2 import (
    companion_catalog_line_names_file,
    companion_user_intent_server_first_v2_full_replace,
)
from api.ewa_platform.companion.sidecar.file_focus import file_focus_stack_from_profile
from api.ewa_platform.companion.storage.catalog_pipeline import (
    catalog_pick_owner_row,
    make_content_storage_service,
)
from api.services.doc_editor_text_normalizer import normalize_text_document

logger = logging.getLogger(__name__)

_MAX_DOWNLOAD_BYTES_ENV = "EWA_COMPANION_DOC_BODY_MAX_DOWNLOAD_BYTES"
_MAX_DISCUSS_BODY_ENV = "EWA_COMPANION_CATALOG_DISCUSS_MAX_CHARS"
_CATALOG_DISCUSS_ENV = "EWA_COMPANION_CATALOG_DISCUSS_ENABLED"

# Read / discuss / summarize intents (RU + EN). Server-first rewrite intents take precedence via the full-replace gate.
_DISCUSS_INTENT_RE = re.compile(
    r"(?is)(?:"
    r"обсуди|обсудим|прочитай|перескажи|изучи|кратко\s+о|что\s+в\s+(?:файле|документе)|"
    r"содержим|посмотри\s+(?:в\s+)?(?:файл|файле|документ)|расскажи\s+про|опираясь\s+на|ознакомься\s+с|"
    r"найди|найти|проанализир\w*|анализир\w*|\bанализ\b|сделай\s+вывод\w*|разбер\w*|"
    r"discuss|read\s+(?:the\s+)?file|summar(?:y|ize)|what\s*(?:'s|is)\s+in|tell\s+me\s+about|"
    r"analyze|analyse|find\s+(?:the\s+)?(?:file|document)"
    r")",
)

_DEICTIC_DISCUSS_TAIL_RE = re.compile(
    r"(?ix)(?:"
    r"\b(?:его|её|это|it|this|the\s+file|the\s+document)\b"
    r"|(?:его|её|it|this)\s+(?:ещё|снова|again|once\s+more)"
    r")",
)


def _env_int(raw: str | None, default: int, *, lo: int, hi: int) -> int:
    try:
        v = int((raw or "").strip() or str(default))
    except ValueError:
        return default
    return max(lo, min(hi, v))


def catalog_file_discuss_env_enabled() -> bool:
    raw = os.getenv(_CATALOG_DISCUSS_ENV)
    if raw is None:
        return True
    return str(raw).strip().lower() not in {"0", "false", "no", "off"}


def user_intent_catalog_file_discuss(user_line: str) -> bool:
    """True when the user wants to discuss or summarize a **named** catalogue file (not a full-replace edit)."""

    if not isinstance(user_line, str) or not user_line.strip():
        return False
    if companion_user_intent_server_first_v2_full_replace(user_line):
        return False
    if not companion_catalog_line_names_file(user_line):
        return False
    return bool(_DISCUSS_INTENT_RE.search(user_line))


def user_intent_catalog_file_discuss_deictic(
    user_line: str,
    profile: Mapping[str, object] | None,
) -> bool:
    """True when user asks to read/summarize **it** (deictic) and file-focus stack has a target."""

    if not isinstance(user_line, str) or not user_line.strip():
        return False
    if companion_user_intent_server_first_v2_full_replace(user_line):
        return False
    if companion_catalog_line_names_file(user_line):
        return False
    if not file_focus_stack_from_profile(profile):
        return False
    if not _DISCUSS_INTENT_RE.search(user_line):
        return False
    return bool(_DEICTIC_DISCUSS_TAIL_RE.search(user_line))


async def augment_memory_section_with_file_focus_discuss(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    content_catalog_user_id: str,
    profile: Mapping[str, object] | None,
) -> tuple[str, str, str] | None:
    """Read the top file-focus entry by ``uc`` (no filename in the user line)."""

    stack = file_focus_stack_from_profile(profile)
    if not stack:
        companion_degrade_debug(logger, "catalog_discuss_focus", "file_focus_stack_empty", principal_id=principal_id)
        return None
    name, uc_str = stack[-1]
    if not uc_str:
        companion_degrade_debug(logger, "catalog_discuss_focus", "file_focus_missing_uc", principal_id=principal_id)
        return None
    block = await build_catalog_memory_block_for_unified_content(
        pool,
        principal_id=principal_id,
        content_catalog_user_id=content_catalog_user_id,
        unified_content_id=uc_str,
        file_label=name,
        user_line=user_line,
    )
    if not block:
        companion_degrade_debug(
            logger,
            "catalog_discuss_focus",
            "file_focus_read_empty_block",
            principal_id=principal_id,
            unified_content_id=uc_str,
        )
        return None
    return block, uc_str, (name or "document")[:200]


async def _resolve_uc_and_label(
    *,
    content_catalog_user_id: str,
    oauth2_sub_for_content_alternate: str | None,
    user_line: str,
) -> tuple[UUID, str] | None:
    picked_row, search_phrase, merged_items = await catalog_pick_owner_row(
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        user_line=user_line,
    )
    if not merged_items:
        companion_degrade_debug(logger, "catalog_discuss_resolve", "catalog_pick_empty", user_line_chars=len(user_line))
        return None
    picked = picked_row
    if picked is None and len(merged_items) == 1:
        picked = merged_items[0]
    if picked is None:
        logger.info(
            "[STEP] companion_catalog_discuss_ambiguous matches=%s",
            len(merged_items),
        )
        companion_degrade_debug(
            logger,
            "catalog_discuss_resolve",
            "ambiguous_catalog_matches",
            matches=len(merged_items),
        )
        return None
    raw_id = getattr(picked, "id", None)
    if raw_id is None:
        companion_degrade_debug(logger, "catalog_discuss_resolve", "picked_row_missing_id")
        return None
    try:
        uc = UUID(str(raw_id).strip())
    except ValueError:
        companion_degrade_debug(logger, "catalog_discuss_resolve", "picked_row_invalid_uuid", raw_id=str(raw_id))
        return None
    label = (
        str(getattr(picked, "name", None) or getattr(picked, "title", None) or search_phrase or "").strip()
        or "document"
    )
    return uc, label


async def _read_catalog_text_block(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    content_catalog_user_id: str,
    uc: UUID,
    file_label: str,
    user_line: str,
) -> str | None:
    """Read owner bytes for ``uc`` and return markdown memory block, or ``None`` on skip/failure."""

    uid = (content_catalog_user_id or "").strip()
    if not uid:
        return None

    max_dl = _env_int(os.getenv(_MAX_DOWNLOAD_BYTES_ENV), 4_000_000, lo=10_000, hi=20_000_000)
    max_body = _env_int(os.getenv(_MAX_DISCUSS_BODY_ENV), 24_000, lo=2_000, hi=180_000)

    storage = make_content_storage_service(pool)
    try:
        file_data, file_meta = await storage.read_file_bytes_for_owner(uc, uid)
    except asyncpg.exceptions.UndefinedTableError as exc:
        logger.error(
            "[STEP] companion_catalog_discuss_schema principal=%s err=%s",
            principal_id,
            exc,
        )
        companion_degrade_debug(
            logger,
            "catalog_discuss_read",
            "schema_undefined_table",
            principal_id=principal_id,
            unified_content_id=str(uc),
            exc=exc,
        )
        return None
    except (ValueError, PermissionError) as exc:
        logger.info(
            "[STEP] companion_catalog_discuss_read_denied principal=%s uc=%s err=%s",
            principal_id,
            uc,
            exc,
        )
        companion_degrade_debug(
            logger,
            "catalog_discuss_read",
            "read_denied",
            principal_id=principal_id,
            unified_content_id=str(uc),
            exc=exc,
        )
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] companion_catalog_discuss_read_failed principal=%s uc=%s err=%s",
            principal_id,
            uc,
            exc,
        )
        companion_degrade_debug(
            logger,
            "catalog_discuss_read",
            "read_failed",
            principal_id=principal_id,
            unified_content_id=str(uc),
            exc=exc,
        )
        return None

    if not file_data or len(file_data) > max_dl:
        logger.info(
            "[STEP] companion_catalog_discuss_skip size principal=%s bytes=%s max=%s",
            principal_id,
            len(file_data or b""),
            max_dl,
        )
        companion_degrade_debug(
            logger,
            "catalog_discuss_read",
            "skip_oversize_or_empty",
            principal_id=principal_id,
            bytes=len(file_data or b""),
            max_download=max_dl,
        )
        return None
    if b"\x00" in file_data[:4096]:
        logger.info("[STEP] companion_catalog_discuss_skip binary principal=%s uc=%s", principal_id, uc)
        companion_degrade_debug(
            logger,
            "catalog_discuss_read",
            "skip_binary_content",
            principal_id=principal_id,
            unified_content_id=str(uc),
        )
        return None

    normalized = normalize_text_document(
        file_data,
        filename=str(file_meta.get("original_filename") or file_meta.get("name") or file_label),
        mime_type=str(file_meta.get("mime_type") or ""),
    )
    stored = (normalized.markdown or normalized.plain_text).strip()
    truncated = False
    if len(stored) > max_body:
        stored = stored[: max_body - 1].rstrip() + "…"
        truncated = True

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    head = (
        "### Сервер: текст файла из каталога (только чтение, этот ход)\n"
        "**КРИТИЧНО:** ниже — полный текст файла из хранилища пользователя на этом ходе. Отвечай по этому тексту. "
        "Не утверждай, что ты «не видишь» файл и не проси открыть DocEditor **только** из‑за снимка окон "
        "(там может быть только EwaApp — серверное чтение не добавляет строку окна).\n"
        if ru
        else (
            "### Server-fetched catalogue document (read-only, this turn)\n"
            "**CRITICAL:** The fenced body below is the file from the user’s catalogue loaded by the server for this turn. "
            "Answer from it. Do **not** claim you cannot see the file or demand DocEditor **only** because the desktop "
            "snapshot shows no editor window (server reads do not appear as windows).\n"
        )
    )
    warn_trunc = (
        "\n(фрагмент обрезан по лимиту — ответь по доступному тексту.)"
        if ru and truncated
        else ("\n(Excerpt truncated to the configured limit.)" if truncated else "")
    )
    block = f"{head}- Файл: `{file_label}`\n- unified_content_id: `{uc}`\n{warn_trunc}\n\n```\n{stored}\n```\n"
    logger.info(
        "[STEP] companion_catalog_discuss_injected principal=%s uc=%s chars=%s truncated=%s",
        principal_id,
        uc,
        len(stored),
        truncated,
    )
    return block


async def build_catalog_memory_block_for_unified_content(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    content_catalog_user_id: str,
    unified_content_id: str,
    file_label: str | None = None,
    user_line: str = "",
) -> str | None:
    """Load catalogue file body by ``uc`` for memory injection (file-focus follow-up / re-read)."""

    if not catalog_file_discuss_env_enabled():
        return None
    uid = (content_catalog_user_id or "").strip()
    if not uid:
        return None
    try:
        uc = UUID(str(unified_content_id or "").strip())
    except ValueError:
        return None
    label = (file_label or "document").strip()[:200] or "document"
    return await _read_catalog_text_block(
        pool,
        principal_id=principal_id,
        content_catalog_user_id=uid,
        uc=uc,
        file_label=label,
        user_line=user_line,
    )


_CATALOG_DISCUSS_PREFETCH_SKIP_BRANCHES: Final[frozenset[str]] = frozenset(
    {
        "catalog_discuss",
        "compound_file_chain",
        "file_study_compose",
    },
)


def should_skip_catalog_find_prefetch_for_turn(
    user_line: str,
    *,
    orchestrated_memory_append: str | None,
    orchestration_branch: str | None,
    profile: Mapping[str, Any] | None = None,
) -> bool:
    """Skip ``chat_turn`` catalog list/find prefetch when discuss memory is already orchestrated (Wave C)."""

    if str(orchestrated_memory_append or "").strip():
        return True
    branch = str(orchestration_branch or "").strip()
    if branch in _CATALOG_DISCUSS_PREFETCH_SKIP_BRANCHES:
        return True
    if user_intent_catalog_file_discuss(user_line):
        return True
    return user_intent_catalog_file_discuss_deictic(user_line, profile)


async def augment_memory_section_with_catalog_file_discuss(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
) -> tuple[str, str, str] | None:
    """Return ``(markdown_block, unified_content_id, label)`` for memory injection, or ``None`` if not applicable."""

    if not catalog_file_discuss_env_enabled():
        return None
    uid = (content_catalog_user_id or "").strip()
    if not uid or not user_intent_catalog_file_discuss(user_line):
        return None

    resolved = await _resolve_uc_and_label(
        content_catalog_user_id=uid,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        user_line=user_line,
    )
    if resolved is None:
        logger.info("[STEP] companion_catalog_discuss_skip resolve_failed principal=%s", principal_id)
        companion_degrade_debug(
            logger,
            "catalog_discuss_augment",
            "resolve_failed",
            principal_id=principal_id,
        )
        return None
    uc, file_label = resolved

    block = await _read_catalog_text_block(
        pool,
        principal_id=principal_id,
        content_catalog_user_id=uid,
        uc=uc,
        file_label=file_label,
        user_line=user_line,
    )
    if block is None:
        companion_degrade_debug(
            logger,
            "catalog_discuss_augment",
            "read_block_empty",
            principal_id=principal_id,
            unified_content_id=str(uc),
        )
        return None
    return block, str(uc), file_label


__all__ = (
    "augment_memory_section_with_catalog_file_discuss",
    "augment_memory_section_with_file_focus_discuss",
    "build_catalog_memory_block_for_unified_content",
    "catalog_file_discuss_env_enabled",
    "should_skip_catalog_find_prefetch_for_turn",
    "user_intent_catalog_file_discuss",
    "user_intent_catalog_file_discuss_deictic",
)
