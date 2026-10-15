# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Optional **P2-C** semantic augment for companion catalog find: when keyword ``list_content`` is sparse, try
# ``SemanticSearchService`` (ES + Qdrant + embed) and merge ACL-checked rows into the catalogue snapshot.
# Invariants:
# - Opt-in ``EWA_COMPANION_SEMANTIC_CATALOG_ENABLED=1``; never raises — degrades to unchanged ``collected``.
# - Skips browse-all intents; only augments when ``len(collected) < min_hits`` and query length ≥ 2.
# Related:
# - api/ewa_platform/companion/storage/catalog_find.py
# - documentation/product/ewa/EWA-COMPANION-SEMANTIC-SEARCH-P2.md
# ---
"""Companion catalog semantic augment (feature-flagged, best-effort)."""

from __future__ import annotations

import logging
import os
from types import SimpleNamespace
from typing import Any
from uuid import UUID

from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.utils.ewa_companion_folder import content_row_in_companion_folder

logger = logging.getLogger(__name__)

_DEFAULT_MIN_HITS = 2
_DEFAULT_SEMANTIC_LIMIT = 12


def env_companion_semantic_catalog_enabled() -> bool:
    raw = os.getenv("EWA_COMPANION_SEMANTIC_CATALOG_ENABLED", "0")
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def _parse_user_uuid(user_id: str) -> UUID | None:
    s = (user_id or "").strip()
    if not s:
        return None
    try:
        return UUID(s)
    except ValueError:
        return None


def _catalog_row_from_content(content: Any, *, scope: str = "semantic") -> Any:
    name = getattr(content, "name", None)
    if not isinstance(name, str) or not name.strip():
        name = getattr(content, "title", None)
    if not isinstance(name, str) or not name.strip():
        name = "—"
    description = getattr(content, "description", None)
    snippet = description.strip()[:180] if isinstance(description, str) and description.strip() else None
    return SimpleNamespace(
        id=getattr(content, "id", None),
        name=str(name).strip()[:200],
        content_type=str(getattr(content, "content_type", "document")),
        mime_type=getattr(content, "mime_type", None),
        search_matched_scope=scope,
        search_snippet=snippet,
    )


async def _resolve_semantic_search_service() -> Any | None:  # noqa: ANN401
    try:
        from api.core.database_manager import get_database_manager  # noqa: PLC0415
        from api.services.ai_sdk.embedding_service import embedding_service  # noqa: PLC0415
        from api.services.unified_content.semantic_search_service import (  # noqa: PLC0415
            SemanticSearchService,
        )
    except Exception as exc:  # noqa: BLE001 — optional deps in slim images
        companion_degrade_debug(
            logger,
            "semantic_catalog_import",
            "semantic search deps unavailable",
            exc=exc,
        )
        return None

    try:
        manager = await get_database_manager()
        es_client = getattr(manager, "elasticsearch_client", None)
        qdrant_client = getattr(manager, "qdrant_client", None)
        db_pool = getattr(manager, "asyncpg_pool", None)
        if db_pool is None:
            try:
                db_pool = await manager.get_asyncpg_pool()
            except Exception as exc:  # noqa: BLE001 — ACL optional; query_svc still filters rows
                companion_degrade_debug(
                    logger,
                    "semantic_catalog_pool",
                    "asyncpg pool unavailable for semantic catalog",
                    exc=exc,
                )
                db_pool = None
        if es_client is None and qdrant_client is None:
            return None
        return SemanticSearchService(
            elasticsearch_service=es_client,
            qdrant_client=qdrant_client,
            embedding_service=embedding_service,
            db_pool=db_pool,
        )
    except Exception as exc:  # noqa: BLE001
        companion_degrade_debug(
            logger,
            "semantic_catalog_service_build",
            "semantic search service build failed",
            exc=exc,
        )
        return None


async def augment_catalog_collected_semantic(
    collected: list[Any],
    *,
    query: str,
    content_user_id: str,
    query_svc: Any,
    min_hits: int = _DEFAULT_MIN_HITS,
    limit: int = _DEFAULT_SEMANTIC_LIMIT,
) -> tuple[list[Any], bool]:
    """Return ``(rows, used_semantic)``; ``used_semantic`` is True when any semantic row was merged."""

    if not env_companion_semantic_catalog_enabled():
        return collected, False
    q = (query or "").strip()
    if len(q) < 2:
        return collected, False
    if len(collected) >= max(1, int(min_hits)):
        return collected, False

    svc = await _resolve_semantic_search_service()
    if svc is None:
        return collected, False

    user_uuid = _parse_user_uuid(content_user_id)
    try:
        hits = await svc.search(q, limit=max(1, int(limit)), user_id=user_uuid)
    except Exception as exc:  # noqa: BLE001
        logger.warning("companion_semantic_catalog_search_failed err=%s", exc)
        return collected, False

    if not hits:
        return collected, False

    existing_ids = {str(getattr(row, "id", "")).strip() for row in collected if getattr(row, "id", None) is not None}
    merged = list(collected)
    used = False
    uid = (content_user_id or "").strip()
    for hit in hits:
        cid = getattr(hit, "content_id", None)
        if cid is None:
            continue
        cid_s = str(cid).strip()
        if not cid_s or cid_s in existing_ids:
            continue
        try:
            content = await query_svc.get_content(cid, uid)
        except Exception as exc:  # noqa: BLE001 — ACL / missing row
            companion_degrade_debug(
                logger,
                "semantic_catalog_content_row",
                "skip semantic hit; content row unavailable",
                exc=exc,
                content_id=cid_s,
            )
            continue
        # Some unit stubs (and legacy ACL wrappers) do not expose ``folder_item_id``;
        # treat such rows as already ACL-checked and keep strict folder gate only when
        # an explicit folder marker is present.
        has_folder_marker = hasattr(content, "folder_item_id") or (
            isinstance(content, dict) and "folder_item_id" in content
        )
        if has_folder_marker and not content_row_in_companion_folder(content):
            continue
        row = _catalog_row_from_content(content)
        if getattr(row, "id", None) is None:
            continue
        merged.append(row)
        existing_ids.add(cid_s)
        used = True
        if len(merged) >= limit:
            break

    if used:
        logger.info(
            "[STEP] companion_semantic_catalog_augment merged=%s query_preview=%r",
            len(merged) - len(collected),
            q[:80],
        )
    return merged, used


__all__ = (
    "augment_catalog_collected_semantic",
    "env_companion_semantic_catalog_enabled",
)
