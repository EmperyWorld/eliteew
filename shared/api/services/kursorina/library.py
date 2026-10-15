# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Курсорина library tools — user Content Manager (unified_content) as primary world.
# Invariants:
# - user_id from ToolRuntime only (never from tool args).
# - ACL via ContentQueryService.get_content / list_content (owner_only=False).
# - Library search deduplicates results by normalized document title.
# Related:
# - documentation/product/desktop/KURSORINA.md
# - documentation/reference/solution-readiness/2026-09-07-kursorina-deep-synthesis-scale-and-evidence-cleansing.md
# - api/services/unified_content/content_query_service.py
# ---

from __future__ import annotations

import logging
import re
from typing import Any
from uuid import UUID, uuid4

from api.services.kursorina.models import EvidenceItem
from api.services.kursorina.runtime import ToolRuntime

logger = logging.getLogger(__name__)

_MAX_EXTRACT = 4_000
_MAX_HITS = 8
_MAX_SAVE_CHARS = 80_000


def _eid() -> str:
    return uuid4().hex[:12]


async def _query_service():
    from api.core.database_manager import get_asyncpg_pool
    from api.services.unified_content.audit_logger import AuditLogger
    from api.services.unified_content.content_query_service import ContentQueryService
    from api.services.unified_content.content_storage_service import ContentStorageService
    from api.services.unified_content.storage_backends.factory import get_storage_factory

    pool = await get_asyncpg_pool()
    storage = ContentStorageService(pool, get_storage_factory(pool), AuditLogger(pool))
    return ContentQueryService(storage)


def _require_user(runtime: ToolRuntime | None) -> str | None:
    if runtime is None or runtime.user_id is None:
        return None
    return str(runtime.user_id)


def _content_label(row: Any) -> str:
    name = getattr(row, "name", None) or getattr(row, "title", None) or ""
    name = str(name or "").strip()
    if name:
        return name[:200]
    fn = getattr(row, "original_filename", None) or ""
    return str(fn or "").strip()[:200] or "без названия"


async def tool_search_library(
    query: str,
    *,
    runtime: ToolRuntime | None = None,
) -> tuple[str, list[EvidenceItem]]:
    q = str(query or "").strip()
    if not q:
        return "empty query", []
    user_id = _require_user(runtime)
    if not user_id:
        return "search_library requires authenticated user", []
    try:
        svc = await _query_service()
        rows, total = await svc.list_content(
            user_id=user_id,
            search_query=q[:400],
            search_scope="hybrid",
            owner_only=False,
            list_profile="full",
            limit=_MAX_HITS,
            offset=0,
        )
    except Exception as exc:  # noqa: BLE001 — honest observation for worker ledger
        logger.info("[STEP] kursorina_search_library_fail err=%s", type(exc).__name__)
        return f"library search failed: {type(exc).__name__}", []

    evidence: list[EvidenceItem] = []
    seen_titles: set[str] = set()
    for row in rows:
        cid = str(getattr(row, "id", "") or "")
        if not cid:
            continue
        label = _content_label(row)
        cleaned = re.sub(r"(?i)\s*\((?:копия|copy|\d+)[^)]*\)", "", label)
        cleaned = re.sub(r"\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b", "", cleaned)
        norm_key = re.sub(r"[^\wа-яА-Яa-zA-Z0-9]+", " ", cleaned.lower()).strip()
        words = norm_key.split()
        norm_key = " ".join(words[:5]) if words else label
        if norm_key in seen_titles:
            continue
        seen_titles.add(norm_key)

        snippet = str(getattr(row, "search_snippet", None) or "").strip()
        if not snippet:
            body = str(getattr(row, "extracted_text", None) or "").strip()
            snippet = body[:400] if body else str(getattr(row, "description", None) or "")[:400]
        folder = str(getattr(row, "folder_item_id", None) or "") or ""
        extract = f"{label}"
        if folder:
            extract += f" · folder={folder[:80]}"
        if snippet:
            extract += f"\n{snippet}"
        evidence.append(
            EvidenceItem(
                id=_eid(),
                kind="library_hit",
                ref=cid,
                extract=extract[:_MAX_EXTRACT],
            )
        )
        if len(evidence) >= 4:
            break
    obs = f"library hits={len(evidence)} total≈{int(total or 0)}"
    logger.info("[STEP] kursorina_search_library_ok hits=%s query_chars=%s", len(evidence), len(q))
    return obs, evidence


