# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Logical** catalogue-listing dedup **and noise-filter** helpers for the EWA companion. Two distinct concerns:
# (1) ``unified_content`` legacy migrations created multiple physical rows for the same logical artefact —
#     ``dedupe_catalog_rows_by_logical_identity`` collapses them by ``file_hash`` / ``original_filename`` /
#     ``content_type`` so the LLM is not shown ``uc=`` aliases for the same file.
# (2) System-imported migration stubs (``source_service`` such as ``ewdesk_legacy_regen``) created 80+ unique-hash
#     image rows that drown user files in the companion ``browse``-style appendix. They are not “duplicates” by hash
#     and pre-date pure dedup; ``filter_companion_browse_noise_rows`` drops them by ``source_service`` and obvious
#     ``EWDesk legacy <stem>`` name pattern. Configurable via ``EWA_COMPANION_CATALOG_BROWSE_NOISE_SOURCES``.
# Invariants:
# - **Pure**, no I/O, no logging side effects beyond a ``[STEP] catalog_listing_dedup`` / ``..._noise_filter`` line.
# - Preserves **first occurrence** order so the row with the earliest ``created_at`` remains canonical.
# - Logical dedup key precedence:
#     1) (``file_hash``, ``original_filename``) when both present;
#     2) (``file_hash``, ``name``) when ``original_filename`` missing;
#     3) (``content_type``, ``original_filename``) when no hash but a stable filename is present;
#     4) ``id`` fallback (legacy ``dedupe_catalog_rows_by_id`` behaviour).
# - Noise filter is **deny-list only**: nothing matching ``source_service`` outside the configured set is dropped.
#   Empty / whitespace string values never collapse rows (treated as “unknown”).
# Related:
# - api/ewa_platform/companion/storage/doceditor_content_resolve.py (``dedupe_catalog_rows_by_id`` — id-only sibling)
# - api/ewa_platform/companion/storage/catalog_find.py (browse/keyword listing entrypoint)
# - api/ewa_platform/gateways/runtime_gateway/runtime_command.py (CRUD command listing)
# - api/migrations/2026_05_12_unified_content_legacy_dup_archive.sql
# ---
"""Logical-identity dedup + noise-filter for ``unified_content`` listing rows surfaced to the EWA companion."""

from __future__ import annotations

import logging
import os
import re
from collections.abc import Iterable
from typing import Any, Final

logger = logging.getLogger(__name__)

# System-imported migration buckets that should never surface in the companion browse listing — they are not
# “user files” in any meaningful sense (auto-regenerated wallpapers, EWDesk hero stubs, etc.). The env knob
# extends the default deny-list at runtime; an empty string disables filtering entirely.
_DEFAULT_BROWSE_NOISE_SOURCE_SERVICES: Final[frozenset[str]] = frozenset(
    {
        "ewdesk_legacy_regen",
        "ewdesk_legacy_regen_imgonly",
    }
)

_EWDESK_LEGACY_NAME_RE: Final[re.Pattern[str]] = re.compile(
    r"(?i)^EWDesk\s+legacy\s+legacy-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*$"
)


def _attr(row: Any, *names: str) -> str:
    """Return the first non-empty string-coercible attribute among ``names`` (case-insensitive trimmed)."""
    for n in names:
        value = getattr(row, n, None)
        if value is None and isinstance(row, dict):
            value = row.get(n)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _logical_key(row: Any) -> tuple[str, str] | None:
    """Compute the **logical** dedup key for one catalog row, or ``None`` when no stable identity is available."""
    file_hash = _attr(row, "file_hash", "fileHash", "content_hash", "extracted_text_hash")
    name = _attr(row, "original_filename", "originalFilename", "name", "title")
    content_type = _attr(row, "content_type", "contentType", "mime_type", "mimeType")

    if file_hash and name:
        return ("hash+name", f"{file_hash}::{name.lower()}")
    if file_hash:
        return ("hash", file_hash)
    if content_type and name:
        return ("type+name", f"{content_type.lower()}::{name.lower()}")
    return None


def dedupe_catalog_rows_by_logical_identity(
    rows: Iterable[Any],
    *,
    step_label: str = "catalog_listing_dedup",
) -> list[Any]:
    """Stable dedup preserving the first occurrence of each logical artefact.

    Falls back to ``id`` when no logical key is computable for a row. Logs a one-line ``[STEP]`` summary so we can
    observe regression in dumps (``in=NN out=MM dropped=KK``).
    """

    out: list[Any] = []
    seen_logical: dict[str, str] = {}
    seen_ids: set[str] = set()
    dropped = 0
    total = 0

    for row in rows:
        total += 1
        rid = getattr(row, "id", None) if not isinstance(row, dict) else row.get("id")
        rid_s = str(rid).strip() if rid is not None else ""

        logical = _logical_key(row)
        if logical is None:
            if rid_s and rid_s in seen_ids:
                dropped += 1
                continue
            if rid_s:
                seen_ids.add(rid_s)
            out.append(row)
            continue

        kind, key = logical
        if key in seen_logical:
            dropped += 1
            continue
        seen_logical[key] = kind
        if rid_s:
            seen_ids.add(rid_s)
        out.append(row)

    if dropped:
        logger.info("[STEP] %s in=%s out=%s dropped=%s", step_label, total, len(out), dropped)

    return out


def _configured_noise_source_services() -> frozenset[str]:
    """Resolve the active deny-list for browse noise rows (env-overridable)."""

    raw = os.getenv("EWA_COMPANION_CATALOG_BROWSE_NOISE_SOURCES")
    if raw is None:
        return _DEFAULT_BROWSE_NOISE_SOURCE_SERVICES
    text = raw.strip()
    if not text:
        return frozenset()
    extra = {token.strip().lower() for token in text.split(",") if token.strip()}
    return frozenset(_DEFAULT_BROWSE_NOISE_SOURCE_SERVICES | extra)


def is_companion_browse_noise_row(row: Any) -> bool:
    """``True`` when ``row`` is a system-imported migration stub that should not surface in the companion catalog.

    Two complementary signals:
      * ``source_service`` belongs to the configured deny-list (the strict signal — rows authored by an automated
        migration / regeneration job, never by the user);
      * ``name`` matches the canonical ``EWDesk legacy <legacy-uuid>`` pattern produced by the original migration.
    Both fall back gracefully when one is missing — the pattern alone is enough for old rows without ``source_service``.
    """

    noise_sources = _configured_noise_source_services()
    if noise_sources:
        src = _attr(row, "source_service", "sourceService").lower()
        if src in noise_sources:
            return True
    name = _attr(row, "name", "title")
    return bool(name and _EWDESK_LEGACY_NAME_RE.match(name))


def filter_companion_browse_noise_rows(
    rows: Iterable[Any],
    *,
    step_label: str = "catalog_listing_noise_filter",
) -> list[Any]:
    """Stable deny-list filter dropping system migration stubs from the companion browse listing."""

    out: list[Any] = []
    dropped = 0
    total = 0
    for row in rows:
        total += 1
        if is_companion_browse_noise_row(row):
            dropped += 1
            continue
        out.append(row)
    if dropped:
        logger.info("[STEP] %s in=%s out=%s dropped=%s", step_label, total, len(out), dropped)
    return out


__all__ = (
    "dedupe_catalog_rows_by_logical_identity",
    "filter_companion_browse_noise_rows",
    "is_companion_browse_noise_row",
)
