# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Catalog list/find prefetch for main-LLM turns with Wave C skip gate (sync + SSE shared).
# Invariants:
# - Returns ``None`` when discuss memory already orchestrated or discuss intent/branch applies.
# - Does not load discuss file body — only keyword/list appendix bundle.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/storage/catalog_file_discuss.py
# - documentation/product/ewa/EWA-COMPANION-CATALOG-DISCUSS.md
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.storage.catalog_file_discuss import (
    should_skip_catalog_find_prefetch_for_turn,
)
from api.ewa_platform.companion.storage.catalog_find import (
    CompanionCatalogFindBundle,
    build_companion_catalog_find_bundle,
)
from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    companion_content_query_service_optional,
)
from api.ewa_platform.gateways.runtime_gateway.catalog_preferences import (
    catalog_preferences_from_profile,
)


async def maybe_prefetch_catalog_find_bundle(
    user_line: str,
    *,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
    profile: Mapping[str, Any] | None = None,
) -> CompanionCatalogFindBundle | None:
    """Build catalog list/find appendix bundle when content query service is available."""

    cid = (content_catalog_user_id or "").strip()
    if not cid:
        return None
    query_svc = await companion_content_query_service_optional()
    if query_svc is None:
        return None
    return await build_companion_catalog_find_bundle(
        user_line,
        content_catalog_user_id=cid,
        oauth2_sub=((oauth2_sub_for_content_alternate or "").strip() or None),
        query_svc=query_svc,
        preferences=catalog_preferences_from_profile(profile),
    )


async def prefetch_catalog_find_bundle_for_turn(
    user_line: str,
    *,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
    profile: Mapping[str, Any] | None,
    orchestrated_memory_append: str | None,
    orchestration_branch: str | None,
) -> CompanionCatalogFindBundle | None:
    """Prefetch catalog find bundle unless Wave C skip gate applies for this turn."""

    if should_skip_catalog_find_prefetch_for_turn(
        user_line,
        orchestrated_memory_append=orchestrated_memory_append,
        orchestration_branch=orchestration_branch,
        profile=profile,
    ):
        return None
    return await maybe_prefetch_catalog_find_bundle(
        user_line,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        profile=profile,
    )


__all__ = (
    "maybe_prefetch_catalog_find_bundle",
    "prefetch_catalog_find_bundle_for_turn",
)
