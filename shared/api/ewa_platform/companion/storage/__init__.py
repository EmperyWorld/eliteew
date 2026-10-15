# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Storage-first helpers for catalogue + ``unified_content`` (server-first and future classic merge).
# Invariants:
# - Callers that **write** must use the **main** app asyncpg pool (``DATABASE_URL``), not ``EWA_DATABASE_URL``.
# Related:
# - api/ewa_platform/companion/storage/catalog_pipeline.py
# - api/ewa_platform/docs/EWA-COMPANION-PACKAGE-MIGRATION.md
# ---
"""Companion catalogue / unified_content primitives."""

from __future__ import annotations

from api.ewa_platform.companion.storage.catalog_pipeline import (
    catalog_pick_owner_row,
    create_unified_companion_document,
    env_int_clamped,
    find_owner_ewa_file_by_exact_name,
    make_content_storage_service,
    reply_unified_content_schema_missing,
    sanitize_companion_new_filename,
    server_first_body_format,
    server_first_target_filename,
)

__all__ = (
    "catalog_pick_owner_row",
    "create_unified_companion_document",
    "env_int_clamped",
    "find_owner_ewa_file_by_exact_name",
    "make_content_storage_service",
    "reply_unified_content_schema_missing",
    "sanitize_companion_new_filename",
    "server_first_body_format",
    "server_first_target_filename",
)
