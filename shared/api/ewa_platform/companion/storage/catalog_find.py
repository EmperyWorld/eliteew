# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Companion **deterministic catalogue discovery** via **``list_content``**: keyword ``ILIKE`` **or** a **browse‑recent** pass
# (no search filter) when the user asks to list/show files without naming a needle — RU/EN phrases including
# «посмотри список файлов», «найди файлы» with no tail, etc. **``build_companion_catalog_find_bundle``** runs the same query
# **before** the chat LLM so the model can align prose with server facts; **``augment_companion_catalog_find_reply``** reuses
# that bundle for the visible markdown appendix without opening Content Manager implicitly.
# Invariants:
# - Catalogue scope is **EwaFile** only (``companion_list_content_kwargs``) — not the full Content Manager library.
# - Skips entirely when phrase already matches DocEditor **open‑file‑in‑editor** intent (delegated to DocEditor augment).
# - Opt-out ``EWA_COMPANION_CATALOG_FIND=0``; appendix length capped; **browse** fetches up to **200** rows (PG cap) and
#   renders more lines than keyword search; still not guaranteed literally “every” object if the library exceeds caps.
# Related:
# - api/ewa_platform/companion/storage/doceditor_content_resolve.py
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""Companion catalog search appendix (keyword name/content search or EwaFile browse)."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from api.ewa_platform.companion.sidecar.search_intent import CompanionSearchIntent, resolve_companion_search_intent
from api.ewa_platform.companion.storage.catalog_listing import (
    dedupe_catalog_rows_by_logical_identity,
    filter_companion_browse_noise_rows,
)
from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    companion_catalog_search_variants,
    dedupe_catalog_rows_by_id,
    user_intent_doceditor_open_with_file,
)
from api.ewa_platform.companion.storage.semantic_catalog_augment import (
    augment_catalog_collected_semantic,
)
from api.ewa_platform.gateways.runtime_gateway.runtime_context import (
    fetch_runtime_content_rows,
    normalize_catalog_filters,
)
from api.ewa_platform.schemas.pydantic.runtime_context import EwaRuntimeCatalogFilters, EwaRuntimeCatalogPreferencesOut
from api.utils.ewa_companion_folder import companion_list_content_kwargs

logger = logging.getLogger(__name__)

_MAX_APPENDIX_CHARS_KEYWORD: int = 4000
# 6 KB / 40 lines: the appendix used to consume the entire 16 KB system budget on its own when the user had a
# large library, evicting persona/HCM blocks at the tail. With noise-row filtering in place the cap is enough for
# ~30 real files; the appendix carries a “…show more in Content Manager” tail when truncated.
_MAX_APPENDIX_CHARS_BROWSE: int = 6000
_MAX_LIST_LINES_KEYWORD: int = 12
_MAX_LIST_LINES_BROWSE: int = 40
_BROWSE_LIST_FETCH_LIMIT: int = 200
_KEYWORD_LIST_FETCH_LIMIT: int = 30


def env_companion_catalog_find_enabled() -> bool:
    raw = os.getenv("EWA_COMPANION_CATALOG_FIND", "1")
    return str(raw).strip().lower() not in ("0", "false", "no", "off")


def _resolve_catalog_find_intent(user_line: str) -> tuple[bool, str] | None:
    """Return ``(browse_all, keyword)`` or ``None`` if catalog augment does not apply.

    * ``browse_all`` — call ``list_content`` without ``search_query`` (recent / accessible rows).
    * ``keyword`` — non-empty only when ``not browse_all``; ILIKE rounds use it.
    """

    if not env_companion_catalog_find_enabled():
        return None
    s = user_line.strip()
    if not s:
        return None
    if user_intent_doceditor_open_with_file(s):
        return None

    intent = resolve_companion_search_intent(s)
    if intent is None:
        return None
    return (intent.browse_all, intent.display_query)


def user_intent_companion_catalog_find(user_line: str) -> bool:
    return _resolve_catalog_find_intent(user_line) is not None


def _catalog_row_uc(row: Any) -> str | None:
    rid = getattr(row, "id", None)
    if rid is None:
        return None
    if isinstance(rid, UUID):
        return str(rid).strip()
    s = str(rid).strip()
    return s if s else None


def _catalog_row_name(row: Any) -> str:
    for attr in ("name", "title", "display_name"):
        v = getattr(row, attr, None)
        if isinstance(v, str) and v.strip():
            return v.strip()[:200]
    return "—"


