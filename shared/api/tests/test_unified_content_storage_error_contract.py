# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for safe Unified Content storage-error details returned by API helpers.
# Invariants:
# - Storage exceptions may be logged server-side, but HTTP details must not expose raw backend paths/messages.
# Related:
# - api/utils/content_storage_error_detail.py
# ---
"""Tests: Unified Content storage error HTTP contract."""

from __future__ import annotations

from api.utils.content_storage_error_detail import (
    INTERNAL_SERVER_ERROR_DETAIL_PREFIX,
    STORAGE_OBJECT_UNAVAILABLE_DETAIL,
    internal_server_error_detail,
    storage_object_unavailable_detail,
    storage_temporarily_unavailable_detail,
)


def test_storage_missing_detail_does_not_expose_raw_exception() -> None:
    detail = storage_object_unavailable_detail(ValueError("secret backend path /bucket/private/file.md"))

    assert detail == STORAGE_OBJECT_UNAVAILABLE_DETAIL
    assert "secret backend path" not in detail


def test_storage_generic_error_uses_reference_id() -> None:
    detail = internal_server_error_detail("abc123")

    assert detail == f"{INTERNAL_SERVER_ERROR_DETAIL_PREFIX}abc123"
    assert "raw backend timeout" not in detail


def test_storage_temporarily_unavailable_detail_does_not_expose_raw_exception() -> None:
    detail = storage_temporarily_unavailable_detail(RuntimeError("private endpoint timeout"))

    assert "private endpoint" not in detail
    assert "временно недоступно" in detail
