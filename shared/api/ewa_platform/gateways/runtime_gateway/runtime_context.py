# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Build the EWA Runtime Gateway read-side snapshot from authenticated user scope, Unified Content catalogue pages,
# optional companion profile status, and optional persisted desktop shell hints.
# Invariants:
# - User/content scope is derived from server dependencies; never accept a user id from request JSON/query.
# - Unified Content inventory is paginated (storage max 200) and exposes total/truncation metadata.
# - Body/hybrid zero-hit search adds indexed corpus count + operator hint in ``search_diagnostics``.
# Related:
# - api/ewa_platform/schemas/pydantic/runtime_context.py
# - api/ewa_platform/gateways/routers/runtime_context.py
# - api/ewa_platform/companion/storage/catalog_find.py
# ---
"""EWA Runtime Gateway context builder."""

from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

import asyncpg

from api.ewa_platform.companion.storage.catalog_listing import dedupe_catalog_rows_by_logical_identity
from api.ewa_platform.gateways.runtime_gateway.catalog_preferences import (
    catalog_preferences_from_profile,
    normalize_extension_list,
)
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.schemas.pydantic.runtime_context import (
    EwaRuntimeCatalogFilters,
    EwaRuntimeCatalogPreferencesOut,
    EwaRuntimeCompanionStatusOut,
    EwaRuntimeContentItemOut,
    EwaRuntimeContentPageOut,
    EwaRuntimeContextOut,
    EwaRuntimeDesktopHintsOut,
    EwaRuntimeLimitsOut,
    EwaRuntimePrincipalOut,
    EwaRuntimeSearchScope,
)
from api.schemas.unified_content import ContentType, Visibility

if TYPE_CHECKING:
    from api.core.auth import User
    from api.services.unified_content.content_query_service import ContentQueryService

MAX_CONTENT_PAGE_SIZE = 200
DEFAULT_CONTENT_PAGE_SIZE = 50
MAX_PROMPT_CONTENT_ITEMS = 120
_POST_FILTER_SCAN_LIMIT = 2000
_MIME_GROUPS: dict[str, frozenset[str]] = {
    "audio": frozenset({"audio"}),
    "docs": frozenset({"document", "presentation", "spreadsheet", "other"}),
    "media": frozenset({"image", "video", "audio"}),
    "text": frozenset({"document", "presentation", "spreadsheet", "other"}),
    "binary": frozenset({"image", "video", "audio", "other"}),
}


def clamp_content_page_limit(limit: int | None) -> int:
    """Clamp caller page size to the Unified Content storage cap."""

    if limit is None:
        return DEFAULT_CONTENT_PAGE_SIZE
    return max(1, min(int(limit), MAX_CONTENT_PAGE_SIZE))


def content_alternate_user_id(content_user_id: str, oauth2_sub: str | None) -> str | None:
    """Use Keycloak/user-sub as a secondary catalogue owner id only when it differs from DB ``users.id``."""

    uid = (content_user_id or "").strip()
    alt = (oauth2_sub or "").strip()
    if not uid or not alt or uid == alt:
        return None
    return alt