def compact_catalog_hits_from_rows(rows: list[Any] | tuple[Any, ...], *, limit: int = 10) -> list[dict[str, str]]:
    """Compact id+name hits for agentic working memory after catalog_list."""

    out: list[dict[str, str]] = []
    for row in list(rows)[: max(0, int(limit))]:
        uid = _catalog_row_uc(row)
        if not uid:
            continue
        out.append({"unified_content_id": uid, "name": _catalog_row_name(row)})
    return out


@dataclass(frozen=True)
class CompanionCatalogFindBundle:
    """Server catalogue snapshot for one user line: reuse for LLM grounding + post-turn appendix/actions."""

    browse_all: bool
    keyword_query: str
    filters: EwaRuntimeCatalogFilters
    preferences: EwaRuntimeCatalogPreferencesOut | None
    collected_rows: tuple[Any, ...]
    appendix: str
    search_scope: str = "metadata"
    semantic_augmented: bool = False


def _catalog_row_attr(row: Any, *names: str) -> str:
    for name in names:
        value = getattr(row, name, None)
        if value is None and isinstance(row, dict):
            value = row.get(name)
        if value is not None:
            text = str(value).strip()
            if text:
                return text
    return ""


def catalog_find_bundle_output_surface(bundle: CompanionCatalogFindBundle) -> dict[str, Any] | None:
    """Return embedded clickable file-list surface for a catalogue bundle."""

    items: list[dict[str, Any]] = []
    for row in list(bundle.collected_rows)[:_MAX_LIST_LINES_BROWSE]:
        uc = _catalog_row_uc(row)
        if not uc:
            continue
        items.append(
            {
                "unifiedContentId": uc,
                "title": _catalog_row_name(row),
                "contentType": _catalog_row_attr(row, "content_type")[:80],
                "mimeType": _catalog_row_attr(row, "mime_type")[:120],
                "updatedAt": _catalog_row_attr(row, "updated_at")[:80],
                "snippet": _catalog_row_attr(row, "search_snippet")[:240],
            }
        )
    if not items:
        return None
    return {
        "mode": "file_list",
        "payload": {
            "title": "EwaFile",
            "query": str(bundle.keyword_query or "").strip(),
            "browseAll": bool(bundle.browse_all),
            "rowCount": len(bundle.collected_rows),
            "items": items,
        },
    }


def _forced_browse_catalog_intent() -> CompanionSearchIntent:
    """Declarative workflow ``catalog_list`` with ``mode=list`` — browse EwaFile without phrase parsing."""

    return CompanionSearchIntent(
        browse_all=True,
        display_query="",
        body_query="",
        scope="metadata",
        filters=EwaRuntimeCatalogFilters(),
        confidence=1.0,
    )


