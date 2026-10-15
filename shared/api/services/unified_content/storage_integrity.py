# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Storage integrity constants and SQL helpers for unified_content quarantine.
# Invariants:
# - broken_quarantined stays visible only in owner broken list (deleted_at NULL).
# - Reason codes never include storage paths or fids.
# Related:
# - documentation/product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md
# ---

from __future__ import annotations

STORAGE_INTEGRITY_OK = "ok"
STORAGE_INTEGRITY_BROKEN_QUARANTINED = "broken_quarantined"
STORAGE_INTEGRITY_BLOB_MISSING = "blob_missing"

REASON_SEAWEED_NEEDLE_MISSING = "seaweed_needle_missing"
REASON_INCOMPLETE_READ = "incomplete_read"
REASON_BLOB_UNREADABLE = "blob_unreadable"
REASON_RECHECK_FAILED = "recheck_failed"

# Exclude user-quarantined rows from library list / folder-view / previews / search.
SQL_EXCLUDE_BROKEN_QUARANTINED = "coalesce(storage_integrity_status, '') <> 'broken_quarantined'"

NEGATIVE_CACHE_KEY_PREFIX = "content:storage_broken:"
NEGATIVE_CACHE_TTL_SECONDS = 120


def reason_from_storage_error(exc: BaseException) -> str:
    """Map Seaweed exception text to a short stable reason code (no paths)."""
    text = str(exc).lower()
    # Volume needle 404 often surfaces as IncompleteRead(0 bytes read, N more expected).
    if "incomplete" in text and ("0 bytes read" in text or "not found" in text):
        return REASON_SEAWEED_NEEDLE_MISSING
    if "not found" in text or "nosuchkey" in text or "nosuchobject" in text:
        return REASON_SEAWEED_NEEDLE_MISSING
    if "incomplete" in text:
        return REASON_INCOMPLETE_READ
    return REASON_BLOB_UNREADABLE


class StorageBlobKnownBrokenError(Exception):
    """Content already quarantined or negative-cached — do not call Seaweed."""