def _str_or_none(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    return s or None


def normalize_catalog_filters(
    *,
    content_types: list[str] | None = None,
    mime_groups: list[str] | None = None,
    extension_include: list[str] | None = None,
    extension_exclude: list[str] | None = None,
    include_audio: bool | None = None,
    exclude_audio: bool | None = None,
    preferences: EwaRuntimeCatalogPreferencesOut | None = None,
) -> EwaRuntimeCatalogFilters:
    """Normalize explicit request filters plus persisted preferences into one applied filter block."""

    known_content = {item.value for item in ContentType}
    c_types = [str(x).strip().lower() for x in (content_types or []) if str(x).strip().lower() in known_content]
    m_groups = [str(x).strip().lower() for x in (mime_groups or []) if str(x).strip().lower() in _MIME_GROUPS]
    if include_audio is True and "audio" not in c_types and not m_groups:
        c_types.append("audio")
    # ``exclude_audio`` is an exclusion flag, not a mime-group include filter.
    if preferences is not None:
        # Preference content/mime exclusions are carried separately in ``applied_preferences`` and enforced as exclusions.
        pass
    return EwaRuntimeCatalogFilters(
        content_types=sorted(set(c_types)),
        mime_groups=sorted(set(m_groups)),  # type: ignore[arg-type]
        extension_include=normalize_extension_list(extension_include or []),
        extension_exclude=normalize_extension_list(
            list(extension_exclude or []) + (list(preferences.extension_exclude) if preferences else [])
        ),
        include_audio=include_audio,
        exclude_audio=exclude_audio,
    )


def _content_type_value(row: Any) -> str:
    return str(
        getattr(getattr(row, "content_type", None), "value", None) or getattr(row, "content_type", "") or ""
    ).lower()


def _mime_type_value(row: Any) -> str:
    return str(getattr(row, "mime_type", "") or "").lower()


def _row_extension(row: Any) -> str:
    for attr in ("original_filename", "name", "title"):
        raw = str(getattr(row, attr, "") or "").strip().lower()
        if "." in raw:
            ext = "." + raw.rsplit(".", 1)[-1]
            norm = normalize_extension_list([ext])
            if norm:
                return norm[0]
    return ""


def _row_mime_group(row: Any) -> str:
    ctype = _content_type_value(row)
    mime = _mime_type_value(row)
    if ctype == "audio" or mime.startswith("audio/"):
        return "audio"
    if ctype in {"image", "video"} or mime.startswith(("image/", "video/")):
        return "media"
    if ctype in {"document", "presentation", "spreadsheet"} or mime.startswith(("text/", "application/pdf")):
        return "docs"
    return "binary" if mime and not mime.startswith("text/") else "text"


def _row_matches_filters(
    row: Any,
    filters: EwaRuntimeCatalogFilters,
    *,
    preferences: EwaRuntimeCatalogPreferencesOut | None,
) -> bool:
    ctype = _content_type_value(row)
    ext = _row_extension(row)
    group = _row_mime_group(row)
    if filters.content_types and ctype not in set(filters.content_types):
        return False
    if preferences and ctype in set(preferences.exclude_content_types):
        return False
    if filters.mime_groups and group not in set(filters.mime_groups):
        return False
    if filters.exclude_audio is True and group == "audio":
        return False
    if preferences and group in set(preferences.exclude_mime_groups):
        return False
    if filters.extension_include and ext not in set(filters.extension_include):
        return False
    return not (filters.extension_exclude and ext in set(filters.extension_exclude))


def _needs_post_filter(filters: EwaRuntimeCatalogFilters, preferences: EwaRuntimeCatalogPreferencesOut | None) -> bool:
    return bool(
        filters.content_types
        or filters.mime_groups
        or filters.extension_include
        or filters.extension_exclude
        or (
            preferences
            and (preferences.exclude_content_types or preferences.exclude_mime_groups or preferences.extension_exclude)
        )
    )


def _zero_results_corpus_hint(*, indexed_body_corpus_count: int) -> str:
    """Operator-facing RU hint when body/hybrid search returns zero rows."""

    if indexed_body_corpus_count <= 0:
        return (
            "Ноль результатов: в доступном каталоге нет документов с проиндексированным текстом "
            "(поле extracted_text пусто). Откройте файлы в DocEditor или дождитесь обработки."
        )
    return (
        "Ноль результатов: документы с текстом есть, но запрос не совпал. "
        "Попробуйте другие слова или scope=metadata для поиска по имени."
    )


def runtime_content_item_from_row(row: Any) -> EwaRuntimeContentItemOut:
    """Map a ``Content``-like row to the gateway compact item contract."""

    return EwaRuntimeContentItemOut(
        unified_content_id=str(getattr(row, "id", "")).strip(),
        name=str(getattr(row, "name", "") or getattr(row, "title", "") or "—").strip()[:500],
        title=_str_or_none(getattr(row, "title", None)),
        content_type=_str_or_none(
            getattr(getattr(row, "content_type", None), "value", None) or getattr(row, "content_type", None)
        ),
        mime_type=_str_or_none(getattr(row, "mime_type", None)),
        file_size=getattr(row, "file_size", None),
        visibility=_str_or_none(
            getattr(getattr(row, "visibility", None), "value", None) or getattr(row, "visibility", None)
        ),
        owner_user_id=_str_or_none(getattr(row, "user_id", None)),
        is_owner=getattr(row, "is_owner", None),
        can_edit=getattr(row, "can_edit", None),
        folder_item_id=_str_or_none(getattr(row, "folder_item_id", None)),
        company_id=_str_or_none(getattr(row, "company_id", None)),
        project_id=_str_or_none(getattr(row, "project_id", None)),
        created_at=getattr(row, "created_at", None),
        updated_at=getattr(row, "updated_at", None),
        search_matched_scope=_str_or_none(getattr(row, "search_matched_scope", None)),  # type: ignore[arg-type]
        search_snippet=_str_or_none(getattr(row, "search_snippet", None)),
        search_score=getattr(row, "search_score", None),
        search_degraded=getattr(row, "search_degraded", None),
    )


async def build_runtime_content_page(
    query_svc: ContentQueryService,
    *,
    content_user_id: str,
    oauth2_sub: str | None,
    content_type: ContentType | None = None,
    visibility: Visibility | None = None,
    search_query: str | None = None,
    offset: int = 0,
    limit: int | None = None,
    sort_field: str | None = None,
    sort_order: str | None = None,
    filters: EwaRuntimeCatalogFilters | None = None,
    preferences: EwaRuntimeCatalogPreferencesOut | None = None,
    search_scope: EwaRuntimeSearchScope = "metadata",
) -> EwaRuntimeContentPageOut:
    """Build one content inventory page using the same read path as Content Manager."""

    items, total, page_offset, page_limit, search, applied_filters = await fetch_runtime_content_rows(
        query_svc,
        content_user_id=content_user_id,
        oauth2_sub=oauth2_sub,
        content_type=content_type,
        visibility=visibility,
        search_query=search_query,
        offset=offset,
        limit=limit,
        sort_field=sort_field,
        sort_order=sort_order,
        filters=filters,
        preferences=preferences,
        search_scope=search_scope,
    )
    next_offset = page_offset + page_limit if page_offset + page_limit < total else None
    degraded_count = sum(1 for row in items if bool(getattr(row, "search_degraded", False)))
    search_diagnostics: dict[str, Any] = {
        "scope": search_scope,
        "zero_results": bool(search and total == 0),
        "degraded_match_count": degraded_count,
        "searched_body": bool(search and search_scope in {"content", "hybrid"}),
    }
    if search and total == 0 and search_scope in {"content", "hybrid"}:
        indexed_body_corpus_count = await query_svc.count_indexed_body_corpus(
            user_id=content_user_id,
            alternate_user_id=content_alternate_user_id(content_user_id, oauth2_sub),
            visibility=visibility,
        )
        search_diagnostics["indexed_body_corpus_count"] = indexed_body_corpus_count
        search_diagnostics["zero_results_hint"] = _zero_results_corpus_hint(
            indexed_body_corpus_count=indexed_body_corpus_count
        )
    return EwaRuntimeContentPageOut(
        items=[runtime_content_item_from_row(row) for row in items],
        total=total,
        offset=page_offset,
        limit=page_limit,
        next_offset=next_offset,
        truncated=next_offset is not None,
        search_query=search,
        search_scope=search_scope,
        sort_field=(sort_field or "").strip() or None,
        sort_order=(sort_order or "").strip() or None,
        applied_filters=applied_filters,
        applied_preferences=preferences,
        search_diagnostics=search_diagnostics,
    )


async def fetch_runtime_content_rows(
    query_svc: ContentQueryService,
    *,
    content_user_id: str,
    oauth2_sub: str | None,
    content_type: ContentType | None = None,
    visibility: Visibility | None = None,
    search_query: str | None = None,
    offset: int = 0,
    limit: int | None = None,
    sort_field: str | None = None,
    sort_order: str | None = None,
    filters: EwaRuntimeCatalogFilters | None = None,
    preferences: EwaRuntimeCatalogPreferencesOut | None = None,
    search_scope: EwaRuntimeSearchScope = "metadata",
    folder_item_id: str | None = None,
    owner_only: bool = False,
) -> tuple[list[Any], int, int, int, str | None, EwaRuntimeCatalogFilters]:
    """Fetch raw content rows with the gateway's auth scope, caps, and alternate-id handling."""

    page_limit = clamp_content_page_limit(limit)
    page_offset = max(0, int(offset or 0))
    search = (search_query or "").strip() or None
    applied_filters = (
        normalize_catalog_filters(
            content_types=filters.content_types,
            mime_groups=filters.mime_groups,
            extension_include=filters.extension_include,
            extension_exclude=filters.extension_exclude,
            include_audio=filters.include_audio,
            exclude_audio=filters.exclude_audio,
            preferences=preferences,
        )
        if filters is not None
        else normalize_catalog_filters(preferences=preferences)
    )
    if content_type is not None and content_type.value not in applied_filters.content_types:
        applied_filters = applied_filters.model_copy(
            update={"content_types": sorted({*applied_filters.content_types, content_type.value})}
        )
    single_content_type: ContentType | None = None
    if len(applied_filters.content_types) == 1 and not (preferences and preferences.exclude_content_types):
        single_content_type = ContentType(applied_filters.content_types[0])
    if not _needs_post_filter(applied_filters, preferences) or (
        single_content_type is not None
        and not applied_filters.mime_groups
        and not applied_filters.extension_include
        and not applied_filters.extension_exclude
    ):
        items, total_raw = await query_svc.list_content(
            user_id=content_user_id,
            content_type=single_content_type,
            search_query=search,
            visibility=visibility,
            offset=page_offset,
            limit=page_limit,
            sort_field=(sort_field or "").strip() or None,
            sort_order=(sort_order or "").strip() or None,
            alternate_user_id=content_alternate_user_id(content_user_id, oauth2_sub),
            list_profile="compact",
            search_scope=search_scope,
            folder_item_id=folder_item_id,
            owner_only=owner_only,
        )
        total = max(0, int(total_raw or 0))
        deduped = dedupe_catalog_rows_by_logical_identity(
            list(items),
            step_label="runtime_gateway_listing_dedup",
        )
        return deduped, total, page_offset, page_limit, search, applied_filters

    # Extension/mime/preference filters are not first-class in ContentQueryService yet; scan bounded compact pages and
    # paginate the filtered result in memory so total/truncation remain honest for the EWA prompt.
    raw_items: list[Any] = []
    db_offset = 0
    total_raw_int = 0
    while db_offset < _POST_FILTER_SCAN_LIMIT:
        batch, total_raw = await query_svc.list_content(
            user_id=content_user_id,
            content_type=single_content_type,
            search_query=search,
            visibility=visibility,
            offset=db_offset,
            limit=MAX_CONTENT_PAGE_SIZE,
            sort_field=(sort_field or "").strip() or None,
            sort_order=(sort_order or "").strip() or None,
            alternate_user_id=content_alternate_user_id(content_user_id, oauth2_sub),
            list_profile="compact",
            search_scope=search_scope,
            folder_item_id=folder_item_id,
            owner_only=owner_only,
        )
        total_raw_int = max(0, int(total_raw or 0))
        raw_items.extend(batch or [])
        db_offset += MAX_CONTENT_PAGE_SIZE
        if db_offset >= total_raw_int or not batch:
            break
    filtered = [row for row in raw_items if _row_matches_filters(row, applied_filters, preferences=preferences)]
    filtered = dedupe_catalog_rows_by_logical_identity(
        filtered,
        step_label="runtime_gateway_listing_filtered_dedup",
    )
    page_items = filtered[page_offset : page_offset + page_limit]
    return page_items, len(filtered), page_offset, page_limit, search, applied_filters


async def build_runtime_companion_status(
    pool: asyncpg.Pool | None,
    *,
    principal_id: str,
) -> EwaRuntimeCompanionStatusOut:
    """Return small companion profile status without free-text profile blobs."""

    if pool is None:
        return EwaRuntimeCompanionStatusOut(loaded=False, reason="no_database_pool")
    row = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if row is None:
        return EwaRuntimeCompanionStatusOut(loaded=False, reason="not_initialized")
    return EwaRuntimeCompanionStatusOut(
        loaded=True,
        seed_persona_id=str(row.get("seed_persona_id") or ""),
        companion_revision=int(row.get("companion_revision") or 1),
    )


def build_runtime_desktop_hints(shell_state: Mapping[str, Any] | None = None) -> EwaRuntimeDesktopHintsOut:
    """Extract persisted desktop hints if a caller already loaded shell_state; live windows still use shell_context."""

    if not isinstance(shell_state, Mapping):
        return EwaRuntimeDesktopHintsOut()
    ewa_hints_raw = shell_state.get("ewa_hints")
    recent_app_ids_raw = shell_state.get("recent_app_ids")
    recent_file_ids_raw = shell_state.get("recent_file_ids")
    recent_app_ids = (
        [str(x).strip() for x in recent_app_ids_raw if str(x).strip()] if isinstance(recent_app_ids_raw, list) else []
    )
    recent_file_ids = (
        [str(x).strip() for x in recent_file_ids_raw if str(x).strip()] if isinstance(recent_file_ids_raw, list) else []
    )
    return EwaRuntimeDesktopHintsOut(
        source="shell_state",
        ewa_hints=dict(ewa_hints_raw) if isinstance(ewa_hints_raw, Mapping) else None,
        recent_app_ids=recent_app_ids[:30],
        recent_file_ids=recent_file_ids[:50],
    )


async def build_runtime_context(
    *,
    auth_user: User,
    content_user_id: str,
    query_svc: ContentQueryService,
    companion_pool: asyncpg.Pool | None,
    shell_state: Mapping[str, Any] | None = None,
    content_offset: int = 0,
    content_limit: int | None = None,
    content_search: str | None = None,
    content_search_scope: EwaRuntimeSearchScope = "metadata",
    filters: EwaRuntimeCatalogFilters | None = None,
) -> EwaRuntimeContextOut:
    """Build the top-level runtime context snapshot."""

    principal_id = str(auth_user.id)
    profile = (
        await companion_pg.companion_profile_fetch(companion_pool, principal_id=principal_id)
        if companion_pool is not None
        else None
    )
    prefs = catalog_preferences_from_profile(profile)
    content_page = await build_runtime_content_page(
        query_svc,
        content_user_id=content_user_id,
        oauth2_sub=principal_id,
        search_query=content_search,
        offset=content_offset,
        limit=content_limit,
        filters=filters,
        preferences=prefs,
        search_scope=content_search_scope,
    )
    return EwaRuntimeContextOut(
        principal=EwaRuntimePrincipalOut(
            principal_id=principal_id,
            content_user_id=content_user_id,
            username=str(auth_user.username or ""),
            role=str(auth_user.role or ""),
            ew_family=bool(getattr(auth_user, "ew_family", False)),
        ),
        companion=(
            EwaRuntimeCompanionStatusOut(
                loaded=True,
                seed_persona_id=str(profile.get("seed_persona_id") or ""),
                companion_revision=int(profile.get("companion_revision") or 1),
            )
            if profile is not None
            else await build_runtime_companion_status(companion_pool, principal_id=principal_id)
        ),
        content=content_page,
        desktop=build_runtime_desktop_hints(shell_state),
        limits=EwaRuntimeLimitsOut(
            max_content_page_size=MAX_CONTENT_PAGE_SIZE,
            default_content_page_size=DEFAULT_CONTENT_PAGE_SIZE,
            max_prompt_content_items=MAX_PROMPT_CONTENT_ITEMS,
        ),
    )
