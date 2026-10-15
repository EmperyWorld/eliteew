from __future__ import annotations

"""
Utility for automatic router registration with v1 and legacy versions.
Reduces code duplication in main.py.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from enum import Enum

    from fastapi import APIRouter, FastAPI  # type: ignore[import-untyped]


def register_router_v1_and_legacy(
    app: FastAPI,
    router: APIRouter,
    v1_prefix: str = "/api/v1",
    legacy_prefix: str = "/api",
    v1_tags: list[str] | None = None,
    legacy_tags: list[str] | None = None,
    v1_include_in_schema: bool = True,
    legacy_include_in_schema: bool = True,
) -> None:
    """
    Register a router with both v1 and legacy prefixes automatically.

    Args:
        app: FastAPI application instance
        router: Router to register
        v1_prefix: Prefix for v1 version (default: "/api/v1")
        legacy_prefix: Prefix for legacy version (default: "/api")
        v1_tags: Tags for v1 version (if None, uses router.tags)
        legacy_tags: Tags for legacy version (if None, adds " (Legacy)" to v1 tags)
        v1_include_in_schema: Whether to include v1 in OpenAPI schema
        legacy_include_in_schema: Whether to include legacy in OpenAPI schema
    """
    # Determine tags

    base_tags_raw = v1_tags or router.tags or []
    # Convert to list[str | Enum] for FastAPI compatibility
    # All tags are converted to str, which is compatible with str | Enum
    # Enum is imported in TYPE_CHECKING block for type annotations
    base_tags: list[str | Enum] = (  # type: ignore[valid-type]
        [str(tag) if not isinstance(tag, str) else tag for tag in base_tags_raw] if base_tags_raw else []
    )
    v1_final_tags: list[str | Enum] = base_tags  # type: ignore[valid-type]

    # Convert legacy_tags to list[str | Enum] if provided, otherwise generate from base_tags
    if legacy_tags is not None:
        legacy_final_tags_list: list[str | Enum] = [  # type: ignore[valid-type]
            str(tag) if not isinstance(tag, str) else tag for tag in legacy_tags
        ]
    elif base_tags:
        legacy_final_tags_list = [f"{str(tag)} (Legacy)" for tag in base_tags]
    else:
        legacy_final_tags_list = ["Legacy"]
    legacy_final_tags: list[str | Enum] = legacy_final_tags_list  # type: ignore[valid-type]

    # Register v1 version
    app.include_router(
        router,
        prefix=v1_prefix,
        tags=v1_final_tags,
        include_in_schema=v1_include_in_schema,
    )

    # Register legacy version
    app.include_router(
        router,
        prefix=legacy_prefix,
        tags=legacy_final_tags,
        include_in_schema=legacy_include_in_schema,
    )
