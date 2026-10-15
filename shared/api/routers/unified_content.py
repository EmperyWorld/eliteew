# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Parent unified content router: mounts domain child routers and re-exports shared deps for legacy imports.
# Invariants:
# - Child routers use APIRouter(tags=[...]) without extra prefix; public URLs unchanged under /api/v1.
# - External importers keep ``from api.routers.unified_content import get_content_service`` working.
# Related:
# - api/domains/content.py
# - api/routers/unified_content_deps.py
# - api/routers/unified_content_upload.py … unified_content_admin.py
# ---
"""Unified Content API — parent aggregator (mount + re-export)."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["Unified Content"])

from api.routers import (  # noqa: E402
    unified_content_admin as _unified_content_admin,
    unified_content_broken as _unified_content_broken,
    unified_content_comments as _unified_content_comments,
    unified_content_crud as _unified_content_crud,
    unified_content_download as _unified_content_download,
    unified_content_query as _unified_content_query,
    unified_content_upload as _unified_content_upload,
)

router.include_router(_unified_content_upload.router)
router.include_router(_unified_content_query.router)
router.include_router(_unified_content_broken.router)
router.include_router(_unified_content_crud.router)
router.include_router(_unified_content_download.router)
router.include_router(_unified_content_comments.router)
router.include_router(_unified_content_admin.router)

# ruff: noqa: I001 — intentional late re-exports after child router mounts
from api.core.oauth2_auth import require_oauth2_user  # noqa: E402, F401
from api.dependencies.user_context import get_current_user_db_id as get_content_user_id  # noqa: E402, F401
from api.routers.unified_content_deps import (  # noqa: E402, F401
    ARCHIVE_AUDIT_ACTION,
    ARCHIVE_DOWNLOAD_CONCURRENCY,
    get_client_info,
    get_content_archive_service,
    get_content_command_service,
    get_content_download_ticket_service,
    get_content_query_service,
    get_content_service,
    get_content_type_from_mime,
    get_db_pool,
    get_es_client,
    get_folder_view_service,
    get_malware_scanner,
    get_rate_limiter,
    get_reindex_rate_limiter,
    get_search_service,
    get_security_validator,
    get_version_manager_dep,
    process_content_background,
    require_content_admin,
)
from api.routers.unified_content_download import (  # noqa: E402, F401
    ContentDownloadTicketRequest,
    ContentDownloadTicketResponse,
    _build_content_download_response,
)
from api.routers.unified_content_crud import (  # noqa: E402, F401
    get_content,
    get_content_document_body,
    get_content_document_structure,
)
from api.services.rate_limiter import get_upload_rate_limiter  # noqa: E402, F401

__all__ = [
    "ARCHIVE_AUDIT_ACTION",
    "ARCHIVE_DOWNLOAD_CONCURRENCY",
    "ContentDownloadTicketRequest",
    "ContentDownloadTicketResponse",
    "_build_content_download_response",
    "get_client_info",
    "get_content",
    "get_content_archive_service",
    "get_content_command_service",
    "get_content_document_body",
    "get_content_document_structure",
    "get_content_download_ticket_service",
    "get_content_query_service",
    "get_content_service",
    "get_content_type_from_mime",
    "get_content_user_id",
    "get_db_pool",
    "get_es_client",
    "get_folder_view_service",
    "get_malware_scanner",
    "get_rate_limiter",
    "get_reindex_rate_limiter",
    "get_search_service",
    "get_security_validator",
    "get_upload_rate_limiter",
    "get_version_manager_dep",
    "process_content_background",
    "require_content_admin",
    "require_oauth2_user",
    "router",
]