async def build_companion_catalog_find_bundle(
    user_line: str,
    *,
    content_catalog_user_id: str,
    oauth2_sub: str | None,
    query_svc: Any,
    preferences: EwaRuntimeCatalogPreferencesOut | None = None,
    force_browse: bool = False,
    folder_item_id: str | None = None,
) -> CompanionCatalogFindBundle | None:
    """Run **``list_content``** when catalog intent matches; return data for system prompt + finalize (or ``None``).

    Optional ``folder_item_id`` narrows browse/search to a nested ``ewa-task-*`` folder (or root ``ewa_file``).
    """

    uid_ctx = (content_catalog_user_id or "").strip()
    if not uid_ctx:
        return None
    if not env_companion_catalog_find_enabled():
        return None
    if force_browse:
        intent = _forced_browse_catalog_intent()
    else:
        intent = resolve_companion_search_intent(user_line)
        if intent is None or user_intent_doceditor_open_with_file(user_line.strip()):
            return None

    browse_all = intent.browse_all
    q = intent.display_query
    filters = normalize_catalog_filters(
        content_types=intent.filters.content_types,
        mime_groups=intent.filters.mime_groups,
        extension_include=intent.filters.extension_include,
        extension_exclude=intent.filters.extension_exclude,
        include_audio=intent.filters.include_audio,
        exclude_audio=intent.filters.exclude_audio,
    )
    alternate = (oauth2_sub or "").strip()
    if alternate == uid_ctx:
        alternate = None

    collected: list[Any] = []
    folder_scope = (folder_item_id or "").strip() or None
    if folder_scope:
        appendix_title = (
            f"**Catalog (folder `{folder_scope}` browse):**"
            if browse_all
            else f"**Catalog (folder `{folder_scope}` keyword):**"
        )
    else:
        appendix_title = "**Catalog (EwaFile browse):**" if browse_all else "**Catalog (EwaFile keyword):**"
    max_lines = _MAX_LIST_LINES_BROWSE if browse_all else _MAX_LIST_LINES_KEYWORD
    cap = _MAX_APPENDIX_CHARS_BROWSE if browse_all else _MAX_APPENDIX_CHARS_KEYWORD
    list_limit = _BROWSE_LIST_FETCH_LIMIT if browse_all else _KEYWORD_LIST_FETCH_LIMIT
    total_count: int | None = None
    semantic_used = False
    catalog_scope = companion_list_content_kwargs()
    if folder_scope:
        catalog_scope = {**catalog_scope, "folder_item_id": folder_scope}
    try:
        if browse_all:
            logger.info(
                "[STEP] companion_catalog_find_browse list_content limit=%s folder=%s",
                list_limit,
                catalog_scope.get("folder_item_id"),
            )
            batch, total_count, _page_offset, _page_limit, _search, _filters = await fetch_runtime_content_rows(
                query_svc,
                content_user_id=uid_ctx,
                oauth2_sub=alternate,
                search_query=None,
                limit=list_limit,
                offset=0,
                filters=filters,
                preferences=preferences,
                search_scope=intent.scope,
                folder_item_id=catalog_scope["folder_item_id"],
                owner_only=catalog_scope["owner_only"],
            )
            deduped = dedupe_catalog_rows_by_logical_identity(
                list(batch or []),
                step_label="companion_catalog_find_browse_dedup",
            )
            collected = filter_companion_browse_noise_rows(
                deduped,
                step_label="companion_catalog_find_browse_noise_filter",
            )
        else:
            ttl_seen: int | None = None
            for v in companion_catalog_search_variants(intent.body_query or q):
                vn = v.strip()
                if len(vn) < 2:
                    continue
                batch, ttl_count, _page_offset, _page_limit, _search, _filters = await fetch_runtime_content_rows(
                    query_svc,
                    content_user_id=uid_ctx,
                    oauth2_sub=alternate,
                    search_query=vn,
                    limit=list_limit,
                    offset=0,
                    filters=filters,
                    preferences=preferences,
                    search_scope=intent.scope,
                    folder_item_id=catalog_scope["folder_item_id"],
                    owner_only=catalog_scope["owner_only"],
                )
                ttl_seen = max(ttl_seen or 0, int(ttl_count))
                merged = dedupe_catalog_rows_by_id(list(collected) + list(batch or []))
                collected = dedupe_catalog_rows_by_logical_identity(
                    merged,
                    step_label="companion_catalog_find_keyword_dedup",
                )
                if len(collected) >= list_limit:
                    break
            total_count = ttl_seen
            if not browse_all and intent.scope in ("content", "hybrid"):
                semantic_query = (intent.body_query or q or "").strip()
                if semantic_query:
                    collected, semantic_used = await augment_catalog_collected_semantic(
                        collected,
                        query=semantic_query,
                        content_user_id=uid_ctx,
                        query_svc=query_svc,
                    )
                    if semantic_used:
                        appendix_title = "**Catalog (keyword + semantic):**"
    except Exception as exc:  # noqa: BLE001 — non-fatal
        q_prev = "" if browse_all else q[:80]
        logger.warning(
            "companion_catalog_find_bundle_failed err=%s q_preview=%r browse=%s",
            exc,
            q_prev,
            browse_all,
        )
        return None

    if not collected:
        no_match_hint = ""
        if not browse_all and (intent.body_query or q):
            no_match_hint = (
                "\n_(Совпадений нет. Если вы искали текст внутри файла, он мог быть не проиндексирован в `extracted_text` — "
                "откройте документ в DocEditor или повторите поиск по имени/описанию.)_\n"
                if any("\u0400" <= ch <= "\u04ff" for ch in user_line)
                else "\n_(No matches. For inside-file text, `extracted_text` may be empty until the document was "
                "processed—try a filename search or open the file once in DocEditor.)_\n"
            )
        block = f"---\n{appendix_title}\n(no matches){no_match_hint}\n"
        block = block if len(block) <= cap else block[:cap]
        return CompanionCatalogFindBundle(
            browse_all,
            q,
            filters,
            preferences,
            (),
            block,
            search_scope=intent.scope,
            semantic_augmented=False,
        )

    lines_body: list[str] = []
    for row in collected[:max_lines]:
        cid = _catalog_row_uc(row)
        if not cid:
            continue
        nm = _catalog_row_name(row)
        scope_note = str(getattr(row, "search_matched_scope", "") or "").strip()
        snippet = str(getattr(row, "search_snippet", "") or "").strip()
        suffix = f" — match: {scope_note}" if scope_note else ""
        if snippet:
            suffix += f"; “{snippet[:180]}”"
        lines_body.append(f"- {nm} `uc={cid}`{suffix}")

    if not lines_body:
        appendix = f"---\n{appendix_title}\n(no usable rows)\n"
        return CompanionCatalogFindBundle(
            browse_all,
            q,
            filters,
            preferences,
            tuple(collected),
            appendix,
            search_scope=intent.scope,
            semantic_augmented=semantic_used,
        )

    appendix = f"---\n{appendix_title}\n" + "\n".join(lines_body) + "\n"
    filter_notes: list[str] = []
    if filters.content_types:
        filter_notes.append("content_type=" + ",".join(filters.content_types))
    if filters.extension_include:
        filter_notes.append("extensions=" + ",".join(filters.extension_include))
    exclusions: list[str] = []
    if filters.exclude_audio:
        exclusions.append("audio")
    if filters.extension_exclude:
        exclusions.extend(filters.extension_exclude)
    if preferences is not None:
        exclusions.extend(preferences.exclude_content_types)
        exclusions.extend(preferences.exclude_mime_groups)
        exclusions.extend(preferences.extension_exclude)
    if filter_notes:
        appendix += "\n_Applied filters: " + "; ".join(filter_notes) + "._\n"
    if not browse_all:
        appendix += f"\n_Search scope: {intent.scope}; File manager filter: {q or '—'}._\n"
    if exclusions:
        appendix += "\n_Applied exclusions: " + ", ".join(dict.fromkeys(exclusions)) + "._\n"
    shown = len(lines_body)
    if browse_all and total_count is not None and total_count > shown:
        appendix += f"\n_Total rows in **EwaFile** workspace: {total_count}; showing first {shown} in this message._\n"
    if len(appendix) > cap:
        appendix = (
            appendix[:cap].rstrip()
            + "\n…\n_(appendix truncated to size limit — open File manager for the full grid.)_\n"
        )

    return CompanionCatalogFindBundle(
        browse_all,
        q,
        filters,
        preferences,
        tuple(collected),
        appendix,
        search_scope=intent.scope,
        semantic_augmented=semantic_used,
    )


