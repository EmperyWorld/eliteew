# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Normalize Content Manager list filters for file size and processing_status.
# Invariants:
# - processing_status must be one of the unified_content enum values (case-insensitive).
# - min_file_size is bytes, non-negative integer.
# Related:
# - api/services/unified_content/content_storage_list.py
# - documentation/product/CONTENT-MANAGER.md
# ---

from __future__ import annotations

CONTENT_LIST_PROCESSING_STATUSES = frozenset(
    {
        "pending",
        "processing",
        "completed",
        "failed",
    }
)


def normalize_content_list_min_file_size(raw: int | None) -> int | None:
    if raw is None:
        return None
    value = int(raw)
    if value < 0:
        raise ValueError("invalid min_file_size")
    return value


def normalize_content_list_processing_status(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = str(raw).strip().lower()
    if not value:
        return None
    if value not in CONTENT_LIST_PROCESSING_STATUSES:
        raise ValueError("invalid processing_status")
    return value