async def tool_list_folder(
    folder_item_id: str | None = None,
    *,
    unassigned: bool = False,
    runtime: ToolRuntime | None = None,
) -> tuple[str, list[EvidenceItem]]:
    user_id = _require_user(runtime)
    if not user_id:
        return "list_folder requires authenticated user", []
    folder = str(folder_item_id or "").strip() or None
    try:
        svc = await _query_service()
        # Dual-flag: folder_item_id wins; unassigned only when folder is absent.
        use_unassigned = bool(unassigned) and folder is None
        rows, total = await svc.list_content(
            user_id=user_id,
            folder_item_id=folder,
            folder_unassigned=use_unassigned,
            owner_only=False,
            list_profile="compact",
            sort_field="name",
            sort_order="asc",
            limit=_MAX_HITS,
            offset=0,
        )
    except Exception as exc:  # noqa: BLE001
        logger.info("[STEP] kursorina_list_folder_fail err=%s", type(exc).__name__)
        return f"list_folder failed: {type(exc).__name__}", []

    evidence: list[EvidenceItem] = []
    for row in rows[:_MAX_HITS]:
        cid = str(getattr(row, "id", "") or "")
        if not cid:
            continue
        label = _content_label(row)
        ctype = str(getattr(row, "content_type", None) or "")
        extract = f"{label}"
        if ctype:
            extract += f" · type={ctype}"
        evidence.append(
            EvidenceItem(
                id=_eid(),
                kind="folder",
                ref=cid,
                extract=extract[:_MAX_EXTRACT],
            )
        )
    scope = folder or ("unassigned" if unassigned else "library_root")
    obs = f"folder={scope} items={len(evidence)} total≈{int(total or 0)}"
    logger.info("[STEP] kursorina_list_folder_ok scope=%s hits=%s", scope[:48], len(evidence))
    return obs, evidence


async def tool_read_content(
    content_id: str,
    *,
    runtime: ToolRuntime | None = None,
) -> tuple[str, list[EvidenceItem]]:
    raw = str(content_id or "").strip()
    if not raw:
        return "empty content_id", []
    user_id = _require_user(runtime)
    if not user_id:
        return "read_content requires authenticated user", []
    try:
        cid = UUID(raw)
    except ValueError:
        return "invalid content_id", []
    try:
        svc = await _query_service()
        row = await svc.get_content(cid, user_id)
    except PermissionError:
        return "access denied", []
    except ValueError:
        return "content not found", []
    except Exception as exc:  # noqa: BLE001
        logger.info("[STEP] kursorina_read_content_fail err=%s", type(exc).__name__)
        return f"read_content failed: {type(exc).__name__}", []

    label = _content_label(row)
    body = str(getattr(row, "extracted_text", None) or "").strip()
    if not body:
        body = str(getattr(row, "description", None) or "").strip()
    if not body:
        return f"no text for {label or raw}", []
    extract = f"{label}\n{body}"[:_MAX_EXTRACT]
    evidence = [
        EvidenceItem(
            id=_eid(),
            kind="library",
            ref=str(cid),
            extract=extract,
        )
    ]
    logger.info(
        "[STEP] kursorina_read_content_ok id=%s chars=%s",
        str(cid)[:48],
        len(body),
    )
    return f"read ok chars={len(body)}", evidence


async def tool_note(text: str) -> tuple[str, list[EvidenceItem]]:
    note = str(text or "").strip()
    if not note:
        return "empty note", []
    evidence = [
        EvidenceItem(
            id=_eid(),
            kind="note",
            ref="note",
            extract=note[:_MAX_EXTRACT],
        )
    ]
    return "noted", evidence


def _safe_filename(title: str) -> str:
    base = re.sub(r"[^\w\s\-а-яА-ЯёЁ]+", "", (title or "").strip(), flags=re.UNICODE)
    base = re.sub(r"\s+", "_", base).strip("_")[:80] or "kursorina"
    if not base.lower().endswith(".md"):
        base = f"{base}.md"
    return base