async def augment_companion_catalog_find_reply(
    user_line: str,
    actions: list[dict[str, Any]],
    *,
    content_catalog_user_id: str,
    oauth2_sub: str | None,
    query_svc: Any,
    prebuilt_bundle: CompanionCatalogFindBundle | None = None,
) -> tuple[list[dict[str, Any]], str]:
    """Return existing ``actions`` unchanged plus catalog markdown appendix.

    Listing/browsing files must not open Content Manager implicitly. Explicit app-open intents still go through the
    separate ``app_open`` / action allowlist paths.
    """

    merged = [_ for _ in actions if isinstance(_, dict)]

    bundle: CompanionCatalogFindBundle | None = prebuilt_bundle
    if bundle is None:
        uid_ctx = (content_catalog_user_id or "").strip()
        if not uid_ctx:
            return merged, ""
        bundle = await build_companion_catalog_find_bundle(
            user_line,
            content_catalog_user_id=uid_ctx,
            oauth2_sub=oauth2_sub,
            query_svc=query_svc,
        )

    if bundle is None:
        return merged, ""

    appendix = (bundle.appendix or "").strip()
    if not appendix:
        return merged, ""

    return merged, appendix


__all__: tuple[str, ...] = (
    "CompanionCatalogFindBundle",
    "augment_companion_catalog_find_reply",
    "build_companion_catalog_find_bundle",
    "catalog_find_bundle_output_surface",
    "env_companion_catalog_find_enabled",
    "user_intent_companion_catalog_find",
)
