# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock for unified_content parent re-export chain after atomic router decomposition.
# Invariants:
# - ``api.routers.unified_content`` re-exports deps and download helpers used by sibling routers/tests.
# Related:
# - api/routers/unified_content.py
# - documentation/platform/ATOMIC-ROUTER-DECOMPOSITION-CANON.md
# ---

from __future__ import annotations

import inspect

from api.routers import unified_content as parent
from api.routers.unified_content import (
    _build_content_download_response,
    get_content_document_structure,
    get_content_query_service,
    get_content_service,
    get_db_pool,
    get_upload_rate_limiter,
    process_content_background,
    router,
)
from api.routers.unified_content_deps import get_content_service as deps_get_content_service
from api.routers.unified_content_download import (
    _build_content_download_response as download_build_response,
)


def test_unified_content_router_mounts_child_routes() -> None:
    paths = {getattr(route, "path", None) for route in router.routes}
    assert "/content" in paths
    assert "/content/{content_id:uuid}/download" in paths
    assert "/content/duplicates" in paths
    assert "/content/broken" in paths
    assert "/content/broken/scan" in paths
    assert "/content/{content_id:uuid}/storage-recheck" in paths
    assert "/content/{content_id:uuid}/permanent-delete" in paths


def test_unified_content_reexports_shared_deps() -> None:
    assert get_content_service is deps_get_content_service
    assert _build_content_download_response is download_build_response
    assert inspect.iscoroutinefunction(get_db_pool)
    assert inspect.iscoroutinefunction(get_content_query_service)
    assert callable(get_upload_rate_limiter)
    assert inspect.iscoroutinefunction(process_content_background)
    assert inspect.iscoroutinefunction(get_content_document_structure)


def test_unified_content_parent_module_exports_router() -> None:
    assert parent.router is router
