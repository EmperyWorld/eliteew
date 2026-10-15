"""Unified content domain: content, search, versions, shares."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI  # type: ignore[import-untyped]


def register_domain_content(app: FastAPI) -> None:
    """Register unified content system routers."""
    from api.routers.unified_content import router as unified_content  # noqa: PLC0415
    from api.routers.unified_content_processing import (  # noqa: PLC0415
        router as unified_content_processing,
    )
    from api.routers.unified_content_search import router as unified_content_search  # noqa: PLC0415
    from api.routers.unified_content_shares import router as unified_content_shares  # noqa: PLC0415
    from api.routers.unified_content_versions import (  # noqa: PLC0415
        router as unified_content_versions,
    )

    app.include_router(
        unified_content,
        prefix="/api/v1",
        tags=["Unified Content - Single Source of Truth for All Content"],
    )
    app.include_router(
        unified_content_processing,
        prefix="/api/v1",
        tags=["Unified Content - Processing"],
    )
    app.include_router(unified_content_search, prefix="/api/v1", tags=["Unified Content - Search & Indexing"])
    app.include_router(unified_content_versions, prefix="/api/v1", tags=["Unified Content - Versioning"])
    app.include_router(unified_content_shares, prefix="/api/v1", tags=["Unified Content - Sharing & Collaboration"])
    app.include_router(unified_content, prefix="/api", tags=["Unified Content - Backward Compatibility"])
    app.include_router(
        unified_content_processing,
        prefix="/api",
        tags=["Unified Content - Processing (Legacy)"],
    )
    app.include_router(unified_content_search, prefix="/api", tags=["Unified Content - Search & Indexing (Legacy)"])
    app.include_router(unified_content_versions, prefix="/api", tags=["Unified Content - Versioning (Legacy)"])
    app.include_router(
        unified_content_shares,
        prefix="/api",
        tags=["Unified Content - Sharing & Collaboration (Legacy)"],
    )