async def tool_save_to_library(
    title: str,
    text: str,
    *,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Create a private markdown document in the user's Content Manager."""
    user_id = _require_user(runtime)
    if not user_id:
        return "save_to_library requires authenticated user", []
    body = str(text or "").strip()
    if not body:
        return "save_to_library empty body", []
    if len(body) > _MAX_SAVE_CHARS:
        body = body[:_MAX_SAVE_CHARS] + "\n…"
    name = str(title or "").strip()[:200] or "Курсорина — результат"
    filename = _safe_filename(name)

    try:
        from api.core.database_manager import get_asyncpg_pool
        from api.schemas.unified_content import ContentType, Visibility, build_content_create
        from api.services.unified_content.audit_logger import AuditLogger
        from api.services.unified_content.content_storage_service import ContentStorageService
        from api.services.unified_content.storage_backends.factory import get_storage_factory
    except ImportError:
        return "save_to_library unavailable", []

    try:
        pool = await get_asyncpg_pool()
        storage = ContentStorageService(pool, get_storage_factory(pool), AuditLogger(pool))
        payload = build_content_create(
            user_id=user_id,
            original_filename=filename,
            name=name,
            title=name,
            content_type=ContentType.DOCUMENT,
            mime_type="text/markdown",
            sub_type="markdown",
            visibility=Visibility.PRIVATE,
            description="Создано Курсориной",
            tags=["kursorina"],
            source_service="kursorina",
            source_id=(mission_id or "")[:255] or None,
            metadata={"created_by": "kursorina"},
            folder_item_id=None,
        )
        created = await storage.create_content(
            payload,
            body.encode("utf-8"),
            user_id,
            skip_deduplication=True,
        )
    except ValueError as exc:
        logger.info("[STEP] kursorina_save_library_quota_or_validate err=%s", type(exc).__name__)
        return f"save_to_library denied: {exc!s}"[:500], []
    except Exception as exc:  # noqa: BLE001 — tool boundary
        logger.info("[STEP] kursorina_save_library_fail err=%s", type(exc).__name__)
        return f"save_to_library error: {type(exc).__name__}", []

    cid = str(getattr(created, "id", "") or "")
    if not cid:
        return "save_to_library missing id", []
    try:
        from api.services.kursorina.python_tool import write_physical_file

        write_physical_file(mission_id, filename, body)
    except Exception as exc:  # noqa: BLE001
        logger.debug("[STEP] kursorina_save_to_library_disk_skip err=%s", exc)
    extract = f"{name}\n{body}"[:_MAX_EXTRACT]
    evidence = [EvidenceItem(id=_eid(), kind="library", ref=cid, extract=extract)]
    logger.info("[STEP] kursorina_save_library_ok id=%s chars=%s", cid[:48], len(body))
    return f"saved content_id={cid}", evidence


async def tool_save_binary_to_library(
    *,
    filename: str,
    data: bytes,
    mime_type: str,
    content_type_document: bool = False,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Create a private binary file (e.g. PNG) in the user's Content Manager."""
    user_id = _require_user(runtime)
    if not user_id:
        return "save_binary requires authenticated user", []
    blob = data or b""
    if not blob:
        return "save_binary empty body", []
    if len(blob) > 8_000_000:
        return "save_binary too large", []
    fname = re.sub(r"[^\w.\-а-яА-ЯёЁ]+", "_", (filename or "chart.png").strip())[:120] or "chart.png"
    try:
        from api.core.database_manager import get_asyncpg_pool
        from api.schemas.unified_content import ContentType, Visibility, build_content_create
        from api.services.unified_content.audit_logger import AuditLogger
        from api.services.unified_content.content_storage_service import ContentStorageService
        from api.services.unified_content.storage_backends.factory import get_storage_factory
    except ImportError:
        return "save_binary unavailable", []

    ctype = ContentType.DOCUMENT if content_type_document else ContentType.IMAGE
    try:
        pool = await get_asyncpg_pool()
        storage = ContentStorageService(pool, get_storage_factory(pool), AuditLogger(pool))
        payload = build_content_create(
            user_id=user_id,
            original_filename=fname,
            name=fname,
            title=fname,
            content_type=ctype,
            mime_type=mime_type or "application/octet-stream",
            sub_type="png" if fname.lower().endswith(".png") else None,
            visibility=Visibility.PRIVATE,
            description="Создано Курсориной",
            tags=["kursorina", "artifact"],
            source_service="kursorina",
            source_id=(mission_id or "")[:255] or None,
            metadata={"created_by": "kursorina", "artifact": True},
            folder_item_id=None,
        )
        created = await storage.create_content(
            payload,
            blob,
            user_id,
            skip_deduplication=True,
        )
    except ValueError as exc:
        logger.info("[STEP] kursorina_save_binary_quota err=%s", type(exc).__name__)
        return f"save_binary denied: {exc!s}"[:500], []
    except Exception as exc:  # noqa: BLE001 — tool boundary
        logger.info("[STEP] kursorina_save_binary_fail err=%s", type(exc).__name__)
        return f"save_binary error: {type(exc).__name__}", []

    cid = str(getattr(created, "id", "") or "")
    if not cid:
        return "save_binary missing id", []
    try:
        from api.services.kursorina.python_tool import write_physical_file

        write_physical_file(mission_id, fname, blob)
    except Exception as exc:  # noqa: BLE001
        logger.debug("[STEP] kursorina_save_binary_disk_skip err=%s", exc)
    extract = f"{fname} bytes={len(blob)} content_id={cid}"
    evidence = [EvidenceItem(id=_eid(), kind="library", ref=cid, extract=extract)]
    logger.info("[STEP] kursorina_save_binary_ok id=%s bytes=%s", cid[:48], len(blob))
    return f"saved file={fname} content_id={cid}", evidence


__all__ = (
    "tool_list_folder",
    "tool_note",
    "tool_read_content",
    "tool_save_binary_to_library",
    "tool_save_to_library",
    "tool_search_library",
)
